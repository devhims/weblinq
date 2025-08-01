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

interface WelcomeEmailProps {
  userEmail: string;
  firstName?: string;
  appName?: string;
}

// Clean, minimal styling matching app theme
const main = {
  backgroundColor: '#fafafa',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  lineHeight: '1.6',
  color: '#374151',
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
};

const heading = {
  color: '#111827',
  fontSize: '24px',
  fontWeight: '600',
  margin: '0 0 8px 0',
  lineHeight: '1.3',
};

const subheading = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#6b7280',
  margin: '0',
  fontWeight: '400',
};

const content = {
  padding: '32px',
};

const paragraph = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 16px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#ea580c',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '14px 28px',
  display: 'inline-block',
};

const linkList = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '20px',
  margin: '24px 0',
};

const linkItem = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 8px 0',
  display: 'block',
};

const link = {
  color: '#ea580c',
  textDecoration: 'none',
  fontWeight: '500',
};

const footer = {
  backgroundColor: '#f9fafb',
  padding: '24px 32px',
  textAlign: 'center' as const,
  borderTop: '1px solid #f3f4f6',
};

const footerText = {
  fontSize: '12px',
  lineHeight: '24px',
  color: '#9ca3af',
  margin: '0 0 4px 0',
};

const signature = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '24px 0',
  fontStyle: 'normal',
};

export function WelcomeEmail({ userEmail, firstName = '', appName = 'WebLinq' }: WelcomeEmailProps) {
  const greeting = firstName ? `Hi ${firstName}` : 'Hi there';

  return (
    <Html>
      <Head>
        <link rel="preload" as="image" href="https://weblinq.dev/logo2_dark.png" />
      </Head>
      <Preview>Welcome to {appName} - Let's get you started!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with logo */}
          <Section style={header}>
            <div style={logoContainer}>
              <Img src="https://weblinq.dev/logo2_dark.png" alt={appName} style={logo} />
            </div>
            <Heading style={heading}>Welcome to {appName}</Heading>
            <Text style={subheading}>Let's get you started with web automation</Text>
          </Section>

          {/* Main content */}
          <Section style={content}>
            <Text style={paragraph}>{greeting},</Text>

            <Text style={paragraph}>
              Thanks for signing up for {appName}. I'm Himanshu, the developer behind the project.
            </Text>

            <Text style={paragraph}>
              {appName} is a suite of APIs designed for developers who want to automate web workflows, extract content
              programmatically, and build intelligent agents that interact with the open web.
            </Text>

            <Text style={{ ...paragraph, fontWeight: '600', marginBottom: '16px' }}>Here's how to get started:</Text>

            <div style={linkList}>
              <Text style={linkItem}>
                • Read the{' '}
                <Link href="https://docs.weblinq.dev/getting-started/quickstart" style={link}>
                  Quickstart Guide
                </Link>{' '}
                to make your first API call in minutes
              </Text>
              <Text style={linkItem}>
                • Explore the{' '}
                <Link href="https://docs.weblinq.dev/api-reference/overview" style={link}>
                  API Reference
                </Link>{' '}
                for tasks like screenshot capture, PDF generation, and markdown extraction
              </Text>
              <Text style={linkItem}>
                • Use the included <strong>Search API</strong> to enrich AI agents and automate web research
              </Text>
              <Text style={linkItem}>
                • Leverage the <strong>MCP server</strong> for persistent control over agent workflows
              </Text>
              <Text style={{ ...linkItem, marginBottom: '0' }}>
                • Access our open-source codebase and contribute to core improvements
              </Text>
            </div>

            <div style={buttonContainer}>
              <Button href="https://docs.weblinq.dev/getting-started/quickstart" style={button}>
                Get Started Now
              </Button>
            </div>

            <Text style={paragraph}>
              You're early to the platform, and I'm excited to support your projects and hear your feedback. If you have
              questions, feature requests, or ideas, feel free to reply directly to this email.
            </Text>

            <Text style={paragraph}>Looking forward to seeing what you build.</Text>

            <div style={signature}>
              <Text style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600' }}>
                Best,
                <br />
                Himanshu Gupta
              </Text>
              <Link href="https://weblinq.dev" style={link}>
                https://weblinq.dev
              </Link>
            </div>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>This email was sent to {userEmail}</Text>
            <Text style={footerText}>
              <Link href="https://www.weblinq.dev" style={link}>
                {appName}
              </Link>{' '}
              © 2025
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;
