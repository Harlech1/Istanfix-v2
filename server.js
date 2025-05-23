const express = require('express');
const db = require('./database.js');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for handling file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Create a unique filename with timestamp and original extension
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
        cb(null, fileName);
    }
});

// Only allow images (jpg, jpeg, png, webp)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB file size limit
    }
});

// Middleware
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '.'))); // Serve files from the root directory

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Authentication API Endpoints ---

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, profile_photo_url, role, gov_verification_code } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ "error": "Name, email, and password are required." });
    }

    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ "error": "Invalid email format." });
    }
    
    // Role validation (default to 'user' if not specified)
    let userRole = role || 'user';
    
    // If trying to register as government official, verify the code
    // Simple verification for demo - in production use more secure methods
    const GOV_VERIFICATION_CODE = "IST2023GOV"; // This would be stored securely in a real app
    if (userRole === 'government' && gov_verification_code !== GOV_VERIFICATION_CODE) {
        return res.status(403).json({ "error": "Invalid government verification code." });
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
            const insertSql = 'INSERT INTO users (name, email, hashed_password, profile_photo_url, role) VALUES (?, ?, ?, ?, ?)';
            const params = [name, email, hashedPassword, profile_photo_url || null, userRole];

            db.run(insertSql, params, function(err) {
                if (err) {
                    return res.status(500).json({ "error": err.message });
                }
                res.status(201).json({
                    "message": "User registered successfully",
                    "userId": this.lastID,
                    "email": email,
                    "role": userRole
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
                        profile_photo_url: user.profile_photo_url,
                        role: user.role // Include role in response
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

// POST a new report with image upload
app.post('/api/reports', upload.single('image'), (req, res) => {
    // Handle the form data which is now in req.body
    const { category, district, address, description, latitude, longitude, user_id } = req.body; 
    
    if (!category || !district || !address || !description || user_id === undefined) {
        return res.status(400).json({ "error": "Missing required fields: category, district, address, description, user_id." });
    }

    const lat = latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : null;
    const lon = longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : null;

    if ((latitude !== undefined && latitude !== null && latitude !== '' && isNaN(lat)) || 
        (longitude !== undefined && longitude !== null && longitude !== '' && isNaN(lon))) {
        return res.status(400).json({ "error": "Invalid latitude or longitude provided. Must be numbers." });
    }
    
    // Get the file path if an image was uploaded
    let imagePath = null;
    if (req.file) {
        imagePath = `/uploads/${req.file.filename}`;
    }
    
    const sql = 'INSERT INTO reports (category, district, address, description, latitude, longitude, status, image_path, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [category, district, address, description, lat, lon, 'open', imagePath, user_id]; 
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

// PUT /api/reports/:id/status (Update report status with role-based permissions)
app.put('/api/reports/:id/status', (req, res) => {
    const { status, user_id, user_role } = req.body;
    const reportId = req.params.id;

    // Only government officials can update status
    if (user_role !== 'government') {
        return res.status(403).json({ "error": "Permission denied. Only government officials can update the status of reports." });
    }

    if (!status || !['open', 'in-progress', 'resolved'].includes(status.toLowerCase())) {
        return res.status(400).json({ "error": 'Invalid status. Must be one of: open, in-progress, resolved' });
    }

    // Check if report exists
    const getReportSql = 'SELECT id FROM reports WHERE id = ?';
    db.get(getReportSql, [reportId], (err, report) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (!report) {
            return res.status(404).json({ "error": "Report not found" });
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
});

// DELETE /api/reports/:id (Delete a report with role-based permissions)
app.delete('/api/reports/:id', (req, res) => {
    const reportId = req.params.id;
    const { user_id, user_role } = req.body;

    // Check permissions: First get the report to see who owns it
    const getReportSql = 'SELECT user_id FROM reports WHERE id = ?';
    db.get(getReportSql, [reportId], (err, report) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        if (!report) {
            return res.status(404).json({ "error": "Report not found" });
        }

        // Permission check: Allow if user is the owner or a government official
        if (user_id !== report.user_id && user_role !== 'government') {
            return res.status(403).json({ "error": "Permission denied. Only report owners and government officials can delete reports." });
        }

        const sql = 'DELETE FROM reports WHERE id = ?';
        db.run(sql, reportId, function(err) {
            if (err) {
                return res.status(500).json({ "error": err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ "error": "Report not found" });
            }
            res.json({
                "message": "success",
                "data": { id: reportId, deleted: true }
            });
        });
    });
});

// --- Comments API Endpoints ---

// GET /api/reports/:reportId/comments (Get all comments for a report)
app.get('/api/reports/:reportId/comments', (req, res) => {
    const reportId = req.params.reportId;
    
    const sql = `
        SELECT c.*, u.name as user_name, u.profile_photo_url as user_photo_url, u.role as user_role
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.report_id = ?
        ORDER BY c.created_at ASC
    `;
    
    db.all(sql, [reportId], (err, rows) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// POST /api/reports/:reportId/comments (Add a comment to a report)
app.post('/api/reports/:reportId/comments', (req, res) => {
    const reportId = req.params.reportId;
    const { content, user_id } = req.body;
    
    if (!content || content.trim() === '') {
        return res.status(400).json({ "error": "Comment content cannot be empty." });
    }
    
    if (!user_id) {
        return res.status(400).json({ "error": "User ID is required." });
    }
    
    // First check if the report exists
    db.get('SELECT id FROM reports WHERE id = ?', [reportId], (err, report) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        
        if (!report) {
            return res.status(404).json({ "error": "Report not found" });
        }
        
        // Then check if user exists
        db.get('SELECT id FROM users WHERE id = ?', [user_id], (err, user) => {
            if (err) {
                return res.status(500).json({ "error": err.message });
            }
            
            if (!user) {
                return res.status(404).json({ "error": "User not found" });
            }
            
            // If both report and user exist, add the comment
            const sql = `
                INSERT INTO comments (report_id, user_id, content)
                VALUES (?, ?, ?)
            `;
            
            db.run(sql, [reportId, user_id, content.trim()], function(err) {
                if (err) {
                    return res.status(500).json({ "error": err.message });
                }
                
                // Fetch the newly created comment with user details
                const commentId = this.lastID;
                const selectCommentSql = `
                    SELECT c.*, u.name as user_name, u.profile_photo_url as user_photo_url, u.role as user_role
                    FROM comments c
                    LEFT JOIN users u ON c.user_id = u.id
                    WHERE c.id = ?
                `;
                
                db.get(selectCommentSql, [commentId], (err, comment) => {
                    if (err) {
                        return res.status(500).json({ "error": "Comment created, but failed to fetch details: " + err.message });
                    }
                    
                    res.status(201).json({
                        "message": "Comment added successfully",
                        "data": comment
                    });
                });
            });
        });
    });
});

// DELETE /api/comments/:commentId (Delete a comment)
app.delete('/api/comments/:commentId', (req, res) => {
    const commentId = req.params.commentId;
    const { user_id, user_role } = req.body;
    
    if (!user_id) {
        return res.status(400).json({ "error": "User ID is required." });
    }
    
    // Check if comment exists and get its details
    db.get('SELECT * FROM comments WHERE id = ?', [commentId], (err, comment) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        
        if (!comment) {
            return res.status(404).json({ "error": "Comment not found" });
        }
        
        // Check if user has permission to delete (comment owner or government official)
        if (comment.user_id !== user_id && user_role !== 'government') {
            return res.status(403).json({ "error": "Permission denied. Only comment owners and government officials can delete comments." });
        }
        
        // Delete the comment
        db.run('DELETE FROM comments WHERE id = ?', [commentId], function(err) {
            if (err) {
                return res.status(500).json({ "error": err.message });
            }
            
            res.json({
                "message": "Comment deleted successfully",
                "data": { id: commentId, deleted: true }
            });
        });
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