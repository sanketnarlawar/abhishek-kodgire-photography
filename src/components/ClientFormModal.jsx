import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import { useToast } from '../contexts/ToastContext'

const emptyForm = { name: '', phone: '', email: '', address: '' }

// Create/edit a client in a modal. Calls onSaved(client) with the saved row.
export default function ClientFormModal({ open, onClose, editing, onSaved }) {
  const { notify } = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name || '',
            phone: editing.phone || '',
            email: editing.email || '',
            address: editing.address || '',
          }
        : emptyForm
    )
  }, [open, editing])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    let result
    if (editing) {
      const { data } = await supabase.from('clients').update(form).eq('id', editing.id).select().single()
      result = data
    } else {
      const { data } = await supabase.from('clients').insert(form).select().single()
      result = data
    }
    setSaving(false)
    notify(editing ? 'Client updated' : 'Client added')
    onSaved?.(result)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Client' : 'New Client'}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input
            required
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <textarea
            rows={2}
            className="input"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
