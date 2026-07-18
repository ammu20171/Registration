import os
from flask import Flask
from models import db, Admin
from werkzeug.security import generate_password_hash

def init_db():
    app = Flask(__name__)
    
    # Configure database URI - fall back to SQLite locally
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        database_url = 'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'hackathon.db')
    elif database_url.startswith("postgres://"):
        # Fix Heroku/similar PostgreSQL URLs if necessary
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        print("Database tables created successfully.")
        
        # Check if an admin exists, if not seed a default one
        admin = Admin.query.filter_by(username='admin').first()
        if not admin:
            hashed_pw = generate_password_hash('admin123')
            default_admin = Admin(username='admin', password_hash=hashed_pw)
            db.session.add(default_admin)
            db.session.commit()
            print("Default admin created: admin / admin123")
        else:
            print("Admin user already exists.")

if __name__ == '__main__':
    init_db()
