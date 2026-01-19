# Servio Restaurant Platform - Technical Architecture

## Overview

Servio is a comprehensive restaurant operating system that unifies orders, voice interactions, availability management, inventory tracking, staff operations, and time tracking into a single source of truth. Built for real restaurant conditions with voice-first operations and robust availability sync.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          SERVIO ECOSYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Layer                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Web Dashboard │  │   Mobile Apps   │  │   Voice UI      │ │
│  │   (Next.js)     │  │   (React Native)│  │   (Browser)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway & Load Balancer                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   REST API      │  │   GraphQL API   │  │   WebSocket     │ │
│  │   (Express.js)  │  │   (Apollo)      │  │   (Socket.IO)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Core Services Layer                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Order Service   │  │ Voice Service   │  │  Sync Service   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Inventory Service│  │  Auth Service   │  │ Notification    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Integration Layer                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  OpenAI API     │  │ Delivery APIs   │  │    POS APIs     │ │
│  │ (Voice + LLM)   │  │(DD/UE/GH/etc.) │  │  (Square/etc.)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Primary DB    │  │    Cache        │  │   File Storage  │ │
│  │   (PostgreSQL)  │  │    (Redis)      │  │   (AWS S3)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Voice System Architecture

#### Voice Processing Pipeline
```
Audio Input → Speech-to-Text → Intent Recognition → Action Execution → Text-to-Speech → Audio Output
     ↓               ↓                ↓                 ↓               ↓              ↓
  WebRTC/Phone  → OpenAI Whisper → GPT-4 Functions → Service Layer → ElevenLabs → WebRTC/Phone
```

#### Components:
- **Voice Gateway**: WebRTC for browser, Twilio for phone calls
- **Speech Processing**: OpenAI Whisper for STT, ElevenLabs for TTS
- **Intent Engine**: GPT-4 with function calling for action execution
- **Context Manager**: Maintains conversation state and restaurant context

### 2. Order Management System

#### Order Flow Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Order Sources  │    │  Order Service  │    │  Staff Display  │
│                 │    │                 │    │                 │
│ • Website/QR    │───▶│ • Validation    │───▶│ • Kitchen View  │
│ • Phone Calls   │    │ • Processing    │    │ • Status Board  │
│ • Delivery Apps │    │ • Status Mgmt   │    │ • Mobile Alerts │
│ • Walk-ins      │    │ • Notifications │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 3. Availability Sync Engine

#### Sync Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    SERVIO SYNC ENGINE                       │
├─────────────────────────────────────────────────────────────┤
│  Change Detection → Validation → Platform APIs → Verification│
│       ↓                ↓            ↓           ↓           │
│  • Menu Updates     • Business    • DoorDash   • Status     │
│  • Inventory        Rules         • UberEats   Tracking     │
│  • Staff Actions   • Constraints  • GrubHub    • Rollback   │
│  • Schedule        • Validation   • Custom     • Logging    │
├─────────────────────────────────────────────────────────────┤
│  Fallback Mechanisms                                        │
│  • Manual Tasks • VA Workflows • Status Dashboards         │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Entities

#### Users & Authentication
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  device_info JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Restaurant & Location Management
```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  address JSONB NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  settings JSONB DEFAULT '{}',
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE restaurant_users (
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '[]',
  PRIMARY KEY (restaurant_id, user_id)
);
```

#### Menu & Availability Management
```sql
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES menu_categories(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  sku VARCHAR(100),
  images JSONB DEFAULT '[]',
  nutritional_info JSONB,
  allergens JSONB DEFAULT '[]',
  is_available BOOLEAN DEFAULT true,
  availability_schedule JSONB,
  channel_settings JSONB DEFAULT '{}',
  preparation_time INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE item_modifications (
  id UUID PRIMARY KEY,
  item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_modifier DECIMAL(10,2) DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  options JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Order Management
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  channel order_channel NOT NULL,
  type order_type DEFAULT 'delivery',
  status order_status DEFAULT 'received',
  customer_info JSONB NOT NULL,
  items JSONB NOT NULL,
  pricing JSONB NOT NULL,
  delivery_info JSONB,
  payment_info JSONB,
  special_instructions TEXT,
  estimated_ready_time TIMESTAMP,
  actual_ready_time TIMESTAMP,
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_status_history (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  changed_by UUID REFERENCES users(id),
  reason VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Inventory Management
```sql
CREATE TABLE inventory_categories (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES inventory_categories(id),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  unit_type VARCHAR(50) NOT NULL,
  current_quantity DECIMAL(10,3) DEFAULT 0,
  par_level DECIMAL(10,3) DEFAULT 0,
  reorder_point DECIMAL(10,3) DEFAULT 0,
  max_level DECIMAL(10,3),
  unit_cost DECIMAL(10,4),
  supplier_info JSONB,
  is_tracked BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type inventory_transaction_type NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_cost DECIMAL(10,4),
  reference_id UUID,
  reference_type VARCHAR(50),
  reason VARCHAR(255),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Staff & Time Management
```sql
CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  position VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE time_entries (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMP NOT NULL,
  clock_out_time TIMESTAMP,
  break_minutes INTEGER DEFAULT 0,
  total_hours DECIMAL(4,2),
  position VARCHAR(100),
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Task Management
```sql
CREATE TABLE task_templates (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  frequency task_frequency NOT NULL,
  estimated_duration INTEGER,
  instructions JSONB,
  required_role VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  template_id UUID REFERENCES task_templates(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'pending',
  priority task_priority DEFAULT 'medium',
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  completion_notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Sync & Integration Management
```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform VARCHAR(100) NOT NULL,
  status integration_status DEFAULT 'inactive',
  config JSONB NOT NULL,
  credentials_encrypted TEXT,
  last_sync_at TIMESTAMP,
  error_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id),
  job_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  status sync_status DEFAULT 'pending',
  payload JSONB,
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Audit & Analytics
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  source VARCHAR(50) DEFAULT 'web',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  properties JSONB NOT NULL,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Structure

### RESTful API Design

#### Base URL Structure
```
https://api.servio.com/v1/restaurants/{restaurant_id}/
```

#### Core Endpoints

##### Authentication & Users
```
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me

GET    /users
POST   /users
GET    /users/{id}
PUT    /users/{id}
DELETE /users/{id}
```

##### Orders
```
GET    /orders                 # List orders with filtering
POST   /orders                 # Create new order
GET    /orders/{id}            # Get specific order
PUT    /orders/{id}            # Update order
DELETE /orders/{id}            # Cancel order

POST   /orders/{id}/status     # Update order status
GET    /orders/{id}/history    # Get status history
POST   /orders/{id}/assign     # Assign to staff member

GET    /orders/stats           # Order analytics
GET    /orders/queue           # Kitchen queue view
```

##### Menu Management
```
GET    /menu/categories
POST   /menu/categories
PUT    /menu/categories/{id}
DELETE /menu/categories/{id}

GET    /menu/items
POST   /menu/items
GET    /menu/items/{id}
PUT    /menu/items/{id}
DELETE /menu/items/{id}

POST   /menu/items/{id}/availability  # Update availability
POST   /menu/bulk-availability        # Bulk update (86 operations)
```

##### Inventory
```
GET    /inventory/categories
POST   /inventory/categories
PUT    /inventory/categories/{id}
DELETE /inventory/categories/{id}

GET    /inventory/items
POST   /inventory/items
GET    /inventory/items/{id}
PUT    /inventory/items/{id}
DELETE /inventory/items/{id}

POST   /inventory/transactions      # Record inventory transaction
GET    /inventory/transactions      # Transaction history
GET    /inventory/low-stock        # Items below reorder point
POST   /inventory/count            # Physical count update
```

##### Voice & Assistant
```
POST   /assistant/audio           # Process audio input
POST   /assistant/text            # Process text input
GET    /assistant/commands        # Available voice commands
POST   /assistant/tts             # Generate speech

GET    /phone/status              # Phone system status
POST   /phone/webhook             # Twilio webhooks
```

##### Staff & Time Tracking
```
GET    /staff/schedules
POST   /staff/schedules
PUT    /staff/schedules/{id}
DELETE /staff/schedules/{id}

POST   /time/clock-in            # Clock in
POST   /time/clock-out           # Clock out
GET    /time/entries             # Time entries
PUT    /time/entries/{id}        # Edit time entry
POST   /time/entries/{id}/approve # Approve time entry

GET    /staff/current            # Currently clocked in staff
```

##### Tasks
```
GET    /tasks/templates
POST   /tasks/templates
PUT    /tasks/templates/{id}
DELETE /tasks/templates/{id}

GET    /tasks                    # Active tasks
POST   /tasks                    # Create task
PUT    /tasks/{id}               # Update task
DELETE /tasks/{id}               # Delete task
POST   /tasks/{id}/complete      # Mark complete
```

##### Sync & Integrations
```
GET    /integrations
POST   /integrations
PUT    /integrations/{id}
DELETE /integrations/{id}
POST   /integrations/{id}/test   # Test connection

GET    /sync/jobs
POST   /sync/jobs
GET    /sync/jobs/{id}
POST   /sync/manual              # Manual sync trigger

GET    /sync/status              # Overall sync health
```

### WebSocket Events

#### Real-time Updates
```javascript
// Order updates
socket.emit('order:status_changed', { orderId, status, timestamp })
socket.emit('order:new', { order })
socket.emit('order:assigned', { orderId, assignedTo })

// Inventory updates
socket.emit('inventory:low_stock', { itemId, currentLevel, threshold })
socket.emit('inventory:updated', { itemId, newQuantity })

// Menu availability
socket.emit('menu:availability_changed', { itemId, isAvailable, channels })

// Staff updates
socket.emit('staff:clock_in', { userId, timestamp })
socket.emit('staff:clock_out', { userId, timestamp })

// Task updates
socket.emit('task:assigned', { taskId, assignedTo })
socket.emit('task:completed', { taskId, completedBy })

// Voice interactions
socket.emit('voice:command_received', { transcript, confidence })
socket.emit('voice:action_completed', { action, result })
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15+ (primary), Redis (cache)
- **ORM**: Prisma or TypeORM
- **Authentication**: JWT with refresh tokens
- **File Storage**: AWS S3 or local filesystem
- **Queue System**: Bull/BullMQ with Redis
- **WebSockets**: Socket.IO
- **Voice Processing**: OpenAI Whisper, GPT-4, ElevenLabs
- **Testing**: Jest, Supertest
- **Documentation**: OpenAPI/Swagger

### Frontend
- **Framework**: Next.js 14+ with TypeScript
- **UI Library**: React 18+ with Tailwind CSS
- **State Management**: Zustand or Redux Toolkit
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts or Chart.js
- **Real-time**: Socket.IO client
- **Voice**: WebRTC, SpeechRecognition API
- **Testing**: React Testing Library, Playwright
- **Mobile**: React Native (future)

### Infrastructure
- **Cloud Provider**: AWS or Digital Ocean
- **Containerization**: Docker with docker-compose
- **Orchestration**: Kubernetes (production)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK Stack
- **Error Tracking**: Sentry
- **CDN**: CloudFlare

## Security Architecture

### Authentication & Authorization
- JWT-based authentication with short-lived access tokens
- Refresh token rotation for security
- Role-based access control (RBAC)
- API key authentication for integrations
- Multi-factor authentication for administrative accounts

### Data Protection
- Encryption at rest (database, file storage)
- Encryption in transit (HTTPS, WSS)
- PCI DSS compliance for payment data
- GDPR compliance for customer data
- Regular security audits and penetration testing

### Integration Security
- OAuth 2.0 for third-party integrations
- Webhook signature validation
- API rate limiting and DDoS protection
- Input validation and sanitization
- SQL injection and XSS prevention

## Performance & Scalability

### Database Optimization
- Connection pooling
- Read replicas for analytics
- Proper indexing strategy
- Query optimization
- Database sharding (horizontal scaling)

### Caching Strategy
- Redis for session storage
- Application-level caching for menu items
- CDN for static assets
- API response caching with TTL

### Real-time Performance
- WebSocket connection pooling
- Message queue for async processing
- Event-driven architecture
- Horizontal scaling of WebSocket servers

## Monitoring & Observability

### Metrics
- API response times and error rates
- Database query performance
- Voice processing latency
- Integration sync success rates
- User engagement metrics

### Logging
- Structured logging with correlation IDs
- Audit trail for all user actions
- Performance monitoring
- Error tracking and alerting
- Voice interaction logging (anonymized)

### Health Checks
- Database connectivity
- External API availability
- Queue system health
- Voice service status
- Integration platform status

## Development Workflow

### Environment Setup
1. Local development with docker-compose
2. Staging environment for testing
3. Production environment with blue-green deployment
4. Feature branches with automated testing
5. Code review process with automated checks

### Testing Strategy
- Unit tests for business logic
- Integration tests for API endpoints
- End-to-end tests for critical workflows
- Load testing for performance validation
- Voice interaction testing

### Documentation
- API documentation with OpenAPI
- Architecture decision records (ADRs)
- Deployment guides
- User documentation
- Voice command reference

This architecture provides a solid foundation for building Servio as a comprehensive restaurant operating system that can scale from single locations to multi-location chains while maintaining high performance and reliability.