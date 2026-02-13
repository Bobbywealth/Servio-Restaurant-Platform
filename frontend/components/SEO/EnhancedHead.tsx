import React from 'react'
import Head from 'next/head'
import { StructuredData, RestaurantSchema, FAQPageSchema, BreadcrumbSchema } from './StructuredData'

export interface EnhancedSEOProps {
  title: string
  description: string
  keywords?: string[]
  canonicalUrl?: string
  ogImage?: string
  ogType?: 'website' | 'article' | 'product'
  twitterCard?: 'summary' | 'summary_large_image'
  noIndex?: boolean
  noFollow?: boolean
  author?: string
  publishedTime?: string
  modifiedTime?: string
  section?: string
  tags?: string[]
}

/**
 * EnhancedSEO Component
 * 
 * Provides comprehensive SEO meta tags including:
 * - Basic meta tags (title, description, keywords)
 * - Open Graph tags for social sharing
 * - Twitter Card tags
 * - Canonical URL
 * - Robots directives
 * - Article-specific metadata
 */
export function EnhancedSEO({
  title,
  description,
  keywords = [],
  canonicalUrl,
  ogImage = '/images/og-default.png',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  noIndex = false,
  noFollow = false,
  author,
  publishedTime,
  modifiedTime,
  section,
  tags = [],
}: EnhancedSEOProps) {
  const siteName = 'Servio'
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://servio.app'
  const fullTitle = `${title} | ${siteName}`
  const fullCanonicalUrl = canonicalUrl ? `${baseUrl}${canonicalUrl}` : undefined
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`

  const robotsContent = [
    noIndex ? 'noindex' : 'index',
    noFollow ? 'nofollow' : 'follow',
    'max-snippet:-1',
    'max-image-preview:large',
    'max-video-preview:-1',
  ].join(', ')

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(', ')} />
      )}
      {author && <meta name="author" content={author} />}
      <meta name="robots" content={robotsContent} />
      
      {/* Canonical URL */}
      {fullCanonicalUrl && <link rel="canonical" href={fullCanonicalUrl} />}
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      {fullCanonicalUrl && <meta property="og:url" content={fullCanonicalUrl} />}
      
      {/* Article-specific OG tags */}
      {ogType === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {ogType === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {ogType === 'article' && section && (
        <meta property="article:section" content={section} />
      )}
      {ogType === 'article' && tags.length > 0 && (
        tags.map((tag, index) => (
          <meta key={index} property="article:tag" content={tag} />
        ))
      )}
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
      <meta name="twitter:site" content="@servioapp" />
      <meta name="twitter:creator" content="@servioapp" />
      
      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#6366f1" />
      <meta name="msapplication-TileColor" content="#6366f1" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={siteName} />
      
      {/* Preconnect to external domains */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      
      {/* DNS Prefetch */}
      <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      <link rel="dns-prefetch" href="https://www.google-analytics.com" />
    </Head>
  )
}

/**
 * HomepageSchemas Component
 * 
 * Renders all relevant JSON-LD structured data schemas for the homepage
 */
export function HomepageSchemas() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://servio.app'

  const restaurantSchema: RestaurantSchema = {
    name: 'Servio',
    description: 'The premium, voice-first platform for restaurant teams. Servio unifies orders, inventory, staff operations, and communications into a single, beautiful app-like system.',
    url: baseUrl,
    logo: `${baseUrl}/images/servio_icon_tight.png`,
    image: `${baseUrl}/images/og-default.png`,
    telephone: '+1-555-123-4567',
    email: 'hello@servio.app',
    address: {
      streetAddress: '123 Restaurant Way',
      addressLocality: 'San Francisco',
      addressRegion: 'CA',
      postalCode: '94102',
      addressCountry: 'US',
    },
    geo: {
      latitude: 37.7749,
      longitude: -122.4194,
    },
    openingHours: ['Mo-Fr 09:00-18:00'],
    priceRange: '$$',
    servesCuisine: ['Software', 'Restaurant Technology'],
    aggregateRating: {
      ratingValue: 4.9,
      reviewCount: 200,
    },
    sameAs: [
      'https://twitter.com/servioapp',
      'https://linkedin.com/company/servio',
      'https://facebook.com/servioapp',
    ],
  }

  const breadcrumbSchema: BreadcrumbSchema = {
    items: [
      { name: 'Home', url: baseUrl },
    ],
  }

  const faqSchema: FAQPageSchema = {
    questions: [
      {
        question: 'What is Servio?',
        answer: 'Servio is a restaurant operating system that unifies orders, menu updates, marketing, inventory, staff operations, and integrations in one dashboard—with an AI assistant for fast, hands-free execution.',
      },
      {
        question: 'How does the voice assistant work?',
        answer: 'Our AI voice assistant understands natural language commands. Simply speak to update menus, check inventory, manage orders, and more—all hands-free while you focus on running your restaurant.',
      },
      {
        question: 'What integrations does Servio support?',
        answer: 'Servio integrates with major POS systems, delivery platforms (UberEats, DoorDash, Grubhub), payment processors, and accounting software. We also offer an API for custom integrations.',
      },
      {
        question: 'Is there a free trial?',
        answer: 'Yes! We offer a 14-day free trial with full access to all features. No credit card required to start.',
      },
      {
        question: 'How much does Servio cost?',
        answer: 'Servio offers flexible pricing starting at $49/month for single locations. We also have Pro and Enterprise plans for growing restaurants and chains. Contact us for custom pricing.',
      },
    ],
  }

  return (
    <>
      <StructuredData type="restaurant" data={restaurantSchema} />
      <StructuredData type="breadcrumb" data={breadcrumbSchema} />
      <StructuredData type="faq" data={faqSchema} />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Servio',
              url: baseUrl,
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${baseUrl}/search?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </Head>
    </>
  )
}

export default EnhancedSEO
