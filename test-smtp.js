require('dotenv').config();
const nodemailer = require('nodemailer');

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

    console.log('Probing SMTP with:');
    console.log('  host=', process.env.SMTP_HOST);
    console.log('  port=', process.env.SMTP_PORT);
    console.log('  user=', process.env.SMTP_USER);

    await transporter.verify();
    console.log('SMTP OK: autenticación y conexión correctas');
  } catch (err) {
    console.error('SMTP verify error:');
    console.error(err);
    process.exitCode = 2;
  }
})();
