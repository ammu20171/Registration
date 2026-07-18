import os
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, send_from_directory
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import pandas as pd
import io

from models import db, Team, TeamMember, Mentor, Admin

app = Flask(__name__)

# Basic configurations
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'devsync_secret_key_2026')
database_url = os.environ.get('DATABASE_URL')
if not database_url:
    database_url = 'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'hackathon.db')
elif database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# File uploads configurations (strictly max 20MB)
UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024 # 20MB
ALLOWED_EXTENSIONS = {'pdf', 'ppt', 'pptx'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize extensions
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'admin_login'
login_manager.login_message_category = 'danger'

@login_manager.user_loader
def load_user(user_id):
    return Admin.query.get(int(user_id))

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.after_request
def add_header(response):
    # Disable cache for AJAX endpoints
    if request.path.startswith('/admin/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
    return response

# Custom error handler for file size limit exceeded
@app.errorhandler(413)
def request_entity_too_large(error):
    if request.is_json:
        return jsonify({"message": "File exceeds the maximum size of 20MB."}), 413
    flash("File exceeds the maximum size of 20MB.", "danger")
    return redirect(request.referrer or url_for('register_team'))


# ==============================================
# FRONTEND REGISTRATION ROUTES
# ==============================================

@app.route('/', methods=['GET', 'POST'])
def register_team():
    if request.method == 'GET':
        return render_template('index.html')
        
    # POST - Team registration submission
    try:
        # 1. Parse basic Team & Project Details
        team_name = request.form.get('team_name', '').strip()
        department = request.form.get('department', '').strip()
        year_of_study = request.form.get('year_of_study')
        domain = request.form.get('domain')
        problem_statement_id = request.form.get('problem_statement_id', '').strip()
        project_title = request.form.get('project_title', '').strip()
        project_description = request.form.get('project_description', '').strip()
        
        # 2. File Upload handling
        if 'presentation' not in request.files:
            flash("Presentation pitch deck file is required.", "danger")
            return redirect(url_for('register_team'))
            
        file = request.files['presentation']
        if file.filename == '':
            flash("No file selected.", "danger")
            return redirect(url_for('register_team'))
            
        if not allowed_file(file.filename):
            flash("Invalid file format. Only .pdf, .ppt, and .pptx are accepted.", "danger")
            return redirect(url_for('register_team'))
            
        # Secure filename and save locally
        filename = secure_filename(file.filename)
        # Add a unique prefix to avoid duplicate filenames on filesystem
        import uuid
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # 3. Dynamic member parsing
        # Determine count of members in post request
        members_data = []
        idx = 1
        while True:
            m_name = request.form.get(f'member_name_{idx}')
            if not m_name:
                break
                
            m_reg = request.form.get(f'member_reg_{idx}', '').strip().upper()
            m_email = request.form.get(f'member_email_{idx}', '').strip().lower()
            m_mobile = request.form.get(f'member_mobile_{idx}', '').strip()
            m_alt_mobile = request.form.get(f'member_alt_mobile_{idx}', '').strip() or None
            m_gender = request.form.get(f'member_gender_{idx}')
            m_residence = request.form.get(f'member_residence_{idx}')
            
            # Email/mobile validation checks on backend
            if not m_name or not m_reg or not m_email or not m_mobile or not m_gender or not m_residence:
                flash(f"Incomplete details for Team Member #{idx}.", "danger")
                return redirect(url_for('register_team'))
                
            members_data.append({
                'is_leader': (idx == 1),
                'full_name': m_name,
                'register_number': m_reg,
                'email': m_email,
                'mobile': m_mobile,
                'alt_mobile': m_alt_mobile,
                'gender': m_gender,
                'residential_status': m_residence
            })
            idx += 1

        # Enforce member count constraint (4-6 members)
        if len(members_data) < 4 or len(members_data) > 6:
            flash("A team must contain between 4 to 6 members.", "danger")
            return redirect(url_for('register_team'))
            
        # 4. Parse Mentor details
        mentor_name = request.form.get('mentor_name', '').strip()
        mentor_email = request.form.get('mentor_email', '').strip().lower()
        mentor_mobile = request.form.get('mentor_mobile', '').strip()
        
        if not mentor_name or not mentor_email or not mentor_mobile:
            flash("All Mentor fields are required.", "danger")
            return redirect(url_for('register_team'))
            
        # 5. Database Backend uniqueness checks
        # Check Team Name uniqueness
        if Team.query.filter_by(team_name=team_name).first():
            flash(f"Team name '{team_name}' is already registered.", "danger")
            return redirect(url_for('register_team'))
            
        # Check member Email & Register numbers uniqueness
        for member in members_data:
            if TeamMember.query.filter_by(register_number=member['register_number']).first():
                flash(f"Register number '{member['register_number']}' is already registered by another team.", "danger")
                return redirect(url_for('register_team'))
            if TeamMember.query.filter_by(email=member['email']).first():
                flash(f"Email '{member['email']}' is already registered by another team.", "danger")
                return redirect(url_for('register_team'))

        # Create records using database transaction
        new_team = Team(
            team_name=team_name,
            department=department,
            year_of_study=int(year_of_study),
            domain=domain,
            problem_statement_id=problem_statement_id,
            project_title=project_title,
            project_description=project_description,
            presentation_path=unique_filename
        )
        
        db.session.add(new_team)
        db.session.flush() # Flush to get new_team.id
        
        # Add members
        for m in members_data:
            new_member = TeamMember(
                team_id=new_team.id,
                is_leader=m['is_leader'],
                full_name=m['full_name'],
                register_number=m['register_number'],
                email=m['email'],
                mobile=m['mobile'],
                alt_mobile=m['alt_mobile'],
                gender=m['gender'],
                residential_status=m['residential_status']
            )
            db.session.add(new_member)
            
        # Add mentor
        new_mentor = Mentor(
            team_id=new_team.id,
            mentor_name=mentor_name,
            mentor_email=mentor_email,
            mentor_mobile=mentor_mobile
        )
        db.session.add(new_mentor)
        
        db.session.commit()
        flash(f"Team '{team_name}' successfully registered!", "success")
        return redirect(url_for('register_team'))
        
    except Exception as e:
        db.session.rollback()
        # Clean up saved file if db transaction fails
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        flash(f"Database error during registration: {str(e)}", "danger")
        return redirect(url_for('register_team'))


# ==============================================
# ADMIN AUTHENTICATION
# ==============================================

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if current_user.is_authenticated:
        return redirect(url_for('admin_dashboard'))
        
    if request.method == 'GET':
        return render_template('login.html')
        
    username = request.form.get('username')
    password = request.form.get('password')
    
    admin = Admin.query.filter_by(username=username).first()
    if admin and check_password_hash(admin.password_hash, password):
        login_user(admin)
        flash("Logged in successfully.", "success")
        return redirect(url_for('admin_dashboard'))
    else:
        flash("Invalid username or password.", "danger")
        return redirect(url_for('admin_login'))

@app.route('/admin/logout')
@login_required
def admin_logout():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for('admin_login'))


# ==============================================
# ADMIN PANELS RENDER
# ==============================================

@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    return render_template('dashboard.html')

@app.route('/admin/shortlisted')
@login_required
def admin_shortlisted():
    return render_template('shortlisted.html')

@app.route('/admin/download_pitch/<int:team_id>')
@login_required
def download_pitch(team_id):
    team = Team.query.get_or_404(team_id)
    return send_from_directory(app.config['UPLOAD_FOLDER'], team.presentation_path, as_attachment=True)


# ==============================================
# AJAX DATA API & ACTIONS
# ==============================================

@app.route('/admin/api/teams', methods=['GET'])
@login_required
def get_teams_api():
    # 1. Read query parameters
    page = request.args.get('page', 1, type=int)
    per_page = 10
    sort_by = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')
    
    # Filters
    search_query = request.args.get('search', '').strip()
    domain_filter = request.args.get('domain', '')
    dept_filter = request.args.get('department', '').strip()
    ps_filter = request.args.get('problem_statement', '').strip()
    status_filter = request.args.get('status', '')
    
    stats_only = request.args.get('stats_only', 'false') == 'true'

    # Build SQL Query with Joins to support search
    # We join TeamMember (specifically to search Leader Name or Member Emails)
    query = Team.query.outerjoin(TeamMember)
    
    # Apply filters
    if domain_filter:
        query = query.filter(Team.domain == domain_filter)
    if dept_filter:
        query = query.filter(Team.department.ilike(f"%{dept_filter}%"))
    if ps_filter:
        query = query.filter(Team.problem_statement_id.ilike(f"%{ps_filter}%"))
    if status_filter:
        query = query.filter(Team.status == status_filter)
        
    # Apply Universal Search
    if search_query:
        search_pattern = f"%{search_query}%"
        query = query.filter(
            (Team.team_name.ilike(search_pattern)) |
            (Team.project_title.ilike(search_pattern)) |
            (Team.problem_statement_id.ilike(search_pattern)) |
            (Team.department.ilike(search_pattern)) |
            (TeamMember.full_name.ilike(search_pattern)) |
            (TeamMember.email.ilike(search_pattern)) |
            (TeamMember.register_number.ilike(search_pattern))
        )
        
    # Group by Team ID to prevent duplicates from the Member join
    query = query.group_by(Team.id)
    
    # Sorting
    # We need to map sort column fields
    if sort_by == 'team_name':
        sort_col = Team.team_name
    elif sort_by == 'problem_statement_id':
        sort_col = Team.problem_statement_id
    elif sort_by == 'project_title':
        sort_col = Team.project_title
    elif sort_by == 'leader_name':
        # Custom sorting logic: sort by full name of leader (is_leader=True)
        # To keep it simple, we can sort by team name or map it. Let's use team name as a secondary,
        # or sort by TeamMember.full_name where is_leader is True.
        sort_col = Team.team_name # fallback simple sort
    else:
        sort_col = Team.created_at
        
    if order == 'asc':
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # Get stats counts (realtime global stats, not filtered)
    total_teams = Team.query.count()
    registered_teams = Team.query.filter_by(status='Registered').count()
    shortlisted_teams = Team.query.filter_by(status='Shortlisted').count()
    
    # Domain distribution
    software_count = Team.query.filter_by(domain='Software').count()
    hardware_count = Team.query.filter_by(domain='Hardware').count()
    
    stats_data = {
        'total_teams': total_teams,
        'registered_teams': registered_teams,
        'shortlisted_teams': shortlisted_teams,
        'domain_dist': {
            'Software': software_count,
            'Hardware': hardware_count
        }
    }
    
    if stats_only:
        return jsonify({'stats': stats_data})

    # Pagination execution
    paginated_query = query.paginate(page=page, per_page=per_page, error_out=False)
    
    teams_list = []
    for team in paginated_query.items:
        teams_list.append(team.to_dict())
        
    total_count = paginated_query.total
    start_idx = (page - 1) * per_page + 1 if total_count > 0 else 0
    end_idx = min(page * per_page, total_count)
    
    return jsonify({
        'teams': teams_list,
        'total_pages': paginated_query.pages,
        'current_page': page,
        'total_count': total_count,
        'start_idx': start_idx,
        'end_idx': end_idx,
        'stats': stats_data
    })


@app.route('/admin/api/toggle_status/<int:team_id>', methods=['POST'])
@login_required
def toggle_team_status(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.get_json()
    
    new_status = data.get('status')
    if new_status not in ['Registered', 'Shortlisted']:
        return jsonify({"message": "Invalid status value."}), 400
        
    try:
        team.status = new_status
        db.session.commit()
        return jsonify({"message": "Status updated successfully.", "status": team.status})
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500


@app.route('/admin/team/<int:team_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def team_crud(team_id):
    team = Team.query.get_or_404(team_id)
    
    # 1. GET - Fetch specific team details
    if request.method == 'GET':
        return jsonify(team.to_dict())
        
    # 2. DELETE - Permanently remove registration
    if request.method == 'DELETE':
        try:
            # Delete pitch deck file from filesystem
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], team.presentation_path)
            if os.path.exists(file_path):
                os.remove(file_path)
                
            db.session.delete(team)
            db.session.commit()
            return jsonify({"message": "Team deleted successfully."})
        except Exception as e:
            db.session.rollback()
            return jsonify({"message": str(e)}), 500
            
    # 3. PUT - Edit team details
    if request.method == 'PUT':
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided."}), 400
            
        try:
            # Verify team name uniqueness (if changed)
            new_team_name = data.get('team_name', '').strip()
            if new_team_name != team.team_name:
                if Team.query.filter_by(team_name=new_team_name).first():
                    return jsonify({"message": f"Team name '{new_team_name}' already exists."}), 400
                    
            # Check member emails and register numbers uniqueness (if changed)
            for m in data.get('members', []):
                existing_member = TeamMember.query.filter(TeamMember.id != m['id']).filter_by(register_number=m['register_number']).first()
                if existing_member:
                    return jsonify({"message": f"Register number '{m['register_number']}' already registered by another team."}), 400
                    
                existing_email = TeamMember.query.filter(TeamMember.id != m['id']).filter_by(email=m['email']).first()
                if existing_email:
                    return jsonify({"message": f"Email '{m['email']}' already registered by another team."}), 400

            # Update basic team attributes
            team.team_name = new_team_name
            team.department = data.get('department', team.department)
            team.year_of_study = data.get('year_of_study', team.year_of_study)
            team.domain = data.get('domain', team.domain)
            team.problem_statement_id = data.get('problem_statement_id', team.problem_statement_id)
            team.project_title = data.get('project_title', team.project_title)
            team.project_description = data.get('project_description', team.project_description)
            
            # Update Mentor
            mentor_data = data.get('mentor', {})
            if team.mentor:
                team.mentor.mentor_name = mentor_data.get('mentor_name', team.mentor.mentor_name)
                team.mentor.mentor_email = mentor_data.get('mentor_email', team.mentor.mentor_email)
                team.mentor.mentor_mobile = mentor_data.get('mentor_mobile', team.mentor.mentor_mobile)
                
            # Update Members
            members_list = data.get('members', [])
            for m_data in members_list:
                member_rec = TeamMember.query.get(m_data['id'])
                if member_rec and member_rec.team_id == team.id:
                    member_rec.full_name = m_data.get('full_name', member_rec.full_name)
                    member_rec.register_number = m_data.get('register_number', member_rec.register_number).upper()
                    member_rec.email = m_data.get('email', member_rec.email).lower()
                    member_rec.mobile = m_data.get('mobile', member_rec.mobile)
                    member_rec.alt_mobile = m_data.get('alt_mobile')
                    member_rec.gender = m_data.get('gender', member_rec.gender)
                    member_rec.residential_status = m_data.get('residential_status', member_rec.residential_status)
            
            db.session.commit()
            return jsonify({"message": "Team registration details successfully updated."})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({"message": str(e)}), 500


# ==============================================
# EXCEL INTEGRATION
# ==============================================

def build_excel_dataframe(teams_query):
    # Query databases, build a flat join structure
    rows = []
    for team in teams_query:
        # Find members, pad list up to 6 members to have uniform columns
        members = sorted(team.members, key=lambda m: (not m.is_leader, m.id))
        padded_members = members + [None] * (6 - len(members))
        
        flat_row = {
            'Team ID': team.id,
            'Team Name': team.team_name,
            'Department': team.department,
            'Year of Study': team.year_of_study,
            'Domain': team.domain,
            'Problem Statement ID': team.problem_statement_id,
            'Project Title': team.project_title,
            'Project Description': team.project_description or '',
            'Status': team.status,
            'Presentation Path': team.presentation_path,
            'Mentor Name': team.mentor.mentor_name if team.mentor else '',
            'Mentor Email': team.mentor.mentor_email if team.mentor else '',
            'Mentor Mobile': team.mentor.mentor_mobile if team.mentor else '',
        }
        
        for i, m in enumerate(padded_members):
            num = i + 1
            if m:
                flat_row[f'Member {num} Name'] = m.full_name
                flat_row[f'Member {num} Reg Number'] = m.register_number
                flat_row[f'Member {num} Email'] = m.email
                flat_row[f'Member {num} Mobile'] = m.mobile
                flat_row[f'Member {num} Alt Mobile'] = m.alt_mobile or ''
                flat_row[f'Member {num} Gender'] = m.gender
                flat_row[f'Member {num} Residence'] = m.residential_status
                flat_row[f'Member {num} Is Leader'] = 'Yes' if m.is_leader else 'No'
            else:
                flat_row[f'Member {num} Name'] = ''
                flat_row[f'Member {num} Reg Number'] = ''
                flat_row[f'Member {num} Email'] = ''
                flat_row[f'Member {num} Mobile'] = ''
                flat_row[f'Member {num} Alt Mobile'] = ''
                flat_row[f'Member {num} Gender'] = ''
                flat_row[f'Member {num} Residence'] = ''
                flat_row[f'Member {num} Is Leader'] = ''
                
        rows.append(flat_row)
        
    return pd.DataFrame(rows)

@app.route('/admin/api/export/all', methods=['GET'])
@login_required
def export_all_excel():
    teams = Team.query.all()
    df = build_excel_dataframe(teams)
    
    # Stream the Excel binary directly
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='All Registrations')
    output.seek(0)
    
    return app.response_class(
        output.read(),
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={"Content-Disposition": "attachment;filename=hackathon_committee_registrations_all.xlsx"}
    )

@app.route('/admin/api/export/filtered', methods=['GET'])
@login_required
def export_filtered_excel():
    search_query = request.args.get('search', '').strip()
    domain_filter = request.args.get('domain', '')
    dept_filter = request.args.get('department', '').strip()
    ps_filter = request.args.get('problem_statement', '').strip()
    status_filter = request.args.get('status', '')

    query = Team.query.outerjoin(TeamMember)
    
    if domain_filter:
        query = query.filter(Team.domain == domain_filter)
    if dept_filter:
        query = query.filter(Team.department.ilike(f"%{dept_filter}%"))
    if ps_filter:
        query = query.filter(Team.problem_statement_id.ilike(f"%{ps_filter}%"))
    if status_filter:
        query = query.filter(Team.status == status_filter)
        
    if search_query:
        search_pattern = f"%{search_query}%"
        query = query.filter(
            (Team.team_name.ilike(search_pattern)) |
            (Team.project_title.ilike(search_pattern)) |
            (Team.problem_statement_id.ilike(search_pattern)) |
            (Team.department.ilike(search_pattern)) |
            (TeamMember.full_name.ilike(search_pattern)) |
            (TeamMember.email.ilike(search_pattern)) |
            (TeamMember.register_number.ilike(search_pattern))
        )
        
    teams = query.group_by(Team.id).all()
    df = build_excel_dataframe(teams)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Filtered Registrations')
    output.seek(0)
    
    return app.response_class(
        output.read(),
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={"Content-Disposition": "attachment;filename=hackathon_committee_registrations_filtered.xlsx"}
    )

def safe_int(val, default=None):
    if pd.isna(val) or str(val).strip() == '':
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default

@app.route('/admin/api/import', methods=['POST'])
@login_required
def import_sync_excel():
    if 'excel_file' not in request.files:
        return jsonify({"message": "No excel file uploaded."}), 400
        
    file = request.files['excel_file']
    if file.filename == '':
        return jsonify({"message": "Empty file."}), 400
        
    try:
        # Load Excel using Pandas
        df = pd.read_excel(file.stream)
        
        # Normalize columns to lowercase and strip whitespaces to ensure case-insensitive matching
        df.columns = [str(c).strip().lower() for c in df.columns]
        
        # Determine Excel format (user custom layout has 'team member 1' column)
        is_user_format = 'team member 1' in df.columns
        
        if is_user_format:
            required_cols = ['team name', 'department', 'year of study', 'domain', 'project title', 'team member 1']
        else:
            required_cols = ['team id', 'team name', 'department', 'year of study', 'domain', 'problem statement id', 'project title', 'status']
            
        for col in required_cols:
            if col not in df.columns:
                # Capitalize error message for friendly reading
                return jsonify({"message": f"Excel sheet is missing required column: {col.title()}"}), 400

        synced_count = 0
        for _, row in df.iterrows():
            team = None
            
            # Fetch existing team
            if not is_user_format:
                team_id = safe_int(row.get('team id'))
                if team_id is not None:
                    team = db.session.get(Team, team_id)
            
            is_new_team = False
            if not team:
                # fallback match by team name
                team = Team.query.filter_by(team_name=str(row['team name']).strip()).first()
                
            if not team:
                # Insert as a brand new team
                ps_col = 'ps id' if 'ps id' in df.columns else 'problem statement id'
                ps_val = str(row[ps_col]).strip() if (ps_col in df.columns and pd.notna(row[ps_col])) else 'N/A'
                
                team = Team(
                    team_name=str(row['team name']).strip(),
                    department=str(row['department']).strip(),
                    year_of_study=safe_int(row.get('year of study'), 1),
                    domain=str(row['domain']).strip(),
                    problem_statement_id=ps_val,
                    project_title=str(row['project title']).strip(),
                    presentation_path="imported_from_excel.pdf"
                )
                db.session.add(team)
                db.session.flush() # Flush to assign team.id
                
                # Create new Mentor record
                mentor = Mentor(
                    team_id=team.id,
                    mentor_name='N/A',
                    mentor_email='n/a@college.edu',
                    mentor_mobile='0000000000'
                )
                db.session.add(mentor)
                is_new_team = True
                
            # Update Team table fields
            team.team_name = str(row['team name']).strip()
            team.department = str(row['department']).strip()
            team.year_of_study = safe_int(row.get('year of study'), team.year_of_study)
            team.domain = str(row['domain']).strip()
            
            # Problem Statement mapping
            ps_col = 'ps id' if 'ps id' in df.columns else 'problem statement id'
            if ps_col in df.columns and pd.notna(row[ps_col]):
                team.problem_statement_id = str(row[ps_col]).strip()
                
            team.project_title = str(row['project title']).strip()
            if 'project description' in df.columns and pd.notna(row['project description']):
                team.project_description = str(row['project description']).strip()
            if 'status' in df.columns and pd.notna(row['status']):
                status_str = str(row['status']).strip().capitalize()
                if status_str in ['Registered', 'Shortlisted']:
                    team.status = status_str
                    
            # Update Mentor details (for our standard format only, user format doesn't have it)
            if not is_user_format and team.mentor:
                if 'mentor name' in df.columns and pd.notna(row['mentor name']):
                    team.mentor.mentor_name = str(row['mentor name']).strip()
                if 'mentor email' in df.columns and pd.notna(row['mentor email']):
                    team.mentor.mentor_email = str(row['mentor email']).strip().lower()
                if 'mentor mobile' in df.columns and pd.notna(row['mentor mobile']):
                    team.mentor.mentor_mobile = str(row['mentor mobile']).strip()
                    
            # Update team members by index (Member 1 to 6)
            existing_members = sorted(team.members, key=lambda m: (not m.is_leader, m.id))
            
            for i in range(1, 7):
                if is_user_format:
                    name_col = f'team member {i}'
                    # Pandas duplicate columns renaming format: col, col.1, col.2, etc.
                    suffix = f'.{i-1}' if i > 1 else ''
                    reg_col = f'register number{suffix}'
                    mobile_col = f'mobile number{suffix}'
                    alt_mob_col = f'alternate mobile{suffix}'
                    email_col = f'email id{suffix}'
                    is_leader_val = (i == 1)
                else:
                    name_col = f'member {i} name'
                    reg_col = f'member {i} reg number'
                    email_col = f'member {i} email'
                    mobile_col = f'member {i} mobile'
                    alt_mob_col = f'member {i} alt mobile'
                    is_leader_val = None
                    
                # Check if we have member data for this index
                has_member_data = (
                    (name_col in df.columns and pd.notna(row[name_col]) and str(row[name_col]).strip() != '') or
                    (reg_col in df.columns and pd.notna(row[reg_col]) and str(row[reg_col]).strip() != '')
                )
                
                if has_member_data:
                    member = None
                    if i - 1 < len(existing_members):
                        member = existing_members[i - 1]
                    else:
                        if len(team.members) < 6:
                            member = TeamMember(team_id=team.id)
                            db.session.add(member)
                            
                    if member:
                        if reg_col in df.columns and pd.notna(row[reg_col]):
                            member.register_number = str(row[reg_col]).strip().upper()
                            if member.register_number.endswith('.0'):
                                member.register_number = member.register_number[:-2]
                        if name_col in df.columns and pd.notna(row[name_col]):
                            member.full_name = str(row[name_col]).strip()
                            if member.full_name.endswith('.0'):
                                member.full_name = member.full_name[:-2]
                        if email_col in df.columns and pd.notna(row[email_col]):
                            member.email = str(row[email_col]).strip().lower()
                        if mobile_col in df.columns and pd.notna(row[mobile_col]):
                            member.mobile = str(row[mobile_col]).strip()
                            if member.mobile.endswith('.0'):
                                member.mobile = member.mobile[:-2]
                        if alt_mob_col in df.columns and pd.notna(row[alt_mob_col]):
                            val_alt = str(row[alt_mob_col]).strip()
                            if val_alt.endswith('.0'):
                                val_alt = val_alt[:-2]
                            member.alt_mobile = val_alt if val_alt != '' else None
                        
                        # Set default gender/residence if missing in user format
                        gender_col_key = f'member {i} gender'
                        if gender_col_key in df.columns and pd.notna(row[gender_col_key]):
                            member.gender = str(row[gender_col_key]).strip()
                        elif not member.gender:
                            member.gender = 'Male'
                            
                        res_col_key = f'member {i} residence'
                        if res_col_key in df.columns and pd.notna(row[res_col_key]):
                            member.residential_status = str(row[res_col_key]).strip()
                        elif not member.residential_status:
                            member.residential_status = 'Day Scholar'
                            
                        if is_user_format:
                            member.is_leader = is_leader_val
                        else:
                            leader_col = f'member {i} is leader'
                            if leader_col in df.columns and pd.notna(row[leader_col]):
                                member.is_leader = (str(row[leader_col]).strip().lower() == 'yes')
                else:
                    # If an extra member is cleared in Excel, delete them from the database
                    if i - 1 < len(existing_members) and len(team.members) > 4:
                        member_to_remove = existing_members[i - 1]
                        if not member_to_remove.is_leader:
                            db.session.delete(member_to_remove)
            synced_count += 1
            
        db.session.commit()
        return jsonify({"message": "Database sync complete.", "synced_count": synced_count})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Excel parsing error: {str(e)}"}), 500


if __name__ == '__main__':
    # Build folders
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    with app.app_context():
        db.create_all()
        admin = Admin.query.filter_by(username='admin').first()
        if not admin:
            hashed_pw = generate_password_hash('admin123')
            default_admin = Admin(username='admin', password_hash=hashed_pw)
            db.session.add(default_admin)
            db.session.commit()
            print("Auto-seeded admin user: admin / admin123")
    app.run(debug=True, port=5001)
