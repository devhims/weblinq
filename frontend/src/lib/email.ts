import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import VerificationEmail from '@/emails/verification-email';
import PasswordResetEmail from '@/emails/password-reset-email';

const isProd = process.env.NODE_ENV === 'production';

// Create transporter with Zoho SMTP settings
const transporter = nodemailer.createTransport({
  host: process.env.ZOHO_EMAIL_HOST || 'smtp.zoho.in',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.ZOHO_EMAIL_USER!,
    pass: process.env.ZOHO_EMAIL_PASSWORD!,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (options: SendEmailOptions) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'WebLink'}" <${
        process.env.ZOHO_EMAIL_USER
      }>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

interface SendReactEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
}

export const sendReactEmail = async ({
  to,
  subject,
  react,
}: SendReactEmailOptions) => {
  const html = await render(react);
  const text = await render(react, { plainText: true });

  return sendEmail({ to, subject, html, text });
};

// Email templates
export const getVerificationEmailTemplate = (
  verificationUrl: string,
  userEmail: string
) => {
  const appName = process.env.APP_NAME || 'WebLink';
  const baseUrl = isProd ? 'https://www.weblinq.dev' : 'http://localhost:3000';

  // Extract token from Better Auth URL and create our custom verification URL
  const urlParams = new URL(verificationUrl);
  const token = urlParams.searchParams.get('token');
  const customVerificationUrl = `${baseUrl}/api/verify?token=${token}`;

  return {
    subject: `Verify your email address - ${appName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 40px 20px; }
            .verification-box { background-color: #fff7ed; border: 2px solid #f97316; border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0; }
            .btn { display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
            .btn:hover { opacity: 0.9; }
            .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #666; }
            .security-note { background-color: #fef7cd; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName}</h1>
              <p style="color: #fed7aa; margin: 10px 0 0 0; font-size: 16px;">Email Verification Required</p>
            </div>
            
            <div class="content">
              <h2 style="color: #1f2937; margin: 0 0 20px 0;">Welcome to ${appName}!</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for signing up! To complete your registration and secure your account, please verify your email address by clicking the button below.
              </p>
              
              <div class="verification-box">
                <h3 style="color: #1f2937; margin: 0 0 15px 0;">Email Address to Verify:</h3>
                <p style="font-size: 18px; font-weight: 600; color: #f97316; margin: 0;">${userEmail}</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${customVerificationUrl}" class="btn">Verify Email Address</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                If the button doesn't work, you can copy and paste this link into your browser:
                <br>
                <a href="${customVerificationUrl}" style="color: #f97316; word-break: break-all;">${customVerificationUrl}</a>
              </p>
              
              <div class="security-note">
                <strong>Security Note:</strong> This verification link will expire in 1 hour for your security. If you didn't create an account with ${appName}, please ignore this email.
              </div>
            </div>
            
            <div class="footer">
              <p>This email was sent to ${userEmail}</p>
              <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
              <p>
                <a href="${baseUrl}" style="color: #667eea; text-decoration: none;">Visit our website</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to ${appName}!

Thank you for signing up! To complete your registration and secure your account, please verify your email address.

Email to verify: ${userEmail}

Verification link: ${customVerificationUrl}

This verification link will expire in 1 hour for your security. If you didn't create an account with ${appName}, please ignore this email.

© ${new Date().getFullYear()} ${appName}. All rights reserved.
Visit our website: ${baseUrl}
    `.trim(),
  };
};

// React Email Template Functions
export const sendVerificationEmail = async (
  verificationUrl: string,
  userEmail: string
) => {
  const appName = process.env.APP_NAME || 'WebLink';

  // Extract token from Better Auth URL and create our custom verification URL
  const urlParams = new URL(verificationUrl);
  const token = urlParams.searchParams.get('token');
  const baseUrl = isProd ? 'https://www.weblinq.dev' : 'http://localhost:3000';
  const customVerificationUrl = `${baseUrl}/api/verify?token=${token}`;

  const emailElement = VerificationEmail({
    verificationUrl: customVerificationUrl,
    userEmail,
    appName,
  });

  return sendReactEmail({
    to: userEmail,
    subject: `Verify your email address - ${appName}`,
    react: emailElement,
  });
};

export const sendPasswordResetEmail = async (
  resetUrl: string,
  userEmail: string
) => {
  const appName = process.env.APP_NAME || 'WebLink';

  const emailElement = PasswordResetEmail({
    resetUrl,
    userEmail,
    appName,
  });

  return sendReactEmail({
    to: userEmail,
    subject: `Reset your password - ${appName}`,
    react: emailElement,
  });
};

export const getPasswordResetEmailTemplate = (
  resetUrl: string,
  userEmail: string
) => {
  const appName = process.env.APP_NAME || 'WebLink';
  const baseUrl = isProd ? 'https://www.weblinq.dev' : 'http://localhost:3000';

  return {
    subject: `Reset your password - ${appName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 40px 20px; }
            .reset-box { background-color: #fef7cd; border: 2px solid #f59e0b; border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0; }
            .btn { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
            .btn:hover { opacity: 0.9; }
            .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #666; }
            .security-note { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName}</h1>
              <p style="color: #fed7aa; margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
            </div>
            
            <div class="content">
              <h2 style="color: #1f2937; margin: 0 0 20px 0;">Reset Your Password</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                We received a request to reset the password for your ${appName} account. Click the button below to create a new password.
              </p>
              
              <div class="reset-box">
                <h3 style="color: #1f2937; margin: 0 0 15px 0;">Account Email:</h3>
                <p style="font-size: 18px; font-weight: 600; color: #d97706; margin: 0;">${userEmail}</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="btn">Reset Password</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                If the button doesn't work, you can copy and paste this link into your browser:
                <br>
                <a href="${resetUrl}" style="color: #f59e0b; word-break: break-all;">${resetUrl}</a>
              </p>
              
              <div class="security-note">
                <strong>Security Notice:</strong> This password reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
              </div>
            </div>
            
            <div class="footer">
              <p>This email was sent to ${userEmail}</p>
              <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
              <p>
                <a href="${baseUrl}" style="color: #f59e0b; text-decoration: none;">Visit our website</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Password Reset Request - ${appName}

We received a request to reset the password for your ${appName} account.

Account Email: ${userEmail}

Reset your password: ${resetUrl}

This password reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.

© ${new Date().getFullYear()} ${appName}. All rights reserved.
Visit our website: ${baseUrl}
    `.trim(),
  };
};
