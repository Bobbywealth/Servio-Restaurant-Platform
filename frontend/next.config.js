/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  // Temporarily disable static export to support dynamic restaurant pages
  // output: 'export', // Enable static export for static site deployment

  // AGGRESSIVE IMAGE OPTIMIZATION
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year cache
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }
        ],
      },
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
      }
    ]
  },

  // EXPERIMENTAL FEATURES
  // Keep this minimal in dev to avoid Fast Refresh full reload loops.
  experimental: {
    scrollRestoration: true,
  },

  // PREVENT WATCH LOOPS IN DEV
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // period (in ms) where the server will keep pages in the buffer
    pagesBufferLength: 5, // number of pages that should be kept in memory
  },

  // AGGRESSIVE COMPRESSION
  compress: true,
  poweredByHeader: false,

  // WEBPACK OPTIMIZATIONS (Serverless-friendly)
  webpack: (config, { dev, isServer }) => {
    // FIX: Prevent infinite reload loop in dev mode
    if (dev && !isServer) {
      config.watchOptions = {
        ignored: /node_modules/,
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
      config.optimization.sideEffects = false
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
}

module.exports = nextConfig