const CHANNELS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X' },
  { value: 'telegram', label: 'Telegram (if configured)' },
]

export default function PublicationDestinations({ value = [], onChange, disabled = false, includeTelegram = true }) {
  const selected = Array.isArray(value) ? value : []
  const options = includeTelegram ? CHANNELS : CHANNELS.filter((item) => item.value !== 'telegram')
  function toggle(channel, checked) {
    onChange(checked ? [...new Set([...selected, channel])] : selected.filter((item) => item !== channel))
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-text-faint">Website is always included. Choose any social destinations:</div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((item) => (
          <label key={item.value} className={`flex items-center gap-2 text-xs ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={selected.includes(item.value)} disabled={disabled} onChange={(e) => toggle(item.value, e.target.checked)} className="accent-red" />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  )
}
