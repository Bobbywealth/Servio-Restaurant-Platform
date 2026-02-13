import React from 'react'
import Head from 'next/head'

export interface BaseSchemaProps {
  '@context'?: string
}

export interface LocalBusinessSchema extends BaseSchemaProps {
  name: string
  description?: string
  url?: string
  logo?: string
  image?: string
  telephone?: string
  email?: string
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
  sameAs?: string[]
}

export interface RestaurantSchema extends LocalBusinessSchema {
  servesCuisine?: string[]
  menu?: string
  acceptsReservations?: boolean
  aggregateRating?: {
    ratingValue: number
    reviewCount: number
  }
}

export interface FAQPageSchema extends BaseSchemaProps {
  questions: Array<{
    question: string
    answer: string
  }>
}

export interface ProductSchema extends BaseSchemaProps {
  name: string
  description: string
  image?: string
  brand?: string
  offers?: {
    price: number
    priceCurrency: string
    availability: 'InStock' | 'OutOfStock' | 'PreOrder'
    url?: string
  }
  aggregateRating?: {
    ratingValue: number
    reviewCount: number
  }
}

export interface BreadcrumbSchema extends BaseSchemaProps {
  items: Array<{
    name: string
    url: string
  }>
}

export interface StructuredDataProps {
  type: 'localBusiness' | 'restaurant' | 'faq' | 'product' | 'breadcrumb'
  data: LocalBusinessSchema | RestaurantSchema | FAQPageSchema | ProductSchema | BreadcrumbSchema
}

/**
 * StructuredData Component
 * 
 * Renders JSON-LD structured data for SEO
 * Supports multiple schema types for rich snippets
 */
export function StructuredData({ type, data }: StructuredDataProps) {
  const generateSchema = () => {
    const baseContext = 'https://schema.org'

    switch (type) {
      case 'localBusiness': {
        const businessData = data as LocalBusinessSchema
        return {
          '@context': baseContext,
          '@type': 'LocalBusiness',
          name: businessData.name,
          ...(businessData.description && { description: businessData.description }),
          ...(businessData.url && { url: businessData.url }),
          ...(businessData.logo && { logo: businessData.logo }),
          ...(businessData.image && { image: businessData.image }),
          ...(businessData.telephone && { telephone: businessData.telephone }),
          ...(businessData.email && { email: businessData.email }),
          ...(businessData.address && {
            address: {
              '@type': 'PostalAddress',
              streetAddress: businessData.address.streetAddress,
              addressLocality: businessData.address.addressLocality,
              addressRegion: businessData.address.addressRegion,
              postalCode: businessData.address.postalCode,
              addressCountry: businessData.address.addressCountry,
            },
          }),
          ...(businessData.geo && {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: businessData.geo.latitude,
              longitude: businessData.geo.longitude,
            },
          }),
          ...(businessData.openingHours && { openingHours: businessData.openingHours }),
          ...(businessData.priceRange && { priceRange: businessData.priceRange }),
          ...(businessData.sameAs && { sameAs: businessData.sameAs }),
        }
      }

      case 'restaurant': {
        const restaurantData = data as RestaurantSchema
        return {
          '@context': baseContext,
          '@type': 'Restaurant',
          name: restaurantData.name,
          ...(restaurantData.description && { description: restaurantData.description }),
          ...(restaurantData.url && { url: restaurantData.url }),
          ...(restaurantData.logo && { logo: restaurantData.logo }),
          ...(restaurantData.image && { image: restaurantData.image }),
          ...(restaurantData.telephone && { telephone: restaurantData.telephone }),
          ...(restaurantData.email && { email: restaurantData.email }),
          ...(restaurantData.address && {
            address: {
              '@type': 'PostalAddress',
              streetAddress: restaurantData.address.streetAddress,
              addressLocality: restaurantData.address.addressLocality,
              addressRegion: restaurantData.address.addressRegion,
              postalCode: restaurantData.address.postalCode,
              addressCountry: restaurantData.address.addressCountry,
            },
          }),
          ...(restaurantData.geo && {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: restaurantData.geo.latitude,
              longitude: restaurantData.geo.longitude,
            },
          }),
          ...(restaurantData.openingHours && { openingHours: restaurantData.openingHours }),
          ...(restaurantData.priceRange && { priceRange: restaurantData.priceRange }),
          ...(restaurantData.servesCuisine && { servesCuisine: restaurantData.servesCuisine }),
          ...(restaurantData.menu && { menu: restaurantData.menu }),
          ...(restaurantData.acceptsReservations !== undefined && {
            acceptsReservations: restaurantData.acceptsReservations,
          }),
          ...(restaurantData.aggregateRating && {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: restaurantData.aggregateRating.ratingValue,
              reviewCount: restaurantData.aggregateRating.reviewCount,
            },
          }),
          ...(restaurantData.sameAs && { sameAs: restaurantData.sameAs }),
        }
      }

      case 'faq': {
        const faqData = data as FAQPageSchema
        return {
          '@context': baseContext,
          '@type': 'FAQPage',
          mainEntity: faqData.questions.map((q) => ({
            '@type': 'Question',
            name: q.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: q.answer,
            },
          })),
        }
      }

      case 'product': {
        const productData = data as ProductSchema
        return {
          '@context': baseContext,
          '@type': 'Product',
          name: productData.name,
          description: productData.description,
          ...(productData.image && { image: productData.image }),
          ...(productData.brand && { brand: { '@type': 'Brand', name: productData.brand } }),
          ...(productData.offers && {
            offers: {
              '@type': 'Offer',
              price: productData.offers.price,
              priceCurrency: productData.offers.priceCurrency,
              availability: `https://schema.org/${productData.offers.availability}`,
              ...(productData.offers.url && { url: productData.offers.url }),
            },
          }),
          ...(productData.aggregateRating && {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: productData.aggregateRating.ratingValue,
              reviewCount: productData.aggregateRating.reviewCount,
            },
          }),
        }
      }

      case 'breadcrumb': {
        const breadcrumbData = data as BreadcrumbSchema
        return {
          '@context': baseContext,
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbData.items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
          })),
        }
      }

      default:
        return null
    }
  }

  const schema = generateSchema()

  if (!schema) return null

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </Head>
  )
}

export { StructuredData as default }
