-- Crear tabla para registros
CREATE TABLE IF NOT EXISTS registros (
  id SERIAL PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  leader_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  members INTEGER,
  project_name VARCHAR(255),
  category VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);