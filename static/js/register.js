document.addEventListener('DOMContentLoaded', () => {
    let currentStep = 1;
    const totalSteps = 3;
    let memberCount = 0;
    const minMembers = 4;
    const maxMembers = 6;

    const form = document.getElementById('registrationForm');
    const membersWrapper = document.getElementById('membersWrapper');
    const addMemberBtn = document.getElementById('addMemberBtn');
    
    // Drag and Drop Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('presentation');
    const fileInfoBar = document.getElementById('fileInfoBar');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const fileError = document.getElementById('fileError');
    const uploadLabel = document.getElementById('uploadLabel');

    // Error Alert Box
    const errorAlert = document.getElementById('errorAlert');
    const errorMessageText = document.getElementById('errorMessageText');

    // Step navigation buttons
    const nextBtns = document.querySelectorAll('.next-step-btn');
    const prevBtns = document.querySelectorAll('.prev-step-btn');

    // Initialize with 4 members
    for (let i = 1; i <= minMembers; i++) {
        addMember();
    }

    // Next Step handler
    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                hideAlert();
                currentStep++;
                showStep(currentStep);
            }
        });
    });

    // Previous Step handler
    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            hideAlert();
            currentStep--;
            showStep(currentStep);
        });
    });

    function showStep(step) {
        document.querySelectorAll('.step-container').forEach(el => {
            el.classList.remove('active');
        });
        document.getElementById(`step-${step}`).classList.add('active');

        // Update progress indicators
        for (let i = 1; i <= totalSteps; i++) {
            const ind = document.getElementById(`step-ind-${i}`);
            if (i < step) {
                ind.className = 'step-indicator complete';
                ind.innerHTML = '<i class="bi bi-check-lg"></i>';
            } else if (i === step) {
                ind.className = 'step-indicator active';
                ind.innerHTML = i;
            } else {
                ind.className = 'step-indicator';
                ind.innerHTML = i;
            }
        }

        // Fill progress line
        const fillPercent = ((step - 1) / (totalSteps - 1)) * 100;
        document.querySelector('.progress-bar-fill').style.width = `${fillPercent}%`;
        
        // Scroll to top of card
        document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
    }

    function validateStep(step) {
        const stepContainer = document.getElementById(`step-${step}`);
        const inputs = stepContainer.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.checkValidity()) {
                input.classList.add('is-invalid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
                
                // Extra regex validations for emails and mobiles
                if (input.type === 'email' && !validateEmailFormat(input.value)) {
                    input.classList.add('is-invalid');
                    isValid = false;
                }
                
                if (input.type === 'tel' && !validateMobileFormat(input.value)) {
                    input.classList.add('is-invalid');
                    isValid = false;
                }
            }
        });

        // Specific custom validations per step
        if (step === 2) {
            // Check member uniqueness inputs on frontend (emails/register numbers)
            const emails = Array.from(document.querySelectorAll('.member-email-input')).map(el => el.value.trim().toLowerCase());
            const regNums = Array.from(document.querySelectorAll('.member-reg-input')).map(el => el.value.trim().toUpperCase());

            const uniqueEmails = new Set(emails.filter(e => e !== ''));
            const uniqueRegs = new Set(regNums.filter(r => r !== ''));

            if (uniqueEmails.size !== emails.length) {
                showAlert('Emails must be unique across all team members.');
                isValid = false;
            }
            if (uniqueRegs.size !== regNums.length) {
                showAlert('Register numbers must be unique across all team members.');
                isValid = false;
            }
        }

        if (!isValid) {
            form.classList.add('was-validated');
        }
        return isValid;
    }

    function validateEmailFormat(email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(String(email).toLowerCase());
    }

    function validateMobileFormat(mobile) {
        const re = /^[0-9]{10}$/;
        return re.test(mobile);
    }

    function showAlert(message) {
        errorMessageText.innerText = message;
        errorAlert.classList.remove('d-none');
        errorAlert.scrollIntoView({ behavior: 'smooth' });
    }

    function hideAlert() {
        errorAlert.classList.add('d-none');
    }

    // Dynamic Member Management
    addMemberBtn.addEventListener('click', () => {
        if (memberCount < maxMembers) {
            addMember();
        }
    });

    function addMember() {
        memberCount++;
        const id = memberCount;
        
        const memberHtml = `
            <div class="member-card position-relative" id="member-card-${id}">
                <div class="row g-3">
                    <div class="col-12 d-flex align-items-center mb-2">
                        <span class="badge bg-primary me-2 fs-6">Member #${id}</span>
                        ${id === 1 ? '<span class="badge bg-success fs-7"><i class="bi bi-shield-fill me-1"></i>Team Leader</span>' : ''}
                        ${id > minMembers ? `
                            <button type="button" class="btn btn-outline-danger btn-sm remove-member-btn" onclick="removeMemberCard(${id})">
                                <i class="bi bi-trash-fill"></i>
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="col-md-4">
                        <label class="form-label">Full Name <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" name="member_name_${id}" required placeholder="Name of Member ${id}">
                        <div class="invalid-feedback">Full name is required.</div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Register Number <span class="text-danger">*</span></label>
                        <input type="text" class="form-control member-reg-input" name="member_reg_${id}" required placeholder="Register / Roll Number" style="text-transform: uppercase;">
                        <div class="invalid-feedback">Unique register number is required.</div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Email ID <span class="text-danger">*</span></label>
                        <input type="email" class="form-control member-email-input" name="member_email_${id}" required placeholder="member${id}@college.edu">
                        <div class="invalid-feedback">Valid unique email is required.</div>
                    </div>
                    
                    <div class="col-md-4">
                        <label class="form-label">Mobile Number <span class="text-danger">*</span></label>
                        <input type="tel" class="form-control" name="member_mobile_${id}" required pattern="[0-9]{10}" placeholder="10-digit number">
                        <div class="invalid-feedback">10-digit mobile number required.</div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Alternate Mobile <span class="text-secondary">(Optional)</span></label>
                        <input type="tel" class="form-control" name="member_alt_mobile_${id}" pattern="[0-9]{10}" placeholder="10-digit alternate number">
                        <div class="invalid-feedback">Must be a valid 10-digit mobile.</div>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">Gender <span class="text-danger">*</span></label>
                        <select class="form-select" name="member_gender_${id}" required>
                            <option value="" selected disabled>Choose...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                        <div class="invalid-feedback">Select gender.</div>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">Residential Status <span class="text-danger">*</span></label>
                        <select class="form-select" name="member_residence_${id}" required>
                            <option value="" selected disabled>Choose...</option>
                            <option value="Hosteller">Hosteller</option>
                            <option value="Day Scholar">Day Scholar</option>
                        </select>
                        <div class="invalid-feedback">Select status.</div>
                    </div>
                </div>
            </div>
        `;
        
        membersWrapper.insertAdjacentHTML('beforeend', memberHtml);
        
        // Hide add button if maximum count is reached
        if (memberCount >= maxMembers) {
            addMemberBtn.style.display = 'none';
        }
    }

    // Global helper exposed to window for inline onclick remove button
    window.removeMemberCard = function(id) {
        const card = document.getElementById(`member-card-${id}`);
        if (card) {
            card.remove();
            memberCount--;
            
            // Re-index remaining members starting from ID 5 if any, to keep sequential names
            // Actually, to avoid breaking HTML naming sequence, let's keep track of cards.
            // A safer, robust approach: when a card is removed, we re-label/re-name remaining dynamic cards
            reindexMembers();
            
            // Show add button again
            if (memberCount < maxMembers) {
                addMemberBtn.style.display = 'inline-block';
            }
        }
    };

    function reindexMembers() {
        const cards = membersWrapper.querySelectorAll('.member-card');
        memberCount = 0;
        cards.forEach((card, idx) => {
            memberCount++;
            const newId = memberCount;
            
            card.id = `member-card-${newId}`;
            
            // Update badge text
            const badge = card.querySelector('.badge.bg-primary');
            badge.innerText = `Member #${newId}`;
            
            // Update Team Leader tag
            const leaderTag = card.querySelector('.badge.bg-success');
            if (newId === 1 && !leaderTag) {
                badge.insertAdjacentHTML('afterend', '<span class="badge bg-success fs-7 ms-2"><i class="bi bi-shield-fill me-1"></i>Team Leader</span>');
            } else if (newId !== 1 && leaderTag) {
                leaderTag.remove();
            }

            // Update remove button onclick
            const removeBtn = card.querySelector('.remove-member-btn');
            if (newId > minMembers) {
                if (!removeBtn) {
                    const removeBtnHtml = `
                        <button type="button" class="btn btn-outline-danger btn-sm remove-member-btn" onclick="removeMemberCard(${newId})">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    `;
                    card.querySelector('.col-12').insertAdjacentHTML('beforeend', removeBtnHtml);
                } else {
                    removeBtn.setAttribute('onclick', `removeMemberCard(${newId})`);
                }
            } else {
                if (removeBtn) removeBtn.remove();
            }
            
            // Update names of inputs
            card.querySelectorAll('input, select').forEach(input => {
                const name = input.name;
                const baseName = name.substring(0, name.lastIndexOf('_'));
                input.name = `${baseName}_${newId}`;
                
                // Update placeholder/labels if any
                if (input.placeholder && input.placeholder.includes('Member')) {
                    input.placeholder = input.placeholder.replace(/Member \d+/g, `Member ${newId}`);
                }
            });
        });
    }

    // Drag & Drop Functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        const validExtensions = ['.pdf', '.ppt', '.pptx'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const maxSize = 20 * 1024 * 1024; // 20 MB

        if (!validExtensions.includes(fileExtension)) {
            showFileError('Invalid file format. Only .pdf, .ppt, and .pptx files are allowed.');
            return;
        }

        if (file.size > maxSize) {
            showFileError('File too large. Maximum allowed size is 20 MB.');
            return;
        }

        // Successfully loaded file
        fileInput.files = files; // Sync input element
        fileError.style.display = 'none';
        
        // Populate and display selected file metadata
        selectedFileName.innerText = file.name;
        selectedFileSize.innerText = formatBytes(file.size);
        
        dropzone.classList.add('d-none');
        fileInfoBar.classList.remove('d-none');
    }

    function showFileError(message) {
        fileError.innerText = message;
        fileError.style.display = 'block';
        fileInput.value = ''; // Reset input
    }

    removeFileBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInfoBar.classList.add('d-none');
        dropzone.classList.remove('d-none');
    });

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Submit Action Validation
    form.addEventListener('submit', (e) => {
        let isFileSelected = fileInput.files.length > 0;
        
        if (!isFileSelected) {
            fileError.innerText = 'Project presentation file is required.';
            fileError.style.display = 'block';
            e.preventDefault();
            e.stopPropagation();
        }

        // Run general checkValidity
        if (!form.checkValidity() || !validateStep(currentStep)) {
            e.preventDefault();
            e.stopPropagation();
            showAlert('Please fix the errors in the form before submitting.');
        }
    });
});
