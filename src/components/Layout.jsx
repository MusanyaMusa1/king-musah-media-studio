import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: ['admin', 'editor', 'reporter'] },
  { to: '/publish', label: 'Publish Story', roles: ['admin', 'editor', 'reporter'] },
  { to: '/stories', label: 'Stories', roles: ['admin', 'editor', 'reporter'] },
  { to: '/drafts', label: 'Drafts', roles: ['admin', 'editor', 'reporter'] },
  { to: '/media', label: 'Media Library', roles: ['admin', 'editor'] },
  { to: '/users', label: 'Users', roles: ['admin'] },
  { to: '/analytics', label: 'Analytics', roles: ['admin', 'editor'] },
  { to: '/settings', label: 'Settings', roles: ['admin'] },
]

export default function Layout({ children }) {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-ink text-text">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-line flex flex-col">
        <div className="px-5 py-6 border-b border-line">
          <div className="font-display text-xl tracking-wide">King Musah Media</div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-text-faint mt-0.5">Studio</div>
        </div>

        <nav className="flex-1 py-3">
          {NAV_ITEMS.filter((item) => !role || item.roles.includes(role)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'text-white bg-white/[0.06] border-l-2 border-red font-medium'
                    : 'text-text-soft border-l-2 border-transparent hover:text-white hover:bg-white/[0.03]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-line">
          <div className="text-sm font-medium truncate">{profile?.display_name || '...'}</div>
          <div className="text-xs text-text-faint capitalize mb-3">{role || '...'}</div>
          <button
            onClick={handleSignOut}
            className="text-xs text-text-faint hover:text-red transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <StatusTicker />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}

function StatusTicker() {
  // Phase 1: static "system nominal" readout. In Phase 3 this becomes a live
  // feed of GitHub Actions build status (queued / building / live / failed),
  // echoing the breaking-news ticker on the public site — but reporting on
  // the system itself instead of the news.
  return (
    <div className="h-9 shrink-0 border-b border-line bg-paper flex items-center px-5 gap-2 font-mono text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-wire pulse-dot" />
      <span className="text-text-faint uppercase tracking-widest">System</span>
      <span className="text-text-soft">All systems nominal · GitHub sync ready</span>
    </div>
  )
}
