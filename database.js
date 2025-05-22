const sqlite3 = require('sqlite3').verbose();
const DB_PATH = './istanfix.db'; // Database file will be created in the root directory

// Connect to SQLite database. 
// The database will be created if it doesn't exist.
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the Istanfix SQLite database.');
        db.serialize(() => {
            // For development: drop tables to easily apply schema changes.
            // In production, use migrations.
            // db.run("DROP TABLE IF EXISTS reports");
            // db.run("DROP TABLE IF EXISTS users");
            
            createUsersTable();
            createReportsTable();
            enableForeignKeys();
        });
    }
});

function enableForeignKeys() {
    db.run("PRAGMA foreign_keys = ON;", (err) => {
        if (err) {
            console.error("Error enabling foreign keys:", err.message);
        } else {
            console.log("Foreign key support enabled.");
        }
    });
}

function createUsersTable() {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            profile_photo_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;
    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating users table', err.message);
        } else {
            console.log('Users table created or already exists.');
        }
    });
}

function createReportsTable() {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            district TEXT NOT NULL,
            address TEXT NOT NULL,
            description TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            image_path TEXT,                          -- Path to an uploaded image (optional)
            status TEXT NOT NULL DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,                          -- Foreign key to the users table
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL -- If user is deleted, set user_id to NULL
        );
    `;

    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Error creating reports table', err.message);
        } else {
            console.log('Reports table (re)created or already exists with user_id foreign key.');
            // Trigger to update `updated_at` on row update (remains the same)
            const createTriggerSql = `
                CREATE TRIGGER IF NOT EXISTS update_reports_updated_at
                AFTER UPDATE ON reports
                FOR EACH ROW
                BEGIN
                    UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END;
            `;
            db.run(createTriggerSql, (triggerErr) => {
                if (triggerErr) {
                    console.error('Error creating updated_at trigger for reports', triggerErr.message);
                } else {
                    console.log('updated_at trigger for reports table created or already exists.');
                }
            });
        }
    });
}

module.exports = db; 