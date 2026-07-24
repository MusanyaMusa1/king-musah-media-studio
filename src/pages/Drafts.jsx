import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const STATUS_STYLES = {
  draft: 'bg-white/10 text-text-soft',
  submitted: 'bg-amber/15 text-amber',
  approved: 'bg-wire/15 text-wire',
  published: 'bg-wire/15 text-wire',
  archived: 'bg-white/5 text-text-faint',
}

const FILTERS = ['all', 'draft', 'submitted', 'approved', 'published']

export default function Drafts() {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .order('updated_at', { ascending: false })
      if (!error) setItems(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? items : items.filter((d) => d.status === filter)

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl mb-1">Drafts</h1>
      <p className="text-text-soft text-sm mb-6">Every story that isn't a final, published page yet.</p>

      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
              filter === f
                ? 'bg-red border-red text-white'
                : 'border-line text-text-soft hover:border-text-faint'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center">
          <p className="text-text-soft text-sm">Nothing here yet.</p>
        </div>
      ) : (
        <div className="border border-line rounded-lg divide-y divide-line">
          {filtered.map((item) => (
            <Link
              to={`/publish/${item.id}`}
              key={item.id}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="text-xs text-text-faint font-mono mt-0.5">
                  {item.author_name} · {item.category} · {new Date(item.updated_at).toLocaleDateString()}
                </div>
              </div>
              <span
                className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded shrink-0 ml-3 ${
                  STATUS_STYLES[item.status] || ''
                }`}
              >
                {item.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
