import React from 'react'

interface StatusChipProps {
  label: string
  toneClassName?: string
  className?: string
}

export default function StatusChip({ label, toneClassName = '', className = '' }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClassName} ${className}`.trim()}
    >
      {label}
    </span>
  )
}
