require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json());

const reactDistPath = path.join(__dirname, 'frontend', 'dist');
const legacyPublicPath = path.join(__dirname, 'public');
const servingReactBuild = fs.existsSync(reactDistPath);

app.use(express.static(servingReactBuild ? reactDistPath : legacyPublicPath));

app.get('/', (req, res) => {
  res.redirect('/logon.html');
});

app.get('/dashboard', (req, res) => {
  res.redirect('/dashboard.html');
});

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

function isPasswordComplex(password) {
  return typeof password === 'string' && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeOptionalString(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function parseOptionalSalary(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : Number.NaN;
}

function validateApplicationPayload(payload, rawBody = {}) {
  const errors = [];

  if (!payload.job_title) errors.push('Job title is required.');
  if (!payload.company) errors.push('Company is required.');
  if (!payload.job_location) errors.push('Job location is required.');
  if (!payload.position_type) errors.push('Position type is required.');
  if (!payload.job_status) errors.push('Job status is required.');

  if (payload.posting_date && Number.isNaN(Date.parse(payload.posting_date))) {
    errors.push('Posting date must be a valid date.');
  }

  if (payload.closing_date && Number.isNaN(Date.parse(payload.closing_date))) {
    errors.push('Closing date must be a valid date.');
  }

  if (payload.posting_date && payload.closing_date && payload.closing_date < payload.posting_date) {
    errors.push('Closing date cannot be earlier than posting date.');
  }

  if (Number.isNaN(payload.job_salary)) {
    errors.push('Salary must be numeric.');
  }

  if (rawBody.salary_hourly !== undefined && typeof rawBody.salary_hourly !== 'boolean') {
    errors.push('salary_hourly must be a boolean.');
  }

  if (payload.job_url) {
    try {
      new URL(payload.job_url);
    } catch {
      errors.push('Job URL must be a valid link.');
    }
  }

  return errors;
}

function toApplicationRecord(body, email) {
  return {
    email,
    job_title: String(body.job_title || '').trim(),
    company: String(body.company || '').trim(),
    job_location: String(body.job_location || '').trim(),
    position_type: String(body.position_type || '').trim(),
    posting_date: normalizeOptionalDate(body.posting_date),
    closing_date: normalizeOptionalDate(body.closing_date),
    job_status: String(body.job_status || '').trim(),
    job_salary: parseOptionalSalary(body.job_salary),
    salary_hourly: body.salary_hourly === undefined ? false : body.salary_hourly,
    job_url: normalizeOptionalString(body.job_url),
    job_description: normalizeOptionalString(body.job_description),
    application_notes: normalizeOptionalString(body.application_notes),
  };
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    try {
      const connection = await createConnection();
      try {
        const normalizedEmail = normalizeEmail(decoded.email);
        const [rows] = await connection.execute(
          'SELECT email FROM user WHERE LOWER(email) = ?',
          [normalizedEmail],
        );

        if (rows.length === 0) {
          return res.status(401).json({ message: 'Account not found or deactivated.' });
        }

        req.user = {
          ...decoded,
          email: normalizedEmail,
          userId: decoded.userId || normalizedEmail,
        };
        next();
      } finally {
        await connection.end();
      }
    } catch (dbError) {
      console.error(dbError);
      res.status(500).json({ message: 'Database error during authentication.' });
    }
  });
}

app.post('/api/create-account', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  if (!isPasswordComplex(password)) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.',
    });
  }

  try {
    const connection = await createConnection();
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      await connection.execute(
        'INSERT INTO user (email, password) VALUES (?, ?)',
        [normalizedEmail, hashedPassword],
      );
      res.status(201).json({ message: 'Account created successfully!' });
    } finally {
      await connection.end();
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'An account with this email already exists.' });
    } else {
      console.error(error);
      res.status(500).json({ message: 'Error creating account.' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const connection = await createConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM user WHERE LOWER(email) = ?',
        [normalizedEmail],
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
          [hashedPassword, user.email],
        );
      }

      const token = jwt.sign(
        { email: user.email, userId: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
      );

      res.status(200).json({ token });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error logging in.' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const connection = await createConnection();
    try {
      const [rows] = await connection.execute('SELECT email FROM user');
      res.status(200).json({ emails: rows.map((row) => row.email) });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving email addresses.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.status(200).json({ email: req.user.email });
});

app.get('/api/jobs', authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);

  try {
    const connection = await createConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT
          application_id,
          email,
          job_title,
          company,
          job_location,
          position_type,
          posting_date,
          closing_date,
          job_status,
          job_salary,
          salary_hourly,
          job_url,
          job_description,
          application_notes
        FROM application
        WHERE LOWER(email) = ?
        ORDER BY application_id DESC`,
        [email],
      );

      res.status(200).json({ applications: rows });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    const detail = error.sqlMessage || error.message;
    res.status(500).json({ message: detail ? `Error retrieving applications: ${detail}` : 'Error retrieving applications.' });
  }
});

app.post('/api/jobs', authenticateToken, async (req, res) => {
  const userId = normalizeEmail(req.user.userId || req.user.email);
  const application = toApplicationRecord(req.body, userId);
  const validationErrors = validateApplicationPayload(application, req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({ message: validationErrors[0], errors: validationErrors });
  }

  try {
    const connection = await createConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO application (
          email,
          job_title,
          company,
          job_location,
          position_type,
          posting_date,
          closing_date,
          job_status,
          job_salary,
          salary_hourly,
          job_url,
          job_description,
          application_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          application.email,
          application.job_title,
          application.company,
          application.job_location,
          application.position_type,
          application.posting_date,
          application.closing_date,
          application.job_status,
          application.job_salary,
          application.salary_hourly,
          application.job_url,
          application.job_description,
          application.application_notes,
        ],
      );

      const createdJob = {
        application_id: result.insertId,
        ...application,
      };

      res.status(201).json({
        job: createdJob,
        application: createdJob,
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating application.' });
  }
});

app.put('/api/jobs/:applicationId', authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);
  const applicationId = Number(req.params.applicationId);

  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ message: 'Invalid application id.' });
  }

  const application = toApplicationRecord(req.body, email);
  const validationErrors = validateApplicationPayload(application, req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({ message: validationErrors[0], errors: validationErrors });
  }

  try {
    const connection = await createConnection();
    try {
      const [result] = await connection.execute(
        `UPDATE application
        SET
          job_title = ?,
          company = ?,
          job_location = ?,
          position_type = ?,
          posting_date = ?,
          closing_date = ?,
          job_status = ?,
          job_salary = ?,
          salary_hourly = ?,
          job_url = ?,
          job_description = ?,
          application_notes = ?
        WHERE application_id = ? AND LOWER(email) = ?`,
        [
          application.job_title,
          application.company,
          application.job_location,
          application.position_type,
          application.posting_date,
          application.closing_date,
          application.job_status,
          application.job_salary,
          application.salary_hourly,
          application.job_url,
          application.job_description,
          application.application_notes,
          applicationId,
          email,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Application not found.' });
      }

      res.status(200).json({
        application: {
          application_id: applicationId,
          ...application,
        },
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating application.' });
  }
});

app.delete('/api/jobs/:applicationId', authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);
  const applicationId = Number(req.params.applicationId);

  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ message: 'Invalid application id.' });
  }

  try {
    const connection = await createConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM application WHERE application_id = ? AND LOWER(email) = ?',
        [applicationId, email],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Application not found.' });
      }

      res.status(204).send();
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting application.' });
  }
});

if (servingReactBuild) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(reactDistPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
