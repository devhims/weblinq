# Security Policy

## Supported Versions

We actively support the following versions of WebLinq:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously at WebLinq. If you discover a security vulnerability, please follow these guidelines:

### Private Disclosure

**Please do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report security issues privately by:

1. **Email**: Send details to [security@weblinq.com](mailto:security@weblinq.com)
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature

### What to Include

When reporting a vulnerability, please include:

- **Description**: Clear description of the vulnerability
- **Impact**: Potential impact and attack scenarios
- **Reproduction**: Step-by-step instructions to reproduce
- **Environment**: System details where you found the issue
- **Suggested Fix**: If you have ideas for mitigation

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Regular Updates**: Every week until resolved
- **Fix Release**: Target within 30 days for critical issues

### Scope

This security policy covers:

- **Backend API** - Authentication, authorization, data handling
- **Frontend Dashboard** - XSS, CSRF, authentication flows
- **Browser Operations** - Injection attacks, sandbox escapes
- **Database** - SQL injection, data exposure
- **Infrastructure** - Cloudflare Workers configuration

### Out of Scope

The following are generally out of scope:

- Social engineering attacks
- Physical attacks
- DoS/DDoS attacks against public endpoints
- Issues in third-party dependencies (report to upstream)
- Issues requiring physical access to servers

### Recognition

We appreciate security researchers who help improve WebLinq's security:

- **Public Recognition**: Contributors will be credited (with permission)
- **Response Timeline**: We commit to timely responses and fixes
- **Coordination**: We'll work with you on responsible disclosure timing

## Security Best Practices

When using WebLinq:

### API Security

- **Never expose API keys** in client-side code
- **Use environment variables** for sensitive configuration
- **Implement rate limiting** in your applications
- **Validate all inputs** before sending to WebLinq API

### Browser Operations

- **Sanitize extracted content** before using in applications
- **Be cautious with dynamic content** from untrusted sources
- **Use timeouts** to prevent long-running operations
- **Monitor usage patterns** for anomalies

### Infrastructure

- **Keep dependencies updated** regularly
- **Use HTTPS** for all communications
- **Implement proper logging** for audit trails
- **Follow principle of least privilege** for access controls

## Contact

- **Security Email**: [info@weblinq.com](mailto:info@weblinq.com)
- **General Contact**: [support@weblinq.com](mailto:support@weblinq.com)
- **Documentation**: [https://docs.weblinq.com](https://docs.weblinq.com)

Thank you for helping keep WebLinq and our community safe! 🔒
