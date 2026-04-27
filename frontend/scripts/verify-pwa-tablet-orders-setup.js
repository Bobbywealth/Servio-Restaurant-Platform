#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const checks = [];

function recordCheck(name, passed, details) {
  checks.push({ name, passed, details });
}

function readUtf8(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function verifyManifest() {
  const manifest = JSON.parse(readUtf8('public/manifest-tablet.webmanifest'));

  const hasCorrectStartUrl = manifest.start_url === '/tablet/orders';
  const hasCorrectScope = manifest.scope === '/tablet/';
  const isStandalone = manifest.display === 'standalone';

  recordCheck(
    'Tablet manifest routes and install mode',
    hasCorrectStartUrl && hasCorrectScope && isStandalone,
    {
      start_url: manifest.start_url,
      scope: manifest.scope,
      display: manifest.display,
    }
  );
}

function verifyServiceWorkerCoverage() {
  const swSource = readUtf8('public/sw.js');
  const hasManifestCache = swSource.includes("'/manifest-tablet.webmanifest'");
  const hasOrdersNavigation = swSource.includes("url: '/tablet/orders'");
  const hasOrdersNotificationRoute = swSource.includes("'order.created_web': '/tablet/orders'");

  recordCheck(
    'Service worker supports tablet orders PWA behavior',
    hasManifestCache && hasOrdersNavigation && hasOrdersNotificationRoute,
    {
      manifestCached: hasManifestCache,
      tabletOrdersNavigation: hasOrdersNavigation,
      orderNotificationRoute: hasOrdersNotificationRoute,
    }
  );
}

function verifyTabletOrdersEntryPoints() {
  const sidebarSource = readUtf8('components/tablet/TabletSidebar.tsx');
  const hasOrdersNav = sidebarSource.includes("{ label: 'Orders', href: '/tablet/orders'");

  const pagePath = path.join(rootDir, 'pages/tablet/orders.tsx');
  const hasOrdersPage = fs.existsSync(pagePath);

  recordCheck(
    'Tablet orders UI entry points exist',
    hasOrdersNav && hasOrdersPage,
    {
      ordersNavLink: hasOrdersNav,
      tabletOrdersPageFile: hasOrdersPage,
    }
  );
}

function run() {
  verifyManifest();
  verifyServiceWorkerCoverage();
  verifyTabletOrdersEntryPoints();

  let failed = 0;
  for (const check of checks) {
    const marker = check.passed ? '✅' : '❌';
    console.log(`${marker} ${check.name}`);
    console.log(`   ${JSON.stringify(check.details)}`);
    if (!check.passed) failed += 1;
  }

  if (failed > 0) {
    console.error(`\n${failed} setup check(s) failed.`);
    process.exit(1);
  }

  console.log('\nAll tablet orders PWA setup checks passed.');
}

run();
