# Servio Restaurant Platform - Staff Assistant

## 🤖 AI-Powered Restaurant Operations Assistant

Servio is an on-screen AI assistant specifically designed for restaurant staff to manage orders, inventory, menu availability (86 items), and daily tasks through natural voice commands.

### ✨ Key Features

- **Push-to-Talk Voice Interface** - Natural conversation with your restaurant AI
- **2D Avatar with Lip Sync** - Visual feedback and professional interface
- **Order Management** - Check status, update progress, view wait times
- **86/Availability Control** - Voice commands to make items unavailable across delivery platforms
- **Inventory Management** - Record receipts, adjust quantities, check low stock
- **Task Management** - View and complete daily operational tasks
- **Audit Logging** - Complete tracking of all actions and changes
- **Multi-Channel Sync** - DoorDash, Uber Eats, GrubHub integration ready

### 🏗️ Architecture

#### Frontend (Next.js + React)
- **Dashboard UI** - Modern, responsive web interface
- **Voice Processing** - Web Audio API with push-to-talk controls
- **Real-time Updates** - Socket.IO for live status updates
- **Mobile Ready** - Responsive design for tablets and phones

#### Backend (Node.js + Express)
- **AI Assistant Service** - OpenAI GPT-4 with custom restaurant tools
- **Speech-to-Text** - OpenAI Whisper for voice transcription
- **Text-to-Speech** - OpenAI TTS (optional), ElevenLabs integration (optional)
- **SQLite Database** - Lightweight, embedded database
- **RESTful APIs** - Complete API suite for all operations

### 🚀 Quick Start

#### Prerequisites
- Node.js 18+ and npm
- OpenAI API key (required for AI features)
- ElevenLabs API key (optional, for voice responses)

#### Installation

1. **Install Dependencies**
   ```bash
   npm run install-all
   ```

2. **Environment Setup**
   Use the provided examples and create env files in both frontend and backend directories:
   - `backend/env.example`
   - `frontend/env.example`

   **Backend `backend/.env`:**
   ```env
   NODE_ENV=development
   PORT=3002
   FRONTEND_URL=http://localhost:3000
   OPENAI_API_KEY=your_openai_api_key_here
   # Optional (TTS voice tuning)
   OPENAI_TTS_MODEL=tts-1
   OPENAI_TTS_VOICE=alloy
   # Optional alternative TTS provider
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   ```

   **Frontend `frontend/.env.local`:**
   ```env
   BACKEND_URL=http://localhost:3002
   ```

3. **Start Development Servers**
   ```bash
   npm run dev
   ```

   This starts both frontend (port 3000) and backend (port 3002) concurrently.

4. **Access the Application**
   - Frontend Dashboard: http://localhost:3000
   - Backend API: http://localhost:3002/api
   - Health Check: http://localhost:3002/health

### 🎯 Core Use Cases

#### 📋 Order Management
- *"What orders are waiting?"*
- *"Mark order 214 ready"*
- *"How long has order 221 been waiting?"*

#### 🚫 86 / Availability Management
- *"86 jerk chicken on all apps"*
- *"Bring back oxtail"*
- *"Is curry goat available on DoorDash?"*

#### 📦 Inventory Management
- *"We received 2 cases of chicken"*
- *"Reduce cabbage by 1 case, wasted"*
- *"How many bags of rice do we have left?"*

#### ✅ Task Management
- *"What are today's closing tasks?"*
- *"Mark the fryer filter task complete"*

### 🔧 API Endpoints

#### Assistant API
- `POST /api/assistant/process-audio` - Process voice input
- `POST /api/assistant/process-text` - Process text commands
- `GET /api/assistant/status` - Get service status

#### Operations APIs
- `GET /api/orders` - List orders with filtering
- `POST /api/orders/:id/status` - Update order status
- `GET /api/inventory/search` - Search inventory items
- `POST /api/inventory/adjust` - Adjust inventory quantities
- `POST /api/menu/items/set-unavailable` - 86 menu items
- `GET /api/tasks/today` - Get today's tasks
- `POST /api/tasks/:id/complete` - Complete tasks

### 🛡️ Safety & Security Features

#### Confirmation System
- Destructive actions require confirmation
- Disambiguation for multiple matches
- Clear feedback on all operations

#### Permission System
- **Staff**: Orders, basic inventory, task completion
- **Manager/Owner**: All operations including 86/availability changes
- Role-based UI and API restrictions

#### Audit Logging
- Complete action history
- User attribution
- Timestamp and details tracking
- Export capabilities for compliance

### 🎨 UI Components

#### Left Panel - Assistant Interface
- **2D Avatar** - Animated face with talking/listening states
- **Push-to-Talk Button** - Large, accessible microphone control  
- **Quick Commands** - Common action buttons
- **Status Indicators** - Connection and processing states

#### Right Panel - Conversation & Actions
- **Transcript Feed** - Conversation history with timestamps
- **Action Results** - Real-time feedback on completed tasks
- **System Messages** - Status updates and confirmations

### 📱 Mobile & Tablet Support

The interface is fully responsive and optimized for:
- **Kitchen Tablets** - Primary use case for restaurant staff
- **Smartphones** - Quick access for managers
- **Desktop** - Full administrative interface

### 🔌 Integration Ready

#### Delivery Platforms
- DoorDash Partner API integration points
- Uber Eats API connectivity 
- Grubhub menu management hooks

#### POS Systems
- Order import/export capabilities
- Inventory sync mechanisms
- Sales data integration

#### Accounting Systems
- Receipt processing and categorization
- Expense tracking
- Audit trail exports

### 🧪 Development

#### Project Structure
```
servio-restaurant-platform/
├── frontend/                 # Next.js React app
│   ├── components/          # UI components
│   │   ├── Assistant/       # AI assistant components
│   │   └── Layout/          # Layout components
│   ├── pages/               # Next.js pages
│   └── contexts/            # React contexts
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── services/        # Business logic services
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/      # Express middleware
│   │   └── utils/           # Utility functions
│   └── data/                # SQLite database
└── package.json             # Workspace configuration
```

#### Available Scripts
- `npm run dev` - Start both frontend and backend in development
- `npm run build` - Build frontend for production
- `npm run start` - Start production server
- `npm run dev:frontend` - Frontend only
- `npm run dev:backend` - Backend only

### 🚀 Production Deployment

#### Environment Variables
Set these in your production environment:
- `NODE_ENV=production`
- `OPENAI_API_KEY` - Your OpenAI API key
- `ELEVENLABS_API_KEY` - Your ElevenLabs key (optional)
- `DATABASE_URL` - Production database URL
- `FRONTEND_URL` - Your domain URL

#### Deployment Options
- **Vercel** - Frontend (Next.js)
- **Railway/Render** - Backend API
- **AWS/GCP** - Full stack deployment
- **Docker** - Containerized deployment

### 📊 Monitoring & Analytics

- Request/response logging
- Performance metrics
- Error tracking and alerting
- Usage analytics and patterns
- Voice recognition accuracy tracking

### 🤝 Contributing

This is a demonstration project showcasing AI assistant capabilities for restaurant operations. The codebase is designed to be:
- **Modular** - Easy to extend with new features
- **Well-documented** - Clear code structure and comments
- **Production-ready** - Security and error handling built-in

### 📄 License

MIT License - Feel free to use this as inspiration for your own restaurant technology solutions.

### 💬 Support

For questions about implementation or customization, review the comprehensive code comments and API documentation included in the source files.

---

**Built with ❤️ for restaurant operators who want to harness the power of AI to streamline their daily operations.**