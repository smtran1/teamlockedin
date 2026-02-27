require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

const reactDistPath = path.join(__dirname, 'frontend', 'dist');
const legacyPublicPath = path.join(__dirname, 'public');
const servingReactBuild = fs.existsSync(reactDistPath);

app.use(express.static(servingReactBuild ? reactDistPath : legacyPublicPath));


/////////////////////////////////////////////////
//HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////
// Helper function to create a MySQL connection
async function createConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
}

// **Authorization Middleware: Verify JWT Token and Check User in Database**
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token.' });
        }

        try {
            const connection = await createConnection();
            const normalizedEmail = String(decoded.email || '').trim().toLowerCase();

            // Query the database to verify that the email is associated with an active account
            const [rows] = await connection.execute(
                'SELECT email FROM user WHERE LOWER(email) = ?',
                [normalizedEmail]
            );

            await connection.end();  // Close connection

            if (rows.length === 0) {
                return res.status(403).json({ message: 'Account not found or deactivated.' });
            }

            req.user = decoded;  // Save the decoded email for use in the route
            next();  // Proceed to the next middleware or route handler
        } catch (dbError) {
            console.error(dbError);
            res.status(500).json({ message: 'Database error during authentication.' });
        }
    });
}
/////////////////////////////////////////////////
//END HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////


//////////////////////////////////////
//ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////
// Route: Create Account
app.post('/api/create-account', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const connection = await createConnection();
        const hashedPassword = await bcrypt.hash(password, 10);  // Hash password

        const [result] = await connection.execute(
            'INSERT INTO user (email, password) VALUES (?, ?)',
            [normalizedEmail, hashedPassword]
        );

        await connection.end();  // Close connection

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ message: 'An account with this email already exists.' });
        } else {
            console.error(error);
            res.status(500).json({ message: 'Error creating account.' });
        }
    }
});

// Route: Logon
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const connection = await createConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM user WHERE LOWER(email) = ?',
                [normalizedEmail]
            );

            if (rows.length === 0) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }

            const user = rows[0];
            const storedPassword = String(user.password || '');
            const looksHashed = storedPassword.startsWith('$2a$')
                || storedPassword.startsWith('$2b$')
                || storedPassword.startsWith('$2y$');

            let isPasswordValid = false;
            let shouldRehash = false;

            if (looksHashed) {
                isPasswordValid = await bcrypt.compare(password, storedPassword);
            } else {
                // Backward compatibility for legacy plaintext passwords.
                isPasswordValid = password === storedPassword;
                shouldRehash = isPasswordValid;
            }

            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }

            if (shouldRehash) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await connection.execute(
                    'UPDATE user SET password = ? WHERE email = ?',
                    [hashedPassword, user.email]
                );
            }

            const token = jwt.sign(
                { email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.status(200).json({ token });
        } finally {
            await connection.end();  // Close connection
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});

// Route: Get All Email Addresses
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute('SELECT email FROM user');

        await connection.end();  // Close connection

        const emailList = rows.map((row) => row.email);
        res.status(200).json({ emails: emailList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving email addresses.' });
    }
});

// Route: Verify current user token
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    res.status(200).json({ email: req.user.email });
});
//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////

if (servingReactBuild) {
    // SPA fallback: return React app for all non-API routes.
    app.get('*', (req, res) => {
        res.sendFile(path.join(reactDistPath, 'index.html'));
    });
}


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
