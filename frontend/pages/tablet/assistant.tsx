'use client';

import React from 'react'
import { useRouter } from 'next/router'
import TabletLayout from '../../components/Layout/TabletLayout'
import AssistantPage from '../dashboard/assistant'
import { useUser } from '../../contexts/UserContext'

export default function TabletAssistantPage() {
  const router = useRouter()
  const { user } = useUser()

  // Backend enforces manager/owner/admin for assistant routes.
  const allowed = user?.role && ['manager', 'owner', 'admin'].includes(user.role)

  return (
    <TabletLayout title="AI Assistant">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-white/70 text-sm">
          Use Servio to 86 items, restore availability, and handle ops hands-free.
        </div>
        <button
          onClick={() => router.push('/tablet/orders')}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-bold"
        >
          Back to Orders
        </button>
      </div>

      {!allowed ? (
        <div className="bg-red-500/15 border border-red-500/30 text-red-200 rounded-2xl p-4">
          Your role (<span className="font-bold">{user?.role || 'unknown'}</span>) can’t access the AI assistant. Log in as a manager/owner/admin.
        </div>
      ) : (
        // Reuse the exact same assistant implementation as the dashboard.
        // This page is only a tablet wrapper for layout/navigation.
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <AssistantPage />
        </div>
      )}
    </TabletLayout>
  )
}

