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
  const [loadingDraft, setLoadingDraft] = useState(!!id)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

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
          content: data.content || '',
          tags: (data.tags || []).join(', '),
        })
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
    if (status !== 'draft' && !validate()) return
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
      content: form.content,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status,
    }

    let error
    if (id) {
      ;({ error } = await supabase.from('drafts').update(payload).eq('id', id))
    } else {
      ;({ error } = await supabase.from('drafts').insert({ ...payload, created_by: user?.id }))
    }
    setSaving(false)

    if (error) {
      setNotice(`Something went wrong saving this: ${error.message}`)
      return
    }

    if (status === 'draft') {
      setNotice('Saved as a draft.')
    } else {
      navigate('/drafts')
    }
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
        <div className="mb-6 text-sm bg-wire/10 border border-wire/20 text-wire rounded-md px-4 py-2.5">
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

        <Field label="Image" hint="Coming in Phase 2 — for now, upload photos the same way you do today.">
          <div className="border border-dashed border-line rounded-md px-4 py-6 text-center text-text-faint text-sm">
            Image upload isn't wired up yet
          </div>
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
          onClick={() => saveDraft('submitted')}
          disabled={saving}
          className="text-sm bg-amber hover:bg-amber/90 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          Submit for review
        </button>
        <button
          onClick={() => saveDraft('published')}
          disabled={saving}
          className="text-sm bg-red hover:bg-red/90 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 ml-auto"
        >
          Publish
        </button>
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
