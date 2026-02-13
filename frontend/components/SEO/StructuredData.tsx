/**
 * Structured Data Components for SEO
 * Implements JSON-LD schema markup for rich snippets
 * 
 * @see https://developers.google.com/search/docs/advanced/structured-data/intro-structured-data
 */

import Head from 'next/head'

// ============================================================================
// Type Definitions
// ============================================================================

interface LocalBusinessSchema {
  name: string
  description: string
  url: string
  logo: string
  telephone?: string
  address?: {
    streetAddress: string
    addressLocality: string
    addressRegion: string
    postalCode: string
    addressCountry: string
  }
  geo?: {
    latitude: number
    longitude: number
  }
  openingHours?: string[]
  priceRange?: string
  aggregateRating?: {
    ratingValue: string
    reviewCount: string
  }
  sameAs?: string[]
}

interface SoftwareApplicationSchema {
  name: string
  description: string
  applicationCategory: string
  operatingSystem: string
  offers: {
    price: string
    priceCurrency: string
  }
  aggregateRating?: {
    ratingValue: string
    reviewCount: string
  }
}

interface FAQItem {
  question: string
  answer: string
}

interface BreadcrumbItem {
  name: string
  url: string
}

// ============================================================================
// Organization Schema
// ============================================================================

interface OrganizationSchemaProps {
  name?: string
  url?: string
  logo?: string
  sameAs?: string[]
}

export function OrganizationSchema({
  name = 'Servio',
  url = 'https://servio.com',
  logo = 'https://servio.com/images/servio_icon_tight.png',
  sameAs = [
    'https://twitter.com/servio',
    'https://linkedin.com/company/servio',
    'https://facebook.com/servio'
  ]
}: OrganizationSchemaProps = {}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    logo,
    sameAs,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-888-SERVIO',
      contactType: 'sales',
      availableLanguage: ['English']
    }
  }

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  )
}

// ============================================================================
// Software Application Schema
// ============================================================================

interface SoftwareSchemaProps {
  name?: string
  description?: string
  price?: string
  currency?: string
  ratingValue?: string
  reviewCount?: string
}

export function SoftwareSchema({
  name = 'Servio',
  description = 'Restaurant Operating System with AI Assistant - Unify orders, menu updates, marketing, inventory, staff operations, and integrations in one dashboard.',
  price = '49.00',
  currency = 'USD',
  ratingValue = '4.9',
  reviewCount = '150'
}: SoftwareSchemaProps = {}) {
  const schema: SoftwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      price,
      priceCurrency: currency
    },
    aggregateRating: {
      ratingValue,
      reviewCount
    }
  }

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  )
}

// ============================================================================
// Local Business / Restaurant Schema
// ============================================================================

interface RestaurantSchemaProps {
  name?: string
  description?: string
  url?: string
  logo?: string
  priceRange?: string
}

export function RestaurantSchema({
  name = 'Servio',
  description = 'Restaurant Operating System with AI Assistant',
  url = 'https://servio.com',
  logo = 'https://servio.com/images/servio_icon_tight.png',
  priceRange = '$$'
}: RestaurantSchemaProps = {}) {
  const schema: LocalBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name,
    description,
    url,
    logo,
    priceRange,
    aggregateRating: {
      ratingValue: '4.9',
      reviewCount: '150'
    }
  }

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  )
}

// ============================================================================
// FAQ Schema
// ============================================================================

interface FAQSchemaProps {
  items: FAQItem[]
}

export function FAQSchema({ items }: FAQSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  }

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  )
}

// ============================================================================
// Breadcrumb Schema
// ============================================================================

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[]
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  )
}

// ============================================================================
// Product Schema (for pricing plans)
// ============================================================================

interface ProductSchemaProps {
  name: string
  description: string
  price: string
  currency?: string
  priceValidUntil?: string
}

export function ProductSchema({
  name,
  description,
  price,
  currency = 'USD',
  priceValidUntil
}: ProductSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      priceValidUntil: priceValidUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '150'
    }
  }

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  )
}

// ============================================================================
// WebSite Schema (for sitelinks search box)
// ============================================================================

interface WebSiteSchemaProps {
  name?: string
  url?: string
  potentialAction?: {
    target: string
    queryInput: string
  }
}

export function WebSiteSchema({
  name = 'Servio',
  url = 'https://servio.com',
  potentialAction = {
    target: 'https://servio.com/search?q={search_term_string}',
    queryInput: 'required name=search_term_string'
  }
}: WebSiteSchemaProps = {}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: potentialAction.target,
      'query-input': potentialAction.queryInput
    }
  }

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  )
}

// ============================================================================
// Combined Schema for Homepage
// ============================================================================

export function HomepageSchemas() {
  return (
    <>
      <OrganizationSchema />
      <WebSiteSchema />
      <SoftwareSchema />
    </>
  )
}

// ============================================================================
// Export all schemas
// ============================================================================

export default {
  OrganizationSchema,
  SoftwareSchema,
  RestaurantSchema,
  FAQSchema,
  BreadcrumbSchema,
  ProductSchema,
  WebSiteSchema,
  HomepageSchemas
}
