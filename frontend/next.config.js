/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  trailingSlash: false,
  // Temporarily disable static export to support dynamic restaurant pages
  // output: 'export', // Enable static export for static site deployment

  // AGGRESSIVE IMAGE OPTIMIZATION
  images: {
    unoptimized: true,
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year cache
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3002',
  },

  // EXPERIMENTAL PERFORMANCE FEATURES
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
    scrollRestoration: true,
  },

  // AGGRESSIVE COMPRESSION
  compress: true,
  poweredByHeader: false,

  // OPTIMIZED BUILD ID
  generateBuildId: async () => {
    return 'servio-' + process.env.NODE_ENV + '-' + Date.now()
  },

  // WEBPACK OPTIMIZATIONS (Serverless-friendly)
  webpack: (config, { dev, isServer }) => {
    // PRODUCTION OPTIMIZATIONS
    if (!dev) {
      // Keep default Next.js optimization but ensure dependencies are properly resolved
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': require('path').join(__dirname, '.'),
      }
    }

    // PERFORMANCE OPTIMIZATIONS FOR ALL BUILDS
    config.resolve.extensions = ['.tsx', '.ts', '.js', '.jsx', '.json']

    // OPTIMIZE BUNDLE SIZE
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
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