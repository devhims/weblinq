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
        {/* Clean header with logo */}
        <Section style={header}>
          <div style={logoContainer}>
            <Img
              src="https://weblinq.dev/logo2_dark.png"
              alt={appName}
              style={logo}
            />
          </div>
          <Heading style={headerTitle}>Verify your email</Heading>
          <Text style={headerSubtitle}>
            Complete your {appName} account setup
          </Text>
        </Section>

        {/* Main content */}
        <Section style={content}>
          <Text style={welcomeText}>
            Welcome to {appName}! We&apos;re excited to have you on board.
          </Text>

          <Text style={paragraph}>
            To complete your account setup and start using {appName}, please
            verify your email address by clicking the button below.
          </Text>

          {/* Email display */}
          <Section style={emailBox}>
            <Text style={emailLabel}>Verifying:</Text>
            <Text style={emailAddress}>{userEmail}</Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonContainer}>
            <Button style={verifyButton} href={verificationUrl}>
              Verify Email Address
            </Button>
          </Section>

          {/* Alternative link */}
          <Text style={altText}>
            If the button doesn&apos;t work, copy and paste this link:
          </Text>
          <Text style={linkText}>
            <Link href={verificationUrl} style={fallbackLink}>
              {verificationUrl}
            </Link>
          </Text>

          {/* Security note */}
          <Section style={securityBox}>
            <Text style={securityText}>
              This verification link expires in 1 hour for security. If you
              didn&apos;t create this account, you can safely ignore this email.
            </Text>
          </Section>
        </Section>

        {/* Clean footer */}
        <Section style={footer}>
          <Text style={footerText}>This email was sent to {userEmail}</Text>
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

// Clean, minimal styling matching app theme
const main = {
  backgroundColor: '#fafafa', // Light gray background
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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

const welcomeText = {
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

const emailBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '16px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const emailLabel = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '500',
  margin: '0 0 4px 0',
};

const emailAddress = {
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

const verifyButton = {
  backgroundColor: '#ea580c', // Primary orange
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  border: 'none',
  cursor: 'pointer',
};

const altText = {
  color: '#6b7280',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '24px 0 8px 0',
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

const securityBox = {
  backgroundColor: '#fef3cd',
  border: '1px solid #fde68a',
  borderRadius: '6px',
  padding: '16px',
  margin: '24px 0 0 0',
};

const securityText = {
  color: '#92400e',
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
  color: '#6b7280',
  fontSize: '12px',
  margin: '0 0 4px 0',
};

const footerLink = {
  color: '#ea580c',
  textDecoration: 'none',
  fontWeight: '500',
};

export default VerificationEmail;
