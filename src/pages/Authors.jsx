import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { prepareAvatar } from '../lib/avatar'

const SITE = 'https://kmvtechug.app/media'
const LINKS = [
  ['x', 'X (Twitter)'],
  ['facebook', 'Facebook'],
  ['linkedin', 'LinkedIn'],
  ['instagram', 'Instagram'],
  ['website', 'Website'],
]
const EMPTY = { name: '', role: '', bio: '', links: { x: '', facebook: '', linkedin: '', instagram: '', website: '' } }

async function readError(error, data) {
  if (data && data.error) return data.error
  try {
    const body = await error?.context?.json?.()
    if (body && body.error) return body.error
  } catch {
    // fall through
  }
  return "Couldn't reach the authors service. Make sure the manage-authors function has been added in Supabase."
}

const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

function Avatar({ author, preview, size = 'w-12 h-12' }) {
  const [broken, setBroken] = useState(false)
  const src = preview || (author?.photo && !broken ? `${SITE}/assets/authors/${author.photo}` : '')
  if (src) {
    return <img src={src} alt="" onError={() => setBroken(true)} className={`${size} rounded-full object-cover shrink-0 bg-paper-2`} />
  }
  return (
    <div className={`${size} rounded-full bg-red/20 text-red flex items-center justify-center text-sm font-semibold shrink-0`}>
      {initials(author?.name) || '?'}
    </div>
  )
}

export default function Authors() {
  const [authors, setAuthors] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [editing, setEditing] = useState(null) // null | { original: author | null }
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null) // { base64, previewUrl }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke('manage-authors', { body: { action: 'list' } })
    if (error || !data || !Array.isArray(data.authors)) {
      setNotice({ bad: true, text: await readError(error, data) })
    } else {
      setAuthors(data.authors)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startNew() {
    setEditing({ original: null })
    setForm(EMPTY)
    setPhoto(null)
    setNotice(null)
  }

  function startEdit(author) {
    setEditing({ original: author })
    setForm({ name: author.name, role: author.role || '', bio: author.bio || '', links: { ...EMPTY.links, ...(author.links || {}) } })
    setPhoto(null)
    setNotice(null)
  }

  async function choosePhoto(file) {
    if (!file) return
    try {
      setPhoto(await prepareAvatar(file))
      setNotice(null)
    } catch (err) {
      setPhoto(null)
      setNotice({ bad: true, text: err.message })
    }
  }

  async function save() {
    if (form.name.trim().length < 2) {
      setNotice({ bad: true, text: "Please enter the writer's full name." })
      return
    }
    setBusy(true)
    setNotice(null)
    const { data, error } = await supabase.functions.invoke('manage-authors', {
      body: {
        action: 'save',
        name: form.name,
        role: form.role,
        bio: form.bio,
        links: form.links,
        photoBase64: photo?.base64,
        originalSlug: editing.original?.slug,
      },
    })
    setBusy(false)
    if (error || !data || !data.success) {
      setNotice({ bad: true, text: await readError(error, data) })
      return
    }
    setAuthors(data.authors)
    setEditing(null)
    setNotice({ bad: false, text: `Saved ${data.author.name}. The website updates in about a minute.` })
  }

  async function remove() {
    const who = editing.original
    if (!window.confirm(`Delete ${who.name}'s profile and photo?\n\nTheir stories stay on the site. They just won't link to a profile page.`)) return
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('manage-authors', { body: { action: 'delete', slug: who.slug } })
    setBusy(false)
    if (error || !data || !data.success) {
      setNotice({ bad: true, text: await readError(error, data) })
      return
    }
    setAuthors(data.authors)
    setEditing(null)
    setNotice({ bad: false, text: `Deleted ${who.name}.` })
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-3xl">Authors</h1>
        {!editing && (
          <button onClick={startNew} className="text-sm bg-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity">
            + Add an author
          </button>
        )}
      </div>
      <p className="text-text-soft text-sm mb-6">
        A profile gives a writer their photo beside their name on the news cards and stories, plus their own page on
        the website. A story links to a profile when its <strong>Author name</strong> is written exactly as the name
        here.
      </p>

      {notice && (
        <div
          className={`mb-5 text-sm border rounded-md px-4 py-2.5 ${
            notice.bad ? 'bg-red/10 border-red/20 text-red' : 'bg-wire/10 border-wire/20 text-wire'
          }`}
        >
          {notice.text}
        </div>
      )}

      {editing ? (
        <div className="border border-line rounded-lg p-5 space-y-4">
          <h2 className="font-display text-xl">{editing.original ? `Edit ${editing.original.name}` : 'New author'}</h2>

          <div className="flex items-center gap-4">
            <Avatar author={{ name: form.name, photo: editing.original?.photo }} preview={photo?.previewUrl} size="w-20 h-20" />
            <div>
              <label className="text-xs text-text-faint block mb-1">Photo (a square from the middle of the picture is used)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => choosePhoto(e.target.files?.[0])}
                className="text-sm text-text-soft file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-line file:bg-paper-2 file:text-text file:text-xs file:cursor-pointer"
              />
            </div>
          </div>

          <Field label="Full name">
            <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} className={INPUT} />
          </Field>
          <Field label="Role (for example Senior Reporter)">
            <input value={form.role} onChange={(e) => set('role', e.target.value)} maxLength={80} className={INPUT} />
          </Field>
          <Field label={`Short bio (${form.bio.length}/1200)`}>
            <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={4} maxLength={1200} className={INPUT} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            {LINKS.map(([key, label]) => (
              <Field key={key} label={`${label} link (optional)`}>
                <input
                  value={form.links[key]}
                  onChange={(e) => set('links', { ...form.links, [key]: e.target.value })}
                  placeholder="https://…"
                  className={INPUT}
                />
              </Field>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {editing.original ? (
              <button onClick={remove} disabled={busy} className="text-xs text-text-faint hover:text-red transition-colors disabled:opacity-50">
                Delete this profile
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} disabled={busy} className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={save} disabled={busy} className="text-sm bg-red text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : authors.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center">
          <p className="text-text-soft text-sm">No author profiles yet. Add the first one.</p>
        </div>
      ) : (
        <div className="border border-line rounded-lg divide-y divide-line">
          {authors.map((a) => (
            <div key={a.slug} className="flex items-center gap-4 px-4 py-3">
              <Avatar author={a} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-xs text-text-faint truncate">{a.role || 'No role set'}</div>
              </div>
              <a href={`${SITE}/author/${a.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-wire hover:underline shrink-0">
                View page ↗
              </a>
              <button onClick={() => startEdit(a)} className="text-xs border border-line hover:border-text-faint px-3 py-1.5 rounded-md transition-colors shrink-0">
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-text-faint block mb-1">{label}</span>
      {children}
    </label>
  )
}
