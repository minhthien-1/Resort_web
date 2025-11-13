import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../test-db.js';

const router = express.Router();

// ===== LOGIN =====
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ INSERT với full_name:
    const query = `
      INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, username, email, full_name, phone, role
    `;

    const result = await pool.query(query, [
      username,
      email,
      hashedPassword,
      full_name,  // ← THÊM full_name
      phone || null,
      'guest'
    ]);

    const newUser = result.rows[0];
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: true,
      message: 'Register successful',
      token: token,
      user: newUser  // ← Trả về full_name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ===== REGISTER =====
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, password required' });
    }

    const existUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email, role',
      [username, email, password, full_name || '', phone || '', 'guest', true]
    );

    const newUser = result.rows[0];
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: true,
      message: 'Register successful',
      token: token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
