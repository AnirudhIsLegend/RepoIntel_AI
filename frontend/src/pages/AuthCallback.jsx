import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertTriangle, GitBranch } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { handleCallback } = useAuth()
  const [error, setError] = useState('')
  // Prevent double-execution caused by React StrictMode mounting effects twice
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
      setError('Missing authorization parameters. Please try logging in again.')
      return
    }

    // Validate state on the frontend (stored before GitHub redirect)
    const storedState = localStorage.getItem('oauth_state')
    if (!storedState || storedState !== state) {
      setError('State mismatch — please try logging in again.')
      return
    }
    // Consume the stored state immediately so it can't be reused
    localStorage.removeItem('oauth_state')

    handleCallback(code, state)
      .then(() => navigate('/', { replace: true }))
      .catch(err => {
        const msg =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Authentication failed. Please try again.'
        setError(msg)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        {error ? (
          <div className="glass rounded-2xl p-10">
            <AlertTriangle size={40} className="mx-auto mb-5" style={{ color: 'var(--accent-red)' }} />
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Authentication Failed
            </h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="btn-primary px-6 py-2.5 text-sm relative z-10"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <GitBranch size={28} color="white" />
            </div>
            <Loader2 size={32} className="animate-spin mx-auto mb-5" style={{ color: 'var(--accent-violet)' }} />
            <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
              Completing authentication…
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              Please wait while we verify your GitHub account.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
