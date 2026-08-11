import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Analytics() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('drafts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
      setArticles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <p className="text-text-faint text-sm">Loading…</p>
  }

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - 7)
  const startOfMonth = new Date(now)
  startOfMonth.setDate(now.getDate() - 30)

  const publishedThisWeek = articles.filter((a) => new Date(a.published_at) >= startOfWeek).length
  const publishedThisMonth = articles.filter((a) => new Date(a.published_at) >= startOfMonth).length

  const byCategory = {}
  const byAuthor = {}
  for (const a of articles) {
    byCategory[a.category] = (byCategory[a.category] || 0) + 1
    byAuthor[a.author_name] = (byAuthor[a.author_name] || 0) + 1
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const topAuthors = Object.entries(byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl mb-1">Analytics</h1>
      <p className="text-text-soft text-sm mb-8">
        Publishing activity from inside the Studio. For visitor traffic (page views, top stories by
        reader, locations), check your Google Analytics dashboard directly — connecting that data here
        is a future step that needs its own setup.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total published" value={articles.length} accent="border-text-faint" />
        <StatCard label="Published this week" value={publishedThisWeek} accent="border-wire" />
        <StatCard label="Published this month" value={publishedThisMonth} accent="border-amber" />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-display text-xl mb-3">By category</h2>
          <div className="border border-line rounded-lg divide-y divide-line">
            {topCategories.map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm capitalize">{cat}</span>
                <span className="text-xs font-mono text-text-faint">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl mb-3">Top authors</h2>
          <div className="border border-line rounded-lg divide-y divide-line">
            {topAuthors.map(([author, count]) => (
              <div key={author} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm truncate">{author}</span>
                <span className="text-xs font-mono text-text-faint shrink-0 ml-2">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl mb-3">Recently published</h2>
        <div className="border border-line rounded-lg divide-y divide-line">
          {articles.slice(0, 8).map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm truncate">{a.title}</div>
                <div className="text-xs text-text-faint font-mono mt-0.5">
                  {a.author_name} · {a.category}
                </div>
              </div>
              <span className="text-xs text-text-faint font-mono shrink-0 ml-3">
                {a.published_at ? new Date(a.published_at).toLocaleDateString() : '—'}
              </span>
            </div>
          ))}
        </div>
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
