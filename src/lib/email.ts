import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const from = process.env.EMAIL_FROM || "noreply@digitalcallboard.com";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local[0]}***@${domain}`;
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  try {
    await transporter.sendMail({ from, to, subject, text, html });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      message: "Failed to send email",
      to: maskEmail(to),
      subject,
    }));
  }
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
  const text = `Click this link to verify your email: ${url}\n\nThis link expires in 24 hours.`;
  const html = `<p>Click this link to verify your email: <a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`;
  await sendEmail(to, "Verify your email — Digital Call Board", text, html);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  const text = `Click this link to reset your password: ${url}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`;
  const html = `<p>Click this link to reset your password: <a href="${url}">${url}</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`;
  await sendEmail(to, "Reset your password — Digital Call Board", text, html);
}

export async function sendLockoutEmail(to: string) {
  const text = "Your account has been temporarily locked due to too many failed login attempts. It will automatically unlock in 30 minutes. If this wasn't you, reset your password.";
  const html = `<p>${text}</p>`;
  await sendEmail(to, "Account locked — Digital Call Board", text, html);
}
