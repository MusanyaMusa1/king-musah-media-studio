import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError('Email or password not recognized. Check both and try again.')
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-ink text-text flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display text-3xl tracking-wide">King Musah Media</div>
          <div className="text-xs font-mono uppercase tracking-widest text-text-faint mt-1">Studio</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-paper border border-line rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-xs text-text-faint mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-paper-2 border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
              placeholder="you@kingmusahmedia.com"
            />
          </div>

          <div>
            <label className="block text-xs text-text-faint mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-paper-2 border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-red transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-xs text-red bg-red/10 border border-red/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red hover:bg-red/90 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-text-faint mt-5">
          Accounts are created by an Administrator. Contact your editor if you need access.
        </p>
      </div>
    </div>
  )
}
