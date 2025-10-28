from flask import Flask, render_template, redirect, url_for, request, flash, session
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from flask_mail import Mail, Message
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
import random
from sqlalchemy.exc import IntegrityError
from datetime import datetime

app = Flask(__name__)
app.secret_key = "your_secret_key"
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:gCEk4bteN)QgwfbA@localhost/db_maintenance'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Gmail configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'teopecezar6@gmail.com'
app.config['MAIL_PASSWORD'] = 'kpjjoctssqxvvziy'
app.config['MAIL_DEFAULT_SENDER'] = ('OTP System', 'teopecezar6@gmail.com')
mail = Mail(app)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
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

class Request(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default='Pending')
    submitted_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date_submitted = db.Column(db.DateTime, default=datetime.utcnow)

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
        # Employee sees only their own tickets
        tickets = Request.query.filter_by(submitted_by=current_user.id).all()
    elif current_user.role == 'maintenance':
        # Maintenance sees only tickets for their department
        tickets = Request.query.filter_by(category=current_user.department).all()
    else:
        # Admin sees all tickets
        tickets = Request.query.all()

    return render_template('dashboard.html', user=current_user, tickets=tickets)


@app.route('/submit_ticket', methods=['GET', 'POST'])
@login_required
def submit_ticket():
    if current_user.role != 'employee':
        flash("Only employees can submit tickets.", "danger")
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        title = request.form['title']
        description = request.form['description']
        category = request.form['category']

        new_request = Request(
            title=title,
            description=description,
            category=category,
            submitted_by=current_user.id
        )

        db.session.add(new_request)
        db.session.commit()

        flash("Ticket submitted successfully!", "success")
        return redirect(url_for('dashboard'))

    # Categories to choose from
    categories = ["Plumbing", "Electrical", "IT Support", "Carpentry"]
    return render_template('submit_ticket.html', categories=categories)

@app.route('/delete_ticket/<int:ticket_id>', methods=['POST'])
@login_required
def delete_ticket(ticket_id):
    ticket = Request.query.get(ticket_id)

    if not ticket:
        flash("Ticket not found.", "danger")
        return redirect(url_for('dashboard'))

    # Check if this ticket belongs to the current user
    if ticket.submitted_by != current_user.id:
        flash("You can only delete your own tickets.", "danger")
        return redirect(url_for('dashboard'))

    # Allow delete only if still pending
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
