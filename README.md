# Backend para Registro Hult Prize

Este es un backend simple con Express.js para manejar el registro de proyectos desde el frontend Angular.

## Instalación

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   - El archivo `.env` ya está configurado con las credenciales de la base de datos de Render.

## Ejecutar

Para iniciar el servidor:
```bash
npm start
```

El servidor correrá en `http://localhost:3000` por defecto.

## Despliegue en Render

1. Crear un nuevo servicio web en [Render](https://render.com)
2. Conectar tu repositorio de GitHub
3. Seleccionar "Docker" como método de despliegue
4. Configurar las variables de entorno:
   - `DB_HOST`: dpg-d585j18gjchc739v9ng0-a.oregon-postgres.render.com
   - `DB_PORT`: 5432
   - `DB_NAME`: hult_prize
   - `DB_USER`: hult_prize_user
   - `DB_PASSWORD`: uCCIXqPoJ3bKFWkwWiTkikQ7B3PC17ti
   - `PORT`: 3000 (o el puerto que Render asigne)
5. El servicio se desplegará automáticamente

## Endpoints

- `GET /`: Ruta de prueba.
- `POST /registro`: Recibe los datos del formulario de registro y los guarda en la base de datos.

## Base de Datos

La tabla `registros` tiene los siguientes campos:
- id (SERIAL PRIMARY KEY)
- team_name
- leader_name
- email (UNIQUE)
- phone
- members
- project_name
- category
- description
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

## Despliegue

Para desplegar en producción, puedes usar servicios como Heroku, Vercel o Render. Asegúrate de configurar las variables de entorno en el servicio de despliegue.