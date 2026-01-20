# Vapi Multi-Tenant Phone System Setup

## Overview

Your Servio platform now supports **multi-tenant Vapi phone systems**. Each restaurant can configure their own Vapi account to handle incoming customer phone calls independently from the in-app AI Assistant.

## What Was Changed

### Backend Changes

1. **VapiService.ts** - Enhanced to support multi-tenancy:
   - Automatically detects which restaurant a call belongs to based on Vapi `phoneNumberId`
   - Looks up restaurant configuration from database settings
   - Falls back to `VAPI_RESTAURANT_ID` env var for testing/backwards compatibility

2. **restaurant-settings.ts** - New API endpoints:
   - `GET /api/restaurants/:id/vapi` - Get Vapi settings for a restaurant
   - `PUT /api/restaurants/:id/vapi` - Update Vapi settings
   - `POST /api/restaurants/:id/vapi/test` - Test Vapi connection
   - `GET /api/restaurants/:id/vapi/webhook-url` - Get webhook URL

3. **Database** - Uses existing `restaurants.settings` JSON field:
   ```json
   {
     "vapi": {
       "enabled": true,
       "apiKey": "your-vapi-key",
       "webhookSecret": "optional",
       "assistantId": "optional",
       "phoneNumberId": "vapi-phone-number-id",
       "phoneNumber": "+1 (555) 123-4567"
     }
   }
   ```

### Frontend Changes

1. **Admin Restaurant Detail Page** - Added new "Phone System" tab:
   - Completely separate from "Integrations" to avoid confusion with in-app AI Assistant
   - Clear explanation that this is for **incoming customer phone calls**
   - Form to configure Vapi API key, phone number ID, etc.
   - Test connection button
   - Setup instructions with webhook URL

## Testing with Your Vapi Account

### Step 1: Get Your Vapi Credentials

From your Vapi dashboard at [vapi.ai](https://vapi.ai), gather:
- ✅ API Key (from Settings)
- ✅ Phone Number ID (from Phone Numbers section)
- ✅ Your purchased phone number (e.g., +1-555-123-4567)
- ✅ Assistant ID (optional, from Assistants section)

### Step 2: Expose Your Local Backend

Since Vapi needs to reach your webhook, you have 3 options:

**Option A: Use ngrok (if you have an account)**
```bash
ngrok config add-authtoken YOUR_NGROK_TOKEN
ngrok http 3002
# Copy the https URL it gives you
```

**Option B: Deploy to staging/production**
Use your deployed backend URL (e.g., `https://servio-api.onrender.com`)

**Option C: Use env var for testing (backwards compatible)**
Set in `backend/.env`:
```bash
VAPI_RESTAURANT_ID=sasheys-kitchen-union  # or your restaurant ID
```
Then just call your Vapi number - it will work without the UI config!

### Step 3: Configure in Admin UI

1. Start your frontend: `cd frontend && npm run dev`
2. Navigate to Admin → Restaurants → [Select a restaurant]
3. Click the **"Phone System"** tab (not "Integrations")
4. Fill in the form:
   - ✅ Enable Phone System
   - ✅ Vapi API Key: `sk_live_...`
   - ✅ Phone Number ID: `12345678-1234...`
   - ✅ Phone Number: `+1 (555) 123-4567`
   - Assistant ID: (optional)
5. Click **Save Settings**
6. Click **Test Connection** to verify

### Step 4: Configure Vapi Webhook

In your Vapi dashboard:

1. Go to your Assistant settings
2. Set **Server URL** (webhook) to:
   - ngrok: `https://abc123.ngrok.io/api/vapi/webhook`
   - Production: `https://your-domain.com/api/vapi/webhook`
3. Get assistant configuration from:
   - `https://your-domain.com/api/vapi/assistant-config`
   - Copy the JSON response into Vapi assistant settings (optional - Vapi has defaults)
4. Save in Vapi dashboard

### Step 5: Test Phone Calls

1. **Call your Vapi phone number**
2. **Expected behavior**:
   - Servio AI answers within 2 rings
   - Greets customer and asks for order
   - Takes order with all required details
   - Places order in your restaurant's system
   - Order appears in your dashboard with source "vapi"

3. **Check the logs**:
   ```bash
   # Backend terminal will show:
   # "Vapi webhook received"
   # "Restaurant found for phone number: restaurant-id"
   # "Call ended: ..."
   ```

4. **Verify order in dashboard**:
   - Go to Orders page
   - Filter by "Voice (VAPI)" channel
   - See your test order

## Key Differences: Phone System vs In-App Assistant

| Feature | Phone System (Vapi) | In-App AI Assistant |
|---------|-------------------|-------------------|
| **Purpose** | Incoming customer phone calls | In-app voice/text commands |
| **Integration** | Vapi (external) | OpenAI + AssistantService |
| **Configuration** | Per-restaurant Vapi account | Shared OpenAI API |
| **Use Case** | Customers call to place orders | Staff use voice commands in app |
| **Cost** | $0.05/min + $2/mo per restaurant | Included with OpenAI costs |
| **Tab Location** | "Phone System" tab | Separate feature |

## Multi-Restaurant Support

Each restaurant can have their own:
- ✅ Separate Vapi account
- ✅ Their own phone number
- ✅ Custom voice prompts (future)
- ✅ Independent billing
- ✅ Call logs and analytics

**How it works:**
1. Customer calls Restaurant A's phone number
2. Vapi sends webhook with `phoneNumberId`
3. Servio looks up which restaurant owns that `phoneNumberId`
4. Routes order to correct restaurant
5. Restaurant A staff sees order in their dashboard

## Troubleshooting

### Webhook not reaching your server
- Verify ngrok is running: `curl https://your-ngrok-url.ngrok.io/api/vapi/health`
- Check Vapi dashboard logs for webhook errors
- Ensure webhook URL ends with `/api/vapi/webhook`

### "Could not determine restaurant for call"
- Verify `phoneNumberId` in restaurant settings matches Vapi
- Check backend logs for: "Restaurant found for phone number"
- Fallback: Set `VAPI_RESTAURANT_ID` in `.env`

### Order not appearing
- Check order status - should be "pending" initially
- Verify restaurant ID matches in both systems
- Look at audit logs for call activity
- Check `orders` table: `SELECT * FROM orders WHERE channel = 'vapi'`

### Test connection fails
- Verify API key is correct (starts with `sk_`)
- Check Vapi account is active and not expired
- Ensure phone number is purchased in Vapi dashboard

## Production Deployment

When deploying to production:

1. **Set BASE_URL** in backend `.env`:
   ```bash
   BASE_URL=https://your-production-domain.com
   ```

2. **Update all restaurant webhooks** in Vapi dashboard:
   - Old: `https://abc123.ngrok.io/api/vapi/webhook`
   - New: `https://your-domain.com/api/vapi/webhook`

3. **SSL Required** - Vapi requires HTTPS for webhooks

4. **Monitor logs** - Check audit logs regularly for call activity

## Security Notes

- API keys are **never sent to frontend** (only shown as "Configured")
- Webhook validation can be added using `VAPI_WEBHOOK_SECRET`
- Each restaurant's settings are isolated in JSON
- Only restaurant owners/admins can modify phone settings

## Next Steps

1. ✅ Test with your account (using env var or UI config)
2. ✅ Call your Vapi number and place a test order
3. ✅ Verify order appears in dashboard
4. Consider adding:
   - Custom voice prompts per restaurant
   - Call analytics dashboard
   - Recording playback
   - Multi-language support

## Cost Estimate

Per restaurant with Vapi:
- Phone number: $2/month
- Calls: ~$0.15/minute (includes STT, LLM, TTS)
- Example: 500 minutes/month = $75 + $2 = **$77/month per restaurant**

---

**Status**: ✅ Multi-tenant Vapi system ready for testing!

Need help? Check logs in `backend/src/services/VapiService.ts`
