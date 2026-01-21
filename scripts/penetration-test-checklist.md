# Penetration Testing Checklist for Servio Platform

## Pre-Testing Setup

- [ ] Get written authorization for penetration testing
- [ ] Set up test environment (staging/test instance)
- [ ] Ensure backups are in place
- [ ] Notify team of testing schedule
- [ ] Set up monitoring to track test impacts

## Authentication & Authorization

### Login Security
- [ ] Test brute force protection on login
- [ ] Test password complexity requirements
- [ ] Test account lockout after failed attempts
- [ ] Test password reset functionality
- [ ] Test session timeout
- [ ] Test concurrent session handling
- [ ] Test "remember me" functionality

### JWT Security
- [ ] Test JWT expiration
- [ ] Test JWT signature verification
- [ ] Test JWT token refresh mechanism
- [ ] Try to forge JWT tokens
- [ ] Test JWT with invalid signatures
- [ ] Test JWT with expired tokens

### Authorization
- [ ] Test vertical privilege escalation (staff → manager → admin)
- [ ] Test horizontal privilege escalation (access other restaurants)
- [ ] Test IDOR (Insecure Direct Object References)
- [ ] Test API endpoints without authentication
- [ ] Test role-based access control
- [ ] Test permission boundaries

## Input Validation

### SQL Injection
- [ ] Test all input fields with SQL injection payloads
  - `' OR '1'='1`
  - `'; DROP TABLE users; --`
  - `' UNION SELECT * FROM users --`
- [ ] Test query parameters
- [ ] Test POST request bodies
- [ ] Test headers

### XSS (Cross-Site Scripting)
- [ ] Test stored XSS in user profiles
- [ ] Test reflected XSS in search fields
- [ ] Test DOM-based XSS
- [ ] Test XSS in order notes/comments
- [ ] Test XSS in task descriptions
- [ ] Payloads to test:
  - `<script>alert('XSS')</script>`
  - `<img src=x onerror=alert('XSS')>`
  - `javascript:alert('XSS')`

### Command Injection
- [ ] Test file upload functionality
- [ ] Test any system command execution
- [ ] Test CSV/file import features

### Path Traversal
- [ ] Test file download endpoints
- [ ] Try `../../etc/passwd`
- [ ] Try `..\..\windows\system32\`
- [ ] Test receipt/image upload paths

## API Security

### Rate Limiting
- [ ] Test rate limits on authentication endpoints
- [ ] Test rate limits on API endpoints
- [ ] Test rate limiting bypass techniques
- [ ] Verify rate limit headers are present
- [ ] Test distributed rate limiting (multiple IPs)

### CORS
- [ ] Test CORS policy with different origins
- [ ] Test preflight requests
- [ ] Try to bypass CORS with various techniques
- [ ] Verify credentials are properly restricted

### API Abuse
- [ ] Test mass data export
- [ ] Test resource exhaustion
- [ ] Test pagination limits
- [ ] Test bulk operations

## Data Security

### Sensitive Data Exposure
- [ ] Check for exposed API keys in responses
- [ ] Check for exposed passwords in responses
- [ ] Check for exposed PII in logs
- [ ] Test data encryption in transit (HTTPS)
- [ ] Test data encryption at rest
- [ ] Check for sensitive data in URL parameters

### Session Management
- [ ] Test session fixation
- [ ] Test session hijacking
- [ ] Test CSRF protection
- [ ] Test secure cookie flags
- [ ] Test httpOnly cookie flags

## Business Logic

### Order Management
- [ ] Test negative pricing
- [ ] Test zero quantity orders
- [ ] Test order tampering (modify prices)
- [ ] Test race conditions (duplicate orders)
- [ ] Test order status manipulation

### Inventory
- [ ] Test negative inventory quantities
- [ ] Test inventory manipulation
- [ ] Test stock level manipulation

### Voice Ordering
- [ ] Test voice ordering authentication
- [ ] Test Vapi webhook validation
- [ ] Test voice order injection attacks

## Infrastructure

### Network Security
- [ ] Port scan the server
- [ ] Test firewall rules
- [ ] Test for open services
- [ ] Test SSL/TLS configuration
- [ ] Test cipher suites
- [ ] Test certificate validation

### Cloud Security (if applicable)
- [ ] Test S3 bucket permissions (if using AWS)
- [ ] Test database security groups
- [ ] Test Redis security
- [ ] Test environment variable exposure

## Third-Party Integrations

### OpenAI
- [ ] Test API key exposure
- [ ] Test prompt injection attacks
- [ ] Test data leakage through AI responses

### Twilio
- [ ] Test SMS injection
- [ ] Test phone number enumeration
- [ ] Test Twilio webhook security

### Payment Processing
- [ ] Test payment manipulation
- [ ] Test refund abuse
- [ ] Test card data handling

## Error Handling

### Information Disclosure
- [ ] Test error messages for sensitive info
- [ ] Test stack traces in responses
- [ ] Test debug mode exposure
- [ ] Test database error messages
- [ ] Test 404/500 error pages

## Denial of Service

### Resource Exhaustion
- [ ] Test large file uploads
- [ ] Test large request bodies
- [ ] Test CPU-intensive operations
- [ ] Test memory exhaustion
- [ ] Test connection pool exhaustion

## Tools to Use

### Automated Scanners
- [ ] OWASP ZAP
- [ ] Burp Suite
- [ ] Nikto
- [ ] SQLMap
- [ ] Nmap

### Manual Testing Tools
- [ ] Postman/Insomnia
- [ ] Browser DevTools
- [ ] cURL
- [ ] JQ (JSON processing)

## Post-Testing

- [ ] Document all findings with severity
- [ ] Provide reproduction steps
- [ ] Suggest remediation for each issue
- [ ] Create tickets for vulnerabilities
- [ ] Re-test after fixes
- [ ] Generate executive summary

## Severity Levels

- **Critical**: Remote code execution, SQL injection, authentication bypass
- **High**: XSS, CSRF, privilege escalation, sensitive data exposure
- **Medium**: Information disclosure, missing security headers, weak encryption
- **Low**: Verbose error messages, missing rate limiting, outdated dependencies

## Compliance Checks

- [ ] OWASP Top 10 coverage
- [ ] PCI DSS (if handling payments)
- [ ] GDPR (data protection)
- [ ] SOC 2 requirements
- [ ] HIPAA (if handling health data)

## Notes

- Always test in a controlled environment
- Never test in production without explicit permission
- Document everything
- Communicate findings responsibly
- Prioritize critical vulnerabilities first
