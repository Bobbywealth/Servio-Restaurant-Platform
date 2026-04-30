import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import { api } from '../../lib/api';
import { RefreshCw, Send } from 'lucide-react';

interface SupportThread {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  status: 'open' | 'closed';
  last_message: string | null;
  last_message_at: string | null;
}

interface SupportMessage {
  id: string;
  sender_type: 'restaurant' | 'support';
  sender_name?: string | null;
  message: string;
  created_at: string;
}

const REFRESH_MS = 6000;

export default function AdminSupportChatsPage() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const resp = await api.get('/api/support-chat/threads', { params: { status: 'open', limit: 200 } });
      const nextThreads = resp?.data?.data?.threads ?? [];
      setThreads(nextThreads);
      if (!selectedThreadId && nextThreads.length > 0) {
        setSelectedThreadId(nextThreads[0].id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load support chats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedThreadId]);

  const loadMessages = useCallback(async () => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    try {
      const resp = await api.get(`/api/support-chat/threads/${selectedThreadId}/messages`);
      setMessages(resp?.data?.data?.messages ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load messages');
    }
  }, [selectedThreadId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadThreads(true);
      loadMessages();
    }, REFRESH_MS);

    return () => clearInterval(interval);
  }, [loadMessages, loadThreads]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const sendMessage = async () => {
    if (!selectedThreadId || !draft.trim()) return;

    try {
      setSending(true);
      setError(null);
      await api.post(`/api/support-chat/threads/${selectedThreadId}/messages`, { message: draft.trim() });
      setDraft('');
      await loadMessages();
      await loadThreads(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout title="Support Chats" description="Customer service messages sent by restaurants from their dashboard widget">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active Support Conversations</h2>
          <button onClick={() => loadThreads(true)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-700">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200">
              Conversations ({threads.length})
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {!loading && threads.length === 0 && (
                <p className="p-4 text-sm text-gray-500">No support chats yet.</p>
              )}
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedThreadId === thread.id ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{thread.restaurant_name || thread.restaurant_id}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{thread.last_message || 'New conversation'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col min-h-[520px]">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedThread?.restaurant_name || 'Select a conversation'}</p>
              {selectedThread && <p className="text-xs text-gray-500">Thread ID: {selectedThread.id}</p>}
            </div>

            <div className="flex-1 p-4 space-y-2 overflow-y-auto bg-gray-50 dark:bg-gray-900/20">
              {messages.length === 0 && <p className="text-sm text-gray-500">No messages yet.</p>}
              {messages.map((msg) => (
                <div key={msg.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.sender_type === 'support' ? 'ml-auto bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                  {msg.sender_type === 'restaurant' && (
                    <p className="text-xs text-gray-500 mb-1">{msg.sender_name || 'Restaurant'}</p>
                  )}
                  {msg.message}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={selectedThreadId ? 'Reply to restaurant...' : 'Choose a conversation first'}
                disabled={!selectedThreadId}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!selectedThreadId || !draft.trim() || sending}
                className="rounded-lg bg-red-600 text-white px-3 py-2 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
