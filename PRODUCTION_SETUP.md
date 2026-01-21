# Servio Assistant Production Setup Guide

This guide provides step-by-step instructions to set up the Servio AI Assistant for production deployment.

## Prerequisites

1. **OpenAI API Account**: Required for speech-to-text, text-to-speech, and LLM functionality
2. **HTTPS Domain**: Required for WebRTC audio recording in browsers  
3. **Production Database**: PostgreSQL recommended
4. **VAPI Account**: Optional, for phone integration

## Environment Configuration

### Backend (.env)

Create a `.env` file in the `backend/` directory with the following configuration:

```bash
# Core Application
NODE_ENV=production
PORT=3002
SERVER_URL=https://your-api-domain.com
FRONTEND_URL=https://your-frontend-domain.com

# Database
DATABASE_URL=your-production-database-url

# Security
JWT_SECRET=your-super-secure-jwt-secret-here-min-32-chars
JWT_EXPIRES_IN=30d

# OpenAI Configuration (Required for Assistant)
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=alloy
OPENAI_STT_MODEL=whisper-1

# VAPI Configuration (For phone integration - Optional)
VAPI_API_KEY=your-vapi-api-key-here
VAPI_WEBHOOK_SECRET=your-vapi-webhook-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ASSISTANT_RATE_LIMIT_MAX=20

# Audio Processing
MAX_AUDIO_FILE_SIZE=25MB
AUDIO_TEMP_DIR=/tmp/servio-audio

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/servio/app.log

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com

# Assistant Configuration
ASSISTANT_CONVERSATION_TIMEOUT=1800000
ASSISTANT_MAX_HISTORY_LENGTH=50
ASSISTANT_DEFAULT_LANGUAGE=en
ASSISTANT_WAKE_WORD_ENABLED=true
```

### Frontend Environment

Set the following environment variables for your frontend deployment:

```bash
BACKEND_URL=https://your-api-domain.com
NEXT_PUBLIC_BACKEND_URL=https://your-api-domain.com
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_WS_URL=wss://your-api-domain.com
NEXT_PUBLIC_ASSISTANT_ENABLED=true
NEXT_PUBLIC_WAKE_WORD_ENABLED=true
NEXT_PUBLIC_TTS_ENABLED=true
```

## SSL/HTTPS Requirements

### Why HTTPS is Required
- **WebRTC Audio Recording**: Modern browsers require HTTPS for microphone access
- **Service Workers**: Wake word detection requires HTTPS in production
- **Security**: Protects API keys and user data in transit

### SSL Setup Options

#### Option 1: Reverse Proxy (Recommended)
Use Nginx or similar to handle SSL termination:

```nginx
server {
    listen 443 ssl http2;
    server_name your-api-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Special handling for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Option 2: Cloud Load Balancer
- Configure your cloud provider's load balancer to handle SSL
- Point to your backend service running on port 3002

#### Option 3: Docker with SSL
Update the Dockerfile to include SSL certificates:

```dockerfile
# Copy SSL certificates
COPY ssl/certificate.crt /app/ssl/
COPY ssl/private.key /app/ssl/

# Add SSL environment variables
ENV SSL_CERT_PATH=/app/ssl/certificate.crt
ENV SSL_KEY_PATH=/app/ssl/private.key
```

## API Endpoints Configuration

The assistant uses these main endpoints:

- `POST /api/assistant/process-audio` - Audio processing with rate limiting
- `POST /api/assistant/process-text` - Text processing with rate limiting  
- `GET /api/assistant/status` - Health check and feature availability
- `GET /api/assistant/tools` - Available assistant tools

### Rate Limiting
- **Default**: 20 requests per 15 minutes per IP
- **Configurable**: Set `ASSISTANT_RATE_LIMIT_MAX` in environment
- **Per-endpoint**: Different limits for audio vs text processing

## Database Setup

### Required Tables
The assistant uses existing tables:
- `orders` - For order management
- `inventory` - For inventory tracking
- `menu_items` - For menu availability
- `tasks` - For task management
- `audit_logs` - For logging assistant actions

### Indexes for Performance
Ensure these indexes exist for optimal assistant performance:

```sql
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_inventory_quantity ON inventory(quantity);
CREATE INDEX idx_menu_items_available ON menu_items(available);
CREATE INDEX idx_tasks_status ON tasks(status);
```

## Security Considerations

### API Key Protection
- Store OpenAI API key in environment variables only
- Use secret management services in production
- Rotate keys regularly

### Rate Limiting
- Configure appropriate limits based on usage
- Monitor for abuse patterns
- Implement IP whitelisting if needed

### CORS Configuration
- Set specific origins, don't use wildcards in production
- Include both www and non-www versions if needed

### Audio File Security
- Validate file types and sizes
- Scan uploaded files for malware
- Set appropriate file system permissions
- Clean up temporary files regularly

## Monitoring and Health Checks

### Health Check Endpoint
The assistant provides a comprehensive health check at:
`GET /api/assistant/status`

This returns:
- Service status and environment
- Feature availability (STT, TTS, LLM, Wake Word, Phone)
- Configuration details
- System health metrics

### Logging
- Set `LOG_LEVEL=info` for production
- Monitor logs for error patterns
- Set up alerts for critical errors
- Use structured logging for better analysis

### Metrics to Monitor
- Response times for audio/text processing
- Error rates by endpoint
- Rate limit hits
- OpenAI API usage and costs
- Memory usage during audio processing

## Performance Optimization

### Audio Processing
- Use efficient audio formats (WebM, OGG preferred)
- Implement audio compression before upload
- Cache frequently used audio responses
- Use streaming for large audio files

### LLM Optimization
- Maintain conversation context efficiently
- Implement response caching for common queries
- Use appropriate OpenAI model (GPT-3.5-turbo for speed, GPT-4 for quality)
- Implement request batching where possible

### Frontend Optimization
- Lazy load assistant components
- Use Web Workers for wake word detection
- Implement progressive loading of features
- Cache assistant responses locally

## Testing Production Setup

### Pre-deployment Checklist
- [ ] HTTPS certificate valid and installed
- [ ] All environment variables configured
- [ ] OpenAI API key working and has sufficient credits
- [ ] Database migrations applied
- [ ] Rate limiting configured
- [ ] CORS origins set correctly
- [ ] SSL redirects working
- [ ] Health check endpoint responding
- [ ] Audio recording works in browser
- [ ] Text-to-speech playing correctly
- [ ] Wake word detection functioning (if enabled)
- [ ] Error handling working as expected
- [ ] Logs being written correctly

### Test Commands

```bash
# Test health endpoint
curl https://your-api-domain.com/api/assistant/status

# Test with authentication
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-api-domain.com/api/assistant/status

# Test audio upload (with valid audio file)
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "audio=@test-audio.wav" \
     https://your-api-domain.com/api/assistant/process-audio

# Test text processing
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"text":"Show me current orders"}' \
     https://your-api-domain.com/api/assistant/process-text
```

## Deployment Scripts

### Docker Deployment
Use the existing Dockerfile in the backend directory:

```bash
cd backend
docker build -t servio-backend .
docker run -d \
  --env-file .env \
  -p 3002:3002 \
  --name servio-backend \
  servio-backend
```

### Docker Compose (with SSL proxy)
Create a `docker-compose.prod.yml`:

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "3002:3002"
    volumes:
      - ./logs:/var/log/servio
      - ./uploads:/app/uploads

  frontend:
    build: ./frontend
    environment:
      - BACKEND_URL=https://your-api-domain.com
    ports:
      - "3000:3000"

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - backend
      - frontend
```

## Troubleshooting

### Common Issues

#### Microphone Not Working
- **Cause**: Not using HTTPS
- **Solution**: Enable SSL/HTTPS for your domain

#### "Service Unavailable" Errors  
- **Cause**: OpenAI API key missing or invalid
- **Solution**: Verify API key and check OpenAI account credits

#### Rate Limit Errors
- **Cause**: Too many requests
- **Solution**: Increase rate limits or implement request queuing

#### Audio Upload Fails
- **Cause**: File size too large or unsupported format
- **Solution**: Check MAX_AUDIO_FILE_SIZE and supported formats

#### Wake Word Not Working
- **Cause**: Requires HTTPS and supported browser
- **Solution**: Use HTTPS and modern browser (Chrome, Firefox, Safari)

### Logs to Check
- Application logs: `/var/log/servio/app.log`
- Nginx access/error logs
- Docker container logs: `docker logs servio-backend`
- Browser console for frontend issues

## Support

For additional support:
1. Check the application logs first
2. Verify all environment variables are set correctly
3. Test the health check endpoint
4. Ensure HTTPS is working properly
5. Check OpenAI API usage and limits

The assistant is now ready for production use with proper error handling, rate limiting, security, and monitoring in place.