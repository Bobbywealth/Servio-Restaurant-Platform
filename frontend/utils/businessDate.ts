export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function getDateStringInTimezone(timezone: string, date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(date)
}

export function formatBusinessDateLabel(dateString: string, timezone: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const dateAtNoonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateAtNoonUtc)
}

export function getTimezoneShortLabel(timezone: string, dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const dateAtNoonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(dateAtNoonUtc)

  return parts.find((part) => part.type === 'timeZoneName')?.value || timezone
}

export function isDateInBusinessDay(dateInput: string | undefined, dateString: string, timezone: string): boolean {
  if (!dateInput) return false
  return getDateStringInTimezone(timezone, new Date(dateInput)) === dateString
}
