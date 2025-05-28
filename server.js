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
    const { name, email, password, role, gov_verification_code } = req.body;

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
    const GOV_VERIFICATION_CODE = "IST2025GOV";
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
            const insertSql = 'INSERT INTO users (name, email, hashed_password, role) VALUES (?, ?, ?, ?)';
            const params = [name, email, hashedPassword, userRole];

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
            return res.status(400).json({ "error": "Invalid email or password." });
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

// GET /api/categories - Get all categories
app.get('/api/categories', (req, res) => {
    const sql = 'SELECT * FROM categories ORDER BY name';
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

// GET /api/districts - Get all districts
app.get('/api/districts', (req, res) => {
    const sql = 'SELECT * FROM districts ORDER BY name';
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

// GET /api/neighborhoods - Get all neighborhoods
app.get('/api/neighborhoods', (req, res) => {
    const sql = `
        SELECT n.id, n.name, n.postal_code, n.district_id, d.name as district_name
        FROM neighborhoods n
        JOIN districts d ON n.district_id = d.id
        ORDER BY n.name
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

// GET /api/districts/:districtId/neighborhoods - Get neighborhoods by district
app.get('/api/districts/:districtId/neighborhoods', (req, res) => {
    const districtId = req.params.districtId;
    
    // Validate districtId is a number
    if (isNaN(parseInt(districtId))) {
        return res.status(400).json({ "error": "District ID must be a number." });
    }
    
    const sql = `
        SELECT n.id, n.name, n.postal_code, n.district_id, d.name as district_name
        FROM neighborhoods n
        JOIN districts d ON n.district_id = d.id
        WHERE n.district_id = ?
        ORDER BY n.name
    `;
    
    db.all(sql, [districtId], (err, rows) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// GET all reports (now includes user info and category details)
app.get('/api/reports', (req, res) => {
    const sql = `
        SELECT reports.*, users.name as user_name, 
               categories.name as category_name, categories.icon as category_icon,
               districts.name as district_name,
               n.name as neighborhood_name, n.postal_code
        FROM reports
        LEFT JOIN users ON reports.user_id = users.id
        LEFT JOIN categories ON reports.category_id = categories.id
        LEFT JOIN districts ON reports.district_id = districts.id
        LEFT JOIN neighborhoods n ON reports.neighborhood_id = n.id
        ORDER BY reports.created_at DESC
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

// GET reports by category_id
app.get('/api/reports/category/:categoryId', (req, res) => {
    const categoryId = req.params.categoryId;
    
    // Validate categoryId is a number
    if (isNaN(parseInt(categoryId))) {
        return res.status(400).json({ "error": "Category ID must be a number." });
    }
    
    const sql = `
        SELECT reports.*, users.name as user_name, categories.name as category_name, categories.icon as category_icon
        FROM reports
        LEFT JOIN users ON reports.user_id = users.id
        LEFT JOIN categories ON reports.category_id = categories.id
        WHERE reports.category_id = ?
        ORDER BY reports.created_at DESC
    `;
    
    db.all(sql, [categoryId], (err, rows) => {
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
    const { category_id, district_id, neighborhood_id, address, description, latitude, longitude, user_id } = req.body; 
    
    if (!category_id || !district_id || !address || !description || user_id === undefined) {
        return res.status(400).json({ "error": "Missing required fields: category_id, district_id, address, description, user_id." });
    }

    // Validate category_id and district_id
    if (isNaN(parseInt(category_id)) || isNaN(parseInt(district_id))) {
        return res.status(400).json({ "error": "category_id and district_id must be numbers." });
    }

    // Validate neighborhood_id if provided
    if (neighborhood_id && isNaN(parseInt(neighborhood_id))) {
        return res.status(400).json({ "error": "neighborhood_id must be a number." });
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
    
    // First check if the category and district exist
    db.get('SELECT id FROM categories WHERE id = ?', [category_id], (err, category) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        
        if (!category) {
            return res.status(404).json({ "error": "Category not found" });
        }
        
        db.get('SELECT id FROM districts WHERE id = ?', [district_id], (err, district) => {
            if (err) {
                return res.status(500).json({ "error": err.message });
            }
            
            if (!district) {
                return res.status(404).json({ "error": "District not found" });
            }
            
            // Check if neighborhood exists and belongs to the specified district
            if (neighborhood_id) {
                db.get('SELECT id FROM neighborhoods WHERE id = ? AND district_id = ?', [neighborhood_id, district_id], (err, neighborhood) => {
                    if (err) {
                        return res.status(500).json({ "error": err.message });
                    }
                    
                    if (!neighborhood) {
                        return res.status(404).json({ "error": "Neighborhood not found or does not belong to the specified district" });
                    }
                    
                    insertReport(category_id, district_id, neighborhood_id, address, description, lat, lon, imagePath, user_id, res);
                });
            } else {
                // No neighborhood specified, proceed with report creation
                insertReport(category_id, district_id, null, address, description, lat, lon, imagePath, user_id, res);
            }
        });
    });
});

function insertReport(category_id, district_id, neighborhood_id, address, description, lat, lon, imagePath, user_id, res) {
    // Define SQL query based on whether neighborhood_id is provided
    let sql, params;
    
    if (neighborhood_id) {
        sql = `INSERT INTO reports 
              (category_id, district_id, neighborhood_id, address, description, latitude, longitude, status, image_path, user_id) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [category_id, district_id, neighborhood_id, address, description, lat, lon, 'open', imagePath, user_id];
    } else {
        sql = `INSERT INTO reports 
              (category_id, district_id, address, description, latitude, longitude, status, image_path, user_id) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [category_id, district_id, address, description, lat, lon, 'open', imagePath, user_id];
    }
    
    db.run(sql, params, function(err) {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        // Fetch the newly created report with user details to return it
        const newReportId = this.lastID;
        const selectNewReportSql = `
            SELECT reports.*, users.name as user_name, 
                   categories.name as category_name, categories.icon as category_icon,
                   districts.name as district_name,
                   n.name as neighborhood_name, n.postal_code
            FROM reports
            LEFT JOIN users ON reports.user_id = users.id
            LEFT JOIN categories ON reports.category_id = categories.id
            LEFT JOIN districts ON reports.district_id = districts.id
            LEFT JOIN neighborhoods n ON reports.neighborhood_id = n.id
            WHERE reports.id = ?
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
}

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
    
    // Belirli bir rapora ait tüm yorumları kullanıcı bilgileriyle birlikte getirir
    // Önce yorumları (comments) alır, sonra her yorum için kullanıcı (users) bilgilerini ekler
    // Yorumlar oluşturulma tarihine göre artan sırada listelenir (eskiden yeniye)
    const sql = `
        SELECT comments.*, users.name as user_name, users.role as user_role
        FROM comments
        LEFT JOIN users ON comments.user_id = users.id
        WHERE comments.report_id = ?
        ORDER BY comments.created_at ASC
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
                    SELECT c.*, u.name as user_name, u.role as user_role
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