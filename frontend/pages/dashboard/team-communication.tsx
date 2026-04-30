import React from 'react'
import Head from 'next/head'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useRouter } from 'next/router'
import ChannelList from '../../components/team/ChannelList'
import MessageThread from '../../components/team/MessageThread'
import MessageComposer from '../../components/team/MessageComposer'
import { useTeamCommunication } from '../../hooks/useTeamCommunication'

export default function TeamCommunicationPage() {
  const router = useRouter()
  const initialChannelId = typeof router.query.channelId === 'string' ? router.query.channelId : null

  const {
    channels,
    messages,
    activeChannelId,
    isChannelsLoading,
    isMessagesLoading,
    isLoadingMore,
    hasMore,
    isOffline,
    error,
    selectChannel,
    loadMore,
    sendMessage,
    retryMessage,
    deleteMessage,
    refresh,
    clearError
  } = useTeamCommunication(initialChannelId)

  return (
    <DashboardLayout>
      <Head>
        <title>Team Communication | Servio Dashboard</title>
      </Head>

      <section className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Team Communication</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Live channel messaging with optimistic updates and conflict-safe edits.</p>
          </div>
          <button
            onClick={() => void refresh()}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Refresh
          </button>
        </header>

        {isOffline && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
            You are offline. New messages will retry when your connection returns.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={clearError} className="text-xs underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 min-h-[65vh]">
          <aside className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
            <ChannelList
              channels={channels}
              activeChannelId={activeChannelId}
              isLoading={isChannelsLoading}
              onSelectChannel={selectChannel}
            />
          </aside>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex flex-col gap-3">
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <MessageThread
                messages={messages}
                isLoading={isMessagesLoading}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                onLoadMore={() => void loadMore()}
                onRetryMessage={(messageId) => void retryMessage(messageId)}
                onDeleteMessage={(messageId) => void deleteMessage(messageId)}
              />
            </div>
            <MessageComposer disabled={!activeChannelId || isOffline} onSendMessage={sendMessage} />
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}
