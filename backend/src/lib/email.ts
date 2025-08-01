// Backend email implementation using pre-built HTML templates
// Templates are built at build time to avoid React-Email runtime issues in Cloudflare Workers

import nodemailer from 'nodemailer';

import { processPasswordResetTemplate } from '../emails/templates/password-reset';
import { processVerificationTemplate } from '../emails/templates/verification';
import { processWelcomeTemplate } from '../emails/templates/welcome';

interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Create nodemailer transporter with email provider settings
 * Supports Resend (preferred) and Zoho SMTP
 */
function createTransporter(env: CloudflareBindings) {
  // Prefer Resend if API key is available
  if (env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: true,
      auth: {
        user: 'resend',
        pass: env.RESEND_API_KEY,
      },
    });
  }

  // Fallback to Zoho
  return nodemailer.createTransport({
    host: env.ZOHO_EMAIL_HOST || 'smtp.zoho.in',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: env.ZOHO_EMAIL_USER!,
      pass: env.ZOHO_EMAIL_PASSWORD!,
    },
  });
}

/**
 * Send verification email using pre-built template
 */
export async function sendVerificationEmail(
  env: CloudflareBindings,
  verificationUrl: string,
  userEmail: string,
): Promise<SendEmailResponse> {
  try {
    // App configuration
    const appName = env.APP_NAME || 'WebLink';

    // Extract token from Better Auth URL and create custom verification URL
    const urlParams = new URL(verificationUrl);
    const token = urlParams.searchParams.get('token');

    // Use our custom verification route that handles redirects properly
    const customVerificationUrl = `${env.BETTER_AUTH_URL}/v1/user/verify-email-token?token=${token}`;

    // Process pre-built template with variables
    const { html, text } = processVerificationTemplate({
      verificationUrl: customVerificationUrl,
      userEmail,
      appName,
    });

    // Create transporter and send email
    const transporter = createTransporter(env);
    const fromEmail = env.RESEND_API_KEY ? 'support@weblinq.dev' : env.ZOHO_EMAIL_USER;
    const info = await transporter.sendMail({
      from: `"${appName}" <${fromEmail}>`,
      to: userEmail,
      subject: `Verify your email address - ${appName}`,
      text,
      html,
    });

    console.log('✅ Verification email sent successfully:', {
      to: userEmail,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send password reset email using pre-built template
 */
export async function sendPasswordResetEmail(
  env: CloudflareBindings,
  resetUrl: string,
  userEmail: string,
): Promise<SendEmailResponse> {
  try {
    // App configuration
    const appName = env.APP_NAME || 'WebLink';

    // Process pre-built template with variables
    const { html, text } = processPasswordResetTemplate({
      resetUrl,
      userEmail,
      appName,
    });

    // Create transporter and send email
    const transporter = createTransporter(env);
    const fromEmail = env.RESEND_API_KEY ? 'support@weblinq.dev' : env.ZOHO_EMAIL_USER;
    const info = await transporter.sendMail({
      from: `"${appName}" <${fromEmail}>`,
      to: userEmail,
      subject: `Reset your password - ${appName}`,
      text,
      html,
    });

    console.log('✅ Password reset email sent successfully:', {
      to: userEmail,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send welcome email using pre-built template
 */
export async function sendWelcomeEmail(
  env: CloudflareBindings,
  userEmail: string,
  firstName?: string,
): Promise<SendEmailResponse> {
  try {
    // App configuration
    const appName = env.APP_NAME || 'WebLinq';

    // Process pre-built template with variables
    const { html, text } = processWelcomeTemplate({
      userEmail,
      firstName: firstName || '',
      appName,
    });

    // Create transporter and send email
    const transporter = createTransporter(env);
    const fromEmail = env.RESEND_API_KEY ? 'support@weblinq.dev' : env.ZOHO_EMAIL_USER;
    const info = await transporter.sendMail({
      from: `"${appName}" <${fromEmail}>`,
      to: userEmail,
      subject: `Welcome to ${appName}`,
      text,
      html,
    });

    console.log('✅ Welcome email sent successfully:', {
      to: userEmail,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
