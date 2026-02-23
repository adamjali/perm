# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in PERM Tracker, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email **security@permtracker.app** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

You can expect:

- Acknowledgment within **48 hours**
- A status update within **7 days**
- A fix timeline based on severity

## Scope

This policy covers:

- The PERM Tracker web application at [permtracker.app](https://permtracker.app)
- The Convex backend functions
- Authentication and authorization flows
- Data handling and storage

## Out of Scope

- Third-party services (Convex, Vercel, Resend, Google OAuth)
- Denial of service attacks
- Social engineering

## Data Sensitivity

PERM Tracker handles immigration case management data. We take data security seriously and follow OWASP best practices including:

- Server-side authentication on all API endpoints
- Input validation and sanitization
- Encrypted data in transit (HTTPS/TLS)
- Session management with inactivity timeouts
- Audit logging for sensitive operations
