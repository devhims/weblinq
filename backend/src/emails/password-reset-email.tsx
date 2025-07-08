/* eslint-disable style/jsx-one-expression-per-line */
/** @jsxImportSource react */
import React from 'react';

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface PasswordResetEmailProps {
  resetUrl: string;
  userEmail: string;
  appName?: string;
}

// Clean, minimal styling matching app theme
const main = {
  backgroundColor: '#fafafa', // Light gray background
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  lineHeight: '1.6',
  color: '#374151', // Neutral gray text
};

const container = {
  backgroundColor: '#ffffff',
  maxWidth: '560px',
  margin: '40px auto',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
};

const header = {
  backgroundColor: '#ffffff',
  padding: '48px 32px 32px 32px',
  textAlign: 'center' as const,
  borderBottom: '1px solid #f3f4f6',
};

const logoContainer = {
  backgroundColor: '#ffffff',
  padding: '12px',
  borderRadius: '8px',
  display: 'inline-block',
  marginBottom: '16px',
  border: '1px solid #f3f4f6',
};

const logo = {
  width: '160px',
  height: '90px',
  display: 'block',
};

const headerTitle = {
  color: '#111827',
  fontSize: '24px',
  fontWeight: '600',
  margin: '0 0 8px 0',
  lineHeight: '1.3',
};

const headerSubtitle = {
  color: '#6b7280',
  fontSize: '16px',
  margin: '0',
  fontWeight: '400',
};

const content = {
  padding: '32px',
};

const greetingText = {
  color: '#111827',
  fontSize: '16px',
  fontWeight: '500',
  margin: '0 0 16px 0',
};

const paragraph = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 24px 0',
};

const accountBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '16px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const accountLabel = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 4px 0',
};

const accountEmail = {
  color: '#ea580c', // Orange accent from theme
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
  wordBreak: 'break-all' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const resetButton = {
  backgroundColor: '#ea580c', // Primary orange
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
  lineHeight: '1.4',
};

const altText = {
  color: '#6b7280',
  fontSize: '13px',
  margin: '24px 0 8px 0',
  textAlign: 'center' as const,
};

const linkText = {
  textAlign: 'center' as const,
  margin: '0 0 24px 0',
};

const fallbackLink = {
  color: '#ea580c',
  fontSize: '13px',
  wordBreak: 'break-all' as const,
  textDecoration: 'underline',
};

const stepsBox = {
  backgroundColor: '#f0f9ff', // Light blue background
  border: '1px solid #bae6fd',
  borderRadius: '6px',
  padding: '16px',
  margin: '24px 0',
};

const stepsTitle = {
  color: '#0c4a6e', // Dark blue text
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px 0',
};

const stepsText = {
  color: '#0c4a6e',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0',
};

const securityBox = {
  backgroundColor: '#fffbeb', // Light yellow background
  border: '1px solid #fed7aa',
  borderRadius: '6px',
  padding: '16px',
  margin: '24px 0',
};

const securityText = {
  color: '#92400e', // Dark yellow text
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0',
};

const footer = {
  backgroundColor: '#f9fafb',
  padding: '24px 32px',
  textAlign: 'center' as const,
  borderTop: '1px solid #f3f4f6',
};

const footerText = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '0 0 4px 0',
};

const footerLink = {
  color: '#ea580c',
  textDecoration: 'none',
};

export function PasswordResetEmail({
  resetUrl,
  userEmail,
  appName = 'WebLink',
}: PasswordResetEmailProps): React.ReactElement {
  const baseUrl = 'https://www.weblinq.dev';

  return (
    <Html>
      <Head />
      <Preview>
        Reset your password for
        {appName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Clean header with logo */}
          <Section style={header}>
            <div style={logoContainer}>
              <Img src="https://weblinq.dev/logo2_dark.png" alt={appName} style={logo} />
            </div>
            <Heading style={headerTitle}>Reset your password</Heading>
            <Text style={headerSubtitle}>
              Secure your
              {appName} account
            </Text>
          </Section>

          {/* Main content */}
          <Section style={content}>
            <Text style={greetingText}>We received a request to reset your password.</Text>

            <Text style={paragraph}>
              If you requested this password reset, click the button below to create a new password. If you didn&apos;t
              request this, you can safely ignore this email.
            </Text>

            {/* Account info */}
            <Section style={accountBox}>
              <Text style={accountLabel}>Account:</Text>
              <Text style={accountEmail}>{userEmail}</Text>
            </Section>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={resetButton} href={resetUrl}>
                Reset Password
              </Button>
            </Section>

            {/* Alternative link */}
            <Text style={altText}>If the button doesn&apos;t work, copy and paste this link:</Text>
            <Text style={linkText}>
              <Link href={resetUrl} style={fallbackLink}>
                {resetUrl}
              </Link>
            </Text>

            {/* Instructions */}
            <Section style={stepsBox}>
              <Text style={stepsTitle}>What happens next:</Text>
              <Text style={stepsText}>
                1. Click the reset button above
                <br />
                2. Create a new secure password
                <br />
                3. Sign in with your new password
              </Text>
            </Section>

            {/* Security note */}
            <Section style={securityBox}>
              <Text style={securityText}>
                This password reset link expires in 1 hour for security. If you didn&apos;t request this reset, your
                password remains unchanged.
              </Text>
            </Section>
          </Section>

          {/* Clean footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent to
              {userEmail}
            </Text>
            <Text style={footerText}>
              <Link href={baseUrl} style={footerLink}>
                {appName}
              </Link>{' '}
              © {new Date().getFullYear()}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
