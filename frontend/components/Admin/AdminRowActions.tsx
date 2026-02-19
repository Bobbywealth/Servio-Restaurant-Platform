import React from 'react'

interface AdminRowActionsProps {
  children: React.ReactNode
  className?: string
}

export default function AdminRowActions({ children, className = '' }: AdminRowActionsProps) {
  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 [&>button]:min-h-11 [&>button]:min-w-11 [&>select]:min-h-11 [&>select]:min-w-11 [&>a]:min-h-11 [&>a]:min-w-11 ${className}`.trim()}>
      {children}
    </div>
  )
}
