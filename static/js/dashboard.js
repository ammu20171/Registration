document.addEventListener('DOMContentLoaded', () => {
    // Current state indicators
    let currentPage = 1;
    let currentSort = 'created_at';
    let currentOrder = 'desc';
    let chartInstance = null;

    // Elements
    const searchBar = document.getElementById('searchBar');
    const filterDomain = document.getElementById('filterDomain');
    const filterDept = document.getElementById('filterDept');
    const filterPS = document.getElementById('filterPS');
    const filterStatus = document.getElementById('filterStatus');
    
    const tableBody = document.getElementById('teamsTableBody');
    const tableSpinner = document.getElementById('tableSpinner');
    const emptyAlert = document.getElementById('emptyAlert');
    
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationList = document.getElementById('paginationList');
    
    const viewModal = new bootstrap.Modal(document.getElementById('viewTeamModal'));
    const viewModalBody = document.getElementById('viewModalBody');
    const viewModalTitle = document.getElementById('viewModalTitle');
    
    const editModal = new bootstrap.Modal(document.getElementById('editTeamModal'));
    const editModalBody = document.getElementById('editModalBody');
    const editTeamForm = document.getElementById('editTeamForm');
    
    const importModal = document.getElementById('importExcelModal') ? new bootstrap.Modal(document.getElementById('importExcelModal')) : null;
    const importExcelForm = document.getElementById('importExcelForm');
    const importErrorAlert = document.getElementById('importErrorAlert');
    const importErrorMessage = document.getElementById('importErrorMessage');
    
    const exportFilteredBtn = document.getElementById('exportFilteredBtn');
    
    // Toast elements
    const toastEl = document.getElementById('dashboardToast');
    const toastHeader = document.getElementById('toastHeader');
    const toastBody = document.getElementById('toastBody');
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });

    // Initial Load
    fetchTeamsData();
    
    // Wire up filter events with a debounce for input fields
    let debounceTimer;
    const triggerSearch = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentPage = 1;
            fetchTeamsData();
        }, 300);
    };

    searchBar.addEventListener('input', triggerSearch);
    if (filterDept) filterDept.addEventListener('input', triggerSearch);
    if (filterPS) filterPS.addEventListener('input', triggerSearch);
    
    if (filterDomain) filterDomain.addEventListener('change', () => { currentPage = 1; fetchTeamsData(); });
    if (filterStatus) filterStatus.addEventListener('change', () => { currentPage = 1; fetchTeamsData(); });

    // Column Sorting Headers
    document.querySelectorAll('.th-sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortBy = th.getAttribute('data-sort');
            if (currentSort === sortBy) {
                currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort = sortBy;
                currentOrder = 'asc';
            }
            
            // Update sort icon UI
            document.querySelectorAll('.th-sortable .sort-icon').forEach(icon => {
                icon.className = 'bi bi-arrow-down-up sort-icon';
            });
            const subIcon = th.querySelector('.sort-icon');
            subIcon.className = currentOrder === 'asc' ? 'bi bi-arrow-up sort-icon text-primary' : 'bi bi-arrow-down sort-icon text-primary';
            
            fetchTeamsData();
        });
    });

    // Main Fetch Team API
    function fetchTeamsData() {
        showLoading(true);
        
        // Build Query String
        const params = new URLSearchParams({
            page: currentPage,
            sort: currentSort,
            order: currentOrder,
            search: searchBar.value.trim(),
            domain: filterDomain ? filterDomain.value : '',
            department: filterDept ? filterDept.value.trim() : '',
            problem_statement: filterPS ? filterPS.value.trim() : '',
            status: filterStatus ? filterStatus.value : '',
            _t: Date.now()
        });

        fetch(`/admin/api/teams?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error("Could not fetch database records.");
                return res.json();
            })
            .then(data => {
                // Self-healing pagination: if we are on a page > 1 that has become empty, go to the previous page
                if (data.teams.length === 0 && currentPage > 1) {
                    currentPage--;
                    fetchTeamsData();
                    return;
                }
                renderTable(data.teams);
                renderPagination(data.total_pages, data.current_page, data.total_count, data.start_idx, data.end_idx);
                updateStatsCards(data.stats);
                updateDomainChart(data.stats.domain_dist);
                showLoading(false);
            })
            .catch(err => {
                showToast("error", err.message);
                showLoading(false);
            });
    }

    function showLoading(isLoading) {
        if (isLoading) {
            tableBody.innerHTML = '';
            tableSpinner.classList.remove('d-none');
            emptyAlert.classList.add('d-none');
        } else {
            tableSpinner.classList.add('d-none');
        }
    }

    // Render Database Rows
    function renderTable(teams) {
        tableBody.innerHTML = '';
        if (teams.length === 0) {
            emptyAlert.classList.remove('d-none');
            return;
        }

        emptyAlert.classList.add('d-none');
        teams.forEach(team => {
            const isShortlisted = team.status === 'Shortlisted';
            
            // Find leader name
            const leader = team.members.find(m => m.is_leader) || team.members[0];
            const leaderName = leader ? leader.full_name : 'No Leader';

            const tr = document.createElement('tr');
            tr.id = `team-row-${team.id}`;
            tr.innerHTML = `
                <td class="fw-semibold text-white">${escapeHtml(team.team_name)}</td>
                <td>
                    <div class="d-flex flex-column">
                        <span class="text-white fw-medium">${escapeHtml(leaderName)}</span>
                        <span class="text-secondary fs-7">${escapeHtml(leader ? leader.email : '')}</span>
                    </div>
                </td>
                <td><span class="badge bg-dark-card border border-secondary-subtle px-2 py-1">${escapeHtml(team.department)}</span></td>
                <td>
                    <span class="badge ${team.domain === 'Software' ? 'bg-primary-subtle text-primary border border-primary' : 'bg-success-subtle text-success border border-success'} px-2 py-1">
                        ${team.domain}
                    </span>
                </td>
                <td><code>${escapeHtml(team.problem_statement_id)}</code></td>
                <td><div class="text-truncate" style="max-width: 180px;" title="${escapeHtml(team.project_title)}">${escapeHtml(team.project_title)}</div></td>
                <td>
                    <div class="d-flex justify-content-center">
                        <div class="switch-container">
                            <span class="fs-7 text-secondary me-1">Registered</span>
                            <label class="status-toggle">
                                <input type="checkbox" class="toggle-checkbox" data-id="${team.id}" ${isShortlisted ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                            <span class="fs-7 text-success ms-1">Shortlisted</span>
                        </div>
                    </div>
                </td>
                <td class="text-end">
                    <div class="btn-group gap-1">
                        <button class="btn btn-sm btn-outline-info rounded-circle btn-view-team" data-id="${team.id}" title="View Details">
                            <i class="bi bi-eye-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning rounded-circle btn-edit-team" data-id="${team.id}" title="Edit Registration">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger rounded-circle btn-delete-team" data-id="${team.id}" title="Delete Registration">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            `;
            
            // Wire up Action Buttons
            tr.querySelector('.toggle-checkbox').addEventListener('change', function() {
                toggleTeamStatus(team.id, this.checked);
            });
            tr.querySelector('.btn-view-team').addEventListener('click', () => openViewModal(team.id));
            tr.querySelector('.btn-edit-team').addEventListener('click', () => openEditModal(team.id));
            tr.querySelector('.btn-delete-team').addEventListener('click', () => deleteTeam(team.id));

            tableBody.appendChild(tr);
        });
    }

    // Toggle shortlisting state dynamically via Fetch API
    function toggleTeamStatus(teamId, isChecked) {
        const newStatus = isChecked ? 'Shortlisted' : 'Registered';
        
        fetch(`/admin/api/toggle_status/${teamId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        .then(res => {
            if (!res.ok) throw new Error("Failed to change team status.");
            return res.json();
        })
        .then(data => {
            showToast("success", `Team status updated to ${newStatus}`);
            
            // If the view is currently pre-filtered by Status, remove the row smoothly
            const activeStatusFilter = filterStatus ? filterStatus.value : '';
            
            // For the shortlisted.html, filterStatus is always locked/hidden to "Shortlisted".
            // Therefore, toggling off (making it registered) should remove the row.
            const isShortlistedPage = document.getElementById('filterStatus')?.value === 'Shortlisted' && document.getElementById('filterStatus')?.type !== 'select-one';
            
            if (activeStatusFilter !== '' || isShortlistedPage) {
                const row = document.getElementById(`team-row-${teamId}`);
                if (row) {
                    row.style.transition = 'all 0.4s ease';
                    row.style.opacity = '0';
                    row.style.transform = 'translateX(50px)';
                    setTimeout(() => {
                        row.remove();
                        // Recalculate and update stats or reload table to maintain count
                        fetchTeamsData();
                    }, 400);
                }
            } else {
                // Just refresh stats cards in background without reloading table
                fetch(`/admin/api/teams?stats_only=true`)
                    .then(res => res.json())
                    .then(data => {
                        updateStatsCards(data.stats);
                    });
            }
        })
        .catch(err => {
            showToast("error", err.message);
            // Revert switch checkbox
            const checkbox = document.querySelector(`.toggle-checkbox[data-id="${teamId}"]`);
            if (checkbox) checkbox.checked = !isChecked;
        });
    }

    // Modal Actions: 1. View Team DETAILS
    function openViewModal(teamId) {
        viewModalBody.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';
        viewModal.show();
        
        fetch(`/admin/team/${teamId}?_t=${Date.now()}`)
            .then(res => {
                if (!res.ok) throw new Error("Could not load team details.");
                return res.json();
            })
            .then(team => {
                viewModalTitle.innerText = `Team Profile: ${team.team_name}`;
                
                let membersHtml = '';
                team.members.forEach((m, idx) => {
                    membersHtml += `
                        <div class="col-md-6 mb-3">
                            <div class="p-3 bg-dark-card border border-secondary-subtle rounded-3">
                                <div class="d-flex align-items-center justify-content-between mb-2">
                                    <span class="badge bg-primary">Member #${idx+1}</span>
                                    ${m.is_leader ? '<span class="badge bg-success"><i class="bi bi-shield-fill me-1"></i>Leader</span>' : ''}
                                </div>
                                <h6 class="text-white mb-1 fw-bold">${escapeHtml(m.full_name)}</h6>
                                <p class="text-secondary fs-7 mb-1"><i class="bi bi-card-text me-1"></i>Reg: ${escapeHtml(m.register_number)}</p>
                                <p class="text-secondary fs-7 mb-1"><i class="bi bi-envelope me-1"></i>Email: ${escapeHtml(m.email)}</p>
                                <p class="text-secondary fs-7 mb-1"><i class="bi bi-telephone me-1"></i>Mobile: ${escapeHtml(m.mobile)}</p>
                                ${m.alt_mobile ? `<p class="text-secondary fs-7 mb-1"><i class="bi bi-telephone-plus me-1"></i>Alt Mobile: ${escapeHtml(m.alt_mobile)}</p>` : ''}
                                <div class="d-flex gap-2 mt-2">
                                    <span class="badge bg-secondary fs-8">${escapeHtml(m.gender)}</span>
                                    <span class="badge bg-secondary fs-8">${escapeHtml(m.residential_status)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                });

                viewModalBody.innerHTML = `
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <h6 class="text-secondary uppercase tracking-wider fs-7">Project Details</h6>
                            <h4 class="text-primary-gradient font-outfit fw-bold">${escapeHtml(team.project_title)}</h4>
                            <p class="text-white fs-7 mb-2">${escapeHtml(team.project_description || 'No description provided.')}</p>
                            
                            <div class="d-flex flex-wrap gap-2 mb-3">
                                <span class="badge bg-dark border border-secondary-subtle">Domain: ${team.domain}</span>
                                <span class="badge bg-dark border border-secondary-subtle">Dept: ${escapeHtml(team.department)}</span>
                                <span class="badge bg-dark border border-secondary-subtle">Year: ${team.year_of_study}</span>
                                <span class="badge bg-dark border border-secondary-subtle">PS ID: ${escapeHtml(team.problem_statement_id)}</span>
                            </div>
                            
                            <!-- Pitch Deck Link -->
                            <a href="/admin/download_pitch/${team.id}" class="btn btn-outline-info rounded-pill btn-sm px-3 py-2" target="_blank">
                                <i class="bi bi-cloud-arrow-down-fill me-1"></i> Download Pitch Deck (${team.presentation_path.substring(team.presentation_path.lastIndexOf('/') + 1)})
                            </a>
                        </div>
                        <div class="col-md-6 border-start border-secondary-subtle ps-md-4 mt-4 mt-md-0">
                            <h6 class="text-secondary uppercase tracking-wider fs-7 mb-3">Mentor Information</h6>
                            <div class="p-3 bg-dark-card border border-secondary-subtle rounded-3">
                                <h6 class="text-white mb-2 fw-bold"><i class="bi bi-person-workspace text-primary me-2"></i>${escapeHtml(team.mentor.mentor_name)}</h6>
                                <p class="text-secondary fs-7 mb-1"><i class="bi bi-envelope me-1"></i>Email: ${escapeHtml(team.mentor.mentor_email)}</p>
                                <p class="text-secondary fs-7 mb-0"><i class="bi bi-telephone me-1"></i>Mobile: ${escapeHtml(team.mentor.mentor_mobile)}</p>
                            </div>
                            
                            <div class="mt-4">
                                <h6 class="text-secondary uppercase tracking-wider fs-7 mb-1">Registration Status</h6>
                                <span class="badge ${team.status === 'Shortlisted' ? 'bg-success' : 'bg-info'} fs-6 py-2 px-3 rounded-pill">
                                    <i class="bi ${team.status === 'Shortlisted' ? 'bi-bookmark-star-fill' : 'bi-patch-check'} me-1"></i>${team.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <h6 class="text-secondary uppercase tracking-wider fs-7 mb-3">Team Members</h6>
                    <div class="row">
                        ${membersHtml}
                    </div>
                `;
            })
            .catch(err => {
                viewModalBody.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
            });
    }

    // Modal Actions: 2. Edit Team DETAILS
    function openEditModal(teamId) {
        editModalBody.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';
        editModal.show();
        
        fetch(`/admin/team/${teamId}?_t=${Date.now()}`)
            .then(res => {
                if (!res.ok) throw new Error("Could not fetch details.");
                return res.json();
            })
            .then(team => {
                // Dynamically compile edit HTML
                let membersEditHtml = '';
                team.members.forEach((m, idx) => {
                    membersEditHtml += `
                        <div class="p-3 bg-dark-card border border-secondary-subtle rounded-3 mb-3 edit-member-block" data-member-idx="${idx+1}">
                            <div class="d-flex align-items-center justify-content-between mb-2">
                                <span class="badge bg-primary">Member #${idx+1}</span>
                                ${m.is_leader ? '<span class="badge bg-success"><i class="bi bi-shield-fill me-1"></i>Team Leader</span>' : ''}
                                <input type="hidden" name="member_id_${idx+1}" value="${m.id}">
                                <input type="hidden" name="member_is_leader_${idx+1}" value="${m.is_leader}">
                            </div>
                            <div class="row g-2">
                                <div class="col-md-4">
                                    <label class="form-label fs-7 text-secondary">Full Name</label>
                                    <input type="text" class="form-control form-control-sm" name="member_name_${idx+1}" value="${escapeHtml(m.full_name)}" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label fs-7 text-secondary">Register Number</label>
                                    <input type="text" class="form-control form-control-sm" name="member_reg_${idx+1}" value="${escapeHtml(m.register_number)}" style="text-transform: uppercase;" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label fs-7 text-secondary">Email ID</label>
                                    <input type="email" class="form-control form-control-sm" name="member_email_${idx+1}" value="${escapeHtml(m.email)}" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label fs-7 text-secondary">Mobile</label>
                                    <input type="tel" class="form-control form-control-sm" name="member_mobile_${idx+1}" value="${escapeHtml(m.mobile)}" pattern="[0-9]{10}" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label fs-7 text-secondary">Alt Mobile</label>
                                    <input type="tel" class="form-control form-control-sm" name="member_alt_mobile_${idx+1}" value="${escapeHtml(m.alt_mobile || '')}" pattern="[0-9]{10}">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label fs-7 text-secondary">Gender</label>
                                    <select class="form-select form-select-sm" name="member_gender_${idx+1}" required>
                                        <option value="Male" ${m.gender === 'Male' ? 'selected' : ''}>Male</option>
                                        <option value="Female" ${m.gender === 'Female' ? 'selected' : ''}>Female</option>
                                        <option value="Other" ${m.gender === 'Other' ? 'selected' : ''}>Other</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label fs-7 text-secondary">Residence</label>
                                    <select class="form-select form-select-sm" name="member_residence_${idx+1}" required>
                                        <option value="Hosteller" ${m.residential_status === 'Hosteller' ? 'selected' : ''}>Hosteller</option>
                                        <option value="Day Scholar" ${m.residential_status === 'Day Scholar' ? 'selected' : ''}>Day Scholar</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    `;
                });

                editModalBody.innerHTML = `
                    <input type="hidden" name="team_id" value="${team.id}">
                    <div class="row g-3 mb-4">
                        <div class="col-12"><h6 class="text-primary-gradient uppercase tracking-wider fs-7">1. Team & Project Details</h6></div>
                        <div class="col-md-4">
                            <label class="form-label">Team Name</label>
                            <input type="text" class="form-control" name="team_name" value="${escapeHtml(team.team_name)}" required>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">Department</label>
                            <input type="text" class="form-control" name="department" value="${escapeHtml(team.department)}" required>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Year of Study</label>
                            <select class="form-select" name="year_of_study" required>
                                <option value="1" ${team.year_of_study === 1 ? 'selected' : ''}>1st Year</option>
                                <option value="2" ${team.year_of_study === 2 ? 'selected' : ''}>2nd Year</option>
                                <option value="3" ${team.year_of_study === 3 ? 'selected' : ''}>3rd Year</option>
                                <option value="4" ${team.year_of_study === 4 ? 'selected' : ''}>4th Year</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">Domain</label>
                            <select class="form-select" name="domain" required>
                                <option value="Software" ${team.domain === 'Software' ? 'selected' : ''}>Software</option>
                                <option value="Hardware" ${team.domain === 'Hardware' ? 'selected' : ''}>Hardware</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Problem Statement ID</label>
                            <input type="text" class="form-control" name="problem_statement_id" value="${escapeHtml(team.problem_statement_id)}" required>
                        </div>
                        <div class="col-md-8">
                            <label class="form-label">Project Title</label>
                            <input type="text" class="form-control" name="project_title" value="${escapeHtml(team.project_title)}" required>
                        </div>
                        <div class="col-12">
                            <label class="form-label">Project Description</label>
                            <textarea class="form-control" name="project_description" rows="3">${escapeHtml(team.project_description || '')}</textarea>
                        </div>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-12"><h6 class="text-primary-gradient uppercase tracking-wider fs-7">2. Mentor Details</h6></div>
                        <div class="col-md-4">
                            <label class="form-label">Mentor Name</label>
                            <input type="text" class="form-control" name="mentor_name" value="${escapeHtml(team.mentor.mentor_name)}" required>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Mentor Email</label>
                            <input type="email" class="form-control" name="mentor_email" value="${escapeHtml(team.mentor.mentor_email)}" required>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Mentor Mobile</label>
                            <input type="tel" class="form-control" name="mentor_mobile" value="${escapeHtml(team.mentor.mentor_mobile)}" pattern="[0-9]{10}" required>
                        </div>
                    </div>

                    <div class="mb-2">
                        <h6 class="text-primary-gradient uppercase tracking-wider fs-7 mb-3">3. Team Members Details</h6>
                        <div id="editMembersList">
                            ${membersEditHtml}
                        </div>
                    </div>
                `;
            })
            .catch(err => {
                editModalBody.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
            });
    }

    // Submit Edit Form Handler
    editTeamForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!editTeamForm.checkValidity()) {
            editTeamForm.classList.add('was-validated');
            return;
        }

        const formData = new FormData(editTeamForm);
        const teamId = formData.get('team_id');

        // Compile JSON payloads for members, mentor and team
        const payload = {
            team_name: formData.get('team_name'),
            department: formData.get('department'),
            year_of_study: parseInt(formData.get('year_of_study')),
            domain: formData.get('domain'),
            problem_statement_id: formData.get('problem_statement_id'),
            project_title: formData.get('project_title'),
            project_description: formData.get('project_description'),
            mentor: {
                mentor_name: formData.get('mentor_name'),
                mentor_email: formData.get('mentor_email'),
                mentor_mobile: formData.get('mentor_mobile')
            },
            members: []
        };

        // Extract members
        const memberBlocks = editTeamForm.querySelectorAll('.edit-member-block');
        memberBlocks.forEach(block => {
            const idx = block.getAttribute('data-member-idx');
            payload.members.push({
                id: formData.get(`member_id_${idx}`) ? parseInt(formData.get(`member_id_${idx}`)) : null,
                is_leader: formData.get(`member_is_leader_${idx}`) === 'true',
                full_name: formData.get(`member_name_${idx}`),
                register_number: formData.get(`member_reg_${idx}`),
                email: formData.get(`member_email_${idx}`),
                mobile: formData.get(`member_mobile_${idx}`),
                alt_mobile: formData.get(`member_alt_mobile_${idx}`) || null,
                gender: formData.get(`member_gender_${idx}`),
                residential_status: formData.get(`member_residence_${idx}`)
            });
        });

        // Submit via Fetch PUT
        fetch(`/admin/team/${teamId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => {
                    throw new Error(data.message || "Failed to update details.");
                });
            }
            return res.json();
        })
        .then(data => {
            showToast("success", "Registration details successfully updated.");
            editModal.hide();
            fetchTeamsData(); // Reload Table
        })
        .catch(err => {
            showToast("error", err.message);
        });
    });

    // Delete Team Row with confirm prompt
    function deleteTeam(teamId) {
        if (confirm("Are you sure you want to permanently delete this team? All associated member and mentor records will be deleted.")) {
            fetch(`/admin/team/${teamId}`, {
                method: 'DELETE'
            })
            .then(res => {
                if (!res.ok) throw new Error("Could not delete registration.");
                return res.json();
            })
            .then(() => {
                showToast("success", "Team successfully deleted.");
                fetchTeamsData(); // Reload Table
            })
            .catch(err => {
                showToast("error", err.message);
            });
        }
    }

    // Excel Export Filtered Action
    exportFilteredBtn.addEventListener('click', () => {
        const params = new URLSearchParams({
            search: searchBar.value.trim(),
            domain: filterDomain ? filterDomain.value : '',
            department: filterDept ? filterDept.value.trim() : '',
            problem_statement: filterPS ? filterPS.value.trim() : '',
            status: filterStatus ? filterStatus.value : ''
        });
        window.location.href = `/admin/api/export/filtered?${params.toString()}`;
    });

    // Excel Import File Upload Sync
    if (importExcelForm) {
        importExcelForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const fileInput = document.getElementById('excelFile');
            if (fileInput.files.length === 0) {
                fileInput.classList.add('is-invalid');
                return;
            }

            const submitBtn = document.getElementById('importSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing...';
            importErrorAlert.classList.add('d-none');

            const formData = new FormData(importExcelForm);

            fetch('/admin/api/import', {
                method: 'POST',
                body: formData
            })
            .then(res => {
                if (!res.ok) {
                    return res.json().then(data => {
                        throw new Error(data.message || "Failed to process import file.");
                    });
                }
                return res.json();
            })
            .then(data => {
                showToast("success", `Spreadsheet imported! Added/Updated ${data.synced_count} records.`);
                importExcelForm.reset();
                if (importModal) importModal.hide();
                
                // Reset active filters so user can see imported changes across all teams
                if (searchBar) searchBar.value = '';
                if (filterDomain) filterDomain.value = '';
                if (filterDept) filterDept.value = '';
                if (filterPS) filterPS.value = '';
                if (filterStatus && filterStatus.type === 'select-one') {
                    filterStatus.value = '';
                }
                
                currentPage = 1;
                fetchTeamsData(); // Reload Table
            })
            .catch(err => {
                importErrorMessage.innerText = err.message;
                importErrorAlert.classList.remove('d-none');
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Upload & Sync';
            });
        });
    }

    // Pagination Generator
    function renderPagination(totalPages, currentPage, totalCount, startIdx, endIdx) {
        paginationInfo.innerText = `Showing ${startIdx} to ${endIdx} of ${totalCount} teams`;
        paginationList.innerHTML = '';

        if (totalPages <= 1) return;

        // Previous Button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<button class="page-link page-link-custom"><i class="bi bi-chevron-left"></i></button>`;
        if (currentPage > 1) {
            prevLi.querySelector('button').addEventListener('click', () => {
                currentPage--;
                fetchTeamsData();
            });
        }
        paginationList.appendChild(prevLi);

        // Page Numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${currentPage === i ? 'active' : ''}`;
            pageLi.innerHTML = `<button class="page-link page-link-custom">${i}</button>`;
            pageLi.querySelector('button').addEventListener('click', () => {
                currentPage = i;
                fetchTeamsData();
            });
            paginationList.appendChild(pageLi);
        }

        // Next Button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<button class="page-link page-link-custom"><i class="bi bi-chevron-right"></i></button>`;
        if (currentPage < totalPages) {
            nextLi.querySelector('button').addEventListener('click', () => {
                currentPage++;
                fetchTeamsData();
            });
        }
        paginationList.appendChild(nextLi);
    }

    // Update KPI Cards UI
    function updateStatsCards(stats) {
        if (document.getElementById('stat-total-teams')) {
            document.getElementById('stat-total-teams').innerText = stats.total_teams;
            document.getElementById('stat-registered-teams').innerText = stats.registered_teams;
            document.getElementById('stat-shortlisted-teams').innerText = stats.shortlisted_teams;
        }
    }

    // Update Chart.js Pie/Bar Visualization
    function updateDomainChart(domainDist) {
        const ctx = document.getElementById('domainDistributionChart');
        if (!ctx) return;

        const softwareCount = domainDist.Software || 0;
        const hardwareCount = domainDist.Hardware || 0;

        if (chartInstance) {
            // Update existing chart datasets
            chartInstance.data.datasets[0].data = [softwareCount, hardwareCount];
            chartInstance.update();
        } else {
            // Create Chart
            chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Software', 'Hardware'],
                    datasets: [{
                        data: [softwareCount, hardwareCount],
                        backgroundColor: ['#6366f1', '#10b981'],
                        borderColor: '#0f172a',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return ` ${context.label}: ${context.raw}`;
                                }
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }
    }

    // Helper functions
    function showToast(type, message) {
        toastHeader.innerHTML = `
            <strong class="me-auto d-flex align-items-center gap-2 text-white">
                <i class="bi ${type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} fs-5"></i>
                ${type === 'success' ? 'Success' : 'Error'}
            </strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        `;
        toastBody.innerText = message;
        toast.show();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }
});
