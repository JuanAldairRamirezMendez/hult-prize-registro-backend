const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

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

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Backend funcionando');
});

// Ruta para registro
app.post('/registro', async (req, res) => {
  const { teamName, leaderName, email, phone, members, projectName, category, description } = req.body;

  try {
    const query = `
      INSERT INTO registros (team_name, leader_name, email, phone, members, project_name, category, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [teamName, leaderName, email, phone, members, projectName, category, description];

    const result = await pool.query(query, values);
    res.status(201).json({ message: 'Registro exitoso', data: result.rows[0] });
  } catch (error) {
    console.error('Error al registrar:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});