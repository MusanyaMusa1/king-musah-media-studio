import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ROLE_STYLES = {
  admin: 'bg-red/15 text-red',
  editor: 'bg-amber/15 text-amber',
  reporter: 'bg-white/10 text-text-soft',
}

export default function Users() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('editor')
  const [inviting, setInviting] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')

  async function loadProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at')
    if (!error) setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    setNotice('')

    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, displayName, role },
    })

    setInviting(false)

    if (error || data?.error) {
      let message = data?.error || error?.message || 'Something went wrong sending the invite.'
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

    setNotice(`Invite sent to ${email}. They'll get an email to set their password.`)
    setNoticeType('success')
    setEmail('')
    setDisplayName('')
    setRole('editor')
    setShowInvite(false)
    loadProfiles()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-3xl">Users</h1>
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="text-sm bg-red hover:bg-red/90 text-white px-4 py-2 rounded-md transition-colors"
        >
          {showInvite ? 'Cancel' : '+ Invite User'}
        </button>
      </div>
      <p className="text-text-soft text-sm mb-6">Everyone with access to the Studio.</p>

      {notice && (
        <div
          className={`mb-6 text-sm rounded-md px-4 py-2.5 border ${
            noticeType === 'error'
              ? 'bg-red/10 border-red/20 text-red'
              : 'bg-wire/10 border-wire/20 text-wire'
          }`}
        >
          {notice}
        </div>
      )}

      {showInvite && (
        <form onSubmit={handleInvite} className="bg-paper border border-line rounded-lg p-5 mb-6 space-y-4">
          <div>
            <label className="block text-xs text-text-faint mb-1.5">Full name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-paper-2 border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
              placeholder="e.g. Grace Namutebi"
            />
          </div>
          <div>
            <label className="block text-xs text-text-faint mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-paper-2 border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
              placeholder="them@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-text-faint mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-paper-2 border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
            >
              <option value="reporter">Reporter</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="text-sm bg-red hover:bg-red/90 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {inviting ? 'Sending invite…' : 'Send invite'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : (
        <div className="border border-line rounded-lg divide-y divide-line">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className="text-sm font-medium">{p.display_name}</div>
                <div className="text-xs text-text-faint font-mono">{p.email}</div>
              </div>
              <span className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded capitalize ${ROLE_STYLES[p.role] || ''}`}>
                {p.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
