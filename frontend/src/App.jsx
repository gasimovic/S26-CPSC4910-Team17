import React, { useEffect, useMemo, useState } from 'react'
import About from './About'

function App() {
  // ============ STATE MANAGEMENT ============
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState('landing')
  const [currentUser, setCurrentUser] = useState(null)
  const [pendingRole, setPendingRole] = useState('driver') // chosen role for new accounts (driver | sponsor)
  // Prefill for reset-password deep links (?page=reset-password&email=...&token=...)
  const [resetPrefill, setResetPrefill] = useState({ email: '', token: '' })

  // ======= API base selection (supports logging in as driver OR sponsor without changing .env) =======
  // Vite proxy bases (same-origin). These MUST match `vite.config.js`.
  const DRIVER_API_BASE = (import.meta.env.VITE_DRIVER_API_BASE || '/api/driver').replace(/\/$/, '')
  const ADMIN_API_BASE = (import.meta.env.VITE_ADMIN_API_BASE || '/api/admin').replace(/\/$/, '')
  const SPONSOR_API_BASE = (import.meta.env.VITE_SPONSOR_API_BASE || '/api/sponsor').replace(/\/$/, '')

<<<<<<< HEAD
  // Back-compat: allow a single override (VITE_API_PREFIX), but if it points at localhost and
  // we're not actually browsing from localhost, ignore it and use the proxy paths.
  const API_PREFIX = useMemo(() => {
    const role = (activeRole || 'driver').toLowerCase()
    const defaultPrefix =
      role === 'admin' ? ADMIN_API_BASE :
        role === 'sponsor' ? SPONSOR_API_BASE :
          DRIVER_API_BASE
=======
  // Default base from env (back-compat). If missing, default to driver.
  const envRole = (import.meta.env.VITE_ACTIVE_ROLE || 'driver').toLowerCase()
  const envDefaultBase =
    envRole === 'admin' ? ADMIN_API_BASE :
    envRole === 'sponsor' ? SPONSOR_API_BASE :
    DRIVER_API_BASE
>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424

    // Persist the last successful base so refresh keeps the correct role.
    const [apiBase, setApiBase] = useState(() => {
      try {
        const saved = window.localStorage.getItem('gdip_api_base')
        return (saved && saved.trim()) ? saved.trim().replace(/\/$/, '') : envDefaultBase
      } catch {
        return envDefaultBase
      }
    })

    const inferRoleFromBase = (base) => {
      const b = (base || '').toLowerCase()
      if (b.includes('/api/admin')) return 'admin'
      if (b.includes('/api/sponsor')) return 'sponsor'
      return 'driver'
    }

    const setApiBasePersisted = (base) => {
      const clean = (base || '').replace(/\/$/, '')
      setApiBase(clean)
      try {
        window.localStorage.setItem('gdip_api_base', clean)
      } catch {
        // ignore
      }
    }

    // Allow a single override (VITE_API_PREFIX), but if it points at localhost and
    // we're not actually browsing from localhost, ignore it and use the proxy paths.
    useEffect(() => {
      const raw = (import.meta.env.VITE_API_PREFIX || '').trim()
      if (!raw) return

      const isLocalhostBrowser =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

      const pointsToLocalhost = raw.includes('localhost') || raw.includes('127.0.0.1')
      if (pointsToLocalhost && !isLocalhostBrowser) return

      // Only apply this override if we haven't already successfully logged in and saved a base.
      try {
        const saved = window.localStorage.getItem('gdip_api_base')
        if (saved && saved.trim()) return
      } catch {
        // ignore
      }

      setApiBasePersisted(raw)
    }, [])

    // Simple message state (keeps appearance: uses existing footer style)
    const [authError, setAuthError] = useState('')
    const [statusMsg, setStatusMsg] = useState('')

    const safeJson = async (res) => {
      const text = await res.text()
      if (!text) return null
      try {
        return JSON.parse(text)
      } catch {
        return { raw: text }
      }
    }

    const api = async (path, options = {}) => {
      let res
      const controller = new AbortController()
      const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000)
      const t = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const safePath = path.startsWith('/') ? path : `/${path}`
        res = await fetch(`${apiBase}${safePath}`,
          {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(options.headers || {})
            },
            signal: controller.signal,
            ...options
          }
        )
      } catch (e) {
        // Browser/network/CORS/timeouts land here
        const isAbort = e?.name === 'AbortError'
        const err = new Error(
          isAbort
            ? `Request timed out after ${Math.round(timeoutMs / 1000)}s (could not reach the server)`
            : 'Network error: could not reach the server'
        )
        err.cause = e
        throw err
      } finally {
        clearTimeout(t)
      }

      const data = await safeJson(res)
      // If we accidentally hit the Vite SPA (index.html) instead of the API (proxy not working),
      // the response will be text/html and often contains a full HTML document.
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      const rawText = typeof data?.raw === 'string' ? data.raw : ''
      if (ct.includes('text/html') || rawText.includes('<!doctype html') || rawText.includes('<html')) {
        const err = new Error(
          'Received HTML from the server instead of API JSON. This usually means the Vite proxy for /api/* is not configured or not being loaded by the dev server.'
        )
        err.status = res.status
        err.responseBody = rawText
        throw err
      }
      if (!res.ok) {
        const bodyText = typeof data?.raw === 'string' ? data.raw : JSON.stringify(data || {})
        const msg = data?.error || data?.message || res.statusText || 'Server error'
        const err = new Error(`${msg} (HTTP ${res.status})`)
        // Attach raw response for debugging in console
        err.responseBody = bodyText
        err.status = res.status
        throw err
      }
      return data
    }

    const normalizeMe = (me) => {
      // Supports either:
      // 1) { user: { id,email,role }, profile: {...} }
      // 2) flat combined object
      const userObj = me?.user || me || {}
      const profileObj = me?.profile || me?.profileData || me || {}

      const firstName = profileObj.first_name || ''
      const lastName = profileObj.last_name || ''
      const displayName = profileObj.display_name || ''

      const name = displayName || [firstName, lastName].filter(Boolean).join(' ') || userObj.email || 'User'

      return {
        id: userObj.id || userObj.userId || userObj.user_id || null,
        name,
        email: userObj.email || null,
        role: (userObj.role || inferRoleFromBase(apiBase)),
        // Sprint 1 backend doesn't provide points yet
        points: Number(userObj.points ?? 0),
        miles: Number(userObj.miles ?? 0),
        streak: Number(userObj.streak ?? 0),
        rank: Number(userObj.rank ?? 0),
        profile: {
          first_name: profileObj.first_name || '',
          last_name: profileObj.last_name || '',
          dob: profileObj.dob || '',
          phone: profileObj.phone || '',
          address_line1: profileObj.address_line1 || '',
          address_line2: profileObj.address_line2 || '',
          city: profileObj.city || '',
          state: profileObj.state || '',
          postal_code: profileObj.postal_code || '',
          country: profileObj.country || '',
          sponsor_org: profileObj.sponsor_org || '',
          company_name: profileObj.company_name || '',
          display_name: profileObj.display_name || ''
        }
      }
    }

    const loadMe = async () => {
      const me = await api('/me', { method: 'GET' })
      const u = normalizeMe(me)
      setCurrentUser(u)
      return u
    }

    const profileLooksEmpty = (u) => {
      const p = u?.profile
      if (!p) return true
      return !(
        (p.first_name && p.first_name.trim()) ||
        (p.last_name && p.last_name.trim()) ||
        (p.dob && String(p.dob).trim()) ||
        (p.phone && p.phone.trim()) ||
        (p.address_line1 && p.address_line1.trim()) ||
        (p.city && p.city.trim())
      )
    }

    // ===== Role-based page access =====
    const getAllowedPages = (user) => {
      // Default conservative set for anonymous/unknown
      if (!user) return ['dashboard', 'about']

      const role = (user.role || inferRoleFromBase(apiBase) || 'driver').toLowerCase()
      const hasSponsor = Boolean((user.profile?.sponsor_org || '').toString().trim())

      if (role === 'admin') {
        return ['dashboard', 'profile', 'account-details', 'change-password', 'about']
      }

      if (role === 'sponsor') {
<<<<<<< HEAD
        return ['dashboard', 'applications', 'catalog', 'rewards', 'leaderboard', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about']
=======
      // Sponsors should manage ads/applications + their own profile/account.
      // Driver-only pages like Rewards, Leaderboard, Achievements, Log Trip, and Sponsor Affiliation
      // must NOT appear for sponsors.
      return ['dashboard', 'drivers', 'applications', 'profile', 'account-details', 'change-password', 'about']
>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424
      }

      // driver
      if (role === 'driver') {
        if (hasSponsor) {
          return ['dashboard', 'log-trip', 'rewards', 'leaderboard', 'achievements', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about']
        }
        // Unaffiliated drivers get a minimal view
        return ['dashboard', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about']
      }

      // Fallback
      return ['dashboard', 'profile', 'about']
    }

    // Ensure currentPage is valid for the current user
    useEffect(() => {
      // Only enforce allowed pages when the user is logged in to avoid
      // changing the login/create-account flow for unauthenticated users.
      if (!isLoggedIn) return

      const allowed = getAllowedPages(currentUser)
      if (!allowed.includes(currentPage)) {
        setCurrentPage(allowed[0] || 'dashboard')
      }
    }, [currentUser, isLoggedIn, currentPage])

<<<<<<< HEAD
    const handleLogin = async (email, password) => {
      setAuthError('')
      setStatusMsg('')
      setStatusMsg('Signing in…')

      try {
        await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        })

        setIsLoggedIn(true)
        setStatusMsg('Signed in. Loading your profile…')

        const u = await loadMe()

        // If user has no details yet, send them to the details prompt
=======
  const apiWithBase = async (base, path, options = {}) => {
    // Same behavior as `api`, but lets us try different services during login.
    let res
    const controller = new AbortController()
    const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000)
    const t = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const safePath = path.startsWith('/') ? path : `/${path}`
      res = await fetch(`${base.replace(/\/$/, '')}${safePath}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          signal: controller.signal,
          ...options
        }
      )
    } catch (e) {
      const isAbort = e?.name === 'AbortError'
      const err = new Error(
        isAbort
          ? `Request timed out after ${Math.round(timeoutMs / 1000)}s (could not reach the server)`
          : 'Network error: could not reach the server'
      )
      err.cause = e
      throw err
    } finally {
      clearTimeout(t)
    }

    const data = await safeJson(res)
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    const rawText = typeof data?.raw === 'string' ? data.raw : ''
    if (ct.includes('text/html') || rawText.includes('<!doctype html') || rawText.includes('<html')) {
      const err = new Error(
        'Received HTML from the server instead of API JSON. This usually means the Vite proxy for /api/* is not configured or not being loaded by the dev server.'
      )
      err.status = res.status
      err.responseBody = rawText
      throw err
    }

    if (!res.ok) {
      const bodyText = typeof data?.raw === 'string' ? data.raw : JSON.stringify(data || {})
      const msg = data?.error || data?.message || res.statusText || 'Server error'
      const err = new Error(`${msg} (HTTP ${res.status})`)
      err.responseBody = bodyText
      err.status = res.status
      throw err
    }

    return data
  }

  const handleLogin = async (email, password) => {
    setAuthError('')
    setStatusMsg('')
    setStatusMsg('Signing in…')

    // Try the last-used base first, then fall back to the others.
    // REMOVE SPONSOR_API_BASE so driver login no longer tries sponsor.
    const candidates = [
      apiBase,
      DRIVER_API_BASE,
      ADMIN_API_BASE
    ].filter(Boolean)

    // De-dupe while keeping order
    const bases = [...new Set(candidates.map(b => (b || '').replace(/\/$/, '')))].filter(Boolean)

    try {
      let chosenBase = null

      for (const b of bases) {
        try {
          await apiWithBase(b, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          })
          chosenBase = b
          break
        } catch (e) {
          // If credentials are wrong for that service, try the next.
          // Keep going on 400/401/404; stop on network/timeouts.
          const status = e?.status
          const msg = (e?.message || '').toLowerCase()
          const looksNetworky = msg.includes('network error') || msg.includes('timed out')
          if (looksNetworky) throw e
          if (status && ![400, 401, 404].includes(status)) throw e
        }
      }

      if (!chosenBase) {
        throw new Error('Invalid credentials (HTTP 401). If you are a sponsor, use the Sponsor Sign in tab.')
      }

      setApiBasePersisted(chosenBase)
      setIsLoggedIn(true)
      setStatusMsg('Signed in. Loading your profile…')

      const u = await (async () => {
        const me = await apiWithBase(chosenBase, '/me', { method: 'GET' })
        const normalized = (() => {
          const userObj = me?.user || me || {}
          const profileObj = me?.profile || me?.profileData || me || {}

          const firstName = profileObj.first_name || ''
          const lastName = profileObj.last_name || ''
          const displayName = profileObj.display_name || ''
          const name = displayName || [firstName, lastName].filter(Boolean).join(' ') || userObj.email || 'User'

          return {
            id: userObj.id || userObj.userId || userObj.user_id || null,
            name,
            email: userObj.email || null,
            role: (userObj.role || inferRoleFromBase(chosenBase)),
            points: Number(userObj.points ?? 0),
            miles: Number(userObj.miles ?? 0),
            streak: Number(userObj.streak ?? 0),
            rank: Number(userObj.rank ?? 0),
            profile: {
              first_name: profileObj.first_name || '',
              last_name: profileObj.last_name || '',
              dob: profileObj.dob || '',
              phone: profileObj.phone || '',
              address_line1: profileObj.address_line1 || '',
              address_line2: profileObj.address_line2 || '',
              city: profileObj.city || '',
              state: profileObj.state || '',
              postal_code: profileObj.postal_code || '',
              country: profileObj.country || '',
              sponsor_org: profileObj.sponsor_org || '',
              company_name: profileObj.company_name || '',
              display_name: profileObj.display_name || ''
            }
          }
        })()

        setCurrentUser(normalized)
        return normalized
      })()

>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424
        if (profileLooksEmpty(u)) {
          setCurrentPage('account-details')
          setStatusMsg('Welcome! Please complete your account details.')
        } else {
          setCurrentPage('dashboard')
        }
      } catch (err) {
        setIsLoggedIn(false)
        setCurrentUser(null)
        setAuthError(err.message || 'Login failed')
        if (err?.responseBody) console.error('Login error response:', err.responseBody)
      }
    }

<<<<<<< HEAD
    const handleRegister = async ({ email, password, name, dob, company_name }) => {
      setAuthError('')
      setStatusMsg('')
      setStatusMsg('Creating account…')

      try {
        // Parse name into first_name and last_name
        const nameTrimmed = (name || '').trim()
        const parts = nameTrimmed.length ? nameTrimmed.split(/\s+/) : []
        const first_name = parts.shift() || ''
        const last_name = parts.join(' ')

        // Build registration payload
        const registrationData = {
          email,
          password,
          first_name,
          last_name,
          dob
        }

        // Add company_name for sponsors (not used for drivers)
        if (activeRole === 'sponsor' && company_name) {
          registrationData.company_name = company_name
        }

        // Send all required data to backend registration
        await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify(registrationData)
        })

        // Log in immediately
        await api('/auth/login', {
=======
  const handleSponsorLogin = async (email, password) => {
    setAuthError('')
    setStatusMsg('')
    setStatusMsg('Signing in as sponsor…')

    try {
      // Sponsor-only: never try driver/admin here
      await apiWithBase(SPONSOR_API_BASE, '/auth/login', {
>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424
          method: 'POST',
          body: JSON.stringify({ email, password })
        })

<<<<<<< HEAD
        setIsLoggedIn(true)
        setStatusMsg('Account created. Loading your profile…')

        // Load the user profile from backend
        await loadMe()

        // Always send new users to complete their profile with phone/address
        setCurrentPage('account-details')
        setStatusMsg('Account created. Please complete your account details.')
      } catch (err) {
        setIsLoggedIn(false)
        setCurrentUser(null)
        setAuthError(err.message || 'Registration failed')
        if (err?.responseBody) console.error('Register error response:', err.responseBody)
      }
    }
=======
      setApiBasePersisted(SPONSOR_API_BASE)
      setIsLoggedIn(true)
      setStatusMsg('Signed in. Loading your profile…')

      const me = await apiWithBase(SPONSOR_API_BASE, '/me', { method: 'GET' })
      const u = normalizeMe(me)
      // Force role to sponsor if backend ever omits it
      u.role = (u.role || 'sponsor').toLowerCase()
      setCurrentUser(u)

      if (profileLooksEmpty(u)) {
        setCurrentPage('account-details')
        setStatusMsg('Welcome! Please complete your account details.')
      } else {
        setCurrentPage('dashboard')
      }
    } catch (err) {
      setIsLoggedIn(false)
      setCurrentUser(null)
      setAuthError(err.message || 'Sponsor login failed')
      if (err?.responseBody) console.error('Sponsor login error response:', err.responseBody)
    }
  }

const handleRegister = async ({ email, password, name, dob, company_name }) => {
  setAuthError('')
  setStatusMsg('')
  setStatusMsg('Creating account…')

  // Use the pendingRole for registration base
  const roleBase = pendingRole === 'sponsor' ? SPONSOR_API_BASE : DRIVER_API_BASE

  try {
    // Parse name into first_name and last_name
    const nameTrimmed = (name || '').trim()
    const parts = nameTrimmed.length ? nameTrimmed.split(/\s+/) : []
    const first_name = parts.shift() || ''
    const last_name = parts.join(' ')

    // Build registration payload
    const registrationData = {
      email,
      password,
      first_name,
      last_name,
      dob
    }

    // Add company_name for sponsors (not used for drivers)
    if (pendingRole === 'sponsor' && company_name) {
      registrationData.company_name = company_name
    }

    // Send all required data to backend registration
    await apiWithBase(roleBase, '/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData)
    })

    // Log in immediately
    await apiWithBase(roleBase, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    setApiBasePersisted(roleBase)
    setIsLoggedIn(true)
    setStatusMsg('Account created. Loading your profile…')

    // Load the user profile from backend
    await loadMe()

    // Always send new users to complete their profile with phone/address
    setCurrentPage('account-details')
    setStatusMsg('Account created. Please complete your account details.')
  } catch (err) {
    setIsLoggedIn(false)
    setCurrentUser(null)
    setAuthError(err.message || 'Registration failed')
    if (err?.responseBody) console.error('Register error response:', err.responseBody)
  }
}
>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424

    const handleLogout = async () => {
      setAuthError('')
      setStatusMsg('')

      try {
        await api('/auth/logout', { method: 'POST' })
      } catch {
        // Even if backend logout fails, clear locally
      }

      setIsLoggedIn(false)
      setCurrentPage('login')
      setCurrentUser(null)
      try { window.localStorage.removeItem('gdip_api_base') } catch { }
    }

    // Optional: if user refreshes while logged in, try to restore
    useEffect(() => {
      // Support reset-password deep links like:
      //   /?page=reset-password&email=...&token=...
      // This enables the forgot/reset flow without changing the UI elsewhere.
      try {
        const params = new URLSearchParams(window.location.search)
        const page = (params.get('page') || '').toLowerCase()

        if (page === 'reset-password') {
          const email = params.get('email') || ''
          const token = params.get('token') || ''
          setResetPrefill({ email, token })
          setAuthError('')
          setStatusMsg('')
          setCurrentPage('reset-password')
          return
        }

        // Support deep links to login pages
        if (page === 'login-sponsor') {
          setAuthError('')
          setStatusMsg('')
          setCurrentPage('login-sponsor')
          return
        }

        if (page === 'login') {
          setAuthError('')
          setStatusMsg('')
          setCurrentPage('login')
          return
        }
      } catch {
        // ignore
      }
    }, [])

    // ============ LANDING PAGE ============
    const LandingPage = () => {
      return (
        <div className="landing">
          <header className="landing-hero">
            <div className="landing-hero-content">
              <div>
                <p className="landing-eyebrow">Driver Rewards Program</p>
                <h1 className="landing-title">Rewarding safe driving, one mile at a time.</h1>
                <p className="landing-subtitle">
                  Log trips, earn points, and unlock rewards from sponsors who care about safety and consistency on the road.
                </p>
                <div className="landing-cta">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setAuthError('')
                      setStatusMsg('')
                      setCurrentPage('login')
                    }}
                  >
                    Driver sign in
                  </button>

                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => {
                      setAuthError('')
                      setStatusMsg('')
                      setCurrentPage('login-sponsor')
                    }}
                  >
                    Sponsor sign in
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setAuthError('')
                      setStatusMsg('')
                      setCurrentPage('account-type')
                    }}
                  >
                    Create an account
                  </button>
                </div>
              </div>

              <div className="landing-hero-visual">
                <p className="landing-metric-label">Example snapshot</p>
                <p className="landing-metric-value">12,450 pts</p>
                <p className="landing-metric-sub">Safe miles logged this year</p>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
                <p className="landing-metric-label">This month</p>
                <p className="landing-metric-sub">4 safe trips · 320 miles · 3 rewards redeemed</p>
              </div>
            </div>
          </header>

          <main className="landing-main">
            <section className="landing-section">
              <h2 className="section-title">How it works</h2>
              <div className="landing-grid">
                <div className="card">
                  <h3 className="card-title">Log safe trips</h3>
                  <p className="card-body">
                    Record your miles and safe-driving streaks to earn points over time.
                  </p>
                </div>
                <div className="card">
                  <h3 className="card-title">Earn points</h3>
                  <p className="card-body">
                    Consistent safe driving increases your points, rank, and achievements.
                  </p>
                </div>
                <div className="card">
                  <h3 className="card-title">Redeem rewards</h3>
                  <p className="card-body">
                    Trade points for rewards from participating sponsors and partners.
                  </p>
                </div>
              </div>
            </section>

            <section className="landing-section">
              <h2 className="section-title">Built for drivers and sponsors</h2>
              <div className="landing-grid landing-grid--two">
                <div className="card">
                  <h3 className="card-title">For drivers</h3>
                  <p className="card-body">
                    Track your progress, view your leaderboard position, and stay motivated to drive safely.
                  </p>
                </div>
                <div className="card">
                  <h3 className="card-title">For sponsors</h3>
                  <p className="card-body">
                    Engage with high-performing drivers and reward safe, consistent behavior with custom perks.
                  </p>
                </div>
              </div>
            </section>
          </main>

          <footer className="landing-footer">
            <p>Ready to get started?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('login')
                }}
              >
                Driver sign in
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('login-sponsor')
                }}
              >
                Sponsor sign in
              </button>
            </div>
          </footer>
        </div>
      )
    }

    // ============ ACCOUNT TYPE SELECTION PAGE ============
    const AccountTypePage = () => {
      return (
        <div className="login-wrap">
          <div className="login-card">
            <h1 className="login-title">Choose account type</h1>
            <p className="login-subtitle">Select how you want to use Driver Rewards.</p>

            <div className="form-group">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => {
                  setPendingRole('driver')
                  setCurrentPage('create-account')
                }}
              >
                Sign up as a driver
              </button>
              <p className="form-footer" style={{ marginTop: 8 }}>
                Earn points for safe driving, climb the leaderboard, and redeem rewards.
              </p>
            </div>

            <div className="form-group">
              <button
                type="button"
                className="btn btn-success btn-block"
                onClick={() => {
                  setPendingRole('sponsor')
                  setCurrentPage('create-account')
                }}
              >
                Sign up as a sponsor
              </button>
              <p className="form-footer" style={{ marginTop: 8 }}>
                Create programs, post opportunities, and reward safe, consistent drivers.
              </p>
            </div>

            <p className="form-footer">
              Already have an account?{' '}
              <a
                href="#"
                className="link"
                onClick={(e) => {
                  e.preventDefault()
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('login')
                }}
              >
                Go to sign in
              </a>
            </p>
          </div>
        </div>
      )
    }

    // ============ LOGIN PAGE ============
    const LoginPage = () => {
      const [email, setEmail] = useState('')
      const [password, setPassword] = useState('')

      const onSubmit = (e) => {
        e.preventDefault()
        handleLogin(email, password)
      }

      return (
        <div className="login-wrap">
          <div className="login-card">
            <h1 className="login-title">Driver Rewards</h1>
            <p className="login-subtitle">Sign in to your account</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('login')
                }}
              >
                Driver Sign in
              </button>
              <button
                type="button"
                className="btn btn-success"
                style={{ flex: 1 }}
                onClick={() => {
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('login-sponsor')
                }}
              >
                Sponsor Sign in
              </button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="form-group">
                <label className="form-label">Email or Driver ID</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="form-input"
                  required
                />
              </div>

              {authError ? <p className="form-footer" style={{ color: 'crimson' }}>{authError}</p> : null}
              {statusMsg ? <p className="form-footer" style={{ color: 'green' }}>{statusMsg}</p> : null}

              <button type="submit" className="btn btn-primary btn-block">
                Sign in
              </button>
            </form>

            <p className="form-footer">
              <a
                href="#"
                className="link"
                onClick={(e) => {
                  e.preventDefault()
                  setAuthError('')
                  setStatusMsg('')
                  // Ensure we start in "request reset link" mode (no token) when navigating from login
                  setResetPrefill({ email: '', token: '' })
                  setCurrentPage('reset-password')
                }}
              >
                Forgot password?
              </a>
              <br />
              Don&apos;t have an account?{' '}
              <a
                href="#"
                className="link"
                onClick={(e) => {
                  e.preventDefault()
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('account-type')
                }}
              >
                Create one here
              </a>
            </p>
          </div>
        </div>
      )
    }

    const SponsorLoginPage = () => {
      const [email, setEmail] = useState('')
      const [password, setPassword] = useState('')

      const onSubmit = (e) => {
        e.preventDefault()
        handleSponsorLogin(email, password)
      }

      return (
        <div className="login-wrap">
          <div className="login-card">
            <h1 className="login-title">Driver Rewards</h1>
            <p className="login-subtitle">Sponsor sign in</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('login')
                }}
              >
                Driver Sign in
              </button>
              <button
                type="button"
                className="btn btn-success"
                style={{ flex: 1 }}
                onClick={() => {
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('login-sponsor')
                }}
              >
                Sponsor Sign in
              </button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter sponsor email"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="form-input"
                  required
                />
              </div>

              {authError ? <p className="form-footer" style={{ color: 'crimson' }}>{authError}</p> : null}
              {statusMsg ? <p className="form-footer" style={{ color: 'green' }}>{statusMsg}</p> : null}

              <button type="submit" className="btn btn-success btn-block">
                Sponsor sign in
              </button>
            </form>

            <p className="form-footer">
              Need a driver account instead?{' '}
              <a
                href="#"
                className="link"
                onClick={(e) => {
                  e.preventDefault()
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('login')
                }}
              >
                Go to Driver sign in
              </a>
            </p>

            <p className="form-footer">
              Don&apos;t have an account?{' '}
              <a
                href="#"
                className="link"
                onClick={(e) => {
                  e.preventDefault()
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('account-type')
                }}
              >
                Create one here
              </a>
            </p>
          </div>
        </div>
      )
    }

    // ============ NAVIGATION COMPONENT ============
    const Navigation = () => {
      const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
      const allowed = getAllowedPages(currentUser)

<<<<<<< HEAD
=======
    const isDriver = role === 'driver'
    const isSponsor = role === 'sponsor'
    const isAdmin = role === 'admin'

>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424
      return (
        <nav className="nav">
          <div className="nav-brand">Driver Rewards</div>
          <div className="nav-links">
            {allowed.includes('dashboard') && (
              <button type="button" onClick={() => setCurrentPage('dashboard')} className="nav-link">
                Dashboard
              </button>
            )}

            {/* Driver-only */}
            {isDriver && allowed.includes('log-trip') && (
              <button type="button" onClick={() => setCurrentPage('log-trip')} className="nav-link">
                Log Trip
              </button>
            )}

            {/* Sponsor-only */}
            {isSponsor && allowed.includes('applications') && (
              <button type="button" onClick={() => setCurrentPage('applications')} className="nav-link">
                Applications
              </button>
            )}
<<<<<<< HEAD
      {
        allowed.includes('catalog') && (
          <button type="button" onClick={() => setCurrentPage('catalog')} className="nav-link">
            Catalog
          </button>
        )
      }
      {
        allowed.includes('rewards') && (
=======
          {/* Sponsor-only: Drivers button */}
          {isSponsor && allowed.includes('drivers') && (
            <button type="button" onClick={() => setCurrentPage('drivers')} className="nav-link">
              Drivers
            </button>
          )}

          {/* Driver-only */}
          {isDriver && allowed.includes('rewards') && (
>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424
          <button type="button" onClick={() => setCurrentPage('rewards')} className="nav-link">
            Rewards
          </button>
        )
      }
      {
        isDriver && allowed.includes('leaderboard') && (
          <button type="button" onClick={() => setCurrentPage('leaderboard')} className="nav-link">
            Leaderboard
          </button>
        )
      }
      {
        isDriver && allowed.includes('achievements') && (
          <button type="button" onClick={() => setCurrentPage('achievements')} className="nav-link">
            Achievements
          </button>
        )
      }

      {
        allowed.includes('profile') && (
          <button type="button" onClick={() => setCurrentPage('profile')} className="nav-link">
            Profile
          </button>
        )
      }

      {/* Driver-only */ }
      {
        isDriver && allowed.includes('sponsor-affiliation') && (
          <button type="button" onClick={() => setCurrentPage('sponsor-affiliation')} className="nav-link">
            Sponsor
          </button>
        )
      }

      {/* Points are only meaningful for drivers; keep UI clean for sponsors/admin */ }
      { isDriver ? <span className="nav-pts">{currentUser?.points ?? 0} pts</span> : null }

      {
        allowed.includes('about') && (
          <button type="button" onClick={() => setCurrentPage('about')} className="nav-link">
            About
          </button>
        )
      }

      <button type="button" onClick={handleLogout} className="nav-logout">Log out</button>
        </div >
      </nav >
    )
}
// ============ DRIVERS PAGE (for sponsors: adjust driver points) ============
const SponsorDriversPage = () => {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')

  // per-driver edit state
  const [deltaById, setDeltaById] = useState({})
  const [reasonById, setReasonById] = useState({})

  const loadDrivers = async () => {
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      // Prefer sponsor service endpoints; try a few common shapes for robustness
      const tryPaths = ['/drivers', '/driver-points/drivers', '/points/drivers']
      let data = null
      let lastErr = null
      for (const p of tryPaths) {
        try {
          data = await api(p, { method: 'GET' })
          break
        } catch (e) {
          lastErr = e
        }
      }
      if (!data) throw lastErr || new Error('Failed to load drivers')

      const list = data.drivers || data.items || data.results || []
      setDrivers(Array.isArray(list) ? list : [])
    } catch (e) {
      setError(e?.message || 'Failed to load drivers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load on mount
    loadDrivers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return drivers
    return drivers.filter(d => {
      const id = String(d.id ?? d.user_id ?? '')
      const email = String(d.email ?? '')
      const name = String(d.name ?? d.driver_name ?? '')
      return id.includes(q) || email.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    })
  }, [drivers, query])

  const adjustPoints = async (driver) => {
    setError('')
    setSuccess('')

    const driverId = driver?.id ?? driver?.user_id
    if (!driverId) {
      setError('Missing driver id')
      return
    }

    const rawDelta = deltaById[driverId]
    const delta = Number(rawDelta)
    if (!Number.isFinite(delta) || delta === 0) {
      setError('Enter a non-zero number of points to add (+) or deduct (-).')
      return
    }

    const reason = (reasonById[driverId] || '').trim()

    try {
      // Try a few common endpoint shapes (backend should enforce sponsor auth)
      const body = JSON.stringify({ driverId, delta, reason })
      const tryReqs = [
        () => api(`/drivers/${driverId}/points`, { method: 'POST', body }),
        () => api(`/drivers/${driverId}/adjust-points`, { method: 'POST', body }),
        () => api('/driver-points/adjust', { method: 'POST', body }),
        () => api('/points/adjust', { method: 'POST', body })
      ]

      let resp = null
      let lastErr = null
      for (const fn of tryReqs) {
        try {
          resp = await fn()
          break
        } catch (e) {
          lastErr = e
        }
      }
      if (!resp) throw lastErr || new Error('Failed to update points')

      setSuccess(`Updated points for driver ${driverId}.`)

      // Best-effort refresh list to reflect new totals
      await loadDrivers()

      // Clear inputs for this driver
      setDeltaById(prev => ({ ...prev, [driverId]: '' }))
      setReasonById(prev => ({ ...prev, [driverId]: '' }))
    } catch (e) {
      setError(e?.message || 'Failed to update points')
      if (e?.responseBody) console.error('Adjust points error response:', e.responseBody)
    }
  }

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Drivers</h1>
        <p className="page-subtitle">Add or deduct points for affiliated drivers</p>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Search by name, email, or ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn-primary" type="button" onClick={loadDrivers} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error ? <p className="form-footer" style={{ color: 'crimson' }}>{error}</p> : null}
        {success ? <p className="form-footer" style={{ color: 'green' }}>{success}</p> : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Email</th>
                <th className="text-right">Points</th>
                <th style={{ width: 260 }}>Adjust</th>
                <th style={{ width: 260 }}>Reason (optional)</th>
                <th style={{ width: 140 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && drivers.length === 0 ? (
                <tr><td colSpan="6" className="table-empty">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="table-empty">No drivers found</td></tr>
              ) : (
                filtered.map(d => {
                  const id = d.id ?? d.user_id
                  const name = d.name || d.driver_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || `Driver ${id}`
                  const email = d.email || d.driver_email || '-'
                  const points = Number(d.points ?? d.total_points ?? 0)

                  return (
                    <tr key={String(id)}>
                      <td>{name}</td>
                      <td>{email}</td>
                      <td className="text-right">{points}</td>
                      <td>
                        <input
                          className="form-input"
                          type="number"
                          placeholder="e.g. 50 or -20"
                          value={deltaById[id] ?? ''}
                          onChange={(e) => setDeltaById(prev => ({ ...prev, [id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Optional note"
                          value={reasonById[id] ?? ''}
                          onChange={(e) => setReasonById(prev => ({ ...prev, [id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-success"
                          type="button"
                          onClick={() => adjustPoints({ ...d, id })}
                        >
                          Apply
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="form-footer" style={{ marginTop: 12 }}>
          Tip: use positive numbers to add points and negative numbers to deduct points.
        </p>
      </main>
    </div>
  )
}

// ============ SPONSOR CATALOG PAGE ============
const SponsorCatalogPage = () => {
  const [catalogItems, setCatalogItems] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [statusMsgLocal, setStatusMsgLocal] = useState('')

  const loadCatalog = async () => {
    setIsLoading(true)
    try {
      const data = await api('/catalog', { method: 'GET' })
      setCatalogItems(data.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCatalog()
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])
    try {
      const data = await api(`/ebay/search?q=${encodeURIComponent(searchQuery)}`, { method: 'GET' })
      setSearchResults(data.items || [])
    } catch (err) {
      setStatusMsgLocal('Search failed: ' + err.message)
    } finally {
      setIsSearching(false)
    }
  }

  const addToCatalog = async (item) => {
    setStatusMsgLocal('')
    try {
      await api('/catalog', {
        method: 'POST',
        body: JSON.stringify({
          ebayItemId: item.itemId,
          title: item.title,
          imageUrl: item.image,
          price: parseFloat(item.price?.value || 0),
          // Backend calculates points, but we could pass pointCost if we wanted custom logic
        })
      })
      setStatusMsgLocal('Item added to catalog!')
      setSearchResults(res => res.filter(r => r.itemId !== item.itemId)) // Remove from search results to prevent dupes? Or just reload
      loadCatalog()
    } catch (err) {
      setStatusMsgLocal('Failed to add item: ' + err.message)
    }
  }

  const removeFromCatalog = async (id) => {
    if (!window.confirm('Remove this item from your catalog?')) return
    try {
      await api(`/catalog/${id}`, { method: 'DELETE' })
      setCatalogItems(items => items.filter(i => i.id !== id))
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Shop Catalog</h1>
        <p className="page-subtitle">Manage items available for drivers</p>

        <section className="catalog-search-section" style={{ marginBottom: 40 }}>
          <h2 className="section-title">Import from eBay</h2>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search eBay..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ maxWidth: 400 }}
            />
            <button type="submit" className="btn btn-primary" disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {statusMsgLocal && <p style={{ color: 'green', marginBottom: 10 }}>{statusMsgLocal}</p>}

          {searchResults.length > 0 && (
            <div className="rewards-grid">
              {searchResults.map(item => (
                <div key={item.itemId} className="reward-card" style={{ borderColor: '#007bff' }}>
                  {item.image && <img src={item.image} alt={item.title} style={{ width: '100%', height: 150, objectFit: 'contain', marginBottom: 10 }} />}
                  <h4 style={{ fontSize: '1rem', marginBottom: 5 }}>{item.title}</h4>
                  <p className="reward-pts" style={{ color: '#333' }}>${item.price?.value}</p>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => addToCatalog(item)}>
                    Add to Shop
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="section-title">Current Catalog</h2>
          {isLoading ? <p>Loading...</p> : (
            catalogItems.length === 0 ? <p className="muted">No items in catalog.</p> : (
              <div className="rewards-grid">
                {catalogItems.map(item => (
                  <div key={item.id} className="reward-card">
                    {item.image_url && <img src={item.image_url} alt={item.title} style={{ width: '100%', height: 150, objectFit: 'contain', marginBottom: 10 }} />}
                    <h4 style={{ fontSize: '1rem', marginBottom: 5 }}>{item.title}</h4>
                    <p className="reward-pts">{item.point_cost} pts</p>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeFromCatalog(item.id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      </main>
    </div>
  )
}

// ============ DASHBOARD PAGE ============
const DashboardPage = () => {
  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Welcome back, {currentUser?.name || 'User'}</h1>
        <p className="page-subtitle">Here’s your overview</p>

        <div className="pts-hero">
          <p className="pts-hero-label">Your points</p>
          <p className="pts-hero-value">{currentUser?.points ?? 0}</p>
        </div>

        <section>
          <h2 className="section-title">Quick stats</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Miles this week</p>
              <p className="stat-value stat-value-blue">{currentUser?.miles ?? 0}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Safe days streak</p>
              <p className="stat-value stat-value-green">{currentUser?.streak ?? 0}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Current rank</p>
              <p className="stat-value stat-value-amber">#{currentUser?.rank ?? 0}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="section-title">Recent activity</h2>
          <div className="activity-card">
            <p className="activity-empty">No recent activity</p>
          </div>
        </section>
      </main>
    </div>
  )
}

// ============ LOG TRIP PAGE ============
const LogTripPage = () => {
  const [formData, setFormData] = useState({
    date: '',
    startLocation: '',
    endLocation: '',
    miles: '',
    fuelUsed: '',
    onTime: true,
    incidents: false
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Trip logged! (Backend not connected yet)')
  }

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Log a trip</h1>
        <p className="page-subtitle">Record your drive details</p>
        <div className="card form-card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Miles driven</label>
              <input
                type="number"
                value={formData.miles}
                onChange={(e) => setFormData({ ...formData, miles: e.target.value })}
                className="form-input"
                placeholder="0"
                required
              />
            </div>
            <button type="submit" className="btn btn-success btn-block">Submit trip</button>
          </form>
        </div>
      </main>
    </div>
  )
}

// ============ REWARDS PAGE ============
const RewardsPage = () => {
  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Rewards</h1>
        <p className="page-subtitle">Your balance: <strong>{currentUser?.points ?? 0} points</strong></p>
        <div className="rewards-grid">
          <div className="reward-card">
            <h3 className="reward-title">$25 Gas Card</h3>
            <p className="reward-pts">500 pts</p>
            <button type="button" className="btn btn-success">Redeem</button>
          </div>
        </div>
      </main>
    </div>
  )
}

// ============ LEADERBOARD PAGE ============
const LeaderboardPage = () => {
  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Leaderboard</h1>
        <p className="page-subtitle">Top drivers by points</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Driver</th>
                <th className="text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="3" className="table-empty">Loading…</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

// ============ ACHIEVEMENTS PAGE ============
const AchievementsPage = () => {
  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Achievements</h1>
        <p className="page-subtitle">Badges and milestones</p>
        <div className="badges-grid">
          <div className="badge-card">
            <div className="badge-icon">🏆</div>
            <h3 className="badge-title">Road Warrior</h3>
            <p className="badge-desc">30 days accident-free</p>
            <p className="badge-status">Unlocked</p>
          </div>
        </div>
      </main>
    </div>
  )
}

// ============ PROFILE PAGE (view) ============
const ProfilePage = () => {
  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      handleLogout()
    }
  }

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your account details</p>
        <div className="card profile-card">
          <div className="profile-field">
            <p className="profile-label">Name</p>
            <p className="profile-value">{currentUser?.name || ''}</p>
          </div>
          <div className="profile-field">
            <p className="profile-label">Email</p>
            <p className="profile-value">{currentUser?.email || ''}</p>
          </div>
          <div className="profile-field">
            <p className="profile-label">User ID</p>
            <p className="profile-value">{currentUser?.id || ''}</p>
          </div>
          <div className="profile-field">
            <p className="profile-label">Role</p>
            <p className="profile-value">{currentUser?.role || ''}</p>
          </div>
          <div className="profile-field">
            <p className="profile-label">Total points</p>
            <p className="profile-value profile-value-lg">{currentUser?.points ?? 0}</p>
          </div>
          <div className="profile-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCurrentPage('account-details')}>Edit profile</button>
            <button type="button" className="btn btn-primary" onClick={() => setCurrentPage('change-password')}>Change password</button>
            <button type="button" className="btn btn-danger" onClick={handleDeleteAccount}>
              Delete account
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

// ============ SPONSOR AFFILIATION PAGE ============
const SponsorAffiliationPage = () => {
  const [loading, setLoading] = useState(false)
  const [ads, setAds] = useState([])
  const [error, setError] = useState('')
  const [apps, setApps] = useState([])
  const [statusMsgLocal, setStatusMsgLocal] = useState('')

  const loadAds = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api('/ads', { method: 'GET' })
      setAds(data.ads || [])
    } catch (err) {
      setError(err.message || 'Failed to load ads')
    } finally {
      setLoading(false)
    }
  }

  const loadApplications = async () => {
    try {
      const data = await api('/applications', { method: 'GET' })
      setApps(data.applications || [])
    } catch (err) {
      // ignore silently
    }
  }

  useEffect(() => {
    loadAds()
    loadApplications()
  }, [])

  const applyTo = async (sponsorId) => {
    setStatusMsgLocal('')
    try {
      await api('/applications', { method: 'POST', body: JSON.stringify({ sponsorId }) })
      setStatusMsgLocal('Application submitted!')
      await loadApplications()
    } catch (err) {
      setStatusMsgLocal(err.message || 'Failed to apply')
    }
  }

  const hasApplied = (sponsorId) => {
    return apps.some(a => a.sponsor_id === sponsorId)
  }

  const currentSponsor = currentUser?.profile?.sponsor_org || ''

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Sponsor Programs</h1>
        <p className="page-subtitle">Browse and apply to sponsorship opportunities</p>

        {currentSponsor && (
          <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid green' }}>
            <h3>Your Sponsor</h3>
            <p>{currentSponsor}</p>
          </div>
        )}

        {statusMsgLocal && (
          <p className="form-footer" style={{ color: 'green', marginBottom: 12 }}>{statusMsgLocal}</p>
        )}
        {error && (
          <p className="form-footer" style={{ color: 'crimson', marginBottom: 12 }}>{error}</p>
        )}

        {loading ? (
          <p>Loading programs...</p>
        ) : ads.length === 0 ? (
          <div className="card">
            <p className="activity-empty">No sponsorship programs available yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {ads.map(ad => {
              const applied = hasApplied(ad.sponsor_id)
              return (
                <div key={ad.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <h3>{ad.title}</h3>
                      <p className="muted" style={{ marginBottom: 8 }}>
                        {ad.sponsor_company || ad.sponsor_email}
                      </p>
                      <p style={{ margin: '8px 0' }}>{ad.description}</p>
                      {ad.requirements && (
                        <p style={{ fontSize: '0.9em', color: '#666' }}>
                          <strong>Requirements:</strong> {ad.requirements}
                        </p>
                      )}
                      {ad.benefits && (
                        <p style={{ fontSize: '0.9em', color: '#666' }}>
                          <strong>Benefits:</strong> {ad.benefits}
                        </p>
                      )}
                    </div>
                    <div style={{ marginLeft: 16, flexShrink: 0 }}>
                      {applied ? (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 4,
                          fontSize: '0.85em',
                          backgroundColor: '#fff3cd',
                          color: '#856404'
                        }}>
                          Applied
                        </span>
                      ) : (
                        <button
                          className="btn btn-success"
                          onClick={() => applyTo(ad.sponsor_id)}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <section style={{ marginTop: 32 }}>
          <h2 className="section-title">Your applications</h2>
          {apps.length === 0 ? (
            <p className="activity-empty">No applications yet</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map(a => (
                    <tr key={a.id}>
                      <td>{a.sponsor_company || a.sponsor_email}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: '0.85em',
                          backgroundColor:
                            a.status === 'accepted' ? '#d4edda' :
                              a.status === 'rejected' ? '#f8d7da' :
                                '#fff3cd',
                          color:
                            a.status === 'accepted' ? '#155724' :
                              a.status === 'rejected' ? '#721c24' :
                                '#856404'
                        }}>
                          {a.status || 'pending'}
                        </span>
                      </td>
                      <td>{a.applied_at ? new Date(a.applied_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

// ============ ACCOUNT DETAILS PROMPT (edit + save to backend) ============
const AccountDetailsPage = () => {
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    first_name: currentUser?.profile?.first_name || '',
    last_name: currentUser?.profile?.last_name || '',
    dob: currentUser?.profile?.dob || '',
    phone: currentUser?.profile?.phone || '',
    address_line1: currentUser?.profile?.address_line1 || '',
    address_line2: currentUser?.profile?.address_line2 || '',
    city: currentUser?.profile?.city || '',
    state: currentUser?.profile?.state || '',
    postal_code: currentUser?.profile?.postal_code || '',
    country: currentUser?.profile?.country || '',
    sponsor_org: currentUser?.profile?.sponsor_org || '',
    company_name: currentUser?.profile?.company_name || '',
    display_name: currentUser?.profile?.display_name || ''
  })

  const [rawName, setRawName] = useState(
    `${(currentUser?.profile?.first_name || '').trim()}${currentUser?.profile?.last_name ? ' ' + currentUser.profile.last_name : ''}`
  )

  const onSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setAuthError('')
    setStatusMsg('')

    try {
      const nameTrimmed = (rawName || '').trim()
      const parts = nameTrimmed.length ? nameTrimmed.split(/\s+/) : ['']
      const parsedFirst = parts.shift() || ''
      const parsedLast = parts.join(' ')

      // Keep formData consistent with what the user typed
      if (parsedFirst !== formData.first_name || parsedLast !== formData.last_name) {
        setFormData({ ...formData, first_name: parsedFirst, last_name: parsedLast })
      }
      // Only send non-empty fields for optional fields
      const payload = {
        // required by the form (and backend accepts YYYY-MM-DD)
        first_name: parsedFirst,
        last_name: parsedLast,
        dob: formData.dob
      }

      // Only include optional fields if non-empty after trimming.
      const addIfNonEmpty = (key, value) => {
        const v = (value ?? '').toString().trim()
        if (v.length > 0) payload[key] = v
      }

      addIfNonEmpty('phone', formData.phone)
      addIfNonEmpty('address_line1', formData.address_line1)
      addIfNonEmpty('address_line2', formData.address_line2)
      addIfNonEmpty('city', formData.city)
      addIfNonEmpty('state', formData.state)
      addIfNonEmpty('postal_code', formData.postal_code)
      addIfNonEmpty('country', formData.country)

      // role-specific optional fields (only send if non-empty)
      const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
      if (role === 'driver') addIfNonEmpty('sponsor_org', formData.sponsor_org)
      if (role === 'sponsor') addIfNonEmpty('company_name', formData.company_name)
      if (role === 'admin') addIfNonEmpty('display_name', formData.display_name)

      await api('/me/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      })

      const u = await loadMe()
      setStatusMsg('Account details saved.')
      setCurrentPage('profile')
      // Keep currentUser up to date
      setCurrentUser(u)
    } catch (err) {
      setAuthError(err.message || 'Failed to save account details')
      if (err?.responseBody) console.error('Profile save error response:', err.responseBody)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Account Details</h1>
        <p className="page-subtitle">Please enter your details to continue</p>

        <div className="card form-card">
          {authError ? <p className="form-footer" style={{ color: 'crimson' }}>{authError}</p> : null}
          {statusMsg ? <p className="form-footer" style={{ color: 'green' }}>{statusMsg}</p> : null}

          <form onSubmit={onSave}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                value={rawName}
                onChange={(e) => {
                  // Let the user type freely (including spaces)
                  setRawName(e.target.value)
                }}
                className="form-input"
                placeholder="John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="form-input"
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                className="form-input"
                placeholder="123 Main St"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address line 2</label>
              <input
                type="text"
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                className="form-input"
                placeholder="Apt 2"
              />
            </div>

            <div className="form-group">
              <label className="form-label">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="form-input"
                placeholder="Clemson"
              />
            </div>

            <div className="form-group">
              <label className="form-label">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="form-input"
                placeholder="SC"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Postal Code</label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="form-input"
                placeholder="29631"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="form-input"
                placeholder="US"
              />
            </div>

            <button type="submit" className="btn btn-success btn-block" disabled={saving}>
              {saving ? 'Saving…' : 'Save details'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

// ============ CHANGE PASSWORD PAGE ============
const ChangePasswordPage = () => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    setSaving(true)
    try {
      await api('/me/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })
      setMessage('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Change password</h1>
        <p className="page-subtitle">Update your account password</p>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="form-input"
                placeholder="Enter current password"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="Enter new password (min 8 characters)"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="Confirm new password"
                required
              />
            </div>
            {error ? <p className="form-footer" style={{ color: 'crimson' }}>{error}</p> : null}
            {message ? <p className="form-footer" style={{ color: 'green' }}>{message}</p> : null}
            <div className="profile-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Updating…' : 'Update password'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setCurrentPage('profile')}>
                Back to profile
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

// ============ RESET PASSWORD PAGE ============
const ResetPasswordPage = ({ prefill }) => {
  const [email, setEmail] = useState(prefill?.email || '')
  const [token, setToken] = useState(prefill?.token || '')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [localError, setLocalError] = useState('')
  const [resetUrl, setResetUrl] = useState('')

  // Keep in sync if the app updates prefill (deep-link)
  useEffect(() => {
    if (prefill?.email) setEmail(prefill.email)
    if (prefill?.token) setToken(prefill.token)
  }, [prefill?.email, prefill?.token])

  const hasToken = Boolean((token || '').trim())

  const toCurrentOrigin = (maybeUrl) => {
    // Backend currently returns http://localhost:5173/... for dev.
    // When deployed, rewrite to the current origin so clicking works.
    try {
      const u = new URL(maybeUrl)
      return `${window.location.origin}${u.pathname}${u.search}${u.hash}`
    } catch {
      return maybeUrl
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    setMessage('')
    setResetUrl('')

    if (!email.trim()) {
      setLocalError('Please enter your email')
      return
    }

    // STEP 1: request reset link
    if (!hasToken) {
      setSubmitting(true)
      try {
        const data = await api('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim() })
        })

        setSubmitted(true)
        setMessage('If that account exists, a reset link has been generated.')

        // Your backend returns resetUrl (since no email system yet)
        if (data?.resetUrl) {
          const fixed = toCurrentOrigin(data.resetUrl)
          setResetUrl(fixed)

          // auto-fill token/email from returned link
          try {
            const u = new URL(fixed)
            const p = new URLSearchParams(u.search)
            const nextEmail = p.get('email') || email.trim()
            const nextToken = p.get('token') || ''
            if (nextToken) {
              setEmail(nextEmail)
              setToken(nextToken)
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        setLocalError(err.message || 'Failed to send reset link')
        if (err?.responseBody) console.error('Forgot-password error response:', err.responseBody)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // STEP 2: reset password using token
    if (newPassword.length < 8) {
      setLocalError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('New password and confirmation do not match')
      return
    }

    setSubmitting(true)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          token: token.trim(),
          newPassword
        })
      })

      setSubmitted(true)
      setMessage('Password reset successful. You can now sign in with your new password.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setLocalError(err.message || 'Failed to reset password')
      if (err?.responseBody) console.error('Reset-password error response:', err.responseBody)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">Reset password</h1>
        <p className="login-subtitle">Enter your email to reset your password</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="form-input"
              required
            />
          </div>

          {hasToken ? (
            <>
              <div className="form-group">
                <label className="form-label">Reset token</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token from reset link"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="form-input"
                  required
                />
              </div>
            </>
          ) : null}

          {localError ? <p className="form-footer" style={{ color: 'crimson' }}>{localError}</p> : null}
          {message ? <p className="form-footer" style={{ color: 'green' }}>{message}</p> : null}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? (hasToken ? 'Resetting…' : 'Sending…') : (hasToken ? 'Reset password' : 'Send reset link')}
          </button>
        </form>

        {resetUrl ? (
          <p className="form-footer">
            Reset link (dev):{' '}
            <a className="link" href={resetUrl} target="_blank" rel="noreferrer">Open reset link</a>
          </p>
        ) : null}

        {!hasToken && submitted ? (
          <p className="form-footer">
            If email sending isn&apos;t configured, the server returns a reset link for testing.
          </p>
        ) : null}

        <p className="form-footer">
          Remembered your password?{' '}
          <a
            href="#"
            className="link"
            onClick={(e) => {
              e.preventDefault()
              setAuthError('')
              setStatusMsg('')
              setResetPrefill({ email: '', token: '' })
              // Clean up URL params so refresh doesn't reopen reset flow
              try {
                const u = new URL(window.location.href)
                u.searchParams.delete('page')
                u.searchParams.delete('email')
                u.searchParams.delete('token')
                window.history.replaceState({}, '', u.toString())
              } catch {
                // ignore
              }
              setCurrentPage('login')
            }}
          >
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  )
}

// ============ CREATE ACCOUNT PAGE ============
const CreateAccountPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    DOB: '',
    email: '',
    password: '',
    miles: 0
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    await handleRegister({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      dob: formData.DOB
    })

    // do not clear fields immediately; they will be used to prefill details prompt
  }

  return (
    <div>
      <main className="app-main">
        <h1 className="page-title">
          {pendingRole === 'sponsor' ? 'Create Sponsor Account' : 'Create Driver Account'}
        </h1>
        <p className="page-subtitle">
          {pendingRole === 'sponsor'
            ? 'Create a sponsor account to post opportunities and reward drivers.'
            : 'Create a driver account to start logging trips and earning points.'}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              placeholder="John Doe"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <input
              type="date"
              value={formData.DOB}
              onChange={(e) => setFormData({ ...formData, DOB: e.target.value })}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="form-input"
              placeholder="john@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="form-input"
              placeholder="Password"
              required
            />
          </div>

          {authError ? <p className="form-footer" style={{ color: 'crimson' }}>{authError}</p> : null}
          {statusMsg ? <p className="form-footer" style={{ color: 'green' }}>{statusMsg}</p> : null}

          <button type="submit" className="btn btn-success btn-block">Create account</button>
        </form>
      </main>
    </div>
  )
}


// ============ APPLICATIONS PAGE (for sponsors) ============
const ApplicationsPage = () => {
  const [ads, setAds] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    benefits: ''
  })

  const loadAds = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api('/ads', { method: 'GET' })
      setAds(data.ads || [])
    } catch (err) {
      setError(err.message || 'Failed to load ads')
    } finally {
      setLoading(false)
    }
  }

  const loadApplications = async () => {
    try {
      const data = await api('/applications', { method: 'GET' })
      setApplications(data.applications || [])
    } catch (err) {
      console.error('Failed to load applications:', err)
    }
  }

  useEffect(() => {
    loadAds()
    loadApplications()
  }, [])

  const handleCreateAd = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await api('/ads', {
        method: 'POST',
        body: JSON.stringify(formData)
      })

      setFormData({ title: '', description: '', requirements: '', benefits: '' })
      setShowCreateForm(false)
      await loadAds()
    } catch (err) {
      setError(err.message || 'Failed to create ad')
    }
  }

  const handleDeleteAd = async (adId) => {
    if (!window.confirm('Are you sure you want to delete this ad?')) return

    try {
      await api(`/ads/${adId}`, { method: 'DELETE' })
      await loadAds()
    } catch (err) {
      setError(err.message || 'Failed to delete ad')
    }
  }

  const handleApplicationAction = async (applicationId, action) => {
    try {
      await api(`/applications/${applicationId}`, {
        method: 'PUT',
        // Map UI label 'approved' -> 'accepted' to match DB enum.
        body: JSON.stringify({ status: action === 'approved' ? 'accepted' : action })
      })
      await loadApplications()
    } catch (err) {
      setError(err.message || `Failed to ${action} application`)
    }
  }

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Driver Applications</h1>
        <p className="page-subtitle">Manage your sponsorship ads and applications</p>

        {error && <p style={{ color: 'crimson', marginBottom: 20 }}>{error}</p>}

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="section-title">Your Sponsorship Ads</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : 'Create New Ad'}
            </button>
          </div>

          {showCreateForm && (
            <div className="card form-card" style={{ marginBottom: 20 }}>
              <h3>Create Sponsorship Ad</h3>
              <form onSubmit={handleCreateAd}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="form-input"
                    placeholder="e.g., Join Our Driver Program"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="form-input"
                    placeholder="Describe your sponsorship program..."
                    rows="3"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Requirements</label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    className="form-input"
                    placeholder="What do you require from drivers?"
                    rows="2"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Benefits</label>
                  <textarea
                    value={formData.benefits}
                    onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                    className="form-input"
                    placeholder="What benefits do you offer?"
                    rows="2"
                  />
                </div>
                <button type="submit" className="btn btn-success btn-block">
                  Create Ad
                </button>
              </form>
            </div>
          )}

          {loading ? (
            <p>Loading ads...</p>
          ) : ads.length === 0 ? (
            <div className="card">
              <p className="activity-empty">No ads created yet. Create one to start receiving applications!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {ads.map(ad => (
                <div key={ad.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <h3>{ad.title}</h3>
                      <p style={{ margin: '8px 0' }}>{ad.description}</p>
                      {ad.requirements && (
                        <p style={{ fontSize: '0.9em', color: '#666' }}>
                          <strong>Requirements:</strong> {ad.requirements}
                        </p>
                      )}
                      {ad.benefits && (
                        <p style={{ fontSize: '0.9em', color: '#666' }}>
                          <strong>Benefits:</strong> {ad.benefits}
                        </p>
                      )}
                      <p style={{ fontSize: '0.85em', color: '#999', marginTop: 8 }}>
                        Created: {ad.created_at ? new Date(ad.created_at).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteAd(ad.id)}
                      style={{ marginLeft: 16 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 className="section-title">Received Applications</h2>
          {applications.length === 0 ? (
            <p className="activity-empty">No applications received yet</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Applied</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
<<<<<<< HEAD
  {
    applications.map(app => (
      <tr key={app.id}>
        <td>{app.driver_name || 'Unknown'}</td>
        <td>{app.driver_email || '-'}</td>
        <td>
          <span style={{
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: '0.85em',
            backgroundColor:
              app.status === 'approved' ? '#d4edda' :
                app.status === 'rejected' ? '#f8d7da' :
                  '#fff3cd',
            color:
              app.status === 'approved' ? '#155724' :
                app.status === 'rejected' ? '#721c24' :
                  '#856404'
          }}>
            {app.status || 'pending'}
          </span>
        </td>
        <td>{app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '-'}</td>
        <td>
          {app.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-success"
                style={{ fontSize: '0.85em', padding: '4px 12px' }}
                onClick={() => handleApplicationAction(app.id, 'approved')}
              >
                Approve
              </button>
              <button
                className="btn btn-danger"
                style={{ fontSize: '0.85em', padding: '4px 12px' }}
                onClick={() => handleApplicationAction(app.id, 'rejected')}
              >
                Reject
              </button>
            </div>
          )}
        </td>
      </tr>
    ))
  }
                  </tbody >
=======
  {applications.map(app => (
    <tr key={app.id}>
      <td>{app.driver_name || [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Unknown'}</td>
      <td>{app.driver_email || app.email || '-'}</td>
      <td>
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: 4, 
          fontSize: '0.85em',
          backgroundColor: 
            app.status === 'accepted' ? '#d4edda' : 
            app.status === 'rejected' ? '#f8d7da' : 
            '#fff3cd',
          color:
            app.status === 'accepted' ? '#155724' : 
            app.status === 'rejected' ? '#721c24' : 
            '#856404'
        }}>
          {app.status || 'pending'}
        </span>
      </td>
      <td>{app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '-'}</td>
      <td>
        {app.status === 'pending' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn btn-success" 
              style={{ fontSize: '0.85em', padding: '4px 12px' }}
              onClick={() => handleApplicationAction(app.id, 'accepted')}
            >
              Accept
            </button>
            <button 
              className="btn btn-danger" 
              style={{ fontSize: '0.85em', padding: '4px 12px' }}
              onClick={() => handleApplicationAction(app.id, 'rejected')}
            >
              Reject
            </button>
          </div>
        )}
      </td>
    </tr>
  ))}
</tbody>
>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424
                </table >
              </div >
            )}
          </section >
        </main >
      </div >
    )
  }


// ============ MAIN RENDER ============
return (
  <div>
    {!isLoggedIn && currentPage === 'landing' && <LandingPage />}
    {!isLoggedIn && currentPage === 'login' && <LoginPage />}
<<<<<<< HEAD
{ !isLoggedIn && currentPage === 'create-account' && <CreateAccountPage /> }
{ !isLoggedIn && currentPage === 'reset-password' && <ResetPasswordPage prefill={resetPrefill} /> }

{
  isLoggedIn && (() => {
    const allowed = getAllowedPages(currentUser)
    return (
      <>
        {allowed.includes('dashboard') && currentPage === 'dashboard' && <DashboardPage />}
        {allowed.includes('log-trip') && currentPage === 'log-trip' && <LogTripPage />}
        {allowed.includes('rewards') && currentPage === 'rewards' && <RewardsPage />}
        {allowed.includes('leaderboard') && currentPage === 'leaderboard' && <LeaderboardPage />}
        {allowed.includes('achievements') && currentPage === 'achievements' && <AchievementsPage />}
        {allowed.includes('profile') && currentPage === 'profile' && <ProfilePage />}
        {allowed.includes('sponsor-affiliation') && currentPage === 'sponsor-affiliation' && <SponsorAffiliationPage />}
        {allowed.includes('account-details') && currentPage === 'account-details' && <AccountDetailsPage />}
        {allowed.includes('change-password') && currentPage === 'change-password' && <ChangePasswordPage />}
        {allowed.includes('applications') && currentPage === 'applications' && <ApplicationsPage />}
        {allowed.includes('catalog') && currentPage === 'catalog' && <SponsorCatalogPage />}
        {allowed.includes('about') && currentPage === 'about' && <About />}
        {/* Safety fallback: render dashboard if currentPage somehow invalid */}
        {(!allowed.includes(currentPage)) && <DashboardPage />}
      </>
    )
  })()
}
=======
      {!isLoggedIn && currentPage === 'login-sponsor' && <SponsorLoginPage />}
      {!isLoggedIn && currentPage === 'account-type' && <AccountTypePage />}
      {/* ... other not-logged-in renders ... */}
      {/* Logged-in page renders */}
      {isLoggedIn && currentPage === 'dashboard' && <DashboardPage />}
      {isLoggedIn && currentPage === 'log-trip' && <LogTripPage />}
      {isLoggedIn && currentPage === 'rewards' && <RewardsPage />}
      {isLoggedIn && currentPage === 'leaderboard' && <LeaderboardPage />}
      {isLoggedIn && currentPage === 'achievements' && <AchievementsPage />}
      {isLoggedIn && currentPage === 'profile' && <ProfilePage />}
      {isLoggedIn && currentPage === 'account-details' && <AccountDetailsPage />}
      {isLoggedIn && currentPage === 'change-password' && <ChangePasswordPage />}
      {isLoggedIn && currentPage === 'sponsor-affiliation' && <SponsorAffiliationPage />}
      {/* Sponsor-only pages */}
      {isLoggedIn && currentPage === 'applications' && <ApplicationsPage />}
      {isLoggedIn && currentPage === 'drivers' && <SponsorDriversPage />}
      {isLoggedIn && currentPage === 'about' && <About />}
      {/* ... any additional page renders ... */}
>>>>>>> 04d37aeab384d14d4961ccf52db9b57d0c05c424
    </div >
  )
}

export default App