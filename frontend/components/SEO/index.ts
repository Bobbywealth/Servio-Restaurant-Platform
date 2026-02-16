/**
 * SEO Components
 * 
 * Components for search engine optimization including:
 * - JSON-LD structured data schemas
 * - Enhanced meta tags
 * - Open Graph and Twitter Card support
 */

export { StructuredData } from './StructuredData'
export { EnhancedSEO, HomepageSchemas } from './EnhancedHead'

// Type exports
export type { LocalBusinessSchema, RestaurantSchema, FAQPageSchema, ProductSchema, BreadcrumbSchema } from './StructuredData'
export type { StructuredDataProps, BaseSchemaProps } from './StructuredData'
export type { EnhancedSEOProps } from './EnhancedHead'
