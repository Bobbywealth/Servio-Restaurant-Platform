# Voice Ordering Implementation Guide

## Overview

Your Servio restaurant platform now has **voice ordering** capabilities through **Vapi Voice AI**. This integration allows customers to place orders by calling a phone number and speaking with an AI assistant.

## Cost Analysis

### Vapi (Recommended - Already Implemented)
- **Platform Fee**: $0.05/minute
- **Total Estimated Cost**: ~$0.15/minute (including STT, LLM, TTS)
- **Phone Number**: $2/month
- **Monthly Estimate**: For 1,000 minutes = ~$152/month
- **Free Credits**: $10 to start testing

### Twilio (Alternative - More Development Required)
- **Inbound Calls**: $0.0085/minute (local) or $0.022/minute (toll-free)  
- **Phone Number**: $1.15/month (local) or $2.15/month (toll-free)
- **Monthly Estimate**: For 1,000 minutes = ~$10-25/month + AI processing costs
- **Additional Development**: 20-40 hours for full implementation

## What's Already Built

✅ **VapiService**: Handles all voice interactions  
✅ **Webhook Endpoints**: `/api/vapi/webhook` and `/api/vapi/assistant-config`  
✅ **Order Management**: Full integration with your existing order system  
✅ **Menu Integration**: Real-time menu availability and pricing  
✅ **Voice Optimized**: Responses formatted for natural speech  
✅ **Error Handling**: Fallbacks for failed operations  

## Setup Steps

### 1. Create Vapi Account
1. Go to [vapi.ai](https://vapi.ai) and sign up
2. You'll get $10 in free credits to start testing
3. Get your API key from the dashboard

### 2. Configure Environment Variables
Add these to your `backend/.env` file:
```bash
# Vapi Voice AI Configuration
VAPI_API_KEY=your_vapi_api_key_here
VAPI_WEBHOOK_SECRET=your_webhook_secret
VAPI_ASSISTANT_ID=your_assistant_id
VAPI_PHONE_NUMBER_ID=your_phone_number_id
VAPI_RESTAURANT_ID=your_restaurant_id
```
`VAPI_RESTAURANT_ID` should match the restaurant you want Vapi calls to use (for example, `demo-restaurant-1` in local dev).

### 3. Create Vapi Assistant
1. In your Vapi dashboard, create a new assistant
2. Set the webhook URL to: `https://yourdomain.com/api/vapi/webhook`
3. Get the assistant configuration from: `https://yourdomain.com/api/vapi/assistant-config`
4. Copy the JSON response into your Vapi assistant settings

### 4. Get a Phone Number
1. In Vapi dashboard, purchase a phone number ($2/month)
2. Assign it to your assistant
3. Test by calling the number

## Voice Ordering Capabilities

### Customer Features
- **Place Orders**: "I'd like to order 2 chicken sandwiches and a large fries"
- **Check Menu**: "What desserts do you have?" or "How much is the burger?"
- **Order Status**: "What's the status of order 214?" or "I placed an order an hour ago"
- **Modifications**: "Can I add extra cheese to that?"

### Staff Features (when calling internally)
- **Order Management**: "Update order 214 to ready"
- **Inventory**: "How much chicken do we have?" or "86 the fish tacos"
- **Tasks**: "What tasks are pending today?"

## Implementation Examples

### Sample Customer Call Flow
```
Customer: "Hi, I'd like to place an order"
Servio: "Great! I can help you with that. What would you like to order today?"
Customer: "Two cheeseburgers and a large fries"
Servio: "Perfect! Two cheeseburgers and one large fries. That'll be $18.50. Can I get your name and phone number for the order?"
Customer: "John Smith, 555-0123"
Servio: "Got it John. Is this for pickup or delivery?"
Customer: "Pickup"
Servio: "Excellent! Your order number is 215. Total is $18.50 for pickup. You can pick it up in about 20 to 25 minutes. Is there anything else I can help you with?"
```

## Testing & Deployment

### Local Testing
1. Start your backend server: `npm run dev`
2. Use ngrok to expose your webhook: `ngrok http 3002`
3. Update your Vapi webhook URL to the ngrok URL + `/api/vapi/webhook`
4. Call your Vapi phone number to test

### Production Deployment
1. Deploy your backend to your production server
2. Update Vapi webhook URL to your production domain
3. Ensure SSL is configured (required for webhooks)
4. Test thoroughly with real orders

## Monitoring & Analytics

### Built-in Logging
- All calls are logged in your audit table
- Transcript logging for conversation analysis
- Performance metrics and error tracking

### Key Metrics to Track
- **Call Volume**: Number of calls per day/hour
- **Conversion Rate**: Calls that result in orders
- **Average Order Value**: AOV from voice orders vs. other channels
- **Call Duration**: Average time per call
- **Error Rate**: Failed order attempts

## Advanced Features

### Custom Voice Training
- Upload sample audio for voice cloning (+$20/month)
- Train on restaurant-specific terminology
- Customize pronunciation for menu items

### Integration Extensions
- **POS Integration**: Sync directly with your POS system
- **Delivery Tracking**: Real-time delivery updates
- **Loyalty Program**: Voice-based rewards redemption
- **Multi-language**: Support for Spanish or other languages

## Scaling Considerations

### Expected Call Volume
- **Small Restaurant**: 50-200 calls/month (~$8-30/month)
- **Medium Restaurant**: 500-1000 calls/month (~$75-150/month)  
- **Large Restaurant**: 2000+ calls/month (~$300+/month)

### Performance Optimization
- Response times: < 2 seconds average
- Uptime: 99.9% availability required
- Concurrent calls: Scales automatically with Vapi

## Troubleshooting

### Common Issues
1. **Webhook Timeouts**: Ensure your server responds within 5 seconds
2. **Menu Sync**: Check database connection and menu_items table
3. **Order Failures**: Verify required fields in order creation
4. **Audio Quality**: Check customer phone connection and background noise

### Debug Endpoints
- Health check: `GET /api/vapi/health`
- Assistant config: `GET /api/vapi/assistant-config`
- Recent calls: Check audit logs in your database

## Security Considerations

- **Webhook Verification**: Implement HMAC signature validation
- **Rate Limiting**: Prevent abuse from excessive calls
- **Data Privacy**: Ensure customer data is handled securely
- **PCI Compliance**: No payment data should be collected over phone

## Next Steps

1. **Sign up for Vapi** and get your API key
2. **Configure environment variables** in your backend
3. **Deploy and test** the integration
4. **Train your staff** on the new voice ordering system
5. **Monitor performance** and optimize based on real usage

## Support

- **Vapi Documentation**: [docs.vapi.ai](https://docs.vapi.ai)
- **Your Implementation**: All code is in `backend/src/services/VapiService.ts` and `backend/src/routes/vapi.ts`
- **Debugging**: Check logs and audit table for call history

---

**Estimated Total Setup Time**: 2-4 hours  
**Monthly Operating Cost**: $50-200 (depending on call volume)  
**ROI Timeline**: 2-3 months (assuming 20% of calls convert to orders)