export const newEventId = () =>
  globalThis.crypto?.randomUUID?.() ?? `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const emptyEvent = () => ({ id: newEventId(), date: '', event: '', coverage: '', location: '', services: [] })

export const hasService = (list, name) => {
  const n = String(name).trim().toLowerCase()
  return list.some((s) => s.trim().toLowerCase() === n)
}

export const eventLabel = (ev, index) => ev.event?.trim() || `Event ${index + 1}`

// Case-insensitive de-dupe that keeps the first spelling.
export const uniqueNames = (names) => {
  const seen = new Set()
  return names.filter((n) => {
    const key = n.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

