import random

from flask import Flask, render_template, redirect, url_for, request, flash, session, jsonify
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from flask_mail import Mail, Message
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from zoneinfo import ZoneInfo
from config import Config
from sqlalchemy import text

app = Flask(__name__)
app.config.from_object(Config)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
mail = Mail(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
migrate = Migrate(app, db)

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    department = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False)

class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default='Pending')
    submitted_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    submitted_name = db.Column(db.String(150), nullable=False)
    date_submitted = db.Column(db.DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Manila")))
    approved_by = db.Column(db.String(150))
    date_approved = db.Column(db.DateTime)

    # EASY REFERENCE PARA SA USERS
    user = db.relationship('User', backref=db.backref('tickets', cascade='all, delete-orphan'), lazy=True)

class DoneTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, nullable=False)  # reference to original ticket
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    department = db.Column(db.String(100), nullable=False)
    employee_first_name = db.Column(db.String(100))
    employee_last_name = db.Column(db.String(100))
    maintenance_first_name = db.Column(db.String(100))
    maintenance_last_name = db.Column(db.String(100))
    date_approved = db.Column(db.DateTime, nullable=False)
    date_done = db.Column(db.DateTime, nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def home():
    return redirect(url_for('login'))

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        # data
        first_name = request.form['first_name']
        last_name = request.form['last_name']
        username = request.form['username']
        password = request.form['password']
        email = request.form['email']
        role = request.form['role']
        department = request.form.get('maintenanceType') if role == 'maintenance' else None

        session['temp_first_name'] = first_name
        session['temp_last_name'] = last_name
        session['temp_username'] = username
        session['temp_password'] = password
        session['temp_email'] = email
        session['temp_role'] = role
        session['temp_department'] = department

        # Generate OTP
        otp = random.randint(100000, 999999)
        session['otp'] = otp

        # Send OTP email
        msg = Message('Your OTP Code', recipients=[email])
        msg.body = f'Your OTP is: {otp}'
        mail.send(msg)

        return redirect(url_for('verify_otp'))

    return render_template('signup.html')


@app.route('/verify_otp', methods=['GET', 'POST'])
def verify_otp():
    if request.method == 'POST':
        entered_otp = request.form['otp']
        stored_otp = session.get('otp')

        if str(entered_otp) == str(stored_otp):
            # Restrict admin signup to only one account
            if session['temp_role'] == 'admin':
                existing_admin = User.query.filter_by(role='admin').first()
                if existing_admin:
                    flash("An admin account already exists. Cannot create another.", "danger")
                    return redirect(url_for('signup'))

            new_user = User(
                first_name=session['temp_first_name'],
                last_name=session['temp_last_name'],
                username=session['temp_username'],
                password=bcrypt.generate_password_hash(session['temp_password']).decode('utf-8'),
                email=session['temp_email'],
                role=session['temp_role'],
                department=session['temp_department']
            )

            try:
                db.session.add(new_user)
                db.session.commit()
                flash('Account created successfully! You can now log in.', 'success')

                # Clear session
                session.pop('otp', None)
                session.pop('temp_first_name', None)
                session.pop('temp_last_name', None)
                session.pop('temp_username', None)
                session.pop('temp_password', None)
                session.pop('temp_email', None)
                session.pop('temp_role', None)
                session.pop('temp_department', None)

                return redirect(url_for('login'))

            except:
                db.session.rollback()  # Undo the failed commit
                flash('Username or email already exists. Please try again with a different one.', 'danger')
                return redirect(url_for('signup'))

        else:
            flash('Invalid OTP, please try again.', 'danger')
            return redirect(url_for('verify_otp'))

    return render_template('verify_otp.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            flash('Login successful!', 'success')
            # redirect to proper dashboard based on role
            if user.role == 'employee':
                return redirect(url_for('dashboard'))
            elif user.role == 'maintenance':
                return redirect(url_for('maintenance_dashboard'))
            elif user.role == 'admin':
                return redirect(url_for('admin_dashboard'))

    return render_template('login.html')


@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role != 'employee':
        flash("Unauthorized access.", "danger")
        return redirect(url_for('login'))
    tickets = Ticket.query.filter_by(submitted_by=current_user.id).all()
    return render_template('dashboard.html', user=current_user, tickets=tickets)

@app.route('/maintenance_dashboard')
@login_required
def maintenance_dashboard():
    if current_user.role != 'maintenance':
        flash("You are not authorized to access this page.", "danger")
        return redirect(url_for('dashboard'))

    # Show only tickets assigned to their department
    tickets = Ticket.query.filter_by(category=current_user.department).all()

    for ticket in tickets:
        if ticket.date_submitted:
            ticket.date_submitted = ticket.date_submitted.astimezone(ZoneInfo("Asia/Manila"))

    return render_template('maintenance_dashboard.html', user=current_user, tickets=tickets)

@app.route('/admin_dashboard')
@login_required
def admin_dashboard():
    if current_user.role != 'admin':
        flash("You are not authorized to access this page.", "danger")
        return redirect(url_for('dashboard'))

    # FETCH ALL THE USERS
    users = User.query.all()

    # FETCH ALL THE TICKETS
    tickets = Ticket.query.all()

    # FILTER BY DEPARTMENT
    department_filter = request.args.get('department')
    if department_filter:
        tickets = Ticket.query.filter_by(category=department_filter).all()

    done_tickets = DoneTicket.query.all()
    return render_template('admin_dashboard.html', users=users, tickets=tickets, done_tickets=done_tickets)

@app.route('/submit_ticket', methods=['POST'])
@login_required
def submit_ticket():
    if current_user.role != 'employee':
        flash("Only employees can submit tickets.", "danger")
        return redirect(url_for('dashboard'))

    title = request.form['title']
    description = request.form['description']
    category = request.form['category']
    submitted_name = f"{current_user.first_name} {current_user.last_name}"

    new_ticket = Ticket(
        title=title,
        description=description,
        category=category,
        submitted_by=current_user.id,
        submitted_name=submitted_name
    )

    db.session.add(new_ticket)
    db.session.commit()
    flash("Ticket submitted successfully!", "success")
    return redirect(url_for('dashboard'))

@app.route('/approve_ticket/<int:ticket_id>', methods=['POST'])
@login_required
def approve_ticket(ticket_id):
    if current_user.role != 'maintenance':
        flash("You are not authorized to approve tickets.", "danger")
        return redirect(url_for('dashboard'))

    ticket = Ticket.query.get(ticket_id)
    if not ticket:
        flash("Ticket not found.", "danger")
        return redirect(url_for('maintenance_dashboard'))

    ticket.status = 'Approved'
    ticket.approved_by = f"{current_user.first_name} {current_user.last_name}"
    ticket.date_approved = datetime.now(ZoneInfo("Asia/Manila"))

    db.session.commit()
    flash("Ticket approved successfully!", "success")
    return redirect(url_for('maintenance_dashboard'))

@app.route('/edit_ticket/<int:ticket_id>', methods=['GET', 'POST'])
def edit_ticket(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)

    if request.method == 'POST':
        ticket.title = request.form['title']
        ticket.description = request.form['description']
        ticket.category = request.form['category']
        db.session.commit()
        flash('Ticket updated successfully!', 'success')
        return redirect(url_for('dashboard'))

    return render_template('edit_ticket.html', ticket=ticket)

@app.route('/done_ticket/<int:ticket_id>', methods=['POST'])
@login_required
def done_ticket(ticket_id):
    if current_user.role != 'maintenance':
        flash("You are not authorized to mark tickets as done.", "danger")
        return redirect(url_for('dashboard'))

    ticket = Ticket.query.get(ticket_id)
    if not ticket or ticket.status != 'Approved':
        flash("Ticket not valid to mark as done.", "danger")
        return redirect(url_for('maintenance_dashboard'))

    # DONE TICKET CREATION
    done_ticket = DoneTicket(
        ticket_id=ticket.id,
        title=ticket.title,
        description=ticket.description,
        department=ticket.category,
        employee_first_name=ticket.submitted_name.split(" ")[0] if ticket.submitted_name else "",
        employee_last_name=" ".join(ticket.submitted_name.split(" ")[1:]) if ticket.submitted_name else "",
        maintenance_first_name=current_user.first_name,
        maintenance_last_name=current_user.last_name,
        date_approved=ticket.date_approved or datetime.now(ZoneInfo("Asia/Manila")),
        date_done=datetime.now(ZoneInfo("Asia/Manila"))
    )

    # Add DoneTicket record, update original Ticket
    db.session.add(done_ticket)
    ticket.status = 'Done'
    ticket.approved_by = f"{ticket.approved_by or ''} • {current_user.first_name} {current_user.last_name}"
    ticket.date_approved = done_ticket.date_approved

    db.session.commit()

    flash("Ticket marked as done.", "success")
    return redirect(url_for('maintenance_dashboard'))



@app.route('/cancel_ticket/<int:ticket_id>', methods=['POST'])
@login_required
def cancel_ticket(ticket_id):
    ticket = Ticket.query.get(ticket_id)
    if not ticket:
        flash("Ticket not found.", "danger")
        return redirect(url_for('maintenance_dashboard'))

    if current_user.role == 'maintenance' or (current_user.role == 'employee' and ticket.submitted_by == current_user.id):
        db.session.delete(ticket)
        db.session.commit()
        flash("Ticket cancelled successfully.", "success")
    else:
        flash("You cannot cancel this ticket.", "danger")

    return redirect(url_for('maintenance_dashboard'))


@app.route('/delete_ticket/<int:ticket_id>', methods=['POST'])
@login_required
def delete_ticket(ticket_id):
    ticket = Ticket.query.get(ticket_id)

    if not ticket:
        flash("Ticket not found.", "danger")
        return redirect(url_for('dashboard'))

    # CHECKER IF THIS WAS BELONGED TO A USER
    if ticket.submitted_by != current_user.id:
        flash("You can only delete your own tickets.", "danger")
        return redirect(url_for('dashboard'))

    #FEATURE: ALLOWING THE USER TO DELETE WHILE THE TICKET IS PENDING
    if ticket.status == 'Pending':
        db.session.delete(ticket)
        db.session.commit()

        # FIX THE DB IF THE EMPLOYEE DELETES THE TICKET
        if Ticket.query.count() == 0:
            db.session.execute(text("ALTER TABLE ticket AUTO_INCREMENT = 1"))
            db.session.commit()

        flash("Ticket successfully deleted.", "success")

    else:
        flash("You cannot delete a ticket that has already been approved or is in progress.", "warning")

    return redirect(url_for('dashboard'))

@app.route('/search_users', methods=['GET'])
def search_users():
    query = request.args.get('q', '').strip()

    if query:
        results = User.query.filter(
            (User.first_name.ilike(f'%{query}%')) |
            (User.last_name.ilike(f'%{query}%')) |
            (User.email.ilike(f'%{query}%')) |
            (User.role.ilike(f'%{query}%'))
        ).all()
    else:
        results = []

    return render_template('search_results.html', users=results, query=query)

@app.route('/filter_tickets')
@login_required
def filter_tickets():
    status = request.args.get('status', 'All')
    department = request.args.get('department', 'All')

    #COMPARISONS
    status = status or 'All'
    department = department or 'All'

    def ticket_to_dict(t):
        return {
            'id': t.id,
            'title': t.title,
            'description': t.description,
            'status': getattr(t, 'status', 'Done'),  # Tickets have status, DoneTicket will be handled separately
            'category': getattr(t, 'category', getattr(t, 'department', '')),
            'submitted_name': getattr(t, 'submitted_name', f"{getattr(t, 'employee_first_name', '')} {getattr(t, 'employee_last_name', '')}").strip(),
            'date_submitted': getattr(t, 'date_submitted', getattr(t, 'date_done', None)).strftime("%B %d, %Y at %I:%M %p") if getattr(t, 'date_submitted', getattr(t, 'date_done', None)) else ''
        }

    tickets = []

    if status == 'Done':
        q = DoneTicket.query
        if department != 'All':
            q = q.filter_by(department=department)
        # If maintenance user, restrict to their department
        if current_user.role == 'maintenance':
            q = q.filter_by(department=current_user.department)
        done_rows = q.all()
        tickets = [ticket_to_dict(d) for d in done_rows]

    elif status == 'All':
        # Standard Tickets (pending/approved/etc)
        q = Ticket.query
        if current_user.role == 'maintenance':
            q = q.filter_by(category=current_user.department)
        elif current_user.role == 'employee':
            q = q.filter_by(submitted_by=current_user.id)
        if department != 'All' and current_user.role == 'admin':
            q = q.filter_by(category=department)
        tickets = [ticket_to_dict(t) for t in q.all()]

        # Append DoneTicket rows if requested (All includes Done)
        dq = DoneTicket.query
        if department != 'All':
            dq = dq.filter_by(department=department)
        if current_user.role == 'maintenance':
            dq = dq.filter_by(department=current_user.department)
        tickets += [ticket_to_dict(d) for d in dq.all()]

    # OPTIONAL: (Pending / Approved) query Ticket table only
    else:
        q = Ticket.query
        if current_user.role == 'maintenance':
            q = q.filter_by(category=current_user.department)
        elif current_user.role == 'employee':
            q = q.filter_by(submitted_by=current_user.id)
        if status != 'All':
            q = q.filter_by(status=status)
        if department != 'All' and current_user.role == 'admin':
            q = q.filter_by(category=department)
        tickets = [ticket_to_dict(t) for t in q.all()]

    return jsonify(tickets)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully!', 'info')
    return redirect(url_for('login'))


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
