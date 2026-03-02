import { Router, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { getVersionInfo } from '../middleware/apiVersioning';

const router = Router();

// OpenAPI/Swagger configuration
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Servio Restaurant Platform API',
      version: '2.0.0',
      description: `
## Overview
The Servio Restaurant Platform API provides comprehensive endpoints for managing restaurant operations including:
- Menu management
- Order processing
- Staff scheduling and time tracking
- Inventory management
- Customer notifications
- Voice assistant integration

## Authentication
Authentication requirements vary by route group.
- JWT: Include \`Authorization: Bearer <token>\` header
- API Key: Include \`X-API-Key: <key>\` header (or \`Authorization: Bearer <api-key>\`)

### API key-compatible route groups
- \`/api/orders/**\` (except \`/public/**\`, which is public)
- \`/api/menu/**\` (except \`/public/**\`, which is public)
- \`/api/inventory/**\`
- \`/api/staff/**\` (base staff routes only)
- \`/api/staff/analytics/**\` (read-only analytics endpoints, requires \`read:analytics\`)

### JWT-only route groups
- \`/api/admin/**\`
- \`/api/company/**\`
- \`/api/integrations/**\`
- \`/api/staff/scheduling/**\`
- \`/api/staff/bulk/**\`
- \`/api/staff/clock/**\` uses PIN-based auth (not JWT/API key)
- \`/api/api-keys/**\` (API key lifecycle management)
- Other internal and privileged endpoints unless explicitly documented as API key-compatible

## Rate Limiting
- Authenticated endpoints: 1000 requests/minute
- Public endpoints: 100 requests/minute

## Versioning
- Current version: v2
- Supported versions: v1, v2
- Use URL path: \`/api/v2/...\`
- Or header: \`Accept: application/vnd.servio.v2+json\`
      `,
      contact: {
        name: 'Servio Support',
        email: 'support@servio.solutions'
      },
      license: {
        name: 'Proprietary',
        url: 'https://servio.solutions/license'
      }
    },
    servers: [
      {
        url: 'https://api.servio.solutions',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3002',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key authentication'
        }
      },
      schemas: {
        // Error schemas
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            requestId: { type: 'string' }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation Error' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        
        // Pagination schemas
        PaginationParams: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1, description: 'Page number (1-indexed)' },
            limit: { type: 'integer', example: 20, description: 'Items per page (max 100)' },
            sortBy: { type: 'string', example: 'created_at', description: 'Field to sort by' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], example: 'desc' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' }
              }
            }
          }
        },
        
        // Common schemas
        IdParam: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Unique identifier' }
          },
          required: ['id']
        },
        Timestamp: {
          type: 'object',
          properties: {
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      },
      parameters: {
        page: {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', default: 1 },
          description: 'Page number (1-indexed)'
        },
        limit: {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', default: 20, maximum: 100 },
          description: 'Number of items per page'
        },
        sortBy: {
          in: 'query',
          name: 'sortBy',
          schema: { type: 'string' },
          description: 'Field to sort by'
        },
        sortOrder: {
          in: 'query',
          name: 'sortOrder',
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          description: 'Sort order'
        },
        search: {
          in: 'query',
          name: 'search',
          schema: { type: 'string' },
          description: 'Search query (full-text)'
        },
        id: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Resource ID'
        }
      }
    },
    security: [
      { bearerAuth: [] },
      { apiKey: [] }
    ],
    tags: [
      { name: 'Authentication', description: 'User login and registration' },
      { name: 'Menu', description: 'Menu and category management' },
      { name: 'Orders', description: 'Order creation and management' },
      { name: 'Staff', description: 'Staff management and scheduling' },
      { name: 'Inventory', description: 'Inventory tracking' },
      { name: 'Notifications', description: 'Push and email notifications' },
      { name: 'Analytics', description: 'Reporting and analytics' },
      { name: 'Docs', description: 'API documentation' }
    ]
  },
  apis: ['./src/routes/*.ts']
};

// Generate OpenAPI spec
const swaggerSpec = swaggerJsdoc(swaggerOptions) as any;

// Add custom paths for documentation
swaggerSpec.paths = {
  // Health check
  '/health': {
    get: {
      summary: 'Health check endpoint',
      description: 'Returns the health status of the API',
      tags: ['Docs'],
      responses: {
        '200': {
          description: 'API is healthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ok' },
                  timestamp: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  },
  // API Version info
  '/api/version': {
    get: {
      summary: 'API version information',
      description: 'Returns supported API versions and deprecation schedule',
      tags: ['Docs'],
      responses: {
        '200': {
          description: 'Version information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  current: { type: 'string' },
                  supported: { type: 'array', items: { type: 'string' } },
                  deprecation: { type: 'object' },
                  changes: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  }
};

// Add common endpoint documentation
swaggerSpec.paths['/api/{resource}'] = {
  get: {
    summary: 'List resources with pagination and filtering',
    description: 'Retrieve a paginated list of resources with optional filtering and sorting',
    tags: ['Docs'],
    parameters: [
      { $ref: '#/components/parameters/page' },
      { $ref: '#/components/parameters/limit' },
      { $ref: '#/components/parameters/sortBy' },
      { $ref: '#/components/parameters/sortOrder' },
      {
        in: 'query',
        name: 'status',
        schema: { type: 'string' },
        description: 'Filter by status (exact match)'
      },
      {
        in: 'query',
        name: 'status_in',
        schema: { type: 'string' },
        description: 'Filter by multiple statuses (comma-separated)'
      },
      {
        in: 'query',
        name: 'name_contains',
        schema: { type: 'string' },
        description: 'Filter by name (partial match)'
      },
      {
        in: 'query',
        name: 'date_from',
        schema: { type: 'string', format: 'date' },
        description: 'Filter by start date'
      },
      {
        in: 'query',
        name: 'date_to',
        schema: { type: 'string', format: 'date' },
        description: 'Filter by end date'
      },
      { $ref: '#/components/parameters/search' }
    ],
    responses: {
      '200': {
        description: 'Paginated list of resources',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PaginatedResponse' }
          }
        }
      },
      '400': {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationError' }
          }
        }
      }
    }
  },
  post: {
    summary: 'Create a new resource',
    description: 'Create a new resource with the provided data',
    tags: ['Docs'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object' }
        }
      }
    },
    responses: {
      '201': {
        description: 'Resource created successfully',
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      },
      '400': {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationError' }
          }
        }
      }
    }
  }
};

// Swagger UI setup
router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { font-size: 2.5em; }
    .swagger-ui .info .description { font-size: 1.1em; line-height: 1.6; }
  `,
  customSiteTitle: 'Servio API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

// JSON spec endpoint
router.get('/json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// YAML spec endpoint
router.get('/yaml', (req: Request, res: Response) => {
  const yaml = require('yaml');
  res.setHeader('Content-Type', 'text/yaml');
  res.send(yaml.stringify(swaggerSpec));
});

// Version info endpoint
router.get('/version', (req: Request, res: Response) => {
  res.json(getVersionInfo());
});

export default router;
