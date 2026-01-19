/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  trailingSlash: true,
  // Removed output: 'export' to enable proper API routing and SSR functionality
  images: {
    unoptimized: true,
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3002',
  },
  // Add performance optimizations (stable features only)
  // experimental: {
  //   optimizeCss: true, // Removed due to critters dependency issue
  // },
  // Enable compression
  compress: true,
  // Optimize build
  generateBuildId: async () => {
    return 'servio-build-' + Date.now()
  },
  // Add webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      }
    }
    
    // Add bundle analyzer in development
    if (dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': require('path').join(__dirname, '.'),
      }
    }
    
    return config
  },
  // Add headers for performance
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
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig