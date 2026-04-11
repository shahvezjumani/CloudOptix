import nodemailer from "nodemailer";
import { ApiError } from "../utils/index.js";
import config from "../config/index.js";

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: config.GOOGLE_USER,
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      refreshToken: config.GOOGLE_REFRESH_TOKEN,
    },
  });
};

/**
 * Send a verification email with an OTP code.
 * @param {string} to - Recipient email address
 * @param {string} otp - One-time passcode
 */
export const sendVerificationEmail = async (to, otp) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"CloudOptix" <${config.GOOGLE_USER}>`,
    to,
    subject: "Verify your email address",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Email Verification</h2>
        <p>Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0;color:#4f46e5">${otp}</div>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    throw new ApiError(
      500,
      `Failed to send verification email: ${err.message}`,
    );
  }
};

/**
 * Send a password-reset email with a reset link.
 * @param {string} to - Recipient email address
 * @param {string} resetLink - Password reset URL
 */
export const sendPasswordResetEmail = async (to, resetLink) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"CloudOptix" <${config.GOOGLE_USER}>`,
    to,
    subject: "Reset your password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Password Reset</h2>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;margin:16px 0">
          Reset Password
        </a>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
        <p style="font-size:12px;color:#6b7280">Or copy this link: ${resetLink}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    throw new ApiError(
      500,
      `Failed to send password reset email: ${err.message}`,
    );
  }
};

/**
 * Send a welcome email after successful registration.
 * @param {string} to - Recipient email address
 * @param {string} name - User's display name
 */
export const sendWelcomeEmail = async (to, name) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"CloudOptix" <${config.GOOGLE_USER}>`,
    to,
    subject: "Welcome to CloudOptix!",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Welcome, ${name}!</h2>
        <p>Your account has been created successfully. You can now upload, manage, and share your files securely.</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    throw new ApiError(500, `Failed to send welcome email: ${err.message}`);
  }
};
