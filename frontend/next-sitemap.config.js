/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-web.onrender.com',
  generateRobotsTxt: true,
  changefreq: 'daily',
  priority: 0.7,
  sitemapSize: 5000,
  generateIndexSitemap: false,
  
  // Define pages that should be cached differently
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/'],
      },
    ],
  },

  // Custom transform for better SEO and caching
  transform: async (config, path) => {
    // Set cache headers based on path
    let changefreq = config.changefreq;
    let priority = config.priority;

    if (path === '/') {
      changefreq = 'daily';
      priority = 1.0;
    } else if (path.startsWith('/r/')) {
      changefreq = 'weekly';
      priority = 0.8;
    } else if (path.includes('dashboard') || path.includes('admin')) {
      return null; // Don't include in sitemap
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: new Date().toISOString(),
    };
  },
};