import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = ['all', 'news', 'politics', 'entertainment', 'sports', 'business', 'international']
const SITE_BASE_URL = 'https://kmvtechug.app/media'

// When the function answers with an error, its message is inside the reply.
async function readError(error, data) {
  if (data && data.error) return data.error
  try {
    const body = await error?.context?.json?.()
    if (body && body.error) return body.error
  } catch {
    // fall through
  }
  return 'Something went wrong. Please try again.'
}

export default function Stories() {
  const { role } = useAuth()
  const canCorrect = role === 'admin' || role === 'editor'
  const [correcting, setCorrecting] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
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

  function openCorrection(story) {
    setCorrecting(story)
    setNote('')
    setResult(null)
  }

  async function sendCorrection(action) {
    if (action === 'undo-correction' && !window.confirm('Remove the latest correction from this story?')) return
    setBusy(true)
    setResult(null)
    const { data, error } = await supabase.functions.invoke('publish-story', {
      body: { draftId: correcting.id, action, note: action === 'correct' ? note.trim() : undefined },
    })
    setBusy(false)
    if (error || !data || !data.success) {
      setResult({ bad: true, text: await readError(error, data) })
      return
    }
    if (action === 'correct') setNote('')
    setResult({
      bad: false,
      text:
        action === 'correct'
          ? 'Correction saved. It appears at the top of the story after the website rebuilds, in about a minute.'
          : `Removed. This story now has ${data.corrections} ${data.corrections === 1 ? 'correction' : 'corrections'}.`,
    })
  }

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
                href={`${SITE_BASE_URL}/stories/${s.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-wire hover:underline shrink-0"
              >
                View live ↗
              </a>
              {canCorrect && (
                <button
                  onClick={() => openCorrection(s)}
                  className="text-xs border border-line hover:border-text-faint px-2.5 py-1 rounded-md transition-colors shrink-0"
                >
                  Correct
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {correcting && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => !busy && setCorrecting(null)}>
          <div className="bg-ink border border-line rounded-lg max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl mb-1">Add a correction</h2>
            <p className="text-sm text-text-soft mb-1 truncate">{correcting.title}</p>
            <p className="text-xs text-text-faint mb-4">
              This shows a "Correction" note at the top of the story and lists it on the public Corrections page. Say
              what was wrong and what it is now.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="e.g. An earlier version gave the wrong date for the hearing. It is on 14 November."
              className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
            />
            <div className="text-xs text-text-faint text-right mt-1">{note.length}/600</div>

            {result && (
              <div
                className={`mt-3 text-sm border rounded-md px-3 py-2 ${
                  result.bad ? 'bg-red/10 border-red/20 text-red' : 'bg-wire/10 border-wire/20 text-wire'
                }`}
              >
                {result.text}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <button
                onClick={() => sendCorrection('undo-correction')}
                disabled={busy}
                className="text-xs text-text-faint hover:text-red transition-colors disabled:opacity-50"
              >
                Remove the latest correction
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setCorrecting(null)}
                  disabled={busy}
                  className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  onClick={() => sendCorrection('correct')}
                  disabled={busy || note.trim().length < 5}
                  className="text-sm bg-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Publish correction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
