import { useState } from 'react'
import ItemCombobox from './ItemCombobox'
import { CalendarIcon, CloseIcon, CopyIcon, MapPinIcon, PlusIcon, TrashIcon } from './icons'
import { emptyEvent, hasService } from '../lib/eventServices'

const fieldLabel = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400'

function ServicePicker({ services, onChange, suggestions, options, packages, previousServices }) {
  const [draft, setDraft] = useState('')
  const [packageId, setPackageId] = useState('')

  const add = (names) => {
    const next = [...services]
    names.forEach((n) => {
      const name = String(n || '').trim()
      if (name && !hasService(next, name)) next.push(name)
    })
    if (next.length !== services.length) onChange(next)
  }

  const remove = (name) => onChange(services.filter((s) => s !== name))
  const remaining = suggestions.filter((s) => !hasService(services, s))

  return (
    <div className="space-y-2.5">
      <div className="flex min-h-[2rem] flex-wrap gap-1.5">
        {services.length === 0 && (
          <span className="py-1 text-xs italic text-gray-400">No services yet. Pick one below or type your own.</span>
        )}
        {services.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-medium text-brand-800 dark:border-brand-700/60 dark:bg-brand-900/30 dark:text-brand-200"
          >
            {s}
            <button
              type="button"
              onClick={() => remove(s)}
              title={`Remove ${s}`}
              className="rounded-full p-0.5 text-brand-500 hover:bg-brand-100 hover:text-red-600 dark:hover:bg-brand-800"
            >
              <CloseIcon width={12} height={12} />
            </button>
          </span>
        ))}
      </div>

      {remaining.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-gray-400">Quick add:</span>
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add([s])}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs text-gray-600 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-brand-900/30"
            >
              <PlusIcon width={11} height={11} /> {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72">
          <ItemCombobox
            value={draft}
            onChange={setDraft}
            onSelectItem={(item) => {
              add([item.name])
              setDraft('')
            }}
            itemsList={options.map((name) => ({ name }))}
            placeholder="Search or type another service, press Enter"
            listTitle="Saved Services"
            matchTitle="Matching Services"
            newBadge="New service"
            limit={30}
          />
        </div>
        {previousServices?.length > 0 && (
          <button
            type="button"
            onClick={() => add(previousServices)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            <CopyIcon width={13} height={13} /> Copy from previous event
          </button>
        )}
        {packages.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <select
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Add from package…</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!packageId}
              onClick={() => {
                const pkg = packages.find((p) => p.id === packageId)
                add((pkg?.items || []).map((it) => it.description))
                setPackageId('')
              }}
              className="btn-secondary px-2.5 py-1 text-xs"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Event cards, each holding its own list of services.
export default function EventScheduleEditor({ schedule, onChange, suggestions, options, packages }) {
  const update = (index, patch) => onChange(schedule.map((ev, i) => (i === index ? { ...ev, ...patch } : ev)))
  const remove = (index) => onChange(schedule.filter((_, i) => i !== index))

  return (
    <div className="space-y-4">
      {schedule.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-500 dark:border-gray-600">
          No events yet. Add your first event to start adding services.
        </p>
      )}

      {schedule.map((ev, index) => (
        <div
          key={ev.id}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
        >
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {ev.event?.trim() || `Event ${index + 1}`}
              </span>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {ev.services.length} {ev.services.length === 1 ? 'service' : 'services'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              title="Remove event"
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-gray-700"
            >
              <TrashIcon width={16} height={16} />
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={fieldLabel}>Event</label>
                <input
                  type="text"
                  className="input mt-1 text-sm"
                  placeholder="e.g. Haldi"
                  value={ev.event}
                  onChange={(e) => update(index, { event: e.target.value })}
                />
              </div>
              <div>
                <label className={`${fieldLabel} flex items-center gap-1`}>
                  <CalendarIcon width={12} height={12} /> Date
                </label>
                <input
                  type="date"
                  className="input mt-1 text-sm"
                  value={ev.date}
                  onChange={(e) => update(index, { date: e.target.value })}
                />
              </div>
              <div>
                <label className={`${fieldLabel} flex items-center gap-1`}>
                  <MapPinIcon width={12} height={12} /> Location
                </label>
                <input
                  type="text"
                  className="input mt-1 text-sm"
                  placeholder="e.g. Mangal Karyalay"
                  value={ev.location}
                  onChange={(e) => update(index, { location: e.target.value })}
                />
              </div>
              <div>
                <label className={fieldLabel}>Coverage</label>
                <input
                  type="text"
                  className="input mt-1 text-sm"
                  placeholder="e.g. Photography & Videography"
                  value={ev.coverage}
                  onChange={(e) => update(index, { coverage: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Services for this event</label>
              <div className="mt-2">
                <ServicePicker
                  services={ev.services}
                  onChange={(services) => update(index, { services })}
                  suggestions={suggestions}
                  options={options}
                  packages={packages}
                  previousServices={index > 0 ? schedule[index - 1].services : []}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => onChange([...schedule, emptyEvent()])} className="btn-secondary">
        <PlusIcon /> Add event
      </button>
    </div>
  )
}
