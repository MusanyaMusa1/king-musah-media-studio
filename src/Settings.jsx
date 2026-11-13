import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = ['news', 'politics', 'entertainment', 'sports', 'business', 'international']
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'lg', label: 'Luganda' }]
const SOCIAL = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X' },
]

const DEFAULTS = {
  auto_publish_enabled: false,
  auto_publish_review_hours: 4,
  auto_publish_destinations: ['website'],
  auto_delete_enabled: false,
  auto_delete_retention_days: 3,
  scheduled_publication_default_destinations: ['website', 'linkedin', 'facebook', 'x'],
}

function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="mt-1 accent-red" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-text-faint mt-0.5">{description}</span>}
      </span>
    </label>
  )
}

function DestinationChecks({ value, onChange, disabled = false, allowTelegram = false }) {
  const options = [{ value: 'website', label: 'Website' }, ...SOCIAL, ...(allowTelegram ? [{ value: 'telegram', label: 'Telegram' }] : [])]
  const selected = Array.isArray(value) ? value : []
  function toggle(item, checked) {
    onChange(checked ? [...new Set([...selected, item])] : selected.filter((x) => x !== item))
  }
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {options.map((item) => (
        <label key={item.value} className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={selected.includes(item.value)} disabled={disabled} onChange={(e) => toggle(item.value, e.target.checked)} className="accent-red" />
          {item.label}
        </label>
      ))}
    </div>
  )
}

export default function Settings() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeBad, setNoticeBad] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('studio_settings').select('*').eq('id', 1).single()
      if (!error && data) {
        setSettings({
          ...DEFAULTS,
          ...data,
          auto_publish_destinations: Array.isArray(data.auto_publish_destinations) ? data.auto_publish_destinations : DEFAULTS.auto_publish_destinations,
          scheduled_publication_default_destinations: Array.isArray(data.scheduled_publication_default_destinations)
            ? data.scheduled_publication_default_destinations
            : DEFAULTS.scheduled_publication_default_destinations,
        })
      }
      setLoading(false)
      if (error) {
        setNotice(`Couldn't load settings: ${error.message}`)
        setNoticeBad(true)
      }
    }
    load()
  }, [])

  function update(field, value) {
    setSettings((current) => ({ ...current, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!isAdmin) return
    if (!settings.auto_publish_destinations.length) {
      setNotice('Select at least one Auto Publish destination.')
      setNoticeBad(true)
      return
    }
    if (!settings.scheduled_publication_default_destinations.length) {
      setNotice('Select at least one default Scheduled Publication destination.')
      setNoticeBad(true)
      return
    }
    setSaving(true)
    setNotice('')
    setNoticeBad(false)

    const { error } = await supabase.from('studio_settings').update({
      site_name: settings.site_name,
      contact_email: settings.contact_email,
      default_category: settings.default_category,
      default_language: settings.default_language,
      auto_publish_enabled: !!settings.auto_publish_enabled,
      auto_publish_review_hours: Number(settings.auto_publish_review_hours),
      auto_publish_destinations: settings.auto_publish_destinations,
      auto_delete_enabled: !!settings.auto_delete_enabled,
      auto_delete_retention_days: Number(settings.auto_delete_retention_days),
      scheduled_publication_default_destinations: settings.scheduled_publication_default_destinations,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)

    setSaving(false)
    if (error) {
      setNotice(`Something went wrong: ${error.message}`)
      setNoticeBad(true)
      return
    }
    setNotice('Settings saved. Automation switches only take effect when the server-side worker is deployed and configured.')
  }

  if (loading) return <p className="text-text-faint text-sm">Loading…</p>
  if (!settings) return <p className="text-text-faint text-sm">Couldn't load settings.</p>

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl mb-1">Settings</h1>
      <p className="text-text-soft text-sm mb-6">Studio-wide defaults. {!isAdmin && 'Only admins can change these.'}</p>

      {notice && <div className={`mb-5 text-sm border rounded-md px-4 py-2.5 ${noticeBad ? 'bg-red/10 border-red/20 text-red' : 'bg-wire/10 border-wire/20 text-wire'}`}>{notice}</div>}

      <form onSubmit={handleSave} className="space-y-8">
        <section className="space-y-5">
          <h2 className="font-display text-xl border-b border-line pb-2">General</h2>
          <div>
            <label className="block text-xs text-text-faint mb-1.5">Site name</label>
            <input type="text" disabled={!isAdmin} value={settings.site_name || ''} onChange={(e) => update('site_name', e.target.value)} className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs text-text-faint mb-1.5">Contact email</label>
            <input type="email" disabled={!isAdmin} value={settings.contact_email || ''} onChange={(e) => update('contact_email', e.target.value)} className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs text-text-faint mb-1.5">Default category for new stories</label>
            <select disabled={!isAdmin} value={settings.default_category || 'news'} onChange={(e) => update('default_category', e.target.value)} className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors capitalize disabled:opacity-50">
              {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-faint mb-1.5">Default language</label>
            <select disabled={!isAdmin} value={settings.default_language || 'en'} onChange={(e) => update('default_language', e.target.value)} className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors disabled:opacity-50">
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="font-display text-xl">Automation</h2>
            <p className="text-xs text-text-faint mt-1">These controls are global and admin-only. Both switches are OFF by default.</p>
          </div>
          <div className="border border-line rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">Auto Publish</h3>
              <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded ${settings.auto_publish_enabled ? 'bg-amber/15 text-amber' : 'bg-white/10 text-text-faint'}`}>{settings.auto_publish_enabled ? 'Enabled' : 'Off'}</span>
            </div>
            <Toggle checked={settings.auto_publish_enabled} onChange={(v) => update('auto_publish_enabled', v)} disabled={!isAdmin} label="Allow eligible automatic drafts to publish after review time" description="Only trusted, untouched, eligible news-feed drafts should qualify. This requires the server worker and editorial-policy update." />
            <div>
              <label className="block text-xs text-text-faint mb-1.5">Review window (hours)</label>
              <input type="number" min="1" max="168" disabled={!isAdmin} value={settings.auto_publish_review_hours} onChange={(e) => update('auto_publish_review_hours', e.target.value)} className="w-32 bg-paper border border-line rounded-md px-3 py-2 text-sm disabled:opacity-50" />
              <p className="text-xs text-text-faint mt-1">Default: 4 hours after the draft is created.</p>
            </div>
            <div>
              <label className="block text-xs text-text-faint mb-2">Auto Publish destinations</label>
              <DestinationChecks value={settings.auto_publish_destinations} onChange={(v) => update('auto_publish_destinations', v)} disabled={!isAdmin} />
              <p className="text-xs text-text-faint mt-1">Default: Website only.</p>
            </div>
          </div>

          <div className="border border-line rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">Auto Delete</h3>
              <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded ${settings.auto_delete_enabled ? 'bg-amber/15 text-amber' : 'bg-white/10 text-text-faint'}`}>{settings.auto_delete_enabled ? 'Enabled' : 'Off'}</span>
            </div>
            <Toggle checked={settings.auto_delete_enabled} onChange={(v) => update('auto_delete_enabled', v)} disabled={!isAdmin} label="Remove eligible untouched automatic drafts after retention period" description="Manual, edited, submitted, approved, scheduled and published stories must never be deleted by this setting." />
            <div>
              <label className="block text-xs text-text-faint mb-1.5">Retention period (days)</label>
              <input type="number" min="1" max="365" disabled={!isAdmin} value={settings.auto_delete_retention_days} onChange={(e) => update('auto_delete_retention_days', e.target.value)} className="w-32 bg-paper border border-line rounded-md px-3 py-2 text-sm disabled:opacity-50" />
              <p className="text-xs text-text-faint mt-1">Default: 3 days from draft creation.</p>
            </div>
          </div>

          <div className="border border-line rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Scheduled Publication defaults</h3>
            <p className="text-xs text-text-faint">Scheduling is independent of Auto Publish and Auto Delete. These defaults apply only to new schedules; existing schedules keep their saved destinations.</p>
            <DestinationChecks value={settings.scheduled_publication_default_destinations} onChange={(v) => update('scheduled_publication_default_destinations', v)} disabled={!isAdmin} allowTelegram />
            <p className="text-xs text-text-faint">Default: Website, LinkedIn, Facebook and X. Telegram is available only when its connection is configured.</p>
          </div>
        </section>

        {isAdmin && <button type="submit" disabled={saving} className="text-sm bg-red hover:bg-red/90 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50">{saving ? 'Saving…' : 'Save settings'}</button>}
      </form>

      {isAdmin && <p className="text-sm text-text-soft mt-10 border-t border-line pt-6 max-w-xl">To test your connections (the website, GitHub, LinkedIn, Facebook, X, Telegram, email and the AI), open <Link to="/system" className="text-red underline">System check</Link>.</p>}
    </div>
  )
}
