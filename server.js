const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Crear servidor HTTP para Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Configuración de la base de datos
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false, // Para Render, ya que usa SSL
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Cargar plantilla de correo de bienvenida (si existe)
let welcomeTemplate = null;
try {
  const tplPath = path.join(__dirname, 'templates', 'welcome.html');
  welcomeTemplate = fs.readFileSync(tplPath, 'utf8');
} catch (e) {
  console.warn('No se encontró plantilla de bienvenida en templates/welcome.html, se usará texto simple');
}

// Configurar transporter de nodemailer usando variables de entorno
const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.SMTP_USER || process.env.FROM_EMAIL,
    pass: process.env.SMTP_PASS
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Backend funcionando');
});

// Ruta para registro
app.post('/registro', async (req, res) => {
  const { teamName, leaderName, email, phone, members, projectName, category, description } = req.body;

  // category expected as an array of category names (strings)
  try {
    // Begin transaction
    await pool.query('BEGIN');

    // Insert registro (no 'category' column anymore)
    const insertReg = `
      INSERT INTO registros (team_name, leader_name, email, phone, members, project_name, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [teamName, leaderName, email, phone, members, projectName, description];
    const result = await pool.query(insertReg, values);
    const registro = result.rows[0];

    // Handle categories: upsert into 'categorias' and link in 'registro_categorias'
    if (Array.isArray(category) && category.length > 0) {
      for (const rawName of category) {
        const name = String(rawName || '').trim();
        if (!name) continue;

        // Try insert, ignore conflict
        const insertCat = `INSERT INTO categorias (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`;
        let catRes = await pool.query(insertCat, [name]);
        let categoriaId = null;
        if (catRes.rows && catRes.rows.length > 0) {
          categoriaId = catRes.rows[0].id;
        } else {
          // If no returning row, the category existed already — fetch id
          const sel = await pool.query('SELECT id FROM categorias WHERE name=$1 LIMIT 1', [name]);
          if (sel.rows && sel.rows.length > 0) categoriaId = sel.rows[0].id;
        }

        if (categoriaId) {
          // Insert relation, ignore duplicates
          await pool.query(`INSERT INTO registro_categorias (registro_id, categoria_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [registro.id, categoriaId]);
        }
      }
    }

    await pool.query('COMMIT');

    // Emitir evento en tiempo real a clientes conectados
    io.emit('new-registration', registro);

    // Enviar correo(s) de bienvenida automáticamente (no bloquear la respuesta)
    (async () => {
      try {
        const recipients = [registro.email];
        const studentCode = req.body && req.body.studentCode;
        if (studentCode) {
          const studentEmail = `${String(studentCode).toLowerCase()}@utp.edu.pe`;
          if (!recipients.includes(studentEmail)) recipients.push(studentEmail);
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

        const htmlBody = welcomeTemplate
          ? welcomeTemplate.replace(/{{leaderName}}/g, registro.leader_name || '')
                           .replace(/{{teamName}}/g, registro.team_name || '')
                           .replace(/{{projectName}}/g, registro.project_name || '')
                           .replace(/{{frontendUrl}}/g, frontendUrl)
          : `<p>¡Bienvenido a Hult Prize UTP!</p><p>Hola ${registro.leader_name || ''}, gracias por registrarte con el equipo ${registro.team_name || ''}.</p>`;

        const mailOptions = {
          from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@hultprize.local',
          to: recipients.join(','),
          subject: 'Bienvenido a Hult Prize UTP',
          text: `Bienvenido a Hult Prize UTP. Hola ${registro.leader_name || ''}, gracias por registrarte con el equipo ${registro.team_name || ''}. Visita ${frontendUrl} para más información.`,
          html: htmlBody
        };

        await mailTransporter.sendMail(mailOptions);
        console.log('Welcome email(s) sent to:', recipients.join(', '));
      } catch (err) {
        console.error('Error sending welcome emails:', err);
      }
    })();

    res.status(201).json({ message: 'Registro exitoso', data: registro });
  } catch (error) {
    console.error('Error al registrar:', error);
    try { await pool.query('ROLLBACK'); } catch (e) { console.error('Rollback error', e); }
    // send original error if it's a DB error with detail
    res.status(500).json({ message: error?.message || 'Error en el servidor' });
  }
});

// Endpoint para obtener registros y conteo
app.get('/registrations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM registros ORDER BY id DESC LIMIT 100');
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM registros');
    res.json({ count: countRes.rows[0].count, items: result.rows });
  } catch (err) {
    console.error('Error fetching registrations', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Sponsors endpoints
app.post('/sponsors', async (req, res) => {
  const { name, contactName, email, phone, website, message } = req.body;
  if (!name || !contactName || !email) return res.status(400).json({ message: 'Faltan campos obligatorios' });
  try {
    const query = `
      INSERT INTO sponsors (name, contact_name, email, phone, website, message)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [name, contactName, email, phone, website, message];
    const result = await pool.query(query, values);
    const sponsor = result.rows[0];
    io.emit('new-sponsor', sponsor);
    res.status(201).json({ message: 'Sponsor creado', data: sponsor });
  } catch (err) {
    console.error('Error creating sponsor', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.get('/sponsors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sponsors ORDER BY id DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sponsors', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Endpoint para verificar código de estudiante y enviar correo
app.post('/verify-student', async (req, res) => {
  const { studentCode, studentEmail, registroId } = req.body || {};
  if (!studentCode || !studentEmail) return res.status(400).json({ message: 'Faltan campos studentCode o studentEmail' });

  const token = crypto.randomBytes(24).toString('hex');
  try {
    const insert = `INSERT INTO student_verifications (registro_id, student_code, student_email, verification_token, sent_at, verified, created_at)
                    VALUES ($1,$2,$3,$4, now(), false, now()) RETURNING *`;
    const values = [registroId || null, studentCode, studentEmail, token];
    const result = await pool.query(insert, values);
    const verification = result.rows[0];

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const verifyLink = `${frontendUrl.replace(/\/$/,'')}/verify-student?token=${token}`;

    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@hultprize.local',
      to: studentEmail,
      subject: 'Verificación de código de estudiante - Hult Prize UTP',
      text: `Hola,\n\nSe ha solicitado verificar el código de estudiante ${studentCode}. Usa este enlace para verificar: ${verifyLink}\n\nSi no solicitaste esto, ignora este correo.`,
      html: `<p>Hola,</p><p>Se ha solicitado verificar el código de estudiante <strong>${studentCode}</strong>. Haz clic en el siguiente enlace para verificar:</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>Si no solicitaste esto, ignora este correo.</p>`
    };

    // Enviar correo (no bloquear el flujo si falla el envío, pero devolver error)
    await mailTransporter.sendMail(mailOptions);

    res.status(201).json({ message: 'Correo de verificación enviado', data: verification });
  } catch (err) {
    console.error('Error verify-student:', err);
    res.status(500).json({ message: 'Error al procesar la verificación' });
  }
});

// Registrar administrador
app.post('/admin/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'Faltan campos' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO admins (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, role, created_at
    `;
    const values = [username, email, hash, role || 'admin'];
    const result = await pool.query(query, values);
    const admin = result.rows[0];
    res.status(201).json({ message: 'Administrador creado', data: admin });
  } catch (err) {
    console.error('Error creating admin', err);
    // Detect unique constraint violation (Postgres)
    if (err.code === '23505') {
      return res.status(409).json({ message: 'El usuario o email ya existe' });
    }
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Login administrador
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Faltan campos' });

  try {
    const result = await pool.query('SELECT * FROM admins WHERE email=$1', [email]);
    const admin = result.rows[0];
    if (!admin) return res.status(404).json({ message: 'No existe cuenta con ese email' });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ message: 'Autenticado', token });
  } catch (err) {
    console.error('Admin login error', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Middleware para rutas protegidas
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No autorizado' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'No autorizado' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido' });
  }
}

// Endpoint protegido: info del admin
app.get('/admin/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM admins WHERE id=$1', [req.admin.id]);
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Error admin/me', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor HTTP (con Socket.IO)
server.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});