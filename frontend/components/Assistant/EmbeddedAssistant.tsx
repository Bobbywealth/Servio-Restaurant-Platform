import React from 'react'

/**
 * Tablet-friendly embedded assistant container.
 *
 * Note: the full assistant behavior (voice, transcript, commands) is implemented
 * in the dashboard assistant page. This component provides an embed-ready surface
 * for the tablet split view.
 */
export default function EmbeddedAssistant() {
  return (
    <div className="text-white/70">
      <div className="text-sm font-semibold text-white">Servio Assistant</div>
      <div className="text-xs text-white/60 mt-1">
        Loading assistant… (integrating full assistant UI next)
      </div>
    </div>
  )
}

