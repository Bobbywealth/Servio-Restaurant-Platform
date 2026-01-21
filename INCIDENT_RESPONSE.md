# Incident Response Guide

## Incident Severity Levels

### P0 - Critical (Immediate Response)
**Definition**: Complete service outage or security breach
**Examples**:
- Production database down
- Complete API failure
- Security breach detected
- Data loss

**Response Time**: Immediate (5 minutes)
**Communication**: Immediate notification to all stakeholders

### P1 - High (Urgent Response)
**Definition**: Major functionality broken, affecting many users
**Examples**:
- Authentication failing
- Payment processing down
- Critical API endpoints failing
- High error rate (>5%)

**Response Time**: 30 minutes
**Communication**: Notify engineering team and management

### P2 - Medium (Scheduled Response)
**Definition**: Non-critical functionality impaired
**Examples**:
- Single feature not working
- Performance degradation
- Non-critical API errors

**Response Time**: 4 hours
**Communication**: Notify engineering team

### P3 - Low (Routine Response)
**Definition**: Minor issues, no user impact
**Examples**:
- Cosmetic bugs
- Logging issues
- Minor performance issues

**Response Time**: Next business day
**Communication**: Create ticket, no immediate notification

## Incident Response Process

### 1. Detection & Alert
- Monitor alerts from Sentry, CloudWatch, or other tools
- User reports via support channels
- Internal team discovery

### 2. Initial Assessment (5 minutes)
- [ ] Verify the incident is real
- [ ] Determine severity level
- [ ] Check if issue is user-specific or system-wide
- [ ] Document initial findings

### 3. Communication
- [ ] Notify on-call engineer
- [ ] Create incident Slack channel (#incident-YYYYMMDD-description)
- [ ] Update status page (if user-facing)
- [ ] Notify stakeholders based on severity

### 4. Investigation (P0/P1: Parallel with mitigation)

#### Check Health Endpoints
```bash
# Overall health
curl https://api.servio.app/health/detailed | jq

# Database health
curl https://api.servio.app/health/database/stats | jq

# Cache health
curl https://api.servio.app/health/cache/stats | jq

# System resources
curl https://api.servio.app/health/system | jq
```

#### Check Logs
```bash
# Application logs
pm2 logs servio-backend --lines 500

# Error logs
tail -f /var/log/servio/error.log

# Nginx logs
tail -f /var/log/nginx/error.log

# Database logs
sudo tail -f /var/log/postgresql/postgresql.log
```

#### Check Metrics
- Sentry: https://sentry.io/servio
- Grafana: https://grafana.servio.app
- CloudWatch: https://console.aws.amazon.com/cloudwatch

#### Common Checks
```bash
# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Redis status
redis-cli ping
redis-cli INFO

# Disk space
df -h

# Memory usage
free -m

# Process status
pm2 status
ps aux | grep node
```

### 5. Mitigation

#### Quick Fixes

**Application Restart**
```bash
pm2 restart servio-backend
```

**Cache Clear**
```bash
redis-cli FLUSHDB
```

**Rollback to Previous Version**
```bash
git revert HEAD
npm run build
pm2 restart servio-backend
```

**Enable Maintenance Mode**
```bash
curl -X POST https://api.servio.app/api/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true}'
```

**Scale Resources**
```bash
# Increase PM2 instances
pm2 scale servio-backend +2

# Or increase server resources (AWS)
aws ec2 modify-instance-attribute --instance-id i-xxx --instance-type t3.large
```

### 6. Resolution
- [ ] Apply fix
- [ ] Test fix in staging (if time permits)
- [ ] Deploy fix to production
- [ ] Verify resolution with smoke tests
- [ ] Monitor for 30 minutes

### 7. Post-Incident
- [ ] Disable maintenance mode
- [ ] Update status page
- [ ] Notify stakeholders of resolution
- [ ] Schedule post-mortem meeting (within 24-48 hours)

## Specific Incident Playbooks

### Database Connection Pool Exhausted

**Symptoms**:
- "Too many connections" errors
- Slow API responses
- Timeouts

**Investigation**:
```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Check long-running queries
psql $DATABASE_URL -c "
  SELECT pid, now() - query_start as duration, query 
  FROM pg_stat_activity 
  WHERE state = 'active' AND query_start < now() - interval '1 minute';
"
```

**Mitigation**:
```bash
# Kill long-running queries
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"

# Restart application
pm2 restart servio-backend

# Increase pool size (if needed)
# Update DATABASE_POOL_MAX in .env and restart
```

### High Memory Usage

**Symptoms**:
- OOM (Out of Memory) errors
- Slow performance
- Application crashes

**Investigation**:
```bash
# Check memory usage
curl https://api.servio.app/health/system | jq .memory

# Check process memory
ps aux --sort=-%mem | head -10

# Check for memory leaks
pm2 monit
```

**Mitigation**:
```bash
# Restart application
pm2 restart servio-backend

# Scale horizontally
pm2 scale servio-backend +1

# Increase server memory (if needed)
```

### OpenAI API Failure

**Symptoms**:
- Assistant queries failing
- Timeout errors from OpenAI
- Rate limit errors

**Investigation**:
```bash
# Check OpenAI status
curl https://status.openai.com/api/v2/status.json

# Check recent errors in Sentry
# Filter by "openai" tag
```

**Mitigation**:
```bash
# Verify API key
echo $OPENAI_API_KEY

# Check rate limits
# OpenAI rate limits: 3,500 RPM for gpt-4

# Implement fallback responses (already in code)
# Circuit breaker should activate automatically

# If API is down, enable maintenance mode for assistant only
```

### Redis Cache Failure

**Symptoms**:
- Cache miss rate 100%
- "Connection refused" errors
- Slow response times

**Investigation**:
```bash
# Check Redis status
redis-cli ping

# Check Redis info
redis-cli INFO

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

**Mitigation**:
```bash
# Restart Redis
sudo systemctl restart redis

# Verify connection
redis-cli ping

# Clear cache
redis-cli FLUSHDB

# Application continues without cache (degraded performance)
```

### DDoS Attack

**Symptoms**:
- Extremely high traffic
- Many requests from same IP ranges
- Rate limiters triggering constantly

**Investigation**:
```bash
# Check top IPs
tail -10000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -20

# Check request patterns
tail -10000 /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -nr | head -20
```

**Mitigation**:
```bash
# Block offending IPs in nginx
sudo nano /etc/nginx/conf.d/block-ips.conf
# Add: deny 1.2.3.4;
sudo nginx -s reload

# Enable CloudFlare DDoS protection
# Or use AWS WAF

# Tighten rate limits
# Update rate limit config and restart
```

### Security Breach

**Symptoms**:
- Unauthorized access detected
- Unusual data access patterns
- Security alerts

**Immediate Actions**:
1. [ ] **DO NOT** delete evidence
2. [ ] Isolate affected systems
3. [ ] Rotate all secrets and API keys
4. [ ] Force logout all users
5. [ ] Enable maintenance mode
6. [ ] Contact security team/consultant
7. [ ] Notify affected users (if required by law)

**Investigation**:
```bash
# Check audit logs
psql $DATABASE_URL -c "
  SELECT * FROM audit_logs 
  WHERE created_at > now() - interval '24 hours' 
  ORDER BY created_at DESC 
  LIMIT 100;
"

# Check access logs
grep "suspicious-pattern" /var/log/nginx/access.log

# Check authentication attempts
grep "authentication" /var/log/servio/application.log
```

## Communication Templates

### Status Page Update (P0/P1)
```
We are currently experiencing issues with [service/feature].
Our team is actively investigating and working on a resolution.
We will provide updates every 30 minutes.

Status: Investigating
Last Updated: [timestamp]
```

### Resolution Notification
```
The issue with [service/feature] has been resolved.
Root cause: [brief explanation]
Duration: [X hours/minutes]
We apologize for any inconvenience.

Status: Resolved
Resolved At: [timestamp]
```

### Slack Incident Channel
```
:rotating_light: INCIDENT DETECTED :rotating_light:

Severity: P0/P1/P2/P3
Description: [Brief description]
Detected: [timestamp]
Impact: [number of users/services affected]

Incident Commander: @username
Channel: #incident-YYYYMMDD-description

Current Status: Investigating
Next Update: [timestamp]
```

## Post-Mortem Template

After resolving a P0 or P1 incident:

```markdown
# Post-Mortem: [Incident Title]

**Date**: YYYY-MM-DD
**Severity**: P0/P1
**Duration**: X hours Y minutes
**Incident Commander**: [Name]

## Summary
[2-3 sentence summary of what happened]

## Timeline (All times in UTC)
- HH:MM - Incident detected
- HH:MM - Team notified
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

## Impact
- **Users Affected**: X users / Y%
- **Services Affected**: [list]
- **Revenue Impact**: $X (if applicable)
- **Data Loss**: Yes/No

## Root Cause
[Detailed explanation of what caused the incident]

## Contributing Factors
- Factor 1
- Factor 2

## Resolution
[How the incident was resolved]

## What Went Well
- Quick detection
- Good communication
- etc.

## What Went Wrong
- Slow response
- Unclear documentation
- etc.

## Action Items
- [ ] [Action] - Owner: [Name] - Due: [Date]
- [ ] [Action] - Owner: [Name] - Due: [Date]

## Lessons Learned
1. [Lesson 1]
2. [Lesson 2]
```

## Emergency Contacts

- **On-Call Engineer**: [Phone]
- **Engineering Manager**: [Phone]
- **CTO**: [Phone]
- **Security Team**: security@servio.app
- **AWS Support**: [Case Portal]
- **Database Admin**: [Phone]

## External Resources

- OpenAI Status: https://status.openai.com
- Twilio Status: https://status.twilio.com
- AWS Status: https://status.aws.amazon.com
- Render Status: https://status.render.com

## Useful Commands Quick Reference

```bash
# Health check
curl https://api.servio.app/health/detailed | jq

# Restart application
pm2 restart servio-backend

# View logs
pm2 logs servio-backend --lines 500

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Redis status
redis-cli ping && redis-cli INFO

# Enable maintenance mode
curl -X POST https://api.servio.app/api/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true}'
```
