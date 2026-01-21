# Servio Platform Deployment Runbook

## Overview
This runbook provides step-by-step instructions for deploying the Servio Restaurant Platform to production.

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing in CI/CD
- [ ] Code review completed and approved
- [ ] No linter errors or warnings
- [ ] Security scan passed
- [ ] Performance tests passed

### Database
- [ ] Database migrations reviewed and tested
- [ ] Migration rollback plan documented
- [ ] Database backup completed in last 24 hours
- [ ] Verify backup integrity

### Configuration
- [ ] Environment variables configured in production
- [ ] Secrets rotated (if needed)
- [ ] Feature flags configured
- [ ] Third-party API keys verified and valid
- [ ] Rate limits configured appropriately

### Infrastructure
- [ ] SSL certificates valid (not expiring soon)
- [ ] DNS configured correctly
- [ ] CDN configured for static assets
- [ ] Load balancer healthy
- [ ] Auto-scaling configured
- [ ] Redis cluster healthy

### Monitoring
- [ ] Sentry APM configured
- [ ] Metrics dashboards ready
- [ ] Alert notifications configured
- [ ] Log aggregation working
- [ ] Health check endpoints responding

### Team
- [ ] Team notified of deployment window
- [ ] On-call engineer identified
- [ ] Rollback plan communicated
- [ ] Support team briefed on changes

## Deployment Steps

### 1. Enable Maintenance Mode (if needed)
```bash
# Set maintenance mode
curl -X POST https://api.servio.app/api/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true, "message": "System maintenance in progress"}'
```

### 2. Create Database Backup
```bash
# Run backup script
./scripts/backup-database.sh production

# Verify backup
./scripts/test-restore.sh /var/backups/servio/latest
```

### 3. Run Database Migrations
```bash
# Connect to production database
psql $DATABASE_URL

# Run migrations
\i backend/src/database/migrations/015_production_indexes.sql

# Verify migrations
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;
```

### 4. Deploy Backend Service

#### Option A: Docker Deployment
```bash
# Pull latest image
docker pull servio/backend:latest

# Stop current container
docker stop servio-backend

# Start new container
docker run -d \
  --name servio-backend \
  --env-file .env.production \
  -p 3002:3002 \
  --restart unless-stopped \
  servio/backend:latest

# Check logs
docker logs -f servio-backend
```

#### Option B: Node.js Deployment
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm ci --production

# Build application
npm run build

# Restart PM2 process
pm2 reload servio-backend

# Check status
pm2 status
pm2 logs servio-backend --lines 100
```

### 5. Deploy Frontend Service

#### Option A: Netlify
```bash
# Deploy to Netlify
netlify deploy --prod --dir=frontend/.next

# Verify deployment
curl https://servio.app
```

#### Option B: Vercel
```bash
# Deploy to Vercel
vercel deploy --prod

# Verify deployment
vercel ls
```

### 6. Run Smoke Tests
```bash
# Test health endpoint
curl https://api.servio.app/health

# Expected response:
# {"status":"ok","timestamp":"...","version":"1.0.0"}

# Test authentication
curl -X POST https://api.servio.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}'

# Test API endpoint
curl https://api.servio.app/api/restaurants \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Monitor Error Rates
```bash
# Check Sentry for errors
# Visit: https://sentry.io/organizations/servio/issues/

# Check application logs
tail -f /var/log/servio/application.log

# Check error rate in metrics
curl https://api.servio.app/health/detailed
```

### 8. Verify Key User Flows

#### Test Order Creation
```bash
curl -X POST https://api.servio.app/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "...",
    "type": "takeout",
    "channel": "online",
    "items": [{"menuItemId": "...", "quantity": 1, "price": 12.99}]
  }'
```

#### Test Assistant Query
```bash
curl -X POST https://api.servio.app/api/assistant/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me todays orders",
    "restaurantId": "..."
  }'
```

### 9. Disable Maintenance Mode
```bash
curl -X POST https://api.servio.app/api/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false}'
```

### 10. Monitor for 1 Hour
- [ ] Check error rates every 5 minutes (should be <0.1%)
- [ ] Check response times (p95 <500ms)
- [ ] Check database connections (not exhausted)
- [ ] Check memory usage (<85%)
- [ ] Check CPU usage (<70%)
- [ ] Monitor user-reported issues

## Post-Deployment

### Documentation
- [ ] Update CHANGELOG.md
- [ ] Document any issues encountered
- [ ] Update deployment timestamp in Sentry

### Communication
- [ ] Notify team that deployment is complete
- [ ] Announce new features to users (if applicable)
- [ ] Update status page

### Monitoring
- [ ] Set up alerts for new features
- [ ] Review performance metrics
- [ ] Check for any anomalies

## Rollback Procedure

### When to Rollback
- Error rate >1%
- Critical functionality broken
- Database corruption
- Security vulnerability introduced

### Rollback Steps

1. **Stop new deployment**
```bash
# Stop current service
pm2 stop servio-backend
# or
docker stop servio-backend
```

2. **Revert to previous version**
```bash
# Using Git
git revert HEAD
git push origin main

# Using Docker
docker run servio/backend:previous-tag

# Using PM2
pm2 start servio-backend@previous
```

3. **Rollback database (if needed)**
```bash
# Restore from backup
./scripts/restore-database.sh /var/backups/servio/pre_deploy_backup.sql.gz

# Or run down migration
psql $DATABASE_URL -c "-- run rollback SQL"
```

4. **Clear cache**
```bash
# Flush Redis cache
redis-cli FLUSHDB

# Clear CDN cache
curl -X POST https://cdn.servio.app/purge-cache
```

5. **Verify rollback**
```bash
# Test health endpoint
curl https://api.servio.app/health

# Check version
curl https://api.servio.app/api | jq .version

# Run smoke tests
./scripts/smoke-tests.sh
```

## Common Issues

### Database Connection Pool Exhausted
```bash
# Check pool status
curl https://api.servio.app/health/database/stats

# Restart application to reset pool
pm2 restart servio-backend
```

### High Memory Usage
```bash
# Check memory
curl https://api.servio.app/health/system

# Restart application
pm2 restart servio-backend

# Scale horizontally if needed
pm2 scale servio-backend +2
```

### Redis Connection Failed
```bash
# Check Redis status
redis-cli ping

# Restart Redis
sudo systemctl restart redis

# Verify connection
redis-cli INFO
```

## Emergency Contacts

- **On-Call Engineer**: [Your Phone]
- **DevOps Lead**: [Phone]
- **CTO**: [Phone]
- **Sentry Alerts**: alerts@servio.app
- **Slack Channel**: #servio-incidents

## Useful Commands

### Check Application Status
```bash
pm2 status
pm2 logs servio-backend
pm2 monit
```

### Database Queries
```bash
# Active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Long-running queries
psql $DATABASE_URL -c "SELECT pid, now() - query_start AS duration, query 
  FROM pg_stat_activity 
  WHERE state = 'active' 
  ORDER BY duration DESC;"
```

### Redis Commands
```bash
# Check keys
redis-cli KEYS "servio:*"

# Get stats
redis-cli INFO stats

# Monitor commands
redis-cli MONITOR
```

## Post-Mortem Template

If deployment fails, use this template:

```markdown
# Post-Mortem: [Deployment Date]

## Summary
Brief description of what happened

## Timeline
- HH:MM - Deployment started
- HH:MM - Issue detected
- HH:MM - Rollback initiated
- HH:MM - System restored

## Root Cause
What caused the issue

## Impact
- Users affected: X
- Duration: X minutes
- Data lost: Yes/No

## Resolution
How it was fixed

## Lessons Learned
What we learned

## Action Items
- [ ] Fix X
- [ ] Improve Y
- [ ] Add monitoring for Z
```

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Security Guidelines](./SECURITY.md)
- [Monitoring Dashboard](https://grafana.servio.app)
- [Sentry Dashboard](https://sentry.io/servio)
