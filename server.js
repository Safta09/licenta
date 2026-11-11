const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Conectare la PostgreSQL pe portul 5433
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'admin123', // Schimbă cu parola ta de la PostgreSQL
  port: 5433,
});

// Servim fișierul HTML pe pagina principală (http://localhost:3000)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint pentru Arduino R4 WiFi
app.post('/api/scan', async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'UID missing' });

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE uid = $1', [uid]);
    let accessGranted = false;
    let statusMessage = 'UNREGISTERED';
    let userName = 'Neinregistrat';

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      userName = user.name;
      if (user.is_active) {
        accessGranted = true;
        statusMessage = 'GRANTED';
      } else {
        accessGranted = false;
        statusMessage = 'DENIED';
      }
    }

    await pool.query(
      'INSERT INTO access_logs (uid, access_granted) VALUES ($1, $2)',
      [uid, accessGranted]
    );

    console.log(`[SCAN RFID] UID: ${uid} | User: ${userName} | Status: ${statusMessage}`);

    res.json({ status: statusMessage, name: userName });
  } catch (err) {
    console.error('Eroare Baza de Date:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Endpoint pentru Istoric (usat de index.html)
app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.id, l.uid, COALESCE(u.name, 'Neinregistrat') as name, l.access_granted, l.scanned_at
      FROM access_logs l
      LEFT JOIN users u ON l.uid = u.uid
      ORDER BY l.scanned_at DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Eroare SQL:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Server Backend pornit pe http://localhost:3000');
});