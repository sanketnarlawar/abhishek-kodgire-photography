import { PlusIcon, TrashIcon } from './icons'
import ItemCombobox from './ItemCombobox'

// Keeps only digits and a single decimal point.
const cleanDecimal = (v) => v.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*$/, '$1')

// Editable table of object rows. columns: [{ key, label, type, options, placeholder, width }]
// where type is 'text' (default), 'date', 'amount', 'select' or 'combo' (text input with suggestions).
export default function RowsEditor({ rows, columns, onChange, emptyRow, addLabel, emptyText }) {
  const update = (index, key, value) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)))

  const renderInput = (row, index, col) => {
    const value = row[col.key] ?? ''
    if (col.type === 'select') {
      return (
        <select className="input text-sm" value={value} onChange={(e) => update(index, col.key, e.target.value)}>
          {col.blank && <option value="">{col.blankLabel || '—'}</option>}
          {col.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )
    }
    if (col.type === 'combo') {
      return (
        <ItemCombobox
          value={value}
          onChange={(v) => update(index, col.key, v)}
          itemsList={col.options.map((name) => ({ name }))}
          placeholder={col.placeholder}
          listTitle="Saved Steps"
          matchTitle="Matching Steps"
          newBadge="New step"
          limit={20}
        />
      )
    }
    if (col.type === 'amount') {
      return (
        <input
          type="text"
          inputMode="decimal"
          placeholder={col.placeholder || '0.00'}
          className="input text-right text-sm"
          value={value}
          onChange={(e) => update(index, col.key, cleanDecimal(e.target.value))}
        />
      )
    }
    return (
      <input
        type={col.type === 'date' ? 'date' : 'text'}
        placeholder={col.placeholder}
        className="input text-sm"
        value={value}
        onChange={(e) => update(index, col.key, e.target.value)}
      />
    )
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-800">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-3 py-2 font-medium ${col.width || ''}`}>
                  {col.label}
                </th>
              ))}
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, index) => (
              <tr key={index} className="bg-white dark:bg-gray-900/40">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2">
                    {renderInput(row, index, col)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    className="text-gray-400 hover:text-red-600"
                    title="Remove row"
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-4 text-center text-gray-500">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onChange([...rows, emptyRow()])} className="btn-secondary mt-3">
        <PlusIcon /> {addLabel}
      </button>
    </div>
  )
}
