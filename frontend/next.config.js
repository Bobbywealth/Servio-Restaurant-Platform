/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  trailingSlash: true,
  // Note: Disabled static export to support dynamic restaurant pages with getServerSideProps
  // output: 'export', // Enable static export for Netlify deployment

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
    turbotrace: {},
    scrollRestoration: true,
  },

  // AGGRESSIVE COMPRESSION
  compress: true,
  poweredByHeader: false,

  // OPTIMIZED BUILD ID
  generateBuildId: async () => {
    return 'servio-' + process.env.NODE_ENV + '-' + Date.now()
  },

  // AGGRESSIVE WEBPACK OPTIMIZATIONS
  webpack: (config, { dev, isServer }) => {
    // PRODUCTION OPTIMIZATIONS
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        sideEffects: false,
        usedExports: true,
        concatenateModules: true,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          minRemainingSize: 0,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          enforceSizeThreshold: 50000,
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all',
              enforce: true,
            },
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 20,
            },
            ui: {
              test: /[\\/]node_modules[\\/](framer-motion|lucide-react)[\\/]/,
              name: 'ui-libs',
              chunks: 'all',
              priority: 15,
            },
            commons: {
              name: 'commons',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
            },
          },
        },
      }

      // AGGRESSIVE MODULE FEDERATION & TREE SHAKING
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