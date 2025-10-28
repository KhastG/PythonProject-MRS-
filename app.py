import random
from flask import Flask, render_template, redirect, url_for, request, flash
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_mail import Mail, Message
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask import request, jsonify
from flask import session
from flask_login import UserMixin


app = Flask(__name__)
app.secret_key = "your_secret_key"
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:gCEk4bteN)QgwfbA@localhost/db_maintenance'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

#GMAIL
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'teopecezar6@gmail.com'
app.config['MAIL_PASSWORD'] = 'kpjjoctssqxvvziy'
app.config['MAIL_DEFAULT_SENDER'] = ('OTP System', 'teopecezar6@gmail.com')
mail = Mail(app)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager()
login_manager.login_view = 'login'  # route name for login page
login_manager.init_app(app)
migrate = Migrate(app, db)

# ----------------------------
# Database Model
# ----------------------------
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    department = db.Column(db.String(100))  # optional for maintenance users
    email = db.Column(db.String(120), unique=True, nullable=False)

class Request(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False)  # e.g., Electrical, IT Support
    status = db.Column(db.String(50), default='Pending')
    submitted_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ----------------------------
# Routes
# ----------------------------
@app.route('/')
def home():
    return redirect(url_for('login'))

from flask import session

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        email = request.form['email']
        role = request.form['role']

        # Generate OTP and send email
        otp = random.randint(100000, 999999)
        msg = Message('Your OTP Code', recipients=[email])
        msg.body = f'Your OTP is: {otp}'
        mail.send(msg)

        # Temporarily store user info + OTP
        session['otp'] = str(otp)
        session['temp_username'] = username
        session['temp_password'] = password
        session['temp_email'] = email
        session['temp_role'] = role

        flash('OTP sent to your email! Please verify.', 'info')
        return redirect(url_for('verify_otp'))

    return render_template('signup.html')


@app.route('/send_otp', methods=['POST'])
def send_otp():
    email = request.form.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Missing email'})

    otp = random.randint(100000, 999999)
    msg = Message('Your OTP Code', recipients=[email])
    msg.body = f'Your OTP is: {otp}'

    try:
        mail.send(msg)
        return jsonify({'success': True, 'message': 'OTP sent', 'otp': otp})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/verify_otp', methods=['GET', 'POST'])
def verify_otp():
    if request.method == 'POST':
        entered_otp = request.form['otp']
        stored_otp = session.get('otp')

        if str(entered_otp) == str(stored_otp):
            username = session.get('temp_username')
            password = session.get('temp_password')
            email = session.get('temp_email')
            role = session.get('temp_role')

            hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
            new_user = User(username=username, password=hashed_pw, email=email, role=role)
            db.session.add(new_user)
            db.session.commit()

            # Clear session
            session.pop('otp', None)
            session.pop('temp_username', None)
            session.pop('temp_password', None)
            session.pop('temp_email', None)
            session.pop('temp_role', None)

            flash('Account created successfully! You can now log in.', 'success')
            return redirect(url_for('login'))
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
        # Employee: see only their own requests
        requests = Request.query.filter_by(submitted_by=current_user.id).all()
    elif current_user.role == 'maintenance':
        # Maintenance: see only requests for their department
        requests = Request.query.filter_by(category=current_user.department).all()
    else:
        # Admin: see all
        requests = Request.query.all()

    return render_template('dashboard.html', user=current_user, requests=requests)


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
