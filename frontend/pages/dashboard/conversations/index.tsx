import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import DashboardLayout from '../../../components/Layout/DashboardLayout'
import { useUser } from '../../../contexts/UserContext'
import { conversationsApi, ConversationSession } from '../../../lib/conversations'
import { RefreshCw, Filter, Search, Phone, Clock, ChevronRight, CheckCircle, AlertCircle, XCircle, FileText, MessageSquare } from 'lucide-react'
import { TableRowSkeleton } from '../../../components/ui/Skeleton'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'

type ConversationStatus = 'completed' | 'failed' | 'no_answer' | 'transcript_pending' | 'analyzing' | 'transcript_failed' | 'analysis_failed'

interface ConversationFilters {
  from?: string
  to?: string
  intent?: string
  outcome?: string
  sentiment?: string
  durationMin?: number
  durationMax?: number
  reviewed?: boolean
  search?: string
}

const intentLabels: Record<string, string> = {
  order_placement: 'Order Placement',
  menu_inquiry: 'Menu Inquiry',
  pricing: 'Pricing',
  hours: 'Hours/Info',
  complaint: 'Complaint',
  catering: 'Catering',
  reservation: 'Reservation',
  feedback: 'Feedback',
  other: 'Other'
}

const outcomeLabels: Record<string, string> = {
  success: 'Success',
  abandoned: 'Abandoned',
  escalated: 'Escalated',
  unresolved: 'Unresolved'
}

const sentimentLabels: Record<string, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative'
}

const statusConfig: Record<ConversationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="w-3.5 h-3.5" /> },
  no_answer: { label: 'No Answer', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: <Phone className="w-3.5 h-3.5" /> },
  transcript_pending: { label: 'Transcribing', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" /> },
  analyzing: { label: 'Analyzing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" /> },
  transcript_failed: { label: 'Transcript Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  analysis_failed: { label: 'Analysis Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <AlertCircle className="w-3.5 h-3.5" /> }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays === 1) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
}

function ReviewBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
      <CheckCircle className="w-3 h-3 mr-1" />
      Reviewed
    </span>
  )
}

function QualityScore({ score }: { score?: number }) {
  if (score === undefined || score === null) return null

  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-600'
  const bg = score >= 70 ? 'bg-green-100' : score >= 40 ? 'bg-amber-100' : 'bg-red-100'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${color}`}>
      {score}%
    </span>
  )
}

export default function ConversationsPage() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [filters, setFilters] = useState<ConversationFilters>({
    search: '',
    from: '',
    to: '',
    intent: '',
    outcome: '',
    sentiment: '',
    reviewed: undefined
  })

  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0
  })

  const loadConversations = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const result = await conversationsApi.list({
        ...filters,
        limit: pagination.limit,
        offset: pagination.offset
      })
      setSessions(result.sessions)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadConversations()
    }
  }, [user, pagination])

  const handleRefresh = () => {
    loadConversations(true)
  }

  const handleFilterChange = (key: keyof ConversationFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyFilters = () => {
    setPagination(prev => ({ ...prev, offset: 0 }))
    loadConversations()
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      from: '',
      to: '',
      intent: '',
      outcome: '',
      sentiment: '',
      reviewed: undefined
    })
    setPagination(prev => ({ ...prev, offset: 0 }))
    loadConversations()
  }

  const loadMore = () => {
    setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))
  }

  const hasMore = sessions.length < total

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.from) count++
    if (filters.to) count++
    if (filters.intent) count++
    if (filters.outcome) count++
    if (filters.sentiment) count++
    if (filters.reviewed !== undefined) count++
    if (filters.search) count++
    return count
  }, [filters])

  return (
    <DashboardLayout>
      <Head>
        <title>Conversations | Servio</title>
      </Head>

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conversations</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {loading ? 'Loading...' : `${total} call${total !== 1 ? 's' : ''} analyzed`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-servio-orange text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-white/20 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="sm:col-span-2 lg:col-span-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by phone number..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    />
                  </div>

                  {/* Date Range */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(e) => handleFilterChange('from', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
                    <input
                      type="date"
                      value={filters.to}
                      onChange={(e) => handleFilterChange('to', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    />
                  </div>

                  {/* Intent */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Intent</label>
                    <select
                      value={filters.intent}
                      onChange={(e) => handleFilterChange('intent', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    >
                      <option value="">All Intents</option>
                      {Object.entries(intentLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Outcome */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Outcome</label>
                    <select
                      value={filters.outcome}
                      onChange={(e) => handleFilterChange('outcome', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    >
                      <option value="">All Outcomes</option>
                      {Object.entries(outcomeLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sentiment */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sentiment</label>
                    <select
                      value={filters.sentiment}
                      onChange={(e) => handleFilterChange('sentiment', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    >
                      <option value="">All Sentiments</option>
                      {Object.entries(sentimentLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reviewed */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Review Status</label>
                    <select
                      value={filters.reviewed === undefined ? '' : filters.reviewed.toString()}
                      onChange={(e) => {
                        const value = e.target.value
                        handleFilterChange('reviewed', value === '' ? undefined : value === 'true')
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    >
                      <option value="">All</option>
                      <option value="true">Reviewed Only</option>
                      <option value="false">Unreviewed Only</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={applyFilters}
                    className="px-4 py-2 text-sm bg-servio-orange text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversations List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <TableRowSkeleton />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No conversations found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeFiltersCount > 0
                  ? 'Try adjusting your filters'
                  : 'Conversations will appear here after phone calls are completed'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {sessions.map((session) => {
                const status = statusConfig[session.status as ConversationStatus] || statusConfig.completed
                const intent = session.insights?.intentPrimary
                const outcome = session.insights?.outcome
                const sentiment = session.insights?.sentiment

                return (
                  <Link
                    key={session.id}
                    href={`/dashboard/conversations/${session.id}`}
                    className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className={`w-4 h-4 ${
                            session.direction === 'inbound'
                              ? 'text-blue-500'
                              : 'text-green-500'
                          }`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {session.fromNumber || 'Unknown'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </span>
                          {session.review && <ReviewBadge />}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(session.startedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {formatDuration(session.durationSeconds)}
                          </span>
                          {intent && (
                            <span className="text-gray-600 dark:text-gray-300">
                              {intentLabels[intent] || intent}
                            </span>
                          )}
                          {outcome && (
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              outcome === 'success'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : outcome === 'abandoned'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {outcomeLabels[outcome] || outcome}
                            </span>
                          )}
                          {sentiment && (
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              sentiment === 'positive'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : sentiment === 'negative'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {sentimentLabels[sentiment]}
                            </span>
                          )}
                          {session.insights?.qualityScore !== undefined && (
                            <QualityScore score={session.insights.qualityScore} />
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Load More */}
        {hasMore && !loading && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMore}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Load More ({sessions.length} of {total})
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
