import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import LineItemsEditor from '../components/LineItemsEditor'
import SelectWithOther from '../components/SelectWithOther'
import EmptyState from '../components/EmptyState'
import { CardSkeleton } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { PlusIcon, TrashIcon, PackageIcon } from '../components/icons'
import { EVENT_TYPES, formatCurrency } from '../lib/format'

const emptyForm = { name: '', event_type: 'Wedding', items: [] }

export default function Packages() {
  const { notify } = useToast()
  const confirm = useConfirm()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('packages').select('*').order('name')
    setPackages(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (pkg) => {
    setEditing(pkg)
    setForm({ name: pkg.name, event_type: pkg.event_type, items: pkg.items || [] })
    setModalOpen(true)
  }

  const total = (items) =>
    (items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0)

  const save = async (e) => {
    e.preventDefault()
    // Keep only fully-filled service rows; drop empty/incomplete ones.
    const cleanItems = form.items.filter(
      (it) => it.description.trim() && Number(it.quantity) > 0 && Number(it.rate) > 0
    )
    if (cleanItems.length === 0) {
      notify('Add at least one service with description, quantity and rate.', 'error')
      return
    }
    setSaving(true)
    const payload = { ...form, items: cleanItems, default_price: total(cleanItems) }
    if (editing) {
      await supabase.from('packages').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('packages').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    notify(editing ? 'Package updated' : 'Package created')
    load()
  }

  const remove = async (pkg) => {
    const ok = await confirm({
      title: 'Delete package?',
      message: `"${pkg.name}" will be permanently removed.`,
      confirmText: 'Delete',
    })
    if (!ok) return
    await supabase.from('packages').delete().eq('id', pkg.id)
    notify('Package deleted')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Service Packages"
        subtitle="Reusable bundles you can add to invoices and quotations"
        action={
          <button onClick={openNew} className="btn-primary">
            <PlusIcon /> New Package
          </button>
        }
      />

      {loading ? (
        <CardSkeleton count={3} />
      ) : packages.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No packages yet"
          description='Create reusable bundles (e.g. "Wedding Full" = pre-wedding + ceremony + album) to add to invoices in one click.'
          action={
            <button onClick={openNew} className="btn-primary">
              <PlusIcon /> New Package
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{pkg.name}</h3>
                  <p className="text-xs text-gray-500">{pkg.event_type}</p>
                </div>
                <button onClick={() => remove(pkg)} className="text-gray-400 hover:text-red-600">
                  <TrashIcon />
                </button>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                {(pkg.items || []).map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{it.description}</span>
                    <span>{formatCurrency((it.quantity || 0) * (it.rate || 0))}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
                <span className="font-semibold">{formatCurrency(pkg.default_price)}</span>
                <button onClick={() => openEdit(pkg)} className="text-sm font-medium text-brand-600 hover:underline">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Package' : 'New Package'}
        size="lg"
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Package Name *</label>
              <input
                required
                className="input"
                placeholder="e.g. Wedding Full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Event Type</label>
              <SelectWithOther
                options={EVENT_TYPES}
                value={form.event_type}
                onChange={(v) => setForm({ ...form, event_type: v })}
                placeholder="Enter event type"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Included Services</label>
            <LineItemsEditor items={form.items} onChange={(items) => setForm({ ...form, items })} />
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
            <span className="text-lg font-semibold">Total: {formatCurrency(total(form.items))}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Package'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
