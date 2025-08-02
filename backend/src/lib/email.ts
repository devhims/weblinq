// Backend email implementation using pre-built HTML templates
// Templates are built at build time to avoid React-Email runtime issues in Cloudflare Workers

import nodemailer from 'nodemailer';

import { processPasswordResetTemplate } from '../emails/templates/password-reset';
import { processVerificationTemplate } from '../emails/templates/verification';
import { processWelcomeTemplate } from '../emails/templates/welcome';

/**
 * Send email via Resend HTTP API (more reliable in Cloudflare Workers than SMTP)
 */
async function sendViaResendAPI(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  replyTo?: string,
): Promise<{ messageId: string }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo && { reply_to: [replyTo] }),
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Resend API error: ${response.status} - ${errorData}`);
  }

  const result = (await response.json()) as { id: string };
  return { messageId: result.id };
}

interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * @deprecated Create Zoho SMTP transporter - DEPRECATED, use Resend instead
 * Kept for legacy compatibility but should not be used for new implementations
 */
function _createZohoTransporter(env: CloudflareBindings) {
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

    // Use Resend HTTP API (primary method)
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required for email sending');
    }

    const info = await sendViaResendAPI(
      env.RESEND_API_KEY,
      `"${appName}" <support@mail.weblinq.dev>`,
      userEmail,
      `Verify your email address - ${appName}`,
      html,
      text,
      'support@weblinq.dev',
    );

    console.log('✅ Verification email sent successfully via Resend HTTP API:', {
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

    // Use Resend HTTP API (primary method)
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required for email sending');
    }

    const info = await sendViaResendAPI(
      env.RESEND_API_KEY,
      `"${appName}" <support@mail.weblinq.dev>`,
      userEmail,
      `Reset your password - ${appName}`,
      html,
      text,
      'support@weblinq.dev',
    );

    console.log('✅ Password reset email sent successfully via Resend HTTP API:', {
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

    // Use Resend HTTP API (primary method - most reliable in Cloudflare Workers)
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required for email sending');
    }

    const info = await sendViaResendAPI(
      env.RESEND_API_KEY,
      `"${appName}" <support@mail.weblinq.dev>`,
      userEmail,
      `Welcome to ${appName}`,
      html,
      text,
      'support@weblinq.dev',
    );

    console.log('✅ Welcome email sent successfully via Resend HTTP API:', {
      to: userEmail,
      messageId: info.messageId,
      provider: 'Resend API',
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to send welcome email:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      userEmail,
      hasResendKey: !!env.RESEND_API_KEY,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
