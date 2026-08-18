import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const isAuthenticated = !!user

  /* ── Bootstrap: check stored tokens on mount ── */
  useEffect(() => {
    const token = localStorage.getItem('access_token')

    if (!token) {
      setLoading(false)
      return
    }

    client
      .get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(async () => {
        // Token may be expired — try refresh
        const refreshed = await tryRefresh()

        if (refreshed) {
          try {
            const { data } = await client.get('/auth/me')
            setUser(data)
          } catch {
            clearTokens()
          }
        } else {
          clearTokens()
        }
      })
      .finally(() => setLoading(false))
  }, [])

  /* ── Login: redirect browser directly to GitHub OAuth ── */
  const login = useCallback(() => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/github/login`
  }, [])

  /* ── Handle OAuth callback ── */
  const handleCallback = useCallback(async (code, state) => {
    const { data } = await client.post('/auth/github/callback', {
      code,
      state,
    })

    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)

    // OAuth state is no longer needed
    localStorage.removeItem('oauth_state')

    setUser(data.user)

    return data.user
  }, [])

  /* ── Logout ── */
  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token')

    try {
      if (refresh) {
        await client.post('/auth/logout', { refresh })
      }
    } catch {
      // Ignore logout errors — token may already be invalid
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        handleCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/* ── Helpers ── */

function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('oauth_state')
}

async function tryRefresh() {
  const refresh = localStorage.getItem('refresh_token')

  if (!refresh) return false

  try {
    const { data } = await client.post('/auth/refresh', {
      refresh,
    })

    localStorage.setItem('access_token', data.access)

    if (data.refresh) {
      localStorage.setItem('refresh_token', data.refresh)
    }

    return true
  } catch {
    clearTokens()
    return false
  }
}