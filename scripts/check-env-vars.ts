#!/usr/bin/env tsx
/**
 * Build-Time Environment Variable Checker
 * Validates that all required environment variables are set before building
 */

import * as fs from 'fs'
import * as path from 'path'

interface EnvVarCheck {
  name: string
  description: string
  required: boolean
  default?: string
}

const REQUIRED_ENV_VARS: EnvVarCheck[] = [
  // Database
  { name: 'DATABASE_URL', description: 'PostgreSQL database connection URL', required: true },
  { name: 'DATABASE_HOST', description: 'Database host', required: false },
  { name: 'DATABASE_PORT', description: 'Database port', required: false },
  { name: 'DATABASE_NAME', description: 'Database name', required: false },
  { name: 'DATABASE_USER', description: 'Database user', required: false },
  { name: 'DATABASE_PASSWORD', description: 'Database password', required: false },

  // JWT
  { name: 'JWT_SECRET', description: 'JWT secret for token signing', required: true },
  { name: 'JWT_EXPIRATION', description: 'JWT token expiration time', required: false },

  // Auth
  { name: 'SESSION_SECRET', description: 'Session secret for cookie encryption', required: true },

  // API
  { name: 'API_PORT', description: 'API server port', required: false },
  { name: 'NODE_ENV', description: 'Environment (development/production)', required: true },

  // Email (optional but recommended)
  { name: 'EMAIL_HOST', description: 'Email server host', required: false },
  { name: 'EMAIL_PORT', description: 'Email server port', required: false },
  { name: 'EMAIL_USER', description: 'Email server user', required: false },
  { name: 'EMAIL_PASSWORD', description: 'Email server password', required: false },

  // SMS (optional but recommended)
  { name: 'TWILIO_ACCOUNT_SID', description: 'Twilio account SID', required: false },
  { name: 'TWILIO_AUTH_TOKEN', description: 'Twilio auth token', required: false },
  { name: 'TWILIO_PHONE_NUMBER', description: 'Twilio phone number', required: false },

  // Payment (optional but recommended)
  { name: 'STRIPE_SECRET_KEY', description: 'Stripe secret key', required: false },
  { name: 'STRIPE_PUBLISHABLE_KEY', description: 'Stripe publishable key', required: false },

  // Storage (optional)
  { name: 'S3_BUCKET', description: 'S3 bucket name', required: false },
  { name: 'AWS_ACCESS_KEY_ID', description: 'AWS access key ID', required: false },
  { name: 'AWS_SECRET_ACCESS_KEY', description: 'AWS secret access key', required: false },
  { name: 'AWS_REGION', description: 'AWS region', required: false },

  // Voice Agent (optional)
  { name: 'OPENAI_API_KEY', description: 'OpenAI API key for voice agent', required: false },

  // Frontend (for development)
  { name: 'NEXT_PUBLIC_API_URL', description: 'Frontend API URL', required: true },
  { name: 'NEXT_PUBLIC_BACKEND_URL', description: 'Frontend backend URL', required: false },
]

const OPTIONAL_ENV_VARS: EnvVarCheck[] = [
  { name: 'LOG_LEVEL', description: 'Logging level (debug/info/warn/error)', required: false, default: 'info' },
  { name: 'CACHE_TTL', description: 'Cache TTL in seconds', required: false, default: '3600' },
  { name: 'RATE_LIMIT_WINDOW', description: 'Rate limit window in milliseconds', required: false, default: '900000' },
  { name: 'RATE_LIMIT_MAX', description: 'Rate limit max requests', required: false, default: '100' },
]

function checkEnvVars(env: NodeJS.ProcessEnv): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = []
  const warnings: string[] = []

  // Check required vars
  REQUIRED_ENV_VARS.forEach(({ name, description }) => {
    if (!env[name]) {
      missing.push(`${name} (${description})`)
    }
  })

  // Check optional vars with defaults
  OPTIONAL_ENV_VARS.forEach(({ name, description, default: defaultValue }) => {
    if (!env[name]) {
      warnings.push(`${name} (${description}) - Default: ${defaultValue || 'not set'}`)
    }
  })

  return {
    valid: missing.length === 0,
    missing,
    warnings
  }
}

function printResults(result: { valid: boolean; missing: string[]; warnings: string[] }) {
  console.log('\n' + '='.repeat(70))
  console.log('Environment Variable Check Results')
  console.log('='.repeat(70))

  if (result.missing.length > 0) {
    console.log('\n❌ MISSING REQUIRED VARIABLES:')
    result.missing.forEach((varName, index) => {
      console.log(`   ${index + 1}. ${varName}`)
    })
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  OPTIONAL VARIABLES NOT SET:')
    result.warnings.forEach((varName, index) => {
      console.log(`   ${index + 1}. ${varName}`)
    })
  }

  if (result.valid) {
    console.log('\n✅ All required environment variables are set!')
    console.log('\n💡 Tip: Add missing variables to your .env file or deployment configuration.')
  }

  console.log('\n' + '='.repeat(70) + '\n')
}

function main() {
  const env = process.env

  console.log('Checking environment variables...')

  const result = checkEnvVars(env)
  printResults(result)

  if (!result.valid) {
    console.error('Build cannot proceed due to missing required environment variables.')
    process.exit(1)
  }
}

main()
