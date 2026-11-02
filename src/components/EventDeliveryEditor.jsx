import { useState } from 'react'
import ItemCombobox from './ItemCombobox'
import { CloseIcon, PlusIcon } from './icons'
import { eventLabel, hasService } from '../lib/eventServices'

function AddExtra({ existing, options, onAdd }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = (name) => {
    const clean = String(name || '').trim()
    if (clean && !hasService(existing, clean)) onAdd(clean)
    setDraft('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        <PlusIcon width={13} height={13} /> Add extra service
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-72">
        <ItemCombobox
          value={draft}
          onChange={setDraft}
          onSelectItem={(item) => commit(item.name)}
          itemsList={options.map((name) => ({ name }))}
          placeholder="Select or type the extra service"
          listTitle="Saved Services"
          matchTitle="Matching Services"
          newBadge="Extra service"
          limit={30}
        />
      </div>
      <button type="button" onClick={() => commit(draft)} disabled={!draft.trim()} className="btn-primary px-3 py-1 text-xs">
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft('')
          setOpen(false)
        }}
        className="text-xs text-gray-500 hover:underline"
      >
        Cancel
      </button>
    </div>
  )
}

// Read-only list of each event's services, plus extras added after the quotation was made.
export default function EventDeliveryEditor({ schedule, extras, onExtrasChange, options }) {
  if (schedule.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-500 dark:border-gray-600">
        Add events and services in the Event Schedule above; they will appear here.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {schedule.map((ev, index) => {
        const eventExtras = extras.filter((x) => x.event_id === ev.id)
        const all = [...ev.services, ...eventExtras.map((x) => x.name)]

        return (
          <div key={ev.id} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="text-sm font-semibold">{eventLabel(ev, index)}</span>
            </div>

            <div className="space-y-2.5 bg-white px-4 py-3 dark:bg-gray-900/40">
              <div className="flex flex-wrap gap-1.5">
                {all.length === 0 && <span className="text-xs italic text-gray-400">No services in this event.</span>}
                {ev.services.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  >
                    {name}
                  </span>
                ))}
                {eventExtras.map((x) => (
                  <span
                    key={x.name}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 py-1 pl-3 pr-1.5 text-xs font-medium text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200"
                  >
                    {x.name}
                    <span className="rounded bg-amber-200/70 px-1 text-[9px] font-semibold uppercase dark:bg-amber-800/60">
                      Extra
                    </span>
                    <button
                      type="button"
                      onClick={() => onExtrasChange(extras.filter((e) => e !== x))}
                      title="Remove extra service"
                      className="rounded-full p-0.5 text-amber-600 hover:bg-amber-100 hover:text-red-600 dark:hover:bg-amber-800"
                    >
                      <CloseIcon width={12} height={12} />
                    </button>
                  </span>
                ))}
              </div>
              <AddExtra
                existing={all}
                options={options}
                onAdd={(name) => onExtrasChange([...extras, { event_id: ev.id, name }])}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
