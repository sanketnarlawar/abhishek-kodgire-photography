import { PlusIcon, TrashIcon } from './icons'
import { formatCurrency } from '../lib/format'

// Reusable editor for service line items. `items` is an array of
// { description, quantity, rate }. Amount is derived (quantity * rate).
export default function LineItemsEditor({ items, onChange }) {
  const update = (index, field, value) => {
    const next = items.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    onChange(next)
  }

  const addRow = () => onChange([...items, { description: '', quantity: 1, rate: 0 }])

  const removeRow = (index) => onChange(items.filter((_, i) => i !== index))

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 font-medium">Service / Description</th>
              <th className="w-20 px-3 py-2 font-medium">Qty</th>
              <th className="w-28 px-3 py-2 font-medium">Rate</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Amount</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item, index) => (
              <tr key={index} className="bg-white dark:bg-gray-900/40">
                <td className="px-3 py-2">
                  <input
                    className="input"
                    placeholder="e.g. Candid Photography"
                    value={item.description}
                    onChange={(e) => update(index, 'description', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={item.quantity}
                    onChange={(e) => update(index, 'quantity', Number(e.target.value))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={item.rate}
                    onChange={(e) => update(index, 'rate', Number(e.target.value))}
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatCurrency((Number(item.quantity) || 0) * (Number(item.rate) || 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  No services added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} className="btn-secondary mt-3">
        <PlusIcon /> Add service
      </button>
    </div>
  )
}
