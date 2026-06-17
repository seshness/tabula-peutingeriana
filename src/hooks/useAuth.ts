import { useCallback, useEffect, useState } from 'react'
import {
  getAccessToken,
  handleCallback,
  isLoggedIn,
  isTokenExpired,
  logout as doLogout,
  refreshAccessToken,
  startLogin,
} from '@/lib/auth'

type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'error'

export function useAuth() {
  const [state, setState] = useState<AuthState>('loading')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resolveToken = useCallback(async () => {
    if (!isLoggedIn()) {
      setState('unauthenticated')
      return
    }
    if (isTokenExpired()) {
      const ok = await refreshAccessToken()
      if (!ok) {
        setState('unauthenticated')
        return
      }
    }
    setToken(getAccessToken())
    setState('authenticated')
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const callbackError = params.get('error')

    if (callbackError) {
      setError('Spotify authorization was denied.')
      setState('error')
      window.history.replaceState({}, '', '/')
      return
    }

    if (code && state) {
      setState('loading')
      window.history.replaceState({}, '', '/')
      handleCallback(code, state).then(ok => {
        if (ok) {
          setToken(getAccessToken())
          setState('authenticated')
        } else {
          setError('Authorization failed. Please try again.')
          setState('error')
        }
      })
      return
    }

    resolveToken()
  }, [resolveToken])

  // Auto-refresh every 50 minutes
  useEffect(() => {
    if (state !== 'authenticated') return
    const id = setInterval(async () => {
      if (isTokenExpired()) {
        const ok = await refreshAccessToken()
        if (ok) setToken(getAccessToken())
        else setState('unauthenticated')
      }
    }, 50 * 60 * 1000)
    return () => clearInterval(id)
  }, [state])

  const login = useCallback(() => startLogin(), [])

  const logout = useCallback(() => {
    doLogout()
    setToken(null)
    setState('unauthenticated')
  }, [])

  return { state, token, error, login, logout }
}
