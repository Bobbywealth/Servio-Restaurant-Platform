// INTELLIGENT STATIC GENERATION AND ISR CONFIGURATION
import { GetStaticProps, GetStaticPaths, GetServerSideProps } from 'next';
import { ParsedUrlQuery } from 'querystring';

// ISR revalidation intervals for different content types
export const ISR_REVALIDATION = {
  // Static content (rarely changes)
  STATIC: 86400, // 24 hours
  
  // Semi-static content (changes occasionally)
  SEMI_STATIC: 3600, // 1 hour
  
  // Dynamic content (changes frequently but can be cached briefly)
  DYNAMIC: 300, // 5 minutes
  
  // Real-time content (should use SSR instead)
  REALTIME: 60, // 1 minute (fallback only)
} as const;

// Static props factory for common patterns
export function createStaticProps<P extends { [key: string]: any } = {}, Q extends ParsedUrlQuery = ParsedUrlQuery>(
  fetcher: (context: { params?: Q }) => Promise<P>,
  revalidate: number = ISR_REVALIDATION.DYNAMIC,
  options: {
    fallback?: boolean | 'blocking';
    notFound?: boolean;
  } = {}
): GetStaticProps<P, Q> {
  return async (context) => {
    try {
      const data = await fetcher(context);
      
      return {
        props: data,
        revalidate,
        notFound: options.notFound || false,
      };
    } catch (error) {
      console.error('Static props generation failed:', error);
      
      // Return notFound for 404 errors, fallback props for others
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return {
          notFound: true,
          revalidate: ISR_REVALIDATION.DYNAMIC,
        };
      }
      
      return {
        props: {} as P,
        revalidate: ISR_REVALIDATION.DYNAMIC,
      };
    }
  };
}

// Static paths factory with intelligent path generation
export function createStaticPaths<Q extends ParsedUrlQuery = ParsedUrlQuery>(
  pathsFetcher: () => Promise<Array<{ params: Q }>>,
  fallback: boolean | 'blocking' = 'blocking'
): GetStaticPaths<Q> {
  return async () => {
    try {
      const pathsData = await pathsFetcher();
      
      return {
        paths: pathsData,
        fallback,
      };
    } catch (error) {
      console.error('Static paths generation failed:', error);
      
      return {
        paths: [],
        fallback,
      };
    }
  };
}

// Server-side props with caching headers
export function createServerSideProps<P extends { [key: string]: any } = {}, Q extends ParsedUrlQuery = ParsedUrlQuery>(
  fetcher: (context: { 
    params?: Q; 
    req: any; 
    res: any; 
    query: ParsedUrlQuery;
  }) => Promise<P>,
  cacheMaxAge: number = 300 // 5 minutes default
): GetServerSideProps<P, Q> {
  return async (context) => {
    try {
      // Set cache headers for performance
      context.res.setHeader(
        'Cache-Control',
        `public, s-maxage=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`
      );
      
      const data = await fetcher(context);
      
      return {
        props: data,
      };
    } catch (error) {
      console.error('Server-side props generation failed:', error);
      
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return {
          notFound: true,
        };
      }
      
      return {
        props: {} as P,
      };
    }
  };
}

// Pre-built static props for common pages
export const CommonStaticProps = {
  // Public pages (high cache, rarely change)
  landingPage: createStaticProps(
    async () => ({
      timestamp: new Date().toISOString(),
    }),
    ISR_REVALIDATION.STATIC
  ),
  
  // Menu pages (medium cache, changes when menu updates)
  menuPage: createStaticProps(
    async ({ params }) => {
      // In real implementation, fetch menu data
      return {
        menu: [],
        restaurant: params?.slug || 'default',
        lastUpdated: new Date().toISOString(),
      };
    },
    ISR_REVALIDATION.SEMI_STATIC
  ),
  
  // Restaurant profile (medium cache)
  restaurantProfile: createStaticProps(
    async ({ params }) => {
      // In real implementation, fetch restaurant data
      return {
        restaurant: {
          id: params?.id,
          name: 'Sample Restaurant',
          description: 'A great restaurant',
        },
        lastUpdated: new Date().toISOString(),
      };
    },
    ISR_REVALIDATION.SEMI_STATIC
  ),
};

// Pre-built server-side props for dynamic pages
export const CommonServerSideProps = {
  // Dashboard pages (authenticated, personalized)
  dashboardPage: createServerSideProps(
    async ({ req, res }) => {
      // Check authentication
      const token = req.cookies?.token || req.headers?.authorization;
      
      if (!token) {
        return {
          redirect: {
            destination: '/login',
            permanent: false,
          },
        } as any;
      }
      
      return {
        user: { authenticated: true },
        serverTime: new Date().toISOString(),
      };
    },
    60 // Short cache for authenticated pages
  ),
  
  // Order details (frequent updates)
  orderPage: createServerSideProps(
    async ({ params }) => {
      // Fetch order data
      return {
        order: {
          id: params?.id,
          status: 'preparing',
          items: [],
        },
        lastUpdated: new Date().toISOString(),
      };
    },
    30 // Very short cache for order data
  ),
};

// Content-based cache invalidation helpers
export class CacheInvalidator {
  private static baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  // Revalidate specific paths
  static async revalidatePaths(paths: string[]): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Cache revalidation skipped in development');
      return;
    }
    
    try {
      const promises = paths.map(path => 
        fetch(`${this.baseUrl}/api/revalidate?path=${encodeURIComponent(path)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.REVALIDATION_TOKEN}`,
          },
        })
      );
      
      await Promise.all(promises);
      console.log('Successfully revalidated paths:', paths);
    } catch (error) {
      console.error('Failed to revalidate paths:', error);
    }
  }
  
  // Revalidate restaurant-related pages
  static async revalidateRestaurant(restaurantId: string): Promise<void> {
    const paths = [
      `/r/${restaurantId}`,
      `/r/${restaurantId}/menu`,
      `/admin/restaurants/${restaurantId}`,
    ];
    
    await this.revalidatePaths(paths);
  }
  
  // Revalidate menu-related pages
  static async revalidateMenu(restaurantId: string): Promise<void> {
    const paths = [
      `/r/${restaurantId}`,
      `/r/${restaurantId}/menu`,
    ];
    
    await this.revalidatePaths(paths);
  }
  
  // Revalidate order-related pages
  static async revalidateOrders(): Promise<void> {
    const paths = [
      '/dashboard',
      '/dashboard/orders',
      '/tablet/orders',
    ];
    
    await this.revalidatePaths(paths);
  }
}

// Edge function helpers for ultra-fast responses
export const EdgeHelpers = {
  // Generate edge-compatible response with caching
  createCachedResponse: (
    data: any, 
    maxAge: number = 300,
    staleWhileRevalidate: number = 600
  ) => {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
        'CDN-Cache-Control': `max-age=${maxAge * 4}`, // Longer CDN cache
      },
    });
  },
  
  // Create geo-aware response
  createGeoResponse: (data: any, country?: string, region?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    };
    
    if (country) headers['X-Country'] = country;
    if (region) headers['X-Region'] = region;
    
    return new Response(JSON.stringify({
      ...data,
      geo: { country, region },
    }), {
      status: 200,
      headers,
    });
  },
};

// Static optimization recommendations
export const OptimizationRecommendations = {
  // Pages that should use ISR
  ISR_CANDIDATES: [
    '/r/[slug]', // Restaurant public pages
    '/r/[slug]/menu', // Menu pages
    '/book-demo', // Demo booking page
    '/', // Landing page
  ],
  
  // Pages that should use SSR
  SSR_CANDIDATES: [
    '/dashboard/**', // All dashboard pages (authenticated)
    '/admin/**', // All admin pages (authenticated)
    '/tablet/**', // All tablet pages (real-time data)
  ],
  
  // Pages that should be fully static
  STATIC_CANDIDATES: [
    '/offline', // Offline page
    '/404', // Error pages
    '/500', // Error pages
  ],
  
  // API routes that should be edge functions
  EDGE_CANDIDATES: [
    '/api/public/**', // Public API endpoints
    '/api/menu/**', // Menu API (cacheable)
    '/api/restaurant/*/profile', // Restaurant profiles (cacheable)
  ],
};

export default {
  ISR_REVALIDATION,
  createStaticProps,
  createStaticPaths,
  createServerSideProps,
  CommonStaticProps,
  CommonServerSideProps,
  CacheInvalidator,
  EdgeHelpers,
  OptimizationRecommendations,
};