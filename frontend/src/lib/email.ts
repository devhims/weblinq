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

// React Email Template Functions
export const sendVerificationEmail = async (
  verificationUrl: string,
  userEmail: string,
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
  userEmail: string,
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
