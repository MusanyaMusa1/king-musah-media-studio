import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const STATUS = {
  draft: ['Draft', 'bg-white/10 text-text-soft'],
  approved: ['Approved', 'bg-amber/15 text-amber'],
  sending: ['Sending', 'bg-amber/15 text-amber'],
  sent: ['Sent', 'bg-wire/15 text-wire'],
}
const COLUMNS = 'id, kind, slug, title, status, scheduled_at, period_start, period_end, content, approved_at, sent_at, recipients_sent, recipients_failed'

async function readError(error, data) {
  if (data && data.error) return data.error
  try {
    const body = await error?.context?.json?.()
    if (body && body.error) return body.error
  } catch {
    // fall through
  }
  return "Couldn't reach the newsletter service. Make sure the newsletter function has been added in Supabase."
}

// Uganda is UTC+3 all year. The time box works in Uganda time.
const toEatInput = (iso) => new Date(new Date(iso).getTime() + 3 * 3600e3).toISOString().slice(0, 16)
const fromEatInput = (text) => new Date(`${text}:00+03:00`).toISOString()
const showWhen = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Kampala', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'not set'

const norm = (c) => ({
  editorsNote: c?.editorsNote || '',
  lead: c?.lead || null,
  sections: Array.isArray(c?.sections) ? c.sections : [],
  analysis: { title: c?.analysis?.title || '', body: c?.analysis?.body || '' },
  luganda: Array.isArray(c?.luganda) ? c.luganda : [],
})

function countStories(c) {
  return (c.lead ? 1 : 0) + c.sections.reduce((n, s) => n + (s.items?.length || 0), 0) + c.luganda.length
}

export default function Editions() {
  const { user } = useAuth()
  const [issues, setIssues] = useState([])
  const [views, setViews] = useState({})
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState(norm())
  const [when, setWhen] = useState('')
  const [preview, setPreview] = useState(null)

  const issue = issues.find((i) => i.id === openId) || null
  const locked = !!issue && issue.status !== 'draft'

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('newsletter_issues').select(COLUMNS).order('scheduled_at', { ascending: false }).limit(100)
    if (error) {
      setNotice({ bad: true, text: `Couldn't load editions: ${error.message}` })
      setIssues([])
    } else {
      setIssues(data || [])
    }
    const v = await supabase.from('newsletter_edition_views').select('issue_id').limit(5000)
    const counts = {}
    for (const row of v.data || []) counts[row.issue_id] = (counts[row.issue_id] || 0) + 1
    setViews(counts)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function open(i) {
    setOpenId(i.id)
    setTitle(i.title)
    setContent(norm(i.content))
    setWhen(i.scheduled_at ? toEatInput(i.scheduled_at) : '')
    setNotice(null)
    setPreview(null)
  }

  async function engine(body) {
    const { data, error } = await supabase.functions.invoke('newsletter', { body })
    if (error || !data || data.error) return { error: await readError(error, data) }
    return { data }
  }

  async function newDraft(kind) {
    setBusy('new')
    setNotice(null)
    const r = await engine({ action: 'create-draft', kind })
    setBusy('')
    if (r.error) return setNotice({ bad: true, text: r.error })
    // Open the draft we were just handed (even if the list has not caught up yet), THEN say what happened.
    // (Opening an edition clears the message, so the message must come last.)
    const made = r.data.issue
    setIssues((prev) => (prev.some((i) => i.id === made.id) ? prev : [made, ...prev]))
    open(made)
    setNotice({ bad: false, text: r.data.exists ? 'That edition already exists, so it is open for you.' : `Draft created: ${made.title}.` })
  }

  async function saveDraft(extra = {}) {
    const patch = { title: title.trim() || issue.title, content, scheduled_at: when ? fromEatInput(when) : issue.scheduled_at, ...extra }
    const { data, error } = await supabase.from('newsletter_issues').update(patch).eq('id', issue.id).select('id')
    if (error) return `Could not save: ${error.message}`
    if (!data || data.length === 0) return "That didn't save. The edition may already be on its way, or you may not have permission."
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, ...patch } : i)))
    return null
  }

  async function save() {
    setBusy('save')
    const problem = await saveDraft()
    setBusy('')
    setNotice(problem ? { bad: true, text: problem } : { bad: false, text: 'Saved.' })
  }

  async function approve() {
    if (!when) return setNotice({ bad: true, text: 'Please choose when this edition should be sent.' })
    if (countStories(content) === 0 && !window.confirm('This edition has no stories in it. Approve it anyway?')) return
    const sendAt = fromEatInput(when)
    const late = new Date(sendAt) <= new Date()
    const kindCol = issue.kind === 'monthly' ? 'wants_monthly' : 'wants_weekly'
    const { count } = await supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active').eq(kindCol, true)
    const question = `Approve "${title.trim() || issue.title}"?\n\nIt will be emailed to ${count ?? 'all'} active ${issue.kind} subscribers${late ? ' within about 15 minutes, because that time has already passed' : ` on ${showWhen(sendAt)}`}.\n\nYou can still take it back to a draft until it starts sending.`
    if (!window.confirm(question)) return
    setBusy('approve')
    const problem = await saveDraft({ status: 'approved', scheduled_at: sendAt, approved_by: user.id, approved_at: new Date().toISOString() })
    setBusy('')
    setNotice(problem ? { bad: true, text: problem } : { bad: false, text: `Approved. It will be sent ${late ? 'shortly' : showWhen(sendAt)}.` })
  }

  async function unapprove() {
    setBusy('approve')
    const { data, error } = await supabase.from('newsletter_issues').update({ status: 'draft', approved_by: null, approved_at: null }).eq('id', issue.id).select('id')
    setBusy('')
    if (error || !data || data.length === 0) return setNotice({ bad: true, text: "Couldn't take it back. It may have started sending already." })
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status: 'draft' } : i)))
    setNotice({ bad: false, text: 'Back to a draft. Nothing will be sent until you approve it again.' })
  }

  async function refreshStories() {
    if (!window.confirm("Refresh the stories from the website?\n\nYour editor's note and analysis are kept, but any stories you removed or reordered come back.")) return
    setBusy('refresh')
    const r = await engine({ action: 'rebuild', issueId: issue.id })
    setBusy('')
    if (r.error) return setNotice({ bad: true, text: r.error })
    setContent(norm(r.data.issue.content))
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, content: r.data.issue.content } : i)))
    setNotice({ bad: false, text: 'Stories refreshed from the website.' })
  }

  async function showPreview(variant) {
    const problem = await saveDraft()
    if (problem) return setNotice({ bad: true, text: problem })
    setBusy('preview')
    const r = await engine({ action: 'preview', issueId: issue.id, variant })
    setBusy('')
    if (r.error) return setNotice({ bad: true, text: r.error })
    setPreview({ html: r.data.html, variant })
  }

  async function testEmail(variant) {
    const problem = await saveDraft()
    if (problem) return setNotice({ bad: true, text: problem })
    setBusy('test')
    const r = await engine({ action: 'test-send', issueId: issue.id, variant })
    setBusy('')
    setNotice(r.error ? { bad: true, text: r.error } : { bad: false, text: `A test email was sent to ${r.data.sentTo}. Check your inbox (and spam).` })
  }

  async function deleteDraft() {
    if (!window.confirm(`Delete the draft "${issue.title}"?\n\nThis cannot be undone.`)) return
    setBusy('delete')
    const { data, error } = await supabase.from('newsletter_issues').delete().eq('id', issue.id).select('id')
    setBusy('')
    if (error || !data || data.length === 0) return setNotice({ bad: true, text: "That didn't go through. Only drafts can be deleted." })
    setIssues((prev) => prev.filter((i) => i.id !== issue.id))
    setOpenId(null)
    setNotice({ bad: false, text: 'Draft deleted.' })
  }

  // ---------------- editing the story lists
  const setSection = (si, items) => setContent((c) => ({ ...c, sections: c.sections.map((s, i) => (i === si ? { ...s, items } : s)) }))
  const listOf = (si) => (si === 'lg' ? content.luganda : content.sections[si].items)
  function writeList(si, items) {
    if (si === 'lg') setContent((c) => ({ ...c, luganda: items }))
    else setSection(si, items)
  }
  function move(si, idx, dir) {
    const list = [...listOf(si)]
    const to = idx + dir
    if (to < 0 || to >= list.length) return
    ;[list[idx], list[to]] = [list[to], list[idx]]
    writeList(si, list)
  }
  const remove = (si, idx) => writeList(si, listOf(si).filter((_, i) => i !== idx))
  function makeLead(si, idx) {
    const list = [...listOf(si)]
    const chosen = list[idx]
    if (content.lead) list[idx] = content.lead // the old lead takes the promoted story's place: nothing is lost
    else list.splice(idx, 1)
    writeList(si, list)
    setContent((c) => ({ ...c, lead: chosen }))
  }

  const sectionsWithItems = useMemo(() => content.sections.map((s, si) => ({ ...s, si })).filter((s) => (s.items || []).length > 0), [content])

  // ======================================================== the list
  if (!issue) {
    return (
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h1 className="font-display text-3xl">Editions</h1>
          <div className="flex gap-2">
            <button onClick={() => newDraft('weekly')} disabled={!!busy} className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50">
              + New weekly draft
            </button>
            <button onClick={() => newDraft('monthly')} disabled={!!busy} className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50">
              + New monthly draft
            </button>
          </div>
        </div>
        <p className="text-text-soft text-sm mb-6">
          The system prepares a draft on Friday evening (weekly) and on the last day of the month (monthly) and tells you.
          Review it, add your note and analysis, then approve it. <strong>Nothing is ever sent until you approve it.</strong>
        </p>

        {notice && <Notice notice={notice} />}

        {loading ? (
          <p className="text-text-faint text-sm">Loading…</p>
        ) : issues.length === 0 ? (
          <div className="border border-dashed border-line rounded-lg p-10 text-center">
            <p className="text-text-soft text-sm">No editions yet. The first draft appears on Friday evening, or create one now.</p>
          </div>
        ) : (
          <div className="border border-line rounded-lg divide-y divide-line">
            {issues.map((i) => (
              <button key={i.id} onClick={() => open(i)} className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-white/5 transition-colors">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="text-sm font-medium truncate">{i.title}</div>
                  <div className="text-xs text-text-faint">
                    {i.kind === 'monthly' ? 'Monthly' : 'Weekly'} · {i.status === 'sent' ? `sent ${showWhen(i.sent_at)}` : `to go ${showWhen(i.scheduled_at)}`}
                  </div>
                </div>
                {i.status === 'sent' && (
                  <div className="text-xs text-text-faint">
                    {i.recipients_sent} sent{i.recipients_failed ? `, ${i.recipients_failed} failed` : ''} · {views[i.id] || 0} opened online
                  </div>
                )}
                <span className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded ${STATUS[i.status]?.[1] || ''}`}>{STATUS[i.status]?.[0] || i.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ======================================================== one edition
  const frozen = locked || issue.status === 'approved'
  return (
    <div className="max-w-3xl">
      <button onClick={() => { setOpenId(null); setNotice(null) }} className="text-xs text-text-faint hover:text-white mb-3">
        ← All editions
      </button>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="font-display text-2xl">{issue.title}</h1>
        <span className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded ${STATUS[issue.status]?.[1] || ''}`}>{STATUS[issue.status]?.[0]}</span>
      </div>
      <p className="text-xs text-text-faint mb-5">
        {issue.kind === 'monthly' ? 'Monthly' : 'Weekly'} edition · stories from {issue.period_start} to {issue.period_end}
      </p>

      {notice && <Notice notice={notice} />}

      {issue.status === 'sent' || issue.status === 'sending' ? (
        <div className="mb-5 border border-line rounded-lg p-4 text-sm">
          <div>{issue.status === 'sending' ? 'This edition is being sent now.' : `Sent ${showWhen(issue.sent_at)}.`}</div>
          <div className="text-text-soft mt-1">
            {issue.recipients_sent} emailed{issue.recipients_failed ? `, ${issue.recipients_failed} could not be emailed` : ''} · {views[issue.id] || 0} opened it online
          </div>
        </div>
      ) : (
        <div className="mb-5 border border-line rounded-lg p-4 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-xs text-text-faint block mb-1">Send at (Uganda time)</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={frozen} className={INPUT} />
          </label>
          {issue.status === 'draft' ? (
            <button onClick={approve} disabled={!!busy} className="text-sm bg-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">
              Approve and schedule
            </button>
          ) : (
            <>
              <span className="text-sm text-amber">Approved. It will be sent {showWhen(issue.scheduled_at)}.</span>
              <button onClick={unapprove} disabled={!!busy} className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50">
                Take back to a draft
              </button>
            </>
          )}
        </div>
      )}

      {issue.status === 'approved' && <p className="text-xs text-text-faint mb-5">To change anything, take it back to a draft first.</p>}

      <div className="space-y-5">
        <Field label="Edition title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={frozen} maxLength={140} className={INPUT} />
        </Field>

        <Field label="Editor's note (a few warm sentences at the top. Leave a blank line between paragraphs.)">
          <textarea value={content.editorsNote} onChange={(e) => setContent((c) => ({ ...c, editorsNote: e.target.value }))} disabled={frozen} rows={4} className={INPUT} />
        </Field>

        <div className="border border-line rounded-lg p-4 space-y-3">
          <div className="text-xs text-text-faint">Analysis (the editor's own piece. Only paying subscribers will read it.)</div>
          <input value={content.analysis.title} onChange={(e) => setContent((c) => ({ ...c, analysis: { ...c.analysis, title: e.target.value } }))} disabled={frozen} placeholder="Heading, e.g. What the budget means for you" className={INPUT} />
          <textarea value={content.analysis.body} onChange={(e) => setContent((c) => ({ ...c, analysis: { ...c.analysis, body: e.target.value } }))} disabled={frozen} rows={6} placeholder="Write the analysis here…" className={INPUT} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-lg">Stories ({countStories(content)})</h2>
            {issue.status === 'draft' && (
              <button onClick={refreshStories} disabled={!!busy} className="text-xs border border-line hover:border-text-faint px-3 py-1.5 rounded-md transition-colors disabled:opacity-50">
                Refresh from the website
              </button>
            )}
          </div>

          <div className="border border-line rounded-lg divide-y divide-line">
            <div className="px-4 py-3">
              <div className="text-[11px] font-mono uppercase tracking-wide text-red mb-1">Lead story</div>
              {content.lead ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm flex-1 min-w-0 truncate">{content.lead.title}</span>
                  {issue.status === 'draft' && <button onClick={() => setContent((c) => ({ ...c, lead: null }))} className="text-xs text-text-faint hover:text-red">Remove</button>}
                </div>
              ) : (
                <div className="text-xs text-text-faint">No lead story. Use "Make lead" on a story below.</div>
              )}
            </div>

            {sectionsWithItems.map((s) => (
              <StoryList key={s.key} title={s.title} items={s.items} editable={issue.status === 'draft'} onMove={(i, d) => move(s.si, i, d)} onRemove={(i) => remove(s.si, i)} onLead={(i) => makeLead(s.si, i)} />
            ))}
            {content.luganda.length > 0 && (
              <StoryList title="Luganda" items={content.luganda} editable={issue.status === 'draft'} onMove={(i, d) => move('lg', i, d)} onRemove={(i) => remove('lg', i)} onLead={(i) => makeLead('lg', i)} />
            )}
            {countStories(content) === 0 && <div className="px-4 py-6 text-sm text-text-faint text-center">No stories yet. Try "Refresh from the website".</div>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-line">
        {issue.status === 'draft' && (
          <>
            <button onClick={save} disabled={!!busy} className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50">
              {busy === 'save' ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={() => showPreview('full')} disabled={!!busy} className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50">Preview</button>
            <button onClick={() => showPreview('headlines')} disabled={!!busy} className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50">Preview headlines version</button>
            <button onClick={() => testEmail('full')} disabled={!!busy} className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50">
              {busy === 'test' ? 'Sending…' : 'Send me a test email'}
            </button>
            <button onClick={deleteDraft} disabled={!!busy} className="ml-auto text-xs text-text-faint hover:text-red transition-colors disabled:opacity-50">
              Delete this draft
            </button>
          </>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setPreview(null)}>
          <div className="bg-ink border border-line rounded-lg max-w-2xl w-full max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <span className="text-sm">{preview.variant === 'headlines' ? 'Headlines version (non-paying subscribers)' : 'Full edition (paying subscribers)'}</span>
              <button onClick={() => setPreview(null)} className="text-sm text-text-faint hover:text-white">Close</button>
            </div>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="w-full flex-1 bg-white rounded-b-lg" style={{ minHeight: '70vh' }} />
          </div>
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors disabled:opacity-60'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-text-faint block mb-1">{label}</span>
      {children}
    </label>
  )
}

function Notice({ notice }) {
  return (
    <div className={`mb-5 text-sm border rounded-md px-4 py-2.5 ${notice.bad ? 'bg-red/10 border-red/20 text-red' : 'bg-wire/10 border-wire/20 text-wire'}`}>{notice.text}</div>
  )
}

function StoryList({ title, items, editable, onMove, onRemove, onLead }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] font-mono uppercase tracking-wide text-red mb-1">{title}</div>
      <ul className="space-y-1">
        {items.map((it, idx) => (
          <li key={it.slug} className="flex items-center gap-2 text-sm">
            <span className="flex-1 min-w-0 truncate">{it.title}</span>
            {editable && (
              <span className="flex items-center gap-1 shrink-0 text-xs">
                <button onClick={() => onLead(idx)} className="px-2 py-0.5 border border-line rounded hover:border-text-faint" aria-label={`Make ${it.title} the lead`}>Make lead</button>
                <button onClick={() => onMove(idx, -1)} disabled={idx === 0} className="px-1.5 text-text-faint hover:text-white disabled:opacity-30" aria-label={`Move ${it.title} up`}>↑</button>
                <button onClick={() => onMove(idx, 1)} disabled={idx === items.length - 1} className="px-1.5 text-text-faint hover:text-white disabled:opacity-30" aria-label={`Move ${it.title} down`}>↓</button>
                <button onClick={() => onRemove(idx)} className="px-1.5 text-text-faint hover:text-red" aria-label={`Remove ${it.title}`}>✕</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
