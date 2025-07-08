// Backend email implementation using pre-built HTML templates
// Templates are built at build time to avoid React-Email runtime issues in Cloudflare Workers

import nodemailer from 'nodemailer';

import { processPasswordResetTemplate } from '../emails/templates/password-reset';
import { processVerificationTemplate } from '../emails/templates/verification';

interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Create nodemailer transporter with Zoho SMTP settings
 */
function createTransporter(env: CloudflareBindings) {
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
    const info = await transporter.sendMail({
      from: `"${appName}" <${env.ZOHO_EMAIL_USER}>`,
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
    const info = await transporter.sendMail({
      from: `"${appName}" <${env.ZOHO_EMAIL_USER}>`,
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
