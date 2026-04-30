import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { api } from '../../lib/api';

interface SupportChatThread {
  id: string;
  status: 'open' | 'closed';
}

interface SupportChatMessage {
  id: string;
  sender_type: 'restaurant' | 'support';
  sender_name?: string | null;
  message: string;
  created_at: string;
}

const REFRESH_MS = 6000;

const SupportChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [thread, setThread] = useState<SupportChatThread | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThreadAndMessages = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const threadsResp = await api.get('/api/support-chat/threads', { params: { status: 'open', limit: 1 } });
      const first = threadsResp?.data?.data?.threads?.[0];
      if (!first) {
        setThread(null);
        setMessages([]);
        return;
      }
      setThread(first);
      const messagesResp = await api.get(`/api/support-chat/threads/${first.id}/messages`);
      setMessages(messagesResp?.data?.data?.messages ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load support chat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadThreadAndMessages();
    const interval = setInterval(loadThreadAndMessages, REFRESH_MS);
    return () => clearInterval(interval);
  }, [isOpen, loadThreadAndMessages]);

  const sendMessage = async () => {
    const message = draft.trim();
    if (!message) return;

    try {
      setSending(true);
      setError(null);
      if (thread) {
        await api.post(`/api/support-chat/threads/${thread.id}/messages`, { message });
      } else {
        const createResp = await api.post('/api/support-chat/threads', { message });
        const newThreadId = createResp?.data?.data?.threadId;
        if (newThreadId) {
          setThread({ id: newThreadId, status: 'open' });
        }
      }
      setDraft('');
      await loadThreadAndMessages();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-servio-red-500 text-white shadow-lg p-4 hover:bg-servio-red-600 transition-colors"
          aria-label="Open support chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <div className="w-[340px] max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-servio-red-500 text-white">
            <div>
              <p className="font-semibold">Customer Service</p>
              <p className="text-xs text-red-100">Message our support team</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-red-600" aria-label="Close support chat">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-72 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {loading && <p className="text-sm text-gray-500">Loading chat...</p>}
            {!loading && !hasMessages && <p className="text-sm text-gray-500">Start a conversation with support.</p>}
            {messages.map((msg) => (
              <div key={msg.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.sender_type === 'restaurant' ? 'ml-auto bg-servio-red-500 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                {msg.sender_type === 'support' && (
                  <p className="text-xs text-gray-500 mb-1">{msg.sender_name || 'Support'}</p>
                )}
                <p>{msg.message}</p>
              </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="p-3 border-t border-gray-200 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-servio-red-500"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !draft.trim()}
              className="rounded-lg bg-servio-red-500 text-white px-3 py-2 disabled:opacity-50"
              aria-label="Send support message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportChatWidget;
