import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown, Search, HelpCircle, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import Head from 'next/head'

export interface FAQItem {
  id: string
  question: string
  answer: string
  category?: string
}

export interface FAQSectionProps {
  title?: string
  subtitle?: string
  faqs?: FAQItem[]
  showSearch?: boolean
  groupByCategory?: boolean
  showContactCTA?: boolean
  className?: string
}

const defaultFaqs: FAQItem[] = [
  {
    id: '1',
    question: 'What is Servio?',
    answer: 'Servio is a restaurant operating system that unifies orders, menu updates, marketing, inventory, staff operations, and integrations in one dashboard—with an AI assistant for fast, hands-free execution.',
    category: 'General',
  },
  {
    id: '2',
    question: 'How does the voice assistant work?',
    answer: 'Our AI voice assistant understands natural language commands. Simply speak to update menus, check inventory, manage orders, and more—all hands-free while you focus on running your restaurant. The assistant learns your menu and operations to provide accurate, contextual responses.',
    category: 'Features',
  },
  {
    id: '3',
    question: 'What integrations does Servio support?',
    answer: 'Servio integrates with major POS systems (Toast, Square, Clover), delivery platforms (UberEats, DoorDash, Grubhub), payment processors (Stripe, Square), and accounting software (QuickBooks, Xero). We also offer an API for custom integrations.',
    category: 'Integrations',
  },
  {
    id: '4',
    question: 'Is there a free trial?',
    answer: 'Yes! We offer a 14-day free trial with full access to all features. No credit card required to start. You can explore all features and see how Servio fits your restaurant operations before committing.',
    category: 'Pricing',
  },
  {
    id: '5',
    question: 'How much does Servio cost?',
    answer: 'Servio offers flexible pricing starting at $49/month for single locations (Starter plan). Our Pro plan is $99/month for multi-location restaurants, and we offer custom Enterprise pricing for large restaurant groups. All plans include the voice assistant, order management, and basic analytics.',
    category: 'Pricing',
  },
  {
    id: '6',
    question: 'Can I use Servio on multiple devices?',
    answer: 'Absolutely! Servio works on any device with a web browser—tablets, phones, and computers. We also offer a Progressive Web App (PWA) for an app-like experience on mobile devices without needing to download anything from the app store.',
    category: 'Technical',
  },
  {
    id: '7',
    question: 'How does the AI phone answering work?',
    answer: 'Our AI voice agent answers calls within two rings, speaks naturally with customers, takes orders accurately, respects your business hours, syncs with your menu availability, and pushes orders directly into your POS and delivery platforms. You never miss a call or order.',
    category: 'Features',
  },
  {
    id: '8',
    question: 'Is my data secure?',
    answer: 'Yes, security is our top priority. We use bank-level encryption for all data, are SOC 2 Type II certified, and are fully GDPR compliant. Your data is stored securely in the cloud with automatic backups and strict access controls.',
    category: 'Security',
  },
  {
    id: '9',
    question: 'What kind of support do you offer?',
    answer: 'All plans include email and chat support. Pro plans get priority support with faster response times. Enterprise plans include a dedicated account manager, phone support, and custom training for your team. Our support team is available 24/7.',
    category: 'Support',
  },
  {
    id: '10',
    question: 'Can I cancel anytime?',
    answer: 'Yes, you can cancel your subscription at any time with no cancellation fees. Your access will continue until the end of your current billing period. We also offer a 30-day money-back guarantee if you\'re not satisfied.',
    category: 'Pricing',
  },
]

/**
 * FAQSection Component
 * 
 * Displays frequently asked questions with:
 * - Searchable interface
 * - Category grouping
 * - Accordion animations
 * - SEO-friendly JSON-LD schema
 * - Contact CTA
 * 
 * Best practices:
 * - Use real customer questions
 * - Keep answers concise but complete
 * - Include internal links where relevant
 * - Update regularly based on support tickets
 */
export function FAQSection({
  title = 'Frequently Asked Questions',
  subtitle = 'Everything you need to know about Servio',
  faqs = defaultFaqs,
  showSearch = true,
  groupByCategory = true,
  showContactCTA = true,
  className = '',
}: FAQSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [openItems, setOpenItems] = useState<string[]>([])
  const shouldReduceMotion = useReducedMotion()

  // Filter FAQs based on search
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs
    
    const query = searchQuery.toLowerCase()
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.category?.toLowerCase().includes(query)
    )
  }, [faqs, searchQuery])

  // Group FAQs by category
  const groupedFaqs = useMemo(() => {
    if (!groupByCategory) {
      return { 'All Questions': filteredFaqs }
    }

    return filteredFaqs.reduce((acc, faq) => {
      const category = faq.category || 'General'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(faq)
      return acc
    }, {} as Record<string, FAQItem[]>)
  }, [filteredFaqs, groupByCategory])

  const toggleItem = useCallback((id: string) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }, [])

  // Generate JSON-LD schema for SEO
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <>
      {/* JSON-LD Schema for SEO */}
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </Head>

      <section
        id="faq"
        className={`py-20 md:py-32 bg-gray-800/50 ${className}`}
        aria-labelledby="faq-heading"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/20 mb-6">
                <HelpCircle className="w-7 h-7 text-primary-400" />
              </div>
              <h2 id="faq-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4">
                {title}
              </h2>
              <p className="text-gray-400 text-lg">{subtitle}</p>
            </motion.div>
          </div>

          {/* Search */}
          {showSearch && (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-8"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  aria-label="Search frequently asked questions"
                />
              </div>
            </motion.div>
          )}

          {/* FAQ Categories */}
          <div className="space-y-8">
            {Object.entries(groupedFaqs).map(([category, categoryFaqs], categoryIndex) => (
              <motion.div
                key={category}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: categoryIndex * 0.1 }}
              >
                {groupByCategory && (
                  <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                    {category}
                  </h3>
                )}

                <div className="space-y-3">
                  {categoryFaqs.map((faq, faqIndex) => {
                    const isOpen = openItems.includes(faq.id)
                    
                    return (
                      <div
                        key={faq.id}
                        className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleItem(faq.id)}
                          className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
                          aria-expanded={isOpen}
                          aria-controls={`faq-answer-${faq.id}`}
                        >
                          <span className="font-medium text-white pr-4">
                            {faq.question}
                          </span>
                          <motion.span
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex-shrink-0"
                          >
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          </motion.span>
                        </button>
                        
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              id={`faq-answer-${faq.id}`}
                              initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-4 text-gray-300 leading-relaxed">
                                {faq.answer}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {/* No results */}
          {filteredFaqs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">No questions found matching your search.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-primary-400 hover:text-primary-300 font-medium"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Contact CTA */}
          {showContactCTA && (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 text-center"
            >
              <div className="bg-gradient-to-br from-primary-500/10 to-servio-purple-500/10 rounded-2xl p-8 border border-white/10">
                <MessageCircle className="w-10 h-10 text-primary-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Still have questions?
                </h3>
                <p className="text-gray-400 mb-6">
                  Can't find what you're looking for? Our team is here to help.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/book-demo"
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-primary-500/25"
                  >
                    Book a Demo
                  </Link>
                  <a
                    href="mailto:hello@servio.app"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors"
                  >
                    Contact Support
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </>
  )
}

export default FAQSection
