import nodemailer from 'nodemailer';

const getMailConfig = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535 || !SMTP_FROM) return null;
  if (Boolean(SMTP_USER) !== Boolean(SMTP_PASS)) return null;
  return { host: SMTP_HOST, port, secure: process.env.SMTP_SECURE === 'true', auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined, from: SMTP_FROM };
};

export const isMailConfigured = () => Boolean(getMailConfig());

const sendMail = async ({ to, subject, text, html }) => {
  const config = getMailConfig();
  if (!config) {
    console.log(`\n================== [DEV EMAIL] ==================`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${text}`);
    console.log(`=================================================\n`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: config.auth,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  await transporter.sendMail({ from: config.from, to, subject, text, html });
};

const appUrl = () => (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

export const sendVerificationEmail = (email, token) => {
  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: email,
    subject: 'Verify your EventPilot email',
    text: `Verify your email address to activate your EventPilot account: ${link}\n\nThis link expires in 24 hours.`,
    html: `<p>Verify your email address to activate your EventPilot account.</p><p><a href="${link}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
  });
};

export const sendPasswordResetEmail = (email, token) => {
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: email,
    subject: 'Reset your EventPilot password',
    text: `Reset your EventPilot password: ${link}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
    html: `<p>Reset your EventPilot password using the link below.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
  });
};
