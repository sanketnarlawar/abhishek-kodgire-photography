import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { InvoiceIcon, QuoteIcon, ClientIcon } from './icons'

// Global search across invoices, quotations and clients with a results dropdown.
export default function GlobalSearch({ inputRef }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      const like = `%${q}%`
      const [inv, quo, cli] = await Promise.all([
        supabase.from('invoices').select('id, invoice_number, client:clients(name)').ilike('invoice_number', like).limit(5),
        supabase.from('quotations').select('id, quotation_number, client:clients(name)').ilike('quotation_number', like).limit(5),
        supabase.from('clients').select('id, name').ilike('name', like).limit(5),
      ])
      const list = [
        ...(inv.data || []).map((r) => ({
          type: 'invoice',
          id: r.id,
          label: r.invoice_number,
          sub: r.client?.name || '',
          to: `/invoices/${r.id}`,
          icon: InvoiceIcon,
        })),
        ...(quo.data || []).map((r) => ({
          type: 'quotation',
          id: r.id,
          label: r.quotation_number,
          sub: r.client?.name || '',
          to: `/quotations/${r.id}/edit`,
          icon: QuoteIcon,
        })),
        ...(cli.data || []).map((r) => ({
          type: 'client',
          id: r.id,
          label: r.name,
          sub: 'Client',
          to: `/clients?q=${encodeURIComponent(r.name)}`,
          icon: ClientIcon,
        })),
      ]
      setResults(list)
      setLoading(false)
      setOpen(true)
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  const go = (to) => {
    setOpen(false)
    setQuery('')
    navigate(to)
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <input
        ref={inputRef}
        className="input"
        placeholder="Search invoices, quotes, clients…  ( / )"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">No results</div>
          ) : (
            results.map((r) => {
              const Icon = r.icon
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => go(r.to)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <span className="text-gray-400">
                    <Icon width={16} height={16} />
                  </span>
                  <span className="flex-1 truncate">
                    <span className="font-medium">{r.label}</span>
                    {r.sub && <span className="text-gray-400"> · {r.sub}</span>}
                  </span>
                  <span className="text-xs capitalize text-gray-400">{r.type}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
