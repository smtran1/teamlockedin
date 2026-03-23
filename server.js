require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadsDir = path.join(__dirname, 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const timestamp = Date.now();
    cb(null, `${base}_${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
    cb(null, true);
  },
});

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

const POSITION_TYPE_MAP = {
  'full-time': 'Full-time',
  full_time: 'Full-time',
  'part-time': 'Part-time',
  part_time: 'Part-time',
  contractor: 'Contractor',
  internship: 'Internship',
};

const VALID_POSITION_TYPES = new Set(Object.values(POSITION_TYPE_MAP));

function parseApplicationIds(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
  } catch {
    return [];
  }
}

function normalizePositionType(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return POSITION_TYPE_MAP[normalized] || String(value ?? '').trim();
}

function validateApplicationPayload(payload, rawBody = {}) {
  const errors = [];

  if (!payload.job_title) errors.push('Job title is required.');
  if (!payload.company) errors.push('Company is required.');
  if (!payload.job_location) errors.push('Job location is required.');
  if (!payload.position_type) errors.push('Position type is required.');
  if (!payload.job_status) errors.push('Job status is required.');
  if (payload.position_type && !VALID_POSITION_TYPES.has(payload.position_type)) {
    errors.push('Position type must be Full-time, Part-time, Contractor, or Internship.');
  }

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
    position_type: normalizePositionType(body.position_type),
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
          a.application_id,
          a.email,
          a.job_title,
          a.company,
          a.job_location,
          a.position_type,
          a.posting_date,
          a.closing_date,
          a.job_status,
          a.job_salary,
          a.salary_hourly,
          a.job_url,
          a.job_description,
          a.application_notes,
          COUNT(ad.document_id) AS doc_count
        FROM application a
        LEFT JOIN application_document ad ON a.application_id = ad.application_id
        WHERE LOWER(a.email) = ?
        GROUP BY a.application_id
        ORDER BY a.application_id DESC`,
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

app.post('/api/documents', upload.single('file'), authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);

  if (!req.file) {
    return res.status(400).json({ message: 'A file is required.' });
  }

  const title = String(req.body.title || '').trim();
  const document_type = String(req.body.document_type || '').trim();
  const upload_date = String(req.body.upload_date || '').trim();
  const notes = normalizeOptionalString(req.body.notes);

  const application_ids = parseApplicationIds(req.body.application_ids);

  if (!title) return res.status(400).json({ message: 'Document title is required.' });
  if (!document_type) return res.status(400).json({ message: 'Document type is required.' });
  if (!upload_date || Number.isNaN(Date.parse(upload_date))) {
    return res.status(400).json({ message: 'A valid upload date is required.' });
  }

  const original_filename = req.file.originalname;
  const stored_filename = req.file.filename;
  const file_path = path.join('uploads', 'documents', req.file.filename);
  const file_size = req.file.size;
  const normalized_date = new Date(upload_date).toISOString().slice(0, 10);

  try {
    const connection = await createConnection();
    try {
      if (application_ids.length > 0) {
        const placeholders = application_ids.map(() => '?').join(', ');
        const [ownerCheck] = await connection.execute(
          `SELECT application_id FROM application WHERE application_id IN (${placeholders}) AND LOWER(email) = ?`,
          [...application_ids, email],
        );
        if (ownerCheck.length !== application_ids.length) {
          return res.status(403).json({ message: 'One or more applications not found or access denied.' });
        }
      }

      const [result] = await connection.execute(
        `INSERT INTO document (email, title, document_type, original_filename, stored_filename, file_path, file_size, upload_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [email, title, document_type, original_filename, stored_filename, file_path, file_size, normalized_date, notes],
      );

      const document_id = result.insertId;

      if (application_ids.length > 0) {
        const placeholders = application_ids.map(() => '(?, ?)').join(', ');
        const values = application_ids.flatMap((app_id) => [app_id, document_id]);
        await connection.execute(
          `INSERT INTO application_document (application_id, document_id) VALUES ${placeholders}`,
          values,
        );
      }

      res.status(201).json({
        document: {
          document_id,
          email,
          title,
          document_type,
          original_filename,
          stored_filename,
          file_path,
          file_size,
          upload_date: normalized_date,
          notes,
          application_ids: application_ids.join(',') || null,
        },
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    fs.unlink(path.join(__dirname, file_path), () => {});
    console.error(error);
    res.status(500).json({ message: 'Error uploading document.' });
  }
});

app.get('/api/documents', authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);
  const filterAppId = req.query.application_id ? Number(req.query.application_id) : null;

  if (filterAppId !== null && (!Number.isInteger(filterAppId) || filterAppId <= 0)) {
    return res.status(400).json({ message: 'Invalid application_id.' });
  }

  try {
    const connection = await createConnection();
    try {
      let query = `SELECT
          d.document_id,
          d.email,
          d.title,
          d.document_type,
          d.original_filename,
          d.file_size,
          d.upload_date,
          d.notes,
          GROUP_CONCAT(ad.application_id ORDER BY ad.application_id SEPARATOR ',') AS application_ids,
          GROUP_CONCAT(CONCAT(a.company, ' — ', a.job_title) ORDER BY ad.application_id SEPARATOR '\x1f') AS linked_applications
        FROM document d
        LEFT JOIN application_document ad ON d.document_id = ad.document_id
        LEFT JOIN application a ON ad.application_id = a.application_id AND LOWER(a.email) = ?
        WHERE LOWER(d.email) = ?`;
      const params = [email, email];

      if (filterAppId !== null) {
        query += ' AND d.document_id IN (SELECT document_id FROM application_document WHERE application_id = ?)';
        params.push(filterAppId);
      }

      query += ' GROUP BY d.document_id ORDER BY d.document_id DESC';

      const [rows] = await connection.execute(query, params);
      res.status(200).json({ documents: rows });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving documents.' });
  }
});

app.get('/api/documents/:documentId/file', authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);
  const documentId = Number(req.params.documentId);

  if (!Number.isInteger(documentId) || documentId <= 0) {
    return res.status(400).json({ message: 'Invalid document id.' });
  }

  try {
    const connection = await createConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT file_path, original_filename FROM document WHERE document_id = ? AND LOWER(email) = ?',
        [documentId, email],
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Document not found or access denied.' });
      }

      const { file_path, original_filename } = rows[0];
      const absolutePath = path.resolve(path.join(__dirname, file_path));
      const uploadDir = path.resolve(path.join(__dirname, 'uploads', 'documents'));

      if (!absolutePath.startsWith(uploadDir + path.sep)) {
        return res.status(400).json({ message: 'Invalid file path.' });
      }

      const safe_filename = original_filename.replace(/["\r\n]/g, '');
      res.setHeader('Content-Disposition', `inline; filename="${safe_filename}"`);
      res.sendFile(absolutePath);
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving file.' });
  }
});

app.put('/api/documents/:documentId', upload.single('file'), authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);
  const documentId = Number(req.params.documentId);

  if (!Number.isInteger(documentId) || documentId <= 0) {
    return res.status(400).json({ message: 'Invalid document id.' });
  }

  const title = String(req.body.title || '').trim();
  const document_type = String(req.body.document_type || '').trim();
  const upload_date = String(req.body.upload_date || '').trim();
  const notes = normalizeOptionalString(req.body.notes);

  const application_ids = parseApplicationIds(req.body.application_ids);

  if (!title) return res.status(400).json({ message: 'Document title is required.' });
  if (!document_type) return res.status(400).json({ message: 'Document type is required.' });
  if (!upload_date || Number.isNaN(Date.parse(upload_date))) {
    return res.status(400).json({ message: 'A valid upload date is required.' });
  }

  const normalized_date = new Date(upload_date).toISOString().slice(0, 10);

  try {
    const connection = await createConnection();
    try {
      const [existing] = await connection.execute(
        'SELECT file_path, original_filename, stored_filename FROM document WHERE document_id = ? AND LOWER(email) = ?',
        [documentId, email],
      );

      if (existing.length === 0) {
        return res.status(404).json({ message: 'Document not found or access denied.' });
      }

      if (application_ids.length > 0) {
        const placeholders = application_ids.map(() => '?').join(', ');
        const [ownerCheck] = await connection.execute(
          `SELECT application_id FROM application WHERE application_id IN (${placeholders}) AND LOWER(email) = ?`,
          [...application_ids, email],
        );
        if (ownerCheck.length !== application_ids.length) {
          return res.status(403).json({ message: 'One or more applications not found or access denied.' });
        }
      }

      let new_original_filename = existing[0].original_filename;
      let new_stored_filename = existing[0].stored_filename;
      let new_file_path = existing[0].file_path;
      let new_file_size = null;

      if (req.file) {
        new_original_filename = req.file.originalname;
        new_stored_filename = req.file.filename;
        new_file_path = path.join('uploads', 'documents', req.file.filename);
        new_file_size = req.file.size;
      }

      const [result] = await connection.execute(
        `UPDATE document
         SET title = ?, document_type = ?, original_filename = ?, stored_filename = ?,
             file_path = ?, file_size = COALESCE(?, file_size), upload_date = ?, notes = ?
         WHERE document_id = ? AND LOWER(email) = ?`,
        [title, document_type, new_original_filename, new_stored_filename,
         new_file_path, new_file_size, normalized_date, notes, documentId, email],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Document not found.' });
      }

      if (req.file) {
        fs.promises.unlink(path.join(__dirname, existing[0].file_path)).catch(() => {});
      }

      await connection.execute(
        'DELETE FROM application_document WHERE document_id = ?',
        [documentId],
      );

      if (application_ids.length > 0) {
        const placeholders = application_ids.map(() => '(?, ?)').join(', ');
        const values = application_ids.flatMap((app_id) => [app_id, documentId]);
        await connection.execute(
          `INSERT INTO application_document (application_id, document_id) VALUES ${placeholders}`,
          values,
        );
      }

      res.status(200).json({ message: 'Document updated successfully.' });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating document.' });
  }
});

app.delete('/api/documents/:documentId/applications/:applicationId', authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);
  const documentId = Number(req.params.documentId);
  const applicationId = Number(req.params.applicationId);

  if (!Number.isInteger(documentId) || documentId <= 0) {
    return res.status(400).json({ message: 'Invalid document id.' });
  }
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ message: 'Invalid application id.' });
  }

  try {
    const connection = await createConnection();
    try {
      const [docCheck] = await connection.execute(
        'SELECT document_id FROM document WHERE document_id = ? AND LOWER(email) = ?',
        [documentId, email],
      );
      if (docCheck.length === 0) {
        return res.status(404).json({ message: 'Document not found or access denied.' });
      }

      await connection.execute(
        'DELETE FROM application_document WHERE document_id = ? AND application_id = ?',
        [documentId, applicationId],
      );

      res.status(204).send();
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error unlinking document.' });
  }
});

app.delete('/api/documents/:documentId', authenticateToken, async (req, res) => {
  const email = normalizeEmail(req.user.email);
  const documentId = Number(req.params.documentId);

  if (!Number.isInteger(documentId) || documentId <= 0) {
    return res.status(400).json({ message: 'Invalid document id.' });
  }

  try {
    const connection = await createConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT file_path FROM document WHERE document_id = ? AND LOWER(email) = ?',
        [documentId, email],
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Document not found or access denied.' });
      }

      await connection.execute(
        'DELETE FROM document WHERE document_id = ? AND LOWER(email) = ?',
        [documentId, email],
      );

      const deletePath = path.resolve(path.join(__dirname, rows[0].file_path));
      const uploadDir = path.resolve(path.join(__dirname, 'uploads', 'documents'));
      if (deletePath.startsWith(uploadDir + path.sep)) {
        fs.promises.unlink(deletePath).catch(() => {});
      }

      res.status(204).send();
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting document.' });
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
