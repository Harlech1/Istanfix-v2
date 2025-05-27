console.log("Istanfix script loaded.");

document.addEventListener('DOMContentLoaded', () => {
    const APP_USER_STORAGE_KEY = 'istanfix_user';
    const DARK_MODE_STORAGE_KEY = 'istanfix_dark_mode';
    const currentPath = window.location.pathname.split("/").pop();
    const publicPages = ['login.html', 'signup.html'];

    // --- Dark Mode Implementation ---
    function initDarkMode() {
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            // Check if user has a preference stored
            const isDarkMode = localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true';
            
            // Apply initial dark mode state
            if (isDarkMode) {
                document.body.classList.add('dark-mode');
            }
            
            // Add event listener for the toggle
            darkModeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const isDarkModeNow = document.body.classList.contains('dark-mode');
                localStorage.setItem(DARK_MODE_STORAGE_KEY, isDarkModeNow);
            });
        }
    }
    
    // Initialize dark mode
    initDarkMode();

    function getLoggedInUser() {
        const userJson = localStorage.getItem(APP_USER_STORAGE_KEY);
        return userJson ? JSON.parse(userJson) : null;
    }

    const loggedInUser = getLoggedInUser();

    // Auth Guard: Redirect to login if not on a public page and not logged in
    if (!publicPages.includes(currentPath) && !loggedInUser) {
        window.location.href = 'login.html';
        return; // Stop script execution for this page
    }
    // Redirect to index if on login/signup but already logged in
    if (publicPages.includes(currentPath) && loggedInUser) {
        window.location.href = 'index.html';
        return;
    }

    // --- UI Elements --- (Define them after auth check)
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const reportForm = document.getElementById('new-report-form');
    const reportsList = document.getElementById('reports-list');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatusEl = document.getElementById('locationStatus');
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');
    const loggedInUserDisplay = document.getElementById('logged-in-user');
    const logoutButton = document.getElementById('logout-button');

    // --- Header User Info & Logout --- 
    if (loggedInUser && loggedInUserDisplay) {
        let userDisplayText = `Logged in as: ${loggedInUser.name}`;
        // Add role badge for government officials
        if (loggedInUser.role === 'government') {
            userDisplayText += ' 🏛️ (Government Official)';
        }
        
        loggedInUserDisplay.textContent = userDisplayText;
    }
    if (logoutButton) {
        logoutButton.style.display = loggedInUser ? 'inline-block' : 'none'; // Show only if logged in
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem(APP_USER_STORAGE_KEY);
            alert('Logged out successfully!');
            window.location.href = 'login.html';
        });
    }

    // --- Signup Form Handler ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = event.target.name.value;
            const email = event.target.email.value;
            const password = event.target.password.value;
            const role = event.target.role.value;
            const govVerificationCode = role === 'government' ? event.target.gov_verification_code.value : null;

            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name, 
                        email, 
                        password, 
                        role,
                        gov_verification_code: govVerificationCode
                    })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Signup failed');
                }
                alert('Signup successful! Please login.');
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Signup error:', error);
                alert(`Signup failed: ${error.message}`);
            }
        });
    }

    // --- Login Form Handler ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = event.target.email.value;
            const password = event.target.password.value;
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Login failed');
                }
                localStorage.setItem(APP_USER_STORAGE_KEY, JSON.stringify(data.user));
                alert('Login successful!');
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Login error:', error);
                alert(`Login failed: ${error.message}`);
            }
        });
    }
    
    // --- Geolocation Handler (report.html) ---
    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                locationStatusEl.textContent = 'Fetching location...';
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        if(latitudeInput) latitudeInput.value = lat;
                        if(longitudeInput) longitudeInput.value = lon;
                        locationStatusEl.textContent = `Location captured: Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
                        getLocationBtn.disabled = true;
                    },
                    (error) => {
                        console.error("Error getting location:", error);
                        let message = 'Error getting location.';
                        switch (error.code) {
                            case error.PERMISSION_DENIED: message = "User denied Geolocation."; break;
                            case error.POSITION_UNAVAILABLE: message = "Location unavailable."; break;
                            case error.TIMEOUT: message = "Location request timed out."; break;
                            default: message = "Unknown location error."; break;
                        }
                        locationStatusEl.textContent = message; alert(message);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            } else {
                const msg = "Geolocation not supported by this browser.";
                locationStatusEl.textContent = msg; alert(msg);
            }
        });
    }

    // --- New Report Form Handler (report.html) ---
    if (reportForm) {
        reportForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            if (!loggedInUser) {
                alert("You must be logged in to submit a report.");
                window.location.href = 'login.html';
                return;
            }

            // Create FormData object to handle file uploads
            const formData = new FormData();
            
            // Add text fields to the form data
            formData.append('category', event.target.category.value);
            formData.append('district', event.target.district.value);
            formData.append('address', event.target.address.value);
            formData.append('description', event.target.description.value);
            formData.append('user_id', loggedInUser.id);
            
            // Add location coordinates if available
            if (latitudeInput && latitudeInput.value && !isNaN(parseFloat(latitudeInput.value))) {
                formData.append('latitude', latitudeInput.value);
            }
            if (longitudeInput && longitudeInput.value && !isNaN(parseFloat(longitudeInput.value))) {
                formData.append('longitude', longitudeInput.value);
            }
            
            // Add the image file if provided
            const imageInput = event.target.image;
            if (imageInput && imageInput.files && imageInput.files[0]) {
                formData.append('image', imageInput.files[0]);
            }

            try {
                const response = await fetch('/api/reports', {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to submit report');
                }
                alert('Report submitted successfully!');
                reportForm.reset();
                if (locationStatusEl) locationStatusEl.textContent = '';
                if (getLocationBtn) getLocationBtn.disabled = false;
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Error submitting report:', error);
                alert(`Error: ${error.message}`);
            }
        });
    }

    // --- Display Reports (index.html) ---
    if (reportsList) {
        displayReports();
    }

    async function displayReports() {
        try {
            const response = await fetch('/api/reports');
            if (!response.ok) throw new Error('Failed to fetch reports');
            const result = await response.json();
            const reports = result.data;

            reportsList.innerHTML = '<h2>📋 Reported Issues</h2>';
            if (!reports || reports.length === 0) {
                reportsList.innerHTML += '<p>No reports yet. Be the first to <a href="report.html">add one</a>!</p>';
                return;
            }

            // Category emoji mapping
            const categoryEmojis = {
                'pothole': '🕳️',
                'streetlight': '💡',
                'bench': '🪑',
                'trash': '🗑️',
                'other': '🔧'
            };
            
            // Status emoji mapping
            const statusEmojis = {
                'open': '🔴',
                'in-progress': '🟠',
                'resolved': '✅'
            };

            const ul = document.createElement('ul');
            ul.className = 'reports-container';
            reports.forEach(report => {
                const li = document.createElement('li');
                li.className = 'report-item';
                
                // Get category emoji or default
                const categoryEmoji = categoryEmojis[report.category] || '🔧';
                
                // Get status emoji or default
                const statusEmoji = statusEmojis[report.status] || '❓';
                
                let locationHTML = '';
                if (report.latitude && report.longitude) {
                    locationHTML = `<p><strong>📍 Location:</strong> Lat: ${parseFloat(report.latitude).toFixed(5)}, Lon: ${parseFloat(report.longitude).toFixed(5)} 
                                    (<a href="https://www.google.com/maps?q=${report.latitude},${report.longitude}" target="_blank">View on Map</a>)</p>`;
                }

                let userInfoHTML = '';
                if (report.user_name) {
                    userInfoHTML = `<p class="report-user"><strong>👤 Reported by:</strong> ${report.user_name}</p>`;
                } else {
                    userInfoHTML = `<p class="report-user"><strong>👤 Reported by:</strong> Anonymous (user data unavailable)</p>`;
                }
                
                // Add image HTML if the report has an image
                let imageHTML = '';
                if (report.image_path) {
                    imageHTML = `
                    <div class="report-image">
                        <img src="${report.image_path}" alt="Report Image">
                    </div>`;
                }
                
                // Build action buttons based on user role/ownership
                let actionButtons = '';
                if (loggedInUser) {
                    const isOwner = loggedInUser.id === report.user_id;
                    const isGovernment = loggedInUser.role === 'government';
                    
                    // Only government officials can update status
                    if (isGovernment) {
                        actionButtons += `
                            <button onclick="editReportStatus(${report.id}, '${report.status}')">
                                <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                Update Status
                            </button>`;
                    }
                    
                    // Show delete button only for owners or government officials
                    if (isOwner || isGovernment) {
                        actionButtons += `
                            <button onclick="deleteReport(${report.id})">
                                <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                                Delete
                            </button>`;
                    }
                }
                
                // Create a flex container with two columns
                li.innerHTML = `
                    <div class="report-layout">
                        <div class="report-details">
                            <h3>${categoryEmoji} ${report.category.charAt(0).toUpperCase() + report.category.slice(1)} Issue</h3>
                            ${userInfoHTML}
                            ${imageHTML}
                            <p><strong>🏙️ District:</strong> ${report.district}</p>
                            <p><strong>📮 Address:</strong> ${report.address}</p>
                            ${locationHTML}
                            <p><strong>📝 Description:</strong> ${report.description}</p>
                            <p><strong>🗓️ Reported:</strong> ${new Date(report.created_at).toLocaleString()}</p>
                            <p><strong>🔔 Status:</strong> <span class="status status-${report.status}">${statusEmoji} ${report.status.toUpperCase()}</span></p>
                            <p><small>🕒 Last updated: ${new Date(report.updated_at).toLocaleString()}</small></p>
                            <div class="report-item-actions">
                                ${actionButtons}
                            </div>
                        </div>
                        
                        <!-- Comments Section (Side Column) -->
                        <div class="comments-section" id="comments-section-${report.id}">
                            <h4>💬 Comments</h4>
                            <div class="comments-container" id="comments-container-${report.id}">
                                <p class="loading-comments">Loading comments...</p>
                            </div>
                            
                            ${loggedInUser ? `
                                <div class="add-comment-form">
                                    <textarea id="comment-input-${report.id}" placeholder="Add your comment here..." rows="1"></textarea>
                                    <button onclick="addComment(${report.id})">
                                        Send
                                    </button>
                                </div>
                            ` : '<p class="login-to-comment"><a href="login.html">Login</a> to add comments</p>'}
                        </div>
                    </div>
                `;
                ul.appendChild(li);
                
                // Load comments for this report
                loadComments(report.id);
            });
            reportsList.appendChild(ul);
        } catch (error) {
            console.error('Error fetching reports:', error);
            reportsList.innerHTML = '<h2>📋 Reported Issues</h2><p>❌ Error loading reports. Please try again later.</p>';
        }
    }

    // --- Edit Report Status (Global Function) ---
    window.editReportStatus = async function(reportId, currentStatus) {
        if (!loggedInUser) { 
            alert("Please login to edit reports."); 
            return; 
        }
        
        // Check if user is a government official
        if (loggedInUser.role !== 'government') {
            alert("Only government officials can update the status of reports.");
            return;
        }
        
        const newStatus = prompt(`Enter new status for report (current: ${currentStatus}):\n(open, in-progress, resolved)`, currentStatus);
        if (newStatus && ['open', 'in-progress', 'resolved'].includes(newStatus.toLowerCase())) {
            if (newStatus.toLowerCase() === currentStatus) {
                alert('New status is same as current. No changes.'); 
                return;
            }
            try {
                const response = await fetch(`/api/reports/${reportId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        status: newStatus.toLowerCase(),
                        user_id: loggedInUser.id,
                        user_role: loggedInUser.role
                    }),
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Update failed');
                }
                alert('Report status updated!');
                displayReports();
            } catch (error) { 
                console.error('Update status error:', error); 
                alert(`Error: ${error.message}`); 
            }
        } else if (newStatus !== null) {
            alert('Invalid status. Use "open", "in-progress", or "resolved".');
        }
    }

    // --- Delete Report (Global Function) ---
    window.deleteReport = async function(reportId) {
        if (!loggedInUser) { alert("Please login to delete reports."); return; }
        
        if (confirm('Are you sure you want to delete this report?')) {
            try {
                const response = await fetch(`/api/reports/${reportId}`, { 
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        user_id: loggedInUser.id,
                        user_role: loggedInUser.role
                    }),
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Delete failed');
                }
                alert('Report deleted!');
                displayReports();
            } catch (error) { console.error('Delete error:', error); alert(`Error: ${error.message}`); }
        }
    }

    // --- Load Comments Function ---
    async function loadComments(reportId) {
        try {
            const response = await fetch(`/api/reports/${reportId}/comments`);
            if (!response.ok) throw new Error('Failed to fetch comments');
            const result = await response.json();
            const comments = result.data;
            
            const commentsContainer = document.getElementById(`comments-container-${reportId}`);
            
            if (!comments || comments.length === 0) {
                commentsContainer.innerHTML = '<p class="no-comments">No comments yet. Be the first to add one!</p>';
                return;
            }
            
            let commentsHTML = '';
            comments.forEach(comment => {
                const isOwner = loggedInUser && loggedInUser.id === comment.user_id;
                const isGovernment = loggedInUser && loggedInUser.role === 'government';
                const canDelete = isOwner || isGovernment;
                
                let userDisplay = 'Anonymous';
                if (comment.user_name) {
                    userDisplay = comment.user_name;
                    if (comment.user_role === 'government') {
                        userDisplay += ' 🏛️ (Government Official)';
                    }
                }
                
                commentsHTML += `
                    <div class="comment-item" id="comment-${comment.id}">
                        <div class="comment-header">
                            <span class="comment-author">${userDisplay}</span>
                            <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                            ${canDelete ? `
                                <button class="delete-comment-btn" onclick="deleteComment(${comment.id})">
                                    <svg class="icon-small" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                                </button>
                            ` : ''}
                        </div>
                        <div class="comment-content">${comment.content}</div>
                    </div>
                `;
            });
            
            commentsContainer.innerHTML = commentsHTML;
        } catch (error) {
            console.error(`Error loading comments for report ${reportId}:`, error);
            document.getElementById(`comments-container-${reportId}`).innerHTML = 
                '<p class="error-loading">Error loading comments. Please try again later.</p>';
        }
    }
    
    // --- Add Comment (Global Function) ---
    window.addComment = async function(reportId) {
        if (!loggedInUser) {
            alert("Please login to add comments.");
            window.location.href = 'login.html';
            return;
        }
        
        const commentInput = document.getElementById(`comment-input-${reportId}`);
        const commentContent = commentInput.value.trim();
        
        if (!commentContent) {
            alert("Comment cannot be empty.");
            return;
        }
        
        try {
            const response = await fetch(`/api/reports/${reportId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: commentContent,
                    user_id: loggedInUser.id
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add comment');
            }
            
            // Clear the input field
            commentInput.value = '';
            
            // Reload comments to show the new one
            loadComments(reportId);
        } catch (error) {
            console.error('Error adding comment:', error);
            alert(`Error: ${error.message}`);
        }
    };
    
    // --- Delete Comment (Global Function) ---
    window.deleteComment = async function(commentId) {
        if (!loggedInUser) {
            alert("Please login to delete comments.");
            return;
        }
        
        if (confirm('Are you sure you want to delete this comment?')) {
            try {
                const response = await fetch(`/api/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: loggedInUser.id,
                        user_role: loggedInUser.role
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to delete comment');
                }
                
                // Remove the comment from the UI
                const commentElement = document.getElementById(`comment-${commentId}`);
                if (commentElement) {
                    commentElement.remove();
                    
                    // Check if there are any comments left
                    const commentsContainer = commentElement.parentNode;
                    if (commentsContainer && commentsContainer.children.length === 0) {
                        commentsContainer.innerHTML = '<p class="no-comments">No comments yet. Be the first to add one!</p>';
                    }
                }
            } catch (error) {
                console.error('Error deleting comment:', error);
                alert(`Error: ${error.message}`);
            }
        }
    };
});

console.log("Istanfix script loaded. Real auth system active."); 