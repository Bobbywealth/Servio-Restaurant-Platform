import React from 'react'
import { Hash } from 'lucide-react'
import { TeamChannel } from '../../lib/teamCommunication'

interface ChannelListProps {
  channels: TeamChannel[]
  activeChannelId: string | null
  isLoading: boolean
  onSelectChannel: (channelId: string) => void
}

export default function ChannelList({ channels, activeChannelId, isLoading, onSelectChannel }: ChannelListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-14 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400">
        No channels yet.
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {channels.map((channel) => {
        const isActive = channel.id === activeChannelId
        return (
          <li key={channel.id}>
            <button
              onClick={() => onSelectChannel(channel.id)}
              className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? 'border-primary-300 bg-primary-50 dark:border-primary-600 dark:bg-primary-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/70'
              }`}
            >
              <Hash className="w-4 h-4 text-gray-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-900 dark:text-white">{channel.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{channel.lastMessagePreview || channel.description || 'No messages yet'}</p>
              </div>
              {channel.unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-semibold">
                  {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
