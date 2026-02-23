import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser } from '../../contexts/UserContext';

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  scopes: string[];
  requiresAuth: boolean;
  requestExample?: string;
  responseExample?: string;
}

interface ApiSection {
  title: string;
  description: string;
  endpoints: ApiEndpoint[];
}

const API_SECTIONS: ApiSection[] = [
  {
    title: 'Authentication',
    description: 'API keys are used to authenticate requests. Include your API key in the Authorization header as a Bearer token or in the X-API-Key header.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/api-keys',
        description: 'List all API keys for your account',
        scopes: ['authenticated'],
        requiresAuth: true,
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "name": "My API Key",
      "keyPrefix": "sk_live_1a2b",
      "scopes": ["read:orders", "write:orders"],
      "createdAt": "2026-02-23T00:00:00Z"
    }
  ]
}`
      },
      {
        method: 'POST',
        path: '/api/api-keys',
        description: 'Create a new API key',
        scopes: ['authenticated'],
        requiresAuth: true,
        requestExample: `{
  "name": "My Integration",
  "scopes": ["read:orders", "write:orders"],
  "rateLimit": 1000,
  "expiresAt": "2027-02-23T00:00:00Z"
}`,
        responseExample: `{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "My Integration",
    "key": "sk_live_abc123...",  // Save this - only shown once!
    "keyPrefix": "sk_live_1a2b",
    "scopes": ["read:orders", "write:orders"]
  }
}`
      }
    ]
  },
  {
    title: 'Orders',
    description: 'Manage orders for your restaurant',
    endpoints: [
      {
        method: 'GET',
        path: '/api/orders',
        description: 'List all orders',
        scopes: ['read:orders', 'admin:full'],
        requiresAuth: true,
        responseExample: `{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order-123",
        "status": "pending",
        "total": 25.99,
        "customer": { "name": "John Doe" },
        "items": [...],
        "createdAt": "2026-02-23T12:00:00Z"
      }
    ]
  }
}`
      },
      {
        method: 'GET',
        path: '/api/orders/:id',
        description: 'Get a specific order by ID',
        scopes: ['read:orders', 'admin:full'],
        requiresAuth: true
      },
      {
        method: 'POST',
        path: '/api/orders',
        description: 'Create a new order',
        scopes: ['write:orders', 'admin:full'],
        requiresAuth: true,
        requestExample: `{
  "customer": { "name": "John Doe", "phone": "555-1234" },
  "items": [
    { "menuItemId": "item-1", "quantity": 2, "notes": "No onions" }
  ],
  "type": "pickup"
}`
      },
      {
        method: 'PATCH',
        path: '/api/orders/:id/status',
        description: 'Update order status',
        scopes: ['write:orders', 'admin:full'],
        requiresAuth: true,
        requestExample: `{
  "status": "preparing"
}`
      }
    ]
  },
  {
    title: 'Menu',
    description: 'Manage menu items and categories',
    endpoints: [
      {
        method: 'GET',
        path: '/api/menu/categories/all',
        description: 'Get all menu categories',
        scopes: ['read:menu', 'admin:full'],
        requiresAuth: true,
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": "cat-1",
      "name": "Appetizers",
      "sort_order": 1,
      "item_count": 12
    }
  ]
}`
      },
      {
        method: 'GET',
        path: '/api/menu/items/full',
        description: 'Get all menu items with full details',
        scopes: ['read:menu', 'admin:full'],
        requiresAuth: true
      },
      {
        method: 'POST',
        path: '/api/menu/items',
        description: 'Create a new menu item',
        scopes: ['write:menu', 'admin:full'],
        requiresAuth: true,
        requestExample: `{
  "name": "Caesar Salad",
  "description": "Fresh romaine with parmesan",
  "price": 12.99,
  "category_id": "cat-1",
  "is_available": true
}`
      },
      {
        method: 'PATCH',
        path: '/api/menu/items/:id',
        description: 'Update a menu item',
        scopes: ['write:menu', 'admin:full'],
        requiresAuth: true
      },
      {
        method: 'DELETE',
        path: '/api/menu/items/:id',
        description: 'Delete a menu item',
        scopes: ['write:menu', 'admin:full'],
        requiresAuth: true
      }
    ]
  },
  {
    title: 'Inventory',
    description: 'Track and manage inventory levels',
    endpoints: [
      {
        method: 'GET',
        path: '/api/inventory',
        description: 'List inventory items',
        scopes: ['read:inventory', 'admin:full'],
        requiresAuth: true
      },
      {
        method: 'PATCH',
        path: '/api/inventory/:id',
        description: 'Update inventory quantity',
        scopes: ['write:inventory', 'admin:full'],
        requiresAuth: true,
        requestExample: `{
  "quantity": 50,
  "lowStockThreshold": 10
}`
      }
    ]
  },
  {
    title: 'Staff',
    description: 'Access staff information and schedules',
    endpoints: [
      {
        method: 'GET',
        path: '/api/staff',
        description: 'List staff members',
        scopes: ['read:staff', 'admin:full'],
        requiresAuth: true
      },
      {
        method: 'GET',
        path: '/api/staff/scheduling',
        description: 'Get staff schedules',
        scopes: ['read:staff', 'admin:full'],
        requiresAuth: true
      }
    ]
  },
  {
    title: 'Analytics',
    description: 'Access analytics and reporting data',
    endpoints: [
      {
        method: 'GET',
        path: '/api/analytics/sales',
        description: 'Get sales analytics',
        scopes: ['read:analytics', 'admin:full'],
        requiresAuth: true
      },
      {
        method: 'GET',
        path: '/api/analytics/popular-items',
        description: 'Get popular menu items',
        scopes: ['read:analytics', 'admin:full'],
        requiresAuth: true
      }
    ]
  },
  {
    title: 'Webhooks',
    description: 'Configure webhooks for real-time event notifications',
    endpoints: [
      {
        method: 'GET',
        path: '/api/api-keys/:id/webhooks',
        description: 'List webhooks for an API key',
        scopes: ['webhooks', 'admin:full'],
        requiresAuth: true
      },
      {
        method: 'POST',
        path: '/api/api-keys/:id/webhooks',
        description: 'Create a webhook',
        scopes: ['webhooks', 'admin:full'],
        requiresAuth: true,
        requestExample: `{
  "name": "Order Webhook",
  "url": "https://your-server.com/webhooks/orders",
  "events": ["order.created", "order.updated", "order.completed"]
}`
      }
    ]
  }
];

const SCOPES = [
  { name: 'read:orders', description: 'View orders' },
  { name: 'write:orders', description: 'Create and update orders' },
  { name: 'read:menu', description: 'View menu items and categories' },
  { name: 'write:menu', description: 'Create, update, and delete menu items' },
  { name: 'read:customers', description: 'View customer information' },
  { name: 'write:customers', description: 'Create and update customers' },
  { name: 'read:inventory', description: 'View inventory levels' },
  { name: 'write:inventory', description: 'Update inventory' },
  { name: 'read:staff', description: 'View staff information' },
  { name: 'write:staff', description: 'Manage staff records' },
  { name: 'read:analytics', description: 'Access analytics and reports' },
  { name: 'read:reservations', description: 'View reservations' },
  { name: 'write:reservations', description: 'Manage reservations' },
  { name: 'read:payments', description: 'View payment information' },
  { name: 'write:payments', description: 'Process payments' },
  { name: 'webhooks', description: 'Manage webhooks' },
  { name: 'admin:full', description: 'Full administrative access' },
];

const WEBHOOK_EVENTS = [
  { name: 'order.created', description: 'Triggered when a new order is placed' },
  { name: 'order.updated', description: 'Triggered when an order is updated' },
  { name: 'order.completed', description: 'Triggered when an order is completed' },
  { name: 'order.cancelled', description: 'Triggered when an order is cancelled' },
  { name: 'menu.updated', description: 'Triggered when menu items are changed' },
  { name: 'inventory.low_stock', description: 'Triggered when inventory is low' },
  { name: 'customer.created', description: 'Triggered when a new customer is added' },
  { name: 'payment.received', description: 'Triggered when payment is received' },
  { name: 'reservation.created', description: 'Triggered when a reservation is made' },
  { name: 'reservation.updated', description: 'Triggered when a reservation is updated' },
];

export default function ApiDocsPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [activeSection, setActiveSection] = useState<string>('authentication');
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/api/docs');
    }
  }, [user, loading, router]);

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-green-500';
      case 'POST': return 'bg-blue-500';
      case 'PUT': return 'bg-yellow-500';
      case 'PATCH': return 'bg-orange-500';
      case 'DELETE': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>API Documentation | Servio</title>
        <meta name="description" content="Servio API Documentation - Integrate with the Servio restaurant platform" />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold">API Documentation</h1>
              </div>
              <a
                href="/dashboard/api-keys"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                Manage API Keys
              </a>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0">
              <nav className="sticky top-24 space-y-1">
                <button
                  onClick={() => setActiveSection('overview')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeSection === 'overview' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveSection('authentication')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeSection === 'authentication' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  Authentication
                </button>
                <button
                  onClick={() => setActiveSection('scopes')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeSection === 'scopes' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  Scopes & Permissions
                </button>
                <button
                  onClick={() => setActiveSection('webhooks')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeSection === 'webhooks' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  Webhooks
                </button>
                
                <div className="pt-4 pb-2">
                  <span className="px-4 text-xs font-semibold text-gray-500 uppercase">Endpoints</span>
                </div>
                
                {API_SECTIONS.map((section) => (
                  <button
                    key={section.title}
                    onClick={() => setActiveSection(section.title.toLowerCase())}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      activeSection === section.title.toLowerCase() ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {/* Overview Section */}
              {activeSection === 'overview' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold mb-4">Servio API</h2>
                    <p className="text-gray-400 text-lg">
                      Integrate your applications with the Servio restaurant platform. Our RESTful API provides
                      programmatic access to orders, menu items, inventory, staff, and more.
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Base URL</h3>
                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                      https://servio-backend-zexb.onrender.com
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
                    <ol className="list-decimal list-inside space-y-3 text-gray-300">
                      <li>Create an API key from the <a href="/dashboard/api-keys" className="text-blue-400 hover:underline">API Keys dashboard</a></li>
                      <li>Include your API key in requests using the <code className="bg-gray-700 px-2 py-1 rounded">Authorization: Bearer sk_live_...</code> header</li>
                      <li>Make requests to any endpoint your key has permission to access</li>
                    </ol>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Example Request</h3>
                    <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
{`curl -X GET "https://servio-backend-zexb.onrender.com/api/orders" \\
  -H "Authorization: Bearer sk_live_your_api_key_here" \\
  -H "Content-Type: application/json"`}
                    </pre>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800 rounded-lg p-6">
                      <div className="text-3xl mb-2">🔐</div>
                      <h4 className="font-semibold mb-2">Secure</h4>
                      <p className="text-gray-400 text-sm">API keys are hashed and scopes limit access to only what's needed</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-6">
                      <div className="text-3xl mb-2">⚡</div>
                      <h4 className="font-semibold mb-2">Fast</h4>
                      <p className="text-gray-400 text-sm">Rate limiting ensures fair usage and optimal performance</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-6">
                      <div className="text-3xl mb-2">🔔</div>
                      <h4 className="font-semibold mb-2">Webhooks</h4>
                      <p className="text-gray-400 text-sm">Real-time notifications for orders, inventory, and more</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Authentication Section */}
              {activeSection === 'authentication' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold mb-4">Authentication</h2>
                    <p className="text-gray-400 text-lg">
                      All API requests must be authenticated with a valid API key. Keys can be passed
                      in the Authorization header or X-API-Key header.
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Using the Authorization Header</h3>
                    <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
{`curl -X GET "https://servio-backend-zexb.onrender.com/api/orders" \\
  -H "Authorization: Bearer sk_live_your_api_key_here"`}
                    </pre>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Using the X-API-Key Header</h3>
                    <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
{`curl -X GET "https://servio-backend-zexb.onrender.com/api/orders" \\
  -H "X-API-Key: sk_live_your_api_key_here"`}
                    </pre>
                  </div>

                  <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 text-yellow-400">⚠️ Security Best Practices</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                      <li>Never share your API key or commit it to version control</li>
                      <li>Use environment variables to store API keys</li>
                      <li>Create separate keys for different integrations</li>
                      <li>Rotate keys periodically and revoke unused keys</li>
                      <li>Use minimal scopes required for your integration</li>
                    </ul>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Rate Limiting</h3>
                    <p className="text-gray-400 mb-4">
                      API keys have configurable rate limits (default: 1000 requests/hour). Rate limit
                      headers are included in every response:
                    </p>
                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm space-y-1">
                      <div>X-RateLimit-Limit: 1000</div>
                      <div>X-RateLimit-Remaining: 999</div>
                      <div>X-RateLimit-Reset: 1708704000</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scopes Section */}
              {activeSection === 'scopes' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold mb-4">Scopes & Permissions</h2>
                    <p className="text-gray-400 text-lg">
                      API key scopes define what endpoints and actions the key can access. Always
                      request the minimum scopes needed for your integration.
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold">Scope</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {SCOPES.map((scope) => (
                          <tr key={scope.name} className="hover:bg-gray-700/50">
                            <td className="px-6 py-4 font-mono text-sm text-blue-400">{scope.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-300">{scope.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Webhooks Section */}
              {activeSection === 'webhooks' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold mb-4">Webhooks</h2>
                    <p className="text-gray-400 text-lg">
                      Webhooks allow your application to receive real-time notifications when events
                      occur in your Servio account.
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Webhook Payload</h3>
                    <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
{`{
  "event": "order.created",
  "timestamp": "2026-02-23T12:00:00Z",
  "data": {
    "order": {
      "id": "order-123",
      "status": "pending",
      "total": 25.99,
      "customer": { "name": "John Doe" }
    }
  },
  "signature": "sha256=..."  // HMAC signature for verification
}`}
                    </pre>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Verifying Webhooks</h3>
                    <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = 'sha256=' + 
    crypto.createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  return signature === expectedSignature;
}`}
                    </pre>
                  </div>

                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <h3 className="text-xl font-semibold p-6 pb-4">Available Events</h3>
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold">Event</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {WEBHOOK_EVENTS.map((event) => (
                          <tr key={event.name} className="hover:bg-gray-700/50">
                            <td className="px-6 py-4 font-mono text-sm text-blue-400">{event.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-300">{event.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* API Endpoint Sections */}
              {API_SECTIONS.map((section) => (
                activeSection === section.title.toLowerCase() && (
                  <div key={section.title} className="space-y-6">
                    <div>
                      <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
                      <p className="text-gray-400 text-lg">{section.description}</p>
                    </div>

                    <div className="space-y-4">
                      {section.endpoints.map((endpoint, idx) => (
                        <div
                          key={`${endpoint.method}-${endpoint.path}`}
                          className="bg-gray-800 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedEndpoint(
                              expandedEndpoint === `${section.title}-${idx}` ? null : `${section.title}-${idx}`
                            )}
                            className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-700/50 transition-colors"
                          >
                            <span className={`${getMethodColor(endpoint.method)} px-2 py-1 rounded text-xs font-bold uppercase`}>
                              {endpoint.method}
                            </span>
                            <code className="font-mono text-sm flex-1 text-left">{endpoint.path}</code>
                            <div className="flex items-center gap-2">
                              {endpoint.scopes.map((scope) => (
                                <span key={scope} className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-400">
                                  {scope}
                                </span>
                              ))}
                            </div>
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${
                                expandedEndpoint === `${section.title}-${idx}` ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {expandedEndpoint === `${section.title}-${idx}` && (
                            <div className="px-6 py-4 border-t border-gray-700 space-y-4">
                              <p className="text-gray-300">{endpoint.description}</p>

                              {endpoint.requestExample && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Request Example</h4>
                                  <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
                                    {endpoint.requestExample}
                                  </pre>
                                </div>
                              )}

                              {endpoint.responseExample && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Response Example</h4>
                                  <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
                                    {endpoint.responseExample}
                                  </pre>
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-gray-400">Required Scopes:</span>
                                <div className="flex gap-2">
                                  {endpoint.scopes.map((scope) => (
                                    <span key={scope} className="bg-blue-900/50 text-blue-400 px-2 py-1 rounded">
                                      {scope}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
