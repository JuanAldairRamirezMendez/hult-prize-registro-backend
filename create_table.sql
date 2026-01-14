-- Crear tabla para administradores (admins)
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla para sponsors
CREATE TABLE IF NOT EXISTS sponsors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  website VARCHAR(255),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Crear tabla para registros
CREATE TABLE IF NOT EXISTS registros (
  id SERIAL PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  leader_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  members INTEGER,
  project_name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Tabla normalizada de categorías
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla intermedia para la relación muchos-a-muchos entre registros y categorías
CREATE TABLE IF NOT EXISTS registro_categorias (
  registro_id INTEGER NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  PRIMARY KEY (registro_id, categoria_id)
);

-- Tabla para verificaciones de código de estudiante
CREATE TABLE IF NOT EXISTS student_verifications (
  id SERIAL PRIMARY KEY,
  registro_id INTEGER REFERENCES registros(id) ON DELETE CASCADE,
  student_code VARCHAR(64) NOT NULL,
  student_email VARCHAR(255) NOT NULL,
  verification_token VARCHAR(255),
  sent_at TIMESTAMP,
  verified_at TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_student_code ON student_verifications(student_code);

-- Si necesita migrar datos existentes desde la columna antigua `category` (ejemplo):
-- 1) Crear temporalmente la tabla `categorias` y poblarla con valores únicos.
-- 2) Insertar relaciones en `registro_categorias` convirtiendo valores CSV en filas.
-- Ejemplo (comentar/descomentar y adaptar según formato actual):
-- INSERT INTO categorias (name)
-- SELECT DISTINCT trim(value) FROM (
--   SELECT unnest(string_to_array(category, ',')) AS value FROM registros WHERE category IS NOT NULL
-- ) s;
--
-- INSERT INTO registro_categorias (registro_id, categoria_id)
-- SELECT r.id, c.id
-- FROM registros r
-- JOIN LATERAL unnest(string_to_array(r.category, ',')) AS cat(name) ON true
-- JOIN categorias c ON trim(cat.name) = c.name
-- WHERE r.category IS NOT NULL;

-- Nota: tras migrar, asegúrese de eliminar/ignorar la columna antigua `category` si existiera en la tabla de producción.