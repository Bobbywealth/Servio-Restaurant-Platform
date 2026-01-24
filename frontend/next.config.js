/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,

  // AGGRESSIVE IMAGE OPTIMIZATION
  images: {
    unoptimized: false, // Enable optimization for production
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'], // AVIF first for better compression
    minimumCacheTTL: 31536000, // 1 year cache
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Configure Turbopack root to resolve lockfile warning
  turbopack: {
    root: __dirname,
  },

  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3002',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3002',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:3002',
  },

  async headers() {
    return [
      // Service worker - no cache for updates
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' }
        ],
      },
      // Manifests - no cache for updates
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }
        ],
      },
      {
        source: '/manifest-tablet.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }
        ],
      },
      // Static assets - aggressive caching
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
      // Images - long cache
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }
        ],
      },
      // Icons - immutable
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
      // Fonts - immutable
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      }
    ]
  },

  // EXPERIMENTAL FEATURES FOR SPEED
  experimental: {
    scrollRestoration: true,
    // optimizeCss requires critters package - disabled until lock file is synced
    // optimizeCss: true,
  },

  // PREVENT WATCH LOOPS IN DEV
  onDemandEntries: {
    maxInactiveAge: 120 * 1000, // 2 minutes
    pagesBufferLength: 10,
  },

  // AGGRESSIVE COMPRESSION
  compress: true,
  poweredByHeader: false,

  // COMPILER OPTIMIZATIONS
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // WEBPACK OPTIMIZATIONS
  webpack: (config, { dev, isServer }) => {
    // FIX: Prevent infinite reload loop in dev mode
    if (dev && !isServer) {
      config.watchOptions = {
        ignored: /node_modules/,
        aggregateTimeout: 300,
        poll: false,
      }
    }

    // PRODUCTION OPTIMIZATIONS
    if (!dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': require('path').join(__dirname, '.'),
      }
      // Better tree shaking
      config.optimization.usedExports = true
      config.optimization.sideEffects = true

      // Split chunks more aggressively
      if (!isServer) {
        config.optimization.splitChunks = {
          ...config.optimization.splitChunks,
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            commons: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            lib: {
              test(module) {
                return module.size() > 160000;
              },
              name(module) {
                const hash = require('crypto')
                  .createHash('sha1')
                  .update(module.identifier())
                  .digest('hex')
                  .substring(0, 8);
                return `lib-${hash}`;
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
          },
        }
      }
    }

    // PERFORMANCE OPTIMIZATIONS FOR ALL BUILDS
    config.resolve.extensions = ['.tsx', '.ts', '.js', '.jsx', '.json']
    config.resolve.symlinks = false // Faster module resolution

    // OPTIMIZE BUNDLE SIZE
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }
    }

    // MODULE RULES FOR PERFORMANCE
    config.module.rules.push({
      test: /\.svg$/,
      use: [{
        loader: '@svgr/webpack',
        options: {
          svgoConfig: {
            plugins: [{
              name: 'removeViewBox',
              active: false
            }]
          }
        }
      }]
    })

    return config
  },

  // ASSET OPTIMIZATION
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',

  // Generate ETags for caching
  generateEtags: true,
}

module.exports = nextConfig
