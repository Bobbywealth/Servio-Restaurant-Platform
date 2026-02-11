# Servio Weekly Error Report

**Report Period:** [Start Date] - [End Date]
**Generated:** [Date]
**Report Type:** Production Reliability & Error Visibility

---

## Executive Summary

This report summarizes errors and incidents that occurred during the reporting period. It includes error rates, trends, and actionable insights for improving system reliability.

### Key Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Errors | [Number] | < 100 | [✅/❌] |
| Error Rate | [Percentage]% | < 1% | [✅/❌] |
| Mean Time to Recovery (MTTR) | [Hours] | < 4 hours | [✅/❌] |
| Uptime | [Percentage]% | > 99.9% | [✅/❌] |
| Critical Errors | [Number] | 0 | [✅/❌] |

---

## Error Trends

### Error Rate Over Time
```
[Insert chart showing error rate trends over the week]
```

### Error Types Distribution
```
[Insert pie chart showing error type distribution]
```

---

## Top Errors (P0 & P1)

### 1. [Error Name]
**Severity:** P0 / P1
**Frequency:** [Number] occurrences
**Impact:** [Description of impact]
**Root Cause:** [Description of root cause]
**Status:** [Open / Fixed / In Progress]
**Fix Plan:** [Description of fix plan]
**Assigned To:** [Team/Person]

**Reproduction Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Console/Network Evidence:**
```
[Insert relevant console/network logs]
```

**Request ID:** [Insert requestId for correlation]

---

### 2. [Error Name]
**Severity:** P0 / P1
**Frequency:** [Number] occurrences
**Impact:** [Description of impact]
**Root Cause:** [Description of root cause]
**Status:** [Open / Fixed / In Progress]
**Fix Plan:** [Description of fix plan]
**Assigned To:** [Team/Person]

---

### 3. [Error Name]
**Severity:** P0 / P1
**Frequency:** [Number] occurrences
**Impact:** [Description of impact]
**Root Cause:** [Description of root cause]
**Status:** [Open / Fixed / In Progress]
**Fix Plan:** [Description of fix plan]
**Assigned To:** [Team/Person]

---

## Error by Page/Route

| Page/Route | Error Count | Error Rate | Top Error | Status |
|------------|-------------|------------|-----------|--------|
| /dashboard/staff | [Number] | [Percentage]% | [Error Name] | [✅/❌] |
| /dashboard/timeclock | [Number] | [Percentage]% | [Error Name] | [✅/❌] |
| /dashboard/menu-management | [Number] | [Percentage]% | [Error Name] | [✅/❌] |
| /dashboard/orders | [Number] | [Percentage]% | [Error Name] | [✅/❌] |
| /dashboard/assistant | [Number] | [Percentage]% | [Error Name] | [✅/❌] |
| /login | [Number] | [Percentage]% | [Error Name] | [✅/❌] |
| Other pages | [Number] | [Percentage]% | [Error Name] | [✅/❌] |

---

## Error by Integration

| Integration | Status | Last Failure | Frequency | Action Required |
|-------------|--------|--------------|-----------|-----------------|
| SMS (Twilio) | [Healthy/Unhealthy] | [Timestamp] | [Number] | [Yes/No] |
| Email (Nodemailer) | [Healthy/Unhealthy] | [Timestamp] | [Number] | [Yes/No] |
| Voice Agent (OpenAI) | [Healthy/Unhealthy] | [Timestamp] | [Number] | [Yes/No] |
| Payment (Stripe) | [Healthy/Unhealthy] | [Timestamp] | [Number] | [Yes/No] |
| Database | [Healthy/Unhealthy] | [Timestamp] | [Number] | [Yes/No] |

---

## Silent Failures Identified

### A. Empty Catch Blocks
- [Page/Component]: [Description]
- [Page/Component]: [Description]
- [Page/Component]: [Description]

### B. Swallowed Promise Rejections
- [Page/Component]: [Description]
- [Page/Component]: [Description]
- [Page/Component]: [Description]

### C. UI Stuck on Loading
- [Page/Component]: [Description]
- [Page/Component]: [Description]
- [Page/Component]: [Description]

### D. Missing Fallbacks
- [Page/Component]: [Description]
- [Page/Component]: [Description]
- [Page/Component]: [Description]

### E. Hydration Errors
- [Page/Component]: [Description]
- [Page/Component]: [Description]
- [Page/Component]: [Description]

### F. Failed Third-Party Scripts
- [Script]: [Description]
- [Script]: [Description]
- [Script]: [Description]

---

## Auth-Specific Failure Modes

### Redirect Loops
- [Description of any redirect loop issues]
- [Count of occurrences]
- [Status]

### Token/Cookie Issues
- [Description of any token/cookie issues]
- [Count of occurrences]
- [Status]

### 401/403 Handling
- [Description of any 401/403 handling issues]
- [Count of occurrences]
- [Status]

---

## Integration Health

### SMS Integration
- **Status:** [Healthy/Unhealthy]
- **Last Failure:** [Timestamp]
- **Failure Frequency:** [Number]
- **Action Required:** [Yes/No]
- **Notes:** [Additional details]

### Email Integration
- **Status:** [Healthy/Unhealthy]
- **Last Failure:** [Timestamp]
- **Failure Frequency:** [Number]
- **Action Required:** [Yes/No]
- **Notes:** [Additional details]

### Voice Agent Integration
- **Status:** [Healthy/Unhealthy]
- **Last Failure:** [Timestamp]
- **Failure Frequency:** [Number]
- **Action Required:** [Yes/No]
- **Notes:** [Additional details]

### Payment Integration
- **Status:** [Healthy/Unhealthy]
- **Last Failure:** [Timestamp]
- **Failure Frequency:** [Number]
- **Action Required:** [Yes/No]
- **Notes:** [Additional details]

---

## Performance Metrics

### Page Load Times
| Page | Avg Load Time | P95 Load Time | P99 Load Time | Status |
|------|---------------|---------------|---------------|--------|
| /dashboard/staff | [ms] | [ms] | [ms] | [✅/❌] |
| /dashboard/timeclock | [ms] | [ms] | [ms] | [✅/❌] |
| /dashboard/menu-management | [ms] | [ms] | [ms] | [✅/❌] |
| /dashboard/orders | [ms] | [ms] | [ms] | [✅/❌] |
| /dashboard/assistant | [ms] | [ms] | [ms] | [✅/❌] |
| /login | [ms] | [ms] | [ms] | [✅/❌] |

### API Latency
| Endpoint | Avg Latency | P95 Latency | P99 Latency | Status |
|----------|-------------|-------------|-------------|--------|
| /api/restaurant/staff | [ms] | [ms] | [ms] | [✅/❌] |
| /api/timeclock/current-staff | [ms] | [ms] | [ms] | [✅/❌] |
| /api/staff/scheduling/schedules | [ms] | [ms] | [ms] | [✅/❌] |
| /api/auth/refresh | [ms] | [ms] | [ms] | [✅/❌] |

---

## Incident Summary

### Major Incidents
1. **[Incident Name]**
   - **Date:** [Date]
   - **Duration:** [Duration]
   - **Impact:** [Description]
   - **Root Cause:** [Description]
   - **Resolution:** [Description]
   - **Post-Mortem:** [Link to post-mortem]

2. **[Incident Name]**
   - **Date:** [Date]
   - **Duration:** [Duration]
   - **Impact:** [Description]
   - **Root Cause:** [Description]
   - **Resolution:** [Description]
   - **Post-Mortem:** [Link to post-mortem]

---

## Recommendations

### Immediate Actions (This Week)
1. [Action 1]
2. [Action 2]
3. [Action 3]

### Short-term Actions (Next 2 Weeks)
1. [Action 1]
2. [Action 2]
3. [Action 3]

### Long-term Actions (Next Month)
1. [Action 1]
2. [Action 2]
3. [Action 3]

---

## Monitoring & Alerting

### Active Alerts
- [Alert Name]: [Status] - [Last Triggered]
- [Alert Name]: [Status] - [Last Triggered]
- [Alert Name]: [Status] - [Last Triggered]

### Alert Thresholds
| Alert Type | Threshold | Status |
|------------|-----------|--------|
| Error Rate | > 5% | [✅/❌] |
| P0 Errors | > 0 | [✅/❌] |
| Integration Failures | > 3 | [✅/❌] |
| API Latency (P95) | > 500ms | [✅/❌] |
| Page Load Time (P95) | > 3s | [✅/❌] |

---

## Request ID Correlation

### How to Use Request IDs
1. **Find Error:** Search for error in monitoring tool (Sentry, etc.)
2. **Get Request ID:** Copy requestId from error details
3. **Search Logs:** Use requestId to find corresponding server logs
4. **Trace Flow:** Follow requestId through:
   - Client → API → DB → Integrations
5. **Resolve Issue:** Use logs to identify root cause

### Example Trace
```
Client Request → requestId: abc-123-def-456
  ↓
API Handler → requestId: abc-123-def-456
  ↓
Database Query → requestId: abc-123-def-456
  ↓
Integration Call (SMS) → requestId: abc-123-def-456
```

---

## Success Metrics

### Production Reliability Goals
- [ ] No uncaught errors in browser console during normal flows
- [ ] Every API error includes requestId and standardized response shape
- [ ] Every page has explicit loading/empty/error states
- [ ] Any reported bug can be traced end-to-end via requestId within 2 minutes
- [ ] Weekly error report can be generated automatically
- [ ] Error rate < 1% for production
- [ ] Mean time to recovery (MTTR) < 15 minutes for P0/P1 errors
- [ ] 99.9% uptime for core features

---

## Next Steps

### This Week
- [ ] Review and address all P0 errors
- [ ] Implement fixes for top 5 P1 errors
- [ ] Add Error Boundaries to all pages
- [ ] Add loading states to all async operations

### Next 2 Weeks
- [ ] Fix all silent failures identified
- [ ] Implement structured logging across all endpoints
- [ ] Set up monitoring integration (Sentry)
- [ ] Create admin diagnostics page

### Next Month
- [ ] Complete error handling overhaul
- [ ] Set up automated weekly error reports
- [ ] Implement request correlation end-to-end
- [ ] Add performance monitoring

---

## Appendix

### A. Error Codes Reference
| Code | Description | Status Code |
|------|-------------|-------------|
| VALIDATION_ERROR | Request validation failed | 400 |
| AUTH_REQUIRED | Authentication required | 401 |
| AUTHORIZATION_ERROR | Access denied | 403 |
| NOT_FOUND | Resource not found | 404 |
| CONFLICT | Resource already exists | 409 |
| RATE_LIMIT_EXCEEDED | Too many requests | 429 |
| INTERNAL_ERROR | Internal server error | 500 |
| DATABASE_ERROR | Database operation failed | 500 |
| INTEGRATION_ERROR_SMS | SMS integration failed | 502 |
| INTEGRATION_ERROR_EMAIL | Email integration failed | 502 |
| INTEGRATION_ERROR_VOICE | Voice agent integration failed | 502 |
| INTEGRATION_ERROR_PAYMENT | Payment integration failed | 502 |

### B. Monitoring Tool Setup
- **Error Tracking:** Sentry (https://sentry.io)
- **Logging:** Winston/Pino (structured JSON logs)
- **Monitoring:** OpenTelemetry
- **Alerting:** Sentry alerts + custom alerts
- **Log Storage:** Render logs (production), local logs (dev)

### C. Contact Information
- **Tech Lead:** [Name]
- **On-Call:** [Name] - [Phone]
- **Slack Channel:** #servio-production
- **Email:** [Email]

---

**Report Generated By:** Servio Production Reliability Team
**Next Report:** [Date]
**Review Date:** [Date]
