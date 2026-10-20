import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const LOAD_LIMIT = 5000
const SHOW_LIMIT = 200

const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Waiting to confirm' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
  { key: 'all', label: 'All' },
]

const STATUS_STYLES = {
  active: 'bg-wire/15 text-wire',
  pending: 'bg-amber/15 text-amber',
  unsubscribed: 'bg-white/5 text-text-faint',
}

// A spreadsheet treats a cell starting with = + - @ as a formula, which someone could abuse
// through a sign-up name. A leading apostrophe makes it plain text.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

function buildCsv(rows) {
  const header = ['Name', 'Email', 'Phone', 'Weekly', 'Monthly', 'Agreed to offers', 'Status', 'Joined', 'Confirmed']
  const lines = rows.map((r) =>
    [
      r.full_name,
      r.email,
      r.phone,
      r.wants_weekly ? 'yes' : 'no',
      r.wants_monthly ? 'yes' : 'no',
      r.marketing_opt_in ? 'yes' : 'no',
      r.status,
      r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
      r.confirmed_at ? new Date(r.confirmed_at).toISOString().slice(0, 10) : '',
    ]
      .map(csvCell)
      .join(',')
  )
  // The leading mark makes Excel read names with accents correctly.
  return '\uFEFF' + [header.join(','), ...lines].join('\r\n')
}

export default function Newsletter() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [statusTab, setStatusTab] = useState('active')
  const [edition, setEdition] = useState('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select(
        'id, full_name, email, phone, wants_weekly, wants_monthly, marketing_opt_in, status, created_at, confirmed_at, unsubscribed_at'
      )
      .order('created_at', { ascending: false })
      .limit(LOAD_LIMIT)

    if (error) {
      setNotice(`Couldn't load subscribers: ${error.message}`)
      setRows([])
    } else {
      setNotice('')
      setRows(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === 'active')
    return {
      active: active.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      unsubscribed: rows.filter((r) => r.status === 'unsubscribed').length,
      weekly: active.filter((r) => r.wants_weekly).length,
      monthly: active.filter((r) => r.wants_monthly).length,
      both: active.filter((r) => r.wants_weekly && r.wants_monthly).length,
      offers: active.filter((r) => r.marketing_opt_in).length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusTab !== 'all' && r.status !== statusTab) return false
      if (edition === 'weekly' && !r.wants_weekly) return false
      if (edition === 'monthly' && !r.wants_monthly) return false
      if (edition === 'both' && !(r.wants_weekly && r.wants_monthly)) return false
      if (!q) return true
      return [r.full_name, r.email, r.phone].some((v) => (v || '').toLowerCase().includes(q))
    })
  }, [rows, statusTab, edition, search])

  function exportCsv() {
    const blob = new Blob([buildCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function erase(row) {
    if (
      !window.confirm(
        `Permanently erase ${row.full_name} (${row.email})?\n\nThis removes all their details. Do this when someone asks for their data to be deleted. It cannot be undone.`
      )
    )
      return
    setBusyId(row.id)
    setNotice('')
    const { data, error } = await supabase.from('newsletter_subscribers').delete().eq('id', row.id).select('id')
    setBusyId(null)

    if (error) {
      setNotice(`Something went wrong: ${error.message}`)
      return
    }
    // The database can quietly refuse (no error, nothing changed) — so check a row really went.
    if (!data || data.length === 0) {
      setNotice("That didn't go through. You may not have permission to erase subscribers.")
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
  }

  const shown = filtered.slice(0, SHOW_LIMIT)

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl mb-1">Newsletter</h1>
      <p className="text-text-soft text-sm mb-6">
        People who signed up on the website. Everyone is on the free period until 31 December 2026. A person is
        only emailed after they click the confirmation link.
      </p>

      {notice && (
        <div className="mb-5 text-sm bg-red/10 border border-red/20 text-red rounded-md px-4 py-2.5">{notice}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Active subscribers" value={stats.active} accent="border-wire" />
        <Stat label="Waiting to confirm" value={stats.pending} accent="border-amber" />
        <Stat label="Unsubscribed" value={stats.unsubscribed} accent="border-text-faint" />
        <Stat label="Agreed to offers" value={stats.offers} accent="border-line" />
        <Stat label="Weekly" value={stats.weekly} accent="border-line" />
        <Stat label="Monthly" value={stats.monthly} accent="border-line" />
        <Stat label="Both editions" value={stats.both} accent="border-line" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusTab === t.key ? 'bg-red border-red text-white' : 'border-line text-text-soft hover:border-text-faint'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="flex-1 bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
        />
        <select
          value={edition}
          onChange={(e) => setEdition(e.target.value)}
          className="bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
        >
          <option value="all">All editions</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="both">Both</option>
        </select>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-40"
        >
          Export spreadsheet
        </button>
      </div>

      {loading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center">
          <p className="text-text-soft text-sm">
            {rows.length === 0 ? 'No one has signed up yet.' : 'No one matches these filters.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-faint mb-2">
            Showing {shown.length} of {filtered.length}
            {filtered.length > SHOW_LIMIT ? '. Narrow the search, or export everything.' : ''}
          </p>
          <div className="border border-line rounded-lg divide-y divide-line">
            {shown.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="text-sm font-medium truncate">{r.full_name}</div>
                  <div className="text-xs text-text-faint font-mono truncate">{r.email}</div>
                  {r.phone && <div className="text-xs text-text-faint font-mono">{r.phone}</div>}
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  {r.wants_weekly && <span className="px-2 py-0.5 rounded bg-white/10 text-text-soft">Weekly</span>}
                  {r.wants_monthly && <span className="px-2 py-0.5 rounded bg-white/10 text-text-soft">Monthly</span>}
                  {r.marketing_opt_in && <span className="px-2 py-0.5 rounded bg-white/5 text-text-faint">Offers</span>}
                </div>
                <span
                  className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded ${STATUS_STYLES[r.status] || ''}`}
                >
                  {r.status === 'pending' ? 'waiting' : r.status}
                </span>
                <div className="text-xs text-text-faint font-mono w-24">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                </div>
                <button
                  onClick={() => erase(r)}
                  disabled={busyId === r.id}
                  className="text-xs border border-red/40 text-red hover:bg-red/10 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                >
                  Erase
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {rows.length >= LOAD_LIMIT && (
        <p className="text-xs text-text-faint mt-4">Showing the newest {LOAD_LIMIT} sign-ups.</p>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className={`bg-paper border border-line border-t-2 ${accent} rounded-lg px-4 py-3`}>
      <div className="font-display text-2xl">{value}</div>
      <div className="text-xs text-text-faint mt-0.5">{label}</div>
    </div>
  )
}
