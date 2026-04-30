#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const frontendRoot = path.resolve(__dirname, '..')

const manifestFiles = [
  'public/manifest.json',
  'public/manifest-tablet.webmanifest',
  'public/manifest-staff.json'
]

const serviceWorkerFiles = [
  'public/sw.js',
  'public/sw-staff.js'
]

const missing = []

const checkWebPath = (sourceFile, webPath) => {
  if (!webPath.startsWith('/')) return
  const localPath = path.join(frontendRoot, 'public', webPath.replace(/^\//, ''))
  if (!fs.existsSync(localPath)) {
    missing.push({ sourceFile, webPath })
  }
}

const collectIconLikePaths = (value, sourceFile) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIconLikePaths(item, sourceFile))
    return
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (
        (key === 'src' || key === 'icon' || key === 'badge') &&
        typeof nested === 'string' &&
        nested.includes('/icons/')
      ) {
        checkWebPath(sourceFile, nested)
      }
      collectIconLikePaths(nested, sourceFile)
    }
  }
}

for (const relFile of manifestFiles) {
  const absFile = path.join(frontendRoot, relFile)
  const json = JSON.parse(fs.readFileSync(absFile, 'utf8'))
  collectIconLikePaths(json, relFile)
}

const swPathRegex = /(?:icon|badge)\s*:\s*['"]([^'"]+)['"]/g
for (const relFile of serviceWorkerFiles) {
  const absFile = path.join(frontendRoot, relFile)
  const text = fs.readFileSync(absFile, 'utf8')

  for (const match of text.matchAll(swPathRegex)) {
    const webPath = match[1]
    if (webPath.includes('/icons/')) {
      checkWebPath(relFile, webPath)
    }
  }
}

if (missing.length > 0) {
  console.error('❌ Missing PWA icon files:')
  for (const item of missing) {
    console.error(`- ${item.sourceFile} references ${item.webPath}`)
  }
  process.exit(1)
}

console.log('✅ All manifest/SW icon paths exist.')
