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

interface VerificationEmailProps {
  verificationUrl: string;
  userEmail: string;
  appName?: string;
}

const baseUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://www.weblinq.dev'
    : 'http://localhost:3000';

export const VerificationEmail = ({
  verificationUrl,
  userEmail,
  appName = 'WebLink',
}: VerificationEmailProps) => (
  <Html>
    <Head />
    <Preview>Verify your email address for {appName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{appName}</Heading>
          <Text style={headerSubtitle}>Email Verification Required</Text>
        </Section>

        <Section style={content}>
          <Heading style={title}>Welcome to {appName}!</Heading>

          <Text style={paragraph}>
            Thank you for signing up! To complete your registration and secure
            your account, please verify your email address by clicking the
            button below.
          </Text>

          <Section style={verificationBox}>
            <Text style={verificationLabel}>Email Address to Verify:</Text>
            <Text style={emailText}>{userEmail}</Text>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={verificationUrl}>
              Verify Email Address
            </Button>
          </Section>

          <Text style={linkText}>
            If the button doesn't work, you can copy and paste this link into
            your browser:
          </Text>
          <Link href={verificationUrl} style={link}>
            {verificationUrl}
          </Link>

          <Section style={securityNote}>
            <Text style={securityText}>
              <strong>Security Note:</strong> This verification link will expire
              in 1 hour for your security. If you didn't create an account with{' '}
              {appName}, please ignore this email.
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

// Using email-safe colors and styling for better rendering
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
  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
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

const verificationBox = {
  backgroundColor: '#fff7ed',
  border: '2px solid #f97316',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const verificationLabel = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const emailText = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#f97316',
  margin: '0',
  wordBreak: 'break-all' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
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
  color: '#f97316',
  fontSize: '14px',
  wordBreak: 'break-all' as const,
};

const securityNote = {
  backgroundColor: '#fef3c7',
  borderLeft: '4px solid #f59e0b',
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
  color: '#f97316',
  textDecoration: 'none',
  fontSize: '14px',
};

export default VerificationEmail;
