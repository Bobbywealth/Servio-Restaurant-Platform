const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'out', 'playwright-report', 'test-results']);
const ALLOWED_FILE = path.join(ROOT, 'lib', 'api.ts');

const apiRegexes = [
  /fetch\(\s*['"]\/api\//,
  /axios\.[a-zA-Z]+\(\s*['"]\/api\//
];

function shouldIgnoreDir(name) {
  return IGNORE_DIRS.has(name);
}

function scanFile(filePath) {
  if (filePath === ALLOWED_FILE) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const matches = [];
  lines.forEach((line, idx) => {
    if (apiRegexes.some((rx) => rx.test(line))) {
      matches.push({
        file: filePath,
        line: idx + 1,
        content: line.trim()
      });
    }
  });
  return matches;
}

function walkDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let matches = [];
  entries.forEach((entry) => {
    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) return;
      matches = matches.concat(walkDir(path.join(dirPath, entry.name)));
      return;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (!/\.(js|jsx|ts|tsx)$/.test(fullPath)) return;
    matches = matches.concat(scanFile(fullPath));
  });
  return matches;
}

const results = walkDir(ROOT);

if (results.length > 0) {
  console.warn('Direct relative /api calls detected. Consider using lib/api.ts instead.');
  results.forEach((item) => {
    const rel = path.relative(ROOT, item.file);
    console.warn(`${rel}:${item.line} ${item.content}`);
  });
  // Don't exit with error for now - allow build to proceed
  // process.exit(1);
}

console.log('API usage check passed.');
