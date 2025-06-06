import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
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

const baseUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://www.weblinq.dev'
    : 'http://localhost:3000';

export const PasswordResetEmail = ({
  resetUrl,
  userEmail,
  appName = 'WebLink',
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your password for {appName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{appName}</Heading>
          <Text style={headerSubtitle}>Password Reset Request</Text>
        </Section>

        <Section style={content}>
          <Heading style={title}>Reset Your Password</Heading>

          <Text style={paragraph}>
            We received a request to reset the password for your {appName}{' '}
            account. Click the button below to create a new password.
          </Text>

          <Section style={resetBox}>
            <Text style={resetLabel}>Account Email:</Text>
            <Text style={emailText}>{userEmail}</Text>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>

          <Text style={linkText}>
            If the button doesn't work, you can copy and paste this link into
            your browser:
          </Text>
          <Link href={resetUrl} style={link}>
            {resetUrl}
          </Link>

          <Section style={securityNote}>
            <Text style={securityText}>
              <strong>Security Notice:</strong> This password reset link will
              expire in 1 hour. If you didn't request a password reset, please
              ignore this email and your password will remain unchanged.
            </Text>
          </Section>

          <Section style={instructionsBox}>
            <Text style={instructionsTitle}>What happens next?</Text>
            <Text style={instructionsText}>
              1. Click the reset button above
              <br />
              2. Create a new secure password
              <br />
              3. Sign in with your new password
              <br />
              4. Your account will be secure again!
            </Text>
          </Section>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>This email was sent to {userEmail}</Text>
          <Text style={footerText}>
            © {new Date().getFullYear()} {appName}. All rights reserved.
          </Text>
          <Link href={baseUrl} style={footerLink}>
            Visit our website
          </Link>
        </Section>
      </Container>
    </Body>
  </Html>
);

// Using email-safe colors and styling
const main = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  lineHeight: '1.4',
};

const container = {
  backgroundColor: '#ffffff',
  maxWidth: '600px',
  margin: '0 auto',
  border: '1px solid #e5e7eb',
};

const header = {
  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  padding: '40px 20px',
  textAlign: 'center' as const,
};

const headerTitle = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  lineHeight: '1.2',
};

const headerSubtitle = {
  color: '#fed7aa',
  fontSize: '16px',
  margin: '8px 0 0 0',
  fontWeight: 'normal',
};

const content = {
  padding: '40px 30px',
};

const title = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 20px 0',
  lineHeight: '1.2',
};

const paragraph = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 20px 0',
};

const resetBox = {
  backgroundColor: '#fef3c7',
  border: '2px solid #f59e0b',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const resetLabel = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const emailText = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#f59e0b',
  margin: '0',
  wordBreak: 'break-all' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
  margin: '0',
  border: 'none',
};

const linkText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '24px 0 8px 0',
};

const link = {
  color: '#f59e0b',
  fontSize: '14px',
  wordBreak: 'break-all' as const,
};

const securityNote = {
  backgroundColor: '#fee2e2',
  borderLeft: '4px solid #ef4444',
  padding: '16px',
  margin: '24px 0',
  borderRadius: '4px',
};

const securityText = {
  color: '#4b5563',
  fontSize: '14px',
  margin: '0',
  lineHeight: '1.5',
};

const instructionsBox = {
  backgroundColor: '#f0f9ff',
  border: '1px solid #e0e7ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const instructionsTitle = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const instructionsText = {
  color: '#4b5563',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0',
};

const footer = {
  backgroundColor: '#f9fafb',
  padding: '24px 20px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e5e7eb',
};

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '4px 0',
};

const footerLink = {
  color: '#f59e0b',
  textDecoration: 'none',
  fontSize: '14px',
};

export default PasswordResetEmail;
