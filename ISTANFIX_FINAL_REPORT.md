# ISTANFIX PROJECT FINAL REPORT

## 1. Project Overview

Istanfix is a database-driven information system designed to help users report and track public infrastructure problems across Istanbul. The system allows citizens to report issues like broken streetlights, potholes, and damaged benches, while government officials can update the status of these reports and communicate with users.

## 2. Detailed Requirements

### Functional Requirements

1. **User Management**
   - User registration with email and password
   - User authentication (login/logout)
   - Support for different user roles (regular users, government officials)
   - Government official verification using special code

2. **Report Management**
   - Create new infrastructure issue reports
   - Upload images for visual documentation of issues
   - View all reported issues with filtering options
   - Update report status (open, in-progress, resolved)
   - Delete reports (by report owner or government officials)

3. **Comment System**
   - Add comments to reports
   - View comments on reports
   - Delete comments (by comment owner or government officials)

4. **Location Services**
   - Capture geolocation coordinates for reports
   - Show report location on maps
   - Organize reports by district

5. **UI/UX Requirements**
   - Responsive design for mobile and desktop
   - Dark mode support
   - User-friendly interface with status indicators
   - Real-time feedback for user actions

### Non-Functional Requirements

1. **Security**
   - Password hashing
   - Input validation
   - Role-based access control
   - Secure file uploads

2. **Usability**
   - Intuitive navigation
   - Consistent design language
   - Proper form validation and error messaging

## 3. Database Design

### ER Diagram

```
+----------+       +-----------+       +-----------+
|   Users  |       |  Reports  |       | Comments  |
+----------+       +-----------+       +-----------+
| id (PK)  |<------|  user_id  |       | id (PK)   |
| name     |       |  id (PK)  |<------| report_id |
| email    |       |  category |       | user_id   |
| password |       |  district |       | content   |
| role     |       |  address  |       | created_at|
| created_at       |  description      +-----------+
+----------+       |  latitude |
                   |  longitude|
                   |  image_path|
                   |  status   |
                   |  created_at|
                   |  updated_at|
                   +-----------+
```

### Relational Schema

1. **Users Table**
   - `id` (Primary Key, Integer, Auto-increment)
   - `name` (Text, Not Null)
   - `email` (Text, Not Null, Unique)
   - `hashed_password` (Text, Not Null)
   - `profile_photo_url` (Text, Nullable)
   - `role` (Text, Not Null, Default 'user')
   - `created_at` (DateTime, Default Current Timestamp)

2. **Reports Table**
   - `id` (Primary Key, Integer, Auto-increment)
   - `user_id` (Foreign Key → Users.id, Nullable with cascade)
   - `category` (Text, Not Null)
   - `district` (Text, Not Null)
   - `address` (Text, Not Null)
   - `description` (Text, Not Null)
   - `latitude` (Real, Nullable)
   - `longitude` (Real, Nullable)
   - `image_path` (Text, Nullable)
   - `status` (Text, Not Null, Default 'open')
   - `created_at` (DateTime, Default Current Timestamp)
   - `updated_at` (DateTime, Default Current Timestamp)

3. **Comments Table**
   - `id` (Primary Key, Integer, Auto-increment)
   - `report_id` (Foreign Key → Reports.id, Not Null, Cascade)
   - `user_id` (Foreign Key → Users.id, Not Null, Cascade)
   - `content` (Text, Not Null)
   - `created_at` (DateTime, Default Current Timestamp)

### Functional Dependencies

**Users Table**
- id → name, email, hashed_password, profile_photo_url, role, created_at
- email → id (since email is unique)

**Reports Table**
- id → user_id, category, district, address, description, latitude, longitude, image_path, status, created_at, updated_at

**Comments Table**
- id → report_id, user_id, content, created_at

### Normalization Analysis

The database schema is already in Third Normal Form (3NF) because:

1. It's in 1NF: All attributes contain atomic values, and there are no repeating groups.
2. It's in 2NF: All non-key attributes are fully functionally dependent on their primary key.
3. It's in 3NF: No non-key attribute is transitively dependent on the primary key.

## 4. SQL Statements

### DDL (CREATE TABLE Statements)

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    profile_photo_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    district TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    image_path TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Triggers

```sql
CREATE TRIGGER IF NOT EXISTS update_reports_updated_at
AFTER UPDATE ON reports
FOR EACH ROW
BEGIN
    UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
```

### Sample SQL Queries

#### SELECT Queries

```sql
-- Get all reports with user info
SELECT r.*, u.name as user_name, u.profile_photo_url as user_photo_url 
FROM reports r
LEFT JOIN users u ON r.user_id = u.id
ORDER BY r.created_at DESC;

-- Get comments for a specific report
SELECT c.*, u.name as user_name, u.profile_photo_url as user_photo_url, u.role as user_role
FROM comments c
LEFT JOIN users u ON c.user_id = u.id
WHERE c.report_id = ?
ORDER BY c.created_at ASC;
```

#### INSERT Queries

```sql
-- Create a new user
INSERT INTO users (name, email, hashed_password, profile_photo_url, role) 
VALUES (?, ?, ?, ?, ?);

-- Create a new report
INSERT INTO reports (category, district, address, description, latitude, longitude, status, image_path, user_id) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- Add a comment
INSERT INTO comments (report_id, user_id, content)
VALUES (?, ?, ?);
```

#### UPDATE Queries

```sql
-- Update report status
UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;
```

#### DELETE Queries

```sql
-- Delete a report
DELETE FROM reports WHERE id = ?;

-- Delete a comment
DELETE FROM comments WHERE id = ?;
```

## 5. Application Architecture

### Frontend

The frontend of Istanfix uses a client-side rendered approach with vanilla JavaScript, HTML, and CSS. Key components include:

1. **Authentication Module**
   - Login/Signup forms
   - User session management using localStorage
   - Role-based UI elements

2. **Reports Module**
   - Report listing with filtering
   - Report creation form
   - Status updates
   - Image uploads
   - Geolocation capture

3. **Comments Module**
   - Comment listing for each report
   - Comment submission
   - Comment deletion

4. **UI Components**
   - Dark mode toggle
   - Responsive layout
   - Status indicators
   - User avatars

### Backend

The backend uses a Node.js Express server with the following components:

1. **API Endpoints**
   - Authentication endpoints
   - Report CRUD operations
   - Comment CRUD operations
   - Static file serving

2. **Database Layer**
   - SQLite database for persistent storage
   - Connection management
   - Query execution

3. **Middleware**
   - Authentication checking
   - File upload handling (Multer)
   - Error handling
   - Request parsing

### Data Flow

1. User submits a request via the frontend
2. Request is sent to the appropriate Express endpoint
3. Server processes the request, interacting with the SQLite database as needed
4. Response is sent back to the client
5. Frontend updates the UI based on the response

## 6. Technologies Used

### Frontend
- HTML5 for structure
- CSS3 for styling (with CSS variables for theming)
- Vanilla JavaScript for client-side logic
- LocalStorage for client-side data persistence

### Backend
- Node.js as the runtime environment
- Express.js as the web framework
- SQLite3 for the database
- bcryptjs for password hashing
- Multer for file upload handling

### Development Tools
- Git for version control
- npm for package management

## 7. Implemented Features

### User Management
- ✅ User registration
- ✅ User authentication
- ✅ Role-based permissions
- ✅ Government official verification

### Report Management
- ✅ Create reports
- ✅ View reports
- ✅ Update report status (government officials only)
- ✅ Delete reports (owners and government officials)
- ✅ Image uploads for reports

### Comments System
- ✅ Add comments to reports
- ✅ View comments on reports
- ✅ Delete comments

### UI/UX Features
- ✅ Responsive design
- ✅ Dark mode
- ✅ Intuitive navigation
- ✅ Status indicators

## 8. Future Enhancements

1. **Advanced Filtering**
   - Filter reports by date, status, and category
   - Search functionality for finding specific reports

2. **User Profiles**
   - Allow users to edit their profile information
   - Profile pages with user activity history

3. **Notifications**
   - Email notifications for status changes
   - In-app notification system

4. **Analytics**
   - Dashboard for government officials with statistics
   - Heatmaps showing problem hotspots

5. **Mobile App**
   - Native mobile applications for iOS and Android

## 9. Conclusion

The Istanfix project successfully implements a database-driven information system for reporting and tracking infrastructure issues in Istanbul. The application meets all core requirements with a clean, intuitive interface and robust backend functionality. The database design efficiently supports the application's data needs while maintaining proper normalization.

The implementation of role-based permissions and the comment system enhances communication between citizens and government officials, creating a more transparent and efficient process for addressing public infrastructure problems.

---

## Appendix: Database Diagram

```
┌─────────────────────┐         ┌──────────────────────┐         ┌─────────────────────┐
│        Users        │         │       Reports        │         │      Comments       │
├─────────────────────┤         ├──────────────────────┤         ├─────────────────────┤
│ id (PK)             │         │ id (PK)              │         │ id (PK)             │
│ name                │         │ user_id (FK)         │         │ report_id (FK)      │
│ email               │         │ category             │         │ user_id (FK)        │
│ hashed_password     │         │ district             │         │ content             │
│ profile_photo_url   │         │ address              │         │ created_at          │
│ role                │         │ description          │         └─────────────────────┘
│ created_at          │         │ latitude             │                  ▲
└─────────────────────┘         │ longitude            │                  │
         ▲                      │ image_path           │                  │
         │                      │ status               │                  │
         │                      │ created_at           │                  │
         │                      │ updated_at           │                  │
         └──────────────────────┼──────────────────────┘                  │
                               │                                          │
                               └──────────────────────────────────────────┘
``` 