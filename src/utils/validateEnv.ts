import { logger } from './logger';

export interface EnvStatus {
  valid: boolean;
  errors: string[];
  warnings: string[];
  services: {
    database: 'configured' | 'missing';
    assistant: 'available' | 'unavailable';
    auth: 'secure' | 'insecure';
    uploads: 'configured' | 'default';
    email: 'configured' | 'missing' | 'partial';
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

  if (!hasDbUrl) {
    errors.push('DATABASE_URL is required - PostgreSQL is the only supported database');
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
    errors.push('Set FRONTEND_URL to your frontend URL (e.g., https://servio-app.onrender.com)');
  } else if (!frontendUrl) {
    warnings.push('FRONTEND_URL not set - using localhost default');
  }

  // Warn about CORS configuration in production
  if (isProd && frontendUrl && !frontendUrl.startsWith('https://')) {
    warnings.push('FRONTEND_URL should use https:// in production for security');
  }

  // === OPENAI_API_KEY (optional but affects features) ===
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (!hasOpenAI) {
    warnings.push('OPENAI_API_KEY not set - Assistant features will be disabled');
  }


  // === EMAIL (optional but required for email notifications) ===
  const emailHost = process.env.EMAIL_HOST;
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailFrom = process.env.EMAIL_FROM;
  const hasAnyEmail = Boolean(emailHost || emailUser || emailPass || emailFrom);
  const hasFullEmail = Boolean(emailHost && emailUser && emailPass && emailFrom);

  if (hasAnyEmail && !hasFullEmail) {
    warnings.push('Email is partially configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS, and EMAIL_FROM for Outlook/Microsoft 365 notifications.');
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
  logger.info(`DATABASE_URL:    ${hasDbUrl ? '[CONFIGURED]' : '[NOT SET - REQUIRED]'}`);
  logger.info(`DATABASE_SSL:    ${dbSsl || 'false'}`);
  logger.info(`JWT_SECRET:      ${isInsecureJwt ? '[INSECURE DEFAULT]' : '[CONFIGURED]'}`);
  logger.info(`FRONTEND_URL:    ${frontendUrl || '[NOT SET - localhost]'}`);
  logger.info(`OPENAI_API_KEY:  ${hasOpenAI ? '[CONFIGURED]' : '[NOT SET]'}`);
  logger.info(`UPLOADS_DIR:     ${uploadsDir || '[DEFAULT: ./uploads]'}`);
  logger.info(`EMAIL:           ${hasFullEmail ? '[CONFIGURED]' : hasAnyEmail ? '[PARTIAL]' : '[NOT SET]'}`);
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
  } else {
    logger.info('');
    logger.info('💡 Quick Fix Guide:');
    logger.info('   - Set FRONTEND_URL to your frontend URL (e.g., https://servio-app.onrender.com)');
    logger.info('   - Set DATABASE_URL to your PostgreSQL connection string');
    logger.info('   - Set JWT_SECRET to a secure random value');
    logger.info('   - Set OPENAI_API_KEY for Assistant features');
    logger.info('');
    logger.info('📖 Full deployment guide: See RENDER_DEPLOYMENT.md');
  }

  logger.info('========================================');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    services: {
      database: hasDbUrl ? 'configured' : 'missing',
      assistant: hasOpenAI ? 'available' : 'unavailable',
      auth: isInsecureJwt ? 'insecure' : 'secure',
      uploads: uploadsDir ? 'configured' : 'default',
      email: hasFullEmail ? 'configured' : hasAnyEmail ? 'partial' : 'missing',
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
 * Automatically includes both HTTP and HTTPS versions for production URLs.
 */
export function getCorsOrigins(defaultOrigin?: string): string[] {
  const origins = new Set<string>();
  const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');

  const addOriginWithVariants = (origin: string) => {
    const normalized = normalizeOrigin(origin);
    if (!normalized) return;

    origins.add(normalized);

    // For production URLs (not localhost), add both HTTP and HTTPS variants
    if (!normalized.includes('localhost')) {
      if (normalized.startsWith('http://')) {
        origins.add(normalized.replace('http://', 'https://'));
      } else if (normalized.startsWith('https://')) {
        origins.add(normalized.replace('https://', 'http://'));
      } else {
        // No protocol specified - add both
        origins.add(`http://${normalized}`);
        origins.add(`https://${normalized}`);
      }
    }
  };

  // Primary: FRONTEND_URL
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    addOriginWithVariants(frontendUrl);
  }

  // Additional: ALLOWED_ORIGINS (comma-separated)
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins) {
    const additional = allowedOrigins
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean);
    additional.forEach(origin => addOriginWithVariants(origin));
  }

  // Fallback for development
  if (origins.size === 0) {
    if (defaultOrigin) {
      addOriginWithVariants(defaultOrigin);
    } else {
      // Development defaults
      origins.add('http://localhost:3000');
      origins.add('http://localhost:3001');
      origins.add('http://localhost:3003');
    }
  }

  return Array.from(origins);
}
