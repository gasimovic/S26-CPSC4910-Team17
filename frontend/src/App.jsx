import React, { useEffect, useMemo, useState, useRef } from 'react'

function App() {
  // ============ STATE MANAGEMENT ============
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState('landing')
  const [currentUser, setCurrentUser] = useState(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingRole, setPendingRole] = useState('driver') // chosen role for new accounts (driver | sponsor)
  // Prefill for reset-password deep links (?page=reset-password&email=...&token=...)
  const [resetPrefill, setResetPrefill] = useState({ email: '', token: '' })

  // Tracks when navigation came from the browser's back/forward
  // buttons so we don't immediately push another history entry.
  const historyNavRef = useRef(false)

  const pageToPath = (page) => {
    switch (page) {
      case 'landing':
        return '/'
      case 'login':
        return '/login'
      case 'account-type':
        return '/account-type'
      case 'create-account':
        return '/create-account'
      case 'reset-password':
        return '/reset-password'
      case 'dashboard':
        return '/dashboard'
      case 'log-trip':
        return '/log-trip'
      case 'applications':
        return '/applications'
      case 'drivers':
        return '/drivers'
      case 'catalog':
        return '/catalog'
      case 'messages':
        return '/messages'
      case 'rewards':
        return '/rewards'
      case 'leaderboard':
        return '/leaderboard'
      case 'achievements':
        return '/achievements'
      case 'profile':
        return '/profile'
      case 'account-details':
        return '/account-details'
      case 'change-password':
        return '/change-password'
      case 'sponsor-affiliation':
        return '/sponsor-affiliation'
      case 'admin-users':
        return '/admin-users'
      case 'about':
        return '/about'
      case 'point-management':
        return '/point-management'
      default:
        return '/'
    }
  }

  const pathToPage = (pathname, searchParams) => {
    const rawPath = (pathname || '/').toLowerCase()
    const path = rawPath.replace(/\/+$/, '') || '/'

    if (path === '/' || path === '') return 'landing'
    if (path === '/login') return 'login'
    if (path === '/account-type') return 'account-type'
    if (path === '/create-account') return 'create-account'
    if (path === '/reset-password') return 'reset-password'
    if (path === '/dashboard') return 'dashboard'
    if (path === '/log-trip') return 'log-trip'
    if (path === '/applications') return 'applications'
    if (path === '/drivers') return 'drivers'
    if (path === '/catalog') return 'catalog'
    if (path === '/messages') return 'messages'
    if (path === '/rewards') return 'rewards'
    if (path === '/leaderboard') return 'leaderboard'
    if (path === '/achievements') return 'achievements'
    if (path === '/profile') return 'profile'
    if (path === '/account-details') return 'account-details'
    if (path === '/change-password') return 'change-password'
    if (path === '/sponsor-affiliation') return 'sponsor-affiliation'
    if (path === '/admin-users') return 'admin-users'
    if (path === '/about') return 'about'
    if (path === '/point-management') return 'point-management'

    // Back-compat: if the path is unknown, fall back to any legacy ?page= value.
    const pageFromQuery = (searchParams.get('page') || '').toLowerCase()
    if (pageFromQuery) return pageFromQuery

    return 'landing'
  }

  // Keep the browser URL in sync with the current page so that
  // each page has its own URL and can be bookmarked.
  useEffect(() => {
    if (typeof window === 'undefined') return

    // If this change was triggered by a browser history
    // navigation (back/forward), skip pushing a new entry.
    if (historyNavRef.current) {
      historyNavRef.current = false
      return
    }

    try {
      const url = new URL(window.location.href)
      const targetPath = pageToPath(currentPage)

      if (url.pathname !== targetPath) {
        url.pathname = targetPath
      }

      // We no longer rely on ?page=, so strip it out. Keep any
      // other query parameters (like reset-password email/token).
      url.searchParams.delete('page')

      // Push the updated URL into the browser history so that
      // navigation updates the address bar.
      window.history.pushState({ page: currentPage }, '', url.toString())
    } catch {
      // If URL manipulation fails for any reason, do nothing.
    }
  }, [currentPage])

  // ======= API base selection (supports logging in as driver OR sponsor without changing .env) =======
  // Vite proxy bases (same-origin). These MUST match `vite.config.js`.
  const DRIVER_API_BASE = (import.meta.env.VITE_DRIVER_API_BASE || '/api/driver').replace(/\/$/, '')
  const ADMIN_API_BASE = (import.meta.env.VITE_ADMIN_API_BASE || '/api/admin').replace(/\/$/, '')
  const SPONSOR_API_BASE = (import.meta.env.VITE_SPONSOR_API_BASE || '/api/sponsor').replace(/\/$/, '')

  // Default base from env (back-compat). If missing, default to driver.
  const envRole = (import.meta.env.VITE_ACTIVE_ROLE || 'driver').toLowerCase()
  const envDefaultBase =
    envRole === 'admin' ? ADMIN_API_BASE :
      envRole === 'sponsor' ? SPONSOR_API_BASE :
        DRIVER_API_BASE

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
      points: Number(userObj.points ?? 0),
      totalEarned: Number(userObj.points_earned ?? userObj.total_points_earned ?? 0),
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

  // On initial load, try to restore an existing session using the
  // backend session cookie. This makes refreshes and direct visits
  // to routes like /dashboard work without logging the user out.
  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      try {
        const u = await loadMe()
        if (cancelled) return
        setIsLoggedIn(true)
        setCurrentUser(u)
      } catch (err) {
        // If the user is not authenticated (401/403), stay logged out.
        const status = err?.status
        if (status === 401 || status === 403) return
        // For other errors (network, server issues), just log to console
        // so the UI doesn't get stuck in an error state on load.
        console.error('Failed to restore session on load:', err)
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

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
    // 1. DETERMINE ROLE: 
    // Use the user object role if available, otherwise fall back to the apiBase
    const role = (user?.role || inferRoleFromBase(apiBase) || 'driver').toString().trim().toLowerCase();
    const hasSponsor = Boolean((user?.profile?.sponsor_org || '').toString().trim());

    // 2. DEFINE PAGE SETS:
    // We define these in variables so we can use them for both the "loading" state 
    // (when user is null) and the "final" state.

    const adminPages = [
      'dashboard',
      'admin-users',
      'profile',
      'account-details',
      'change-password',
      'about'
    ];

    const sponsorPages = [
      'dashboard',
      'drivers',
      'point-management',
      'applications',
      'catalog',
      'messages',
      'profile',
      'account-details',
      'change-password',
      'about'
    ];

    const driverPages = hasSponsor
      ? ['dashboard', 'log-trip', 'rewards', 'leaderboard', 'achievements', 'messages', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about']
      : ['dashboard', 'messages', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about'];

    // 3. RETURN BASED ON ROLE:
    if (role === 'admin') return adminPages;
    if (role === 'sponsor') return sponsorPages;
    if (role === 'driver') return driverPages;

    // Fallback
    return ['dashboard', 'profile', 'about'];
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
    const candidates = [
      apiBase,
      DRIVER_API_BASE,
      SPONSOR_API_BASE,
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
        throw new Error('Invalid credentials (HTTP 401).')
      }

      // Load /me first so we know the authoritative role, then lock the apiBase to the correct service.
      const me = await apiWithBase(chosenBase, '/me', { method: 'GET' })
      const meUser = me?.user || me || {}
      const roleFromMe = String(meUser.role || inferRoleFromBase(chosenBase) || 'driver').toLowerCase()

      const baseForRole =
        roleFromMe === 'admin' ? ADMIN_API_BASE :
          roleFromMe === 'sponsor' ? SPONSOR_API_BASE :
            DRIVER_API_BASE

      setApiBasePersisted(baseForRole)
      setStatusMsg('Signed in. Loading your profile…')

      const u = await (async () => {
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
            role: (userObj.role || roleFromMe),
            points: Number(userObj.points ?? 0),
            totalEarned: Number(userObj.points_earned ?? userObj.total_points_earned ?? 0),
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

      const targetPage = profileLooksEmpty(u) ? 'account-details' : 'dashboard'
      const targetMsg = profileLooksEmpty(u) ? 'Welcome! Please complete your account details.' : ''
      setIsLoggedIn(true)
      setCurrentPage(targetPage)
      setStatusMsg(targetMsg)
    } catch (err) {
      setIsLoggedIn(false)
      setCurrentUser(null)
      setAuthError(err.message || 'Login failed')
      if (err?.responseBody) console.error('Login error response:', err.responseBody)
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
      setStatusMsg('Account created. Loading your profile…')

      // Load the user profile from backend
      await loadMe()

      // Batch isLoggedIn + currentPage in one render to avoid white screen
      setIsLoggedIn(true)
      setCurrentPage('account-details')
      setStatusMsg('Account created. Please complete your account details.')
    } catch (err) {
      setIsLoggedIn(false)
      setCurrentUser(null)
      setAuthError(err.message || 'Registration failed')
      if (err?.responseBody) console.error('Register error response:', err.responseBody)
    }
  }

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

  // Keep the current page in sync with the URL when the user
  // uses the browser back/forward buttons or loads a deep link.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const applyPageFromUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const pageFromPath = pathToPage(window.location.pathname, params)

        if (pageFromPath === 'reset-password') {
          const email = params.get('email') || ''
          const token = params.get('token') || ''
          setResetPrefill({ email, token })
          setAuthError('')
          setStatusMsg('')
          setCurrentPage('reset-password')
          return
        }

        // Back-compat: redirect legacy sponsor login deep links to unified login
        if (pageFromPath === 'login-sponsor' || pageFromPath === 'login') {
          setAuthError('')
          setStatusMsg('')
          setCurrentPage('login')
          return
        }

        setCurrentPage(pageFromPath || 'landing')
      } catch {
        // ignore
      }
    }

    // Handle the initial load (refresh/direct deep link).
    applyPageFromUrl()

    // Handle browser back/forward navigation.
    const onPopState = () => {
      historyNavRef.current = true
      applyPageFromUrl()
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
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
                  Sign in
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
              Sign in
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
          <p className="login-subtitle">Sign in (drivers, sponsors, and admins)</p>

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

            <div className="login-secondary-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setAuthError('')
                  setStatusMsg('')
                  setCurrentPage('landing')
                }}
              >
                ← Back
              </button>
            </div>
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

  // ============ NAVIGATION COMPONENT ============
  const Navigation = () => {
    const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
    const allowed = getAllowedPages(currentUser)

    const isDriver = role === 'driver'
    const isSponsor = role === 'sponsor'
    const isAdmin = role === 'admin'

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

          {/* Sponsor-only: Drivers button */}
          {isSponsor && allowed.includes('drivers') && (
            <button type="button" onClick={() => setCurrentPage('drivers')} className="nav-link">
              Drivers
            </button>
          )}

          {/* Sponsor-only: Point Management button */}
          {isSponsor && allowed.includes('point-management') && (
            <button type="button" onClick={() => setCurrentPage('point-management')} className="nav-link">
              Points
            </button>
          )}

          {/* Sponsor-only: Catalog button */}
          {isSponsor && allowed.includes('catalog') && (
            <button type="button" onClick={() => setCurrentPage('catalog')} className="nav-link">
              Catalog
            </button>
          )}

          {/* Messages — sponsors and drivers */}
          {(isSponsor || isDriver) && allowed.includes('messages') && (
            <button type="button" onClick={() => setCurrentPage('messages')} className="nav-link">
              Messages
            </button>
          )}

          {/* Driver-only */}
          {isDriver && allowed.includes('rewards') && (
            <button type="button" onClick={() => setCurrentPage('rewards')} className="nav-link">
              Rewards
            </button>
          )}
          {isDriver && allowed.includes('leaderboard') && (
            <button type="button" onClick={() => setCurrentPage('leaderboard')} className="nav-link">
              Leaderboard
            </button>
          )}
          {isDriver && allowed.includes('achievements') && (
            <button type="button" onClick={() => setCurrentPage('achievements')} className="nav-link">
              Achievements
            </button>
          )}

          {allowed.includes('about') && (
            <button type="button" onClick={() => setCurrentPage('about')} className="nav-link">
              About
            </button>
          )}

          {allowed.includes('profile') && (
            <button type="button" onClick={() => setCurrentPage('profile')} className="nav-link">
              Profile
            </button>
          )}

          {/* Driver-only */}
          {isDriver && allowed.includes('sponsor-affiliation') && (
            <button type="button" onClick={() => setCurrentPage('sponsor-affiliation')} className="nav-link">
              Sponsor
            </button>
          )}

          {isAdmin && allowed.includes('admin-users') && (
            <button type="button" onClick={() => setCurrentPage('admin-users')} className="nav-link">Users</button>
          )}

          {/* Points are only meaningful for drivers; keep UI clean for sponsors/admin */}
          {isDriver ? <span className="nav-pts">{currentUser?.points ?? 0} pts</span> : null}

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="nav-logout"
          >
            Log out
          </button>
        </div>
      </nav>
    )
  }

  // ============ POINT MANAGEMENT PAGE (sponsor) ============
  // Covers: bulk add/deduct (#2854, #2855), scheduled/recurring awards (#2856, #2868),
  // pause (#2857), cancel (#2869), calendar view (#2870), point expiration (#2858),
  // analytics (#2862, #2863, #2864)
  const PointManagementPage = () => {
    const [activeTab, setActiveTab] = useState('analytics')
    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Bulk points state
    const [bulkSelectedIds, setBulkSelectedIds] = useState(new Set())
    const [bulkPoints, setBulkPoints] = useState('')
    const [bulkReason, setBulkReason] = useState('')
    const [bulkAction, setBulkAction] = useState('add') // 'add' | 'deduct'

    // Scheduled awards state
    const [awards, setAwards] = useState([])
    const [newAward, setNewAward] = useState({ driverId: '', points: '', reason: '', frequency: 'once', scheduledDate: '', isRecurring: false })

    // Expiration rule state
    const [expirationRule, setExpirationRule] = useState(null)
    const [expiryDays, setExpiryDays] = useState('')
    const [expiryActive, setExpiryActive] = useState(true)

    // Analytics state
    const [analytics, setAnalytics] = useState(null)

    // Calendar view state
    const [calendarMonth, setCalendarMonth] = useState(() => {
      const now = new Date()
      return { year: now.getFullYear(), month: now.getMonth() }
    })

    const loadDrivers = async () => {
      try {
        const data = await api('/drivers', { method: 'GET' })
        setDrivers(Array.isArray(data?.drivers) ? data.drivers : [])
      } catch (e) {
        setError(e?.message || 'Failed to load drivers')
      }
    }

    const loadAwards = async () => {
      try {
        const data = await api('/scheduled-awards', { method: 'GET' })
        setAwards(Array.isArray(data?.awards) ? data.awards : [])
      } catch (e) {
        setError(e?.message || 'Failed to load scheduled awards')
      }
    }

    const loadExpiration = async () => {
      try {
        const data = await api('/point-expiration', { method: 'GET' })
        setExpirationRule(data?.rule || null)
        if (data?.rule) {
          setExpiryDays(String(data.rule.expiry_days))
          setExpiryActive(Boolean(data.rule.is_active))
        }
      } catch (e) {
        setError(e?.message || 'Failed to load expiration rule')
      }
    }

    const loadAnalytics = async () => {
      try {
        const data = await api('/analytics/points', { method: 'GET' })
        setAnalytics(data || null)
      } catch (e) {
        setError(e?.message || 'Failed to load analytics')
      }
    }

    useEffect(() => {
      setLoading(true)
      Promise.all([loadDrivers(), loadAwards(), loadExpiration(), loadAnalytics()])
        .finally(() => setLoading(false))
    }, [])

    // ── Bulk Points ──
    const toggleBulkSelect = (id) => {
      setBulkSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
      })
    }

    const selectAllDrivers = () => {
      if (bulkSelectedIds.size === drivers.length) {
        setBulkSelectedIds(new Set())
      } else {
        setBulkSelectedIds(new Set(drivers.map(d => d.id)))
      }
    }

    const submitBulkPoints = async () => {
      setError(''); setSuccess('')
      const pts = Number(bulkPoints)
      if (!Number.isFinite(pts) || pts <= 0) { setError('Enter a positive point amount.'); return }
      if (!bulkReason.trim()) { setError('Reason is required.'); return }
      if (bulkSelectedIds.size === 0) { setError('Select at least one driver.'); return }

      try {
        const endpoint = bulkAction === 'add' ? '/drivers/bulk/points/add' : '/drivers/bulk/points/deduct'
        const data = await api(endpoint, {
          method: 'POST',
          body: JSON.stringify({ driverIds: Array.from(bulkSelectedIds), points: pts, reason: bulkReason.trim() })
        })
        const okCount = (data?.results || []).filter(r => r.ok).length
        const failCount = (data?.results || []).filter(r => !r.ok).length
        setSuccess(`Bulk ${bulkAction}: ${okCount} succeeded${failCount > 0 ? `, ${failCount} failed` : ''}.`)
        setBulkPoints(''); setBulkReason(''); setBulkSelectedIds(new Set())
        await Promise.all([loadDrivers(), loadAnalytics()])
      } catch (e) {
        setError(e?.message || 'Bulk operation failed')
      }
    }

    // ── Scheduled Awards ──
    const createAward = async () => {
      setError(''); setSuccess('')
      const pts = Number(newAward.points)
      if (!Number.isFinite(pts) || pts <= 0) { setError('Enter a positive point amount.'); return }
      if (!newAward.reason.trim()) { setError('Reason is required.'); return }
      if (!newAward.scheduledDate) { setError('Date is required.'); return }

      try {
        await api('/scheduled-awards', {
          method: 'POST',
          body: JSON.stringify({
            driverId: newAward.driverId ? Number(newAward.driverId) : null,
            points: pts,
            reason: newAward.reason.trim(),
            frequency: newAward.frequency,
            scheduledDate: newAward.scheduledDate,
            isRecurring: newAward.isRecurring,
          })
        })
        setSuccess('Scheduled award created.')
        setNewAward({ driverId: '', points: '', reason: '', frequency: 'once', scheduledDate: '', isRecurring: false })
        await loadAwards()
      } catch (e) {
        setError(e?.message || 'Failed to create scheduled award')
      }
    }

    const pauseAward = async (id) => {
      setError(''); setSuccess('')
      try {
        await api(`/scheduled-awards/${id}/pause`, { method: 'PUT' })
        setSuccess('Award paused.')
        await loadAwards()
      } catch (e) { setError(e?.message || 'Failed to pause award') }
    }

    const resumeAward = async (id) => {
      setError(''); setSuccess('')
      try {
        await api(`/scheduled-awards/${id}/resume`, { method: 'PUT' })
        setSuccess('Award resumed.')
        await loadAwards()
      } catch (e) { setError(e?.message || 'Failed to resume award') }
    }

    const cancelAward = async (id) => {
      setError(''); setSuccess('')
      if (!window.confirm('Delete this scheduled award?')) return
      try {
        await api(`/scheduled-awards/${id}`, { method: 'DELETE' })
        setSuccess('Scheduled award deleted.')
        await loadAwards()
      } catch (e) { setError(e?.message || 'Failed to delete award') }
    }

    // ── Expiration ──
    const saveExpiration = async () => {
      setError(''); setSuccess('')
      const days = Number(expiryDays)
      if (!Number.isFinite(days) || days <= 0) { setError('Enter a positive number of days.'); return }
      try {
        await api('/point-expiration', {
          method: 'PUT',
          body: JSON.stringify({ expiryDays: days, isActive: expiryActive })
        })
        setSuccess('Expiration rule saved.')
        await loadExpiration()
      } catch (e) { setError(e?.message || 'Failed to save expiration rule') }
    }

    // ── Calendar helpers ──
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
    const getFirstDayOfWeek = (year, month) => new Date(year, month, 1).getDay()

    const calendarAwards = useMemo(() => {
      const map = {}
      for (const a of awards) {
        const d = a.scheduled_date ? a.scheduled_date.substring(0, 10) : null
        if (d) {
          if (!map[d]) map[d] = []
          map[d].push(a)
        }
      }
      return map
    }, [awards])

    const prevMonth = () => setCalendarMonth(p => {
      let m = p.month - 1, y = p.year
      if (m < 0) { m = 11; y-- }
      return { year: y, month: m }
    })
    const nextMonth = () => setCalendarMonth(p => {
      let m = p.month + 1, y = p.year
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    const tabs = [
      { key: 'analytics', label: 'Analytics' },
      { key: 'bulk', label: 'Bulk Points' },
      { key: 'scheduled', label: 'Scheduled Awards' },
      { key: 'calendar', label: 'Calendar' },
      { key: 'expiration', label: 'Expiration Rules' },
    ]

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Point Management</h1>
          <p className="page-subtitle">Bulk operations, scheduling, analytics, and expiration rules</p>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setActiveTab(t.key); setError(''); setSuccess('') }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && <p className="form-footer" style={{ color: 'crimson' }}>{error}</p>}
          {success && <p className="form-footer" style={{ color: 'green' }}>{success}</p>}

          {/* ── Analytics Tab ── */}
          {activeTab === 'analytics' && (
            <div>
              {loading || !analytics ? (
                <p>Loading analytics...</p>
              ) : (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <p className="stat-label">Total Unredeemed Points</p>
                      <p className="stat-value stat-value-blue">{Number(analytics.totalUnredeemed || 0).toLocaleString()}</p>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Awarded This Month</p>
                      <p className="stat-value stat-value-green">{Number(analytics.totalAwardedThisMonth || 0).toLocaleString()}</p>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Redeemed This Month</p>
                      <p className="stat-value stat-value-amber">{Number(analytics.totalRedeemedThisMonth || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {analytics.driverBreakdown && analytics.driverBreakdown.length > 0 && (
                    <div className="card" style={{ marginTop: 16 }}>
                      <h2 className="section-title" style={{ marginTop: 0 }}>Unredeemed Points by Driver</h2>
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr><th>Driver</th><th>Email</th><th className="text-right">Balance</th></tr>
                          </thead>
                          <tbody>
                            {analytics.driverBreakdown.map((d, i) => (
                              <tr key={i}>
                                <td>{(d.driver_name || '').trim() || '-'}</td>
                                <td>{d.driver_email || '-'}</td>
                                <td className="text-right">{Number(d.balance || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button className="btn btn-primary" type="button" onClick={loadAnalytics} style={{ marginTop: 12 }}>
                    Refresh Analytics
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Bulk Points Tab ── */}
          {activeTab === 'bulk' && (
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <h2 className="section-title" style={{ marginTop: 0 }}>Bulk Point Operation</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                  <select className="form-input" style={{ width: 140 }} value={bulkAction} onChange={e => setBulkAction(e.target.value)}>
                    <option value="add">Add Points</option>
                    <option value="deduct">Deduct Points</option>
                  </select>
                  <input className="form-input" style={{ width: 120 }} type="number" min="1" placeholder="Points" value={bulkPoints} onChange={e => setBulkPoints(e.target.value)} />
                  <input className="form-input" style={{ flex: 1, minWidth: 200 }} type="text" placeholder="Reason (required)" value={bulkReason} onChange={e => setBulkReason(e.target.value)} />
                  <button className="btn btn-success" type="button" onClick={submitBulkPoints}>
                    Apply to {bulkSelectedIds.size} driver{bulkSelectedIds.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>Select Drivers</h2>
                  <button className="btn btn-secondary" type="button" onClick={selectAllDrivers}>
                    {bulkSelectedIds.size === drivers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Driver</th>
                        <th>Email</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.length === 0 ? (
                        <tr><td colSpan="4" className="table-empty">No drivers found</td></tr>
                      ) : drivers.map(d => {
                        const id = d.id ?? d.user_id
                        const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || d.email
                        const pts = Number(d.pointsBalance ?? d.points_balance ?? 0)
                        return (
                          <tr key={id} style={{ cursor: 'pointer' }} onClick={() => toggleBulkSelect(id)}>
                            <td><input type="checkbox" checked={bulkSelectedIds.has(id)} readOnly /></td>
                            <td>{name}</td>
                            <td>{d.email || '-'}</td>
                            <td className="text-right">{pts}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Scheduled Awards Tab ── */}
          {activeTab === 'scheduled' && (
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <h2 className="section-title" style={{ marginTop: 0 }}>Create Scheduled Award</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
                  <select className="form-input" value={newAward.driverId} onChange={e => setNewAward(p => ({ ...p, driverId: e.target.value }))}>
                    <option value="">All Drivers</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {[d.first_name, d.last_name].filter(Boolean).join(' ') || d.email}
                      </option>
                    ))}
                  </select>
                  <input className="form-input" type="number" min="1" placeholder="Points" value={newAward.points} onChange={e => setNewAward(p => ({ ...p, points: e.target.value }))} />
                  <input className="form-input" type="text" placeholder="Reason" value={newAward.reason} onChange={e => setNewAward(p => ({ ...p, reason: e.target.value }))} />
                  <input className="form-input" type="date" value={newAward.scheduledDate} onChange={e => setNewAward(p => ({ ...p, scheduledDate: e.target.value }))} />
                  <select className="form-input" value={newAward.frequency} onChange={e => setNewAward(p => ({ ...p, frequency: e.target.value }))}>
                    <option value="once">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875em' }}>
                    <input type="checkbox" checked={newAward.isRecurring} onChange={e => setNewAward(p => ({ ...p, isRecurring: e.target.checked }))} />
                    Recurring
                  </label>
                </div>
                <button className="btn btn-success" type="button" onClick={createAward}>Create Award</button>
              </div>

              <div className="card">
                <h2 className="section-title" style={{ marginTop: 0 }}>Existing Scheduled Awards</h2>
                {awards.length === 0 ? (
                  <p className="activity-empty">No scheduled awards yet</p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th className="text-right">Points</th>
                          <th>Reason</th>
                          <th>Date</th>
                          <th>Frequency</th>
                          <th>Status</th>
                          <th style={{ width: 200 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {awards.map(a => (
                          <tr key={a.id}>
                            <td>{a.driver_name && a.driver_name.trim() ? a.driver_name.trim() : (a.driver_email || 'All Drivers')}</td>
                            <td className="text-right">{a.points}</td>
                            <td>{a.reason}</td>
                            <td>{a.scheduled_date ? a.scheduled_date.substring(0, 10) : '-'}</td>
                            <td>{a.frequency}{a.is_recurring ? ' (recurring)' : ''}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: '0.8em', fontWeight: 600,
                                background: a.is_paused ? '#fef3c7' : '#d1fae5',
                                color: a.is_paused ? '#92400e' : '#065f46',
                              }}>
                                {a.is_paused ? 'Paused' : 'Active'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {a.is_paused ? (
                                  <button className="btn btn-success" type="button" onClick={() => resumeAward(a.id)} style={{ fontSize: '0.8em', padding: '4px 8px' }}>Resume</button>
                                ) : (
                                  <button className="btn btn-secondary" type="button" onClick={() => pauseAward(a.id)} style={{ fontSize: '0.8em', padding: '4px 8px' }}>Pause</button>
                                )}
                                <button className="btn btn-danger" type="button" onClick={() => cancelAward(a.id)} style={{ fontSize: '0.8em', padding: '4px 8px' }}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Calendar Tab ── */}
          {activeTab === 'calendar' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <button className="btn btn-secondary" type="button" onClick={prevMonth}>&larr;</button>
                <h2 className="section-title" style={{ margin: 0 }}>
                  {monthNames[calendarMonth.month]} {calendarMonth.year}
                </h2>
                <button className="btn btn-secondary" type="button" onClick={nextMonth}>&rarr;</button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 2,
                textAlign: 'center',
              }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} style={{ fontWeight: 700, fontSize: '0.75em', padding: 4, color: '#6b7280' }}>{d}</div>
                ))}
                {Array.from({ length: getFirstDayOfWeek(calendarMonth.year, calendarMonth.month) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: getDaysInMonth(calendarMonth.year, calendarMonth.month) }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayAwards = calendarAwards[dateStr] || []
                  const today = new Date()
                  const isToday = today.getFullYear() === calendarMonth.year && today.getMonth() === calendarMonth.month && today.getDate() === day

                  return (
                    <div key={day} style={{
                      padding: 6,
                      minHeight: 60,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: isToday ? '#eff6ff' : dayAwards.length > 0 ? '#f0fdf4' : '#fff',
                      fontSize: '0.8em',
                    }}>
                      <div style={{ fontWeight: isToday ? 700 : 500, marginBottom: 2 }}>{day}</div>
                      {dayAwards.map(a => (
                        <div key={a.id} style={{
                          fontSize: '0.7em',
                          background: a.is_paused ? '#fef3c7' : '#d1fae5',
                          borderRadius: 3,
                          padding: '1px 4px',
                          marginBottom: 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          +{a.points} {a.reason?.substring(0, 15)}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Expiration Rules Tab ── */}
          {activeTab === 'expiration' && (
            <div className="card">
              <h2 className="section-title" style={{ marginTop: 0 }}>Point Expiration Rule</h2>
              <p className="page-subtitle" style={{ marginBottom: 12 }}>
                Set how many days after earning points they will expire. This prevents indefinite accumulation.
              </p>
              {expirationRule && (
                <p style={{ marginBottom: 12, fontSize: '0.875em', color: '#6b7280' }}>
                  Current rule: Points expire after <strong>{expirationRule.expiry_days}</strong> days
                  — Status: <strong>{expirationRule.is_active ? 'Active' : 'Inactive'}</strong>
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ width: 140 }}
                  type="number"
                  min="1"
                  placeholder="Days until expiry"
                  value={expiryDays}
                  onChange={e => setExpiryDays(e.target.value)}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875em' }}>
                  <input type="checkbox" checked={expiryActive} onChange={e => setExpiryActive(e.target.checked)} />
                  Active
                </label>
                <button className="btn btn-success" type="button" onClick={saveExpiration}>Save Rule</button>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ============ DRIVERS PAGE (for sponsors: adjust driver points + view ledger) ============
  const SponsorDriversPage = () => {
    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [query, setQuery] = useState('')

    // per-driver edit state
    const [deltaById, setDeltaById] = useState({})
    const [reasonById, setReasonById] = useState({})

    // ledger state
    const [selectedDriver, setSelectedDriver] = useState(null)
    const [ledger, setLedger] = useState([])
    const [ledgerBalance, setLedgerBalance] = useState(null)
    const [ledgerLoading, setLedgerLoading] = useState(false)

    // profile/details state
    const [selectedProfileDriver, setSelectedProfileDriver] = useState(null)

    const removeDriver = async (driver) => {
      setError('')
      setSuccess('')

      const driverId = driver?.id ?? driver?.user_id
      if (!driverId) {
        setError('Missing driver id')
        return
      }

      // Basic confirm to avoid accidental removals
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm('Remove this driver from your program? This keeps historical points but detaches them from your organization.')
      if (!confirmed) return

      try {
        await api(`/drivers/${driverId}`, { method: 'DELETE' })
        setSuccess(`Removed driver ${driverId} from your program.`)
        await loadDrivers()

        if ((selectedDriver?.id ?? selectedDriver?.user_id) === driverId) {
          setSelectedDriver(null)
          setLedger([])
          setLedgerBalance(null)
        }

        if ((selectedProfileDriver?.id ?? selectedProfileDriver?.user_id) === driverId) {
          setSelectedProfileDriver(null)
        }
      } catch (e) {
        setError(e?.message || 'Failed to remove driver')
        if (e?.responseBody) console.error('Remove driver error response:', e.responseBody)
      }
    }

    const loadDrivers = async () => {
      setError('')
      setSuccess('')
      setLoading(true)
      try {
        const data = await api('/drivers', { method: 'GET' })
        setDrivers(Array.isArray(data?.drivers) ? data.drivers : [])
      } catch (e) {
        setError(e?.message || 'Failed to load drivers')
      } finally {
        setLoading(false)
      }
    }

    const openLedger = async (driver) => {
      const driverId = driver?.id ?? driver?.user_id
      if (!driverId) return

      setSelectedDriver(driver)
      setLedger([])
      setLedgerBalance(null)
      setLedgerLoading(true)

      try {
        const data = await api(`/drivers/${driverId}/points`, { method: 'GET' })
        setLedger(Array.isArray(data?.ledger) ? data.ledger : [])
        setLedgerBalance(
          data?.balance ?? data?.pointsBalance ?? data?.points_balance ?? null
        )
      } catch (e) {
        setError(e?.message || 'Failed to load ledger')
      } finally {
        setLedgerLoading(false)
      }
    }

    useEffect(() => {
      loadDrivers()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const filtered = useMemo(() => {
      const q = (query || '').trim().toLowerCase()
      if (!q) return drivers
      return drivers.filter((d) => {
        const id = String(d.id ?? d.user_id ?? '')
        const email = String(d.email ?? '')
        const name = String(d.name ?? d.driver_name ?? '')
        return (
          id.includes(q) ||
          email.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q)
        )
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
      if (!reason) {
        setError('Reason is required.')
        return
      }

      try {
        const points = Math.abs(delta)

        if (delta > 0) {
          await api(`/drivers/${driverId}/points/add`, {
            method: 'POST',
            body: JSON.stringify({ points, reason })
          })
        } else {
          await api(`/drivers/${driverId}/points/deduct`, {
            method: 'POST',
            body: JSON.stringify({ points, reason })
          })
        }

        setSuccess(`Updated points for driver ${driverId}.`)
        await loadDrivers()

        if ((selectedDriver?.id ?? selectedDriver?.user_id) === driverId) {
          await openLedger(selectedDriver)
        }

        setDeltaById((prev) => ({ ...prev, [driverId]: '' }))
        setReasonById((prev) => ({ ...prev, [driverId]: '' }))
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
          <p className="page-subtitle">Manage points for your drivers</p>

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
                  <th style={{ width: 260 }}>Reason (required)</th>
                  <th style={{ width: 140 }}>Action</th>
                  <th style={{ width: 110 }}>Ledger</th>
                  <th style={{ width: 120 }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {loading && drivers.length === 0 ? (
                  <tr><td colSpan="8" className="table-empty">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="8" className="table-empty">No drivers found</td></tr>
                ) : (
                  filtered.map((d) => {
                    const id = d.id ?? d.user_id
                    const name =
                      d.name ||
                      d.driver_name ||
                      [d.first_name, d.last_name].filter(Boolean).join(' ') ||
                      `Driver ${id}`
                    const email = d.email || d.driver_email || '-'
                    const points = Number(d.pointsBalance ?? d.points_balance ?? d.points ?? d.total_points ?? 0)

                    return (
                      <tr key={String(id)}>
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedProfileDriver(d)}
                            style={{
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              color: '#2563eb',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            {name}
                          </button>
                        </td>
                        <td>{email}</td>
                        <td className="text-right">{points}</td>
                        <td>
                          <input
                            className="form-input"
                            type="number"
                            placeholder="e.g. 50 or -20"
                            value={deltaById[id] ?? ''}
                            onChange={(e) => setDeltaById((prev) => ({ ...prev, [id]: e.target.value }))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            type="text"
                            placeholder="Why are you changing points?"
                            value={reasonById[id] ?? ''}
                            onChange={(e) => setReasonById((prev) => ({ ...prev, [id]: e.target.value }))}
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
                        <td>
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => openLedger(d)}
                          >
                            View
                          </button>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => removeDriver({ ...d, id })}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedDriver ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 className="section-title" style={{ marginTop: 0 }}>Points ledger</h2>
                  <p className="page-subtitle" style={{ marginTop: 4 }}>
                    {(selectedDriver.name ||
                      selectedDriver.driver_name ||
                      selectedDriver.email ||
                      `Driver ${(selectedDriver.id ?? selectedDriver.user_id)}`)}
                    {ledgerBalance !== null ? ` · Balance: ${ledgerBalance}` : ''}
                  </p>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => setSelectedDriver(null)}>
                  Close
                </button>
              </div>

              {ledgerLoading ? (
                <p>Loading ledger…</p>
              ) : ledger.length === 0 ? (
                <p className="activity-empty">No ledger entries yet</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="text-right">Delta</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((row, idx) => (
                        <tr key={row.id ?? idx}>
                          <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
                          <td className="text-right">{row.delta ?? 0}</td>
                          <td>{row.reason ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {selectedProfileDriver && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                gap: 12,
                flexWrap: 'wrap'
              }}>
                <div>
                  <h2 className="section-title" style={{ marginTop: 0 }}>Driver details</h2>
                  <p className="page-subtitle" style={{ marginTop: 4 }}>
                    {(() => {
                      const id = selectedProfileDriver.id ?? selectedProfileDriver.user_id
                      const name =
                        selectedProfileDriver.name ||
                        selectedProfileDriver.driver_name ||
                        [selectedProfileDriver.first_name, selectedProfileDriver.last_name].filter(Boolean).join(' ') ||
                        `Driver ${id}`
                      const email = selectedProfileDriver.email || selectedProfileDriver.driver_email || '-'
                      return `${name} · ${email}`
                    })()}
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => setSelectedProfileDriver(null)}
                >
                  Close
                </button>
              </div>

              {(() => {
                const d = selectedProfileDriver
                const id = d.id ?? d.user_id
                const name =
                  d.name ||
                  d.driver_name ||
                  [d.first_name, d.last_name].filter(Boolean).join(' ') ||
                  `Driver ${id}`
                const email = d.email || d.driver_email || '-'
                const points = Number(d.pointsBalance ?? d.points_balance ?? d.points ?? d.total_points ?? ledgerBalance ?? 0)

                const fields = [
                  { label: 'User ID', value: id },
                  { label: 'Email', value: email },
                  { label: 'Full Name', value: name },
                  { label: 'DOB', value: d.dob },
                  { label: 'Phone', value: d.phone },
                  { label: 'Address', value: d.address_line1 },
                  { label: 'City', value: d.city },
                  { label: 'State', value: d.state },
                  { label: 'Postal Code', value: d.postal_code },
                  { label: 'Country', value: d.country },
                  { label: 'Sponsor Org', value: d.sponsor_org },
                  { label: 'Points Balance', value: points.toLocaleString() },
                ]

                return (
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 10
                    }}>
                      {fields.map(({ label, value }) => (
                        <div
                          key={label}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 6,
                            background: '#fff',
                            border: '1px solid var(--border)'
                          }}
                        >
                          <p style={{
                            margin: '0 0 2px',
                            fontSize: '0.72em',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            color: '#9ca3af'
                          }}>
                            {label}
                          </p>
                          <p style={{
                            margin: 0,
                            fontSize: '0.875em',
                            fontWeight: 500,
                            color: '#374151',
                            wordBreak: 'break-all'
                          }}>
                            {String(value ?? '—')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <p className="form-footer" style={{ marginTop: 12 }}>
            Tip: use positive numbers to add points and negative numbers to deduct points. A reason is required.
          </p>
        </main>
      </div>
    )
  }

  // ============ DASHBOARD PAGE ============
  const DashboardPage = () => {
    const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
    const isDriver = role === 'driver'
    const [historyOpen, setHistoryOpen] = useState(false)
    const [history, setHistory] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyError, setHistoryError] = useState('')

    const toggleHistory = async () => {
      if (!isDriver) return

      // Collapse if already open
      if (historyOpen) {
        setHistoryOpen(false)
        return
      }

      // Open immediately so the user sees feedback, then load data.
      setHistoryOpen(true)
      setHistoryError('')
      setHistoryLoading(true)
      try {
        // Always hit the driver service directly to avoid proxy/base issues.
        const data = await apiWithBase(DRIVER_API_BASE, '/points/history', { method: 'GET' })
        setHistory(Array.isArray(data?.ledger) ? data.ledger : [])
      } catch (e) {
        setHistoryError(e?.message || 'Failed to load point history')
      } finally {
        setHistoryLoading(false)
      }
    }

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Welcome back, {currentUser?.name || 'User'}</h1>
          <p className="page-subtitle">Here’s your overview</p>

          <div style={{ marginBottom: 24 }}>
            <div className="pts-hero">
              <p className="pts-hero-label">Your points</p>
              <p className="pts-hero-value">{currentUser?.points ?? 0}</p>
            </div>
            {isDriver && (
              <p className="form-footer" style={{ marginTop: 8 }}>
                Total earned: <strong>{currentUser?.totalEarned ?? currentUser?.points ?? 0}</strong>
              </p>
            )}
            {isDriver && (
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={toggleHistory}
                  disabled={historyLoading}
                >
                  {historyOpen ? 'Hide point history' : 'View point history'}
                </button>
              </div>
            )}
          </div>

          {isDriver && historyOpen && (
            <section style={{ marginBottom: 24 }}>
              <h2 className="section-title">Point history</h2>
              {historyError ? (
                <p className="form-footer" style={{ color: 'crimson' }}>{historyError}</p>
              ) : null}
              {historyLoading ? (
                <p>Loading point history…</p>
              ) : history.length === 0 ? (
                <p className="activity-empty">No point activity yet</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="text-right">Change</th>
                        <th>Reason</th>
                        <th>Sponsor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => {
                        const sponsorName = row.sponsor_company || row.sponsor_email || '—'
                        const delta = Number(row.delta ?? 0)
                        return (
                          <tr key={row.id}>
                            <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
                            <td className="text-right" style={{ fontWeight: 600, color: delta >= 0 ? '#16a34a' : '#dc2626' }}>
                              {delta > 0 ? `+${delta}` : delta}
                            </td>
                            <td>{row.reason || '—'}</td>
                            <td>{sponsorName}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

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

 // ============================================================
// UPDATED AdminUsersPage — drop this component into App.jsx,
// replacing the existing AdminUsersPage function.
//
// New features:
//   • "Applications" tab — all sponsor-driver apps across all orgs
//   • Filter by status (all / pending / accepted / rejected / cancelled)
//   • Accept, Reject, Cancel any application with an optional reason
//   • Drivers tab — inline point adjust (+ or −) with required reason
//   • Ledger drawer per driver
// ============================================================

const AdminUsersPage = () => {
  const [activeTab, setActiveTab] = useState('applications')
  const [sponsors, setSponsors] = useState([])
  const [drivers, setDrivers] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedUser, setExpandedUser] = useState(null)

  // Applications filters
  const [appStatusFilter, setAppStatusFilter] = useState('all')

  // Per-application: notes/reason being typed before submit
  const [appNotesById, setAppNotesById] = useState({})
  // Which application has its reason input open
  const [appActionById, setAppActionById] = useState({}) // { [id]: 'accept' | 'reject' | 'cancel' | null }

  // Driver point adjustment state
  const [deltaById, setDeltaById] = useState({})
  const [reasonById, setReasonById] = useState({})
  const [selectedLedgerDriver, setSelectedLedgerDriver] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerBalance, setLedgerBalance] = useState(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // Transactions tab
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(false)
  const [txDriverFilter, setTxDriverFilter] = useState('')
  const [txSponsorFilter, setTxSponsorFilter] = useState('')
  const [txDateFrom, setTxDateFrom] = useState('')
  const [txDateTo, setTxDateTo] = useState('')

  // ── Data loaders ──────────────────────────────────────────

  const loadAll = async () => {
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const [sponsorData, driverData, appData] = await Promise.allSettled([
        api('/users?role=sponsor', { method: 'GET' }),
        api('/users?role=driver', { method: 'GET' }),
        api('/applications', { method: 'GET' }),
      ])
      if (sponsorData.status === 'fulfilled') {
        setSponsors(Array.isArray(sponsorData.value?.users) ? sponsorData.value.users : [])
      } else {
        setError(prev => prev + (sponsorData.reason?.message || 'Failed to load sponsors') + ' ')
      }
      if (driverData.status === 'fulfilled') {
        setDrivers(Array.isArray(driverData.value?.users) ? driverData.value.users : [])
      } else {
        setError(prev => prev + (driverData.reason?.message || 'Failed to load drivers'))
      }
      if (appData.status === 'fulfilled') {
        setApplications(Array.isArray(appData.value?.applications) ? appData.value.applications : [])
      } else {
        setError(prev => prev + (appData.reason?.message || 'Failed to load applications'))
      }
    } finally {
      setLoading(false)
    }
  }

  const reloadApplications = async () => {
    try {
      const data = await api('/applications', { method: 'GET' })
      setApplications(Array.isArray(data?.applications) ? data.applications : [])
    } catch (e) {
      setError(e?.message || 'Failed to reload applications')
    }
  }

  const openLedger = async (driver) => {
    const driverId = driver?.id ?? driver?.user_id
    if (!driverId) return
    setSelectedLedgerDriver(driver)
    setLedger([])
    setLedgerBalance(null)
    setLedgerLoading(true)
    try {
      const data = await api(`/drivers/${driverId}/points`, { method: 'GET' })
      setLedger(Array.isArray(data?.ledger) ? data.ledger : [])
      setLedgerBalance(data?.balance ?? null)
    } catch (e) {
      setError(e?.message || 'Failed to load ledger')
    } finally {
      setLedgerLoading(false)
    }
  }

  const loadTransactions = async () => {
    setTxLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      // resolve driver name filter to id
      if (txDriverFilter.trim()) {
        const match = drivers.find(d =>
          String(d.id) === txDriverFilter.trim() ||
          (d.email || '').toLowerCase().includes(txDriverFilter.trim().toLowerCase()) ||
          [d.first_name, d.last_name].filter(Boolean).join(' ').toLowerCase().includes(txDriverFilter.trim().toLowerCase())
        )
        if (match) params.set('driver_id', match.id)
      }
      if (txSponsorFilter.trim()) {
        const match = sponsors.find(s =>
          String(s.id) === txSponsorFilter.trim() ||
          (s.email || '').toLowerCase().includes(txSponsorFilter.trim().toLowerCase()) ||
          (s.company_name || '').toLowerCase().includes(txSponsorFilter.trim().toLowerCase())
        )
        if (match) params.set('sponsor_id', match.id)
      }
      if (txDateFrom) params.set('date_from', txDateFrom)
      if (txDateTo)   params.set('date_to',   txDateTo)

      const qs = params.toString()
      const data = await api(`/transactions${qs ? '?' + qs : ''}`, { method: 'GET' })
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : [])
    } catch (e) {
      setError(e?.message || 'Failed to load transactions')
    } finally {
      setTxLoading(false)
    }
  }

  const exportCSV = () => {
    if (transactions.length === 0) return
    const headers = ['ID', 'Date', 'Driver ID', 'Driver Name', 'Driver Email', 'Sponsor', 'Sponsor Email', 'Delta', 'Reason']
    const rows = transactions.map(t => [
      t.id,
      t.created_at ? new Date(t.created_at).toLocaleString() : '',
      t.driver_id,
      (t.driver_name || '').trim(),
      t.driver_email || '',
      t.sponsor_company || (t.sponsor_id == null ? 'Admin' : `#${t.sponsor_id}`),
      t.sponsor_email || '',
      t.delta,
      `"${(t.reason || '').replace(/"/g, '""')}"`
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `point-transactions-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => { loadAll() }, [])

  // ── Application action ────────────────────────────────────

  const handleAppAction = async (appId, newStatus) => {
    setError('')
    setSuccess('')
    const notes = (appNotesById[appId] || '').trim()

    try {
      await api(`/applications/${appId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, notes: notes || undefined }),
      })
      setSuccess(`Application #${appId} updated to "${newStatus}".`)
      setAppNotesById(prev => { const n = { ...prev }; delete n[appId]; return n })
      setAppActionById(prev => { const n = { ...prev }; delete n[appId]; return n })
      await reloadApplications()
    } catch (e) {
      setError(e?.message || `Failed to ${newStatus} application`)
    }
  }

  // ── Driver point adjustment ───────────────────────────────

  const adjustPoints = async (driver) => {
    setError('')
    setSuccess('')
    const driverId = driver?.id ?? driver?.user_id
    if (!driverId) { setError('Missing driver id'); return }

    const rawDelta = deltaById[driverId]
    const delta = Number(rawDelta)
    if (!Number.isFinite(delta) || delta === 0) {
      setError('Enter a non-zero number (positive to add, negative to deduct).')
      return
    }

    const reason = (reasonById[driverId] || '').trim()
    if (!reason) { setError('A reason is required.'); return }

    try {
      const points = Math.abs(delta)
      if (delta > 0) {
        await api(`/drivers/${driverId}/points/add`, {
          method: 'POST',
          body: JSON.stringify({ points, reason }),
        })
      } else {
        await api(`/drivers/${driverId}/points/deduct`, {
          method: 'POST',
          body: JSON.stringify({ points, reason }),
        })
      }
      setSuccess(`Updated points for driver ${driverId}.`)
      setDeltaById(prev => ({ ...prev, [driverId]: '' }))
      setReasonById(prev => ({ ...prev, [driverId]: '' }))
      // Refresh driver list to show updated balance
      const data = await api('/users?role=driver', { method: 'GET' })
      setDrivers(Array.isArray(data?.users) ? data.users : [])
      // Refresh ledger if open for this driver
      if ((selectedLedgerDriver?.id ?? selectedLedgerDriver?.user_id) === driverId) {
        await openLedger(driver)
      }
    } catch (e) {
      setError(e?.message || 'Failed to adjust points')
    }
  }

  const removeFromSponsor = async (driver) => {
  const driverId = driver?.id ?? driver?.user_id
  if (!driverId) { setError('Missing driver id'); return }

  const name = [driver.first_name, driver.last_name].filter(Boolean).join(' ') || driver.email || `Driver ${driverId}`
  if (!window.confirm(`Remove ${name} from their sponsor org? This will cancel their accepted application.`)) return

  setError('')
  setSuccess('')
  try {
    await api(`/drivers/${driverId}/sponsor`, { method: 'DELETE' })
    setSuccess(`Removed ${name} from their sponsor org.`)
    const data = await api('/users?role=driver', { method: 'GET' })
    setDrivers(Array.isArray(data?.users) ? data.users : [])
    await reloadApplications()
  } catch (e) {
    setError(e?.message || 'Failed to remove from sponsor')
  }
}

  // ── Filtered data ─────────────────────────────────────────

  const filteredApplications = useMemo(() => {
    let list = applications
    if (appStatusFilter !== 'all') {
      list = list.filter(a => a.status === appStatusFilter)
    }
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return list
    return list.filter(a =>
      String(a.id ?? '').includes(q) ||
      String(a.driver_email ?? '').toLowerCase().includes(q) ||
      String(a.driver_name ?? '').toLowerCase().includes(q) ||
      String(a.sponsor_email ?? '').toLowerCase().includes(q) ||
      String(a.sponsor_company ?? '').toLowerCase().includes(q) ||
      String(a.ad_title ?? '').toLowerCase().includes(q)
    )
  }, [applications, appStatusFilter, searchQuery])

  const filteredSponsors = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return sponsors
    return sponsors.filter(s =>
      String(s.id ?? '').includes(q) ||
      String(s.email ?? '').toLowerCase().includes(q) ||
      String(s.company_name ?? '').toLowerCase().includes(q)
    )
  }, [sponsors, searchQuery])

  const filteredDrivers = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return drivers
    return drivers.filter(d =>
      String(d.id ?? '').includes(q) ||
      String(d.email ?? '').toLowerCase().includes(q) ||
      String([d.first_name, d.last_name].filter(Boolean).join(' ')).toLowerCase().includes(q) ||
      String(d.sponsor_org ?? '').toLowerCase().includes(q)
    )
  }, [drivers, searchQuery])

  // ── UI helpers ───────────────────────────────────────────

  const tabStyle = (tab) => ({
    padding: '8px 20px',
    borderRadius: '6px 6px 0 0',
    border: '1px solid var(--border)',
    borderBottom: activeTab === tab ? '2px solid white' : '1px solid var(--border)',
    background: activeTab === tab ? 'white' : '#f3f4f6',
    fontWeight: activeTab === tab ? 700 : 400,
    cursor: 'pointer',
    marginBottom: -1,
  })

  const statusBadge = (status) => {
    const map = {
      accepted: { bg: '#d4edda', color: '#155724', label: 'Accepted' },
      pending:  { bg: '#fff3cd', color: '#856404', label: 'Pending' },
      rejected: { bg: '#f8d7da', color: '#721c24', label: 'Rejected' },
      cancelled:{ bg: '#e2e3e5', color: '#383d41', label: 'Cancelled' },
      removed:  { bg: '#e2e3e5', color: '#383d41', label: 'Removed' },
    }
    const s = map[status] || { bg: '#f3f4f6', color: '#6b7280', label: status }
    return (
      <span style={{
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: '0.8em',
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}>
        {s.label}
      </span>
    )
  }

  const DetailGrid = ({ fields }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      {fields.map(({ label, value }) => (
        <div key={label} style={{ padding: '10px 14px', borderRadius: 6, background: '#fff', border: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 2px', fontSize: '0.72em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>{label}</p>
          <p style={{ margin: 0, fontSize: '0.875em', fontWeight: 500, color: '#374151', wordBreak: 'break-all' }}>{String(value ?? '—')}</p>
        </div>
      ))}
    </div>
  )

  // Status counts for badge display
  const statusCounts = useMemo(() => {
    const counts = { all: applications.length, pending: 0, accepted: 0, rejected: 0, cancelled: 0 }
    applications.forEach(a => {
      if (a.status in counts) counts[a.status]++
    })
    return counts
  }, [applications])

  // ── Render ───────────────────────────────────────────────

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Admin — User & Application Management</h1>
        <p className="page-subtitle">Full visibility across drivers, sponsors, and all applications</p>

        {/* ── Summary stats ── */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <p className="stat-label">Total Sponsors</p>
            <p className="stat-value stat-value-blue">{sponsors.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total Drivers</p>
            <p className="stat-value stat-value-green">{drivers.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">All Applications</p>
            <p className="stat-value stat-value-amber">{applications.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Pending Review</p>
            <p className="stat-value" style={{ color: '#d97706' }}>{statusCounts.pending}</p>
          </div>
        </div>

        {/* ── Search + refresh ── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Search by name, email, company, or ID…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button className="btn btn-primary" type="button" onClick={loadAll} disabled={loading}>
              {loading ? 'Refreshing…' : '↺ Refresh'}
            </button>
          </div>
        </div>

        {error   && <p className="form-footer" style={{ color: 'crimson',  marginBottom: 8 }}>{error}</p>}
        {success && <p className="form-footer" style={{ color: '#16a34a', marginBottom: 8 }}>{success}</p>}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" style={tabStyle('applications')} onClick={() => { setActiveTab('applications'); setExpandedUser(null) }}>
            Applications ({filteredApplications.length})
          </button>
          <button type="button" style={tabStyle('sponsors')} onClick={() => { setActiveTab('sponsors'); setExpandedUser(null) }}>
            Sponsor Orgs ({filteredSponsors.length})
          </button>
          <button type="button" style={tabStyle('drivers')} onClick={() => { setActiveTab('drivers'); setExpandedUser(null); setSelectedLedgerDriver(null) }}>
            Drivers ({filteredDrivers.length})
          </button>
          <button type="button" style={tabStyle('transactions')} onClick={() => { setActiveTab('transactions'); setExpandedUser(null) }}>
            Transactions
          </button>
        </div>

        {/* ══════════════════════════════════════════════════
            TAB: APPLICATIONS
        ══════════════════════════════════════════════════ */}
        {activeTab === 'applications' && (
          <div className="card" style={{ borderRadius: '0 8px 8px 8px' }}>

            {/* Status filter pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {['all', 'pending', 'accepted', 'rejected', 'cancelled'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAppStatusFilter(s)}
                  style={{
                    padding: '4px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    fontSize: '0.82em',
                    fontWeight: appStatusFilter === s ? 700 : 400,
                    cursor: 'pointer',
                    background: appStatusFilter === s ? '#1e40af' : '#f9fafb',
                    color: appStatusFilter === s ? '#fff' : '#374151',
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}{' '}
                  <span style={{ opacity: 0.75 }}>({statusCounts[s] ?? 0})</span>
                </button>
              ))}
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Driver</th>
                    <th>Sponsor / Org</th>
                    <th>Ad</th>
                    <th>Status</th>
                    <th>Applied</th>
                    <th>Notes</th>
                    <th style={{ minWidth: 280 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && applications.length === 0 ? (
                    <tr><td colSpan="8" className="table-empty">Loading…</td></tr>
                  ) : filteredApplications.length === 0 ? (
                    <tr><td colSpan="8" className="table-empty">No applications match the current filter</td></tr>
                  ) : filteredApplications.map(app => {
                    const pendingAction = appActionById[app.id] // 'accept' | 'reject' | 'cancel'
                    const isEditable = app.status === 'pending' || app.status === 'accepted'

                    return (
                      <React.Fragment key={String(app.id)}>
                        <tr>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.82em' }}>{app.id}</td>
                          <td>
                            <div style={{ lineHeight: 1.4 }}>
                              <strong style={{ fontSize: '0.88em' }}>
                                {(app.driver_name || '').trim() || '—'}
                              </strong>
                              <br />
                              <span style={{ fontSize: '0.78em', color: '#6b7280' }}>{app.driver_email}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ lineHeight: 1.4 }}>
                              <strong style={{ fontSize: '0.88em' }}>
                                {app.sponsor_company || '—'}
                              </strong>
                              <br />
                              <span style={{ fontSize: '0.78em', color: '#6b7280' }}>{app.sponsor_email}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.85em', color: '#374151', maxWidth: 160 }}>
                            {app.ad_title || <em style={{ color: '#9ca3af' }}>—</em>}
                          </td>
                          <td>{statusBadge(app.status)}</td>
                          <td style={{ fontSize: '0.82em', whiteSpace: 'nowrap', color: '#6b7280' }}>
                            {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ fontSize: '0.82em', color: '#555', maxWidth: 160 }}>
                            {app.notes || <em style={{ color: '#9ca3af' }}>—</em>}
                          </td>
                          <td>
                            {isEditable ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {app.status === 'pending' && (
                                    <button
                                      type="button"
                                      className="btn btn-success"
                                      style={{ fontSize: '0.8em', padding: '3px 10px' }}
                                      onClick={() => setAppActionById(prev => ({
                                        ...prev,
                                        [app.id]: prev[app.id] === 'accept' ? null : 'accept'
                                      }))}
                                    >
                                      ✓ Accept
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    style={{ fontSize: '0.8em', padding: '3px 10px' }}
                                    onClick={() => setAppActionById(prev => ({
                                      ...prev,
                                      [app.id]: prev[app.id] === 'reject' ? null : 'reject'
                                    }))}
                                  >
                                    ✕ Reject
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.8em', padding: '3px 10px' }}
                                    onClick={() => setAppActionById(prev => ({
                                      ...prev,
                                      [app.id]: prev[app.id] === 'cancel' ? null : 'cancel'
                                    }))}
                                  >
                                    ⊘ Cancel
                                  </button>
                                </div>

                                {/* Inline reason input — shown when an action is selected */}
                                {pendingAction && (
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                      className="form-input"
                                      style={{ flex: 1, minWidth: 160, fontSize: '0.82em' }}
                                      placeholder={`Reason for ${pendingAction} (optional)`}
                                      value={appNotesById[app.id] || ''}
                                      onChange={e => setAppNotesById(prev => ({ ...prev, [app.id]: e.target.value }))}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      style={{ fontSize: '0.8em', padding: '3px 12px', whiteSpace: 'nowrap' }}
                                      onClick={() => {
                                        const statusMap = { accept: 'accepted', reject: 'rejected', cancel: 'cancelled' }
                                        handleAppAction(app.id, statusMap[pendingAction])
                                      }}
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost"
                                      style={{ fontSize: '0.8em', padding: '3px 10px' }}
                                      onClick={() => setAppActionById(prev => { const n = { ...prev }; delete n[app.id]; return n })}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8em', color: '#9ca3af', fontStyle: 'italic' }}>
                                No actions available
                              </span>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: SPONSOR ORGS
        ══════════════════════════════════════════════════ */}
        {activeTab === 'sponsors' && (
          <div className="card" style={{ borderRadius: '0 8px 8px 8px' }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Organization</th>
                    <th>Joined</th>
                    <th className="text-right">Drivers</th>
                    <th style={{ width: 90 }}>Details</th>
                    <th style={{ width: 110 }}>Remove Org</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && sponsors.length === 0 ? (
                    <tr><td colSpan="6" className="table-empty">Loading…</td></tr>
                  ) : filteredSponsors.length === 0 ? (
                    <tr><td colSpan="6" className="table-empty">No sponsors found</td></tr>
                  ) : filteredSponsors.map(s => {
                    const company = s.company_name || null
                    const isExpanded = expandedUser === s.id
                    return (
                      <React.Fragment key={String(s.id)}>
                        <tr>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{s.id}</td>
                          <td>{s.email}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: company ? '#22c55e' : '#d1d5db', flexShrink: 0 }} />
                              {company || <em style={{ color: '#9ca3af' }}>Not set</em>}
                            </span>
                          </td>
                          <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                          <td className="text-right">
                            {typeof s.driver_count === 'number' ? <strong style={{ color: '#2563eb' }}>{s.driver_count}</strong> : '—'}
                          </td>
                          <td>
                            <button className="btn btn-primary" style={{ fontSize: '0.8em', padding: '4px 10px' }}
                              type="button" onClick={() => setExpandedUser(isExpanded ? null : s.id)}>
                              {isExpanded ? 'Close' : 'View'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: '#f9fafb' }}>
                            <td colSpan="6" style={{ padding: '16px 20px' }}>
                              <DetailGrid fields={[
                                { label: 'User ID', value: s.id },
                                { label: 'Email', value: s.email },
                                { label: 'Organization', value: company || 'Not set' },
                                { label: 'First Name', value: s.first_name },
                                { label: 'Last Name', value: s.last_name },
                                { label: 'Phone', value: s.phone },
                                { label: 'City', value: s.city },
                                { label: 'State', value: s.state },
                                { label: 'Active Drivers', value: typeof s.driver_count === 'number' ? s.driver_count : '—' },
                                { label: 'Joined', value: s.created_at ? new Date(s.created_at).toLocaleString() : '—' },
                              ]} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: DRIVERS (with point adjustment)
        ══════════════════════════════════════════════════ */}
        {activeTab === 'drivers' && (
          <>
            <div className="card" style={{ borderRadius: '0 8px 8px 8px' }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Sponsor Org</th>
                      <th className="text-right">Points</th>
                      <th style={{ width: 200 }}>Adjust (±)</th>
                      <th style={{ width: 240 }}>Reason (required)</th>
                      <th style={{ width: 120 }}>Apply</th>
                      <th style={{ width: 90 }}>Ledger</th>
                      <th style={{ width: 90 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && drivers.length === 0 ? (
                      <tr><td colSpan="10" className="table-empty">Loading…</td></tr>
                    ) : filteredDrivers.length === 0 ? (
                      <tr><td colSpan="10" className="table-empty">No drivers found</td></tr>
                    ) : filteredDrivers.map(d => {
                      const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || '—'
                      const sponsorOrg = d.sponsor_org || null
                      const points = Number(d.points_balance ?? d.points ?? 0)
                      const isExpanded = expandedUser === d.id
                      const id = d.id

                      return (
                        <React.Fragment key={String(id)}>
                          <tr>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{id}</td>
                            <td>{name}</td>
                            <td>{d.email}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sponsorOrg ? '#22c55e' : '#d1d5db', flexShrink: 0 }} />
                                {sponsorOrg || <em style={{ color: '#9ca3af' }}>Unaffiliated</em>}
                              </span>
                            </td>
                            <td className="text-right" style={{ fontWeight: 600 }}>{points.toLocaleString()}</td>
                            <td>
                              <input
                                className="form-input"
                                type="number"
                                placeholder="e.g. 50 or -20"
                                value={deltaById[id] ?? ''}
                                onChange={e => setDeltaById(prev => ({ ...prev, [id]: e.target.value }))}
                              />
                            </td>
                            <td>
                              <input
                                className="form-input"
                                type="text"
                                placeholder="Why are you changing points?"
                                value={reasonById[id] ?? ''}
                                onChange={e => setReasonById(prev => ({ ...prev, [id]: e.target.value }))}
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
                            <td>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '0.8em', padding: '4px 10px' }}
                                type="button"
                                onClick={() => {
                                  if ((selectedLedgerDriver?.id) === id) {
                                    setSelectedLedgerDriver(null)
                                  } else {
                                    openLedger(d)
                                  }
                                }}
                              >
                                {selectedLedgerDriver?.id === id ? 'Close' : 'View'}
                              </button>
                            </td>
                            <td>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '0.8em', padding: '4px 10px' }}
                                type="button"
                                onClick={() => setExpandedUser(isExpanded ? null : id)}
                              >
                                {isExpanded ? 'Close' : 'Info'}
                              </button>
                            </td>
                            <td>
                              {d.sponsor_org ? (
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: '0.8em', padding: '4px 10px', color: '#dc2626', borderColor: '#dc2626' }}
                                  type="button"
                                  onClick={() => removeFromSponsor({ ...d, id })}
                                >
                                  Remove Org
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.78em', color: '#9ca3af', fontStyle: 'italic' }}>—</span>
                              )}
                            </td>
                          </tr>

                          {/* Ledger inline row */}
                          {selectedLedgerDriver?.id === id && (
                            <tr style={{ background: '#f0fdf4' }}>
                              <td colSpan="10" style={{ padding: '14px 20px' }}>
                                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '0.9em' }}>
                                  Points ledger — {name}
                                  {ledgerBalance !== null && (
                                    <span style={{ marginLeft: 12, fontWeight: 400, color: '#6b7280' }}>
                                      Balance: <strong style={{ color: '#16a34a' }}>{ledgerBalance.toLocaleString()}</strong>
                                    </span>
                                  )}
                                </p>
                                {ledgerLoading ? (
                                  <p style={{ color: '#9ca3af', fontSize: '0.85em' }}>Loading ledger…</p>
                                ) : ledger.length === 0 ? (
                                  <p style={{ color: '#9ca3af', fontSize: '0.85em', fontStyle: 'italic' }}>No entries yet</p>
                                ) : (
                                  <table className="table" style={{ background: '#fff' }}>
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Sponsor</th>
                                        <th className="text-right">Delta</th>
                                        <th>Reason</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ledger.map((row, idx) => (
                                        <tr key={row.id ?? idx}>
                                          <td style={{ fontSize: '0.82em', whiteSpace: 'nowrap' }}>
                                            {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                                          </td>
                                          <td style={{ fontSize: '0.82em' }}>
                                            {row.sponsor_company || (row.sponsor_id == null ? <em style={{ color: '#9ca3af' }}>Admin</em> : `#${row.sponsor_id}`)}
                                          </td>
                                          <td className="text-right" style={{
                                            fontWeight: 700,
                                            color: Number(row.delta) >= 0 ? '#16a34a' : '#dc2626'
                                          }}>
                                            {Number(row.delta) >= 0 ? '+' : ''}{row.delta}
                                          </td>
                                          <td style={{ fontSize: '0.82em' }}>{row.reason ?? '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}

                          {/* Detail expand row */}
                          {isExpanded && (
                            <tr style={{ background: '#f9fafb' }}>
                              <td colSpan="10" style={{ padding: '16px 20px' }}>
                                <DetailGrid fields={[
                                  { label: 'User ID', value: id },
                                  { label: 'Email', value: d.email },
                                  { label: 'Full Name', value: name },
                                  { label: 'DOB', value: d.dob },
                                  { label: 'Phone', value: d.phone },
                                  { label: 'Address', value: d.address_line1 },
                                  { label: 'City', value: d.city },
                                  { label: 'State', value: d.state },
                                  { label: 'Sponsor Org', value: sponsorOrg || 'Unaffiliated' },
                                  { label: 'Points Balance', value: points.toLocaleString() },
                                  { label: 'Joined', value: d.created_at ? new Date(d.created_at).toLocaleString() : '—' },
                                ]} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="form-footer" style={{ marginTop: 8 }}>
                Tip: enter a positive number to add points or a negative number to deduct. A reason is always required.
              </p>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: TRANSACTIONS
        ══════════════════════════════════════════════════ */}
        {activeTab === 'transactions' && (
          <div className="card" style={{ borderRadius: '0 8px 8px 8px' }}>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Filter by Driver</label>
                <input
                  className="form-input"
                  style={{ minWidth: 180 }}
                  placeholder="Name, email, or ID"
                  value={txDriverFilter}
                  onChange={e => setTxDriverFilter(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Filter by Sponsor</label>
                <input
                  className="form-input"
                  style={{ minWidth: 180 }}
                  placeholder="Org name, email, or ID"
                  value={txSponsorFilter}
                  onChange={e => setTxSponsorFilter(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>From</label>
                <input
                  className="form-input"
                  type="date"
                  value={txDateFrom}
                  onChange={e => setTxDateFrom(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>To</label>
                <input
                  className="form-input"
                  type="date"
                  value={txDateTo}
                  onChange={e => setTxDateTo(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="button" onClick={loadTransactions} disabled={txLoading}>
                {txLoading ? 'Loading…' : '🔍 Apply Filters'}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => { setTxDriverFilter(''); setTxSponsorFilter(''); setTxDateFrom(''); setTxDateTo(''); }}
              >
                Clear
              </button>
              <button
                className="btn btn-success"
                type="button"
                onClick={exportCSV}
                disabled={transactions.length === 0}
                style={{ marginLeft: 'auto' }}
              >
                ⬇ Export CSV
              </button>
            </div>

            {transactions.length === 0 && !txLoading && (
              <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.875em', marginBottom: 12 }}>
                Apply filters and click "Apply Filters" to load transactions, or load all with no filters.
              </p>
            )}

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Driver</th>
                    <th>Sponsor</th>
                    <th className="text-right">Delta</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <tr><td colSpan="5" className="table-empty">Loading…</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan="5" className="table-empty">No transactions found</td></tr>
                  ) : transactions.map((t, idx) => (
                    <tr key={t.id ?? idx}>
                      <td style={{ fontSize: '0.82em', whiteSpace: 'nowrap', color: '#6b7280' }}>
                        {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                      </td>
                      <td>
                        <div style={{ lineHeight: 1.4 }}>
                          <strong style={{ fontSize: '0.88em' }}>{(t.driver_name || '').trim() || '—'}</strong>
                          <br />
                          <span style={{ fontSize: '0.78em', color: '#6b7280' }}>{t.driver_email}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85em' }}>
                        {t.sponsor_company
                          ? <><strong>{t.sponsor_company}</strong><br /><span style={{ fontSize: '0.85em', color: '#6b7280' }}>{t.sponsor_email}</span></>
                          : t.sponsor_id == null
                            ? <em style={{ color: '#6b7280' }}>Admin</em>
                            : `#${t.sponsor_id}`}
                      </td>
                      <td className="text-right" style={{
                        fontWeight: 700,
                        color: Number(t.delta) >= 0 ? '#16a34a' : '#dc2626'
                      }}>
                        {Number(t.delta) >= 0 ? '+' : ''}{t.delta}
                      </td>
                      <td style={{ fontSize: '0.85em', color: '#374151' }}>{t.reason || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transactions.length > 0 && (
              <p style={{ fontSize: '0.78em', color: '#9ca3af', marginTop: 8 }}>
                Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                {transactions.length === 2000 ? ' (limit 2000 — apply filters to narrow results)' : ''}
              </p>
            )}
          </div>
        )}

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
      setShowDeleteConfirm(true)
    }
    const SponsorAffiliationsDisplay = () => {
      const [affiliations, setAffiliations] = useState([])
      const [loading, setLoading] = useState(true)

      useEffect(() => {
        api('/applications', { method: 'GET' })
          .then(data => setAffiliations((data?.applications || []).filter(a => a.status === 'accepted')))
          .catch(() => { })
          .finally(() => setLoading(false))
      }, [])

      return (
        <div className="profile-field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <p className="profile-label" style={{ marginBottom: 8 }}>Sponsor Affiliations</p>
          {loading ? (
            <p style={{ fontSize: '0.875em', color: '#9ca3af' }}>Loading…</p>
          ) : affiliations.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <em style={{ fontSize: '0.875em', color: '#9ca3af' }}>No active sponsor affiliations</em>
              <button type="button" className="btn btn-primary"
                style={{ fontSize: '0.8em', padding: '4px 12px' }}
                onClick={() => setCurrentPage('sponsor-affiliation')}>
                Find a Sponsor
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {affiliations.map(a => (
                <span key={a.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 999, fontSize: '0.85em',
                  background: '#d1fae5', color: '#065f46', fontWeight: 600,
                  border: '1px solid #6ee7b7'
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
                  {a.sponsor_company || a.sponsor_email || `Sponsor #${a.sponsor_id}`}
                </span>
              ))}
              <button type="button" className="btn btn-primary"
                style={{ fontSize: '0.8em', padding: '4px 12px' }}
                onClick={() => setCurrentPage('sponsor-affiliation')}>
                + Add More
              </button>
            </div>
          )}
        </div>
      )
    }
    return (
      <div>
        <Navigation />
        <main className="app-main">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h1 className="page-title">Profile</h1>
            <p className="page-subtitle">Your account details</p>
          </div>
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
            {/* Multi-sponsor affiliations — drivers only */}
            {((currentUser?.role || '').toLowerCase() === 'driver') && (
              <SponsorAffiliationsDisplay />
            )}
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

    const applyTo = async (sponsorId, adId) => {
      setStatusMsgLocal('')
      try {
        // Ensure we hit the driver service for creating applications
        const body = { sponsorId: Number(sponsorId) }
        if (typeof adId !== 'undefined' && adId !== null) body.adId = Number(adId)
        console.log('Applying with payload', body)
        await apiWithBase(DRIVER_API_BASE, '/applications', { method: 'POST', body: JSON.stringify(body) })
        setStatusMsgLocal('Application submitted!')
        await loadApplications()
      } catch (err) {
        setStatusMsgLocal(err.message || 'Failed to apply')
      }
    }

    const hasApplied = (ad) => {
      if (!ad) return false
      if (apps.some(a => a.ad_id && a.ad_id === ad.id)) return true
      return apps.some(a => a.sponsor_id === ad.sponsor_id)
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
                const applied = hasApplied(ad)
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
                            onClick={() => applyTo(ad.sponsor_id, ad.id)}
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
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h1 className="page-title">Account Details</h1>
            <p className="page-subtitle">Please enter your details to continue</p>
          </div>

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
              {/* Organization Name — sponsors only */}
              {((currentUser?.role || '').toLowerCase() === 'sponsor') && (
                <div className="form-group">
                  <label className="form-label">
                    Organization Name
                    <span style={{ marginLeft: 6, fontSize: '0.78em', color: '#6b7280', fontWeight: 400 }}>
                      (shown to drivers as your sponsor org)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Acme Trucking Co."
                  />
                  {formData.company_name && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.78em', color: '#22c55e' }}>
                      ✓ Drivers will see this as your sponsoring organization
                    </p>
                  )}
                </div>
              )}
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
    const [notesById, setNotesById] = useState({})
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
        // Ensure we hit the sponsor service for deleting ads
        await apiWithBase(SPONSOR_API_BASE, `/ads/${adId}`, { method: 'DELETE' })
        await loadAds()
      } catch (err) {
        setError(err.message || 'Failed to delete ad')
      }
    }

    const handleApplicationAction = async (applicationId, action) => {
      try {
        const notes = notesById[applicationId] || ''
        await api(`/applications/${applicationId}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: action === 'approved' ? 'accepted' : action,
            notes
          })
        })
        setNotesById(prev => { const n = { ...prev }; delete n[applicationId]; return n })
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
                      <th>Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => (
                      <tr key={app.id}>
                        <td>{app.driver_name || [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Unknown'}</td>
                        <td>{app.driver_email || app.email || '—'}</td>
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
                        <td>{app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '—'}</td>
                        <td style={{ width: 260 }}>
                          {app.status === 'pending' ? (
                            <textarea
                              placeholder="Reason (optional)"
                              value={notesById[app.id] || ''}
                              onChange={(e) => setNotesById(prev => ({ ...prev, [app.id]: e.target.value }))}
                              style={{ width: '100%', minHeight: 56, fontSize: '0.875em' }}
                            />
                          ) : (
                            <span style={{ fontSize: '0.875em', color: '#555', fontStyle: app.notes ? 'normal' : 'italic' }}>
                              {app.notes || '—'}
                            </span>
                          )}
                        </td>
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
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    )
  }

  // ============ SPONSOR CATALOG PAGE ============
  const SponsorCatalogPage = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [shopItems, setShopItems] = useState([])
    const [searching, setSearching] = useState(false)
    // '' = loading, 'popular' = showing defaults, otherwise = the search term used
    const [resultsLabel, setResultsLabel] = useState('')

    // We need a state to temporarily store the cost the user types in for each item
    // Key: itemId, Value: point cost string
    const [draftCosts, setDraftCosts] = useState({})

    const fetchShopItems = async () => {
      try {
        const res = await api('/catalog', { method: 'GET' })
        setShopItems(res.items || [])
      } catch (err) {
        console.error(err)
      }
    }

    const fetchPopularItems = async () => {
      try {
        const res = await api('/ebay/popular', { method: 'GET' })
        setSearchResults(res.items || [])
      } catch (err) {
        console.warn('Could not load popular items:', err.message)
      } finally {
        setResultsLabel('popular')
      }
    }

    useEffect(() => {
      fetchShopItems()
      fetchPopularItems()
    }, [])

    const handleSearch = async (e) => {
      e.preventDefault()
      if (!searchQuery) return
      setSearching(true)
      try {
        const res = await api(`/ebay/search?q=${encodeURIComponent(searchQuery)}`, { method: 'GET' })
        setSearchResults(res.items || [])
        setResultsLabel(searchQuery)
      } catch (err) {
        console.error('Product search failed', err)
        alert('Search failed. Check the console for details.')
      } finally {
        setSearching(false)
      }
    }

    const handleCostChange = (itemId, val) => {
      setDraftCosts(prev => ({ ...prev, [itemId]: val }))
    }

    const handleAddToShop = async (item) => {
      const pointCost = parseInt(draftCosts[item.itemId], 10)

      if (!pointCost || pointCost <= 0) {
        alert("Please enter a valid point cost before adding to the shop.")
        return
      }

      try {
        await api('/catalog', {
          method: 'POST',
          body: JSON.stringify({
            ebayItemId: item.itemId,
            title: item.title,
            imageUrl: item.image,
            price: parseFloat(item.price?.value || 0),
            pointCost: pointCost // Sending the manual cost to the backend
          })
        })
        fetchShopItems()
        setDraftCosts(prev => ({ ...prev, [item.itemId]: '' })) // Clear input after saving
        alert('Added to shop!')
      } catch (err) {
        console.error('Failed to add to shop', err)
        alert('Failed to add item to shop.')
      }
    }

    const handleDeleteItem = async (itemId) => {
      if (!window.confirm('Remove this item from your catalog?')) return
      try {
        await api(`/catalog/${itemId}`, { method: 'DELETE' })
        fetchShopItems()
      } catch (err) {
        console.error('Failed to delete item', err)
        alert('Failed to remove item from catalog.')
      }
    }

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Catalog</h1>
          <p className="page-subtitle">Search the product catalog and add items to your sponsor rewards catalog.</p>

          <div className="catalog-layout">
            <section className="card catalog-panel">
              <h2 className="section-title">Search Products</h2>
              <form onSubmit={handleSearch} className="catalog-search-form">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search items (e.g., iPhone 13)…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </form>

              {/* Label swaps between Popular / search results */}
              {resultsLabel === 'popular' && (
                <p className="page-subtitle" style={{ marginTop: 0, marginBottom: 8 }}>
                  Popular products — or search above for something specific.
                </p>
              )}
              {resultsLabel !== '' && resultsLabel !== 'popular' && (
                <p className="page-subtitle" style={{ marginTop: 0, marginBottom: 8 }}>
                  Results for <strong>"{resultsLabel}"</strong>
                </p>
              )}

              <div className="landing-grid catalog-grid">
                {resultsLabel === '' ? (
                  <p className="activity-empty">Loading popular items…</p>
                ) : searchResults.length === 0 ? (
                  <p className="activity-empty">No results found. Try a different search term.</p>
                ) : (
                  searchResults.map(item => (
                    <div key={item.itemId} className="card catalog-item-card">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="catalog-item-img"
                        />
                      ) : null}
                      <h3 className="card-title catalog-item-title">{item.title}</h3>
                      <p className="catalog-item-price">Retail: ${item.price?.value ?? '-'}</p>

                      <div className="catalog-item-actions">
                        <input
                          type="number"
                          className="form-input catalog-cost-input"
                          placeholder="Points"
                          value={draftCosts[item.itemId] || ''}
                          onChange={(e) => handleCostChange(item.itemId, e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-success"
                          onClick={() => handleAddToShop(item)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="card catalog-panel">
              <h2 className="section-title">Your catalog</h2>
              <p className="page-subtitle" style={{ marginTop: -8 }}>
                Items currently available for drivers to redeem.
              </p>

              <div className="landing-grid catalog-grid">
                {shopItems.length === 0 ? (
                  <p className="activity-empty">Your catalog is currently empty.</p>
                ) : (
                  shopItems.map(item => (
                    <div key={item.id} className="card catalog-item-card">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="catalog-item-img"
                        />
                      ) : null}
                      <h3 className="card-title catalog-item-title">{item.title}</h3>

                      <div className="catalog-item-meta">
                        <span className="catalog-item-retail">Retail: ${item.price}</span>
                        <span className="catalog-pill">{item.point_cost} pts</span>
                      </div>

                      <div className="catalog-item-actions" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ color: 'crimson', borderColor: 'crimson' }}
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    )
  }

  // ============ ABOUT PAGE ============

  const AboutPage = () => {
    const [health, setHealth] = useState(null)
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState('')
    const [lastChecked, setLastChecked] = useState(null)

    const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
    const isAdmin = role === 'admin'

    const [sprintInfo, setSprintInfo] = useState(null)
    const [sprintLoading, setSprintLoading] = useState(true)
    const [showSprintModal, setShowSprintModal] = useState(false)
    const [sprintDraft, setSprintDraft] = useState({ sprint_number: '', title: '', description: '', goals: '' })
    const [sprintSaving, setSprintSaving] = useState(false)
    const [sprintSaveMsg, setSprintSaveMsg] = useState('')
    const [sprintSaveError, setSprintSaveError] = useState('')

    const loadSprintInfo = async () => {
      setSprintLoading(true)
      try {
        const data = await api('/sprint-info', { method: 'GET' })
        setSprintInfo(data)
        setSprintDraft({
          sprint_number: String(data?.sprint_number || ''),
          title: data?.title || '',
          description: data?.description || '',
          goals: data?.goals || ''
        })
      } catch {
        setSprintInfo(null)
      } finally {
        setSprintLoading(false)
      }
    }

    const saveSprintInfo = async (e) => {
      e.preventDefault()
      setSprintSaving(true); setSprintSaveMsg(''); setSprintSaveError('')
      try {
        await api('/sprint-info', {
          method: 'PUT',
          body: JSON.stringify({
            sprint_number: Number(sprintDraft.sprint_number) || 0,
            title: sprintDraft.title.trim(),
            description: sprintDraft.description.trim(),
            goals: sprintDraft.goals.trim()
          })
        })
        setSprintSaveMsg('Sprint info updated!')
        await loadSprintInfo()
        setTimeout(() => { setShowSprintModal(false); setSprintSaveMsg('') }, 1200)
      } catch (err) {
        setSprintSaveError(err.message || 'Failed to save sprint info')
      } finally {
        setSprintSaving(false)
      }
    }

    const checkHealth = async () => {
      setLoading(true)
      setFetchError('')
      try {
        const data = await api('/healthz', { method: 'GET' })
        setHealth(data)
        setLastChecked(new Date())
      } catch (err) {
        setFetchError(err.message || 'Could not reach server')
        setHealth(null)
        setLastChecked(new Date())
      } finally {
        setLoading(false)
      }
    }

    useEffect(() => {
      checkHealth()
      loadSprintInfo()
    }, [])

    // Derive statuses from whatever shape your /health endpoint returns.
    // Common shapes: { status, db: { status }, server: { uptime } }
    // or flat: { status: 'ok', database: 'connected', uptime: 3600 }
    const serverOk = !fetchError && (
      health?.status === 'ok' ||
      health?.status === 'healthy' ||
      health?.server?.status === 'ok' ||
      health?.server?.status === 'healthy' ||
      (health != null && !health.error)
    )

    const dbStatus =
      health?.db?.status ||
      health?.database?.status ||
      health?.database ||
      health?.db ||
      (serverOk ? 'connected' : null)

    const dbOk =
      dbStatus === 'connected' ||
      dbStatus === 'ok' ||
      dbStatus === 'healthy' ||
      dbStatus === true

    const uptime = health?.uptime ?? health?.server?.uptime ?? null
    const formatUptime = (seconds) => {
      if (seconds == null) return null
      const s = Number(seconds)
      if (isNaN(s)) return String(seconds)
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60)
      const sec = Math.floor(s % 60)
      if (h > 0) return `${h}h ${m}m ${sec}s`
      if (m > 0) return `${m}m ${sec}s`
      return `${sec}s`
    }

    const StatusBadge = ({ ok, loading, label }) => {
      if (loading) {
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999, fontSize: '0.82em', fontWeight: 600,
            backgroundColor: '#f3f4f6', color: '#6b7280'
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', backgroundColor: '#d1d5db',
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            Checking…
          </span>
        )
      }
      const color = ok ? '#16a34a' : '#dc2626'
      const bg = ok ? '#dcfce7' : '#fee2e2'
      const dot = ok ? '#22c55e' : '#ef4444'
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999, fontSize: '0.82em', fontWeight: 600,
          backgroundColor: bg, color
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', backgroundColor: dot,
            boxShadow: ok ? `0 0 0 2px ${dot}33` : 'none'
          }} />
          {label}
        </span>
      )
    }

    return (
      <div>
        <Navigation />
        <main className="app-main">

          {/* ── Hero ── */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 className="page-title" style={{ marginBottom: 8 }}>Driver Rewards</h1>
            <p className="page-subtitle" style={{ maxWidth: 480, margin: '0 auto' }}>
              A full-stack incentive platform that rewards safe, consistent driving — built for
              drivers, sponsors, and admins.
            </p>
          </div>

          {/* ── Live System Status ── */}
          <section className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Live System Status</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {lastChecked && (
                  <span style={{ fontSize: '0.8em', color: '#9ca3af' }}>
                    Last checked {lastChecked.toLocaleTimeString()}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={checkHealth}
                  disabled={loading}
                  style={{ fontSize: '0.85em', padding: '6px 16px' }}
                >
                  {loading ? 'Checking…' : '↺ Refresh'}
                </button>
              </div>
            </div>

            {fetchError && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                color: '#dc2626', fontSize: '0.875em'
              }}>
                <strong>Connection error:</strong> {fetchError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>

              {/* EC2 / Server */}
              <div style={{
                padding: '20px 24px', borderRadius: 10,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface, #f9fafb)'
              }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.78em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>
                  EC2 Server
                </p>
                <StatusBadge ok={serverOk} loading={loading} label={serverOk ? 'Reachable' : 'Unreachable'} />
                {uptime != null && !loading && (
                  <p style={{ margin: '10px 0 0', fontSize: '0.82em', color: '#6b7280' }}>
                    Uptime: <strong style={{ color: '#374151' }}>{formatUptime(uptime)}</strong>
                  </p>
                )}
              </div>

              {/* SQL / Database */}
              <div style={{
                padding: '20px 24px', borderRadius: 10,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface, #f9fafb)'
              }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.78em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>
                  SQL Database
                </p>
                <StatusBadge ok={dbOk} loading={loading} label={dbOk ? 'Connected' : (fetchError ? 'Unknown' : 'Disconnected')} />
                {health?.db?.type || health?.database?.type ? (
                  <p style={{ margin: '10px 0 0', fontSize: '0.82em', color: '#6b7280' }}>
                    Engine: <strong style={{ color: '#374151' }}>{health?.db?.type || health?.database?.type}</strong>
                  </p>
                ) : null}
              </div>

              {/* API Base */}
              <div style={{
                padding: '20px 24px', borderRadius: 10,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface, #f9fafb)'
              }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.78em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>
                  API Endpoint
                </p>
                <p style={{ margin: 0, fontSize: '0.82em', wordBreak: 'break-all', color: '#374151', fontFamily: 'monospace' }}>
                  {apiBase || '—'}
                </p>
              </div>

            </div>

            {/* Raw health payload (collapsible, dev-friendly) */}
            {health && !loading && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.82em', color: '#6b7280', userSelect: 'none' }}>
                  Raw /health response
                </summary>
                <pre style={{
                  marginTop: 10, padding: 14, borderRadius: 8,
                  backgroundColor: '#1e1e2e', color: '#cdd6f4',
                  fontSize: '0.78em', overflowX: 'auto', lineHeight: 1.6
                }}>
                  {JSON.stringify(health, null, 2)}
                </pre>
              </details>
            )}
          </section>

          {/* ── About the Platform ── */}
          <section style={{ marginBottom: 24 }}>
            <h2 className="section-title">About the Platform</h2>
            <div className="landing-grid landing-grid--two">

              <div className="card">
                <h3 className="card-title">For Drivers</h3>
                <p className="card-body">
                  Log safe trips to earn points, climb the leaderboard, unlock achievements,
                  and redeem rewards from participating sponsors. Connect with sponsors through
                  the affiliation portal.
                </p>
              </div>

              <div className="card">
                <h3 className="card-title">For Sponsors</h3>
                <p className="card-body">
                  Post sponsorship ads, review and accept driver applications, manage point
                  balances, and curate a reward catalog sourced from an online product catalog.
                </p>
              </div>

              {/* ── Sprint Info (from DB) ── */}
              <section className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <h2 className="section-title" style={{ margin: 0 }}>Current Sprint</h2>
                    {sprintInfo?.updated_at && (
                      <p style={{ margin: '2px 0 0', fontSize: '0.78em', color: '#9ca3af' }}>
                        Last updated {new Date(sprintInfo.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.85em', padding: '6px 16px' }}
                      onClick={() => { setShowSprintModal(true); setSprintSaveMsg(''); setSprintSaveError('') }}
                    >
                      ✎ Edit Sprint Info
                    </button>
                  )}
                </div>

                {sprintLoading ? (
                  <p style={{ color: '#9ca3af', fontSize: '0.875em' }}>Loading sprint info…</p>
                ) : sprintInfo ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ padding: '3px 14px', borderRadius: 999, background: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: '0.85em' }}>
                        Sprint {sprintInfo.sprint_number}
                      </span>
                      {sprintInfo.title && (
                        <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 700, color: '#1e293b' }}>{sprintInfo.title}</h3>
                      )}
                    </div>
                    {sprintInfo.description && (
                      <p style={{ margin: '0 0 12px', color: '#374151', lineHeight: 1.6 }}>{sprintInfo.description}</p>
                    )}
                    {sprintInfo.goals && (
                      <div style={{ padding: '10px 14px', borderRadius: 6, background: '#f8fafc', border: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.72em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>Sprint Goals</p>
                        <p style={{ margin: 0, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-line', fontSize: '0.875em' }}>{sprintInfo.goals}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <p style={{ margin: 0, color: '#9ca3af', fontStyle: 'italic', fontSize: '0.875em' }}>No sprint info configured yet.</p>
                    {isAdmin && (
                      <button type="button" className="btn btn-primary" style={{ fontSize: '0.8em', padding: '4px 12px' }}
                        onClick={() => { setShowSprintModal(true); setSprintSaveMsg(''); setSprintSaveError('') }}>
                        Set sprint info
                      </button>
                    )}
                  </div>
                )}
              </section>

            </div>
          </section>

          {/* ── Stack ── */}
          <section className="card" style={{ marginBottom: 24 }}>
            <h2 className="section-title">Tech Stack</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { layer: 'Frontend', detail: 'React · Vite' },
                { layer: 'Backend', detail: 'Node.js / Express (×3 services)' },
                { layer: 'Database', detail: 'SQL (MySQL / PostgreSQL)' },
                { layer: 'Infrastructure', detail: 'AWS EC2' },
                { layer: 'Auth', detail: 'Session cookies · JWT tokens' },
                { layer: 'Integrations', detail: 'Fake Store API' },
              ].map(({ layer, detail }) => (
                <div key={layer} style={{
                  padding: '14px 18px', borderRadius: 8,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface, #f9fafb)'
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.72em', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9ca3af' }}>
                    {layer}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.875em', fontWeight: 500, color: '#374151' }}>
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Version / Build info ── */}
          <section className="card">
            <h2 className="section-title">Build Info</h2>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'App', value: 'Driver Rewards v1.0' },
                { label: 'Active role', value: inferRoleFromBase(apiBase) },
                { label: 'Environment', value: import.meta.env.MODE || 'development' },
                { label: 'Build', value: import.meta.env.VITE_BUILD_TAG || 'local' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ margin: '0 0 2px', fontSize: '0.75em', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                  </p>
                  <p style={{ margin: 0, fontWeight: 600, color: '#374151', fontSize: '0.9em', fontFamily: 'monospace' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

        </main>

        {/* Pulse animation for loading badge */}
        {showSprintModal && (
          <div className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: 520 }}>
              <h2 className="page-title" style={{ marginBottom: 4 }}>Edit Sprint Info</h2>
              <p className="page-subtitle" style={{ marginBottom: 16 }}>
                This will be visible to all users on the About page.
              </p>

              <form onSubmit={saveSprintInfo}>
                <div className="form-group">
                  <label className="form-label">Sprint Number</label>
                  <input
                    type="number"
                    className="form-input"
                    value={sprintDraft.sprint_number}
                    onChange={e => setSprintDraft({ ...sprintDraft, sprint_number: e.target.value })}
                    placeholder="e.g. 3"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sprintDraft.title}
                    onChange={e => setSprintDraft({ ...sprintDraft, title: e.target.value })}
                    placeholder="e.g. Messaging & Catalog"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={sprintDraft.description}
                    onChange={e => setSprintDraft({ ...sprintDraft, description: e.target.value })}
                    placeholder="Brief description of what was built this sprint…"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sprint Goals</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={sprintDraft.goals}
                    onChange={e => setSprintDraft({ ...sprintDraft, goals: e.target.value })}
                    placeholder="List your sprint goals, one per line…"
                  />
                </div>

                {sprintSaveError && (
                  <p className="form-footer" style={{ color: 'crimson' }}>{sprintSaveError}</p>
                )}
                {sprintSaveMsg && (
                  <p className="form-footer" style={{ color: 'green' }}>{sprintSaveMsg}</p>
                )}

                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={sprintSaving}
                  >
                    {sprintSaving ? 'Saving…' : 'Save Sprint Info'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowSprintModal(false)
                      setSprintSaveMsg('')
                      setSprintSaveError('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      </div>
    )
  }


  // ============ MESSAGES PAGE ============
  const MessagesPage = () => {
    const role = ((currentUser?.role || inferRoleFromBase(apiBase)) + '').toLowerCase()
    const isSponsorUser = role === 'sponsor'

    const [conversations, setConversations] = useState([])
    const [selectedId, setSelectedId] = useState(null)
    const [thread, setThread] = useState([])
    const [threadContact, setThreadContact] = useState(null)
    const [loadingConvs, setLoadingConvs] = useState(false)
    const [loadingThread, setLoadingThread] = useState(false)
    const [msgBody, setMsgBody] = useState('')
    const [broadcastBody, setBroadcastBody] = useState('')
    const [showBroadcast, setShowBroadcast] = useState(false)
    const [error, setError] = useState('')
    const [sendError, setSendError] = useState('')
    const [sending, setSending] = useState(false)

    const loadConversations = async () => {
      setLoadingConvs(true)
      setError('')
      try {
        const data = await api('/messages', { method: 'GET' })
        setConversations(data.conversations || [])
      } catch (err) {
        setError(err.message || 'Failed to load conversations')
      } finally {
        setLoadingConvs(false)
      }
    }

    const loadThread = async (id) => {
      setLoadingThread(true)
      setSendError('')
      try {
        const path = isSponsorUser ? `/messages/driver/${id}` : `/messages/sponsor/${id}`
        const data = await api(path, { method: 'GET' })
        setThread(data.messages || [])
        setThreadContact(isSponsorUser ? data.driver : data.sponsor)
        // Refresh conversations to update unread counts
        const convData = await api('/messages', { method: 'GET' })
        setConversations(convData.conversations || [])
      } catch (err) {
        setError(err.message || 'Failed to load thread')
      } finally {
        setLoadingThread(false)
      }
    }

    const handleSelectConversation = (id) => {
      setSelectedId(id)
      setThread([])
      setThreadContact(null)
      setMsgBody('')
      setSendError('')
      loadThread(id)
    }

    const handleSend = async () => {
      if (!msgBody.trim()) return
      setSending(true)
      setSendError('')
      try {
        const path = isSponsorUser ? `/messages/driver/${selectedId}` : `/messages/sponsor/${selectedId}`
        await api(path, { method: 'POST', body: JSON.stringify({ body: msgBody.trim() }) })
        setMsgBody('')
        await loadThread(selectedId)
      } catch (err) {
        setSendError(err.message || 'Failed to send message')
      } finally {
        setSending(false)
      }
    }

    const handleBroadcast = async () => {
      if (!broadcastBody.trim()) return
      setSending(true)
      setSendError('')
      try {
        await api('/messages/broadcast', { method: 'POST', body: JSON.stringify({ body: broadcastBody.trim() }) })
        setBroadcastBody('')
        setShowBroadcast(false)
        await loadConversations()
      } catch (err) {
        setSendError(err.message || 'Failed to send broadcast')
      } finally {
        setSending(false)
      }
    }

    useEffect(() => { loadConversations() }, [])

    const myId = currentUser?.id

    const formatTime = (ts) => {
      if (!ts) return ''
      try {
        return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      } catch { return '' }
    }

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>

            {/* ── Left: Conversation List ── */}
            <div style={{ width: 280, minWidth: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface, #f9fafb)' }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Messages</h2>
                {isSponsorUser && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => { setShowBroadcast(true); setSendError('') }}
                  >
                    Broadcast
                  </button>
                )}
              </div>

              {loadingConvs && <p style={{ padding: 16, color: '#9ca3af', fontSize: '0.85em' }}>Loading…</p>}
              {error && <p style={{ padding: 16, color: '#ef4444', fontSize: '0.85em' }}>{error}</p>}

              {!loadingConvs && conversations.length === 0 && (
                <p style={{ padding: 16, color: '#9ca3af', fontSize: '0.85em' }}>
                  {isSponsorUser ? 'No conversations yet. Message a driver from the Drivers page, or send a broadcast.' : 'No messages yet. Your sponsor will message you here.'}
                </p>
              )}

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {conversations.map(conv => {
                  const id = isSponsorUser ? conv.driverId : conv.sponsorId
                  const name = isSponsorUser ? (conv.driverName || conv.driverEmail) : (conv.companyName || conv.sponsorEmail)
                  const unread = conv.unreadCount || 0
                  const isSelected = selectedId === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectConversation(id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '12px 16px', border: 'none', cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--primary-light, #eff6ff)' : 'transparent',
                        borderLeft: isSelected ? '3px solid var(--primary, #2563eb)' : '3px solid transparent',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: unread > 0 ? 700 : 500, fontSize: '0.9em', color: '#111827' }}>{name}</span>
                        {unread > 0 && (
                          <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7em', fontWeight: 700, flexShrink: 0 }}>
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p style={{ margin: '3px 0 0', fontSize: '0.78em', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.lastMessage}
                        </p>
                      )}
                      {conv.lastAt && (
                        <p style={{ margin: '2px 0 0', fontSize: '0.72em', color: '#9ca3af' }}>{formatTime(conv.lastAt)}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Right: Thread + Compose ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
              {!selectedId ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                  <p style={{ textAlign: 'center' }}>
                    Select a conversation to view messages
                    {isSponsorUser && <><br /><span style={{ fontSize: '0.85em' }}>or use Broadcast to message all your drivers</span></>}
                  </p>
                </div>
              ) : (
                <>
                  {/* Thread header */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95em' }}>
                        {isSponsorUser
                          ? (threadContact?.name || threadContact?.email || '…')
                          : (threadContact?.companyName || threadContact?.email || '…')}
                      </p>
                      {threadContact?.email && (
                        <p style={{ margin: 0, fontSize: '0.78em', color: '#6b7280' }}>{threadContact.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {loadingThread && <p style={{ color: '#9ca3af', textAlign: 'center' }}>Loading messages…</p>}
                    {!loadingThread && thread.length === 0 && (
                      <p style={{ color: '#9ca3af', textAlign: 'center' }}>No messages yet. Start the conversation!</p>
                    )}
                    {thread.map(msg => {
                      const isOwn = msg.sender_id === myId
                      const isBroadcast = Boolean(msg.is_broadcast)
                      return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                          {isBroadcast && (
                            <span style={{ fontSize: '0.7em', color: '#9ca3af', marginBottom: 2, alignSelf: 'flex-start' }}>📢 Broadcast</span>
                          )}
                          <div style={{
                            maxWidth: '70%', padding: '10px 14px', borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            backgroundColor: isOwn ? 'var(--primary, #2563eb)' : '#f3f4f6',
                            color: isOwn ? '#fff' : '#111827',
                            fontSize: '0.9em', lineHeight: 1.5,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                          }}>
                            {msg.body}
                          </div>
                          <p style={{ margin: '3px 4px 0', fontSize: '0.7em', color: '#9ca3af' }}>{formatTime(msg.created_at)}</p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Compose */}
                  {sendError && <p style={{ margin: '0 20px', color: '#ef4444', fontSize: '0.85em' }}>{sendError}</p>}
                  <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <textarea
                      value={msgBody}
                      onChange={e => setMsgBody(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                      rows={2}
                      style={{ flex: 1, resize: 'none', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9em', fontFamily: 'inherit' }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ alignSelf: 'flex-end' }}
                      onClick={handleSend}
                      disabled={sending || !msgBody.trim()}
                    >
                      {sending ? '…' : 'Send'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Broadcast Modal ── */}
          {showBroadcast && (
            <div className="modal-backdrop">
              <div className="modal-card" style={{ maxWidth: 480 }}>
                <h2 className="page-title" style={{ marginBottom: 4 }}>Broadcast to All Drivers</h2>
                <p className="page-subtitle" style={{ marginBottom: 16 }}>
                  This message will be sent to all drivers currently in your program.
                </p>
                <textarea
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  placeholder="Type your message…"
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9em', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                {sendError && <p style={{ color: '#ef4444', fontSize: '0.85em', marginTop: 6 }}>{sendError}</p>}
                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleBroadcast}
                    disabled={sending || !broadcastBody.trim()}
                  >
                    {sending ? 'Sending…' : 'Send Broadcast'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setShowBroadcast(false); setSendError('') }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }


  // ─────────────────────────────────────────────
  // INTEGRATION INSTRUCTIONS (3 small changes)
  // ─────────────────────────────────────────────
  //
  // 1. getAllowedPages() — add 'about' to every role's array, e.g.:
  //
  //    if (role === 'driver') {
  //      return [...existingPages, 'about']
  //    }
  //    // repeat for sponsor, admin, and the default fallback
  //
  //
  // 2. Navigation component — add an "About" nav-link visible to all roles:
  //
  //    {allowed.includes('about') && (
  //      <button type="button" onClick={() => setCurrentPage('about')} className="nav-link">
  //        About
  //      </button>
  //    )}
  //
  //
  // 3. Main render block — add the route:
  //
  //    {isLoggedIn && currentPage === 'about' && <AboutPage />}
  //
  // ─────────────────────────────────────────────
  // BACKEND REQUIREMENT
  // ─────────────────────────────────────────────
  // The page calls GET /health on the active service.
  // A minimal response that covers all status fields looks like:
  //
  //   {
  //     "status": "ok",
  //     "db": { "status": "connected", "type": "mysql" },
  //     "uptime": 3600
  //   }
  //
  // If your /health already returns something different, the component
  // will still try to infer status from common field names automatically.
  // ─────────────────────────────────────────────

  // ============ MAIN RENDER ============
  return (
    <div>
      {/* Public Pages */}
      {!isLoggedIn && currentPage === 'landing' && <LandingPage />}
      {!isLoggedIn && currentPage === 'login' && <LoginPage />}
      {!isLoggedIn && currentPage === 'account-type' && <AccountTypePage />}
      {!isLoggedIn && currentPage === 'create-account' && <CreateAccountPage />}
      {!isLoggedIn && currentPage === 'reset-password' && <ResetPasswordPage prefill={resetPrefill} />}

      {/* Logged-in Pages */}
      {isLoggedIn && currentPage === 'dashboard' && <DashboardPage />}
      {isLoggedIn && currentPage === 'profile' && <ProfilePage />}
      {isLoggedIn && currentPage === 'account-details' && <AccountDetailsPage />}
      {isLoggedIn && currentPage === 'change-password' && <ChangePasswordPage />}
      {isLoggedIn && currentPage === 'about' && <AboutPage />}

      {/* Driver Pages */}
      {isLoggedIn && currentPage === 'log-trip' && <LogTripPage />}
      {isLoggedIn && currentPage === 'rewards' && <RewardsPage />}
      {isLoggedIn && currentPage === 'leaderboard' && <LeaderboardPage />}
      {isLoggedIn && currentPage === 'achievements' && <AchievementsPage />}
      {isLoggedIn && currentPage === 'sponsor-affiliation' && <SponsorAffiliationPage />}

      {/* Sponsor Pages */}
      {isLoggedIn && currentPage === 'point-management' && <PointManagementPage />}

      {/* Sponsor/Admin shared Pages */}
      {isLoggedIn && currentPage === 'applications' && currentUser?.role !== 'admin' && <ApplicationsPage />}
      {isLoggedIn && currentPage === 'drivers' && <SponsorDriversPage />}
      {isLoggedIn && currentPage === 'catalog' && <SponsorCatalogPage />}
      {isLoggedIn && currentPage === 'messages' && <MessagesPage />}

      {/* Admin ONLY Pages */}
      {isLoggedIn && currentPage === 'admin-users' && <AdminUsersPage />}

      {showLogoutConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2 className="page-title" style={{ marginBottom: 4 }}>Log out?</h2>
            <p className="page-subtitle" style={{ marginBottom: 20 }}>
              You’ll be signed out of Driver Rewards and returned to the login screen.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  setShowLogoutConfirm(false)
                  await handleLogout()
                }}
              >
                Log out
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2 className="page-title" style={{ marginBottom: 4 }}>Delete account?</h2>
            <p className="page-subtitle" style={{ marginBottom: 20 }}>
              This will sign you out. Account deletion is not yet implemented.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  setShowDeleteConfirm(false)
                  await handleLogout()
                }}
              >
                Delete Account
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App