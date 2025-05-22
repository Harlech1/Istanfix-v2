const express = require('express');
const db = require('./database.js');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '.'))); // Serve files from the root directory

// --- Authentication API Endpoints ---

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, profile_photo_url } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ "error": "Name, email, and password are required." });
    }

    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ "error": "Invalid email format." });
    }

    // Check if user already exists
    const checkUserSql = "SELECT email FROM users WHERE email = ?";
    db.get(checkUserSql, [email], async (err, row) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (row) {
            return res.status(400).json({ "error": "Email already registered." });
        }

        // Hash password
        try {
            const hashedPassword = await bcrypt.hash(password, 10); // 10 is salt rounds
            const insertSql = 'INSERT INTO users (name, email, hashed_password, profile_photo_url) VALUES (?, ?, ?, ?)';
            const params = [name, email, hashedPassword, profile_photo_url || null];

            db.run(insertSql, params, function(err) {
                if (err) {
                    return res.status(500).json({ "error": err.message });
                }
                res.status(201).json({
                    "message": "User registered successfully",
                    "userId": this.lastID,
                    "email": email
                });
            });
        } catch (hashError) {
            res.status(500).json({ "error": "Error hashing password: " + hashError.message });
        }
    });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ "error": "Email and password are required." });
    }

    const sql = "SELECT * FROM users WHERE email = ?";
    db.get(sql, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (!user) {
            return res.status(400).json({ "error": "Invalid email or password." }); // Generic message for security
        }

        // Compare password
        try {
            const match = await bcrypt.compare(password, user.hashed_password);
            if (match) {
                // Passwords match, send back user info (excluding password)
                res.json({
                    "message": "Login successful",
                    "user": {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        profile_photo_url: user.profile_photo_url
                    }
                });
            } else {
                // Passwords don't match
                return res.status(400).json({ "error": "Invalid email or password." }); // Generic message
            }
        } catch (compareError) {
            res.status(500).json({ "error": "Error during password comparison: " + compareError.message });
        }
    });
});

// --- Reports API Endpoints (Modified) ---

// GET all reports (now includes user info)
app.get('/api/reports', (req, res) => {
    const sql = `
        SELECT r.*, u.name as user_name, u.profile_photo_url as user_photo_url 
        FROM reports r
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// POST a new report (now requires user_id)
app.post('/api/reports', (req, res) => {
    // user_id should come from the authenticated session on the client-side
    const { category, district, address, description, latitude, longitude, image_path, user_id } = req.body; 
    
    if (!category || !district || !address || !description || user_id === undefined) {
        return res.status(400).json({ "error": "Missing required fields: category, district, address, description, user_id." });
    }

    const lat = latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : null;
    const lon = longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : null;

    if ((latitude !== undefined && latitude !== null && latitude !== '' && isNaN(lat)) || 
        (longitude !== undefined && longitude !== null && longitude !== '' && isNaN(lon))) {
        return res.status(400).json({ "error": "Invalid latitude or longitude provided. Must be numbers." });
    }
    
    const sql = 'INSERT INTO reports (category, district, address, description, latitude, longitude, status, image_path, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [category, district, address, description, lat, lon, 'open', image_path || null, user_id]; 
    db.run(sql, params, function(err) {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        // Fetch the newly created report with user details to return it
        const newReportId = this.lastID;
        const selectNewReportSql = `
            SELECT r.*, u.name as user_name, u.profile_photo_url as user_photo_url 
            FROM reports r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        `;
        db.get(selectNewReportSql, [newReportId], (selectErr, newReport) => {
            if (selectErr) {
                return res.status(500).json({ "error": "Report created, but failed to fetch details: " + selectErr.message });
            }
            res.status(201).json({
                "message": "success",
                "data": newReport
            });
        });
    });
});

// PUT /api/reports/:id/status (Update report status - no major change needed for auth here, but user_id could be checked for ownership if desired)
app.put('/api/reports/:id/status', (req, res) => {
    const { status } = req.body;
    const reportId = req.params.id;

    if (!status || !['open', 'in-progress', 'resolved'].includes(status.toLowerCase())) {
        return res.status(400).json({ "error": 'Invalid status. Must be one of: open, in-progress, resolved' });
    }

    const sql = 'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    db.run(sql, [status.toLowerCase(), reportId], function(err) {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ "error": "Report not found" });
        }
        res.json({
            "message": "success",
            "data": { id: reportId, status: status.toLowerCase() }
        });
    });
});

// DELETE /api/reports/:id (Delete a report - no major change needed for auth here, but user_id could be checked for ownership or admin role)
app.delete('/api/reports/:id', (req, res) => {
    const reportId = req.params.id;
    const sql = 'DELETE FROM reports WHERE id = ?';
    db.run(sql, reportId, function(err) {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ "error": "Report not found" });
        }
        res.json({ "message": "deleted", "changes": this.changes });
    });
});

// Serve index.html for the root path, and other specific HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html')); // Default to login page
});
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/report.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'report.html'));
});
app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}. Make sure you have deleted istanfix.db if schema changed.`);
}); 