import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import PublicationDestinations from '../components/PublicationDestinations'

const STATUS_STYLES = {
  draft: 'bg-white/10 text-text-soft',
  submitted: 'bg-amber/15 text-amber',
  approved: 'bg-wire/15 text-wire',
  published: 'bg-wire/15 text-wire',
  archived: 'bg-white/5 text-text-faint',
}

const FILTERS = ['all', 'draft', 'submitted', 'approved', 'published']

const CHUNK = 50

// A published story is live on the site, so it is removed from the Stories page, never from here.
const canDelete = (d) => d.status !== 'published'

// Explicit provenance replaces the old author-name/timestamp heuristic.
const isUntouchedAuto = (d) =>
  d.is_automated === true &&
  !d.human_modified_at &&
  d.status === 'draft' &&
  !d.review_comment &&
  !d.scheduled_publish_at &&
  !d.published_at

export default function Drafts() {
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNoticeRaw] = useState('')
  const [noticeBad, setNoticeBad] = useState(false)
  const [selected, setSelected] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [scheduleDraftId, setScheduleDraftId] = useState(null)
  const [scheduleAt, setScheduleAt] = useState('')
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [reviewDestinations, setReviewDestinations] = useState(['linkedin', 'facebook', 'x'])
  const [scheduleDestinations, setScheduleDestinations] = useState(['website', 'linkedin', 'facebook', 'x'])

  const setNotice = (message) => {
    setNoticeRaw(message)
    setNoticeBad(false)
  }
  const showBad = (message) => {
    setNoticeRaw(message)
    setNoticeBad(true)
  }

  const canReview = role === 'admin' || role === 'editor'

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('drafts')
      .select('*')
      .order('updated_at', { ascending: false })
    if (!error) setItems(data || [])
    const { data: settings } = await supabase.from('studio_settings').select('scheduled_publication_default_destinations').eq('id', 1).maybeSingle()
    if (Array.isArray(settings?.scheduled_publication_default_destinations)) {
      setScheduleDestinations(['website', ...settings.scheduled_publication_default_destinations.filter((d) => ['linkedin', 'facebook', 'x'].includes(d))])
    }
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

    // Share to LinkedIn, Facebook and X — only for brand-new stories, not edits to live ones.
    let shareProblem = ''
    if (!item.published_at && reviewDestinations.length > 0) {
      try {
        const { data: shareData, error: shareError } = await supabase.functions.invoke('share-to-buffer', {
          body: { title: item.title, excerpt: item.excerpt, slug: item.slug, channels: reviewDestinations },
        })
        if (shareError) {
          shareProblem = ' Social sharing could not be reached.'
        } else {
          const failed = (shareData?.results || []).filter((r) => !r.ok)
          if (failed.length) {
            shareProblem = ` It was not shared to ${failed.map((r) => `${r.channel} (${r.error})`).join('; ')}.`
          }
        }
      } catch {
        shareProblem = ' Social sharing could not be reached.'
      }
    }

    setNotice(`Published "${item.title}".${shareProblem}`)
    load()
  }

  function localDateTimeValue(value) {
    const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000)
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 16)
  }

  async function saveSchedule(item) {
    if (!scheduleAt) return showBad('Choose a date and time for publication.')
    setScheduleBusy(true)
    setNotice('')
    const { data, error } = await supabase.functions.invoke('manage-publication-schedule', {
      body: { draftId: item.id, scheduledAt: new Date(scheduleAt).toISOString(), destinations: scheduleDestinations },
    })
    setScheduleBusy(false)
    if (error || data?.error) {
      let message = data?.error || error?.message || 'Could not schedule this story.'
      if (error?.context) {
        try { const body = await error.context.json(); if (body?.error) message = body.error } catch { /* keep message */ }
      }
      return showBad(message)
    }
    setScheduleDraftId(null)
    setScheduleAt('')
    setNotice(`Scheduled “${item.title}” for ${new Date(data.scheduledAt).toLocaleString()}.`)
    await load()
  }

  async function cancelSchedule(item) {
    if (!window.confirm(`Cancel the scheduled publication of “${item.title}”?`)) return
    setScheduleBusy(true)
    const { data, error } = await supabase.functions.invoke('manage-publication-schedule', {
      body: { draftId: item.id, action: 'cancel' },
    })
    setScheduleBusy(false)
    if (error || data?.error) return showBad(data?.error || error?.message || 'Could not cancel the schedule.')
    setNotice(`Cancelled the scheduled publication of “${item.title}”.`)
    await load()
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

  async function removeDrafts(ids) {
    const removed = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data, error } = await supabase
        .from('drafts')
        .delete()
        .in('id', ids.slice(i, i + CHUNK))
        .select('id')
      if (error) return { removed, error: error.message }
      removed.push(...(data || []).map((r) => r.id))
    }
    return { removed, error: null }
  }

  async function deleteDrafts(list, question) {
    if (list.length === 0 || !window.confirm(question)) return
    setDeleting(true)
    setNotice('')
    const ids = list.map((d) => d.id)
    const { removed, error } = await removeDrafts(ids)
    setDeleting(false)

    if (removed.length) {
      setItems((prev) => prev.filter((d) => !removed.includes(d.id)))
      setSelected((prev) => prev.filter((id) => !removed.includes(id)))
    }
    if (error) {
      showBad(`Something went wrong after deleting ${removed.length} of ${ids.length}: ${error}`)
      return
    }
    // The database can quietly refuse (no error, nothing deleted), so check what really went.
    if (removed.length < ids.length) {
      showBad(
        removed.length
          ? `Deleted ${removed.length} of ${ids.length}. The rest could not be deleted. You may not have permission.`
          : "That didn't go through. You may not have permission to delete drafts."
      )
      return
    }
    setNotice(`Deleted ${removed.length} ${removed.length === 1 ? 'draft' : 'drafts'}.`)
  }

  function deleteOne(item) {
    deleteDrafts([item], `Delete "${item.title}"?\n\nThis removes the draft for good.`)
  }

  function deleteSelected() {
    const list = items.filter((d) => selected.includes(d.id) && canDelete(d))
    const submitted = list.filter((d) => d.status === 'submitted').length
    const warning = submitted ? `\n\n${submitted} of them ${submitted === 1 ? 'is' : 'are'} waiting for review.` : ''
    deleteDrafts(list, `Delete ${list.length} selected ${list.length === 1 ? 'draft' : 'drafts'}?${warning}\n\nThis removes them for good.`)
  }

  function clearAutomatic() {
    const list = items.filter(isUntouchedAuto)
    deleteDrafts(
      list,
      `Delete ${list.length} automatic news ${list.length === 1 ? 'draft' : 'drafts'} that nobody has opened?\n\nDrafts that were edited, sent for review or written by a person are not included.`
    )
  }

  const filtered = filter === 'all' ? items : items.filter((d) => d.status === filter)
  const shownDeletable = filtered.filter(canDelete)
  const allShownSelected = shownDeletable.length > 0 && shownDeletable.every((d) => selected.includes(d.id))
  const selectedCount = items.filter((d) => selected.includes(d.id) && canDelete(d)).length
  const autoCount = items.filter(isUntouchedAuto).length

  function toggleOne(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleAllShown() {
    const ids = shownDeletable.map((d) => d.id)
    setSelected((prev) => (allShownSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]))
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl mb-1">Drafts</h1>
      <p className="text-text-soft text-sm mb-6">Every story that isn't a final, published page yet.</p>

      {notice && (
        <div
          className={`mb-5 text-sm border rounded-md px-4 py-2.5 ${
            noticeBad ? 'bg-red/10 border-red/20 text-red' : 'bg-wire/10 border-wire/20 text-wire'
          }`}
        >
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f)
              setSelected([])
            }}
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

      {canReview && !loading && (shownDeletable.length > 0 || autoCount > 0) && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {shownDeletable.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-text-soft cursor-pointer">
              <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} className="accent-red" />
              Select all shown
            </label>
          )}
          {selectedCount > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="text-xs border border-red/40 text-red hover:bg-red/10 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : `Delete selected (${selectedCount})`}
            </button>
          )}
          {autoCount > 0 && (
            <button
              onClick={clearAutomatic}
              disabled={deleting}
              className="text-xs border border-line hover:border-text-faint px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              Clear automatic drafts nobody opened ({autoCount})
            </button>
          )}
        </div>
      )}

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
                {canReview && canDelete(item) && (
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => toggleOne(item.id)}
                    aria-label={`Select ${item.title}`}
                    className="mr-3 accent-red shrink-0"
                  />
                )}
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
                  {canReview && item.status === 'approved' && !item.published_at && (
                    <button
                      onClick={() => {
                        setScheduleDraftId(scheduleDraftId === item.id ? null : item.id)
                        setScheduleAt(localDateTimeValue(item.scheduled_publish_at))
                        if (Array.isArray(item.scheduled_destinations) && item.scheduled_destinations.length) setScheduleDestinations(['website', ...item.scheduled_destinations.filter((d) => ['linkedin', 'facebook', 'x'].includes(d))])
                      }}
                      className="text-xs border border-line hover:border-text-faint px-2.5 py-1 rounded-md transition-colors"
                    >
                      {item.scheduled_publish_at ? 'Reschedule' : 'Schedule'}
                    </button>
                  )}
                  {canReview && item.scheduled_publish_at && (
                    <button onClick={() => cancelSchedule(item)} disabled={scheduleBusy} className="text-xs border border-amber/40 text-amber hover:bg-amber/10 px-2.5 py-1 rounded-md disabled:opacity-50">
                      Cancel schedule
                    </button>
                  )}
                  {canReview && canDelete(item) && (
                    <button
                      onClick={() => deleteOne(item)}
                      disabled={deleting}
                      className="text-xs border border-red/40 text-red hover:bg-red/10 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {scheduleDraftId === item.id && (
                <div className="px-4 pb-4 bg-white/[0.02] space-y-3">
                  <div>
                    <label className="block text-xs text-text-faint mb-1.5">Publication date and time (your local time)</label>
                    <input type="datetime-local" min={localDateTimeValue(new Date(Date.now() + 60_000).toISOString())} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="bg-paper border border-line rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div className="text-xs text-text-soft">Choose where this story should be published. Website is required; social destinations use the connected Buffer channels.</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                    <label className="flex items-center gap-2"><input type="checkbox" checked disabled className="accent-red" /> Website</label>
                    {['linkedin', 'facebook', 'x'].map((channel) => (
                      <label key={channel} className="flex items-center gap-2 capitalize"><input type="checkbox" checked={scheduleDestinations.includes(channel)} onChange={(e) => setScheduleDestinations((current) => e.target.checked ? [...current, channel] : current.filter((d) => d !== channel))} className="accent-red" /> {channel === 'x' ? 'X' : channel}</label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveSchedule(item)} disabled={scheduleBusy || !scheduleAt} className="text-xs bg-wire/15 text-wire hover:bg-wire/25 px-3 py-1.5 rounded-md disabled:opacity-50">{scheduleBusy ? 'Saving…' : 'Save schedule'}</button>
                    <button onClick={() => setScheduleDraftId(null)} disabled={scheduleBusy} className="text-xs border border-line px-3 py-1.5 rounded-md">Close</button>
                  </div>
                </div>
              )}

              {reviewingId === item.id && (
                <div className="px-4 pb-4 bg-white/[0.02]">
                  <div className="mb-3 border border-line rounded-md p-3">
                    <div className="text-xs font-medium mb-2">Publication destinations</div>
                    <PublicationDestinations value={reviewDestinations} onChange={setReviewDestinations} />
                  </div>
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
