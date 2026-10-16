import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import ClientFormModal from '../components/ClientFormModal'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { PlusIcon, TrashIcon, ClientIcon } from '../components/icons'

export default function Clients() {
  const { notify } = useToast()
  const confirm = useConfirm()
  const [searchParams] = useSearchParams()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (client) => {
    setEditing(client)
    setModalOpen(true)
  }

  const remove = async (client) => {
    const ok = await confirm({
      title: 'Delete client?',
      message: `"${client.name}" will be permanently removed.`,
      confirmText: 'Delete',
    })
    if (!ok) return
    await supabase.from('clients').delete().eq('id', client.id)
    notify('Client deleted')
    load()
  }

  const filtered = clients.filter((c) =>
    [c.name, c.phone, c.email].join(' ').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Save and reuse client details"
        action={
          <button onClick={openNew} className="btn-primary">
            <PlusIcon /> New Client
          </button>
        }
      />

      <input
        className="input mb-4 max-w-sm"
        placeholder="Search clients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <TableSkeleton cols={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClientIcon}
          title={search ? 'No matching clients' : 'No clients yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Add your clients once and reuse them on every invoice and quotation.'
          }
          action={
            !search && (
              <button onClick={openNew} className="btn-primary">
                <PlusIcon /> New Client
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((c) => (
                <tr key={c.id} className="row-hover bg-white dark:bg-gray-900/40">
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(c)} className="font-medium text-brand-600 hover:underline">
                      {c.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">{c.phone || '-'}</td>
                  <td className="px-4 py-3">{c.email || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.address || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(c)} className="text-gray-400 hover:text-red-600">
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={() => load()}
      />
    </div>
  )
}
