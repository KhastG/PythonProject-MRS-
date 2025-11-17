import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'fallback_secret_key')
    SECRET_ADMIN_KEY = os.getenv('SECRET_ADMIN_KEY')
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'mysql+pymysql://root:gCEk4bteN)QgwfbA/db_maintenance'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Mail settings
    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'True') == 'True'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = (os.getenv('MAIL_DEFAULT_SENDER_NAME', 'OTP System'),
                           os.getenv('MAIL_USERNAME'))

    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL')
    ADMIN_MAIL_USERNAME = os.getenv('ADMIN_MAIL_USERNAME', MAIL_USERNAME)
    ADMIN_MAIL_PASSWORD = os.getenv('ADMIN_MAIL_PASSWORD', MAIL_PASSWORD)
