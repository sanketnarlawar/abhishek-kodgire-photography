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

// Event-wise service lists for a quotation (extra services included); legacy quotes fall back to one group.
export const serviceGroups = (q) => {
  const details = q?.details || {}
  const extras = details.service_delivery || []
  const groups = (details.schedule || [])
    .map((ev, i) => {
      const id = ev.id || `event-${i}`
      const extra = extras.filter((x) => x.extra && ev.id && x.event_id === ev.id).map((x) => x.service)
      return {
        id,
        label: eventLabel(ev, i),
        date: ev.date || '',
        location: ev.location || '',
        services: uniqueNames([...(ev.services || []), ...extra].map((s) => String(s).trim()).filter(Boolean)),
      }
    })
    .filter((g) => g.services.length > 0)
  if (groups.length === 0) {
    const legacy = uniqueNames((q?.items || []).map((it) => it.description?.trim()).filter(Boolean))
    if (legacy.length > 0) {
      groups.push({ id: 'legacy', label: q?.event_type || 'Services', date: q?.event_date || '', location: '', services: legacy })
    }
  }
  return groups
}

// Drops assignments whose event or service no longer exists.
export const pruneAssignments = (assignments, groups) => {
  const out = {}
  groups.forEach((g) =>
    g.services.forEach((s) => {
      const a = assignments?.[g.id]?.[s]
      if (a?.name) out[g.id] = { ...(out[g.id] || {}), [s]: a }
    })
  )
  return out
}

export const assignmentProgress = (q) => {
  const groups = serviceGroups(q)
  const total = groups.reduce((n, g) => n + g.services.length, 0)
  const assigned = groups.reduce((n, g) => n + g.services.filter((s) => q?.details?.assignments?.[g.id]?.[s]?.name).length, 0)
  return { assigned, total }
}

