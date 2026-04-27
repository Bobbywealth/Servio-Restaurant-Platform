export interface UtcDateBounds {
  dateFrom: string
  dateTo: string
}

function getTimeZoneDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const mapped = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})

  return {
    year: Number(mapped.year),
    month: Number(mapped.month),
    day: Number(mapped.day),
    hour: Number(mapped.hour),
    minute: Number(mapped.minute),
    second: Number(mapped.second)
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneDateParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - date.getTime()
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  return new Date(utcGuess - offset)
}

export function getRestaurantDateString(timeZone: string, dayOffset = 0): string {
  const shifted = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000)

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(shifted)
}

export function getUtcBoundsForRestaurantDay(selectedDate: string, timeZone: string): UtcDateBounds {
  const [yearRaw, monthRaw, dayRaw] = selectedDate.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!year || !month || !day) {
    throw new Error(`Invalid selectedDate: ${selectedDate}`)
  }

  const startUtc = zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0, timeZone)
  const endUtc = zonedDateTimeToUtc(year, month, day, 23, 59, 59, 999, timeZone)

  return {
    dateFrom: startUtc.toISOString(),
    dateTo: endUtc.toISOString()
  }
}

export function getUtcBoundsForRestaurantRange(
  rangeStart: string,
  rangeEnd: string,
  timeZone: string
): UtcDateBounds {
  const startBounds = getUtcBoundsForRestaurantDay(rangeStart, timeZone)
  const endBounds = getUtcBoundsForRestaurantDay(rangeEnd, timeZone)

  return {
    dateFrom: startBounds.dateFrom,
    dateTo: endBounds.dateTo
  }
}
