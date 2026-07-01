import "server-only";
import nodemailer from "nodemailer";

const port = Number(process.env.MAIL_PORT ?? 465);

export const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port,
  name: process.env.MAIL_NAME,
  // `secure: true` is required for port 465 (implicit TLS); 587 uses STARTTLS.
  secure: port === 465,
  // Reuse a warm SMTP connection so only the first send pays the handshake cost.
  pool: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    // Accept self-signed or invalid certificates when explicitly opted in.
    rejectUnauthorized: process.env.MAIL_ACCEPT_SELFSIGNED !== "true",
  },
});
