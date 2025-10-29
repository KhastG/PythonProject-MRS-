import random

from flask import Flask, render_template, redirect, url_for, request, flash, session
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from flask_mail import Mail, Message
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone
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

# ----------------------------
# Database Models
# ----------------------------
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
    date_submitted = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    approved_by = db.Column(db.String(150))
    date_approved = db.Column(db.DateTime)

    # Optional relationship for easy reference to user
    user = db.relationship('User', backref=db.backref('tickets', cascade='all, delete-orphan'), lazy=True)

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

            except IntegrityError:
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
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid credentials!', 'danger')

    return render_template('login.html')


@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role == 'employee':
        tickets = Ticket.query.filter_by(submitted_by=current_user.id).all()
    elif current_user.role == 'maintenance':
        tickets = Ticket.query.filter_by(category=current_user.department).all()
    else:
        tickets = Ticket.query.all()

    for ticket in tickets:
        if ticket.date_submitted:
            ticket.local_date_submitted = ticket.date_submitted.astimezone(ZoneInfo("Asia/Manila"))

    return render_template('dashboard.html', user=current_user, tickets=tickets)

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


@app.route('/delete_ticket/<int:ticket_id>', methods=['POST'])
@login_required
def delete_ticket(ticket_id):
    ticket = Ticket.query.get(ticket_id)

    if not ticket:
        flash("Ticket not found.", "danger")
        return redirect(url_for('dashboard'))

    # checker if  this was belonged to the user
    if ticket.submitted_by != current_user.id:
        flash("You can only delete your own tickets.", "danger")
        return redirect(url_for('dashboard'))

    if Ticket.query.count() == 0:
        # Reset AUTO_INCREMENT to 1 (MySQL)
        db.session.execute(text("ALTER TABLE ticket AUTO_INCREMENT = 1"))
        db.session.commit()

    #FEATURE: ALLOWING THE USER TO DELETE WHILE THE TICKET IS PENDING
    if ticket.status == 'Pending':
        db.session.delete(ticket)
        db.session.commit()
        flash("Ticket successfully deleted.", "success")
    else:
        flash("You cannot delete a ticket that has already been approved or is in progress.", "warning")

    return redirect(url_for('dashboard'))


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
