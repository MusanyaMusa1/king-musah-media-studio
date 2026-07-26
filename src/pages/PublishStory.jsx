import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = ['news', 'politics', 'entertainment', 'sports', 'business']

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

const emptyForm = {
  title: '',
  category: 'news',
  language: 'en',
  author_type: 'individual',
  author_name: '',
  date: new Date().toISOString().slice(0, 10),
  breaking: false,
  featured: false,
  excerpt: '',
  image_alt: '',
  content: '',
  tags: '',
}

export default function PublishStory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [form, setForm] = useState(emptyForm)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(!!id)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)

  useEffect(() => {
    if (!id) return
    async function loadDraft() {
      setLoadingDraft(true)
      const { data, error } = await supabase.from('drafts').select('*').eq('id', id).single()
      if (!error && data) {
        setForm({
          title: data.title || '',
          category: data.category || 'news',
          language: data.language || 'en',
          author_type: data.author_type || 'individual',
          author_name: data.author_type === 'newsdesk' ? '' : data.author_name || '',
          date: data.date || new Date().toISOString().slice(0, 10),
          breaking: !!data.breaking,
          featured: !!data.featured,
          excerpt: data.excerpt || '',
          image_alt: data.image_alt || '',
          content: data.content || '',
          tags: (data.tags || []).join(', '),
        })
        setIsLive(!!data.published_at)
      } else {
        setNotice("Couldn't load that draft. It may have been deleted.")
      }
      setLoadingDraft(false)
    }
    loadDraft()
  }, [id])

  function wrapSelection(field, openTag, closeTag) {
    const el = document.getElementById(`${field}-textarea`)
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const value = form[field]
    const selected = value.slice(start, end) || 'text'
    const newValue = value.slice(0, start) + openTag + selected + closeTag + value.slice(end)
    update(field, newValue)
    requestAnimationFrame(() => {
      el.focus()
      const cursorPos = start + openTag.length + selected.length + closeTag.length
      el.setSelectionRange(cursorPos, cursorPos)
    })
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function validate() {
    const e = {}
    if (!form.title.trim()) e.title = 'Headline is required.'
    if (!form.excerpt.trim()) e.excerpt = 'Excerpt is required — this shows on story cards.'
    if (!form.content.trim()) e.content = 'Story body is required.'
    if (form.author_type === 'individual' && !form.author_name.trim()) {
      e.author_name = 'Enter the journalist\u2019s name, or switch to "News Desk".'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function saveDraft(status) {
    if (status !== 'draft' && !validate()) return null
    setSaving(true)
    setNotice('')

    const authorName = form.author_type === 'newsdesk' ? 'King Musah Media News Desk' : form.author_name

    const payload = {
      slug: slugify(form.title) || null,
      title: form.title,
      category: form.category,
      language: form.language,
      author_type: form.author_type,
      author_name: authorName,
      date: form.date,
      breaking: form.breaking,
      featured: form.featured,
      excerpt: form.excerpt,
      image_alt: form.image_alt,
      content: form.content,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status,
    }

    let error, draftId = id
    if (id) {
      ;({ error } = await supabase.from('drafts').update(payload).eq('id', id))
    } else {
      const result = await supabase.from('drafts').insert({ ...payload, created_by: user?.id }).select('id').single()
      error = result.error
      draftId = result.data?.id
    }
    setSaving(false)

    if (error) {
      setNotice(`Something went wrong saving this: ${error.message}`)
      setNoticeType('error')
      return null
    }

    if (status === 'draft') {
      setNotice('Saved as a draft.')
      setNoticeType('info')
    }

    return draftId
  }

  async function handlePublish() {
    if (!validate()) return
    setNotice('')

    // Save (or update) the draft first, so the Edge Function has the latest text
    const draftId = await saveDraft('submitted')
    if (!draftId) return

    setPublishing(true)

    let imageBase64 = null
    let imageExt = null
    if (imageFile) {
      imageExt = imageFile.name.split('.').pop().toLowerCase()
      const buffer = await imageFile.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      bytes.forEach((b) => (binary += String.fromCharCode(b)))
      imageBase64 = btoa(binary)
    }

    const { data, error } = await supabase.functions.invoke('publish-story', {
      body: { draftId, imageBase64, imageExt },
    })

    setPublishing(false)

    if (error || data?.error) {
      let message = data?.error || error?.message || 'Something went wrong publishing this.'
      if (error?.context) {
        try {
          const body = await error.context.json()
          if (body?.error) message = body.error
        } catch {
          // context wasn't JSON — fall back to the generic message
        }
      }
      setNotice(message)
      setNoticeType('error')
      return
    }

    setNotice(`Published! It'll appear on the live site within about a minute, once GitHub finishes rebuilding.`)
    setNoticeType('success')
    setTimeout(() => navigate('/drafts'), 2500)
  }

  async function handleDelete() {
    if (!id) return
    if (!window.confirm('Remove this story from the live site? This cannot be undone from here.')) return
    setDeleting(true)
    setNotice('')

    const { data, error } = await supabase.functions.invoke('publish-story', {
      body: { draftId: id, action: 'delete' },
    })

    setDeleting(false)

    if (error || data?.error) {
      let message = data?.error || error?.message || 'Something went wrong removing this.'
      if (error?.context) {
        try {
          const body = await error.context.json()
          if (body?.error) message = body.error
        } catch {
          // not JSON — keep the generic message
        }
      }
      setNotice(message)
      setNoticeType('error')
      return
    }

    setNotice('Removed from the live site. This will disappear within about a minute.')
    setNoticeType('success')
    setIsLive(false)
    setTimeout(() => navigate('/drafts'), 2000)
  }

  if (loadingDraft) {
    return <p className="text-text-faint text-sm">Loading draft…</p>
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl mb-1">{id ? 'Edit Story' : 'Publish Story'}</h1>
      <p className="text-text-soft text-sm mb-8">
        {id
          ? 'Changes save to this same draft — nothing is duplicated.'
          : 'Fill this in, then save a draft, submit it for review, or publish directly if you have permission.'}
      </p>

      {notice && (
        <div
          className={`mb-6 text-sm rounded-md px-4 py-2.5 border ${
            noticeType === 'error'
              ? 'bg-red/10 border-red/20 text-red'
              : noticeType === 'success'
              ? 'bg-wire/10 border-wire/20 text-wire'
              : 'bg-wire/10 border-wire/20 text-wire'
          }`}
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        <Field label="Headline" error={errors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className={inputClass(errors.title)}
            placeholder="Full story headline"
          />
        </Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className={inputClass()}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Language">
            <select
              value={form.language}
              onChange={(e) => update('language', e.target.value)}
              className={inputClass()}
            >
              <option value="en">English</option>
              <option value="lg">Luganda</option>
            </select>
          </Field>
        </div>

        <Field label="Date" hint="The date shown on the story. Defaults to today — change it if you're backdating or scheduling.">
          <input
            type="date"
            value={form.date}
            onChange={(e) => update('date', e.target.value)}
            className={inputClass()}
          />
        </Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Author">
            <select
              value={form.author_type}
              onChange={(e) => update('author_type', e.target.value)}
              className={inputClass()}
            >
              <option value="individual">Individual journalist</option>
              <option value="newsdesk">King Musah Media News Desk</option>
            </select>
          </Field>

          {form.author_type === 'individual' && (
            <Field label="Journalist name" error={errors.author_name}>
              <input
                type="text"
                value={form.author_name}
                onChange={(e) => update('author_name', e.target.value)}
                className={inputClass(errors.author_name)}
                placeholder="e.g. Musanya Musa"
              />
            </Field>
          )}
        </div>

        <div className="flex gap-6">
          <Toggle label="Breaking" checked={form.breaking} onChange={(v) => update('breaking', v)} />
          <Toggle label="Featured (homepage lead)" checked={form.featured} onChange={(v) => update('featured', v)} />
        </div>

        <Field label="Excerpt" hint="One or two sentences shown on story cards." error={errors.excerpt}>
          <textarea
            value={form.excerpt}
            onChange={(e) => update('excerpt', e.target.value)}
            rows={2}
            className={inputClass(errors.excerpt)}
          />
        </Field>

        <Field label="Story body" hint="One paragraph per line. Select text and click Bold to emphasize a word or lead-in phrase." error={errors.content}>
          <div className="flex items-center gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => wrapSelection('content', '<strong>', '</strong>')}
              className="text-xs font-bold border border-line hover:border-text-faint w-7 h-7 rounded flex items-center justify-center transition-colors"
              title="Bold selected text"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('content', '<em>', '</em>')}
              className="text-xs italic border border-line hover:border-text-faint w-7 h-7 rounded flex items-center justify-center transition-colors"
              title="Italicize selected text"
            >
              i
            </button>
          </div>
          <textarea
            id="content-textarea"
            value={form.content}
            onChange={(e) => update('content', e.target.value)}
            rows={12}
            className={inputClass(errors.content) + ' font-mono text-sm leading-relaxed'}
            placeholder={'First paragraph...\n\nSecond paragraph...'}
          />
        </Field>

        <Field label="Tags" hint="Comma-separated, e.g. Kampala, Infrastructure, Traffic">
          <input
            type="text"
            value={form.tags}
            onChange={(e) => update('tags', e.target.value)}
            className={inputClass()}
          />
        </Field>

        <Field label="Image alt text" hint="A short description of the photo, for accessibility and search engines.">
          <input
            type="text"
            value={form.image_alt}
            onChange={(e) => update('image_alt', e.target.value)}
            className={inputClass()}
            placeholder="e.g. President Museveni addressing Parliament"
          />
        </Field>

        <Field label="Photo" hint="JPG, PNG, or WEBP. Uploads with the story when you click Publish.">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              setImageFile(file || null)
              setImagePreviewUrl(file ? URL.createObjectURL(file) : null)
            }}
            className="text-sm text-text-soft file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-line file:bg-paper-2 file:text-text file:text-xs file:cursor-pointer"
          />
          {imagePreviewUrl && (
            <img src={imagePreviewUrl} alt="" className="mt-3 rounded-md max-h-48 object-cover" />
          )}
        </Field>
      </div>

      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={() => setPreview(true)}
          className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors"
        >
          Preview
        </button>
        <button
          onClick={() => saveDraft('draft')}
          disabled={saving}
          className="text-sm border border-line hover:border-text-faint px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          onClick={async () => {
            const draftId = await saveDraft('submitted')
            if (draftId) navigate('/drafts')
          }}
          disabled={saving}
          className="text-sm bg-amber hover:bg-amber/90 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          Submit for review
        </button>
        <button
          onClick={handlePublish}
          disabled={saving || publishing}
          className="text-sm bg-red hover:bg-red/90 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 ml-auto"
        >
          {publishing ? 'Publishing…' : isLive ? 'Update live story' : 'Publish'}
        </button>
        {isLive && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm border border-red/40 text-red hover:bg-red/10 px-4 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove from site'}
          </button>
        )}
      </div>

      {preview && <PreviewModal form={form} onClose={() => setPreview(false)} />}
    </div>
  )
}

function Field({ label, hint, error, children }) {
  return (
    <div>
      <label className="block text-xs text-text-faint mb-1.5">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-text-faint mt-1">{hint}</p>}
      {error && <p className="text-xs text-red mt-1">{error}</p>}
    </div>
  )
}

function inputClass(error) {
  return `w-full bg-paper border rounded-md px-3 py-2 text-sm outline-none transition-colors ${
    error ? 'border-red' : 'border-line focus:border-red'
  }`
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-red"
      />
      {label}
    </label>
  )
}

function PreviewModal({ form, onClose }) {
  const authorName = form.author_type === 'newsdesk' ? 'King Musah Media News Desk' : form.author_name || '—'
  const paragraphs = form.content.split('\n').filter((p) => p.trim())

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div
        className="bg-ink border border-line rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <span className="inline-block bg-red text-white text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded">
            {form.category || 'news'}
          </span>
          <button onClick={onClose} className="text-text-faint hover:text-white text-sm">
            Close
          </button>
        </div>
        <h1 className="font-display text-4xl mb-3 leading-tight">{form.title || 'Untitled story'}</h1>
        <div className="text-xs text-text-faint mb-6 font-mono">
          {authorName} · {form.language === 'lg' ? 'Luganda' : 'English'}
          {form.breaking && ' · BREAKING'}
        </div>
        <div className="space-y-4 text-[15px] leading-relaxed text-text-soft">
          {paragraphs.length ? (
            paragraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p className="text-text-faint italic">No story body yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
