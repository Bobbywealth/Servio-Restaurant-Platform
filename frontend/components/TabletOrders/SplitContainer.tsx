import React from 'react'

export default function SplitContainer({
  left,
  right,
  className = ''
}: {
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={[
        'w-full',
        // Tablet-first: 2-column split on large screens, stacked on smaller.
        'grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]',
        'gap-4',
        className
      ].join(' ')}
    >
      <section className="min-w-0">{left}</section>
      <section className="min-w-0">{right}</section>
    </div>
  )
}

