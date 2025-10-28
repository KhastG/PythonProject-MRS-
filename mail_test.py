from app import app, mail
from flask_mail import Message

with app.app_context():
    msg = Message('Test Email from Flask',
                  recipients=['your_email@gmail.com'])
    msg.body = 'Hey buddy! This is a test email from Flask.'
    mail.send(msg)
    print("✅ Email sent successfully!")
