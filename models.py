from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()

class Team(db.Model):
    __tablename__ = 'teams'

    id = db.Column(db.Integer, primary_key=True)
    team_name = db.Column(db.String(100), unique=True, nullable=False)
    department = db.Column(db.String(100), nullable=False)
    year_of_study = db.Column(db.Integer, nullable=False)
    domain = db.Column(db.String(20), nullable=False)  # 'Software' or 'Hardware'
    problem_statement_id = db.Column(db.String(50), nullable=False)
    project_title = db.Column(db.String(200), nullable=False)
    project_description = db.Column(db.Text, nullable=True)
    presentation_path = db.Column(db.String(500), nullable=False)
    status = db.Column(db.String(20), default='Registered', nullable=False)  # 'Registered' or 'Shortlisted'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    members = db.relationship('TeamMember', backref='team', cascade='all, delete-orphan', lazy=True)
    mentor = db.relationship('Mentor', backref='team', uselist=False, cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'team_name': self.team_name,
            'department': self.department,
            'year_of_study': self.year_of_study,
            'domain': self.domain,
            'problem_statement_id': self.problem_statement_id,
            'project_title': self.project_title,
            'project_description': self.project_description,
            'presentation_path': self.presentation_path,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            'members': [m.to_dict() for m in self.members],
            'mentor': self.mentor.to_dict() if self.mentor else None
        }

class TeamMember(db.Model):
    __tablename__ = 'team_members'

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    is_leader = db.Column(db.Boolean, default=False, nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    register_number = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    mobile = db.Column(db.String(15), nullable=False)
    alt_mobile = db.Column(db.String(15), nullable=True)
    gender = db.Column(db.String(10), nullable=False)  # 'Male', 'Female', 'Other'
    residential_status = db.Column(db.String(20), nullable=False)  # 'Hosteller', 'Day Scholar'

    def to_dict(self):
        return {
            'id': self.id,
            'team_id': self.team_id,
            'is_leader': self.is_leader,
            'full_name': self.full_name,
            'register_number': self.register_number,
            'email': self.email,
            'mobile': self.mobile,
            'alt_mobile': self.alt_mobile,
            'gender': self.gender,
            'residential_status': self.residential_status
        }

class Mentor(db.Model):
    __tablename__ = 'mentors'

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    mentor_name = db.Column(db.String(100), nullable=False)
    mentor_email = db.Column(db.String(100), nullable=False)
    mentor_mobile = db.Column(db.String(15), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'team_id': self.team_id,
            'mentor_name': self.mentor_name,
            'mentor_email': self.mentor_email,
            'mentor_mobile': self.mentor_mobile
        }

class Admin(db.Model, UserMixin):
    __tablename__ = 'admins'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username
        }
