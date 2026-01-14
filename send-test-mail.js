require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

(async ()=>{
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const to = process.argv[2] || 'u20201597@utp.edu.pe';

    // Cargar plantilla si existe
    let htmlBody = null;
    try {
      const tplPath = path.join(__dirname, 'templates', 'welcome.html');
      htmlBody = fs.readFileSync(tplPath, 'utf8');
      htmlBody = htmlBody.replace(/{{leaderName}}/g, '')
                         .replace(/{{teamName}}/g, '')
                         .replace(/{{projectName}}/g, '')
                         .replace(/{{frontendUrl}}/g, process.env.FRONTEND_URL || 'http://localhost:4200');
    } catch (e) {
      htmlBody = null;
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject: 'Bienvenido a Hult Prize UTP',
      text: 'Bienvenido a Hult Prize UTP. Gracias por registrarte.',
      html: htmlBody || '<p>Bienvenido a Hult Prize UTP. Gracias por registrarte.</p>'
    };

    console.log('Enviando correo a', to);
    const info = await transporter.sendMail(mailOptions);
    console.log('Enviado:', info.messageId);
  } catch (err) {
    console.error('Error enviando correo:');
    console.error(err);
    process.exitCode = 3;
  }
})();
