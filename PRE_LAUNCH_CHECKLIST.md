# Pre-Launch Production Checklist

## Infrastructure ✅

### SSL/TLS
- [ ] SSL certificates installed and valid
- [ ] Certificate expiration > 30 days
- [ ] HTTPS enforced (no HTTP)
- [ ] SSL/TLS configuration scored A+ on SSL Labs
- [ ] HSTS headers enabled

### DNS
- [ ] DNS records configured correctly
- [ ] TTL values appropriate (300s for production)
- [ ] CDN configured (if applicable)
- [ ] Health check subdomain configured

### Load Balancer
- [ ] Load balancer configured
- [ ] Health checks enabled
- [ ] SSL termination configured
- [ ] Connection draining enabled
- [ ] Sticky sessions configured (if needed)

### Auto-Scaling
- [ ] Auto-scaling policies configured
- [ ] Min instances: 2
- [ ] Max instances: 10 (or appropriate)
- [ ] Scale-up threshold: CPU > 70%
- [ ] Scale-down threshold: CPU < 30%
- [ ] Cooldown periods configured

### Backup & Recovery
- [ ] Automated daily backups configured
- [ ] Backup retention: 30 days
- [ ] Backup verification tested
- [ ] Restore procedure documented
- [ ] RTO (Recovery Time Objective): < 1 hour
- [ ] RPO (Recovery Point Objective): < 24 hours
- [ ] Disaster recovery plan documented

### Monitoring & Logging
- [ ] Sentry APM configured
- [ ] Error tracking enabled
- [ ] Performance monitoring active
- [ ] Log aggregation configured
- [ ] Alert notifications working
- [ ] Dashboards created
- [ ] On-call rotation configured

---

## Application ✅

### Environment Variables
- [ ] All required environment variables set
- [ ] No default/example values used
- [ ] Secrets encrypted
- [ ] API keys rotated
- [ ] No secrets in code or logs

### Database
- [ ] Production database created
- [ ] All migrations applied
- [ ] Indexes created (see migrations/015_production_indexes.sql)
- [ ] Connection pooling configured (max: 20, min: 5)
- [ ] Query timeout: 30s
- [ ] Backup configured
- [ ] Read replicas configured (if needed)

### Redis Cache
- [ ] Redis cluster configured
- [ ] Persistence enabled (if needed)
- [ ] Max memory configured
- [ ] Eviction policy set (allkeys-lru)
- [ ] Password protected
- [ ] Backup configured

### Third-Party Services
- [ ] OpenAI API key valid and not rate-limited
- [ ] Twilio account configured
- [ ] Twilio credits sufficient
- [ ] SendGrid/email service configured
- [ ] S3 buckets created and configured
- [ ] CloudFront CDN configured
- [ ] All API keys tested

### File Storage
- [ ] S3 buckets created
- [ ] Bucket policies configured
- [ ] CORS configured for uploads
- [ ] CloudFront distribution configured
- [ ] Backup policies enabled

---

## Security ✅

### Authentication
- [ ] JWT secret strong (256-bit)
- [ ] JWT expiration: 24 hours
- [ ] Refresh token mechanism working
- [ ] Password hashing (bcrypt, rounds: 10)
- [ ] Rate limiting on login (5 attempts / 15 min)
- [ ] Account lockout after failed attempts

### Authorization
- [ ] Role-based access control implemented
- [ ] Permission checks on all endpoints
- [ ] No privilege escalation vulnerabilities
- [ ] Restaurant isolation enforced

### Rate Limiting
- [ ] Global rate limit: 100 req/15min
- [ ] Auth endpoints: 5 req/15min
- [ ] API endpoints: 60 req/min
- [ ] Heavy operations: 20 req/min
- [ ] Redis-backed rate limiting

### Security Headers
- [ ] Helmet.js configured
- [ ] HSTS enabled (max-age: 31536000)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] CSP headers configured
- [ ] CORS properly restricted

### Input Validation
- [ ] All inputs validated
- [ ] SQL injection prevention
- [ ] XSS prevention (DOMPurify)
- [ ] Command injection prevention
- [ ] Path traversal prevention

### Dependencies
- [ ] npm audit clean (0 vulnerabilities)
- [ ] Snyk scan passed
- [ ] Dependencies up to date
- [ ] No known CVEs in dependencies

### Secrets Management
- [ ] No secrets in code
- [ ] No secrets in logs
- [ ] Environment variables used
- [ ] Secrets rotated recently
- [ ] Access to secrets limited

---

## Performance ✅

### Response Times
- [ ] p50 < 200ms
- [ ] p95 < 500ms
- [ ] p99 < 1000ms
- [ ] Database queries < 100ms (p95)

### Caching
- [ ] Menu items cached (TTL: 5min)
- [ ] Restaurant settings cached (TTL: 15min)
- [ ] User permissions cached (TTL: 10min)
- [ ] Cache hit rate > 70%
- [ ] Cache invalidation working

### Database
- [ ] All critical queries indexed
- [ ] No N+1 queries
- [ ] Connection pool not exhausted
- [ ] Query execution plans reviewed
- [ ] Database CPU < 70%
- [ ] Database memory < 85%

### API
- [ ] Pagination implemented on list endpoints
- [ ] Response compression enabled
- [ ] Static assets on CDN
- [ ] Image optimization enabled
- [ ] Lazy loading implemented

### Load Testing
- [ ] Load tests passed (100 req/s)
- [ ] Spike tests passed (200 req/s)
- [ ] Stress tests passed
- [ ] No memory leaks detected
- [ ] No connection leaks detected

---

## Compliance ✅

### Legal
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Cookie consent implemented
- [ ] GDPR compliance documented
- [ ] Data retention policies defined

### Data Protection
- [ ] PII encrypted at rest
- [ ] PII encrypted in transit
- [ ] Data backup encrypted
- [ ] Data deletion process defined
- [ ] GDPR right to be forgotten implemented

### Accessibility
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation working
- [ ] Screen reader compatible
- [ ] Color contrast ratios meet standards

---

## Business Continuity ✅

### Support
- [ ] Support email configured
- [ ] Support ticket system setup
- [ ] Support documentation written
- [ ] Support team trained
- [ ] Escalation procedures defined

### Status Page
- [ ] Status page configured
- [ ] Components defined
- [ ] Incident templates ready
- [ ] Notification subscribers

### Incident Response
- [ ] Incident response plan documented
- [ ] On-call rotation configured
- [ ] Runbooks created
- [ ] Communication templates ready
- [ ] Post-mortem template ready

### Documentation
- [ ] API documentation complete
- [ ] Deployment runbook written
- [ ] Architecture diagrams created
- [ ] User guides for each role
- [ ] Admin documentation complete

---

## Testing ✅

### Unit Tests
- [ ] Backend tests passing
- [ ] Frontend tests passing
- [ ] Test coverage > 70%

### Integration Tests
- [ ] API integration tests passing
- [ ] Database integration tests passing
- [ ] Third-party integration tests passing

### End-to-End Tests
- [ ] Critical user flows tested
- [ ] Order creation flow works
- [ ] Authentication flow works
- [ ] Payment flow works (if applicable)

### Security Tests
- [ ] Penetration testing completed
- [ ] Vulnerability scan passed
- [ ] OWASP Top 10 tested
- [ ] Security audit completed

### Performance Tests
- [ ] Load testing completed
- [ ] Stress testing completed
- [ ] Spike testing completed
- [ ] Endurance testing completed

---

## Monitoring ✅

### Application Monitoring
- [ ] Error rate < 0.1%
- [ ] Response time acceptable
- [ ] Throughput acceptable
- [ ] Memory usage < 85%
- [ ] CPU usage < 70%

### Database Monitoring
- [ ] Connection count monitored
- [ ] Query performance monitored
- [ ] Slow query log enabled
- [ ] Deadlocks monitored
- [ ] Replication lag monitored (if applicable)

### Infrastructure Monitoring
- [ ] Server health monitored
- [ ] Disk space monitored
- [ ] Network traffic monitored
- [ ] SSL certificate expiration monitored

### Business Metrics
- [ ] Orders per hour tracked
- [ ] User signups tracked
- [ ] Revenue tracked
- [ ] Active users tracked
- [ ] Error trends tracked

### Alerts
- [ ] Critical alerts configured
- [ ] Warning alerts configured
- [ ] Alert routing configured
- [ ] Alert escalation configured
- [ ] On-call notifications working

---

## Launch Day ✅

### Pre-Launch (T-24 hours)
- [ ] All checklist items completed
- [ ] Final backup created
- [ ] Team briefed
- [ ] Support team ready
- [ ] Communication plan ready
- [ ] Rollback plan documented

### Launch (T-0)
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Run smoke tests
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Announce availability

### Post-Launch (T+1 hour)
- [ ] Error rate < 0.1%
- [ ] Response times acceptable
- [ ] No critical issues
- [ ] User signups working
- [ ] Orders being created
- [ ] Support tickets manageable

### Post-Launch (T+24 hours)
- [ ] System stable
- [ ] No major issues
- [ ] Performance acceptable
- [ ] User feedback collected
- [ ] Iteration plan created

---

## Sign-Off

- [ ] Engineering Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______
- [ ] Security Lead: _________________ Date: _______
- [ ] CTO: _________________ Date: _______

---

## Critical Metrics Dashboard

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Response Time (p95) | < 500ms | ___ | ⬜ |
| Error Rate | < 0.1% | ___ | ⬜ |
| Uptime | > 99.9% | ___ | ⬜ |
| Database CPU | < 70% | ___ | ⬜ |
| Memory Usage | < 85% | ___ | ⬜ |
| Cache Hit Rate | > 70% | ___ | ⬜ |

---

## Emergency Contacts

- **On-Call Engineer**: [Phone]
- **Engineering Manager**: [Phone]
- **DevOps Lead**: [Phone]
- **CTO**: [Phone]
- **Security Lead**: [Phone]

---

## Launch Readiness Score

Calculate your readiness score:
- Total items: Count all checkboxes
- Completed items: Count checked boxes
- Readiness: (Completed / Total) × 100%

**Target**: 100% before launch
**Minimum**: 95% (with documented exceptions)

Current Score: ____%

---

## Notes

Add any additional notes, exceptions, or concerns here:

___________________________________________
___________________________________________
___________________________________________
