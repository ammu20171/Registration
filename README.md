# 🚀 Hackathon Registration System

A full-stack, secure web application for managing Hackathon team registrations, mentor assignments, project proposal submissions (PPT/PDF), and administrative evaluation workflows.

---

## 🏛️ System Architecture Diagram

```mermaid
graph TD
    subgraph Client Layer ["Client Layer (Browser)"]
        User["Participant / Student"]
        AdminUser["Event Administrator"]
    end

    subgraph Web & Security Layer ["Web & Application Layer (Flask + HTTPS)"]
        HTTPS["HTTPS / SSL Handler (pyOpenSSL)"]
        FlaskRouter["Flask App Routing Engine (app.py)"]
        AuthModule["Authentication & Session Manager (Flask-Login)"]
        UploadHandler["Secure File Upload Manager"]
        ExportEngine["Data Processing & Export Engine (Pandas)"]
    end

    subgraph Data & Storage Layer ["Data & Storage Layer"]
        ORM["SQLAlchemy ORM (models.py)"]
        DB[(Relational DB: SQLite / PostgreSQL)]
        FileStore["Local File System (/uploads)"]
    end

    %% Interactions
    User -->|1. Submit Registration & Upload Presentation| HTTPS
    AdminUser -->|2. Admin Login & Manage Dashboard| HTTPS

    HTTPS --> FlaskRouter
    FlaskRouter --> AuthModule
    FlaskRouter --> UploadHandler
    FlaskRouter --> ExportEngine

    AuthModule --> ORM
    UploadHandler -->|Save Presentation PDFs| FileStore
    ExportEngine --> ORM
    FlaskRouter --> ORM

    ORM --> DB
```

---

## 🔄 Component Interaction Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student as Participant / Team Leader
    actor Admin as Event Administrator
    participant Flask as Flask Server (app.py)
    participant Auth as Flask-Login / Werkzeug
    participant DB as SQLite / PostgreSQL Database
    participant Disk as File Storage (/uploads)

    rect rgb(240, 248, 255)
        note over Student, Disk: Public Registration Flow
        Student->>Flask: GET / (Registration Page)
        Flask-->>Student: Render HTML Form
        Student->>Flask: POST / (Submit Team Details + Upload Presentation)
        Flask->>Disk: Validate & Save PDF File to /uploads
        Flask->>DB: Store Team, TeamMembers & Mentor records
        DB-->>Flask: Transaction Commit Success
        Flask-->>Student: Redirect / with Success Toast Notification
    end

    rect rgb(255, 245, 238)
        note over Admin, Disk: Admin Dashboard & Shortlisting Flow
        Admin->>Flask: POST /login (Credentials)
        Flask->>Auth: Validate Password Hash
        Auth-->>Flask: Session Authenticated
        Flask-->>Admin: Redirect /dashboard
        Admin->>Flask: PUT /api/teams/:id/status (Mark as Shortlisted)
        Flask->>DB: Update Team Status
        DB-->>Flask: Status Updated
        Flask-->>Admin: JSON Confirmation
    end
```

---

## 🗄️ Database Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    TEAMS ||--|{ TEAM_MEMBERS : "has members (1 to N)"
    TEAMS ||--o| MENTORS : "assigned mentor (1 to 1)"

    TEAMS {
        int id PK
        string team_name UK
        string department
        int year_of_study
        string domain "Software | Hardware"
        string problem_statement_id
        string project_title
        string project_description
        string presentation_path
        string status "Registered | Shortlisted"
        datetime created_at
        datetime updated_at
    }

    TEAM_MEMBERS {
        int id PK
        int team_id FK
        boolean is_leader
        string full_name
        string register_number UK
        string email UK
        string mobile
        string alt_mobile
        string gender
        string residential_status "Hosteller | Day Scholar"
    }

    MENTORS {
        int id PK
        int team_id FK
        string mentor_name
        string mentor_email
        string mentor_mobile
    }

    ADMINS {
        int id PK
        string username UK
        string password_hash
    }
```

---

## ✨ Core Features

- **Dynamic Registration Form**: Supports multi-member teams, leader designations, mentor details, and project proposals.
- **Secure Presentation Uploads**: Handles PDF/PPT project presentation uploads with filename sanitization and size limits (max 20MB).
- **Admin Dashboard**: Real-time evaluation portal with search filters, domain filtering (Software/Hardware), and status toggling (Shortlist / Reinstate).
- **Public Shortlist View**: Dedicated page displaying officially shortlisted teams for public announcement.
- **Data Exporting**: Export all team registrations into Excel (`.xlsx`) or CSV format using Pandas.
- **SSL / HTTPS Support**: Configured for local development and deployment with custom SSL certificates (`cert.pem`, `key.pem`).

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend Framework** | Python 3.14, Flask 3.1+ |
| **Authentication & Security** | Flask-Login, Werkzeug Security, PyOpenSSL |
| **Database & ORM** | Flask-SQLAlchemy, SQLAlchemy 2.0+, SQLite / PostgreSQL |
| **Data Processing** | Pandas, OpenPyXL |
| **Frontend** | HTML5, Vanilla CSS3, JavaScript (ES6+ AJAX) |

---

## 📂 Project Structure

```text
Registration/
├── app.py              # Main Flask application, routes, and API endpoints
├── models.py           # SQLAlchemy database models (Team, TeamMember, Mentor, Admin)
├── db_init.py          # Database initialization & seeding script
├── requirements.txt    # Python package dependencies
├── cert.pem / key.pem  # SSL/TLS certificates for HTTPS
├── static/
│   ├── css/            # UI styles
│   └── js/             # Interactive client-side scripts
├── templates/
│   ├── base.html       # Base Jinja2 layout
│   ├── index.html      # Public registration form
│   ├── login.html      # Admin login page
│   ├── dashboard.html  # Admin management portal
│   └── shortlisted.html# Public shortlisted teams showcase
└── uploads/            # Storage folder for uploaded presentation files
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- Python 3.10+ installed on your system.

### 2. Environment Setup

```bash
# Clone or navigate to project workspace
cd /Volumes/ExtremeSSD/Registration

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Database Initialization

```bash
python db_init.py
```
> **Default Admin Credentials**:
> - **Username**: `admin`
> - **Password**: `admin123`

### 4. Running the Server

```bash
python app.py
```
Access the application at:
- **HTTP**: `http://127.0.0.1:5000`
- **HTTPS**: `https://127.0.0.1:5000` (if SSL certs are configured)
