const nodemailer = require("nodemailer");

// Envio de e-mail via Gmail (grátis) — só funciona depois que EMAIL_USER e
// EMAIL_APP_PASSWORD forem configurados nas variáveis de ambiente do Railway.
// Enquanto não estiverem configuradas, o sistema não trava: só registra no log.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

async function enviarEmail(destino, assunto, texto) {
  if (!destino) return;
  const t = getTransporter();
  if (!t) {
    console.log(`[e-mail desativado — configure EMAIL_USER/EMAIL_APP_PASSWORD] Para: ${destino} | Assunto: ${assunto}`);
    return;
  }
  try {
    await t.sendMail({
      from: `"Espaço do Renascer" <${process.env.EMAIL_USER}>`,
      to: destino,
      subject: assunto,
      text: texto,
    });
  } catch (e) {
    console.error("Erro ao enviar e-mail:", e.message);
  }
}

module.exports = { enviarEmail };
