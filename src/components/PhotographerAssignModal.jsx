import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import { Spinner } from './Loaders'
import { CameraIcon, CalendarIcon, MapPinIcon, PhoneIcon } from './icons'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { formatDate, quotationName } from '../lib/format'
import { serviceGroups } from '../lib/eventServices'

const keyOf = (groupId, service) => `${groupId}::${service}`
const digits = (s) => String(s || '').replace(/\D/g, '')

// Free text plus a dropdown of saved photographers.
function PhotographerInput({ value, onChange, onPick, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const query = value.trim().toLowerCase()
  const matches = useMemo(
    () => options.filter((o) => !query || o.name.toLowerCase().includes(query)),
    [options, query]
  )
  const isNew = query && !options.some((o) => o.name.trim().toLowerCase() === query)

  const pick = (p) => {
    onPick(p)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault()
      pick(matches[active])
    } else if (e.key === 'Escape' && open) {
      // Keep Escape from closing the whole popup while the list is open.
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        className="input pr-8"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear photographer"
          onClick={() => {
            onChange('')
            setOpen(false)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          ✕
        </button>
      ) : (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show saved photographers"
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
        >
          ▾
        </button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                i === active ? 'bg-brand-50 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
              }`}
            >
              <span className="truncate font-medium">{p.name}</span>
              {p.phone && <span className="shrink-0 text-xs text-gray-400">{p.phone}</span>}
            </button>
          ))}
          {isNew && (
            <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              “{value.trim()}” will be saved as a new photographer
            </div>
          )}
          {matches.length === 0 && !isNew && (
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              No saved photographers yet. Type a name to add one.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AssignForm({ quotation, photographers, onClose, onSaved }) {
  const { notify } = useToast()
  const groups = useMemo(() => serviceGroups(quotation), [quotation])
  const [rows, setRows] = useState(() => {
    const saved = quotation.details?.assignments || {}
    const init = {}
    groups.forEach((g) =>
      g.services.forEach((s) => {
        const a = saved[g.id]?.[s]
        init[keyOf(g.id, s)] = { name: a?.name || '', phone: a?.phone || '' }
      })
    )
    return init
  })
  const [saving, setSaving] = useState(false)

  const total = groups.reduce((n, g) => n + g.services.length, 0)
  const assigned = Object.values(rows).filter((r) => r.name.trim()).length

  const setRow = (key, patch) => setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }))

  const save = async () => {
    const entries = []
    for (const g of groups) {
      for (const s of g.services) {
        const r = rows[keyOf(g.id, s)]
        const name = r.name.trim()
        const phone = r.phone.trim()
        if (!name && phone) {
          notify(`Enter the photographer name for ${s}`, 'error')
          return
        }
        if (phone && digits(phone).length < 7) {
          notify(`Check the contact number for ${name}`, 'error')
          return
        }
        if (name) entries.push({ group: g, service: s, name, phone })
      }
    }

    setSaving(true)
    try {
      const known = new Map(photographers.map((p) => [p.name.trim().toLowerCase(), p]))
      const toInsert = new Map()
      const toUpdate = new Map()
      entries.forEach(({ name, phone }) => {
        const k = name.toLowerCase()
        const existing = known.get(k)
        if (!existing) {
          if (!toInsert.has(k) || (!toInsert.get(k).phone && phone)) toInsert.set(k, { name, phone: phone || null })
        } else if (phone && phone !== (existing.phone || '')) {
          toUpdate.set(existing.id, phone)
        }
      })

      let nextPhotographers = [...photographers]
      if (toInsert.size > 0) {
        const { data, error } = await supabase.from('photographers').insert([...toInsert.values()]).select()
        if (error) {
          const missingTable = error.code === '42P01' || error.code === 'PGRST205'
          throw new Error(
            missingTable
              ? 'Run supabase/migrations/009_add_photographers.sql in the Supabase SQL Editor, then save again.'
              : error.message
          )
        }
        nextPhotographers = [...nextPhotographers, ...(data || [])]
      }
      for (const [pid, phone] of toUpdate) {
        const { error } = await supabase.from('photographers').update({ phone }).eq('id', pid)
        if (error) throw error
        nextPhotographers = nextPhotographers.map((p) => (p.id === pid ? { ...p, phone } : p))
      }

      const assignments = {}
      entries.forEach(({ group, service, name, phone }) => {
        assignments[group.id] = { ...(assignments[group.id] || {}), [service]: { name, phone } }
      })
      const details = { ...(quotation.details || {}), assignments }
      const { error } = await supabase.from('quotations').update({ details }).eq('id', quotation.id)
      if (error) throw error

      notify('Photographers assigned')
      onSaved({ quotationId: quotation.id, details, photographers: nextPhotographers })
    } catch (err) {
      notify(err.message || 'Could not save assignments', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (groups.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        This quotation has no services yet. Add services to its events first.
        <div className="mt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">{quotationName(quotation, quotation.client)}</span>
          <span className="text-gray-500 dark:text-gray-400">
            {assigned} of {total} services assigned
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${total ? (assigned / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.id} className="rounded-xl border border-gray-200 dark:border-gray-700">
            <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
              <h3 className="text-sm font-semibold">{g.label}</h3>
              {g.date && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <CalendarIcon width={13} height={13} /> {formatDate(g.date)}
                </span>
              )}
              {g.location && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <MapPinIcon width={13} height={13} /> {g.location}
                </span>
              )}
            </header>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {g.services.map((s) => {
                const key = keyOf(g.id, s)
                const row = rows[key]
                return (
                  <div
                    key={key}
                    className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] md:items-center md:gap-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CameraIcon width={15} height={15} className="shrink-0 text-gray-400" />
                      <span className="truncate" title={s}>
                        {s}
                      </span>
                    </div>
                    <PhotographerInput
                      value={row.name}
                      options={photographers}
                      placeholder="Photographer name"
                      onChange={(name) => setRow(key, { name })}
                      onPick={(p) => setRow(key, { name: p.name, phone: p.phone || row.phone })}
                    />
                    <div className="relative">
                      <PhoneIcon
                        width={14}
                        height={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        className="input pl-9"
                        type="tel"
                        inputMode="tel"
                        value={row.phone}
                        placeholder="Contact number"
                        onChange={(e) => setRow(key, { phone: e.target.value.replace(/[^\d+\-\s()]/g, '') })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
          Cancel
        </button>
        <button type="button" onClick={save} className="btn-primary" disabled={saving}>
          {saving && <Spinner size={14} />} Save assignments
        </button>
      </div>
    </div>
  )
}

export default function PhotographerAssignModal({ open, quotation, photographers, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Assign photographers" size="xl">
      {quotation && (
        <AssignForm
          key={quotation.id}
          quotation={quotation}
          photographers={photographers}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  )
}
