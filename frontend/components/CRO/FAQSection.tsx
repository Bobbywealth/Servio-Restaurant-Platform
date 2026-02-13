/**
 * FAQ Section Component with Schema Markup
 * Provides an accessible FAQ section with structured data for SEO
 * 
 * FAQ schema can increase CTR by 30% through rich snippets
 */

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle, Search, MessageCircle } from 'lucide-react'
import { FAQSchema } from '../SEO/StructuredData'

// ============================================================================
// Types
// ============================================================================

interface FAQItem {
  id: string
  question: string
  answer: string
  category?: string
}

interface FAQSectionProps {
  /** FAQ items to display */
  items?: FAQItem[]
  /** Show search bar */
  showSearch?: boolean
  /** Group by category */
  groupByCategory?: boolean
  /** Show contact CTA */
  showContactCTA?: boolean
  /** Allow multiple open */
  allowMultipleOpen?: boolean
  /** Additional className */
  className?: string
}

// ============================================================================
// Default FAQ Items
// ============================================================================

const DEFAULT_FAQ_ITEMS: FAQItem[] = [
  {
    id: '1',
    question: 'What is Servio?',
    answer: 'Servio is a comprehensive restaurant operating system that unifies orders, menu management, marketing, inventory, staff operations, and integrations in one dashboard. It features an AI assistant for fast, hands-free execution of daily tasks.',
    category: 'General'
  },
  {
    id: '2',
    question: 'How does the AI voice assistant work?',
    answer: 'Our AI voice assistant uses natural language processing to understand and execute commands. Simply speak to add orders, update menu items, check inventory levels, or generate reports. It works 24/7 and can handle multiple requests simultaneously.',
    category: 'Features'
  },
  {
    id: '3',
    question: 'Can I try Servio before committing?',
    answer: 'Yes! We offer a free 14-day trial with full access to all features. No credit card required. You can also book a personalized demo with our team to see how Servio can work for your restaurant.',
    category: 'Pricing'
  },
  {
    id: '4',
    question: 'What integrations does Servio support?',
    answer: 'Servio integrates with popular POS systems (Toast, Square, Clover), payment processors (Stripe, PayPal), delivery platforms (DoorDash, UberEats, Grubhub), accounting software (QuickBooks, Xero), and many more. We also offer an API for custom integrations.',
    category: 'Integrations'
  },
  {
    id: '5',
    question: 'Is my data secure with Servio?',
    answer: 'Absolutely. We use bank-level encryption (AES-256) for all data, are SOC 2 Type II compliant, and never share your data with third parties. We also offer two-factor authentication and role-based access controls.',
    category: 'Security'
  },
  {
    id: '6',
    question: 'How long does implementation take?',
    answer: 'Most restaurants are up and running within 24-48 hours. Our team handles data migration, menu setup, and staff training. For larger operations with custom integrations, implementation typically takes 1-2 weeks.',
    category: 'Getting Started'
  },
  {
    id: '7',
    question: 'What kind of support do you offer?',
    answer: 'We provide 24/7 support via chat, email, and phone for all plans. Pro and Enterprise customers get a dedicated account manager and priority support. We also have an extensive knowledge base and video tutorials.',
    category: 'Support'
  },
  {
    id: '8',
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time with no cancellation fees. Your data will be available for export for 30 days after cancellation. We also offer a 30-day money-back guarantee for new customers.',
    category: 'Pricing'
  },
  {
    id: '9',
    question: 'Does Servio work on mobile devices?',
    answer: 'Yes! Servio is fully responsive and works on any device with a web browser. We also offer native iOS and Android apps for staff time clock, order management, and real-time notifications.',
    category: 'Features'
  },
  {
    id: '10',
    question: 'How does pricing work?',
    answer: 'We offer three plans: Starter ($49/month for single location), Pro ($99/month for up to 3 locations), and Enterprise (custom pricing for unlimited locations). All plans include core features, with advanced analytics and integrations available on higher tiers.',
    category: 'Pricing'
  }
]

// ============================================================================
// FAQ Accordion Item Component
// ============================================================================

interface FAQAccordionItemProps {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}

function FAQAccordionItem({ item, isOpen, onToggle }: FAQAccordionItemProps) {
  return (
    <div className="border-b border-gray-800 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-lg px-2 -mx-2"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
      >
        <span className="font-medium text-white pr-4">
          {item.question}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-primary-500"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.span>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              id={`faq-answer-${item.id}`}
              className="pb-5 text-gray-400 leading-relaxed"
            >
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Main FAQ Section Component
// ============================================================================

export function FAQSection({
  items = DEFAULT_FAQ_ITEMS,
  showSearch = true,
  groupByCategory = false,
  showContactCTA = true,
  allowMultipleOpen = false,
  className = ''
}: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Toggle item
  const handleToggle = useCallback((itemId: string) => {
    setOpenItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        if (!allowMultipleOpen) {
          newSet.clear()
        }
        newSet.add(itemId)
      }
      return newSet
    })
  }, [allowMultipleOpen])

  // Filter items by search
  const filteredItems = items.filter(item =>
    item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group items by category
  const groupedItems = groupByCategory
    ? filteredItems.reduce((acc, item) => {
        const category = item.category || 'General'
        if (!acc[category]) acc[category] = []
        acc[category].push(item)
        return acc
      }, {} as Record<string, FAQItem[]>)
    : null

  return (
    <>
      {/* Schema markup for SEO */}
      <FAQSchema items={items} />

      <section
        className={`py-16 md:py-24 ${className}`}
        aria-labelledby="faq-heading"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-primary-500 mb-4">
              <HelpCircle className="w-6 h-6" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                FAQ
              </span>
            </div>
            <h2 
              id="faq-heading"
              className="text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Frequently Asked Questions
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Everything you need to know about Servio. Can't find what you're looking for? 
              <a href="#contact" className="text-primary-500 hover:text-primary-400 ml-1">
                Contact our team
              </a>
            </p>
          </div>

          {/* Search */}
          {showSearch && (
            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="search"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}

          {/* FAQ Items */}
          {groupedItems ? (
            <div className="space-y-8">
              {Object.entries(groupedItems).map(([category, categoryItems]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    {category}
                  </h3>
                  <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    {categoryItems.map(item => (
                      <FAQAccordionItem
                        key={item.id}
                        item={item}
                        isOpen={openItems.has(item.id)}
                        onToggle={() => handleToggle(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <FAQAccordionItem
                    key={item.id}
                    item={item}
                    isOpen={openItems.has(item.id)}
                    onToggle={() => handleToggle(item.id)}
                  />
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">
                    No questions found matching "{searchQuery}"
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-primary-500 hover:text-primary-400"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Contact CTA */}
          {showContactCTA && (
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-4 bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-primary-500" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Still have questions?</p>
                  <p className="text-gray-400 text-sm">
                    Our team is here to help 24/7
                  </p>
                </div>
                <a
                  href="/book-demo"
                  className="ml-4 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  Contact Us
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

// ============================================================================
// Compact FAQ Variant
// ============================================================================

interface CompactFAQProps {
  items?: FAQItem[]
  maxItems?: number
  className?: string
}

export function CompactFAQ({ 
  items = DEFAULT_FAQ_ITEMS, 
  maxItems = 5,
  className = '' 
}: CompactFAQProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const handleToggle = (itemId: string) => {
    setOpenItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.clear()
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const displayItems = items.slice(0, maxItems)

  return (
    <>
      <FAQSchema items={displayItems} />
      
      <div className={className}>
        <h3 className="text-lg font-semibold text-white mb-4">
          Common Questions
        </h3>
        <div className="space-y-2">
          {displayItems.map(item => (
            <div key={item.id} className="bg-gray-800/50 rounded-lg">
              <button
                onClick={() => handleToggle(item.id)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={openItems.has(item.id)}
              >
                <span className="text-sm font-medium text-white">
                  {item.question}
                </span>
                <ChevronDown 
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    openItems.has(item.id) ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {openItems.has(item.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-sm text-gray-400">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ============================================================================
// Export
// ============================================================================

export default FAQSection
