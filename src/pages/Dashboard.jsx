import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ draft: 0, submitted: 0, published: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setStats({
          draft: data.filter((d) => d.status === 'draft').length,
          submitted: data.filter((d) => d.status === 'submitted').length,
          published: data.filter((d) => d.status === 'published').length,
        })
        setRecent(data.slice(0, 6))
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl mb-1">Dashboard</h1>
      <p className="text-text-soft text-sm mb-8">
        Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Drafts in progress" value={stats.draft} accent="border-text-faint" />
        <StatCard label="Awaiting review" value={stats.submitted} accent="border-amber" />
        <StatCard label="Published" value={stats.published} accent="border-wire" />
      </div>

      <Link
        to="/publish"
        className="inline-block bg-red hover:bg-red/90 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors mb-10"
      >
        + Publish a story
      </Link>

      <div>
        <h2 className="font-display text-xl mb-3">Recent activity</h2>
        {loading ? (
          <p className="text-text-faint text-sm">Loading…</p>
        ) : recent.length === 0 ? (
          <div className="border border-dashed border-line rounded-lg p-8 text-center">
            <p className="text-text-soft text-sm">Nothing here yet.</p>
            <p className="text-text-faint text-xs mt-1">
              Stories you save, submit, or publish will show up here.
            </p>
          </div>
        ) : (
          <div className="border border-line rounded-lg divide-y divide-line">
            {recent.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm truncate">{item.title}</div>
                  <div className="text-xs text-text-faint font-mono mt-0.5">
                    {item.category} · {new Date(item.updated_at).toLocaleString()}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`bg-paper border border-line border-t-2 ${accent} rounded-lg px-4 py-4`}>
      <div className="font-display text-3xl">{value}</div>
      <div className="text-xs text-text-faint mt-1">{label}</div>
    </div>
  )
}

const STATUS_STYLES = {
  draft: 'bg-white/10 text-text-soft',
  submitted: 'bg-amber/15 text-amber',
  approved: 'bg-wire/15 text-wire',
  published: 'bg-wire/15 text-wire',
  archived: 'bg-white/5 text-text-faint',
}

function StatusBadge({ status }) {
  return (
    <span className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded ${STATUS_STYLES[status] || ''}`}>
      {status}
    </span>
  )
}
