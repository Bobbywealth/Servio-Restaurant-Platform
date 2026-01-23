import { logger } from './logger';

export interface EnvStatus {
  valid: boolean;
  errors: string[];
  warnings: string[];
  services: {
    database: 'configured' | 'sqlite-fallback' | 'missing';
    assistant: 'available' | 'unavailable';
    auth: 'secure' | 'insecure';
    uploads: 'configured' | 'default';
  };
}

/**
 * Validate environment variables for production readiness.
 * Logs status and returns validation result.
 */
export function validateEnvironment(): EnvStatus {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  // === DATABASE ===
  const hasDbUrl = !!process.env.DATABASE_URL;
  const dbSsl = process.env.DATABASE_SSL;
  
  if (!hasDbUrl && isProd) {
    errors.push('DATABASE_URL is required in production (no SQLite fallback available)');
  } else if (!hasDbUrl) {
    warnings.push('DATABASE_URL not set - using SQLite (OK for development)');
  }

  // DATABASE_SSL parsing
  if (hasDbUrl && isProd && dbSsl !== 'true') {
    warnings.push('DATABASE_SSL should be "true" for Render PostgreSQL');
  }

  // === JWT_SECRET ===
  const jwtSecret = process.env.JWT_SECRET;
  const isInsecureJwt = !jwtSecret || jwtSecret === 'dev_insecure_jwt_secret_change_me';
  
  if (isProd && isInsecureJwt) {
    errors.push('JWT_SECRET must be set to a secure value in production (no default allowed)');
  } else if (isInsecureJwt) {
    warnings.push('JWT_SECRET using insecure default (OK for development only)');
  }

  // === FRONTEND_URL (required in production for CORS) ===
  const frontendUrl = process.env.FRONTEND_URL;
  if (isProd && (!frontendUrl || frontendUrl.includes('localhost'))) {
    errors.push('FRONTEND_URL is required in production and must not be localhost');
  } else if (!frontendUrl) {
    warnings.push('FRONTEND_URL not set - using localhost default');
  }

  // === OPENAI_API_KEY (optional but affects features) ===
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (!hasOpenAI) {
    warnings.push('OPENAI_API_KEY not set - Assistant features will be disabled');
  }

  // === UPLOADS_DIR (optional) ===
  const uploadsDir = process.env.UPLOADS_DIR;
  if (isProd && !uploadsDir) {
    warnings.push('UPLOADS_DIR not set - using default. For Render, set to persistent disk path (e.g., /var/data/uploads)');
  }

  // === Log Results ===
  logger.info('========================================');
  logger.info('       ENVIRONMENT VALIDATION');
  logger.info('========================================');
  logger.info(`NODE_ENV:        ${process.env.NODE_ENV || 'development'}`);
  logger.info(`DATABASE_URL:    ${hasDbUrl ? '[CONFIGURED]' : '[NOT SET - SQLite fallback]'}`);
  logger.info(`DATABASE_SSL:    ${dbSsl || 'false'}`);
  logger.info(`JWT_SECRET:      ${isInsecureJwt ? '[INSECURE DEFAULT]' : '[CONFIGURED]'}`);
  logger.info(`FRONTEND_URL:    ${frontendUrl || '[NOT SET - localhost]'}`);
  logger.info(`OPENAI_API_KEY:  ${hasOpenAI ? '[CONFIGURED]' : '[NOT SET]'}`);
  logger.info(`UPLOADS_DIR:     ${uploadsDir || '[DEFAULT: ./uploads]'}`);
  logger.info('----------------------------------------');

  if (errors.length > 0) {
    logger.error('VALIDATION FAILED - Required variables missing:');
    errors.forEach(e => logger.error(`  ✗ ${e}`));
  }

  if (warnings.length > 0) {
    logger.warn('Warnings:');
    warnings.forEach(w => logger.warn(`  ⚠ ${w}`));
  }

  if (errors.length === 0) {
    logger.info('✓ Environment validation passed');
  }

  logger.info('========================================');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    services: {
      database: hasDbUrl ? 'configured' : (isProd ? 'missing' : 'sqlite-fallback'),
      assistant: hasOpenAI ? 'available' : 'unavailable',
      auth: isInsecureJwt ? 'insecure' : 'secure',
      uploads: uploadsDir ? 'configured' : 'default',
    }
  };
}

/**
 * Validate environment and exit if invalid (production only).
 * Call this at server startup before any other initialization.
 */
export function failFastIfInvalid(): void {
  const status = validateEnvironment();
  
  if (!status.valid) {
    logger.error('');
    logger.error('╔══════════════════════════════════════════════════════════════╗');
    logger.error('║  SERVER CANNOT START - ENVIRONMENT VALIDATION FAILED         ║');
    logger.error('║  Please set the required environment variables and restart.  ║');
    logger.error('╚══════════════════════════════════════════════════════════════╝');
    logger.error('');
    process.exit(1);
  }
}

/**
 * Get parsed CORS origins from environment.
 * Uses FRONTEND_URL as primary, ALLOWED_ORIGINS for additional domains.
 */
export function getCorsOrigins(): string[] {
  const origins = new Set<string>();

  // Canonical production origins (hardcoded safety net)
  // Keep in sync with src/server.ts + middleware/errorHandler.ts
  origins.add('https://servio-app.onrender.com');
  
  // Primary: FRONTEND_URL
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    origins.add(frontendUrl);
  }
  
  // Additional: ALLOWED_ORIGINS (comma-separated)
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins) {
    const additional = allowedOrigins.split(',').map(o => o.trim()).filter(Boolean);
    for (const o of additional) origins.add(o);
  }
  
  // Fallback for development
  if (origins.size === 0) {
    origins.add('http://localhost:3000');
  }
  
  return Array.from(origins);
}
