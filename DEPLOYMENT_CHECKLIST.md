# Servio Assistant Production Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Create production `.env` file in `backend/` directory
- [ ] Set `NODE_ENV=production`
- [ ] Configure `OPENAI_API_KEY` with valid API key
- [ ] Set production database URL in `DATABASE_URL`
- [ ] Generate secure JWT secret (min 32 characters) for `JWT_SECRET`
- [ ] Configure `SERVER_URL` with your API domain (https://your-api-domain.com)
- [ ] Configure `FRONTEND_URL` with your frontend domain
- [ ] Set `CORS_ORIGIN` to your frontend domain(s)
- [ ] Optional: Configure `VAPI_API_KEY` for phone integration
- [ ] Optional: Configure `ELEVENLABS_API_KEY` for alternative TTS

### 2. SSL/HTTPS Setup (Critical for Assistant)
Choose one of these approaches:

#### Option A: Nginx Reverse Proxy (Recommended)
- [ ] Install SSL certificate on server
- [ ] Configure Nginx with SSL termination
- [ ] Set up proxy to backend on port 3002
- [ ] Test HTTPS access to API endpoints
- [ ] Verify WebRTC microphone access works

#### Option B: Cloud Load Balancer
- [ ] Configure cloud provider's load balancer with SSL
- [ ] Point to backend service on port 3002
- [ ] Update DNS records
- [ ] Test SSL certificate validity

#### Option C: Application-Level SSL
- [ ] Add SSL certificates to backend container
- [ ] Update Dockerfile to include SSL setup
- [ ] Configure Express.js with HTTPS server
- [ ] Test secure connections

### 3. Database Setup
- [ ] Run database migrations
- [ ] Create required indexes for performance:
  ```sql
  CREATE INDEX idx_orders_status ON orders(status);
  CREATE INDEX idx_orders_created_at ON orders(created_at);
  CREATE INDEX idx_inventory_quantity ON inventory(quantity);
  CREATE INDEX idx_menu_items_available ON menu_items(available);
  CREATE INDEX idx_tasks_status ON tasks(status);
  ```
- [ ] Test database connectivity from backend

### 4. Frontend Configuration
- [ ] Set `BACKEND_URL` to production API URL
- [ ] Set `NEXT_PUBLIC_BACKEND_URL` to production API URL
- [ ] Set `NEXT_PUBLIC_WS_URL` for WebSocket connections
- [ ] Configure `NEXT_PUBLIC_ASSISTANT_ENABLED=true`
- [ ] Build frontend for production: `npm run build`

## Deployment Steps

### 5. Backend Deployment
- [ ] Build backend: `npm run build`
- [ ] Install production dependencies: `npm ci --only=production`
- [ ] Start backend service: `npm start`
- [ ] Verify service starts without errors
- [ ] Check health endpoint: `GET /api/assistant/health`

### 6. Frontend Deployment
- [ ] Deploy frontend to hosting platform
- [ ] Configure environment variables on hosting platform
- [ ] Verify frontend can connect to backend API
- [ ] Test static assets loading correctly

### 7. Docker Deployment (Alternative)
- [ ] Build Docker image: `docker build -t servio-backend ./backend`
- [ ] Create `.env` file for container
- [ ] Run container: `docker run -d --env-file .env -p 3002:3002 servio-backend`
- [ ] Test container health

## Post-Deployment Testing

### 8. Core Functionality Tests
- [ ] Health check passes: `curl https://your-domain.com/api/assistant/health`
- [ ] Status endpoint returns correct data: `curl https://your-domain.com/api/assistant/status`
- [ ] User authentication works
- [ ] Assistant permissions are enforced

### 9. Assistant Feature Tests
- [ ] **CRITICAL**: Microphone access works in browser (requires HTTPS)
- [ ] Audio upload and processing works
- [ ] Text input processing works  
- [ ] Speech-to-text transcription works
- [ ] Text-to-speech audio generation works
- [ ] Wake word detection functions (if enabled)
- [ ] Voice responses play correctly
- [ ] Rate limiting is enforced (test with rapid requests)

### 10. Integration Tests
- [ ] Order management commands work
- [ ] Inventory queries and updates work
- [ ] Menu availability (86 items) functions
- [ ] Task management works
- [ ] Audit logging captures actions

### 11. Error Handling Tests
- [ ] Invalid audio files rejected gracefully
- [ ] API key errors handled properly
- [ ] Network timeouts handled correctly
- [ ] Rate limit responses are appropriate
- [ ] Unauthorized access blocked

## Performance & Monitoring

### 12. Performance Verification
- [ ] Response times under 5 seconds for typical requests
- [ ] Audio processing completes within reasonable time
- [ ] Memory usage stable over time
- [ ] No memory leaks detected
- [ ] Database queries optimized

### 13. Monitoring Setup
- [ ] Health check endpoint accessible
- [ ] Logs being written correctly
- [ ] Error tracking configured
- [ ] Metrics collection active
- [ ] Alerts configured for critical issues

### 14. Security Verification
- [ ] API endpoints require authentication
- [ ] CORS configured with specific origins (not wildcards)
- [ ] File upload limits enforced
- [ ] Input validation working
- [ ] No sensitive data in logs
- [ ] HTTPS redirects working

## Production Readiness

### 15. Scalability Considerations
- [ ] Rate limits appropriate for expected traffic
- [ ] Database connection pooling configured
- [ ] Conversation history cleanup working
- [ ] Resource monitoring in place

### 16. Backup & Recovery
- [ ] Database backups scheduled
- [ ] Configuration files backed up
- [ ] SSL certificates have renewal process
- [ ] Disaster recovery plan documented

### 17. Documentation
- [ ] Production setup guide updated
- [ ] API documentation current
- [ ] Troubleshooting guide available
- [ ] Contact information for support

## Go-Live Checklist

### 18. Final Pre-Launch
- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Security measures in place
- [ ] Monitoring active
- [ ] Team trained on new features

### 19. Launch
- [ ] Deploy to production
- [ ] Update DNS if needed
- [ ] Announce to users
- [ ] Monitor for issues

### 20. Post-Launch
- [ ] Monitor error rates
- [ ] Check user feedback
- [ ] Verify all features working
- [ ] Address any issues promptly

## Common Issues & Solutions

### Issue: Microphone Not Working
**Cause**: Not using HTTPS
**Solution**: Ensure SSL certificate is installed and site accessible via HTTPS

### Issue: "Service Unavailable" Errors  
**Cause**: OpenAI API key missing/invalid
**Solution**: Verify API key in environment variables and check OpenAI account

### Issue: Slow Response Times
**Cause**: Large conversation history or network issues
**Solution**: Check conversation history limits and network connectivity

### Issue: Rate Limit Errors
**Cause**: Too many requests
**Solution**: Adjust rate limiting configuration or implement queuing

### Issue: Audio Upload Fails
**Cause**: File too large or unsupported format
**Solution**: Check file size limits and supported audio formats

## Support Contacts

- **Technical Issues**: Check application logs and monitoring dashboard
- **OpenAI API Issues**: Verify API key and account status
- **Infrastructure Issues**: Check server resources and network connectivity
- **Feature Requests**: Document and prioritize for future releases

## Success Criteria

The assistant is considered successfully deployed when:
- ✅ All health checks pass
- ✅ Users can record and process audio
- ✅ Text input processing works correctly
- ✅ All restaurant operations are accessible via assistant
- ✅ Error rates below 5%
- ✅ Average response times under 3 seconds
- ✅ No critical security vulnerabilities
- ✅ Monitoring and alerting functional

---

**Deployment Complete**: Once all items are checked, the Servio Assistant is ready for production use with full functionality, security, and monitoring in place.