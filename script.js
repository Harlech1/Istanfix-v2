// JavaScript for Istanfix application will go here.
console.log("Istanfix script loaded.");

document.addEventListener('DOMContentLoaded', () => {
    const APP_USER_STORAGE_KEY = 'istanfix_user';
    const currentPath = window.location.pathname.split("/").pop();
    const publicPages = ['login.html', 'signup.html'];

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
        if (loggedInUser.profile_photo_url) {
            loggedInUserDisplay.innerHTML = `<img src="${loggedInUser.profile_photo_url}" alt="${loggedInUser.name}" style="width: 30px; height: 30px; border-radius: 50%; vertical-align: middle; margin-right: 8px;"> ${userDisplayText}`;
        } else {
            loggedInUserDisplay.textContent = userDisplayText;
        }
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
            const profile_photo_url = event.target.profile_photo_url.value;

            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, profile_photo_url })
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

            const reportData = {
                category: event.target.category.value,
                district: event.target.district.value,
                address: event.target.address.value,
                description: event.target.description.value,
                latitude: latitudeInput ? latitudeInput.value : null, 
                longitude: longitudeInput ? longitudeInput.value : null,
                user_id: loggedInUser.id, // Get user_id from logged-in user object
                // image_path: will be handled if we implement file uploads
            };
            
            if (reportData.latitude === "" || isNaN(parseFloat(reportData.latitude))) delete reportData.latitude;
            if (reportData.longitude === "" || isNaN(parseFloat(reportData.longitude))) delete reportData.longitude;

            try {
                const response = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reportData),
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

            reportsList.innerHTML = '<h2>Reported Issues</h2>';
            if (!reports || reports.length === 0) {
                reportsList.innerHTML += '<p>No reports yet. Be the first to <a href="report.html">add one</a>!</p>';
                return;
            }

            const ul = document.createElement('ul');
            ul.className = 'reports-container';
            reports.forEach(report => {
                const li = document.createElement('li');
                li.className = 'report-item';
                let locationHTML = '';
                if (report.latitude && report.longitude) {
                    locationHTML = `<p><strong>Location:</strong> Lat: ${parseFloat(report.latitude).toFixed(5)}, Lon: ${parseFloat(report.longitude).toFixed(5)} 
                                    (<a href="https://www.google.com/maps?q=${report.latitude},${report.longitude}" target="_blank">View on Map</a>)</p>`;
                }

                let userInfoHTML = '';
                if (report.user_name) {
                    userInfoHTML = `<p class="report-user">`;
                    if (report.user_profile_photo_url) {
                        userInfoHTML += `<img src="${report.user_profile_photo_url}" alt="${report.user_name}" class="user-avatar"> `;
                    }
                    userInfoHTML += `<strong>Reported by:</strong> ${report.user_name}</p>`;
                } else {
                    userInfoHTML = `<p class="report-user"><strong>Reported by:</strong> Anonymous (user data unavailable)</p>`;
                }
                
                li.innerHTML = `
                    <h3>${report.category.charAt(0).toUpperCase() + report.category.slice(1)} Issue</h3>
                    ${userInfoHTML}
                    <p><strong>District:</strong> ${report.district}</p>
                    <p><strong>Address:</strong> ${report.address}</p>
                    ${locationHTML}
                    <p><strong>Description:</strong> ${report.description}</p>
                    <p><strong>Reported:</strong> ${new Date(report.created_at).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="status status-${report.status}">${report.status.toUpperCase()}</span></p>
                    <p><small>Last updated: ${new Date(report.updated_at).toLocaleString()}</small></p>
                    <button onclick="editReportStatus(${report.id}, '${report.status}')">Update Status</button>
                    <button onclick="deleteReport(${report.id})">Delete</button>
                `;
                ul.appendChild(li);
            });
            reportsList.appendChild(ul);
        } catch (error) {
            console.error('Error fetching reports:', error);
            reportsList.innerHTML = '<h2>Reported Issues</h2><p>Error loading reports. Please try again later.</p>';
        }
    }

    // --- Edit Report Status (Global Function) ---
    window.editReportStatus = async function(reportId, currentStatus) {
        if (!loggedInUser) { alert("Please login to edit reports."); return; }
        // Further checks could be added here to see if loggedInUser.id === report.user_id for ownership
        const newStatus = prompt(`Enter new status for report (current: ${currentStatus}):\n(open, in-progress, resolved)`, currentStatus);
        if (newStatus && ['open', 'in-progress', 'resolved'].includes(newStatus.toLowerCase())) {
            if (newStatus.toLowerCase() === currentStatus) {
                alert('New status is same as current. No changes.'); return;
            }
            try {
                const response = await fetch(`/api/reports/${reportId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus.toLowerCase() }),
                });
                if (!response.ok) throw new Error((await response.json()).error || 'Update failed');
                alert('Report status updated!');
                displayReports();
            } catch (error) { console.error('Update status error:', error); alert(`Error: ${error.message}`); }
        } else if (newStatus !== null) {
            alert('Invalid status. Use "open", "in-progress", or "resolved".');
        }
    }

    // --- Delete Report (Global Function) ---
    window.deleteReport = async function(reportId) {
        if (!loggedInUser) { alert("Please login to delete reports."); return; }
        // Further checks for ownership or admin role would go here
        if (confirm('Are you sure you want to delete this report?')) {
            try {
                const response = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error((await response.json()).error || 'Delete failed');
                alert('Report deleted!');
                displayReports();
            } catch (error) { console.error('Delete error:', error); alert(`Error: ${error.message}`); }
        }
    }
});

console.log("Istanfix script loaded. Real auth system active."); 