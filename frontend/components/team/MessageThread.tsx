import React from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { TeamMessage } from '../../lib/teamCommunication'

interface MessageThreadProps {
  messages: TeamMessage[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onRetryMessage: (messageId: string) => void
  onDeleteMessage: (messageId: string) => void
}

export default function MessageThread({
  messages,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onRetryMessage,
  onDeleteMessage
}: MessageThreadProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        No messages in this channel yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="w-full text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-60"
        >
          {isLoadingMore ? 'Loading older messages…' : 'Load older messages'}
        </button>
      )}

      {messages.map((message) => (
        <article key={message.id} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 bg-white dark:bg-gray-900/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">{message.authorName}</span>
                {' · '}
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className={`text-sm mt-1 ${message.status === 'deleted' ? 'italic text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                {message.body}
              </p>
            </div>

            {message.status !== 'deleted' && (
              <button onClick={() => onDeleteMessage(message.id)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" title="Delete message">
                <Trash2 className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            {message.status === 'sending' && <span className="text-[11px] text-amber-500">Sending…</span>}
            {message.status === 'edited' && <span className="text-[11px] text-gray-400">Edited</span>}
            {message.status === 'failed' && (
              <button onClick={() => onRetryMessage(message.id)} className="inline-flex items-center gap-1 text-[11px] text-red-500 hover:underline">
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
