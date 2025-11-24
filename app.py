import random
import os
import threading
import mimetypes

from flask import Flask, render_template, redirect, url_for, request, session, jsonify, Response, get_flashed_messages, flash
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from flask_mail import Mail, Message
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from zoneinfo import ZoneInfo
from config import Config
from sqlalchemy import text
from smtplib import SMTPRecipientsRefused
from werkzeug.utils import secure_filename

app = Flask(__name__)  # <--------------------------------------| WAG NA TONG GAGALAWIN!!!
app.config.from_object(Config)#                                 |
#access secret key                                              |
SECRET_ADMIN_KEY = Config.SECRET_ADMIN_KEY#                     |
UPLOAD_FOLDER = 'static/uploads'#                               |
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}#             |
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER#                    |
#                                                               | this line of code refers to the connection of the db and also the email and the app password from the config.py and .env file
#                                                               |
db = SQLAlchemy(app)  #                                         |
bcrypt = Bcrypt(app)  #                                         |
mail = Mail(app)  #                                             |
login_manager = LoginManager(app)  #                            |
login_manager.login_view = 'login'  #                           |
migrate = Migrate(app, db)  # <---------------------------------|

# Database Models
#pending users
class PendingUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)   # store hashed password
    role = db.Column(db.String(50), nullable=False)
    department = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False)
    is_approved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Manila")))

#users
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    department = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False)
    is_approved = db.Column(db.Boolean, default=False)

#tickets
class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    photo = db.Column(db.String(255))
    photo_data = db.Column(db.LargeBinary)
    category = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default='Pending')
    submitted_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    submitted_name = db.Column(db.String(150), nullable=False)
    date_submitted = db.Column(db.DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Manila")))
    approved_by = db.Column(db.String(150))
    date_approved = db.Column(db.DateTime)

    # EASY REFERENCE PARA SA USERS
    user = db.relationship('User', backref=db.backref('tickets', cascade='all, delete-orphan'), lazy=True)

#For done tickets
class DoneTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, nullable=False)  # reference to original ticket
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    photo = db.Column(db.String(255))
    photo_data = db.Column(db.LargeBinary)
    department = db.Column(db.String(100), nullable=False)
    employee_first_name = db.Column(db.String(100))
    employee_last_name = db.Column(db.String(100))
    maintenance_first_name = db.Column(db.String(100))
    maintenance_last_name = db.Column(db.String(100))
    date_approved = db.Column(db.DateTime, nullable=False)
    date_done = db.Column(db.DateTime, nullable=False)

class EmailLogs(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    recipient_email = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    date_sent = db.Column(db.DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Manila")))

#email helper function
def send_email(subject, recipient, body, html_body=None, sender=None):
    status = "SUCCESS"
    try:
        msg = Message(subject, recipients=[recipient])
        if html_body:
            msg.html = html_body
        else:
            msg.body = body
        if sender:
            msg.sender = sender

        mail.send(msg)
    except Exception as e:
        status = "FAILED"
        app.logger.warning(f"Failed to send email to {recipient}: {e}")

    try:
        log = EmailLogs(
            recipient_email=recipient,
            subject=subject,
            status=status
        )
        with app.app_context():
            db.session.add(log)
            db.session.commit()
    except Exception as db_err:
        db.session.rollback()
        app.logger.error(f"Failed to save email log: {db_err}")

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

#home
@app.route('/')
def home():
    return redirect(url_for('login'))

#signup.html
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        # data to be stored in the db
        first_name = request.form['first_name']
        last_name = request.form['last_name']
        username = request.form['username']
        password = request.form['password']
        email = request.form['email']
        role = request.form['role']
        #nullable code (if the user doesn't select a maintenance in role, it will be null to the db)
        department = request.form.get('maintenanceType') if role == 'maintenance' else None

        session['temp_first_name'] = first_name
        session['temp_last_name'] = last_name
        session['temp_username'] = username
        session['temp_password'] = password
        session['temp_email'] = email
        session['temp_role'] = role
        session['temp_department'] = department

        # OTP again (just like nung sa last sem na code: kukunin email tas mag ssend ng otp based on the email add na nilagay)
        otp = random.randint(100000, 999999)
        session['otp'] = otp

        # Send OTP email (SAFELY, added some features na pag nag enter si user ng non-existing email addr, this block of code will catch it)
        try:
            send_email(
                subject="Your OTP Code",
                recipient=email,
                body=f"""
                Hello,

                Thank you for signing up for the Maintenance Ticketing System.

                Your One-Time Password (OTP) is:

                🔐 {otp}

                Please enter this code within 5 minutes to verify your email address.

                If you did not request this, you may safely ignore this message.

                Best regards,
                Maintenance Ticketing System
                """
            )
        except (SMTPRecipientsRefused, ValueError):
            flash('Failed to send OTP. Please check your email address and try again.', 'danger')
            return redirect(url_for('signup'))
        except Exception as e:
            flash('An unexpected error occurred while sending OTP.', 'danger')
            print(f"Error sending email: {e}")
            return redirect(url_for('signup'))

        return redirect(url_for('verify_otp'))

    return render_template('signup.html')

@app.route('/verify_otp', methods=['GET', 'POST'])
def verify_otp():
    if request.method == 'POST':
        entered_otp = request.form['otp']
        stored_otp = session.get('otp')

        if str(entered_otp) == str(stored_otp):
            # Build hashed password
            hashed_pw = bcrypt.generate_password_hash(session['temp_password']).decode('utf-8')

            # Create PendingUser
            pending = PendingUser(
                first_name=session['temp_first_name'],
                last_name=session['temp_last_name'],
                username=session['temp_username'],
                password=hashed_pw,
                email=session['temp_email'],
                role=session['temp_role'],
                department=session.get('temp_department'),
                is_approved=False
            )

            try:
                db.session.add(pending)
                db.session.commit()

                # Send admin notification email
                try:
                    subject = "New User Registration Pending Approval"

                    created_at_str = pending.created_at.strftime('%B %d, %Y at %I:%M %p')

                    department_line = ""
                    if str(pending.role).lower() == "maintenance" and pending.department:
                        department_line = f"""
                            <tr>
                                <td style="padding: 6px 0;"><strong>Department:</strong></td>
                                <td style="padding: 6px 0;">{pending.department.title()}</td>
                            </tr>
                        """
                    body_html = f"""
                    <div style="font-family: Arial, sans-serif; line-height: 1.5; padding: 10px;">
                        <h2 style="color: #d9534f;">New User Created</h2>
                        <p>A new user has registered in the <strong>Maintenance Ticketing System</strong> and is waiting for your approval.</p>
                        <table style="border-collapse: collapse; margin-top: 10px;">
                            <tr>
                                <td style="padding: 6px 0;"><strong>First Name:</strong></td>
                                <td style="padding: 6px 0;">{pending.first_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0;"><strong>Last Name:</strong></td>
                                <td style="padding: 6px 0;">{pending.last_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0;"><strong>Username:</strong></td>
                                <td style="padding: 6px 0;">{pending.username}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0;"><strong>Email:</strong></td>
                                <td style="padding: 6px 0;">{pending.email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0;"><strong>Role:</strong></td>
                                <td style="padding: 6px 0;">{pending.role.title()}</td>
                            </tr>
                            {department_line}
                            <tr>
                                <td style="padding: 6px 0;"><strong>Status:</strong></td>
                                <td style="padding: 6px 0;">Pending for approval</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0;"><strong>Created At:</strong></td>
                                <td style="padding: 6px 0;">{created_at_str}</td>
                            </tr>
                        </table>
                        <br>
                        <p style="color: #888;">This is an automated notification from the Maintenance Ticketing System.</p>
                    </div>
                    """
                    admin_email = app.config.get('ADMIN_EMAIL')
                    admin_sender_email = app.config.get('ADMIN_MAIL_USERNAME')  # the Gmail account sending this
                    admin_sender_name = os.getenv('ADMIN_MAIL_SENDER_NAME', 'Maintenance System')

                    send_email(
                        subject=subject,
                        recipient=admin_email,
                        html_body=body_html,
                        sender=(admin_sender_name, admin_sender_email)
                    )
                except Exception as email_err:
                    app.logger.warning(f"Failed to send admin notification: {email_err}")
                flash('Your account has been created and is pending admin approval.', 'info')

                # Clear session temp data
                for key in ('otp',
                            'temp_first_name','temp_last_name','temp_username',
                            'temp_password','temp_email','temp_role','temp_department'):
                    session.pop(key, None)

                return redirect(url_for('login'))

            except:
                db.session.rollback()
                app.logger.exception("Error creating pending user")
                flash('Username or email already exists or an error occurred. Please try again with different credentials.', 'danger')
                return redirect(url_for('signup'))

        else:
            flash('Invalid OTP, please try again.', 'danger')
            return redirect(url_for('verify_otp'))

    return render_template('verify_otp.html')

@app.route('/secret_admin', methods=['GET'])
@login_required
def secret_admin_page():
    if current_user.role != 'admin':
        flash("You are not authorized to access this page.", "danger")
        return redirect(url_for('admin_dashboard'))
    return render_template('secret_admin.html')


# Send OTP for secret admin creation
@app.route('/send_admin_otp', methods=['POST'])
def send_admin_otp():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'})

    secret_key = data.get('secret_key')
    if secret_key != Config.SECRET_ADMIN_KEY:
        return jsonify({'success': False, 'message': 'Invalid secret key'})

    # store the user info temporarily in session
    session['admin_temp_first_name'] = data.get('first_name')
    session['admin_temp_last_name'] = data.get('last_name')
    session['admin_temp_username'] = data.get('username')
    session['admin_temp_email'] = data.get('email')
    session['admin_temp_password'] = data.get('password')

    # Generate OTP
    otp = random.randint(100000, 999999)
    session['admin_otp'] = otp

    try:
        subject = "Administrator Verification Code (OTP)"
        recipient = session['admin_temp_email']
        body=f"""
        Hello,

        You are attempting to create a new administrator account in the Maintenance Ticketing System.

        Your administrator verification code (OTP) is:

        🔐 {otp}

        Please enter this code to proceed with the account creation.

        If you did not initiate this request, please ignore this email for security purposes.

        — Maintenance Ticketing System
        """
        threading.Thread(
            target=send_email,
            args=(subject, recipient, body),
            daemon=True
        ).start()
        return jsonify({'success': True, 'message': 'OTP sent successfully!'})
    except Exception as e:
        app.logger.exception("Error sending admin OTP")
        return jsonify({'success': False, 'message': f'Failed to send OTP: {str(e)}'})


# Verify OTP and create pending admin user
from sqlalchemy.exc import IntegrityError

@app.route('/verify_admin_otp', methods=['POST'])
def verify_admin_otp():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'})

    entered_otp = data.get('otp')
    session_otp = session.get('admin_otp')

    if not session_otp:
        return jsonify({'success': False, 'message': 'OTP expired or not generated.'})

    if str(entered_otp) != str(session_otp):
        session.pop('admin_otp', None)
        return jsonify({'success': False, 'message': 'Invalid OTP'})

    # OTP is valid → create PendingUser entry
    hashed_pw = bcrypt.generate_password_hash(session['admin_temp_password']).decode('utf-8')

    pending_admin = PendingUser(
        first_name=session['admin_temp_first_name'],
        last_name=session['admin_temp_last_name'],
        username=session['admin_temp_username'],
        email=session['admin_temp_email'],
        password=hashed_pw,
        role='admin',
        department=None,
        is_approved=False
    )

    try:
        db.session.add(pending_admin)
        db.session.commit()

        # Clear session
        session_keys = [
            'admin_otp', 'admin_temp_first_name', 'admin_temp_last_name',
            'admin_temp_username', 'admin_temp_email', 'admin_temp_password'
        ]
        for key in session_keys:
            session.pop(key, None)

        return jsonify({'success': True, 'message': 'Secret admin request submitted successfully and pending approval!'})

    except IntegrityError as e:
        db.session.rollback()
        # Check if the error is due to duplicate entry
        if "Duplicate entry" in str(e.orig):
            return jsonify({'success': False, 'message': 'Email or username already exists. Please use a different one.'})
        else:
            return jsonify({'success': False, 'message': f'Error creating pending admin: {str(e)}'})

@app.route('/pending_accounts')
def pending_accounts():
    # Fetch records from PendingUser table (not yet approved)
    pendings = PendingUser.query.filter((PendingUser.is_approved == None) | (PendingUser.is_approved == False)).all()

    result = []
    for p in pendings:
        result.append({
            "id": p.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "username": p.username,
            "email": p.email,
            "role": p.role.capitalize(),
            "department": p.department.capitalize() if p.department else "N/A",
            "created_at": p.created_at.strftime("%B %d, %Y at %I:%M %p"),
            "is_approved": "TRUE" if p.is_approved else "FALSE"
        })

    return jsonify(result)

@app.route('/update_account_status/<int:pending_id>', methods=['POST'])
def update_account_status(pending_id):
    data = request.get_json() or {}
    approve = data.get('approve', False)

    pending = PendingUser.query.get_or_404(pending_id)

    try:
        if approve:
            #1: update the column is_approved from the pending_user table
            pending.is_approved = True
            db.session.commit()  # commit here so is_approved is saved

            #2: Move to user table
            new_user = User(
                first_name=pending.first_name,
                last_name=pending.last_name,
                username=pending.username,
                password=pending.password,  # already hashed
                role=pending.role,
                department=pending.department,
                email=pending.email,
                is_approved=True
            )
            db.session.add(new_user)
            db.session.commit()  # commit the new user

            # Step 3: Delete pending record
            db.session.delete(pending)
            db.session.commit()

            # Send approval email to user
            try:
                subject = "Your account has been approved"
                approved_at_str = datetime.now(ZoneInfo("Asia/Manila")).strftime('%B %d, %Y at %I:%M %p')
                body_html = f"""
                <p>Your account <strong>{new_user.username}</strong> has been approved by the admin.</p>
                <p>You can now log in.</p>
                <p><small>Approved at: {approved_at_str}</small></p>
                """
                send_email(
                    subject=subject,
                    recipient=new_user.email,
                    html_body=body_html
                )
            except Exception as email_err:
                app.logger.warning(f"Failed to send approval email: {email_err}")

            msg = f"User {new_user.username} approved and moved to users."
            return jsonify({"message": msg})

        else:
            # Reject: delete the pending user
            rejected_username = pending.username
            rejected_email = pending.email

            db.session.delete(pending)
            db.session.commit()

            # Send rejection email
            try:
                subject = "Your account has been rejected"
                body_html = f"""
                <p>Dear {rejected_username},</p>
                <p>We are sorry to inform you that your account has been <strong>rejected</strong> by the admin.</p>
                <p>If you believe this is a mistake or want to try again, please contact the administrator.</p>
                """
                send_email(
                    subject=subject,
                    recipient=rejected_email,
                    html_body=body_html
                )
            except Exception as email_err:
                app.logger.warning(f"Failed to send rejection email: {email_err}")

            msg = f"User {rejected_username} rejected and removed from pending."
            return jsonify({"message": msg})

    except Exception:
        db.session.rollback()
        app.logger.exception("Error updating account status")
        return jsonify({"message": "An error occurred while updating account status."}), 500

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        #Check approved users
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            if user.role == 'employee':
                return redirect(url_for('dashboard'))
            elif user.role == 'maintenance':
                return redirect(url_for('maintenance_dashboard'))
            elif user.role == 'admin':
                return redirect(url_for('admin_dashboard'))

        # Check pending users
        pending_user = PendingUser.query.filter_by(username=username).first()
        if pending_user and bcrypt.check_password_hash(pending_user.password, password):
            flash("Your account is pending admin approval.", "error")
            return redirect(url_for('login'))  #Redirect instead of rendering

        # If neither matched
        flash("Invalid username or password.", "error")
        return redirect(url_for('login'))  # Redirect instead of rendering

    # GET request
    messages = get_flashed_messages(category_filter=["error"])
    login_error = messages[0] if messages else None
    return render_template('login.html', login_error=login_error)

def send_otp_email(recipient_email):
    forgot_pass_otp = str(random.randint(100000, 999999))
    session['reset_otp'] = forgot_pass_otp

    subject = "Password Reset OTP"
    body = f"""
    Hello,

    You requested a password reset for your Maintenance Ticketing System account.

    Your One-Time Password (OTP) is:

    🔐 {forgot_pass_otp}

    Please enter this code within 5 minutes to reset your password.

    If you did not request this, please ignore this email.

    — Maintenance Ticketing System
    """

    try:
        send_email(
            subject=subject,
            recipient=recipient_email,
            body=body
        )
        return True
    except Exception as e:
        app.logger.error(f"Error sending reset OTP: {e}")
        return False

@app.route('/forgot_password/send_otp', methods=['POST'])
def forgot_password_send_otp():
    data = request.get_json()
    email = data.get("email")

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"status": "error", "message": "Email not found."})

    session['reset_email'] = email
    send_otp_email(email)

    return jsonify({"status": "success", "username": user.username})

@app.route('/forgot_password/reset', methods=['POST'])
def forgot_password_reset():
    data = request.get_json()
    otp = data.get("otp")
    new_pass = data.get("newPass")

    if str(otp) != str(session.get("reset_otp")):
        return jsonify({"status": "error", "message": "Invalid OTP."})

    email = session.get("reset_email")
    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"status": "error", "message": "Something went wrong."})

    #Hash the new password before storing it
    user.password = bcrypt.generate_password_hash(new_pass).decode('utf-8')
    db.session.commit()

    session.pop("reset_otp", None)
    session.pop("reset_email", None)

    return jsonify({"status": "success"})

@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role != 'employee':
        flash("Unauthorized access.", "danger")
        return redirect(url_for('login'))

    tickets = Ticket.query.filter_by(submitted_by=current_user.id).all()
    active_tickets = sum(1 for t in tickets if t.status in ['Pending', 'Approved'])

    return render_template(
        'dashboard.html',
        user=current_user,
        tickets=tickets,
        active_tickets=active_tickets
    )

@app.route('/maintenance_dashboard')
@login_required
def maintenance_dashboard():
    if current_user.role != 'maintenance':
        flash("You are not authorized to access this page.", "danger")
        return redirect(url_for('dashboard'))

    # Show only tickets assigned to their department
    tickets = Ticket.query.filter_by(category=current_user.department).all()
    active_tickets = Ticket.query.filter(
        Ticket.submitted_by == current_user.id,
        Ticket.status.in_(["Pending", "Approved"])
    ).count()

    for ticket in tickets:
        if ticket.date_submitted:
            # Apply timezone conversion
            ticket.date_submitted = ticket.date_submitted.astimezone(ZoneInfo("Asia/Manila"))

    return render_template('maintenance_dashboard.html',
                           user=current_user,
                           tickets=tickets,
                           active_tickets=active_tickets)


@app.route('/admin_dashboard')
@login_required
def admin_dashboard():
    if current_user.role != 'admin':
        flash('Access denied.', 'danger')
        return redirect(url_for('login'))

    #: Migrate approved pending users
    approved_pending_users = PendingUser.query.filter_by(is_approved=1).all()
    for p_user in approved_pending_users:
        # Create new User instance
        new_user = User(
            first_name=p_user.first_name,
            last_name=p_user.last_name,
            username=p_user.username,
            email=p_user.email,
            role=p_user.role,
            department=p_user.department
        )
        db.session.add(new_user)
        db.session.delete(p_user)  # Remove from pending table

    if approved_pending_users:
        db.session.commit()  # Commit only if there are approved users

    #2: Fetch data for rendering
    users = User.query.all()
    tickets = Ticket.query.order_by(Ticket.id.desc()).all()  # Sorted by ID (latest first)

    # Capitalize department names for UI consistency
    for t in tickets:
        if t.category:
            t.category = t.category.capitalize()

    return render_template(
        'admin_dashboard.html',
        user=current_user,
        users=users,
        tickets=tickets
    )


@app.route('/existing_accounts')
def existing_accounts():
    # Fetch only approved users excluding admin
    users = User.query.filter(
        User.is_approved.is_(True),
        db.func.lower(User.role) != 'admin'
    ).all()

    user_list = [{
        'id': u.id,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'username': u.username,
        'email': u.email,
        'role': (u.role.capitalize() if u.role else "Employee"),
        'department': (u.department.capitalize() if u.department else "N/A")
    } for u in users]

    return jsonify(user_list)

@app.route('/delete_account/<int:user_id>', methods=['DELETE'])
def delete_account(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'})

    if user.role == 'admin':
        admin_count = User.query.filter_by(role='admin').count()
        if admin_count <= 1:
            return jsonify({'success': False, 'message': 'Cannot delete the last admin account'})

    try:
        db.session.delete(user)
        db.session.commit()

        # Fix auto-increment
        if User.query.count() == 0:
            db.session.execute(text("ALTER TABLE user AUTO_INCREMENT = 1"))
        else:
            max_id = db.session.query(db.func.max(User.id)).scalar() or 0
            db.session.execute(text(f"ALTER TABLE user AUTO_INCREMENT = {max_id + 1}"))
        db.session.commit()

        return jsonify({'success': True, 'message': 'Account deleted successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/get_email_logs")
def get_email_logs():
    logs = EmailLogs.query.order_by(EmailLogs.id.desc()).all()
    return jsonify([
        {
            "id": log.id,
            "recipient": log.recipient_email,
            "subject": log.subject,
            "status": log.status,
            "date_sent": log.date_sent.strftime("%B %d, %Y %I:%M %p"),
        }
        for log in logs
    ])

@app.route("/download_email_logs")
def download_email_logs():
    logs = EmailLogs.query.order_by(EmailLogs.id.desc()).all()

    def generate():
        yield "ID,Recipient Email,Subject,Status,Date Sent\n"
        for log in logs:
            row = f'{log.id},"{log.recipient_email}","{log.subject}",{log.status},"{log.date_sent.strftime("%B %d, %Y %I:%M %p")}"\n'
            yield row

    return Response(
        generate(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=email_logs.csv"
        }
    )


@app.route('/submit_ticket', methods=['POST'])
@login_required
def submit_ticket():
    if current_user.role == 'employee':
        redirect_url = url_for('dashboard')
    elif current_user.role == 'maintenance':
        redirect_url = url_for('maintenance_dashboard')
    else:
        redirect_url = url_for('login')

    # LIMIT: Max 4 active tickets per user
    active_tickets = Ticket.query.filter(
        Ticket.submitted_by == current_user.id,
        Ticket.status.in_(["Pending", "Approved"])
    ).count()

    if active_tickets >= 4:
        flash("You have reached the maximum of 4 active tickets. Please wait until one ticket is marked done.",
              "danger")
        return redirect(redirect_url)

    title = request.form['title']
    description = request.form['description']
    category = request.form['category']
    submitted_name = f"{current_user.first_name} {current_user.last_name}"

    #another layer of validation if the user tries to bypass the submission ticket with an empty input
    if not title or not description or not category:
        flash("Please fill in all required fields and select a department.", "danger")
        return redirect(redirect_url)

    photo = request.files.get('photo')
    photo_filename = None
    photo_data = None

    if photo and allowed_file(photo.filename):
        photo_filename = secure_filename(photo.filename)
        photo_data = photo.read()

    new_ticket = Ticket(
        title=title,
        description=description,
        category=category,
        submitted_by=current_user.id,
        submitted_name=submitted_name,
        photo=photo_filename,  # store the filename
        photo_data = photo_data
    )

    db.session.add(new_ticket)
    db.session.commit()
    flash("Ticket submitted successfully!", "success")

    # Send notification to the maintenance user of that department
    maintenance_user = User.query.filter_by(role='maintenance', department=category).first()
    if maintenance_user:
        if maintenance_user:
            body = f"""
            Hello {maintenance_user.first_name},

            A new maintenance ticket has been assigned to your department.

            🛠️ Ticket Details
            • Title: {title}
            • Description: {description}
            • Submitted by: {submitted_name}

            Please review and process this request at your earliest convenience.

            — Maintenance Ticketing System
            """
            send_email(
                subject="New Ticket Submitted",
                recipient=maintenance_user.email,
                body=body
            )

    return redirect(redirect_url)

@app.route('/update_ticket_status/<int:ticket_id>', methods=['POST'])
@login_required
def update_ticket_status(ticket_id):
    ticket = Ticket.query.get(ticket_id)
    if not ticket:
        flash("Ticket not found.", "danger")
        return redirect(url_for('maintenance_dashboard'))

    new_status = request.form.get('new_status')

    if new_status not in ["Pending", "Approved", "Done", "Cancelled"]:
        flash("Invalid status update.", "danger")
        return redirect(url_for('maintenance_dashboard'))

    # Update ticket
    ticket.status = new_status
    if new_status == "Approved":
        ticket.approved_by = f"{current_user.first_name} {current_user.last_name}"
        ticket.date_approved = datetime.now(ZoneInfo("Asia/Manila"))
    elif new_status == "Done":
        ticket.date_done = datetime.now(ZoneInfo("Asia/Manila"))

    db.session.commit()

    flash(f"Ticket updated to {new_status}!", "success")
    return redirect(url_for('maintenance_dashboard'))

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

    # Send email to the employee who submitted the ticket
    employee = User.query.get(ticket.submitted_by)
    if employee:
        body = f"""
        Hello {employee.first_name},

        Your maintenance ticket has been approved.

        📌 **Ticket Details**
        • Title: {ticket.title}
        • Approved by: {current_user.first_name} {current_user.last_name}
        • Date Approved: {ticket.date_approved.strftime('%B %d, %Y %I:%M %p')}

        You may now track its progress through your dashboard.

        Thank you,
        Maintenance Department
        """
        send_email(
            subject="Your Ticket Has Been Approved",
            recipient=employee.email,
            body=body
        )
    return redirect(url_for('maintenance_dashboard'))


@app.route('/edit_ticket/<int:ticket_id>', methods=['GET', 'POST'])
def edit_ticket(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    active_tickets = Ticket.query.filter(
        Ticket.submitted_by == current_user.id,
        Ticket.status.in_(["Pending", "Approved"])
    ).all()
    if request.method == 'POST':
        ticket.title = request.form['title']
        ticket.description = request.form['description']
        ticket.category = request.form['category']
        db.session.commit()
        flash('Ticket updated successfully!', 'success')
        return redirect(url_for('dashboard'))

    return render_template('edit_ticket.html', ticket=ticket, active_tickets=active_tickets)


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

    # CREATING DONE TICKET BA
    done_ticket = DoneTicket(
        ticket_id=ticket.id,
        title=ticket.title,
        description=ticket.description,
        photo=ticket.photo,
        photo_data=ticket.photo_data,
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

    # Notify the employee that the ticket is completed
    employee = User.query.get(ticket.submitted_by)
    if employee:
        body = f"""
        Hello {employee.first_name},

        Your maintenance ticket has been completed.

        📌 **Ticket Details**
        • Title: {ticket.title}
        • Completed by: {current_user.first_name} {current_user.last_name}
        • Date Completed: {datetime.now(ZoneInfo("Asia/Manila")).strftime('%B %d, %Y %I:%M %p')}

        If the issue persists or you need further assistance, feel free to submit a new ticket.

        Thank you,
        Maintenance Department
        """
        send_email(
            subject="Your Ticket Is Completed",
            recipient=employee.email,
            body=body
        )
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

    # FEATURE: ALLOWING THE USER TO DELETE WHILE THE TICKET IS PENDING
    if ticket.status == 'Pending':
        db.session.delete(ticket)
        db.session.commit()

        # FIX THE Database table for users 'id (which has a feature of auto incrementation)' IF THE EMPLOYEE DELETES THE TICKET
        if Ticket.query.count() == 0:
            db.session.execute(text("ALTER TABLE ticket AUTO_INCREMENT = 1"))
            db.session.commit()

        flash("Ticket successfully deleted.", "success")

    else:
        flash("You cannot delete a ticket that has already been approved or is in progress.", "warning")

    return redirect(url_for('dashboard'))


@app.route('/transfer_ticket/<int:ticket_id>', methods=['GET', 'POST'])
@login_required
def transfer_ticket(ticket_id):
    if current_user.role != 'admin':
        flash("You are not authorized to transfer tickets.", "danger")
        return redirect(url_for('admin_dashboard'))

    ticket = Ticket.query.get_or_404(ticket_id)

    if request.method == 'POST':
        old_category = ticket.category
        new_category = request.form['category']

        if old_category == new_category:
            flash(f"Ticket #{ticket.id} is already assigned to {new_category.capitalize()}.", "warning")
            return redirect(url_for('admin_dashboard'))

        ticket.category = new_category
        db.session.commit()

        employee = ticket.user
        employee_email = employee.email

        # Find all maintenance users in the NEW department
        new_dept_maintenance = User.query.filter_by(
            role='maintenance',
            department=new_category
        ).all()

        maintenance_emails = [u.email for u in new_dept_maintenance]

        subject_employee = f"Ticket #{ticket.id} Transferred: {ticket.title}"
        body_employee = f"""
        Hello {employee.first_name},

        Your maintenance ticket titled "{ticket.title}" (ID: #{ticket.id}) has been transferred 
        from the {old_category.capitalize()} department to the {new_category.capitalize()} department 
        by the administrator.

        This may happen if the ticket category was incorrect or requires attention from a specialized team.

        New Department: {new_category.capitalize()}
        Status: {ticket.status}

        Thank you for your patience.

        — Maintenance Ticketing System
        """
        threading.Thread(
            target=send_email,
            args=(subject_employee, employee_email, body_employee),
            daemon=True
        ).start()

        subject_maintenance = f"[ACTION REQUIRED] Ticket Transferred to {new_category.capitalize()}: #{ticket.id}"

        for recipient_email in maintenance_emails:
            body_maintenance = f"""
            Hello Maintenance Team,

            A new ticket requires your immediate attention in the {new_category.capitalize()} department. 
            It was recently transferred by the administrator.

            Ticket ID: #{ticket.id}
            Title: {ticket.title}
            Submitted by: {ticket.submitted_name}

            Please log in to the system and review the ticket on the maintenance dashboard.

            — Maintenance Ticketing System
            """
            threading.Thread(
                target=send_email,
                args=(subject_maintenance, recipient_email, body_maintenance),
                daemon=True
            ).start()

        flash(f"Ticket #{ticket.id} successfully transferred to {new_category.capitalize()}. Notifications sent.",
              "success")
        return redirect(url_for('admin_dashboard'))

    return render_template('transfer_ticket.html', ticket=ticket)

@app.route('/image/<int:ticket_id>')
def get_ticket_image(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    if not ticket.photo_data or not ticket.photo:
        return "No image found", 404

    # Guess MIME type from the filename
    mimetype, _ = mimetypes.guess_type(ticket.photo)
    if not mimetype:
        mimetype = 'application/octet-stream'  # fallback

    return Response(
        ticket.photo_data,
        mimetype=mimetype,
        headers={
            'Content-Length': str(len(ticket.photo_data)),
            'Content-Disposition': f'inline; filename="{ticket.photo}"'
        }
    )

@app.route('/search_users', methods=['GET'])
def search_users():
    query = request.args.get('q', '').strip()

    if query:
        results = User.query.filter(
            (User.first_name.ilike(f'%{query}%')) |  # <----|
            (User.last_name.ilike(f'%{query}%')) |  #       | '|' means OR in LOGICAL TERM
            (User.email.ilike(f'%{query}%')) |  #           | the block of code refers to getting the data from the database based on what the user searched for
            (User.role.ilike(f'%{query}%'))  # <------------|
        ).all()
    else:
        results = []

    return render_template('search_results.html', users=results, query=query)


@app.route('/filter_tickets')
@login_required
def filter_tickets():
    status = request.args.get('status', 'All')
    department = request.args.get('department', 'All')

    query = Ticket.query

    if status != 'All':
        query = query.filter_by(status=status)
    if department != 'All':
        query = query.filter_by(category=department)

    def ticket_to_dict(t):
        return {
            'id': t.id,
            'sort_id': getattr(t, 'ticket_id', t.id),
            'title': t.title,
            'description': t.description,
            'status': getattr(t, 'status', 'Done'),  # Tickets have status, DoneTicket will be handled separately
            'category': getattr(t, 'category', getattr(t, 'department', '')),
            'submitted_name': getattr(t, 'submitted_name',f"{getattr(t, 'employee_first_name', '')} {getattr(t, 'employee_last_name', '')}").strip(),
            'date_submitted': getattr(t, 'date_submitted', getattr(t, 'date_done', None)).strftime("%B %d, %Y at %I:%M %p"),
            "photo_data": bool(t.photo_data)

            if getattr(t, 'date_submitted', getattr(t, 'date_done', None))
            else ''
        }

    if status == 'Done':
        q = DoneTicket.query
        if department != 'All':
            q = q.filter_by(department=department)
        # If maintenance user, restrict to their department
        if current_user.role == 'maintenance':
            q = q.filter_by(department=current_user.department)
        done_rows = q.order_by(DoneTicket.id.asc()).all()
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
        q = q.order_by(Ticket.id.asc())
        tickets = [ticket_to_dict(t) for t in q.all()]

        # Append DoneTicket rows if requested (includes 'Done')
        dq = DoneTicket.query
        if department != 'All':
            dq = dq.filter_by(department=department)
        if current_user.role == 'maintenance':
            dq = dq.filter_by(department=current_user.department)
        done_tickets = dq.order_by(DoneTicket.id.asc()).all()  # Get all done tickets from the query

        for d in done_tickets:
            ticket_dict = ticket_to_dict(d)
            ticket_dict['is_done'] = True
            tickets.append(ticket_dict)
        # HOLD THIS LINE OF CODE: tickets += [ticket_to_dict(d) for d in dq.all()] eto galing AI kaya di ko gets

    # OPTIONAL BLOCK OF CODE: (Pending / Approved) query Ticket table only
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
        q = q.order_by(Ticket.id.asc())
        tickets = [ticket_to_dict(t) for t in q.all()]

    # This block of code tries to sort all tickets for both pending and done by their 'id' (based on the database)
    # in descending order which is the latest will be the first one.
    try:
        tickets.sort(key=lambda x: int(x.get('id', 0)))
    except Exception as e:
        app.logger.warning(f"Sorting error in filter_tickets: {e}")

    return jsonify(tickets)

@app.route("/about")
@login_required  # optional if only logged-in users can see it
def about_page():
    active_tickets = Ticket.query.filter(
        Ticket.submitted_by == current_user.id,
        Ticket.status.in_(["Pending", "Approved"])
    ).all()
    return render_template("about.html", active_tickets=active_tickets)


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully!', 'info')
    return redirect(url_for('login'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)
