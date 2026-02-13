/**
 * Enhanced SEO Head Component
 * Comprehensive meta tags for SEO, Open Graph, and Twitter Cards
 * 
 * @see https://developers.google.com/search/docs/advanced/appearance/good-titles-snippets
 * @see https://ogp.me/
 */

import Head from 'next/head'
import { useRouter } from 'next/router'

// ============================================================================
// Type Definitions
// ============================================================================

interface SEOProps {
  /** Page title (50-60 characters recommended) */
  title?: string
  /** Page description (150-160 characters recommended) */
  description?: string
  /** Canonical URL override */
  canonicalUrl?: string
  /** OG image URL (1200x630 recommended) */
  image?: string
  /** Page type for OG */
  type?: 'website' | 'article' | 'product' | 'profile'
  /** Article published time (for articles) */
  publishedTime?: string
  /** Article modified time (for articles) */
  modifiedTime?: string
  /** Author name */
  author?: string
  /** Keywords (less important but still useful) */
  keywords?: string[]
  /** Noindex flag */
  noindex?: boolean
  /** No follow flag */
  nofollow?: boolean
  /** Site name override */
  siteName?: string
  /** Twitter card type */
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player'
  /** Locale override */
  locale?: string
  /** Alternate locales */
  alternateLocales?: string[]
  /** Site theme color */
  themeColor?: string
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULTS = {
  siteName: 'Servio',
  siteUrl: 'https://servio.com',
  defaultTitle: 'Servio - Restaurant Operating System | Voice-First Operations',
  defaultDescription: 'Servio is a restaurant operating system that unifies orders, menu updates, marketing, inventory + receipts, staff operations, and integrations in one dashboard—with an AI assistant for fast, hands-free execution.',
  defaultImage: '/images/servio_logo_transparent_tight.png',
  twitterSite: '@servio',
  themeColor: '#14b8a6',
  locale: 'en_US'
}

// ============================================================================
// Main SEO Component
// ============================================================================

export function EnhancedSEO({
  title,
  description = DEFAULTS.defaultDescription,
  canonicalUrl,
  image,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  keywords,
  noindex = false,
  nofollow = false,
  siteName = DEFAULTS.siteName,
  twitterCard = 'summary_large_image',
  locale = DEFAULTS.locale,
  alternateLocales = [],
  themeColor = DEFAULTS.themeColor
}: SEOProps = {}) {
  const router = useRouter()
  
  // Construct full URLs
  const pageUrl = canonicalUrl || `${DEFAULTS.siteUrl}${router.asPath}`
  const imageUrl = image?.startsWith('http') ? image : `${DEFAULTS.siteUrl}${image || DEFAULTS.defaultImage}`
  
  // Construct title with site name
  const fullTitle = title 
    ? `${title} | ${siteName}`
    : DEFAULTS.defaultTitle
  
  // Construct robots directive
  const robotsContent = [
    noindex ? 'noindex' : 'index',
    nofollow ? 'nofollow' : 'follow',
    'max-snippet:-1',
    'max-image-preview:large',
    'max-video-preview:-1'
  ].join(', ')
  
  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(', ')} />
      )}
      {author && <meta name="author" content={author} />}
      
      {/* Robots */}
      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={robotsContent} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={pageUrl} />
      
      {/* Theme Color */}
      <meta name="theme-color" content={themeColor} />
      <meta name="msapplication-TileColor" content={themeColor} />
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />
      
      {/* Article specific OG tags */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      
      {/* Alternate locales */}
      {alternateLocales.map(locale => (
        <link 
          key={locale}
          rel="alternate" 
          hrefLang={locale} 
          href={`${DEFAULTS.siteUrl}${router.pathname}`}
        />
      ))}
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={DEFAULTS.twitterSite} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      
      {/* Additional SEO Tags */}
      <meta name="format-detection" content="telephone=no" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={siteName} />
      
      {/* Geo Tags (for local SEO) */}
      <meta name="geo.region" content="US" />
      <meta name="geo.placename" content="United States" />
    </Head>
  )
}

// ============================================================================
// Specialized SEO Components
// ============================================================================

interface ArticleSEOProps extends SEOProps {
  publishedTime: string
  modifiedTime?: string
  author: string
  section?: string
  tags?: string[]
}

export function ArticleSEO({
  section,
  tags = [],
  ...props
}: ArticleSEOProps) {
  return (
    <>
      <EnhancedSEO type="article" {...props} />
      {section && (
        <Head>
          <meta property="article:section" content={section} />
        </Head>
      )}
      {tags.map(tag => (
        <Head key={tag}>
          <meta property="article:tag" content={tag} />
        </Head>
      ))}
    </>
  )
}

interface ProductSEOProps extends SEOProps {
  price: string
  currency: string
  availability: 'in_stock' | 'out_of_stock' | 'preorder'
  brand?: string
  sku?: string
}

export function ProductSEO({
  price,
  currency,
  availability,
  brand,
  sku,
  ...props
}: ProductSEOProps) {
  return (
    <>
      <EnhancedSEO type="product" {...props} />
      <Head>
        <meta property="product:price:amount" content={price} />
        <meta property="product:price:currency" content={currency} />
        <meta property="product:availability" content={availability} />
        {brand && <meta property="product:brand" content={brand} />}
        {sku && <meta property="product:retailer_item_id" content={sku} />}
      </Head>
    </>
  )
}

// ============================================================================
// Homepage SEO
// ============================================================================

export function HomepageSEO() {
  return (
    <EnhancedSEO
      title="Restaurant Operating System | Voice-First Operations"
      description="Servio is a restaurant operating system that unifies orders, menu updates, marketing, inventory, staff operations, and integrations in one dashboard—with an AI assistant for fast, hands-free execution."
      keywords={[
        'restaurant management software',
        'restaurant POS',
        'voice assistant for restaurants',
        'restaurant operations',
        'AI restaurant assistant',
        'restaurant inventory management',
        'staff scheduling software',
        'restaurant marketing'
      ]}
    />
  )
}

// ============================================================================
// Dashboard Page SEO
// ============================================================================

interface DashboardSEOProps {
  title: string
  description?: string
}

export function DashboardSEO({ title, description }: DashboardSEOProps) {
  return (
    <EnhancedSEO
      title={title}
      description={description || `Manage ${title.toLowerCase()} with Servio's restaurant operating system.`}
      noindex={true}
      nofollow={true}
    />
  )
}

// ============================================================================
// Export
// ============================================================================

export default EnhancedSEO
