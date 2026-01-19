# 🎙️ "Hey Servio" Wake Word Setup Guide

## 🎉 What You Now Have

Your Servio Restaurant Platform now includes a complete voice assistant with wake word detection! Here's what's been added:

### ✅ Features Added
- **Wake Word Detection**: Say "Hey Servio" to activate the assistant
- **Chat Input**: Type commands as an alternative to voice
- **Voice Commands**: Full speech-to-text processing for restaurant operations
- **Text-to-Speech**: Servio responds with voice
- **Restaurant Actions**: Inventory, orders, menu management via voice/text

### ✅ UI Components Added
1. **Wake Word Controls**: Enable/disable wake word listening
2. **Chat Input Box**: Type commands with quick suggestions  
3. **Status Indicators**: Shows listening/processing/speaking states
4. **Quick Command Buttons**: Pre-built restaurant commands

## 🚀 How to Use

### Voice Commands
1. **Enable Wake Word**: Click "Start Wake Word" button
2. **Say Command**: "Hey Servio, no more jerk chicken"
3. **Or Manual**: Use microphone button to record commands
4. **Or Type**: Use the chat input box to type commands

### Example Commands
```
"Hey Servio, no more jerk chicken"
"Hey Servio, check current orders"
"Hey Servio, what items are 86'd"
"Hey Servio, show inventory levels"
"Hey Servio, mark order 123 ready"
```

## ⚙️ What's Needed to Make It Work

### 🌐 Browser Requirements
- **Chrome/Edge**: ✅ Full support
- **Safari**: ✅ Works well  
- **Firefox**: ⚠️ Limited Web Speech API support
- **Mobile**: ✅ Works on iOS/Android Chrome

### 🔒 HTTPS Requirement
**CRITICAL**: Wake word detection requires HTTPS in production.

```bash
# For local development, use:
npm run dev  # Works on localhost

# For production, you MUST have SSL certificate
# Deploy to Vercel/Netlify (automatic HTTPS)
# Or use SSL certificates on your server
```

### 🎤 Microphone Permission
Users must grant microphone access:
1. Browser will prompt for permission
2. Users can deny and still use text chat
3. Wake word only works with microphone permission

### 🔧 Environment Setup (Optional)
The current implementation uses the free Web Speech API. No API keys needed!

```bash
# Optional: Add to .env for enhanced features
NEXT_PUBLIC_OPENAI_API_KEY=your_key_here  # Already configured
NEXT_PUBLIC_WAKE_WORD_LANGUAGE=en-US      # Default language
```

## 📱 Testing the Setup

### 1. Start Development Server
```bash
cd frontend
npm run dev
```

### 2. Navigate to Assistant
Go to: `http://localhost:3000/dashboard/assistant`

### 3. Test Wake Word
1. Click "Start Wake Word"  
2. Say: "Hey Servio, check orders"
3. Should see: Wake word detected → Command processed

### 4. Test Chat Input
1. Type: "no more jerk chicken"
2. Press Enter or click Send
3. Should see: Command processed → Action taken

## 🐛 Troubleshooting

### Wake Word Not Working
```bash
# Check browser console for errors:
# 1. Open DevTools (F12)
# 2. Check Console tab
# 3. Look for "Wake word" messages
```

**Common Issues:**
- **No HTTPS**: Wake word requires secure context
- **No Microphone Permission**: Check browser settings
- **Browser Not Supported**: Use Chrome/Safari
- **Background Noise**: Adjust sensitivity or use quieter environment

### Chat Input Not Working
- Check if backend is running: `http://localhost:3002`
- Verify API endpoints in Network tab
- Check for CORS issues

### Voice Recognition Issues  
- **Accent/Language**: Currently optimized for English
- **Background Noise**: Use in quieter environment
- **Microphone Quality**: Better mic = better recognition
- **Internet Connection**: Web Speech API needs internet

## 🔧 Advanced Configuration

### Customize Wake Words
Edit `frontend/lib/WakeWordService.ts`:
```typescript
wakeWords: ['hey servio', 'servio', 'assistant']  // Add more phrases
```

### Adjust Sensitivity
In the assistant component:
```typescript
// More sensitive (detects more, may have false positives)
sensitivity: 0.8  

// Less sensitive (more accurate, may miss some)
sensitivity: 0.3
```

### Add Custom Commands
Edit quick suggestions in `assistant.tsx`:
```typescript
suggestions={[
  'no more jerk chicken',
  'check current orders',
  'your custom command here'
]}
```

## 🚀 Deployment Requirements

### Production Checklist
- [ ] HTTPS certificate configured
- [ ] Backend API endpoints accessible  
- [ ] CORS configured for your domain
- [ ] OpenAI API key in environment variables
- [ ] Test wake word on production URL

### Recommended Deployment
```bash
# Deploy to Vercel (automatic HTTPS)
npm run build
vercel --prod

# Or Netlify
npm run build
netlify deploy --prod --dir=out
```

## 📊 Performance Optimization

### Wake Word Performance
- Uses browser's native Web Speech API (no additional bandwidth)
- Continuous listening uses minimal CPU
- No cloud processing for wake word detection

### Battery Impact
- Continuous microphone listening uses battery
- Provide toggle to disable when not needed
- Consider auto-disable after inactivity

## 🎯 Next Steps

1. **Test thoroughly** in your restaurant environment
2. **Train staff** on voice commands  
3. **Customize commands** for your specific needs
4. **Add more wake word phrases** if needed
5. **Consider noise cancellation** for busy kitchens

## 📞 Support

If you have issues:
1. Check the browser console for errors
2. Test with different browsers
3. Verify HTTPS in production
4. Check microphone permissions

Your "Hey Servio" assistant is ready to revolutionize your restaurant operations! 🚀