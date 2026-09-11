import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const CATEGORIES = ['all', 'news', 'politics', 'entertainment', 'sports', 'business']
const SITE_BASE_URL = 'https://kmvtechug.app/media'

export default function Stories() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
      if (!error) setStories(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = stories.filter((s) => {
    const matchesCategory = category === 'all' || s.category === category
    const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl mb-1">Stories</h1>
      <p className="text-text-soft text-sm mb-6">Every story currently live on the site.</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by headline…"
          className="flex-1 bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors capitalize"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c === 'all' ? 'All categories' : c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center">
          <p className="text-text-soft text-sm">No stories match.</p>
        </div>
      ) : (
        <div className="border border-line rounded-lg divide-y divide-line">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3.5 gap-3">
              <Link to={`/publish/${s.id}`} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                <div className="text-sm font-medium truncate">{s.title}</div>
                <div className="text-xs text-text-faint font-mono mt-0.5 capitalize">
                  {s.category} · {s.author_name} · {s.published_at ? new Date(s.published_at).toLocaleDateString() : '—'}
                </div>
              </Link>
              <a
                href={`${SITE_BASE_URL}/stories/${s.slug}.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-wire hover:underline shrink-0"
              >
                View live ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
