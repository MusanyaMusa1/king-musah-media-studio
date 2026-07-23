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

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (!error) setProfiles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl mb-1">Users</h1>
      <p className="text-text-soft text-sm mb-6">Everyone with access to the Studio.</p>

      {loading ? (
        <p className="text-text-faint text-sm">Loading…</p>
      ) : (
        <div className="border border-line rounded-lg divide-y divide-line mb-6">
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

      <div className="border border-dashed border-line rounded-lg p-6 text-sm text-text-faint">
        <strong className="text-text-soft">Inviting new users comes in Phase 2.</strong> Creating an account
        requires a secure server-side action (a Supabase Edge Function), since it needs elevated permissions
        that can never be exposed in the browser. For now, new team members can be added directly in your
        Supabase dashboard under Authentication → Users.
      </div>
    </div>
  )
}
