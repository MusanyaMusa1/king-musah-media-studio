import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = ['news', 'politics', 'entertainment', 'sports', 'business']
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'lg', label: 'Luganda' }]

export default function Settings() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('studio_settings').select('*').eq('id', 1).single()
      setSettings(data)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setNotice('')

    const { error } = await supabase
      .from('studio_settings')
      .update({
        site_name: settings.site_name,
        contact_email: settings.contact_email,
        default_category: settings.default_category,
        default_language: settings.default_language,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    setSaving(false)

    if (error) {
      setNotice(`Something went wrong: ${error.message}`)
      return
    }
    setNotice('Saved.')
  }

  if (loading) return <p className="text-text-faint text-sm">Loading…</p>
  if (!settings) return <p className="text-text-faint text-sm">Couldn't load settings.</p>

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl mb-1">Settings</h1>
      <p className="text-text-soft text-sm mb-6">
        Studio-wide defaults. {!isAdmin && 'Only admins can change these.'}
      </p>

      {notice && (
        <div className="mb-5 text-sm bg-wire/10 border border-wire/20 text-wire rounded-md px-4 py-2.5">
          {notice}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-xs text-text-faint mb-1.5">Site name</label>
          <input
            type="text"
            disabled={!isAdmin}
            value={settings.site_name}
            onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs text-text-faint mb-1.5">Contact email</label>
          <input
            type="email"
            disabled={!isAdmin}
            value={settings.contact_email}
            onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs text-text-faint mb-1.5">Default category for new stories</label>
          <select
            disabled={!isAdmin}
            value={settings.default_category}
            onChange={(e) => setSettings({ ...settings, default_category: e.target.value })}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors capitalize disabled:opacity-50"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-text-faint mb-1.5">Default language</label>
          <select
            disabled={!isAdmin}
            value={settings.default_language}
            onChange={(e) => setSettings({ ...settings, default_language: e.target.value })}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors disabled:opacity-50"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <button
            type="submit"
            disabled={saving}
            className="text-sm bg-red hover:bg-red/90 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        )}
      </form>

      <p className="text-xs text-text-faint mt-8">
        Note: these are currently reference defaults — the Publish Story form doesn't
        auto-apply them yet. Wiring that in is a small follow-up if you want it.
      </p>
    </div>
  )
}
