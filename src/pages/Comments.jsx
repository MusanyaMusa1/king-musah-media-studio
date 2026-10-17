import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const SITE_BASE_URL = 'https://kmvtechug.app/media'

const TABS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export default function Comments() {
  const { user } = useAuth()
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState([])
  const [titles, setTitles] = useState({})
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')

  const refreshCount = useCallback(async () => {
    const { count } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setNotice('')
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('status', tab)
      .order('created_at', { ascending: tab === 'pending' }) // oldest first when waiting, newest first otherwise
      .limit(100)

    if (error) {
      setNotice(`Couldn't load comments: ${error.message}`)
      setItems([])
      setLoading(false)
      return
    }

    setItems(data || [])

    // Show story headlines instead of web-address slugs where we can
    const slugs = [...new Set((data || []).map((c) => c.story_slug))]
    if (slugs.length) {
      const { data: drafts } = await supabase.from('drafts').select('slug, title').in('slug', slugs)
      setTitles(Object.fromEntries((drafts || []).map((d) => [d.slug, d.title])))
    }
    setLoading(false)
  }, [tab])

  useEffect(() => {
    load()
    refreshCount()
  }, [load, refreshCount])

  // Opening this page clears the bell alert about waiting comments
  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('link', '/comments')
      .eq('read', false)
      .then(() => {})
  }, [user])

  async function setStatus(item, status) {
    setBusyId(item.id)
    setNotice('')
    const { data, error } = await supabase
      .from('comments')
      .update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq('id', item.id)
      .select('id')
    setBusyId(null)

    if (error) {
      setNotice(`Something went wrong: ${error.message}`)
      return
    }
    // The database can quietly refuse (no error, nothing changed) — so check a row really changed.
    if (!data || data.length === 0) {
      setNotice("That didn't go through. You may not have permission to moderate comments.")
      return
    }
    setItems((prev) => prev.filter((c) => c.id !== item.id))
    refreshCount()
  }

  async function remove(item) {
    if (!window.confirm('Delete this comment permanently? This cannot be undone.')) return
    setBusyId(item.id)
    setNotice('')
    const { data, error } = await supabase.from('comments').delete().eq('id', item.id).select('id')
    setBusyId(null)

    if (error) {
      setNotice(`Something went wrong: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      setNotice("That didn't go through. You may not have permission to delete comments.")
      return
    }
    setItems((prev) => prev.filter((c) => c.id !== item.id))
    refreshCount()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl mb-1">Comments</h1>
      <p className="text-text-soft text-sm mb-6">
        Readers' comments wait here until you approve them. Nothing shows on the site before that. You
        are publishing whatever you approve, so only approve comments that are respectful and honest.
      </p>

      {notice && (
        <div className="mb-5 text-sm bg-red/10 border border-red/20 text-red rounded-md px-4 py-2.5">
          {notice}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tab === t.key
                ? 'bg-red border-red text-white'
                : 'border-line text-text-soft hover:border-text-faint'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center">
          <p className="text-text-soft text-sm">
            {tab === 'pending' ? 'Nothing waiting. You are all caught up.' : 'Nothing here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="border border-line rounded-lg p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
                <div className="text-sm font-medium">{c.author_name}</div>
                <div className="text-xs text-text-faint font-mono">
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </div>

              <a
                href={`${SITE_BASE_URL}/stories/${c.story_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-wire hover:underline"
              >
                On: {titles[c.story_slug] || c.story_slug} ↗
              </a>

              <p className="text-sm text-text-soft mt-3 whitespace-pre-wrap break-words">{c.body}</p>

              <div className="flex flex-wrap gap-2 mt-4">
                {tab !== 'approved' && (
                  <button
                    onClick={() => setStatus(c, 'approved')}
                    disabled={busyId === c.id}
                    className="text-xs bg-wire/15 text-wire hover:bg-wire/25 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {tab !== 'rejected' && (
                  <button
                    onClick={() => setStatus(c, 'rejected')}
                    disabled={busyId === c.id}
                    className="text-xs border border-amber/40 text-amber hover:bg-amber/10 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                  >
                    {tab === 'approved' ? 'Hide (reject)' : 'Reject'}
                  </button>
                )}
                <button
                  onClick={() => remove(c)}
                  disabled={busyId === c.id}
                  className="text-xs border border-red/40 text-red hover:bg-red/10 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
