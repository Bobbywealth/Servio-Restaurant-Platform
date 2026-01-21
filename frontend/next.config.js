/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  
  // PRODUCTION IMAGE OPTIMIZATION
  images: {
    unoptimized: false, // Enable optimization in production
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.render.com',
      },
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
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || process.env.BACKEND_URL || 'http://localhost:3002',
    NEXT_PUBLIC_ASSISTANT_ENABLED: process.env.NEXT_PUBLIC_ASSISTANT_ENABLED || 'true',
    NEXT_PUBLIC_WAKE_WORD_ENABLED: process.env.NEXT_PUBLIC_WAKE_WORD_ENABLED || 'false',
    NEXT_PUBLIC_TTS_ENABLED: process.env.NEXT_PUBLIC_TTS_ENABLED || 'true'
  },

  // External packages configuration
  serverExternalPackages: ['sharp'],
  
  // EXPERIMENTAL FEATURES FOR PRODUCTION
  experimental: {
    scrollRestoration: true,
    optimizeCss: true,
  },

  // PREVENT WATCH LOOPS IN DEV
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // period (in ms) where the server will keep pages in the buffer
    pagesBufferLength: 5, // number of pages that should be kept in memory
  },

  // PRODUCTION HEADERS AND SECURITY
  compress: true,
  poweredByHeader: false,
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self), camera=(self)',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*\.(png|jpg|jpeg|gif|webp|avif|ico|svg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=31536000',
          },
        ],
      },
    ];
  },

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
      
      // Advanced tree shaking and optimizations
      config.optimization.usedExports = true
      config.optimization.sideEffects = false
      config.optimization.providedExports = true
      config.optimization.innerGraph = true
      config.optimization.mangleExports = true
      
      // Split chunks optimization
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            enforce: true,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      }
      
      // Minimize bundles
      config.optimization.minimize = true
      
      // Bundle analyzer in production analysis mode (optional dependency)
      if (process.env.ANALYZE === 'true') {
        try {
          const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
          config.plugins.push(
            new BundleAnalyzerPlugin({
              analyzerMode: 'static',
              openAnalyzer: false,
              reportFilename: 'bundle-report.html',
            })
          );
        } catch (e) {
          console.warn('webpack-bundle-analyzer not installed. Skipping bundle analysis.');
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
}

module.exports = nextConfig