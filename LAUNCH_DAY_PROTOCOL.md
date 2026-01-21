# Launch Day Protocol

## Timeline Overview

```
T-24h: Final preparation
T-4h:  Pre-launch checks
T-1h:  Team assembly
T-0:   Launch
T+1h:  Critical monitoring
T+4h:  Initial assessment
T+24h: Stabilization review
```

---

## T-24 Hours: Final Preparation

### Team Notification
- [ ] Send launch notification email to all team members
- [ ] Confirm on-call engineer availability
- [ ] Confirm support team availability
- [ ] Brief executive team

### System Verification
- [ ] All pre-launch checklist items completed
- [ ] Final backup completed
- [ ] All tests passing
- [ ] No pending critical issues
- [ ] Staging environment tested

### Communication
- [ ] Status page prepared
- [ ] Social media posts drafted
- [ ] Email announcement drafted
- [ ] Support FAQs updated

---

## T-4 Hours: Pre-Launch Checks

### Health Verification
```bash
# Run pre-launch health check
./scripts/pre-launch-health-check.sh

# Expected output:
# ✅ Database: Healthy
# ✅ Redis: Healthy
# ✅ Application: Healthy
# ✅ External APIs: Healthy
```

### Performance Baseline
```bash
# Capture baseline metrics
curl https://api.servio.app/health/detailed > baseline-metrics.json

# Verify response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.servio.app/health
```

### Backup Verification
```bash
# Verify latest backup
ls -lh /var/backups/servio/ | tail -1

# Test restore (on test database)
./scripts/test-restore.sh latest
```

### Team Assembly
- [ ] Create #launch-day Slack channel
- [ ] All team members join
- [ ] Verify everyone is available
- [ ] Review launch plan

---

## T-1 Hour: Final Countdown

### System Check
- [ ] All services running
- [ ] No active incidents
- [ ] Error rate < 0.1%
- [ ] Response times normal
- [ ] Database healthy
- [ ] Cache healthy

### Deployment Freeze
- [ ] Implement deployment freeze (no new changes)
- [ ] All pending PRs on hold
- [ ] Only critical hotfixes allowed

### Communication
- [ ] Send "launching in 1 hour" message
- [ ] Post on #launch-day channel
- [ ] Notify support team

---

## T-0: Launch 🚀

### Go/No-Go Decision

**Checklist**:
- [ ] All systems green
- [ ] Team ready
- [ ] Support ready
- [ ] No active incidents
- [ ] Backups verified

**Decision Makers**:
- Engineering Lead: GO / NO-GO
- DevOps Lead: GO / NO-GO
- CTO: GO / NO-GO

**If all GO**: Proceed to launch
**If any NO-GO**: Hold and investigate

### Launch Steps

#### 1. Deploy Production (5 minutes)
```bash
# Deploy backend
cd backend
git pull origin main
npm ci --production
npm run build
pm2 reload servio-backend

# Verify deployment
curl https://api.servio.app/health
```

#### 2. Verify Health (2 minutes)
```bash
# Run smoke tests
./scripts/smoke-tests.sh

# Check error rates
curl https://api.servio.app/health/detailed | jq .services
```

#### 3. Enable All Features (1 minute)
```bash
# Enable feature flags (if any)
curl -X POST https://api.servio.app/api/admin/features \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"all_enabled": true}'
```

#### 4. Announce Launch (2 minutes)
- [ ] Update status page: "All systems operational"
- [ ] Post announcement on social media
- [ ] Send email to beta users
- [ ] Post in #launch-day channel

---

## T+15 Minutes: Initial Monitoring

### Critical Metrics Check

```bash
# Get current metrics
curl https://api.servio.app/health/detailed | jq

# Check error rate
# Target: < 0.1%

# Check response times
# Target: p95 < 500ms

# Check database
curl https://api.servio.app/health/database/stats | jq
# Target: connections < 15/20

# Check cache
curl https://api.servio.app/health/cache/stats | jq
# Target: hit rate > 70%
```

### Monitoring Dashboard
- [ ] Open Sentry dashboard
- [ ] Open Grafana dashboard
- [ ] Open CloudWatch dashboard
- [ ] Monitor #alerts Slack channel

### User Activity
- [ ] Check user signups
- [ ] Check order creation
- [ ] Check API usage
- [ ] Monitor support tickets

---

## T+30 Minutes: Detailed Assessment

### Performance Analysis
```bash
# Get performance metrics
curl https://api.servio.app/health/system | jq

# CPU usage: < 70% ✓
# Memory usage: < 85% ✓
# Disk usage: < 80% ✓
```

### Error Analysis
- [ ] Review Sentry for errors
- [ ] Check error types
- [ ] Verify no critical errors
- [ ] Check error patterns

### User Feedback
- [ ] Monitor support tickets
- [ ] Check social media mentions
- [ ] Review user feedback
- [ ] Address any immediate concerns

---

## T+1 Hour: Critical Monitoring Phase

### System Health Report

**Create report in #launch-day**:
```
🚀 LAUNCH STATUS (T+1h)

✅ System Status: All systems operational
✅ Error Rate: 0.05% (target: <0.1%)
✅ Response Time (p95): 287ms (target: <500ms)
✅ Active Users: 47
✅ Orders Created: 12
✅ Support Tickets: 2 (non-critical)

Database:
- Connections: 8/20
- CPU: 45%
- Memory: 62%

Cache:
- Hit Rate: 78%
- Keys: 1,247

Next update in 1 hour.
```

### Issue Triage
- [ ] List any issues encountered
- [ ] Categorize by severity
- [ ] Assign owners
- [ ] Set resolution timelines

### Team Check-In
- [ ] Quick team sync in #launch-day
- [ ] Address any concerns
- [ ] Celebrate small wins

---

## T+2 Hours: Continued Monitoring

### Metrics Dashboard Check
- [ ] Error rate trending
- [ ] Response time trending
- [ ] User activity trending
- [ ] Resource usage trending

### Proactive Monitoring
```bash
# Check for slow queries
psql $DATABASE_URL -c "
  SELECT query, calls, mean_time, max_time
  FROM pg_stat_statements
  WHERE mean_time > 100
  ORDER BY mean_time DESC
  LIMIT 10;
"

# Check for memory trends
pm2 monit
```

---

## T+4 Hours: Initial Assessment

### Key Metrics Review

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Uptime | 100% | __% | ⬜ |
| Error Rate | <0.1% | __% | ⬜ |
| Response Time (p95) | <500ms | __ms | ⬜ |
| Orders Created | N/A | __ | ⬜ |
| User Signups | N/A | __ | ⬜ |
| Support Tickets | N/A | __ | ⬜ |

### Success Criteria

**Launch is successful if:**
- ✅ Error rate < 0.1%
- ✅ Response time p95 < 500ms
- ✅ No P0/P1 incidents
- ✅ Core features working
- ✅ Users able to create accounts
- ✅ Users able to create orders

**Launch needs attention if:**
- ⚠️ Error rate 0.1% - 1%
- ⚠️ Response time p95 500ms - 1000ms
- ⚠️ Minor P2 incidents
- ⚠️ Non-critical features degraded

**Launch is failing if:**
- ❌ Error rate > 1%
- ❌ Response time p95 > 1000ms
- ❌ P0/P1 incidents
- ❌ Core features broken
- ❌ Users unable to sign up/login

### Go/No-Go for Public Announcement

**Decision Point**: Should we proceed with wider public announcement?

- Engineering Lead: GO / HOLD / ROLLBACK
- CTO: GO / HOLD / ROLLBACK

**If GO**: Proceed with marketing
**If HOLD**: Continue monitoring, delay announcement
**If ROLLBACK**: Initiate rollback procedure

---

## T+8 Hours: Stability Check

### Extended Monitoring
- [ ] Review 8-hour trends
- [ ] Identify any patterns
- [ ] Check for resource leaks
- [ ] Verify auto-scaling

### Team Rotation
- [ ] Hand off to next shift (if applicable)
- [ ] Brief new team on status
- [ ] Document any issues
- [ ] Update runbook with learnings

---

## T+24 Hours: Stabilization Review

### Comprehensive Review

**System Health**:
```bash
# Generate 24-hour report
./scripts/generate-health-report.sh --last-24h
```

**Metrics Summary**:
- [ ] Calculate average error rate
- [ ] Calculate average response time
- [ ] Calculate uptime percentage
- [ ] Document any incidents

### Post-Launch Meeting

**Agenda**:
1. Review metrics
2. Discuss issues encountered
3. Celebrate successes
4. Identify improvements
5. Plan next steps

### Documentation
- [ ] Update CHANGELOG
- [ ] Document lessons learned
- [ ] Update runbooks if needed
- [ ] File issues for improvements

### Lift Deployment Freeze
- [ ] Resume normal deployment schedule
- [ ] Prioritize critical fixes
- [ ] Plan iteration #1

---

## Emergency Procedures

### If Error Rate > 1%

1. **Immediate Actions**:
   ```bash
   # Check Sentry for error patterns
   # Identify most common errors
   ```

2. **Quick Fixes**:
   - Restart affected services
   - Clear cache if needed
   - Scale horizontally

3. **If Not Resolved**: Consider rollback

### If Response Time > 1000ms

1. **Check Resources**:
   ```bash
   # Database
   curl https://api.servio.app/health/database/stats
   
   # Memory
   curl https://api.servio.app/health/system
   ```

2. **Quick Fixes**:
   - Scale horizontally
   - Clear cache
   - Kill long-running queries

3. **If Not Resolved**: Investigate slow queries

### If P0 Incident

1. **Activate Incident Response**:
   - Create #incident-YYYYMMDD channel
   - Notify CTO immediately
   - Assign incident commander

2. **Follow Incident Response Guide**:
   - See INCIDENT_RESPONSE.md
   - Communicate clearly
   - Document everything

3. **Consider Rollback**:
   - If cannot resolve in 30 minutes
   - Follow rollback procedure

---

## Rollback Procedure

### Rollback Decision Matrix

| Condition | Action |
|-----------|--------|
| Error rate >5% for 15 min | ROLLBACK |
| P0 incident, no fix in 30 min | ROLLBACK |
| Data loss or corruption | ROLLBACK |
| Security breach | ROLLBACK |
| Core features broken | ROLLBACK |

### Rollback Steps

See DEPLOYMENT_RUNBOOK.md - Rollback Section

---

## Communication Templates

### Launch Announcement
```
🎉 We're live! 🎉

Servio Restaurant Platform is now available.
[Brief description of what it does]

Get started: https://servio.app
Documentation: https://docs.servio.app

#servio #restauranttech #launch
```

### Issue Notification
```
We are currently experiencing [issue].
Our team is working on a resolution.
ETA: [timeframe]

Status updates: https://status.servio.app
```

### All Clear
```
✅ All systems operational.
The issue has been resolved.
Thank you for your patience.
```

---

## Celebration! 🎉

### After T+24h and Stable

- [ ] Send team thank you message
- [ ] Celebrate with team
- [ ] Share success metrics
- [ ] Plan team appreciation event

**Congratulations on the successful launch!**

---

## Appendix: Quick Commands

```bash
# Health check
curl https://api.servio.app/health/detailed | jq

# Restart application
pm2 restart servio-backend

# View logs
pm2 logs servio-backend --lines 500

# Enable maintenance mode
curl -X POST https://api.servio.app/api/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true}'

# Rollback
git revert HEAD
npm run build
pm2 restart servio-backend
```
