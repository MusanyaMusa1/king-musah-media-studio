import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function handleOpen() {
    setOpen((v) => !v)
  }

  async function handleClick(n) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    }
    if (n.link) {
      navigate(n.link)
      setOpen(false)
    }
  }

  const TYPE_DOT = {
    info: 'bg-text-faint',
    success: 'bg-wire',
    warning: 'bg-amber',
    error: 'bg-red',
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative text-text-faint hover:text-text transition-colors"
        title="Notifications"
      >
        &#128276;
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 max-h-96 overflow-y-auto bg-paper border border-line rounded-lg shadow-lg z-50">
          <div className="px-4 py-2.5 border-b border-line text-xs font-mono uppercase tracking-widest text-text-faint">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-faint">Nothing yet.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-white/[0.03] transition-colors ${
                  !n.read ? 'bg-white/[0.02]' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TYPE_DOT[n.type] || TYPE_DOT.info}`} />
                  <div>
                    <div className="text-xs text-text-soft leading-relaxed">{n.message}</div>
                    <div className="text-[10px] text-text-faint font-mono mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
