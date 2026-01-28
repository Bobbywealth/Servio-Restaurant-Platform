import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import DashboardLayout from '../../../components/Layout/DashboardLayout'
import { useUser } from '../../../contexts/UserContext'
import { conversationsApi, ConversationDetails } from '../../../lib/conversations'
import { ArrowLeft, Phone, Clock, Calendar, FileText, Lightbulb, AlertTriangle, CheckCircle, MessageSquare, Tag, Edit3, Save, X, Play, ExternalLink } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'

type ConversationStatus = 'completed' | 'failed' | 'no_answer' | 'transcript_pending' | 'analyzing' | 'transcript_failed' | 'analysis_failed'

const statusConfig: Record<ConversationStatus, { label: string; color: string; bgColor: string }> = {
  completed: { label: 'Completed', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20' },
  failed: { label: 'Failed', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  no_answer: { label: 'No Answer', color: 'text-gray-700 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-800' },
  transcript_pending: { label: 'Transcribing', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
  analyzing: { label: 'Analyzing', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  transcript_failed: { label: 'Transcript Failed', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  analysis_failed: { label: 'Analysis Failed', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' }
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

const outcomeLabels: Record<string, { label: string; color: string }> = {
  success: { label: 'Success', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
  abandoned: { label: 'Abandoned', color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
  escalated: { label: 'Escalated', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
  unresolved: { label: 'Unresolved', color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' }
}

const sentimentLabels: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
  neutral: { label: 'Neutral', color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' },
  negative: { label: 'Negative', color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' }
}

const frictionTypeLabels: Record<string, string> = {
  menu_confusion: 'Menu Confusion',
  tool_failure: 'Tool Failure',
  long_pause: 'Long Pause',
  pricing_objection: 'Pricing Objection',
  policy_issue: 'Policy Issue',
  handoff_needed: 'Handoff Needed',
  other: 'Other'
}

const suggestionTypeLabels: Record<string, string> = {
  script: 'Script Update',
  menu_data: 'Menu Data',
  tooling: 'Tooling',
  training: 'Training'
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        active
          ? 'bg-servio-orange text-white'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  )
}

export default function ConversationDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [conversation, setConversation] = useState<ConversationDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'insights' | 'notes'>('summary')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [followUpAction, setFollowUpAction] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id && user) {
      loadConversation()
    }
  }, [id, user])

  const loadConversation = async () => {
    try {
      const data = await conversationsApi.getById(id as string)
      setConversation(data)
      setNotes(data.review?.internalNotes || '')
      setTags(data.review?.tags || [])
      setFollowUpAction(data.review?.followUpAction || '')
    } catch (error) {
      console.error('Failed to load conversation:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveReview = async () => {
    if (!conversation) return
    setSaving(true)
    try {
      await conversationsApi.submitReview(conversation.session.id, {
        internalNotes: notes,
        tags,
        followUpAction
      })
      setEditingNotes(false)
      loadConversation()
    } catch (error) {
      console.error('Failed to save review:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!conversation) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Conversation not found</h1>
          <Link href="/dashboard/conversations" className="text-servio-orange hover:underline">
            Back to Conversations
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const { session, transcript, insights, review } = conversation
  const status = statusConfig[session.status as ConversationStatus] || statusConfig.completed

  return (
    <DashboardLayout>
      <Head>
        <title>Conversation | Servio</title>
      </Head>

      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/dashboard/conversations"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Conversations
        </Link>

        {/* Header Card */}
        <div className={`rounded-xl p-6 mb-6 ${status.bgColor}`}>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Phone className={`w-5 h-5 ${session.direction === 'inbound' ? 'text-blue-500' : 'text-green-500'}`} />
                <h1 className={`text-xl font-bold ${status.color}`}>
                  {session.fromNumber || 'Unknown Caller'}
                </h1>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color} bg-white/50 dark:bg-gray-800/50`}>
                  {status.label}
                </span>
                {review?.reviewedAt && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Reviewed
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block">Date & Time</span>
                  <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDateTime(session.startedAt)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block">Duration</span>
                  <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(session.durationSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block">Direction</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{session.direction}</span>
                </div>
                {insights?.qualityScore !== undefined && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Quality Score</span>
                    <span className={`font-medium ${
                      insights.qualityScore >= 70 ? 'text-green-600' :
                      insights.qualityScore >= 40 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {insights.qualityScore}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {session.audioUrl && (
              <a
                href={session.audioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-servio-orange text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Play className="w-4 h-4" />
                Play Recording
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <TabButton
            active={activeTab === 'summary'}
            onClick={() => setActiveTab('summary')}
            icon={FileText}
            label="Summary"
          />
          {transcript && (
            <TabButton
              active={activeTab === 'transcript'}
              onClick={() => setActiveTab('transcript')}
              icon={MessageSquare}
              label="Transcript"
            />
          )}
          {insights && (
            <TabButton
              active={activeTab === 'insights'}
              onClick={() => setActiveTab('insights')}
              icon={Lightbulb}
              label="Insights"
            />
          )}
          <TabButton
            active={activeTab === 'notes'}
            onClick={() => setActiveTab('notes')}
            icon={Edit3}
            label="Notes"
          />
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Key Metrics */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Analysis</h2>

                {insights ? (
                  <div className="space-y-4">
                    {/* Intent */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">Primary Intent</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {insights.intentPrimary ? intentLabels[insights.intentPrimary] || insights.intentPrimary : '-'}
                      </span>
                    </div>

                    {/* Outcome */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">Outcome</span>
                      {insights.outcome ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${outcomeLabels[insights.outcome].color}`}>
                          {outcomeLabels[insights.outcome].label}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>

                    {/* Sentiment */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">Sentiment</span>
                      {insights.sentiment ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${sentimentLabels[insights.sentiment].color}`}>
                          {sentimentLabels[insights.sentiment].label}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>

                    {/* Quality Score */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">Quality Score</span>
                      {insights.qualityScore !== undefined ? (
                        <span className={`font-medium ${
                          insights.qualityScore >= 70 ? 'text-green-600' :
                          insights.qualityScore >= 40 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {insights.qualityScore}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>

                    {/* Summary */}
                    {insights.summary && (
                      <div className="pt-2">
                        <span className="text-gray-500 dark:text-gray-400 block mb-2">Summary</span>
                        <p className="text-gray-900 dark:text-white text-sm leading-relaxed">
                          {insights.summary}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Analysis not yet available</p>
                    {session.status === 'analyzing' && (
                      <p className="text-sm mt-1">AI is processing the conversation...</p>
                    )}
                  </div>
                )}
              </div>

              {/* Secondary Intents & Entities */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Details</h2>

                {insights ? (
                  <div className="space-y-4">
                    {/* Secondary Intents */}
                    {insights.intentsSecondary && insights.intentsSecondary.length > 0 && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-2">Secondary Intents</span>
                        <div className="flex flex-wrap gap-2">
                          {insights.intentsSecondary.map((intent, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm"
                            >
                              {intentLabels[intent] || intent}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extracted Entities */}
                    {insights.extractedEntities && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-2">Entities Detected</span>
                        <div className="space-y-2">
                          {insights.extractedEntities.items_mention && insights.extractedEntities.items_mentioned.length > 0 && (
                            <div>
                              <span className="text-xs text-gray-400">Items:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {insights.extractedEntities.items_mentioned.map((item, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {insights.extractedEntities.prices_discussed && insights.extractedEntities.prices_discussed.length > 0 && (
                            <div>
                              <span className="text-xs text-gray-400">Prices:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {insights.extractedEntities.prices_discussed.map((price, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs"
                                  >
                                    {price}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tags from Review */}
                    {review?.tags && review.tags.length > 0 && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-2">Tags</span>
                        <div className="flex flex-wrap gap-2">
                          {review.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-sm"
                            >
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No details available yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'transcript' && transcript && (
            <motion.div
              key="transcript"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Full Transcript</h2>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {transcript.transcriptJson.turns.map((turn, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${
                      turn.speaker === 'customer'
                        ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
                        : 'bg-green-50 dark:bg-green-900/20 mr-8'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${
                        turn.speaker === 'customer'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {turn.speaker === 'customer' ? 'Customer' : 'Assistant'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.floor(turn.start / 60)}:{String(Math.floor(turn.start % 60)).padStart(2, '0')} - {Math.floor(turn.end / 60)}:{String(Math.floor(turn.end % 60)).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-white text-sm">{turn.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
                <p>STT Provider: {transcript.sttProvider} | Language: {transcript.language}</p>
                {transcript.sttConfidence && (
                  <p>Confidence: {(transcript.sttConfidence * 100).toFixed(1)}%</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'insights' && insights && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Friction Points */}
              {insights.frictionPoints && insights.frictionPoints.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Friction Points
                  </h2>
                  <div className="space-y-3">
                    {insights.frictionPoints.map((fp, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
                            {frictionTypeLabels[fp.type] || fp.type}
                          </span>
                          <span className="text-xs text-amber-600 dark:text-amber-500">
                            {Math.floor(fp.timestamp / 60)}:{String(Math.floor(fp.timestamp % 60)).padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{fp.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvement Suggestions */}
              {insights.improvementSuggestions && insights.improvementSuggestions.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-500" />
                    Improvement Suggestions
                  </h2>
                  <div className="space-y-3">
                    {insights.improvementSuggestions.map((suggestion, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            suggestion.type === 'script'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : suggestion.type === 'menu_data'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : suggestion.type === 'tooling'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {suggestionTypeLabels[suggestion.type] || suggestion.type}
                          </span>
                          <span className="font-medium text-blue-800 dark:text-blue-400">{suggestion.title}</span>
                        </div>
                        {suggestion.proposed_change && (
                          <p className="text-sm text-gray-700 dark:text-gray-300">{suggestion.proposed_change}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!insights.frictionPoints?.length && !insights.improvementSuggestions?.length) && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No Issues Detected</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    This conversation ran smoothly with no friction points or improvement suggestions.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Internal Notes</h2>
                {editingNotes ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingNotes(false)
                        setNotes(review?.internalNotes || '')
                        setTags(review?.tags || [])
                        setFollowUpAction(review?.followUpAction || '')
                      }}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={saveReview}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-servio-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  {editingNotes ? (
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add internal notes about this conversation..."
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-servio-orange min-h-[120px]"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                      {review?.internalNotes || 'No notes added yet.'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </label>
                  {editingNotes ? (
                    <input
                      type="text"
                      value={tags.join(', ')}
                      onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                      placeholder="Enter tags separated by commas"
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {review?.tags && review.tags.length > 0 ? (
                        review.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400">No tags added.</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Follow-up Action
                  </label>
                  {editingNotes ? (
                    <input
                      type="text"
                      value={followUpAction}
                      onChange={(e) => setFollowUpAction(e.target.value)}
                      placeholder="e.g., Call back customer, Update menu, etc."
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-servio-orange"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {review?.followUpAction || 'No follow-up action needed.'}
                    </p>
                  )}
                </div>

                {review?.reviewedAt && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-800">
                    Last reviewed by {review.reviewedBy} on {new Date(review.reviewedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
