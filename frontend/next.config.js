const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Monorepo: prevent Next from guessing tracing root via lockfiles.
  outputFileTracingRoot: path.join(__dirname, '..')
};

module.exports = nextConfig;

