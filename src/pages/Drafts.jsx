import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const STATUS_STYLES = {
  draft: 'bg-white/10 text-text-soft',
  submitted: 'bg-amber/15 text-amber',
  approved: 'bg-wire/15 text-wire',
  published: 'bg-wire/15 text-wire',
  archived: 'bg-white/5 text-text-faint',
}

const FILTERS = ['all', 'draft', 'submitted', 'approved', 'published']

export default function Drafts() {
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const canReview = role === 'admin' || role === 'editor'

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('drafts')
      .select('*')
      .order('updated_at', { ascending: false })
    if (!error) setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function notify(userId, message, type = 'info', link = null) {
    if (!userId) return
    await supabase.from('notifications').insert({ user_id: userId, message, type, link })
  }

  async function handleApprove(item) {
    setBusy(true)
    setNotice('')
    const { data, error } = await supabase.functions.invoke('publish-story', {
      body: { draftId: item.id },
    })
    setBusy(false)

    if (error || data?.error) {
      let message = data?.error || error?.message || 'Something went wrong publishing this.'
      if (error?.context) {
        try {
          const body = await error.context.json()
          if (body?.error) message = body.error
        } catch {
          // keep generic message
        }
      }
      setNotice(message)
      return
    }

    await notify(item.created_by, `Your story "${item.title}" was approved and published.`, 'success')
    setNotice(`Published "${item.title}".`)
    load()
  }

  async function handleReturn(item) {
    if (!comment.trim()) {
      setNotice('Add a short note explaining what needs fixing before returning it.')
      return
    }
    setBusy(true)
    setNotice('')

    const { error } = await supabase
      .from('drafts')
      .update({ status: 'draft', review_comment: comment.trim() })
      .eq('id', item.id)

    setBusy(false)

    if (error) {
      setNotice(`Something went wrong: ${error.message}`)
      return
    }

    await notify(item.created_by, `Your story "${item.title}" was returned for revision: "${comment.trim()}"`, 'warning', `/publish/${item.id}`)
    setNotice(`Returned "${item.title}" to the author.`)
    setReviewingId(null)
    setComment('')
    load()
  }

  const filtered = filter === 'all' ? items : items.filter((d) => d.status === filter)

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl mb-1">Drafts</h1>
      <p className="text-text-soft text-sm mb-6">Every story that isn't a final, published page yet.</p>

      {notice && (
        <div className="mb-5 text-sm bg-wire/10 border border-wire/20 text-wire rounded-md px-4 py-2.5">
          {notice}
        </div>
      )}

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
            <div key={item.id}>
              <div className="flex items-center justify-between px-4 py-3.5">
                <Link to={`/publish/${item.id}`} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  <div className="text-xs text-text-faint font-mono mt-0.5">
                    {item.author_name} · {item.category} · {new Date(item.updated_at).toLocaleDateString()}
                  </div>
                  {item.review_comment && item.status === 'draft' && (
                    <div className="text-xs text-amber mt-1">↩ {item.review_comment}</div>
                  )}
                </Link>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span
                    className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded ${
                      STATUS_STYLES[item.status] || ''
                    }`}
                  >
                    {item.status}
                  </span>
                  {canReview && item.status === 'submitted' && (
                    <button
                      onClick={() => setReviewingId(reviewingId === item.id ? null : item.id)}
                      className="text-xs border border-line hover:border-text-faint px-2.5 py-1 rounded-md transition-colors"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>

              {reviewingId === item.id && (
                <div className="px-4 pb-4 bg-white/[0.02]">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={busy}
                      className="text-xs bg-wire/15 text-wire hover:bg-wire/25 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                    >
                      {busy ? 'Working…' : 'Approve & Publish'}
                    </button>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="If returning for revision, explain what needs fixing…"
                    rows={2}
                    className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors mb-2"
                  />
                  <button
                    onClick={() => handleReturn(item)}
                    disabled={busy}
                    className="text-xs border border-amber/40 text-amber hover:bg-amber/10 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                  >
                    Return for revision
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
