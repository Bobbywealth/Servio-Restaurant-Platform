# MiniMax AI Deployment Guide for Servio Platform

**Version:** 1.0  
**Date:** 2026-03-20  
**Purpose:** Deploy MiniMax AI as the backbone for the entire Servio Restaurant Platform

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [API Configuration](#api-configuration)
4. [Current AI Features](#current-ai-features)
5. [Extending AI Capabilities](#extending-ai-capabilities)
6. [Verification & Testing](#verification--testing)
7. [Cost Optimization](#cost-optimization)
8. [Troubleshooting](#troubleshooting)

---

## Overview

MiniMax provides a cost-effective AI solution with ~96% savings compared to OpenAI for chat and ~60% savings for TTS. Your Servio platform already has MiniMax integration through [`src/services/MiniMaxService.ts`](src/services/MiniMaxService.ts:1).

### Cost Comparison

| Feature | OpenAI | MiniMax | Savings |
|---------|--------|---------|---------|
| Chat (per 1M tokens) | $15.00 | $0.30 | 98% |
| TTS (per 1M chars) | $30.00 | $12.00 | 60% |

---

## Environment Setup

### 1. Get Your MiniMax API Key

1. Sign up at [MiniMax Platform](https://platform.minimax.io/)
2. Navigate to **API Keys** in your dashboard
3. Click **Create API Key**
4. Copy the key securely

### 2. Add to Environment Variables

Edit your `.env` file:

```env
# MiniMax AI Configuration
MINIMAX_API_KEY=your_api_key_here
MINIMAX_API_BASE=https://api.minimax.io/v1
MINIMAX_CHAT_MODEL=m2.1
MINIMAX_TTS_VOICE=male-shaun-2
```

### 3. Available TTS Voices

| Voice ID | Name | Gender | Description |
|----------|------|--------|-------------|
| `female-jenna` | Jenna | Female | Clear American female voice |
| `male-shaun` | Shaun | Male | Deep American male voice |
| `male-shaun-2` | Shaun 2 | Male | Optimized male voice (default) |
| `female-sarah` | Sarah | Female | Warm female voice |
| `male-eric` | Eric | Male | Professional male voice |

### 4. Chat Models

| Model | Description | Use Case |
|-------|-------------|----------|
| `m2.1` | Full model | Complex reasoning, detailed responses |
| `m2.1-lightning` | Fast model | Quick responses, simple queries |

---

## API Configuration

### Current Integration Points

The [`MiniMaxService`](src/services/MiniMaxService.ts:1) class provides:

```typescript
// Chat completion with function calling
const result = await miniMax.chat(messages, tools, temperature);

// Streaming chat
for await (const chunk of miniMax.streamChat(messages, tools)) {
  // Process streaming response
}

// Text-to-Speech
const { audioUrl, duration } = await miniMax.textToSpeech(text, voice);
```

### Fallback Chain

The system automatically falls back to OpenAI if MiniMax is not configured:

```typescript
// From src/services/AssistantService.ts
if (this.miniMax.isConfigured()) {
  // Use MiniMax
} else {
  // Fall back to OpenAI
}
```

---

## Current AI Features

### 1. Voice Assistant (`/api/assistant`)

**Purpose:** Staff assistance with orders, inventory, and tasks

**Endpoints:**
- `POST /api/assistant/process-text` - Text input
- `POST /api/assistant/process-audio` - Voice input
- `POST /api/assistant/process-text-stream` - Streaming response

**Tools Available:**
- `getOrders` - Fetch recent orders
- `updateOrderStatus` - Change order status
- `getMenuItems` - Search menu
- `setItemAvailability` - 86 items
- `getInventory` - Check stock levels
- `adjustInventory` - Update inventory
- `getTasks` - List tasks
- `completeTask` - Mark task done
- `recordFeedback` - Log feedback
- `escalateToManager` - Request manager

### 2. VAPI Phone AI (`/api/vapi`)

**Purpose:** AI-powered phone ordering system

**Features:**
- Natural language order taking
- Menu search and recommendations
- Order creation and confirmation
- Customer lookup by phone

### 3. Kitchen Assistant (`/api/kitchen-assistant`)

**Purpose:** Kitchen display AI assistant

**Features:**
- Order status updates
- Timer management
- Task reminders
- Voice announcements

### 4. Conversation Analysis (`/api/conversations`)

**Purpose:** Analyze call transcripts

**Features:**
- Sentiment analysis
- Order extraction
- Customer insights

---

## Extending AI Capabilities

### 1. AI-Powered Problem Detection

Create a new service for system monitoring:

```typescript
// src/services/AIProblemDetector.ts
import { MiniMaxService } from './MiniMaxService';

export class AIProblemDetector {
  private miniMax: MiniMaxService;
  
  async analyzeError(error: Error, context: any): Promise<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    cause: string;
    solution?: string;
  }> {
    const messages = [
      { role: 'system', content: 'You are a DevOps expert analyzing application errors.' },
      { role: 'user', content: `Analyze this error:\n${error.message}\n\nContext: ${JSON.stringify(context)}` }
    ];
    
    const response = await this.miniMax.chat(messages);
    return JSON.parse(response.choices[0].message.content);
  }
}
```

### 2. Smart Search Assistant

```typescript
// src/services/AISearchService.ts
export async function intelligentSearch(query: string, userId: string) {
  const miniMax = new MiniMaxService();
  
  const messages = [
    { role: 'system', content: 'You are a restaurant search assistant. Parse the user query to extract intent and entities.' },
    { role: 'user', content: query }
  ];
  
  const response = await miniMax.chat(messages);
  const parsed = JSON.parse(response.choices[0].message.content);
  
  // Execute search based on parsed intent
  return executeSearch(parsed);
}
```

### 3. AI Help Assistant for Website

Create a new route for customer support:

```typescript
// src/routes/ai-support.ts
router.post('/api/ai-support', asyncHandler(async (req, res) => {
  const { message, context } = req.body;
  const miniMax = new MiniMaxService();
  
  const messages = [
    { role: 'system', content: `You are Servio, a helpful restaurant assistant. Help customers with: menu questions, order status, hours, reservations, and general inquiries. Restaurant: ${context.restaurantName}` },
    { role: 'user', content: message }
  ];
  
  const response = await miniMax.chat(messages);
  res.json({ response: response.choices[0].message.content });
}));
```

### 4. AI Analytics Dashboard

```typescript
// Generate AI insights from metrics
async function generateAnalyticsInsights(metrics: DashboardMetrics) {
  const miniMax = new MiniMaxService();
  
  const prompt = `
    Analyze these restaurant metrics and provide insights:
    - Today's orders: ${metrics.ordersToday}
    - Revenue: $${metrics.revenue}
    - Avg order time: ${metrics.avgOrderTime}min
    - Low stock items: ${metrics.lowStockItems.join(', ')}
    
    Provide:
    1. Key observations
    2. Potential issues
    3. Recommendations
  `;
  
  const response = await miniMax.chat([
    { role: 'system', content: 'You are a restaurant analytics expert.' },
    { role: 'user', content: prompt }
  ]);
  
  return response.choices[0].message.content;
}
```

---

## Verification & Testing

### 1. Check AI Status

```bash
curl http://localhost:3002/api/assistant/status
```

Expected response:
```json
{
  "aiProvider": "minimax",
  "usesMiniMax": true,
  "services": {
    "llm": "available",
    "textToSpeech": "available"
  }
}
```

### 2. Test Chat

```bash
curl -X POST http://localhost:3002/api/assistant/process-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "What are the most popular items today?"}'
```

### 3. Test TTS

```bash
curl -X POST http://localhost:3002/api/assistant/text-to-speech \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Order #123 is ready for pickup!"}'
```

### 4. Run AI-Specific Tests

```bash
npm run test -- --testPathPattern=assistant
```

---

## Cost Optimization

### 1. Use Caching

```typescript
const cache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedChat(messages: any[]) {
  const key = JSON.stringify(messages);
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.response;
  }
  
  const response = await miniMax.chat(messages);
  cache.set(key, { response, timestamp: Date.now() });
  return response;
}
```

### 2. Model Selection

```typescript
const model = isComplexQuery ? 'm2.1' : 'm2.1-lightning';
```

### 3. Token Optimization

```typescript
// Truncate old messages to save tokens
function optimizeContext(messages: any[], maxMessages: number = 10) {
  if (messages.length <= maxMessages) return messages;
  return [
    messages[0], // system
    ...messages.slice(-maxMessages + 1) // recent messages
  ];
}
```

---

## Troubleshooting

### Issue: "MiniMax API key not configured"

**Solution:** Ensure `MINIMAX_API_KEY` is set in your `.env` file.

### Issue: "MiniMax API error: 401"

**Solution:** Check that your API key is valid and has not expired.

### Issue: "Rate limit exceeded"

**Solution:** Implement request throttling or contact MiniMax for higher limits.

### Issue: Slow responses

**Solution:** 
1. Use `m2.1-lightning` model for faster responses
2. Enable response caching
3. Optimize message context length

### Issue: TTS audio quality

**Solution:** Try different voice options or adjust the `speed` parameter.

---

## Monitoring & Logging

### Enable AI Logging

The [`MiniMaxService`](src/services/MiniMaxService.ts:1) automatically logs:
- API calls and responses
- Token usage
- Error responses
- Response times

### Track Usage

```typescript
// Add to your monitoring dashboard
const metrics = {
  miniMaxCalls: counter('minimax_api_calls_total'),
  miniMaxTokens: histogram('minimax_tokens_used'),
  miniMaxLatency: histogram('minimax_response_time_seconds'),
};
```

---

## Security Best Practices

1. **Never expose API keys** - Use environment variables only
2. **Rate limit AI endpoints** - Prevent abuse
3. **Sanitize user input** - Prevent prompt injection
4. **Monitor usage** - Track unusual patterns
5. **Implement fallback** - Have OpenAI as backup

---

## Next Steps

1. [ ] Add MiniMax API key to environment
2. [ ] Test all AI endpoints
3. [ ] Implement AI-powered problem detection
4. [ ] Add customer support chatbot
5. [ ] Create AI analytics dashboard
6. [ ] Set up usage monitoring

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-20  
**Related Files:**
- [`src/services/MiniMaxService.ts`](src/services/MiniMaxService.ts:1) - Main AI integration
- [`src/services/AssistantService.ts`](src/services/AssistantService.ts:1) - Staff AI assistant
- [`src/routes/assistant.ts`](src/routes/assistant.ts:1) - AI endpoints
