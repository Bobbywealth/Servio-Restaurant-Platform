import React, { useState } from 'react'
import { SendHorizonal } from 'lucide-react'

interface MessageComposerProps {
  disabled?: boolean
  onSendMessage: (body: string) => Promise<void> | void
}

export default function MessageComposer({ disabled, onSendMessage }: MessageComposerProps) {
  const [value, setValue] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const body = value.trim()
    if (!body) return
    await onSendMessage(body)
    setValue('')
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={2}
        disabled={disabled}
        placeholder="Write to your team…"
        className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <SendHorizonal className="w-4 h-4" />
      </button>
    </form>
  )
}
