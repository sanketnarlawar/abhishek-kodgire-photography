// A dropdown that reveals a free-text input when "Other" is selected.
// The custom text becomes the actual stored value (not the word "Other").
export default function SelectWithOther({
  value,
  onChange,
  options,
  otherValue = 'Other',
  placeholder = 'Enter a value',
  required = false,
}) {
  const concrete = options.filter((o) => o !== otherValue)
  const isOther = !concrete.includes(value)
  const selectValue = isOther ? otherValue : value

  return (
    <>
      <select
        className="input"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value
          // Clear the value when switching to "Other" so the user can type.
          onChange(v === otherValue ? '' : v)
        }}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {isOther && (
        <input
          className="input mt-2"
          placeholder={placeholder}
          required={required}
          value={value === otherValue ? '' : value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </>
  )
}
