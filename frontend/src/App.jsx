import React, { useEffect, useMemo, useState, useRef } from 'react'

function App() {
  // ============ STATE MANAGEMENT ============
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState('landing')
  const [currentUser, setCurrentUser] = useState(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [maintenanceBanner, setMaintenanceBanner] = useState(null)
  const [pendingRole, setPendingRole] = useState('driver') // chosen role for new accounts (driver | sponsor)
  // Prefill for reset-password deep links (?page=reset-password&email=...&token=...)
  const [resetPrefill, setResetPrefill] = useState({ email: '', token: '' })
  const [pointMgmtInitialTab, setPointMgmtInitialTab] = useState(null)

  // Driver cart (client-side for now)
  const [cart, setCart] = useState(() => {
    try {
      const raw = window.localStorage.getItem('gdip_cart_v1')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try { window.localStorage.setItem('gdip_cart_v1', JSON.stringify(cart)) } catch { /* ignore */ }
  }, [cart])

  const addToCart = (item) => {
    if (!item?.id) return
    setCart((prev) => {
      const idx = prev.findIndex((x) => String(x.id) === String(item.id))
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], qty: Number(copy[idx].qty || 1) + 1 }
        return copy
      }
      return [
        ...prev,
        {
          id: item.id,
          title: item.title,
          image_url: item.image_url || null,
          point_cost: Number(item.point_cost || 0),
          sponsor_id: item.sponsor_id ?? null,
          is_available: item.is_available ?? 1,
          qty: 1,
        }
      ]
    })
  }

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((x) => String(x.id) !== String(itemId)))
  }

  const setCartQty = (itemId, qty) => {
    const q = Math.max(1, Math.min(99, Number(qty) || 1))
    setCart((prev) =>
      prev.map((x) => (String(x.id) === String(itemId) ? { ...x, qty: q } : x))
    )
  }

  const incrementCartQty = (itemId) => {
    setCart((prev) =>
      prev.map((x) =>
        String(x.id) === String(itemId) ? { ...x, qty: Math.min(99, Number(x.qty || 1) + 1) } : x
      )
    )
  }

  const decrementCartQty = (itemId) => {
    setCart((prev) =>
      prev.map((x) =>
        String(x.id) === String(itemId) ? { ...x, qty: Math.max(1, Number(x.qty || 1) - 1) } : x
      )
    )
  }

  const clearCart = () => setCart([])
  const [lastOrder, setLastOrder] = useState(null)
  const [orderToView, setOrderToView] = useState(null)

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
      case 'shop':
        return '/shop'
      case 'cart':
        return '/cart'
      case 'order-confirmation':
        return '/order-confirmation'
      case 'order-history':
        return '/order-history'
      case 'order-detail':
        return '/order-detail'
      case 'messages':
        return '/messages'
      case 'sponsor-preview':
        return '/sponsor-preview'
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
      case 'organization':
        return '/organization'
      case 'system-monitoring':
        return '/system-monitoring'
      case 'notifications':
        return '/notifications'
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
    if (path === '/shop') return 'shop'
    if (path === '/cart') return 'cart'
    if (path === '/order-confirmation') return 'order-confirmation'
    if (path === '/order-history') return 'order-history'
    if (path === '/order-detail') return 'order-detail'
    if (path === '/messages') return 'messages'
    if (path === '/sponsor-preview') return 'sponsor-preview'
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
    if (path === '/organization') return 'organization'
    if (path === '/system-monitoring') return 'system-monitoring'
    if (path === '/notifications') return 'notifications'

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

  // Ensure requests always go to the correct role service after auth/session restore.
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.role) return

    const role = String(currentUser.role).toLowerCase()
    const expectedBase =
      role === 'admin' ? ADMIN_API_BASE :
        role === 'sponsor' ? SPONSOR_API_BASE :
          DRIVER_API_BASE

    if ((apiBase || '').replace(/\/$/, '') !== expectedBase) {
      setApiBasePersisted(expectedBase)
    }
  }, [isLoggedIn, currentUser?.role])

  // Cart sync: keep the server-side cart in sync for driver accounts.
  // (Must be declared after apiBase/inferRoleFromBase exist.)
  const cartSyncReadyRef = useRef(false)
  const cartSyncTimerRef = useRef(null)
  const cartPendingSaveRef = useRef(false)
  const [cartHydrated, setCartHydrated] = useState(false)

  const saveCartToServer = async (cartToSave) => {
    await api('/cart', {
      method: 'PUT',
      body: JSON.stringify({ items: (cartToSave || []).map(x => ({ id: x.id, qty: x.qty || 1 })) })
    })
  }

  // Bootstrap cart from the server after login.
  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      cartSyncReadyRef.current = false
      setCartHydrated(false)

      const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
      if (!isLoggedIn || role !== 'driver') {
        cartSyncReadyRef.current = true
        setCartHydrated(true)
        return
      }

      try {
        const data = await api('/cart', { method: 'GET' })
        const serverItems = Array.isArray(data?.items) ? data.items : []
        if (cancelled) return

        if (serverItems.length) {
          setCart(serverItems)
        } else if (cart.length) {
          // If the server has no cart yet, seed it from the cached local cart.
          await saveCartToServer(cart)
        }
      } catch {
        // If the server cart can't be loaded, keep local cart.
      } finally {
        cartSyncReadyRef.current = true
        setCartHydrated(true)
      }
    }

    bootstrap()
    return () => { cancelled = true }
    // intentionally omit `cart` dependency: we only want to bootstrap once per login/user/base change
  }, [isLoggedIn, currentUser?.id, apiBase])

  // Persist cart changes to the server (debounced).
  useEffect(() => {
    const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
    if (!isLoggedIn || role !== 'driver') return
    if (!cartSyncReadyRef.current || !cartHydrated) {
      cartPendingSaveRef.current = true
      return
    }

    if (cartSyncTimerRef.current) clearTimeout(cartSyncTimerRef.current)
    cartSyncTimerRef.current = setTimeout(async () => {
      try {
        await saveCartToServer(cart)
      } catch {
        // best-effort; cart remains usable locally even if persistence fails
      }
    }, 400)

    return () => {
      if (cartSyncTimerRef.current) clearTimeout(cartSyncTimerRef.current)
    }
  }, [cart, isLoggedIn, currentUser?.id, apiBase])

  // If the user edited the cart before hydration finished, flush once hydration completes.
  useEffect(() => {
    const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
    if (!isLoggedIn || role !== 'driver') return
    if (!cartHydrated) return
    if (!cartPendingSaveRef.current) return
    cartPendingSaveRef.current = false

    // Fire-and-forget; if it fails we still have local cart.
    saveCartToServer(cart).catch(() => {})
  }, [cartHydrated, isLoggedIn, currentUser?.id, apiBase])

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
    const safePath = path.startsWith('/') ? path : `/${path}`
    const requestUrl = `${apiBase}${safePath}`

    try {
      res = await fetch(requestUrl,
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
        `Received HTML from the server instead of API JSON for ${requestUrl}. ` +
        'This usually means one of: (1) the Vite /api/* proxy is not active, ' +
        '(2) the backend service for this role is not running, or (3) the service was not restarted after route changes (for orders, restart driver service).'
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

  // Check for active maintenance windows (no auth required)
  useEffect(() => {
    const ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_BASE || '/api/admin').replace(/\/$/, '')
    const checkMaint = async () => {
      try {
        const res = await fetch(`${ADMIN_BASE}/system/maintenance/active`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.windows?.length) {
            setMaintenanceBanner(data.windows[0])
          } else {
            setMaintenanceBanner(null)
          }
        }
      } catch { /* ignore */ }
    }
    checkMaint()
    const iv = setInterval(checkMaint, 5 * 60 * 1000) // re-check every 5 min
    return () => clearInterval(iv)
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
      'system-monitoring',
      'notifications',
      'profile',
      'account-details',
      'change-password',
      'about'
    ];

    const sponsorPages = [
      'dashboard',
      'drivers',
      'point-management',
      'organization',
      'applications',
      'catalog',
      'sponsor-preview',
      'messages',
      'notifications',
      'profile',
      'account-details',
      'change-password',
      'about'
    ];

    const driverPages = hasSponsor
      ? ['dashboard', 'log-trip', 'shop', 'cart', 'order-confirmation', 'order-history', 'order-detail', 'rewards', 'leaderboard', 'achievements', 'messages', 'notifications', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about']
      : ['dashboard', 'shop', 'cart', 'order-confirmation', 'order-history', 'order-detail', 'messages', 'notifications', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about'];

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

      // Load the user profile using the explicit base (React state may not
      // have flushed yet, so `api()` / `loadMe()` could still point at the
      // old apiBase, causing a 401).
      const me = await apiWithBase(roleBase, '/me', { method: 'GET' })
      const u = normalizeMe(me)
      setCurrentUser(u)

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
              <p className="landing-eyebrow">SafeMiles Program</p>
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
          <p className="login-subtitle">Select how you want to use SafeMiles.</p>

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
          <h1 className="login-title">SafeMiles</h1>
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
    const cartCount = useMemo(
      () => (Array.isArray(cart) ? cart.reduce((sum, x) => sum + Number(x.qty || 1), 0) : 0),
      [cart]
    )

    return (
      <>
      {maintenanceBanner && (
        <div style={{ background: '#fbbf24', color: '#78350f', textAlign: 'center', padding: '8px 16px', fontSize: '14px', fontWeight: 600 }}>
          Scheduled Maintenance: {maintenanceBanner.title}
          {maintenanceBanner.starts_at && ` — ${new Date(maintenanceBanner.starts_at).toLocaleString()}`}
          {maintenanceBanner.ends_at && ` to ${new Date(maintenanceBanner.ends_at).toLocaleString()}`}
        </div>
      )}
      <nav className="nav">
        <div className="nav-brand">SafeMiles</div>
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

          {/* Sponsor-only: Organization button */}
          {isSponsor && allowed.includes('organization') && (
            <button type="button" onClick={() => setCurrentPage('organization')} className="nav-link">
              Organization
            </button>
          )}

          {/* Sponsor-only: Catalog button */}
          {isSponsor && allowed.includes('catalog') && (
            <button type="button" onClick={() => setCurrentPage('catalog')} className="nav-link">
              Catalog
            </button>
          )}
          {isSponsor && allowed.includes('sponsor-preview') && (
            <button type="button" onClick={() => setCurrentPage('sponsor-preview')} className="nav-link">
              Preview Catalog
            </button>
          )}

          {/* Messages — sponsors and drivers */}
          {(isSponsor || isDriver) && allowed.includes('messages') && (
            <button type="button" onClick={() => setCurrentPage('messages')} className="nav-link">
              Messages
            </button>
          )}

          {/* Notifications — all roles */}
          {allowed.includes('notifications') && (
            <button type="button" onClick={() => setCurrentPage('notifications')} className="nav-link">
              Notifications
            </button>
          )}

          {/* Driver-only */}
          {isDriver && allowed.includes('shop') && (
            <button type="button" onClick={() => setCurrentPage('shop')} className="nav-link">
              Shop
            </button>
          )}
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
          {isAdmin && allowed.includes('system-monitoring') && (
            <button type="button" onClick={() => setCurrentPage('system-monitoring')} className="nav-link">System</button>
          )}

          {/* Points are only meaningful for drivers; keep UI clean for sponsors/admin */}
          {isDriver ? <span className="nav-pts">{currentUser?.points ?? 0} pts</span> : null}
          {isDriver && allowed.includes('cart') && (
            <button type="button" onClick={() => setCurrentPage('cart')} className="nav-link">
              Cart{cartCount > 0 ? ` (${cartCount})` : ''}
            </button>
          )}
          {isDriver && allowed.includes('order-history') && (
            <button type="button" onClick={() => setCurrentPage('order-history')} className="nav-link">
              Orders
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="nav-logout"
          >
            Log out
          </button>
        </div>
      </nav>
      </>
    )
  }

  // ============ ORGANIZATION PAGE (sponsor) ============
  // Covers: #2980-2992, tasks #17506-17527
  const OrganizationPage = () => {
    const [activeTab, setActiveTab] = useState('overview')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Org data
    const [org, setOrg] = useState(null)
    const [myRole, setMyRole] = useState('member')
    const [stats, setStats] = useState(null)

    // Users
    const [orgUsers, setOrgUsers] = useState([])

    // New user form
    const [newUser, setNewUser] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'member' })

    // Invite existing user form
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('member')

    // Edit org form
    const [editOrg, setEditOrg] = useState({})

    // Edit user profile
    const [editingUser, setEditingUser] = useState(null)
    const [editUserForm, setEditUserForm] = useState({ firstName: '', lastName: '', phone: '' })

    // Reset password
    const [resetPwUser, setResetPwUser] = useState(null)
    const [resetPwValue, setResetPwValue] = useState('')

    // Activity log
    const [logs, setLogs] = useState([])

    const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin'

    const loadOrg = async () => {
      try {
        const data = await api('/organization', { method: 'GET' })
        setOrg(data?.organization || null)
        setMyRole(data?.myRole || 'member')
        if (data?.organization) {
          setEditOrg({
            name: data.organization.name || '',
            description: data.organization.description || '',
            phone: data.organization.phone || '',
            address_line1: data.organization.address_line1 || '',
            city: data.organization.city || '',
            state: data.organization.state || '',
            postal_code: data.organization.postal_code || '',
            country: data.organization.country || '',
          })
        }
      } catch (e) { setError(e?.message || 'Failed to load organization') }
    }

    const loadStats = async () => {
      try {
        const data = await api('/organization/stats', { method: 'GET' })
        setStats(data || null)
      } catch (e) { setError(e?.message || 'Failed to load stats') }
    }

    const loadUsers = async () => {
      try {
        const data = await api('/organization/users', { method: 'GET' })
        setOrgUsers(Array.isArray(data?.users) ? data.users : [])
      } catch (e) { setError(e?.message || 'Failed to load users') }
    }

    const loadLogs = async () => {
      try {
        const data = await api('/organization/activity-log', { method: 'GET' })
        setLogs(Array.isArray(data?.logs) ? data.logs : [])
      } catch (e) { setError(e?.message || 'Failed to load activity log') }
    }

    useEffect(() => {
      setLoading(true)
      Promise.all([loadOrg(), loadStats(), loadUsers(), loadLogs()])
        .finally(() => setLoading(false))
    }, [])

    const saveOrg = async () => {
      setError(''); setSuccess('')
      try {
        await api('/organization', { method: 'PUT', body: JSON.stringify(editOrg) })
        setSuccess('Organization updated.')
        await loadOrg()
      } catch (e) { setError(e?.message || 'Failed to update organization') }
    }

    const createUser = async () => {
      setError(''); setSuccess('')
      if (!newUser.email || !newUser.password) { setError('Email and password are required.'); return }
      try {
        await api('/organization/users', { method: 'POST', body: JSON.stringify(newUser) })
        setSuccess('User created successfully.')
        setNewUser({ email: '', password: '', firstName: '', lastName: '', role: 'member' })
        await loadUsers()
      } catch (e) { setError(e?.message || 'Failed to create user') }
    }

    const inviteUser = async () => {
      setError(''); setSuccess('')
      if (!inviteEmail) { setError('Email is required.'); return }
      try {
        const data = await api('/organization/users/invite', {
          method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole })
        })
        setSuccess(`Added ${data?.email || inviteEmail} to your organization.`)
        setInviteEmail(''); setInviteRole('member')
        await loadUsers()
      } catch (e) { setError(e?.message || 'Failed to add user') }
    }

    const changeRole = async (userId, role) => {
      setError(''); setSuccess('')
      try {
        await api(`/organization/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
        setSuccess('Role updated.')
        await loadUsers()
      } catch (e) { setError(e?.message || 'Failed to change role') }
    }

    const toggleActive = async (userId, currentlyActive) => {
      setError(''); setSuccess('')
      const endpoint = currentlyActive ? 'deactivate' : 'activate'
      if (currentlyActive && !window.confirm('Deactivate this user? They will not be able to log in.')) return
      try {
        await api(`/organization/users/${userId}/${endpoint}`, { method: 'PUT' })
        setSuccess(currentlyActive ? 'User deactivated.' : 'User reactivated.')
        await loadUsers()
      } catch (e) { setError(e?.message || 'Failed to update user status') }
    }

    const saveEditUser = async () => {
      setError(''); setSuccess('')
      if (!editingUser) return
      try {
        await api(`/organization/users/${editingUser}/profile`, {
          method: 'PUT', body: JSON.stringify(editUserForm)
        })
        setSuccess('Profile updated.')
        setEditingUser(null)
        await loadUsers()
      } catch (e) { setError(e?.message || 'Failed to update profile') }
    }

    const doResetPassword = async () => {
      setError(''); setSuccess('')
      if (!resetPwUser || resetPwValue.length < 8) { setError('Password must be at least 8 characters.'); return }
      try {
        await api(`/organization/users/${resetPwUser}/reset-password`, {
          method: 'POST', body: JSON.stringify({ newPassword: resetPwValue })
        })
        setSuccess('Password has been reset.')
        setResetPwUser(null); setResetPwValue('')
      } catch (e) { setError(e?.message || 'Failed to reset password') }
    }

    const tabs = [
      { key: 'overview', label: 'Overview' },
      { key: 'users', label: 'Users' },
      { key: 'settings', label: 'Settings' },
      { key: 'activity', label: 'Activity Log' },
    ]

    const formatAction = (action) => {
      const map = {
        update_organization: 'Updated organization',
        create_sponsor_user: 'Created user',
        change_role: 'Changed role',
        deactivate_user: 'Deactivated user',
        activate_user: 'Reactivated user',
        edit_profile: 'Edited profile',
        reset_password: 'Reset password',
        invite_existing_user: 'Invited user',
        add_points: 'Added points',
        deduct_points: 'Deducted points',
      }
      return map[action] || action
    }

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Organization</h1>
          <p className="page-subtitle">{org?.name || 'Loading...'}</p>

          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button key={t.key} type="button"
                className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setActiveTab(t.key); setError(''); setSuccess('') }}>
                {t.label}
              </button>
            ))}
          </div>

          {error && <p className="form-footer" style={{ color: 'crimson' }}>{error}</p>}
          {success && <p className="form-footer" style={{ color: 'green' }}>{success}</p>}

          {/* ── Overview Tab ── */}
          {activeTab === 'overview' && (
            <div>
              {loading ? <p>Loading...</p> : (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <p className="stat-label">Total Drivers</p>
                      <p className="stat-value stat-value-blue">{stats?.totalDrivers ?? 0}</p>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Total Points Distributed</p>
                      <p className="stat-value stat-value-green">{Number(stats?.totalPointsDistributed ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Sponsor Users</p>
                      <p className="stat-value stat-value-amber">{stats?.totalSponsors ?? 0}</p>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Organization Created</p>
                      <p className="stat-value" style={{ fontSize: '1em' }}>
                        {stats?.organizationCreatedAt ? new Date(stats.organizationCreatedAt).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>

                  {org && (
                    <div className="card" style={{ marginTop: 16 }}>
                      <h2 className="section-title" style={{ marginTop: 0 }}>Organization Info</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        {[
                          { label: 'Name', value: org.name },
                          { label: 'Description', value: org.description },
                          { label: 'Phone', value: org.phone },
                          { label: 'Address', value: org.address_line1 },
                          { label: 'City', value: org.city },
                          { label: 'State', value: org.state },
                          { label: 'Postal Code', value: org.postal_code },
                          { label: 'Country', value: org.country },
                          { label: 'Your Role', value: myRole },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ padding: '10px 14px', borderRadius: 6, background: '#fff', border: '1px solid var(--border)' }}>
                            <p style={{ margin: '0 0 2px', fontSize: '0.72em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>{label}</p>
                            <p style={{ margin: 0, fontSize: '0.875em', fontWeight: 500, color: '#374151', wordBreak: 'break-all' }}>{String(value ?? '\u2014')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button className="btn btn-primary" type="button" onClick={() => { loadOrg(); loadStats() }} style={{ marginTop: 12 }}>
                    Refresh
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Users Tab ── */}
          {activeTab === 'users' && (
            <div>
              {isOwnerOrAdmin && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>Add Sponsor User</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
                    <input className="form-input" type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                    <input className="form-input" type="password" placeholder="Password (min 8)" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
                    <input className="form-input" type="text" placeholder="First Name" value={newUser.firstName} onChange={e => setNewUser(p => ({ ...p, firstName: e.target.value }))} />
                    <input className="form-input" type="text" placeholder="Last Name" value={newUser.lastName} onChange={e => setNewUser(p => ({ ...p, lastName: e.target.value }))} />
                    <select className="form-input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button className="btn btn-success" type="button" onClick={createUser}>Create User</button>
                </div>
              )}

              {isOwnerOrAdmin && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>Add Existing Sponsor Account</h2>
                  <p className="page-subtitle" style={{ marginBottom: 8 }}>
                    Add a sponsor who already has an account to your organization.
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="form-input" style={{ flex: 1, minWidth: 250 }} type="email" placeholder="Sponsor's email address"
                      value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                    <select className="form-input" style={{ width: 120 }} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className="btn btn-success" type="button" onClick={inviteUser}>Add to Org</button>
                  </div>
                </div>
              )}

              <div className="card">
                <h2 className="section-title" style={{ marginTop: 0 }}>Organization Members</h2>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        {isOwnerOrAdmin && <th style={{ width: 280 }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {orgUsers.length === 0 ? (
                        <tr><td colSpan={isOwnerOrAdmin ? 6 : 5} className="table-empty">No users found</td></tr>
                      ) : orgUsers.map(u => {
                        const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
                        const isActive = u.is_active !== 0
                        return (
                          <tr key={u.id} style={{ opacity: isActive ? 1 : 0.5 }}>
                            <td>{name}</td>
                            <td>{u.email}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: '0.8em', fontWeight: 600,
                                background: u.sponsor_role === 'owner' ? '#dbeafe' : u.sponsor_role === 'admin' ? '#e0e7ff' : '#f3f4f6',
                                color: u.sponsor_role === 'owner' ? '#1e40af' : u.sponsor_role === 'admin' ? '#3730a3' : '#374151',
                              }}>
                                {u.sponsor_role}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: '0.8em', fontWeight: 600,
                                background: isActive ? '#d1fae5' : '#fee2e2',
                                color: isActive ? '#065f46' : '#991b1b',
                              }}>
                                {isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85em' }}>
                              {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                            </td>
                            {isOwnerOrAdmin && (
                              <td>
                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                  {u.sponsor_role !== 'owner' && myRole === 'owner' && (
                                    <select className="form-input" style={{ width: 90, fontSize: '0.75em', padding: '2px 4px' }}
                                      value={u.sponsor_role}
                                      onChange={e => changeRole(u.id, e.target.value)}>
                                      <option value="admin">Admin</option>
                                      <option value="member">Member</option>
                                    </select>
                                  )}
                                  {u.sponsor_role !== 'owner' && u.id !== (currentUser?.id) && (
                                    <>
                                      <button className="btn btn-secondary" type="button"
                                        style={{ fontSize: '0.7em', padding: '2px 6px' }}
                                        onClick={() => {
                                          setEditingUser(u.id)
                                          setEditUserForm({ firstName: u.first_name || '', lastName: u.last_name || '', phone: u.phone || '' })
                                        }}>
                                        Edit
                                      </button>
                                      <button className="btn btn-secondary" type="button"
                                        style={{ fontSize: '0.7em', padding: '2px 6px' }}
                                        onClick={() => { setResetPwUser(u.id); setResetPwValue('') }}>
                                        Reset PW
                                      </button>
                                      <button className={isActive ? 'btn btn-danger' : 'btn btn-success'} type="button"
                                        style={{ fontSize: '0.7em', padding: '2px 6px' }}
                                        onClick={() => toggleActive(u.id, isActive)}>
                                        {isActive ? 'Deactivate' : 'Activate'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit user modal */}
              {editingUser && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>Edit User Profile</h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <input className="form-input" placeholder="First Name" value={editUserForm.firstName} onChange={e => setEditUserForm(p => ({ ...p, firstName: e.target.value }))} />
                    <input className="form-input" placeholder="Last Name" value={editUserForm.lastName} onChange={e => setEditUserForm(p => ({ ...p, lastName: e.target.value }))} />
                    <input className="form-input" placeholder="Phone" value={editUserForm.phone} onChange={e => setEditUserForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-success" type="button" onClick={saveEditUser}>Save</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setEditingUser(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Reset password modal */}
              {resetPwUser && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>Reset Password</h2>
                  <p className="page-subtitle" style={{ marginBottom: 8 }}>
                    Enter a new password for user #{resetPwUser}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input className="form-input" type="password" placeholder="New password (min 8 chars)" value={resetPwValue}
                      onChange={e => setResetPwValue(e.target.value)} style={{ minWidth: 250 }} />
                    <button className="btn btn-success" type="button" onClick={doResetPassword}>Reset</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setResetPwUser(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Settings Tab ── */}
          {activeTab === 'settings' && (
            <div className="card">
              <h2 className="section-title" style={{ marginTop: 0 }}>Edit Organization</h2>
              {!isOwnerOrAdmin ? (
                <p className="activity-empty">Only owners and admins can edit organization settings.</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280' }}>Organization Name</label>
                      <input className="form-input" value={editOrg.name || ''} onChange={e => setEditOrg(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280' }}>Phone</label>
                      <input className="form-input" value={editOrg.phone || ''} onChange={e => setEditOrg(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280' }}>Address</label>
                      <input className="form-input" value={editOrg.address_line1 || ''} onChange={e => setEditOrg(p => ({ ...p, address_line1: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280' }}>City</label>
                      <input className="form-input" value={editOrg.city || ''} onChange={e => setEditOrg(p => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280' }}>State</label>
                      <input className="form-input" value={editOrg.state || ''} onChange={e => setEditOrg(p => ({ ...p, state: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280' }}>Postal Code</label>
                      <input className="form-input" value={editOrg.postal_code || ''} onChange={e => setEditOrg(p => ({ ...p, postal_code: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280' }}>Country</label>
                      <input className="form-input" value={editOrg.country || ''} onChange={e => setEditOrg(p => ({ ...p, country: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#6b7280' }}>Description</label>
                    <textarea className="form-input" rows={3} value={editOrg.description || ''}
                      onChange={e => setEditOrg(p => ({ ...p, description: e.target.value }))}
                      style={{ width: '100%', resize: 'vertical' }} />
                  </div>
                  <button className="btn btn-success" type="button" onClick={saveOrg}>Save Changes</button>
                </>
              )}
            </div>
          )}

          {/* ── Activity Log Tab ── */}
          {activeTab === 'activity' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 className="section-title" style={{ margin: 0 }}>Activity Log</h2>
                <button className="btn btn-primary" type="button" onClick={loadLogs}>Refresh</button>
              </div>
              {logs.length === 0 ? (
                <p className="activity-empty">No activity recorded yet</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(l => (
                        <tr key={l.id}>
                          <td style={{ fontSize: '0.85em', whiteSpace: 'nowrap' }}>{l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</td>
                          <td>{(l.actor_name || '').trim() || l.actor_email || '-'}</td>
                          <td>{formatAction(l.action)}</td>
                          <td>{(l.target_name || '').trim() || l.target_email || '-'}</td>
                          <td style={{ fontSize: '0.8em', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.details || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    )
  }

  // ============ POINT MANAGEMENT PAGE (sponsor) ============
  // Covers: bulk add/deduct (#2854, #2855), scheduled/recurring awards (#2856, #2868),
  // pause (#2857), cancel (#2869), calendar view (#2870), point expiration (#2858),
  // analytics (#2862, #2863, #2864)
  const PointManagementPage = () => {
    const [activeTab, setActiveTab] = useState(pointMgmtInitialTab || 'analytics')
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

    // Conversion rate state
    const [conversionRate, setConversionRate] = useState(null)
    const [conversionInput, setConversionInput] = useState('')
    const [conversionSaving, setConversionSaving] = useState(false)

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

    const loadConversionRate = async () => {
      try {
        const data = await api('/conversion-rate', { method: 'GET' })
        setConversionRate(data?.rate || null)
        if (data?.rate) setConversionInput(String(data.rate.dollars_per_point))
      } catch (e) {
        setError(e?.message || 'Failed to load conversion rate')
      }
    }

    useEffect(() => {
      if (pointMgmtInitialTab) setPointMgmtInitialTab(null)
      setLoading(true)
      Promise.all([loadDrivers(), loadAwards(), loadExpiration(), loadAnalytics(), loadConversionRate()])
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

    // -- Conversion Rate --
    const saveConversionRate = async () => {
      setError(''); setSuccess('')
      const val = Number(conversionInput)
      if (!Number.isFinite(val) || val <= 0) {
        setError('Enter a positive dollar amount (e.g. 0.01 means $0.01 per point).')
        return
      }
      const oldRate = conversionRate
        ? `$${Number(conversionRate.dollars_per_point).toFixed(4)}`
        : null
      const newRate = `$${val.toFixed(4)}`
      const confirmMsg = oldRate
        ? `Change conversion rate from ${oldRate} to ${newRate} per point?\n\nAll existing catalog items will have their point costs recalculated immediately.`
        : `Set conversion rate to ${newRate} per point?\n\nAll existing catalog items with a price will have their point costs calculated immediately.`
      if (!window.confirm(confirmMsg)) return
      setConversionSaving(true)
      try {
        const data = await api('/conversion-rate', {
          method: 'PUT',
          body: JSON.stringify({ dollarsPerPoint: val })
        })
        const count = data?.updatedItems ?? 0
        const recalcErr = data?.recalcError
        if (recalcErr) {
          setSuccess(`Saved ${newRate} per point. Note: catalog recalculation failed — ${recalcErr}`)
        } else {
          setSuccess(`Saved ${newRate} per point. ${count} catalog item${count !== 1 ? 's' : ''} updated.`)
        }
        await loadConversionRate()
      } catch (e) {
        setError(e?.message || 'Failed to save conversion rate')
      } finally {
        setConversionSaving(false)
      }
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
      { key: 'conversion', label: 'Conversion Rate' },
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

          {/* -- Conversion Rate Tab -- */}
          {activeTab === 'conversion' && (() => {
            const previewVal = parseFloat(conversionInput)
            const previewValid = Number.isFinite(previewVal) && previewVal > 0
            const samplePrices = [1, 5, 10, 25, 50]
            return (
              <div className="card">
                <h2 className="section-title" style={{ marginTop: 0 }}>Dollar-to-Point Conversion Rate</h2>
                <p className="page-subtitle" style={{ marginBottom: 12 }}>
                  Set how many dollars equal one point in your program. When saved, all existing catalog items with a price will have their point costs recalculated automatically.
                </p>
                {conversionRate && (
                  <p style={{ marginBottom: 12, fontSize: '0.875em', color: '#6b7280' }}>
                    Current rate: <strong>${Number(conversionRate.dollars_per_point).toFixed(4)}</strong> per point
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                  <input
                    className="form-input"
                    style={{ width: 180 }}
                    type="number"
                    min="0.0001"
                    step="0.01"
                    placeholder="$ per point (e.g. 0.01)"
                    value={conversionInput}
                    onChange={e => setConversionInput(e.target.value)}
                    disabled={conversionSaving}
                  />
                  <button
                    className="btn btn-success"
                    type="button"
                    onClick={saveConversionRate}
                    disabled={conversionSaving}
                  >
                    {conversionSaving ? 'Saving…' : 'Save Rate'}
                  </button>
                </div>
                {previewValid && (
                  <div style={{ marginTop: 0, padding: '10px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.8em', fontWeight: 600, color: '#0369a1' }}>Point cost preview at ${previewVal.toFixed(4)}/pt:</p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {samplePrices.map(p => (
                        <span key={p} style={{ fontSize: '0.8em', color: '#0c4a6e' }}>
                          ${p}.00 → <strong>{Math.ceil(p / previewVal)} pts</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </main>
      </div>
    )
  }

  // ============ DRIVERS PAGE (for sponsors: adjust driver points + view ledger) ============
 
// ═══════════════════════════════════════════════════════════════════════════
// UPDATED SponsorDriversPage
// Replace the existing SponsorDriversPage in App.jsx with this component.
//
// Adds:
//  #2968 — Filter by active/inactive status
//  #2969 — Drivers near point expiration tab
//  #2970 — Export driver data to CSV
//  #2971 — View inactive drivers (via status filter)
//  #2972 — Driver login history modal
//  #2977 — Top performers tab (sorted by points)
// ═══════════════════════════════════════════════════════════════════════════

const SponsorDriversPage = () => {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // ── Active tab ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('all')

  // ── Status filter (#2968, #2971) ────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('active') // 'all' | 'active' | 'inactive'

  // ── Per-driver point adjustment ─────────────────────────────────────────
  const [deltaById, setDeltaById] = useState({})
  const [reasonById, setReasonById] = useState({})

  // ── Ledger ──────────────────────────────────────────────────────────────
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerBalance, setLedgerBalance] = useState(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // ── Profile panel ────────────────────────────────────────────────────────
  const [selectedProfileDriver, setSelectedProfileDriver] = useState(null)

  // ── Login history (#2972) ────────────────────────────────────────────────
  const [loginHistoryDriver, setLoginHistoryDriver] = useState(null)
  const [loginHistory, setLoginHistory] = useState([])
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false)

  // ── Expiring soon (#2969) ────────────────────────────────────────────────
  const [expiringDrivers, setExpiringDrivers] = useState([])
  const [expiringRule, setExpiringRule] = useState(null)
  const [expiringLoading, setExpiringLoading] = useState(false)
  const [expiringWarningDays, setExpiringWarningDays] = useState(30)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fmtDate = (ts) =>
    ts ? new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const fmtDateShort = (ts) => (ts ? new Date(ts).toLocaleDateString() : '—')

  // ── Load drivers ─────────────────────────────────────────────────────────
  const loadDrivers = async () => {
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const data = await api('/drivers', { method: 'GET' })
      // Backends are inconsistent: sponsor service returns an array, admin/driver may wrap in { drivers }.
      const list = Array.isArray(data) ? data : (Array.isArray(data?.drivers) ? data.drivers : [])
      setDrivers(list)
    } catch (e) {
      setError(e?.message || 'Failed to load drivers')
    } finally {
      setLoading(false)
    }
  }

  // ── Load expiring soon (#2969) ────────────────────────────────────────────
  const loadExpiring = async () => {
    setExpiringLoading(true)
    setError('')
    try {
      const data = await api(`/drivers/expiring-soon?days=${expiringWarningDays}`, { method: 'GET' })
      const list = Array.isArray(data) ? data : (Array.isArray(data?.drivers) ? data.drivers : [])
      setExpiringDrivers(list)
      setExpiringRule(data?.rule || null)
    } catch (e) {
      setError(e?.message || 'Failed to load expiring drivers')
    } finally {
      setExpiringLoading(false)
    }
  }

  // ── Load login history (#2972) ────────────────────────────────────────────
  const openLoginHistory = async (driver) => {
    const driverId = driver?.id ?? driver?.user_id
    if (!driverId) return
    setLoginHistoryDriver(driver)
    setLoginHistory([])
    setLoginHistoryLoading(true)
    try {
      const data = await api(`/drivers/${driverId}/login-history`, { method: 'GET' })
      setLoginHistory(Array.isArray(data?.attempts) ? data.attempts : [])
    } catch (e) {
      setError(e?.message || 'Failed to load login history')
    } finally {
      setLoginHistoryLoading(false)
    }
  }

  // ── Open ledger ───────────────────────────────────────────────────────────
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
      setLedgerBalance(data?.balance ?? data?.pointsBalance ?? data?.points_balance ?? null)
    } catch (e) {
      setError(e?.message || 'Failed to load ledger')
    } finally {
      setLedgerLoading(false)
    }
  }

  // ── Remove driver ─────────────────────────────────────────────────────────
  const removeDriver = async (driver) => {
    const driverId = driver?.id ?? driver?.user_id
    if (!driverId) return
    if (!window.confirm('Remove this driver from your program?')) return
    try {
      await api(`/drivers/${driverId}`, { method: 'DELETE' })
      setSuccess(`Removed driver ${driverId}.`)
      await loadDrivers()
      if ((selectedDriver?.id ?? selectedDriver?.user_id) === driverId) setSelectedDriver(null)
      if ((selectedProfileDriver?.id ?? selectedProfileDriver?.user_id) === driverId) setSelectedProfileDriver(null)
    } catch (e) {
      setError(e?.message || 'Failed to remove driver')
    }
  }

  // ── Adjust points ─────────────────────────────────────────────────────────
  const adjustPoints = async (driver) => {
    setError('')
    setSuccess('')
    const driverId = driver?.id ?? driver?.user_id
    if (!driverId) { setError('Missing driver id'); return }
    const rawDelta = deltaById[driverId]
    const delta = Number(rawDelta)
    if (!Number.isFinite(delta) || delta === 0) { setError('Enter a non-zero number of points.'); return }
    const reason = (reasonById[driverId] || '').trim()
    if (!reason) { setError('Reason is required.'); return }
    try {
      const pts = Math.abs(delta)
      const endpoint = delta > 0 ? `/drivers/${driverId}/points/add` : `/drivers/${driverId}/points/deduct`
      await api(endpoint, { method: 'POST', body: JSON.stringify({ points: pts, reason }) })
      setSuccess(`Updated points for driver ${driverId}.`)
      await loadDrivers()
      if ((selectedDriver?.id ?? selectedDriver?.user_id) === driverId) await openLedger(selectedDriver)
      setDeltaById(p => ({ ...p, [driverId]: '' }))
      setReasonById(p => ({ ...p, [driverId]: '' }))
    } catch (e) {
      setError(e?.message || 'Failed to update points')
    }
  }

  // ── #2970: Export to CSV ──────────────────────────────────────────────────
  const exportCSV = (driverList) => {
    if (!driverList.length) return
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Status', 'Points Balance', 'Sponsor Org', 'Last Login', 'Phone', 'City', 'State']
    const rows = driverList.map(d => {
      const id = d.id ?? d.user_id
      const isActive = d.is_active !== 0 && d.is_active !== false
      return [
        id,
        d.first_name || '',
        d.last_name || '',
        d.email || '',
        isActive ? 'Active' : 'Inactive',
        Number(d.pointsBalance ?? d.points_balance ?? 0),
        d.sponsor_org || '',
        d.last_login_at ? new Date(d.last_login_at).toLocaleString() : '',
        d.phone || '',
        d.city || '',
        d.state || '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drivers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    loadDrivers()
  }, [])

  useEffect(() => {
    if (activeTab === 'expiring') loadExpiring()
  }, [activeTab, expiringWarningDays])

  // ── Computed driver lists ─────────────────────────────────────────────────

  // Base filtered list (search + status)
  const filteredBase = useMemo(() => {
    let list = drivers
    // Status filter (#2968, #2971)
    if (statusFilter === 'active') list = list.filter(d => d.is_active !== 0 && d.is_active !== false)
    if (statusFilter === 'inactive') list = list.filter(d => d.is_active === 0 || d.is_active === false)
    // Search
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return list
    return list.filter(d => {
      const id = String(d.id ?? d.user_id ?? '')
      const email = String(d.email ?? '').toLowerCase()
      const name = [d.first_name, d.last_name].filter(Boolean).join(' ').toLowerCase()
      return id.includes(q) || email.includes(q) || name.includes(q)
    })
  }, [drivers, statusFilter, searchQuery])

  // #2977: Top performers — sorted by points balance descending
  const topPerformers = useMemo(() => {
    return [...drivers]
      .filter(d => d.is_active !== 0 && d.is_active !== false)
      .sort((a, b) => Number(b.pointsBalance ?? b.points_balance ?? 0) - Number(a.pointsBalance ?? a.points_balance ?? 0))
      .slice(0, 20)
  }, [drivers])

  // Stats
  const totalActive = drivers.filter(d => d.is_active !== 0 && d.is_active !== false).length
  const totalInactive = drivers.filter(d => d.is_active === 0 || d.is_active === false).length
  const totalPoints = drivers.reduce((s, d) => s + Number(d.pointsBalance ?? d.points_balance ?? 0), 0)

  // ── Shared driver table ───────────────────────────────────────────────────
  const renderDriverTable = (list, showRank = false) => (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table className="table" style={{ fontSize: '0.82em', whiteSpace: 'nowrap' }}>
        <thead>
          <tr>
            {showRank && <th style={{ width: 40 }}>#</th>}
            <th style={{ minWidth: 80 }}>Driver</th>
            <th style={{ minWidth: 100 }}>Email</th>
            <th style={{ width: 60 }}>Status</th>
            <th className="text-right" style={{ width: 55 }}>Pts</th>
            <th style={{ width: 110 }}>Adjust</th>
            <th style={{ minWidth: 130 }}>Reason</th>
            <th style={{ width: 55 }}>Apply</th>
            <th style={{ width: 55 }}>Ledger</th>
            <th style={{ width: 55 }}>Logins</th>
            <th style={{ width: 45 }}>Info</th>
            <th style={{ width: 60 }}>Remove</th>
          </tr>
        </thead>
        <tbody>
          {loading && list.length === 0 ? (
            <tr><td colSpan={showRank ? 12 : 11} className="table-empty">Loading…</td></tr>
          ) : list.length === 0 ? (
            <tr><td colSpan={showRank ? 12 : 11} className="table-empty">No drivers found</td></tr>
          ) : (
            list.map((d, idx) => {
              const id = d.id ?? d.user_id
              const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || `Driver ${id}`
              const email = d.email || '-'
              const points = Number(d.pointsBalance ?? d.points_balance ?? 0)
              const isActive = d.is_active !== 0 && d.is_active !== false

              return (
                <tr key={String(id)} style={{ opacity: isActive ? 1 : 0.6 }}>
                  {showRank && (
                    <td style={{ fontWeight: 700, color: idx === 0 ? '#d97706' : idx === 1 ? '#6b7280' : idx === 2 ? '#92400e' : '#374151', fontSize: idx < 3 ? '1em' : '0.85em' }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                  )}
                  <td>
                    <button type="button" onClick={() => setSelectedProfileDriver(d)} style={{ padding: 0, border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
                      {name}
                    </button>
                  </td>
                  <td style={{ fontSize: '0.88em', color: '#6b7280' }}>{email}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.75em', fontWeight: 600, background: isActive ? '#d1fae5' : '#fee2e2', color: isActive ? '#065f46' : '#991b1b' }}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{points.toLocaleString()}</td>
                  <td>
                    <input className="form-input" style={{ width: '100%', minWidth: 90, fontSize: '0.8em', padding: '4px 6px' }} type="number" placeholder="e.g. 50" value={deltaById[id] ?? ''} onChange={e => setDeltaById(p => ({ ...p, [id]: e.target.value }))} />
                  </td>
                  <td>
                    <input className="form-input" style={{ width: '100%', fontSize: '0.8em', padding: '4px 6px' }} type="text" placeholder="Reason required" value={reasonById[id] ?? ''} onChange={e => setReasonById(p => ({ ...p, [id]: e.target.value }))} />
                  </td>
                  <td>
                    <button className="btn btn-success" type="button" style={{ fontSize: '0.8em', padding: '4px 10px' }} onClick={() => adjustPoints({ ...d, id })}>Apply</button>
                  </td>
                  <td>
                    <button className="btn btn-primary" type="button" style={{ fontSize: '0.8em', padding: '4px 8px' }} onClick={() => openLedger(d)}>View</button>
                  </td>
                  <td>
                    {/* #2972: Login history */}
                    <button className="btn btn-ghost" type="button" style={{ fontSize: '0.8em', padding: '4px 8px' }} onClick={() => openLoginHistory(d)}>Logins</button>
                  </td>
                  <td>
                    <button className="btn btn-primary" type="button" style={{ fontSize: '0.8em', padding: '4px 8px' }} onClick={() => setSelectedProfileDriver(d)}>Info</button>
                  </td>
                  <td>
                    <button className="btn btn-secondary" type="button" style={{ fontSize: '0.8em', padding: '4px 8px' }} onClick={() => removeDriver({ ...d, id })}>Remove</button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )

  const tabs = [
    { key: 'all', label: 'All Drivers' },
    { key: 'top', label: 'Top Performers' },
    { key: 'expiring', label: 'Expiring Soon' },
  ]

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">Drivers</h1>
        <p className="page-subtitle">Manage points, view activity, and export driver data</p>

        {/* ── Stats bar ── */}
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <p className="stat-label">Total Drivers</p>
            <p className="stat-value stat-value-blue">{drivers.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Active</p>
            <p className="stat-value stat-value-green">{totalActive}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Inactive</p>
            <p className="stat-value" style={{ color: '#dc2626' }}>{totalInactive}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total Points Balance</p>
            <p className="stat-value stat-value-amber">{totalPoints.toLocaleString()}</p>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Search by name, email, or ID"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />

            {/* #2968 / #2971: Status filter */}
            <select
              className="form-input"
              style={{ width: 150 }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>

            <button className="btn btn-primary" type="button" onClick={loadDrivers} disabled={loading}>
              {loading ? 'Refreshing…' : '↺ Refresh'}
            </button>

            {/* #2970: Export CSV */}
            <button
              className="btn btn-success"
              type="button"
              onClick={() => exportCSV(activeTab === 'top' ? topPerformers : filteredBase)}
              disabled={filteredBase.length === 0}
            >
              ⬇ Export CSV
            </button>
          </div>
        </div>

        {error && <p className="form-footer" style={{ color: 'crimson', marginBottom: 8 }}>{error}</p>}
        {success && <p className="form-footer" style={{ color: '#16a34a', marginBottom: 8 }}>{success}</p>}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 0, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ borderTopLeftRadius: 0, marginTop: 0 }}>

          {/* ── All Drivers tab ── */}
          {activeTab === 'all' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: '0.875em', color: '#6b7280' }}>
                  Showing <strong>{filteredBase.length}</strong> driver{filteredBase.length !== 1 ? 's' : ''}
                  {statusFilter !== 'all' && ` (${statusFilter})`}
                </p>
              </div>
              {renderDriverTable(filteredBase)}
            </div>
          )}

          {/* ── Top Performers tab (#2977) ── */}
          {activeTab === 'top' && (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: '0.875em', color: '#6b7280' }}>
                Top 20 active drivers ranked by current points balance.
              </p>
              {renderDriverTable(topPerformers, true)}
            </div>
          )}

          {/* ── Expiring Soon tab (#2969) ── */}
          {activeTab === 'expiring' && (
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: '0.875em', color: '#6b7280' }}>
                  Warn when points expire within:
                </p>
                <select
                  className="form-input"
                  style={{ width: 140 }}
                  value={expiringWarningDays}
                  onChange={e => setExpiringWarningDays(Number(e.target.value))}
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                </select>
                <button className="btn btn-primary" type="button" onClick={loadExpiring} disabled={expiringLoading}>
                  {expiringLoading ? 'Loading…' : '↺ Refresh'}
                </button>
              </div>

              {expiringRule ? (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 14, fontSize: '0.875em' }}>
                  ⚠ Your expiration rule: points expire after <strong>{expiringRule.expiry_days} days</strong>.
                  Showing drivers whose oldest points may expire within <strong>{expiringRule.warning_days} days</strong>.
                </div>
              ) : !expiringLoading && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd', marginBottom: 14, fontSize: '0.875em', color: '#0369a1' }}>
                  ℹ No active point expiration rule configured. Set one in <strong>Point Management → Expiration Rules</strong>.
                </div>
              )}

              {expiringLoading ? (
                <p style={{ color: '#6b7280' }}>Loading…</p>
              ) : expiringDrivers.length === 0 ? (
                <p className="activity-empty">No drivers have points expiring within {expiringWarningDays} days.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Email</th>
                        <th className="text-right">Balance</th>
                        <th>Oldest Points</th>
                        <th>Days Until Expiry</th>
                        <th style={{ width: 80 }}>Ledger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiringDrivers.map(d => {
                        const id = d.id ?? d.user_id
                        const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || `Driver ${id}`
                        const days = Number(d.daysUntilExpiry || 0)
                        const urgency = days <= 7 ? '#dc2626' : days <= 14 ? '#d97706' : '#374151'
                        return (
                          <tr key={String(id)}>
                            <td style={{ fontWeight: 500 }}>{name}</td>
                            <td style={{ fontSize: '0.88em', color: '#6b7280' }}>{d.email}</td>
                            <td className="text-right" style={{ fontWeight: 600 }}>{Number(d.pointsBalance || 0).toLocaleString()}</td>
                            <td style={{ fontSize: '0.85em', color: '#6b7280' }}>{d.oldest_point_date ? new Date(d.oldest_point_date).toLocaleDateString() : '—'}</td>
                            <td>
                              <span style={{ fontWeight: 700, color: urgency, background: days <= 7 ? '#fef2f2' : days <= 14 ? '#fffbeb' : '#f9fafb', padding: '2px 10px', borderRadius: 999, fontSize: '0.85em' }}>
                                {days <= 0 ? 'Expired' : `${days}d`}
                              </span>
                            </td>
                            <td>
                              <button className="btn btn-primary" type="button" style={{ fontSize: '0.8em', padding: '4px 8px' }} onClick={() => openLedger(d)}>View</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Ledger panel ── */}
        {selectedDriver && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 className="section-title" style={{ marginTop: 0 }}>Points ledger</h2>
                <p className="page-subtitle" style={{ marginTop: 4 }}>
                  {[selectedDriver.first_name, selectedDriver.last_name].filter(Boolean).join(' ') || selectedDriver.email}
                  {ledgerBalance !== null && ` · Balance: ${Number(ledgerBalance).toLocaleString()}`}
                </p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setSelectedDriver(null)}>Close</button>
            </div>
            {ledgerLoading ? <p>Loading ledger…</p>
              : ledger.length === 0 ? <p className="activity-empty">No ledger entries yet</p>
              : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Date</th><th>Sponsor</th><th className="text-right">Delta</th><th>Reason</th></tr></thead>
                    <tbody>
                      {ledger.map((row, idx) => (
                        <tr key={row.id ?? idx}>
                          <td style={{ fontSize: '0.82em' }}>{fmtDate(row.created_at)}</td>
                          <td style={{ fontSize: '0.85em' }}>{row.sponsor_company || (row.sponsor_id == null ? <em style={{ color: '#9ca3af' }}>Admin</em> : `#${row.sponsor_id}`)}</td>
                          <td className="text-right" style={{ fontWeight: 700, color: Number(row.delta) >= 0 ? '#16a34a' : '#dc2626' }}>{Number(row.delta) >= 0 ? `+${row.delta}` : row.delta}</td>
                          <td style={{ fontSize: '0.85em' }}>{row.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}

        {/* ── Login history modal (#2972) ── */}
        {loginHistoryDriver && (
          <div className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: 680 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <div>
                  <h2 className="page-title" style={{ marginBottom: 2 }}>Login History</h2>
                  <p className="page-subtitle" style={{ margin: 0 }}>
                    {[loginHistoryDriver.first_name, loginHistoryDriver.last_name].filter(Boolean).join(' ') || loginHistoryDriver.email}
                  </p>
                </div>
                <button className="btn btn-ghost" type="button" onClick={() => setLoginHistoryDriver(null)}>✕ Close</button>
              </div>

              {loginHistoryLoading ? (
                <p style={{ color: '#6b7280' }}>Loading…</p>
              ) : loginHistory.length === 0 ? (
                <p className="activity-empty">No login history available. (Requires login_attempts table.)</p>
              ) : (
                <>
                  <div style={{ marginBottom: 10, fontSize: '0.85em', color: '#6b7280' }}>
                    Last {loginHistory.length} attempt{loginHistory.length !== 1 ? 's' : ''} ·{' '}
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{loginHistory.filter(a => a.success).length} successful</span>{' '}·{' '}
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{loginHistory.filter(a => !a.success).length} failed</span>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr><th>Date</th><th>Result</th><th>IP Address</th><th>Failure Reason</th></tr>
                      </thead>
                      <tbody>
                        {loginHistory.map(a => (
                          <tr key={a.id} style={{ background: !a.success ? '#fff7f7' : undefined }}>
                            <td style={{ fontSize: '0.82em', whiteSpace: 'nowrap', color: '#6b7280' }}>{fmtDate(a.attempted_at)}</td>
                            <td>
                              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.78em', fontWeight: 700, background: a.success ? '#d1fae5' : '#fee2e2', color: a.success ? '#065f46' : '#991b1b' }}>
                                {a.success ? '✓ Success' : '✕ Failed'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.82em', fontFamily: 'monospace', color: '#6b7280' }}>{a.ip_address || '—'}</td>
                            <td style={{ fontSize: '0.82em', color: '#dc2626' }}>{a.failure_reason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Profile panel ── */}
        {selectedProfileDriver && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 className="section-title" style={{ marginTop: 0 }}>Driver details</h2>
                <p className="page-subtitle" style={{ marginTop: 4 }}>
                  {[selectedProfileDriver.first_name, selectedProfileDriver.last_name].filter(Boolean).join(' ') || selectedProfileDriver.email}
                </p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setSelectedProfileDriver(null)}>Close</button>
            </div>
            {(() => {
              const d = selectedProfileDriver
              const id = d.id ?? d.user_id
              const points = Number(d.pointsBalance ?? d.points_balance ?? 0)
              const isActive = d.is_active !== 0 && d.is_active !== false
              const fields = [
                { label: 'User ID', value: id },
                { label: 'Email', value: d.email },
                { label: 'Full Name', value: [d.first_name, d.last_name].filter(Boolean).join(' ') || '—' },
                { label: 'Status', value: isActive ? 'Active' : 'Inactive' },
                { label: 'DOB', value: d.dob || '—' },
                { label: 'Phone', value: d.phone || '—' },
                { label: 'Address', value: d.address_line1 || '—' },
                { label: 'City', value: d.city || '—' },
                { label: 'State', value: d.state || '—' },
                { label: 'Postal Code', value: d.postal_code || '—' },
                { label: 'Country', value: d.country || '—' },
                { label: 'Sponsor Org', value: d.sponsor_org || '—' },
                { label: 'Points Balance', value: points.toLocaleString() },
                { label: 'Last Login', value: fmtDate(d.last_login_at) },
              ]
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
                  {fields.map(({ label, value }) => (
                    <div key={label} style={{ padding: '10px 14px', borderRadius: 6, background: '#fff', border: '1px solid var(--border)' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '0.72em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: '0.875em', fontWeight: 500, color: '#374151', wordBreak: 'break-all' }}>{String(value ?? '—')}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="button" onClick={() => openLedger(selectedProfileDriver)}>View Ledger</button>
              <button className="btn btn-ghost" type="button" onClick={() => openLoginHistory(selectedProfileDriver)}>Login History</button>
            </div>
          </div>
        )}

        <p className="form-footer" style={{ marginTop: 12 }}>
          Tip: use positive numbers to add points and negative numbers to deduct. A reason is required.
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
            <div style={{ display: 'inline-block' }}>
              <div className="pts-hero">
                <p className="pts-hero-label">Your points</p>
                <p className="pts-hero-value">{currentUser?.points ?? 0}</p>
              </div>
              {isDriver && (
                <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted)' }}>
                  Total earned:{' '}
                  <strong>{currentUser?.totalEarned ?? currentUser?.points ?? 0}</strong>
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


// AdminUsersPage — Admin users page
// 
//   • Edit User modal — name, email, role for any user
//   • Deactivate with reason — reason stored + shown in UI
//   • Sponsor Tools tab — admin can manage any sponsor's ads,
//     catalog items, and view their point analytics
// ============================================================

// ============ SYSTEM MONITORING PAGE (admin) ============
// Covers: uptime (#3144), API metrics (#3145), background jobs (#3146),
// retry jobs (#3147), maintenance windows (#3148), feature flags (#3149)
// ═══════════════════════════════════════════════════════════════════════════
// UPDATED SystemMonitoringPage
// Replace the existing SystemMonitoringPage component in App.jsx with this.
// Adds: Audit Logs (#28-34), Login Attempts (#31-32), System Config (#24/#35)
// ═══════════════════════════════════════════════════════════════════════════

const SystemMonitoringPage = () => {
  const ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_BASE || '/api/admin').replace(/\/$/, '')
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Overview ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null)
  const [metrics, setMetrics] = useState(null)

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState([])

  // ── Maintenance ───────────────────────────────────────────────────────────
  const [mWindows, setMWindows] = useState([])
  const [newMaint, setNewMaint] = useState({ title: '', description: '', starts_at: '', ends_at: '' })

  // ── Feature Flags ─────────────────────────────────────────────────────────
  const [features, setFeatures] = useState([])
  const [newFeature, setNewFeature] = useState({ feature_key: '', label: '', description: '', is_enabled: false })

  // ── Audit Logs (#28-30, #33-34) ───────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditFilters, setAuditFilters] = useState({ date_from: '', date_to: '', sponsor_id: '', driver_id: '', reviewed: 'all' })
  const [sponsors, setSponsors] = useState([])
  const [reviewingId, setReviewingId] = useState(null)

  // ── Login Attempts (#31-32) ───────────────────────────────────────────────
  const [loginAttempts, setLoginAttempts] = useState([])
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginFilters, setLoginFilters] = useState({ failed_only: false, email: '', date_from: '', date_to: '' })

  // ── System Config (#24) ───────────────────────────────────────────────────
  const [configItems, setConfigItems] = useState([])
  const [configLoading, setConfigLoading] = useState(false)
  const [editingConfigKey, setEditingConfigKey] = useState(null)
  const [editConfigValue, setEditConfigValue] = useState('')
  const [editConfigReason, setEditConfigReason] = useState('')
  const [newConfig, setNewConfig] = useState({ config_key: '', config_value: '', description: '' })
  const [showNewConfig, setShowNewConfig] = useState(false)

  // ── Config Changelog (#35) ────────────────────────────────────────────────
  const [configChangelog, setConfigChangelog] = useState([])
  const [changelogLoading, setChangelogLoading] = useState(false)
  const [changelogKeyFilter, setChangelogKeyFilter] = useState('')

  // ── Shared API helper ─────────────────────────────────────────────────────
  const adminApi = async (path, options = {}) => {
    const safePath = path.startsWith('/') ? path : `/${path}`
    const res = await fetch(`${ADMIN_BASE}${safePath}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
    return data
  }

  // ── Overview loaders ──────────────────────────────────────────────────────
  const loadOverview = async () => {
    setLoading(true); setError('')
    try {
      const [s, m] = await Promise.all([adminApi('/system/stats'), adminApi('/system/metrics')])
      setStats(s); setMetrics(m)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const loadJobs = async () => {
    setLoading(true); setError('')
    try { const d = await adminApi('/system/jobs'); setJobs(d.jobs || []) }
    catch (e) { setError(e.message) }
    setLoading(false)
  }

  const retryJob = async (jobId) => {
    setError(''); setSuccess('')
    try { await adminApi(`/system/jobs/${jobId}/retry`, { method: 'POST' }); setSuccess('Job retried.'); loadJobs() }
    catch (e) { setError(e.message) }
  }

  const loadMaintenance = async () => {
    setLoading(true); setError('')
    try { const d = await adminApi('/system/maintenance'); setMWindows(d.windows || []) }
    catch (e) { setError(e.message) }
    setLoading(false)
  }

  const createMaintenance = async () => {
    if (!newMaint.title || !newMaint.starts_at || !newMaint.ends_at) { setError('Title, start, and end required'); return }
    setError(''); setSuccess('')
    try {
      await adminApi('/system/maintenance', { method: 'POST', body: JSON.stringify(newMaint) })
      setNewMaint({ title: '', description: '', starts_at: '', ends_at: '' }); setSuccess('Window created.'); loadMaintenance()
    } catch (e) { setError(e.message) }
  }

  const toggleMaintenance = async (id, cur) => {
    try { await adminApi(`/system/maintenance/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: !cur }) }); loadMaintenance() }
    catch (e) { setError(e.message) }
  }

  const deleteMaintenance = async (id) => {
    try { await adminApi(`/system/maintenance/${id}`, { method: 'DELETE' }); loadMaintenance() }
    catch (e) { setError(e.message) }
  }

  const loadFeatures = async () => {
    setLoading(true); setError('')
    try { const d = await adminApi('/system/features'); setFeatures(d.features || []) }
    catch (e) { setError(e.message) }
    setLoading(false)
  }

  const createFeature = async () => {
    if (!newFeature.feature_key || !newFeature.label) { setError('Key and label required'); return }
    setError(''); setSuccess('')
    try {
      await adminApi('/system/features', { method: 'POST', body: JSON.stringify(newFeature) })
      setNewFeature({ feature_key: '', label: '', description: '', is_enabled: false }); setSuccess('Flag created.'); loadFeatures()
    } catch (e) { setError(e.message) }
  }

  const toggleFeature = async (id) => {
    try {
      const d = await adminApi(`/system/features/${id}/toggle`, { method: 'PUT' })
      setFeatures(prev => prev.map(f => f.id === id ? { ...f, is_enabled: d.is_enabled ? 1 : 0 } : f))
    } catch (e) { setError(e.message) }
  }

  const deleteFeature = async (id) => {
    try { await adminApi(`/system/features/${id}`, { method: 'DELETE' }); setFeatures(prev => prev.filter(f => f.id !== id)) }
    catch (e) { setError(e.message) }
  }

  // ── Audit Log loaders / actions ───────────────────────────────────────────
  const loadAuditLogs = async (filters = auditFilters) => {
    setAuditLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (filters.date_from)  params.set('date_from', filters.date_from)
      if (filters.date_to)    params.set('date_to', filters.date_to)
      if (filters.sponsor_id) params.set('sponsor_id', filters.sponsor_id)
      if (filters.driver_id)  params.set('driver_id', filters.driver_id)
      if (filters.reviewed !== 'all') params.set('reviewed', filters.reviewed)
      const d = await adminApi(`/system/audit-logs${params.toString() ? '?' + params : ''}`)
      setAuditLogs(d.logs || [])
    } catch (e) { setError(e.message) }
    setAuditLoading(false)
  }

  const loadSponsors = async () => {
    try {
      const d = await adminApi('/users?role=sponsor')
      setSponsors(Array.isArray(d?.users) ? d.users : [])
    } catch { /* ignore */ }
  }

  // #33: Mark reviewed / un-review
  const toggleReview = async (logId) => {
    setReviewingId(logId); setError(''); setSuccess('')
    try {
      const d = await adminApi(`/system/audit-logs/${logId}/review`, { method: 'PUT' })
      setAuditLogs(prev => prev.map(l => l.id === logId
        ? { ...l, reviewed_at: d.reviewed ? new Date().toISOString() : null }
        : l
      ))
      setSuccess(d.reviewed ? 'Marked as reviewed.' : 'Review mark removed.')
    } catch (e) { setError(e.message) }
    setReviewingId(null)
  }

  // #34: Export audit logs as CSV (browser-side, "fancy" formatting)
  const exportAuditCSV = () => {
    if (!auditLogs.length) return
    const headerRow = [
      'ID', 'Date', 'Driver', 'Driver Email', 'Sponsor', 'Delta', 'Reason', 'Reviewed At', 'Reviewed By'
    ]
    const rows = auditLogs.map(l => [
      l.id,
      l.created_at ? new Date(l.created_at).toLocaleString() : '',
      (l.driver_name || '').trim() || '',
      l.driver_email || '',
      l.sponsor_company || (l.sponsor_id == null ? 'Admin' : `#${l.sponsor_id}`),
      l.delta,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      l.reviewed_at ? new Date(l.reviewed_at).toLocaleString() : '',
      l.reviewed_by_name || (l.reviewed_by ? `#${l.reviewed_by}` : ''),
    ])
    const csv = [headerRow, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Login Attempts loaders ────────────────────────────────────────────────
  const loadLoginAttempts = async (filters = loginFilters) => {
    setLoginLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (filters.failed_only) params.set('failed_only', 'true')
      if (filters.email)     params.set('email', filters.email)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to)   params.set('date_to', filters.date_to)
      const d = await adminApi(`/system/login-attempts${params.toString() ? '?' + params : ''}`)
      setLoginAttempts(d.attempts || [])
    } catch (e) { setError(e.message) }
    setLoginLoading(false)
  }

  const exportLoginCSV = () => {
    if (!loginAttempts.length) return
    const csv = [
      ['ID', 'Date', 'Email', 'Success', 'IP', 'Failure Reason', 'User Agent'],
      ...loginAttempts.map(a => [
        a.id,
        a.attempted_at ? new Date(a.attempted_at).toLocaleString() : '',
        a.email || '',
        a.success ? 'Yes' : 'No',
        a.ip_address || '',
        a.failure_reason || '',
        `"${(a.user_agent || '').replace(/"/g, '""').slice(0, 100)}"`,
      ])
    ].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `login-attempts-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Config loaders / actions ──────────────────────────────────────────────
  const loadConfig = async () => {
    setConfigLoading(true); setError('')
    try { const d = await adminApi('/system/config'); setConfigItems(d.config || []) }
    catch (e) { setError(e.message) }
    setConfigLoading(false)
  }

  const saveConfig = async (key) => {
    setError(''); setSuccess('')
    try {
      await adminApi(`/system/config/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ config_value: editConfigValue, change_reason: editConfigReason })
      })
      setSuccess(`Saved "${key}".`); setEditingConfigKey(null); setEditConfigReason('')
      await loadConfig()
    } catch (e) { setError(e.message) }
  }

  const createConfig = async () => {
    if (!newConfig.config_key || !newConfig.config_value) { setError('Key and value required'); return }
    setError(''); setSuccess('')
    try {
      await adminApi('/system/config', { method: 'POST', body: JSON.stringify(newConfig) })
      setSuccess('Config entry created.'); setShowNewConfig(false); setNewConfig({ config_key: '', config_value: '', description: '' })
      await loadConfig()
    } catch (e) { setError(e.message) }
  }

  const deleteConfig = async (key) => {
    if (!window.confirm(`Delete config key "${key}"?`)) return
    setError(''); setSuccess('')
    try { await adminApi(`/system/config/${key}`, { method: 'DELETE' }); setSuccess('Deleted.'); await loadConfig() }
    catch (e) { setError(e.message) }
  }

  // ── Config Changelog loaders ──────────────────────────────────────────────
  const loadChangelog = async () => {
    setChangelogLoading(true); setError('')
    try {
      const params = changelogKeyFilter ? `?config_key=${encodeURIComponent(changelogKeyFilter)}` : ''
      const d = await adminApi(`/system/config/changelog${params}`)
      setConfigChangelog(d.changelog || [])
    } catch (e) { setError(e.message) }
    setChangelogLoading(false)
  }

  // ── Tab effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    setError(''); setSuccess('')
    if (activeTab === 'overview')       loadOverview()
    else if (activeTab === 'jobs')      loadJobs()
    else if (activeTab === 'maintenance') loadMaintenance()
    else if (activeTab === 'features')  loadFeatures()
    else if (activeTab === 'audit')     { loadAuditLogs(); loadSponsors() }
    else if (activeTab === 'login')     loadLoginAttempts()
    else if (activeTab === 'config')    loadConfig()
    else if (activeTab === 'changelog') loadChangelog()
  }, [activeTab])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatUptime = (s) => {
    if (!s && s !== 0) return '-'
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
    return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
  }
  const formatBytes = (b) => {
    if (!b) return '-'
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1048576).toFixed(1)} MB`
  }
  const fmtDate = (ts) => ts ? new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const tabs = [
    { key: 'overview',    label: 'Overview' },
    { key: 'jobs',        label: 'Background Jobs' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'features',    label: 'Feature Flags' },
    { key: 'audit',       label: 'Audit Logs' },
    { key: 'login',       label: 'Login Attempts' },
    { key: 'config',      label: 'System Config' },
    { key: 'changelog',   label: 'Config Changelog' },
  ]

  return (
    <div>
      <Navigation />
      <main className="app-main">
        <h1 className="page-title">System Monitoring</h1>
        <p className="page-subtitle">Infrastructure health, audit logs, and configuration</p>

        {error   && <div className="alert alert-danger" style={{ color: '#dc2626', marginBottom: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ color: '#16a34a', marginBottom: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>{success}</div>}

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} type="button"
              className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { label: 'Uptime', value: stats ? formatUptime(stats.uptime_seconds) : '-' },
                { label: 'Database', value: stats ? (stats.db_connected ? 'Connected' : 'Disconnected') : '-', color: stats?.db_connected ? '#16a34a' : '#dc2626' },
                { label: 'Total Users', value: stats?.total_users ?? '-' },
                { label: 'Memory (RSS)', value: stats ? formatBytes(stats.memory?.rss) : '-' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card" style={{ flex: '1 1 180px' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '0.9em', color: '#6b7280' }}>{label}</h3>
                  <div style={{ fontSize: '1.5em', fontWeight: 700, color: color || undefined }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 className="section-title" style={{ margin: 0 }}>API Usage Metrics</h2>
                <button className="btn btn-primary" type="button" onClick={loadOverview}>Refresh</button>
              </div>
              {metrics && (
                <>
                  <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '0.875em' }}>
                    Total requests: <strong>{metrics.total_requests}</strong> · Since: {metrics.since ? new Date(metrics.since).toLocaleString() : '-'}
                  </p>
                  {metrics.top_endpoints?.length > 0 && (
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr><th>Endpoint</th><th style={{ textAlign: 'right' }}>Hits</th></tr></thead>
                        <tbody>
                          {metrics.top_endpoints.map((e, i) => (
                            <tr key={i}>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{e.endpoint}</td>
                              <td style={{ textAlign: 'right' }}>{e.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {metrics.requests_per_minute?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h3 style={{ fontSize: '0.9em', marginBottom: 8, color: '#374151' }}>Requests per Minute (last hour)</h3>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
                        {metrics.requests_per_minute.slice(-60).map((m, i) => {
                          const max = Math.max(...metrics.requests_per_minute.slice(-60).map(x => x.count), 1)
                          const h = Math.max(4, (m.count / max) * 72)
                          return <div key={i} title={`${m.minute}: ${m.count}`} style={{ flex: '1 1 0', background: '#3b82f6', borderRadius: '2px 2px 0 0', height: h, minWidth: 3 }} />
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="card">
              <h2 className="section-title" style={{ margin: '0 0 12px' }}>System Info</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: '0.9em' }}>
                <span style={{ color: '#6b7280' }}>Node.js</span><span>{stats?.node_version || '-'}</span>
                <span style={{ color: '#6b7280' }}>Started</span><span>{stats?.started_at ? new Date(stats.started_at).toLocaleString() : '-'}</span>
                <span style={{ color: '#6b7280' }}>Heap Used</span><span>{stats ? formatBytes(stats.memory?.heapUsed) : '-'}</span>
                <span style={{ color: '#6b7280' }}>Heap Total</span><span>{stats ? formatBytes(stats.memory?.heapTotal) : '-'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Background Jobs ── */}
        {activeTab === 'jobs' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Scheduled Point Awards</h2>
              <button className="btn btn-primary" type="button" onClick={loadJobs}>Refresh</button>
            </div>
            {jobs.length === 0 ? <p style={{ color: '#6b7280' }}>No background jobs found.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>ID</th><th>Driver</th><th>Sponsor</th><th>Points</th><th>Frequency</th><th>Status</th><th>Last Run</th><th>Runs</th><th>Error</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {jobs.map(j => {
                      const hasError = !!j.last_error
                      const status = j.is_paused ? 'Paused' : hasError ? 'Failed' : 'Active'
                      const statusColor = j.is_paused ? '#f59e0b' : hasError ? '#dc2626' : '#16a34a'
                      return (
                        <tr key={j.id}>
                          <td>{j.id}</td><td>{j.driver_id || 'All'}</td><td>{j.sponsor_id}</td>
                          <td>{j.points}</td><td>{j.frequency}{j.is_recurring ? ' (rec)' : ''}</td>
                          <td><span style={{ color: statusColor, fontWeight: 600 }}>{status}</span></td>
                          <td style={{ fontSize: '0.82em' }}>{j.last_run_at ? new Date(j.last_run_at).toLocaleString() : '-'}</td>
                          <td>{j.run_count || 0}</td>
                          <td style={{ fontSize: '0.78em', maxWidth: 180, color: '#dc2626' }}>{j.last_error || '-'}</td>
                          <td>{(hasError || j.is_paused) && <button className="btn btn-primary" type="button" style={{ fontSize: '0.78em', padding: '3px 8px' }} onClick={() => retryJob(j.id)}>Retry</button>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Maintenance ── */}
        {activeTab === 'maintenance' && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 className="section-title" style={{ margin: '0 0 12px' }}>Schedule Maintenance Window</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label className="form-label">Title</label><input className="form-input" value={newMaint.title} onChange={e => setNewMaint(p => ({ ...p, title: e.target.value }))} /></div>
                <div><label className="form-label">Description</label><input className="form-input" value={newMaint.description} onChange={e => setNewMaint(p => ({ ...p, description: e.target.value }))} /></div>
                <div><label className="form-label">Start</label><input type="datetime-local" className="form-input" value={newMaint.starts_at} onChange={e => setNewMaint(p => ({ ...p, starts_at: e.target.value }))} /></div>
                <div><label className="form-label">End</label><input type="datetime-local" className="form-input" value={newMaint.ends_at} onChange={e => setNewMaint(p => ({ ...p, ends_at: e.target.value }))} /></div>
              </div>
              <button className="btn btn-success" type="button" onClick={createMaintenance}>Create Window</button>
            </div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 className="section-title" style={{ margin: 0 }}>Scheduled Windows</h2>
                <button className="btn btn-primary" type="button" onClick={loadMaintenance}>Refresh</button>
              </div>
              {mWindows.length === 0 ? <p style={{ color: '#6b7280' }}>No maintenance windows.</p> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Title</th><th>Description</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {mWindows.map(w => {
                        const now = new Date(), start = new Date(w.starts_at), end = new Date(w.ends_at)
                        const isLive = w.is_active && now >= start && now <= end
                        const isPast = now > end
                        return (
                          <tr key={w.id}>
                            <td style={{ fontWeight: 600 }}>{w.title}</td>
                            <td style={{ fontSize: '0.85em' }}>{w.description || '-'}</td>
                            <td style={{ fontSize: '0.85em' }}>{start.toLocaleString()}</td>
                            <td style={{ fontSize: '0.85em' }}>{end.toLocaleString()}</td>
                            <td><span style={{ color: isLive ? '#dc2626' : isPast ? '#6b7280' : w.is_active ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>{isLive ? 'LIVE' : isPast ? 'Past' : w.is_active ? 'Scheduled' : 'Disabled'}</span></td>
                            <td style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost" type="button" style={{ fontSize: '0.78em', padding: '3px 8px' }} onClick={() => toggleMaintenance(w.id, !!w.is_active)}>{w.is_active ? 'Disable' : 'Enable'}</button>
                              <button className="btn btn-danger" type="button" style={{ fontSize: '0.78em', padding: '3px 8px' }} onClick={() => deleteMaintenance(w.id)}>Delete</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Feature Flags ── */}
        {activeTab === 'features' && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 className="section-title" style={{ margin: '0 0 12px' }}>Create Feature Flag</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label className="form-label">Key (lowercase_underscores)</label><input className="form-input" placeholder="e.g. new_feature" value={newFeature.feature_key} onChange={e => setNewFeature(p => ({ ...p, feature_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} /></div>
                <div><label className="form-label">Label</label><input className="form-input" placeholder="Human-readable name" value={newFeature.label} onChange={e => setNewFeature(p => ({ ...p, label: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><label className="form-label">Description</label><input className="form-input" value={newFeature.description} onChange={e => setNewFeature(p => ({ ...p, description: e.target.value }))} /></div>
                <div><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875em' }}><input type="checkbox" checked={newFeature.is_enabled} onChange={e => setNewFeature(p => ({ ...p, is_enabled: e.target.checked }))} />Enabled by default</label></div>
              </div>
              <button className="btn btn-success" type="button" onClick={createFeature}>Create Flag</button>
            </div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 className="section-title" style={{ margin: 0 }}>Feature Flags</h2>
                <button className="btn btn-primary" type="button" onClick={loadFeatures}>Refresh</button>
              </div>
              {features.length === 0 ? <p style={{ color: '#6b7280' }}>No feature flags.</p> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Key</th><th>Label</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {features.map(f => (
                        <tr key={f.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{f.feature_key}</td>
                          <td style={{ fontWeight: 600 }}>{f.label}</td>
                          <td style={{ fontSize: '0.85em', maxWidth: 220 }}>{f.description || '-'}</td>
                          <td><span style={{ color: f.is_enabled ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{f.is_enabled ? 'ON' : 'OFF'}</span></td>
                          <td style={{ display: 'flex', gap: 4 }}>
                            <button className={`btn ${f.is_enabled ? 'btn-ghost' : 'btn-success'}`} type="button" style={{ fontSize: '0.78em', padding: '3px 8px' }} onClick={() => toggleFeature(f.id)}>{f.is_enabled ? 'Disable' : 'Enable'}</button>
                            <button className="btn btn-danger" type="button" style={{ fontSize: '0.78em', padding: '3px 8px' }} onClick={() => deleteFeature(f.id)}>Delete</button>
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

        {/* ── Audit Logs (#28, #29, #30, #33, #34) ── */}
        {activeTab === 'audit' && (
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <h2 className="section-title" style={{ marginTop: 0 }}>Filters</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {/* Date filters — #29 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72em', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>From</label>
                  <input type="date" className="form-input" value={auditFilters.date_from} onChange={e => setAuditFilters(p => ({ ...p, date_from: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72em', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>To</label>
                  <input type="date" className="form-input" value={auditFilters.date_to} onChange={e => setAuditFilters(p => ({ ...p, date_to: e.target.value }))} />
                </div>
                {/* Sponsor filter — #30 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72em', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Sponsor</label>
                  <select className="form-input" style={{ minWidth: 160 }} value={auditFilters.sponsor_id} onChange={e => setAuditFilters(p => ({ ...p, sponsor_id: e.target.value }))}>
                    <option value="">All Sponsors</option>
                    {sponsors.filter(s => s.company_name).map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                    <option value="null">Admin (no sponsor)</option>
                  </select>
                </div>
                {/* Driver filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72em', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Driver ID</label>
                  <input type="number" className="form-input" style={{ width: 100 }} placeholder="Driver ID" value={auditFilters.driver_id} onChange={e => setAuditFilters(p => ({ ...p, driver_id: e.target.value }))} />
                </div>
                {/* Review filter — #33 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72em', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Review Status</label>
                  <select className="form-input" value={auditFilters.reviewed} onChange={e => setAuditFilters(p => ({ ...p, reviewed: e.target.value }))}>
                    <option value="all">All</option>
                    <option value="false">Unreviewed</option>
                    <option value="true">Reviewed</option>
                  </select>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => loadAuditLogs(auditFilters)} disabled={auditLoading}>{auditLoading ? 'Loading…' : '🔍 Apply'}</button>
                <button className="btn btn-secondary" type="button" onClick={() => { const f = { date_from: '', date_to: '', sponsor_id: '', driver_id: '', reviewed: 'all' }; setAuditFilters(f); loadAuditLogs(f) }}>Clear</button>
                {/* #34: Export */}
                <button className="btn btn-success" type="button" onClick={exportAuditCSV} disabled={!auditLogs.length} style={{ marginLeft: 'auto' }}>⬇ Export CSV</button>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 className="section-title" style={{ margin: 0 }}>
                  Audit Log{auditLogs.length > 0 ? ` (${auditLogs.length} entries)` : ''}
                </h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: '0.8em', color: '#6b7280', alignSelf: 'center' }}>
                    {auditLogs.filter(l => l.reviewed_at).length} reviewed
                  </span>
                  <button className="btn btn-primary" type="button" onClick={() => loadAuditLogs(auditFilters)}>Refresh</button>
                </div>
              </div>
              {auditLoading ? <p style={{ color: '#6b7280' }}>Loading…</p>
                : auditLogs.length === 0 ? <p style={{ color: '#6b7280', fontStyle: 'italic' }}>Apply filters to load audit logs.</p>
                : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Driver</th>
                          <th>Sponsor</th>
                          <th className="text-right">Δ Points</th>
                          <th>Reason</th>
                          <th style={{ width: 130 }}>Reviewed</th>
                          <th style={{ width: 90 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map(l => {
                          const isReviewed = !!l.reviewed_at
                          const delta = Number(l.delta)
                          return (
                            <tr key={l.id} style={{ opacity: isReviewed ? 0.7 : 1 }}>
                              <td style={{ fontSize: '0.82em', whiteSpace: 'nowrap', color: '#6b7280' }}>{fmtDate(l.created_at)}</td>
                              <td>
                                <div style={{ lineHeight: 1.3 }}>
                                  <strong style={{ fontSize: '0.88em' }}>{(l.driver_name || '').trim() || '—'}</strong>
                                  <br /><span style={{ fontSize: '0.75em', color: '#6b7280' }}>{l.driver_email}</span>
                                </div>
                              </td>
                              <td style={{ fontSize: '0.85em' }}>{l.sponsor_company || (l.sponsor_id == null ? <em style={{ color: '#9ca3af' }}>Admin</em> : `#${l.sponsor_id}`)}</td>
                              <td className="text-right" style={{ fontWeight: 700, color: delta >= 0 ? '#16a34a' : '#dc2626' }}>{delta >= 0 ? `+${delta}` : delta}</td>
                              <td style={{ fontSize: '0.85em', maxWidth: 200 }}>{l.reason || '—'}</td>
                              <td>
                                {isReviewed ? (
                                  <div style={{ lineHeight: 1.3 }}>
                                    <span style={{ fontSize: '0.75em', color: '#16a34a', fontWeight: 600 }}>✓ Reviewed</span>
                                    <br /><span style={{ fontSize: '0.7em', color: '#9ca3af' }}>{fmtDate(l.reviewed_at)}</span>
                                    {l.reviewed_by_name && <><br /><span style={{ fontSize: '0.7em', color: '#9ca3af' }}>{l.reviewed_by_name}</span></>}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.75em', color: '#9ca3af' }}>Unreviewed</span>
                                )}
                              </td>
                              <td>
                                {/* #33: Mark reviewed */}
                                <button
                                  className={isReviewed ? 'btn btn-ghost' : 'btn btn-success'}
                                  type="button"
                                  style={{ fontSize: '0.72em', padding: '3px 8px' }}
                                  disabled={reviewingId === l.id}
                                  onClick={() => toggleReview(l.id)}
                                >
                                  {reviewingId === l.id ? '…' : isReviewed ? 'Un-review' : '✓ Review'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ── Login Attempts (#31, #32) ── */}
        {activeTab === 'login' && (
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <h2 className="section-title" style={{ marginTop: 0 }}>Filters</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72em', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Email</label>
                  <input className="form-input" placeholder="Search email…" value={loginFilters.email} onChange={e => setLoginFilters(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72em', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>From</label>
                  <input type="date" className="form-input" value={loginFilters.date_from} onChange={e => setLoginFilters(p => ({ ...p, date_from: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.72em', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>To</label>
                  <input type="date" className="form-input" value={loginFilters.date_to} onChange={e => setLoginFilters(p => ({ ...p, date_to: e.target.value }))} />
                </div>
                {/* #32: Failed only filter */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875em', cursor: 'pointer', paddingBottom: 2 }}>
                  <input type="checkbox" checked={loginFilters.failed_only} onChange={e => setLoginFilters(p => ({ ...p, failed_only: e.target.checked }))} />
                  Failed attempts only
                </label>
                <button className="btn btn-primary" type="button" onClick={() => loadLoginAttempts(loginFilters)} disabled={loginLoading}>{loginLoading ? 'Loading…' : '🔍 Apply'}</button>
                <button className="btn btn-secondary" type="button" onClick={() => { const f = { failed_only: false, email: '', date_from: '', date_to: '' }; setLoginFilters(f); loadLoginAttempts(f) }}>Clear</button>
                <button className="btn btn-success" type="button" onClick={exportLoginCSV} disabled={!loginAttempts.length} style={{ marginLeft: 'auto' }}>⬇ Export CSV</button>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 className="section-title" style={{ margin: 0 }}>
                  Login Attempts{loginAttempts.length > 0 ? ` (${loginAttempts.length})` : ''}
                  {loginAttempts.length > 0 && (
                    <span style={{ marginLeft: 12, fontSize: '0.75em', fontWeight: 400, color: '#dc2626' }}>
                      {loginAttempts.filter(a => !a.success).length} failed
                    </span>
                  )}
                </h2>
                <button className="btn btn-primary" type="button" onClick={() => loadLoginAttempts(loginFilters)}>Refresh</button>
              </div>
              {loginLoading ? <p style={{ color: '#6b7280' }}>Loading…</p>
                : loginAttempts.length === 0 ? <p style={{ color: '#6b7280', fontStyle: 'italic' }}>Apply filters to load login attempts.</p>
                : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr><th>Date</th><th>Email</th><th>Result</th><th>IP Address</th><th>Failure Reason</th><th>Role</th></tr>
                      </thead>
                      <tbody>
                        {loginAttempts.map(a => (
                          <tr key={a.id} style={{ background: !a.success ? '#fff7f7' : undefined }}>
                            <td style={{ fontSize: '0.82em', whiteSpace: 'nowrap', color: '#6b7280' }}>{fmtDate(a.attempted_at)}</td>
                            <td style={{ fontSize: '0.88em' }}>{a.email}</td>
                            <td>
                              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.78em', fontWeight: 700, background: a.success ? '#d1fae5' : '#fee2e2', color: a.success ? '#065f46' : '#991b1b' }}>
                                {a.success ? '✓ Success' : '✕ Failed'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.82em', fontFamily: 'monospace', color: '#6b7280' }}>{a.ip_address || '—'}</td>
                            <td style={{ fontSize: '0.82em', color: '#dc2626' }}>{a.failure_reason || '—'}</td>
                            <td style={{ fontSize: '0.82em', color: '#6b7280' }}>{a.role || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ── System Config (#24) ── */}
        {activeTab === 'config' && (
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 className="section-title" style={{ margin: 0 }}>System Configuration Values</h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-success" type="button" onClick={() => setShowNewConfig(v => !v)}>{showNewConfig ? 'Cancel' : '+ Add Config'}</button>
                  <button className="btn btn-primary" type="button" onClick={loadConfig}>Refresh</button>
                </div>
              </div>

              {showNewConfig && (
                <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, marginBottom: 14, border: '1px solid #bbf7d0' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '0.9em', fontWeight: 700 }}>New Config Entry</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div><label className="form-label">Key (e.g. max_points_per_trip)</label><input className="form-input" placeholder="config_key" value={newConfig.config_key} onChange={e => setNewConfig(p => ({ ...p, config_key: e.target.value }))} /></div>
                    <div><label className="form-label">Value</label><input className="form-input" placeholder="value" value={newConfig.config_value} onChange={e => setNewConfig(p => ({ ...p, config_value: e.target.value }))} /></div>
                    <div style={{ gridColumn: '1/-1' }}><label className="form-label">Description</label><input className="form-input" placeholder="What this value controls" value={newConfig.description} onChange={e => setNewConfig(p => ({ ...p, description: e.target.value }))} /></div>
                  </div>
                  <button className="btn btn-success" type="button" onClick={createConfig}>Create</button>
                </div>
              )}

              {configLoading ? <p style={{ color: '#6b7280' }}>Loading…</p>
                : configItems.length === 0 ? <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No config entries yet. Add one above.</p>
                : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {configItems.map(c => {
                      const isEditing = editingConfigKey === c.config_key
                      return (
                        <div key={c.id} style={{ padding: '14px 18px', border: '1px solid var(--border)', borderRadius: 8, background: isEditing ? '#fffbeb' : '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                                <code style={{ fontFamily: 'monospace', fontSize: '0.9em', fontWeight: 700, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>{c.config_key}</code>
                                {c.description && <span style={{ fontSize: '0.78em', color: '#6b7280' }}>{c.description}</span>}
                              </div>

                              {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                                  <input className="form-input" value={editConfigValue} onChange={e => setEditConfigValue(e.target.value)} autoFocus />
                                  <input className="form-input" placeholder="Reason for change (optional)" value={editConfigReason} onChange={e => setEditConfigReason(e.target.value)} />
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-success" type="button" style={{ fontSize: '0.82em' }} onClick={() => saveConfig(c.config_key)}>Save</button>
                                    <button className="btn btn-ghost" type="button" style={{ fontSize: '0.82em' }} onClick={() => setEditingConfigKey(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: '0.95em', color: '#374151', background: '#f9fafb', padding: '6px 10px', borderRadius: 4, display: 'inline-block', maxWidth: '100%', wordBreak: 'break-all' }}>
                                  {c.config_value || <em style={{ color: '#9ca3af' }}>(empty)</em>}
                                </div>
                              )}

                              <p style={{ margin: '6px 0 0', fontSize: '0.72em', color: '#9ca3af' }}>
                                Last updated: {c.updated_at ? new Date(c.updated_at).toLocaleString() : 'never'}
                              </p>
                            </div>

                            {!isEditing && (
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <button className="btn btn-primary" type="button" style={{ fontSize: '0.78em', padding: '4px 10px' }}
                                  onClick={() => { setEditingConfigKey(c.config_key); setEditConfigValue(c.config_value); setEditConfigReason('') }}>
                                  Edit
                                </button>
                                <button className="btn btn-danger" type="button" style={{ fontSize: '0.78em', padding: '4px 10px' }}
                                  onClick={() => deleteConfig(c.config_key)}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ── Config Changelog (#35) ── */}
        {activeTab === 'changelog' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Configuration Change History</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="form-input" placeholder="Filter by config key…" style={{ width: 200 }} value={changelogKeyFilter} onChange={e => setChangelogKeyFilter(e.target.value)} />
                <button className="btn btn-primary" type="button" onClick={loadChangelog} disabled={changelogLoading}>{changelogLoading ? 'Loading…' : '🔍 Load'}</button>
              </div>
            </div>

            {changelogLoading ? <p style={{ color: '#6b7280' }}>Loading…</p>
              : configChangelog.length === 0 ? <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No config changes recorded yet.</p>
              : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Date</th><th>Key</th><th>Old Value</th><th>New Value</th><th>Changed By</th><th>Reason</th></tr>
                    </thead>
                    <tbody>
                      {configChangelog.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontSize: '0.82em', whiteSpace: 'nowrap', color: '#6b7280' }}>{fmtDate(c.changed_at)}</td>
                          <td><code style={{ fontFamily: 'monospace', fontSize: '0.85em', color: '#1e40af', background: '#eff6ff', padding: '1px 6px', borderRadius: 3 }}>{c.config_key}</code></td>
                          <td style={{ maxWidth: 160 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.82em', color: '#dc2626', background: '#fef2f2', padding: '1px 6px', borderRadius: 3, wordBreak: 'break-all' }}>
                              {c.old_value ?? <em style={{ color: '#9ca3af' }}>—</em>}
                            </span>
                          </td>
                          <td style={{ maxWidth: 160 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.82em', color: '#16a34a', background: '#f0fdf4', padding: '1px 6px', borderRadius: 3, wordBreak: 'break-all' }}>
                              {c.new_value ?? <em style={{ color: '#9ca3af' }}>—</em>}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85em' }}>{c.changed_by_name || `#${c.changed_by}` || '—'}</td>
                          <td style={{ fontSize: '0.82em', color: '#6b7280' }}>{c.change_reason || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}
      </main>
    </div>
  )
}

// ============ ADMIN USERS PAGE ============
const AdminUsersPage = () => {
  // ── Shared ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('applications')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // ── Data ─────────────────────────────────────────────────
  const [sponsors, setSponsors] = useState([])
  const [drivers, setDrivers] = useState([])
  const [admins, setAdmins] = useState([])
  const [applications, setApplications] = useState([])

  // ── Applications ─────────────────────────────────────────
  const [appStatusFilter, setAppStatusFilter] = useState('all')
  const [appNotesById, setAppNotesById] = useState({})
  const [appActionById, setAppActionById] = useState({})

  // ── Sponsors ─────────────────────────────────────────────
  const [expandedSponsorId, setExpandedSponsorId] = useState(null)
  const [sponsorDriversMap, setSponsorDriversMap] = useState({})
  const [sponsorDriversLoading, setSponsorDriversLoading] = useState({})
  const [showCreateSponsor, setShowCreateSponsor] = useState(false)
  const [createSponsorForm, setCreateSponsorForm] = useState({ email: '', password: '', company_name: '', first_name: '', last_name: '' })
  const [createSponsorLoading, setCreateSponsorLoading] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [createUserLoading, setCreateUserLoading] = useState(false)
  const [createUserForm, setCreateUserForm] = useState({
    role: 'driver',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    company_name: '',
    display_name: '',
    dob: '',
    phone: '',
  })

  // ── Edit User ─────────────────────────────────────────────
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', role: '' })
  const [editLoading, setEditLoading] = useState(false)

  // ── Deactivate with reason ────────────────────────────────
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [deactivateLoading, setDeactivateLoading] = useState(false)

  // ── Drivers ──────────────────────────────────────────────
  const [deltaById, setDeltaById] = useState({})
  const [reasonById, setReasonById] = useState({})
  const [selectedLedgerDriverId, setSelectedLedgerDriverId] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerBalance, setLedgerBalance] = useState(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [expandedDriverId, setExpandedDriverId] = useState(null)

  // ── Bulk CSV import ───────────────────────────────────────
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkCsvText, setBulkCsvText] = useState('')
  const [bulkPreview, setBulkPreview] = useState([])
  const [bulkParseError, setBulkParseError] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkResults, setBulkResults] = useState(null)

  // ── Transactions ─────────────────────────────────────────
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(false)
  const [txDriverFilter, setTxDriverFilter] = useState('')
  const [txSponsorFilter, setTxSponsorFilter] = useState('')
  const [txDateFrom, setTxDateFrom] = useState('')
  const [txDateTo, setTxDateTo] = useState('')

  // ── User Tools ────────────────────────────────────────────
  const [tempAdminForm, setTempAdminForm] = useState({ email: '', password: '', display_name: '', expires_at: '' })
  const [tempAdminLoading, setTempAdminLoading] = useState(false)
  const [tempAdminResult, setTempAdminResult] = useState(null)

  // ── Sponsor Tools ─────────────────────────────────────────
  const [selectedSponsorId, setSelectedSponsorId] = useState('')
  const [sponsorToolsTab, setSponsorToolsTab] = useState('ads')
  const [sponsorAds, setSponsorAds] = useState([])
  const [sponsorAdsLoading, setSponsorAdsLoading] = useState(false)
  const [sponsorCatalog, setSponsorCatalog] = useState([])
  const [sponsorCatalogLoading, setSponsorCatalogLoading] = useState(false)
  const [sponsorAnalytics, setSponsorAnalytics] = useState(null)
  const [sponsorAnalyticsLoading, setSponsorAnalyticsLoading] = useState(false)
  const [sponsorToolsError, setSponsorToolsError] = useState('')
  const [sponsorToolsSuccess, setSponsorToolsSuccess] = useState('')
  const [newAdForm, setNewAdForm] = useState({ title: '', description: '', requirements: '', benefits: '' })
  const [newAdLoading, setNewAdLoading] = useState(false)

  // ── Loaders ───────────────────────────────────────────────

  const loadAll = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      const [sponsorData, driverData, adminData, appData] = await Promise.allSettled([
        api('/users?role=sponsor', { method: 'GET' }),
        api('/users?role=driver', { method: 'GET' }),
        api('/users?role=admin', { method: 'GET' }),
        api('/applications', { method: 'GET' }),
      ])
      if (sponsorData.status === 'fulfilled')
        setSponsors(Array.isArray(sponsorData.value?.users) ? sponsorData.value.users : [])
      if (driverData.status === 'fulfilled')
        setDrivers(Array.isArray(driverData.value?.users) ? driverData.value.users : [])
      if (adminData.status === 'fulfilled')
        setAdmins(Array.isArray(adminData.value?.users) ? adminData.value.users : [])
      if (appData.status === 'fulfilled')
        setApplications(Array.isArray(appData.value?.applications) ? appData.value.applications : [])
    } finally { setLoading(false) }
  }

  const reloadApplications = async () => {
    try { const d = await api('/applications', { method: 'GET' }); setApplications(Array.isArray(d?.applications) ? d.applications : []) }
    catch (e) { setError(e?.message || 'Failed to reload applications') }
  }
  const reloadDrivers = async () => {
    try { const d = await api('/users?role=driver', { method: 'GET' }); setDrivers(Array.isArray(d?.users) ? d.users : []) }
    catch (e) { setError(e?.message || 'Failed to reload drivers') }
  }
  const reloadSponsors = async () => {
    try { const d = await api('/users?role=sponsor', { method: 'GET' }); setSponsors(Array.isArray(d?.users) ? d.users : []) }
    catch (e) { setError(e?.message || 'Failed to reload sponsors') }
  }
  const reloadAdmins = async () => {
    try { const d = await api('/users?role=admin', { method: 'GET' }); setAdmins(Array.isArray(d?.users) ? d.users : []) }
    catch (e) { setError(e?.message || 'Failed to reload admins') }
  }

  const loadSponsorDrivers = async (sponsorId) => {
    setSponsorDriversLoading(p => ({ ...p, [sponsorId]: true }))
    try { const d = await api(`/sponsors/${sponsorId}/drivers`, { method: 'GET' }); setSponsorDriversMap(p => ({ ...p, [sponsorId]: d?.drivers || [] })) }
    catch (e) { setError(e?.message || 'Failed to load sponsor drivers') }
    finally { setSponsorDriversLoading(p => ({ ...p, [sponsorId]: false })) }
  }

  const openLedger = async (driver) => {
    const driverId = driver?.id ?? driver?.user_id
    if (!driverId) return
    setSelectedLedgerDriverId(driverId); setLedger([]); setLedgerBalance(null); setLedgerLoading(true)
    try { const d = await api(`/drivers/${driverId}/points`, { method: 'GET' }); setLedger(Array.isArray(d?.ledger) ? d.ledger : []); setLedgerBalance(d?.balance ?? null) }
    catch (e) { setError(e?.message || 'Failed to load ledger') }
    finally { setLedgerLoading(false) }
  }

  const loadTransactions = async () => {
    setTxLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (txDriverFilter.trim()) { const m = drivers.find(d => String(d.id) === txDriverFilter.trim() || (d.email || '').toLowerCase().includes(txDriverFilter.trim().toLowerCase())); if (m) params.set('driver_id', m.id) }
      if (txSponsorFilter.trim()) { const m = sponsors.find(s => String(s.id) === txSponsorFilter.trim() || (s.email || '').toLowerCase().includes(txSponsorFilter.trim().toLowerCase()) || (s.company_name || '').toLowerCase().includes(txSponsorFilter.trim().toLowerCase())); if (m) params.set('sponsor_id', m.id) }
      if (txDateFrom) params.set('date_from', txDateFrom)
      if (txDateTo) params.set('date_to', txDateTo)
      const d = await api(`/transactions${params.toString() ? '?' + params.toString() : ''}`, { method: 'GET' })
      setTransactions(Array.isArray(d?.transactions) ? d.transactions : [])
    } catch (e) { setError(e?.message || 'Failed to load transactions') }
    finally { setTxLoading(false) }
  }

  useEffect(() => { loadAll() }, [])

  // ── Sponsor Tools loaders ─────────────────────────────────

  const loadSponsorAds = async (sId) => {
    if (!sId) return
    setSponsorAdsLoading(true); setSponsorToolsError('')
    try { const d = await api(`/sponsors/${sId}/ads`, { method: 'GET' }); setSponsorAds(Array.isArray(d?.ads) ? d.ads : []) }
    catch (e) { setSponsorToolsError(e?.message || 'Failed to load ads') }
    finally { setSponsorAdsLoading(false) }
  }

  const loadSponsorCatalog = async (sId) => {
    if (!sId) return
    setSponsorCatalogLoading(true); setSponsorToolsError('')
    try { const d = await api(`/sponsors/${sId}/catalog`, { method: 'GET' }); setSponsorCatalog(Array.isArray(d?.items) ? d.items : []) }
    catch (e) { setSponsorToolsError(e?.message || 'Failed to load catalog') }
    finally { setSponsorCatalogLoading(false) }
  }

  const loadSponsorAnalytics = async (sId) => {
    if (!sId) return
    setSponsorAnalyticsLoading(true); setSponsorToolsError('')
    try { const d = await api(`/sponsors/${sId}/analytics`, { method: 'GET' }); setSponsorAnalytics(d || null) }
    catch (e) { setSponsorToolsError(e?.message || 'Failed to load analytics') }
    finally { setSponsorAnalyticsLoading(false) }
  }

  const handleSponsorSelect = (sId) => {
    setSelectedSponsorId(sId); setSponsorAds([]); setSponsorCatalog([]); setSponsorAnalytics(null)
    setSponsorToolsError(''); setSponsorToolsSuccess('')
    if (!sId) return
    if (sponsorToolsTab === 'ads') loadSponsorAds(sId)
    else if (sponsorToolsTab === 'catalog') loadSponsorCatalog(sId)
    else loadSponsorAnalytics(sId)
  }

  const handleSponsorToolsTabChange = (tab) => {
    setSponsorToolsTab(tab); setSponsorToolsError(''); setSponsorToolsSuccess('')
    if (!selectedSponsorId) return
    if (tab === 'ads') loadSponsorAds(selectedSponsorId)
    else if (tab === 'catalog') loadSponsorCatalog(selectedSponsorId)
    else loadSponsorAnalytics(selectedSponsorId)
  }

  const deleteAd = async (adId) => {
    if (!window.confirm('Delete this ad?')) return
    setSponsorToolsError(''); setSponsorToolsSuccess('')
    try { await api(`/sponsors/${selectedSponsorId}/ads/${adId}`, { method: 'DELETE' }); setSponsorToolsSuccess('Ad deleted.'); await loadSponsorAds(selectedSponsorId) }
    catch (e) { setSponsorToolsError(e?.message || 'Failed to delete ad') }
  }

  const createAd = async (e) => {
    e.preventDefault(); setNewAdLoading(true); setSponsorToolsError(''); setSponsorToolsSuccess('')
    try {
      await api(`/sponsors/${selectedSponsorId}/ads`, { method: 'POST', body: JSON.stringify(newAdForm) })
      setSponsorToolsSuccess('Ad created.'); setNewAdForm({ title: '', description: '', requirements: '', benefits: '' })
      await loadSponsorAds(selectedSponsorId)
    } catch (e) { setSponsorToolsError(e?.message || 'Failed to create ad') }
    finally { setNewAdLoading(false) }
  }

  const deleteCatalogItem = async (itemId) => {
    if (!window.confirm('Remove this item?')) return
    setSponsorToolsError(''); setSponsorToolsSuccess('')
    try { await api(`/sponsors/${selectedSponsorId}/catalog/${itemId}`, { method: 'DELETE' }); setSponsorToolsSuccess('Item removed.'); await loadSponsorCatalog(selectedSponsorId) }
    catch (e) { setSponsorToolsError(e?.message || 'Failed to remove item') }
  }

  // ── Edit User ─────────────────────────────────────────────

  const openEditUser = (user) => {
    setEditUser(user)
    setEditForm({ first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '', role: user.role || '' })
    setError(''); setSuccess('')
  }

  const handleEditUser = async (e) => {
    e.preventDefault(); setEditLoading(true); setError(''); setSuccess('')
    try {
      await api(`/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      setSuccess(`Updated user: ${editForm.email}`); setEditUser(null); await loadAll()
    } catch (e) { setError(e?.message || 'Failed to update user') }
    finally { setEditLoading(false) }
  }

  // ── Deactivate with reason ────────────────────────────────

  const openDeactivate = (user) => { setDeactivateTarget(user); setDeactivateReason(''); setError(''); setSuccess('') }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    setDeactivateLoading(true); setError(''); setSuccess('')
    try {
      await api(`/users/${deactivateTarget.id}/deactivate`, { method: 'PUT', body: JSON.stringify({ reason: deactivateReason.trim() || undefined }) })
      setSuccess(`Account deactivated: ${deactivateTarget.email}`); setDeactivateTarget(null); await loadAll()
      if (expandedSponsorId) await loadSponsorDrivers(expandedSponsorId)
    } catch (e) { setError(e?.message || 'Failed to deactivate') }
    finally { setDeactivateLoading(false) }
  }

  const handleReactivate = async (user) => {
    setError(''); setSuccess('')
    try { await api(`/users/${user.id}/reactivate`, { method: 'PUT' }); setSuccess(`Account reactivated: ${user.email}`); await loadAll() }
    catch (e) { setError(e?.message || 'Failed to reactivate') }
  }

  // ── Application actions ───────────────────────────────────

  const handleAppAction = async (appId, newStatus) => {
    setError(''); setSuccess('')
    const notes = (appNotesById[appId] || '').trim()
    try {
      await api(`/applications/${appId}`, { method: 'PUT', body: JSON.stringify({ status: newStatus, notes: notes || undefined }) })
      setSuccess(`Application #${appId} → "${newStatus}".`)
      setAppNotesById(p => { const n = { ...p }; delete n[appId]; return n })
      setAppActionById(p => { const n = { ...p }; delete n[appId]; return n })
      await reloadApplications()
    } catch (e) { setError(e?.message || `Failed to ${newStatus} application`) }
  }

  // ── Create Sponsor ────────────────────────────────────────

  const handleCreateSponsor = async (e) => {
    e.preventDefault(); setCreateSponsorLoading(true); setError(''); setSuccess('')
    try {
      await api('/users/create-sponsor', { method: 'POST', body: JSON.stringify(createSponsorForm) })
      setSuccess(`Sponsor "${createSponsorForm.company_name}" created.`)
      setCreateSponsorForm({ email: '', password: '', company_name: '', first_name: '', last_name: '' })
      setShowCreateSponsor(false); await reloadSponsors()
    } catch (e) { setError(e?.message || 'Failed to create sponsor') }
    finally { setCreateSponsorLoading(false) }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreateUserLoading(true); setError(''); setSuccess('')
    try {
      const payload = {
        role: createUserForm.role,
        email: createUserForm.email,
        password: createUserForm.password,
        first_name: createUserForm.first_name,
        last_name: createUserForm.last_name,
        company_name: createUserForm.company_name,
        display_name: createUserForm.display_name,
        dob: createUserForm.dob || undefined,
        phone: createUserForm.phone,
      }
      await api('/users/create', { method: 'POST', body: JSON.stringify(payload) })
      setSuccess(`Created ${createUserForm.role} account: ${createUserForm.email}`)
      setShowCreateUser(false)
      setCreateUserForm({
        role: 'driver',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        company_name: '',
        display_name: '',
        dob: '',
        phone: '',
      })
      await loadAll()
    } catch (e) {
      setError(e?.message || 'Failed to create user')
    } finally {
      setCreateUserLoading(false)
    }
  }

  // ── Driver point adjustment ───────────────────────────────

  const adjustPoints = async (driver) => {
    setError(''); setSuccess('')
    const driverId = driver?.id ?? driver?.user_id
    if (!driverId) { setError('Missing driver id'); return }
    const delta = Number(deltaById[driverId])
    if (!Number.isFinite(delta) || delta === 0) { setError('Enter a non-zero amount.'); return }
    const reason = (reasonById[driverId] || '').trim()
    if (!reason) { setError('A reason is required.'); return }
    try {
      await api(`/drivers/${driverId}/points/${delta > 0 ? 'add' : 'deduct'}`, { method: 'POST', body: JSON.stringify({ points: Math.abs(delta), reason }) })
      setSuccess(`Updated points for driver ${driverId}.`)
      setDeltaById(p => ({ ...p, [driverId]: '' })); setReasonById(p => ({ ...p, [driverId]: '' }))
      await reloadDrivers(); if (selectedLedgerDriverId === driverId) await openLedger(driver)
    } catch (e) { setError(e?.message || 'Failed to adjust points') }
  }

  const removeDriverFromSponsor = async (driver) => {
    const driverId = driver?.id ?? driver?.user_id; if (!driverId) return
    const name = [driver.first_name, driver.last_name].filter(Boolean).join(' ') || driver.email || `Driver ${driverId}`
    if (!window.confirm(`Remove ${name} from their sponsor org?`)) return
    setError(''); setSuccess('')
    try {
      await api(`/drivers/${driverId}/sponsor`, { method: 'DELETE' })
      setSuccess(`Removed ${name}.`); await reloadDrivers(); await reloadApplications()
      if (expandedSponsorId) await loadSponsorDrivers(expandedSponsorId)
    } catch (e) { setError(e?.message || 'Failed to remove from sponsor') }
  }

  // ── Bulk CSV ──────────────────────────────────────────────

  const parseBulkCsv = () => {
    setBulkParseError(''); setBulkPreview([]); setBulkResults(null)
    const lines = bulkCsvText.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) { setBulkParseError('Need a header row and at least one data row.'); return }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''))
    if (!headers.includes('email') || !headers.includes('password')) { setBulkParseError('CSV must include "email" and "password" columns.'); return }
    const preview = []
    for (let i = 1; i < lines.length; i++) {
      const vals = []; let cur = '', inQuote = false
      for (const ch of lines[i]) { if (ch === '"') { inQuote = !inQuote } else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = '' } else cur += ch }
      vals.push(cur.trim())
      const row = {}; headers.forEach((h, j) => { row[h] = vals[j] || '' }); preview.push(row)
    }
    setBulkPreview(preview)
  }

  const submitBulkImport = async () => {
    setBulkImporting(true); setBulkResults(null); setError('')
    try {
      const data = await api('/drivers/bulk-import', { method: 'POST', body: JSON.stringify({ drivers: bulkPreview.map(r => ({ email: r.email, password: r.password, first_name: r.first_name || r.firstname || '', last_name: r.last_name || r.lastname || '', dob: r.dob || undefined })) }) })
      setBulkResults(data); setSuccess(`Bulk import: ${data.successCount} created, ${data.failCount} failed.`); await reloadDrivers()
    } catch (e) { setError(e?.message || 'Bulk import failed') }
    finally { setBulkImporting(false) }
  }

  const downloadBulkTemplate = () => {
    const csv = 'email,password,first_name,last_name,dob\njohn@example.com,password123,John,Doe,1990-01-15'
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'driver-import-template.csv'; a.click(); URL.revokeObjectURL(url)
  }

  // ── Temp Admin ────────────────────────────────────────────

  const handleCreateTempAdmin = async (e) => {
    e.preventDefault(); setTempAdminLoading(true); setTempAdminResult(null); setError(''); setSuccess('')
    try {
      const data = await api('/users/temp-admin', { method: 'POST', body: JSON.stringify(tempAdminForm) })
      setTempAdminResult(data); setSuccess(`Temp admin: ${tempAdminForm.email} (expires ${tempAdminForm.expires_at})`)
      setTempAdminForm({ email: '', password: '', display_name: '', expires_at: '' })
    } catch (e) { setError(e?.message || 'Failed to create temp admin') }
    finally { setTempAdminLoading(false) }
  }

  // ── CSV Export ────────────────────────────────────────────

  const exportCSV = () => {
    if (!transactions.length) return
    const csv = [['ID','Date','Driver','Driver Email','Sponsor','Delta','Reason'], ...transactions.map(t => [t.id, t.created_at ? new Date(t.created_at).toLocaleString() : '', (t.driver_name||'').trim(), t.driver_email||'', t.sponsor_company||(t.sponsor_id==null?'Admin':`#${t.sponsor_id}`), t.delta, `"${(t.reason||'').replace(/"/g,'""')}"`])].map(r=>r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `transactions-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  // ── Filtered data ─────────────────────────────────────────

  const filteredApplications = useMemo(() => {
    let list = applications
    if (appStatusFilter !== 'all') list = list.filter(a => a.status === appStatusFilter)
    const q = (searchQuery || '').trim().toLowerCase(); if (!q) return list
    return list.filter(a => String(a.id??'').includes(q) || String(a.driver_email??'').toLowerCase().includes(q) || String(a.driver_name??'').toLowerCase().includes(q) || String(a.sponsor_email??'').toLowerCase().includes(q) || String(a.sponsor_company??'').toLowerCase().includes(q))
  }, [applications, appStatusFilter, searchQuery])

  const filteredSponsors = useMemo(() => {
    const q = (searchQuery||'').trim().toLowerCase(); if (!q) return sponsors
    return sponsors.filter(s => String(s.id??'').includes(q) || String(s.email??'').toLowerCase().includes(q) || String(s.company_name??'').toLowerCase().includes(q))
  }, [sponsors, searchQuery])

  const filteredDrivers = useMemo(() => {
    const q = (searchQuery||'').trim().toLowerCase(); if (!q) return drivers
    return drivers.filter(d => String(d.id??'').includes(q) || String(d.email??'').toLowerCase().includes(q) || [d.first_name,d.last_name].filter(Boolean).join(' ').toLowerCase().includes(q) || String(d.sponsor_org??'').toLowerCase().includes(q))
  }, [drivers, searchQuery])

  const filteredAdmins = useMemo(() => {
    const q = (searchQuery||'').trim().toLowerCase(); if (!q) return admins
    return admins.filter(a =>
      String(a.id ?? '').includes(q) ||
      String(a.email ?? '').toLowerCase().includes(q) ||
      String(a.display_name ?? '').toLowerCase().includes(q) ||
      [a.first_name, a.last_name].filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [admins, searchQuery])

  const filteredOrganizations = useMemo(() => {
    const grouped = new Map()
    sponsors.forEach((s) => {
      const orgName = (s.company_name || '').trim()
      // Only show real sponsor-created organizations.
      if (!orgName) return
      const key = orgName.toLowerCase()
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          company_name: orgName,
          repSponsorId: s.id,
          owner_name: [s.first_name, s.last_name].filter(Boolean).join(' ') || '—',
          owner_email: s.email || '—',
          driver_count: 0,
        })
      }
      const g = grouped.get(key)
      // Prefer an active sponsor as representative for loading org drivers.
      if (g.repSponsorId == null || s.is_active !== 0) {
        g.repSponsorId = s.id
        g.owner_name = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—'
        g.owner_email = s.email || '—'
      }
    })

    // Compute driver counts:
    // - drivers affiliated via driver_profiles.sponsor_org
    // - drivers affiliated via accepted applications (even if sponsor_org isn't set)
    const driverIdsByOrg = new Map()
    const addDriverToOrg = (orgName, driverId) => {
      const name = String(orgName || '').trim()
      if (!name) return
      const key = name.toLowerCase()
      const g = grouped.get(key)
      if (!g) return
      if (!driverIdsByOrg.has(key)) driverIdsByOrg.set(key, new Set())
      if (Number.isFinite(Number(driverId))) driverIdsByOrg.get(key).add(Number(driverId))
    }

    drivers.forEach((d) => addDriverToOrg(d.sponsor_org, d.id))

    applications
      .filter((a) => a?.status === 'accepted')
      .forEach((a) => addDriverToOrg(a.sponsor_company, a.driver_id))

    for (const [key, set] of driverIdsByOrg.entries()) {
      const g = grouped.get(key)
      if (g) g.driver_count = set.size
    }

    const list = Array.from(grouped.values()).sort((a, b) =>
      a.company_name.localeCompare(b.company_name)
    )

    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return list
    return list.filter((o) =>
      String(o.repSponsorId).includes(q) ||
      String(o.company_name || '').toLowerCase().includes(q)
    )
  }, [sponsors, drivers, applications, searchQuery])

  const statusCounts = useMemo(() => {
    const c = { all: applications.length, pending: 0, accepted: 0, rejected: 0, cancelled: 0 }
    applications.forEach(a => { if (a.status in c) c[a.status]++ }); return c
  }, [applications])

  // ── UI helpers ────────────────────────────────────────────

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleString(undefined, { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
  const fmtDateShort = (ts) => ts ? new Date(ts).toLocaleDateString() : '—'

  const ActiveBadge = ({ isActive, reason }) => (
    <span title={!isActive && reason ? `Reason: ${reason}` : ''} style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:'0.75em', fontWeight:600,
      background: isActive!==false ? '#dcfce7' : '#fee2e2', color: isActive!==false ? '#166534' : '#991b1b',
      cursor: !isActive && reason ? 'help' : 'default',
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: isActive!==false ? '#22c55e' : '#ef4444' }} />
      {isActive!==false ? 'Active' : 'Inactive'}{!isActive && reason ? ' ⓘ' : ''}
    </span>
  )

  const StatusBadge = ({ status }) => {
    const map = { accepted:{bg:'#d4edda',color:'#155724',label:'Accepted'}, pending:{bg:'#fff3cd',color:'#856404',label:'Pending'}, rejected:{bg:'#f8d7da',color:'#721c24',label:'Rejected'}, cancelled:{bg:'#e2e3e5',color:'#383d41',label:'Cancelled'} }
    const s = map[status] || { bg:'#f3f4f6', color:'#6b7280', label:status }
    return <span style={{ padding:'3px 10px', borderRadius:999, fontSize:'0.8em', fontWeight:600, backgroundColor:s.bg, color:s.color, whiteSpace:'nowrap' }}>{s.label}</span>
  }

  const DetailGrid = ({ fields }) => (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, marginTop:12 }}>
      {fields.map(({ label, value }) => (
        <div key={label} style={{ padding:'10px 12px', borderRadius:6, background:'#fff', border:'1px solid var(--border)' }}>
          <p style={{ margin:'0 0 2px', fontSize:'0.7em', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9ca3af' }}>{label}</p>
          <p style={{ margin:0, fontSize:'0.85em', fontWeight:500, color:'#374151', wordBreak:'break-all' }}>{String(value??'—')}</p>
        </div>
      ))}
    </div>
  )

  const tabStyle = (tab) => ({
    padding:'8px 18px', borderRadius:'6px 6px 0 0', border:'1px solid var(--border)',
    borderBottom: activeTab===tab ? '2px solid white' : '1px solid var(--border)',
    background: activeTab===tab ? 'white' : '#f3f4f6', fontWeight: activeTab===tab ? 700 : 400,
    cursor:'pointer', fontSize:'0.875em', marginBottom:-1,
  })

  const cardStyle = { borderRadius:'0 8px 8px 8px', border:'1px solid var(--border)', padding:'16px 20px', background:'#fff' }

  const stBtn = (key) => (
    <button type="button" onClick={() => handleSponsorToolsTabChange(key)} style={{
      padding:'5px 14px', borderRadius:6, border:'1px solid var(--border)',
      background: sponsorToolsTab===key ? '#1e40af' : '#f9fafb', color: sponsorToolsTab===key ? '#fff' : '#374151',
      fontSize:'0.82em', fontWeight: sponsorToolsTab===key ? 700 : 400, cursor:'pointer',
    }}>{key.charAt(0).toUpperCase()+key.slice(1)}</button>
  )

  // ─────────────────────────────────────────────────────────
  return (
    <div>
      <Navigation />
      <main className="app-main">

        <div style={{ marginBottom:20 }}>
          <h1 className="page-title" style={{ marginBottom:4 }}>Admin — User Management</h1>
          <p className="page-subtitle">Manage sponsors, drivers, applications, and access</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom:20 }}>
          <div className="stat-card"><p className="stat-label">Sponsors</p><p className="stat-value stat-value-blue">{sponsors.length}</p></div>
          <div className="stat-card"><p className="stat-label">Drivers</p><p className="stat-value stat-value-green">{drivers.length}</p></div>
          <div className="stat-card"><p className="stat-label">Admins</p><p className="stat-value" style={{ color:'#4f46e5' }}>{admins.length}</p></div>
          <div className="stat-card"><p className="stat-label">Applications</p><p className="stat-value stat-value-amber">{applications.length}</p></div>
          <div className="stat-card"><p className="stat-label">Pending Review</p><p className="stat-value" style={{ color:'#d97706' }}>{statusCounts.pending}</p></div>
          <div className="stat-card"><p className="stat-label">Inactive</p><p className="stat-value" style={{ color:'#dc2626' }}>{[...sponsors,...drivers,...admins].filter(u=>u.is_active===0).length}</p></div>
        </div>

        {/* Search */}
        <div className="card" style={{ marginBottom:8 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <input className="form-input" style={{ flex:1, minWidth:220 }} placeholder="Search by name, email, company, or ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button
              className="btn btn-success"
              type="button"
              onClick={() => { setShowCreateUser((v) => !v); setError(''); setSuccess('') }}
            >
              {showCreateUser ? 'Close Create User' : '+ Create User'}
            </button>
            <button className="btn btn-primary" type="button" onClick={loadAll} disabled={loading}>{loading ? 'Loading…' : '↺ Refresh'}</button>
          </div>
        </div>

        {showCreateUser && (
          <div className="card" style={{ marginBottom: 10 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>Create user</h2>
            <p className="page-subtitle" style={{ marginTop: 0, marginBottom: 12 }}>
              Create a new driver, sponsor, or admin account.
            </p>

            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-input"
                    value={createUserForm.role}
                    onChange={(e) => setCreateUserForm((p) => ({ ...p, role: e.target.value }))}
                  >
                    <option value="driver">Driver</option>
                    <option value="sponsor">Sponsor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    required
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    className="form-input"
                    type="password"
                    required
                    minLength={8}
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm((p) => ({ ...p, password: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone (optional)</label>
                  <input
                    className="form-input"
                    value={createUserForm.phone}
                    onChange={(e) => setCreateUserForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">First name (optional)</label>
                  <input
                    className="form-input"
                    value={createUserForm.first_name}
                    onChange={(e) => setCreateUserForm((p) => ({ ...p, first_name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name (optional)</label>
                  <input
                    className="form-input"
                    value={createUserForm.last_name}
                    onChange={(e) => setCreateUserForm((p) => ({ ...p, last_name: e.target.value }))}
                  />
                </div>

                {createUserForm.role === 'driver' && (
                  <div className="form-group">
                    <label className="form-label">DOB (optional)</label>
                    <input
                      className="form-input"
                      type="date"
                      value={createUserForm.dob}
                      onChange={(e) => setCreateUserForm((p) => ({ ...p, dob: e.target.value }))}
                    />
                  </div>
                )}

                {createUserForm.role === 'sponsor' && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Company name</label>
                    <input
                      className="form-input"
                      required
                      value={createUserForm.company_name}
                      onChange={(e) => setCreateUserForm((p) => ({ ...p, company_name: e.target.value }))}
                    />
                  </div>
                )}

                {createUserForm.role === 'admin' && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Display name (optional)</label>
                    <input
                      className="form-input"
                      value={createUserForm.display_name}
                      onChange={(e) => setCreateUserForm((p) => ({ ...p, display_name: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" className="btn btn-success" disabled={createUserLoading}>
                  {createUserLoading ? 'Creating…' : 'Create user'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateUser(false)} disabled={createUserLoading}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {error   && <p className="form-footer" style={{ color:'crimson',  margin:'0 0 8px' }}>{error}</p>}
        {success && <p className="form-footer" style={{ color:'#16a34a', margin:'0 0 8px' }}>{success}</p>}

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
          <button type="button" style={tabStyle('applications')} onClick={() => setActiveTab('applications')}>Applications ({filteredApplications.length})</button>
          <button type="button" style={tabStyle('organizations')} onClick={() => setActiveTab('organizations')}>Organizations ({filteredOrganizations.length})</button>
          <button type="button" style={tabStyle('admins')} onClick={() => setActiveTab('admins')}>Admins ({filteredAdmins.length})</button>
          <button type="button" style={tabStyle('sponsors')} onClick={() => setActiveTab('sponsors')}>Sponsors ({filteredSponsors.length})</button>
          <button type="button" style={tabStyle('drivers')} onClick={() => setActiveTab('drivers')}>Drivers ({filteredDrivers.length})</button>
          <button type="button" style={tabStyle('transactions')} onClick={() => setActiveTab('transactions')}>Transactions</button>
          <button type="button" style={tabStyle('sponsor-tools')} onClick={() => setActiveTab('sponsor-tools')}>Sponsor Tools</button>
          <button type="button" style={tabStyle('tools')} onClick={() => setActiveTab('tools')}>User Tools</button>
        </div>

        {/* ══ APPLICATIONS ══ */}
        {activeTab === 'applications' && (
          <div style={cardStyle}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {['all','pending','accepted','rejected','cancelled'].map(s => (
                <button key={s} type="button" onClick={() => setAppStatusFilter(s)} style={{ padding:'4px 14px', borderRadius:999, border:'1px solid var(--border)', fontSize:'0.82em', fontWeight: appStatusFilter===s?700:400, cursor:'pointer', background: appStatusFilter===s?'#1e40af':'#f9fafb', color: appStatusFilter===s?'#fff':'#374151' }}>
                  {s.charAt(0).toUpperCase()+s.slice(1)} ({statusCounts[s]??0})
                </button>
              ))}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>ID</th><th>Driver</th><th>Sponsor / Org</th><th>Ad</th><th>Status</th><th>Applied</th><th>Notes</th><th style={{ minWidth:260 }}>Actions</th></tr></thead>
                <tbody>
                  {loading && applications.length===0 ? <tr><td colSpan="8" className="table-empty">Loading…</td></tr>
                    : filteredApplications.length===0 ? <tr><td colSpan="8" className="table-empty">No applications match the current filter</td></tr>
                    : filteredApplications.map(app => {
                      const pendingAction = appActionById[app.id]
                      const isEditable = app.status==='pending' || app.status==='accepted'
                      return (
                        <React.Fragment key={String(app.id)}>
                          <tr>
                            <td style={{ fontFamily:'monospace', fontSize:'0.82em' }}>{app.id}</td>
                            <td><div style={{ lineHeight:1.4 }}><strong style={{ fontSize:'0.88em' }}>{(app.driver_name||'').trim()||'—'}</strong><br /><span style={{ fontSize:'0.78em', color:'#6b7280' }}>{app.driver_email}</span></div></td>
                            <td><div style={{ lineHeight:1.4 }}><strong style={{ fontSize:'0.88em' }}>{app.sponsor_company||'—'}</strong><br /><span style={{ fontSize:'0.78em', color:'#6b7280' }}>{app.sponsor_email}</span></div></td>
                            <td style={{ fontSize:'0.85em', maxWidth:140 }}>{app.ad_title||<em style={{ color:'#9ca3af' }}>—</em>}</td>
                            <td><StatusBadge status={app.status} /></td>
                            <td style={{ fontSize:'0.82em', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtDateShort(app.applied_at)}</td>
                            <td style={{ fontSize:'0.82em', color:'#555', maxWidth:140 }}>{app.notes||<em style={{ color:'#9ca3af' }}>—</em>}</td>
                            <td>
                              {isEditable ? (
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                                    {app.status==='pending' && <button type="button" className="btn btn-success" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => setAppActionById(p => ({ ...p, [app.id]: p[app.id]==='accept'?null:'accept' }))}>✓ Accept</button>}
                                    <button type="button" className="btn btn-danger" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => setAppActionById(p => ({ ...p, [app.id]: p[app.id]==='reject'?null:'reject' }))}>✕ Reject</button>
                                    <button type="button" className="btn btn-secondary" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => setAppActionById(p => ({ ...p, [app.id]: p[app.id]==='cancel'?null:'cancel' }))}>⊘ Cancel</button>
                                  </div>
                                  {pendingAction && (
                                    <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                                      <input className="form-input" style={{ flex:1, minWidth:130, fontSize:'0.8em' }} placeholder="Reason (optional)" value={appNotesById[app.id]||''} onChange={e => setAppNotesById(p => ({ ...p, [app.id]:e.target.value }))} />
                                      <button type="button" className="btn btn-primary" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => handleAppAction(app.id, {accept:'accepted',reject:'rejected',cancel:'cancelled'}[pendingAction])}>Confirm</button>
                                      <button type="button" className="btn btn-ghost" style={{ fontSize:'0.78em', padding:'3px 8px' }} onClick={() => setAppActionById(p => { const n={...p}; delete n[app.id]; return n })}>✕</button>
                                    </div>
                                  )}
                                </div>
                              ) : <span style={{ fontSize:'0.78em', color:'#9ca3af', fontStyle:'italic' }}>No actions</span>}
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

        {/* ══ ADMINS ══ */}
        {activeTab === 'admins' && (
          <div style={cardStyle}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Status</th><th>Last Login</th><th>Joined</th><th style={{ minWidth:280 }}>Actions</th></tr></thead>
                <tbody>
                  {loading && admins.length===0 ? <tr><td colSpan="7" className="table-empty">Loading…</td></tr>
                    : filteredAdmins.length===0 ? <tr><td colSpan="7" className="table-empty">No admins found</td></tr>
                    : filteredAdmins.map(a => {
                      const isActive = a.is_active!==0
                      const name = (a.display_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || '—')
                      return (
                        <tr key={String(a.id)} style={{ opacity: isActive?1:0.6 }}>
                          <td style={{ fontFamily:'monospace', fontSize:'0.82em' }}>{a.id}</td>
                          <td>{name}</td>
                          <td>{a.email}</td>
                          <td><ActiveBadge isActive={isActive} reason={a.deactivate_reason} /></td>
                          <td style={{ fontSize:'0.82em', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtDateShort(a.last_login_at)}</td>
                          <td style={{ fontSize:'0.82em', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtDateShort(a.created_at)}</td>
                          <td>
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              <button type="button" className="btn btn-primary" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => openEditUser(a)}>Edit</button>
                              {isActive
                                ? <button type="button" className="btn btn-secondary" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => openDeactivate(a)}>Deactivate</button>
                                : <button type="button" className="btn btn-success" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={async () => { await handleReactivate(a); await reloadAdmins() }}>Reactivate</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ SPONSORS ══ */}
        {activeTab === 'sponsors' && (
          <div style={cardStyle}>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
              <button type="button" className="btn btn-success" onClick={() => { setShowCreateSponsor(true); setError(''); setSuccess('') }}>+ Create Sponsor Org</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Organization</th><th>Status</th><th>Last Login</th><th>Joined</th><th style={{ minWidth:220 }}>Actions</th></tr></thead>
                <tbody>
                  {loading && sponsors.length===0 ? <tr><td colSpan="8" className="table-empty">Loading…</td></tr>
                    : filteredSponsors.length===0 ? <tr><td colSpan="8" className="table-empty">No sponsor users found</td></tr>
                    : filteredSponsors.map(s => {
                      const isActive = s.is_active!==0
                      const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—'
                      return (
                        <tr key={String(s.id)} style={{ opacity: isActive?1:0.6 }}>
                          <td style={{ fontFamily:'monospace', fontSize:'0.82em' }}>{s.id}</td>
                          <td>{name}</td>
                          <td>{s.email}</td>
                          <td><span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><span style={{ width:7, height:7, borderRadius:'50%', background: s.company_name?'#22c55e':'#d1d5db', flexShrink:0 }} />{s.company_name||<em style={{ color:'#9ca3af' }}>Not set</em>}</span></td>
                          <td><ActiveBadge isActive={isActive} reason={s.deactivate_reason} /></td>
                          <td style={{ fontSize:'0.82em', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtDateShort(s.last_login_at)}</td>
                          <td style={{ fontSize:'0.82em', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtDateShort(s.created_at)}</td>
                          <td>
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              <button type="button" className="btn btn-primary" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => openEditUser(s)}>Edit</button>
                              {isActive
                                ? <button type="button" className="btn btn-secondary" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => openDeactivate(s)}>Deactivate</button>
                                : <button type="button" className="btn btn-success" style={{ fontSize:'0.78em', padding:'3px 10px' }} onClick={() => handleReactivate(s)}>Reactivate</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ ORGANIZATIONS ══ */}
        {activeTab === 'organizations' && (
          <div style={cardStyle}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Organization</th><th>Owner</th><th className="text-right">Drivers</th><th style={{ minWidth:220 }}>Actions</th></tr></thead>
                <tbody>
                  {loading && filteredOrganizations.length===0 ? <tr><td colSpan="4" className="table-empty">Loading…</td></tr>
                    : filteredOrganizations.length===0 ? <tr><td colSpan="4" className="table-empty">No organizations found</td></tr>
                    : filteredOrganizations.map(org => {
                      const repId = org.repSponsorId
                      const isExpanded = expandedSponsorId === repId
                      return (
                        <React.Fragment key={org.key}>
                          <tr>
                            <td>{org.company_name}</td>
                            <td>
                              <div style={{ lineHeight: 1.35 }}>
                                <strong style={{ fontSize: '0.88em' }}>{org.owner_name}</strong><br />
                                <span style={{ fontSize: '0.78em', color: '#6b7280' }}>{org.owner_email}</span>
                              </div>
                            </td>
                            <td className="text-right"><strong>{org.driver_count}</strong></td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ fontSize:'0.78em', padding:'3px 10px' }}
                                onClick={async () => {
                                  if (isExpanded) { setExpandedSponsorId(null); return }
                                  setExpandedSponsorId(repId)
                                  if (!sponsorDriversMap[repId]) await loadSponsorDrivers(repId)
                                }}
                                disabled={!repId}
                              >
                                {isExpanded ? 'Hide Drivers' : 'View Drivers'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ background:'#f0fdf4' }}>
                              <td colSpan="4" style={{ padding:'14px 20px' }}>
                                <p style={{ margin:'0 0 10px', fontWeight:700, fontSize:'0.9em', color:'#065f46' }}>
                                  Drivers in "{org.company_name}" ({(sponsorDriversMap[repId]||[]).length})
                                </p>
                                {sponsorDriversLoading[repId] ? <p style={{ color:'#9ca3af', fontSize:'0.85em' }}>Loading…</p>
                                  : !sponsorDriversMap[repId]?.length ? <p style={{ color:'#9ca3af', fontSize:'0.85em', fontStyle:'italic' }}>No drivers affiliated yet.</p>
                                  : (
                                    <table className="table" style={{ background:'#fff' }}>
                                      <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Status</th><th>Last Login</th><th className="text-right">Points</th><th style={{ width:100 }}>Remove</th></tr></thead>
                                      <tbody>
                                        {sponsorDriversMap[repId].map(d => (
                                          <tr key={d.id} style={{ opacity: d.is_active!==0?1:0.6 }}>
                                            <td style={{ fontFamily:'monospace', fontSize:'0.8em' }}>{d.id}</td>
                                            <td>{d.name?.trim()||'—'}</td><td>{d.email}</td>
                                            <td><ActiveBadge isActive={d.is_active!==0} /></td>
                                            <td style={{ fontSize:'0.8em', color:'#6b7280' }}>{fmtDateShort(d.last_login_at)}</td>
                                            <td className="text-right" style={{ fontWeight:600 }}>{Number(d.points_balance||0).toLocaleString()}</td>
                                            <td><button type="button" className="btn btn-secondary" style={{ fontSize:'0.75em', padding:'3px 8px', color:'#dc2626', borderColor:'#dc2626' }} onClick={() => removeDriverFromSponsor(d)}>Remove</button></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
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

        {/* ══ DRIVERS ══ */}
        {activeTab === 'drivers' && (
          <div style={cardStyle}>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
              <button type="button" className="btn btn-success" onClick={() => { setShowBulkImport(true); setBulkCsvText(''); setBulkPreview([]); setBulkResults(null); setBulkParseError('') }}>⬆ Bulk Import CSV</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Sponsor Org</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th className="text-right">Points</th>
                    <th style={{ width:65 }}>Ledger</th>
                    <th style={{ width:60 }}>Details</th>
                    <th style={{ width:95 }}>Organization</th>
                    <th style={{ width:100 }}>Account</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && drivers.length===0 ? <tr><td colSpan="11" className="table-empty">Loading…</td></tr>
                    : filteredDrivers.length===0 ? <tr><td colSpan="11" className="table-empty">No drivers found</td></tr>
                    : filteredDrivers.map(d => {
                      const id=d.id
                      const name=[d.first_name,d.last_name].filter(Boolean).join(' ')||'—'
                      const sponsorOrg=d.sponsor_org||null
                      const points=Number(d.points_balance??d.points??0)
                      const isExpanded=expandedDriverId===id
                      const isActive=d.is_active!==0
                      const isLedgerOpen=selectedLedgerDriverId===id
                      return (
                        <React.Fragment key={String(id)}>
                          <tr style={{ opacity: isActive?1:0.55 }}>
                            <td style={{ fontFamily:'monospace', fontSize:'0.82em' }}>{id}</td>
                            <td style={{ fontWeight:500 }}>{name}</td>
                            <td style={{ fontSize:'0.88em', color:'#6b7280' }}>{d.email}</td>
                            <td>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                                <span style={{ width:7, height:7, borderRadius:'50%', background: sponsorOrg?'#22c55e':'#d1d5db', flexShrink:0 }} />
                                <span style={{ fontSize:'0.85em' }}>{sponsorOrg||<em style={{ color:'#9ca3af' }}>None</em>}</span>
                              </span>
                            </td>
                            <td><ActiveBadge isActive={isActive} reason={d.deactivate_reason} /></td>
                            <td style={{ fontSize:'0.8em', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtDateShort(d.last_login_at)}</td>
                            <td className="text-right" style={{ fontWeight:600 }}>{points.toLocaleString()}</td>
                            <td>
                              <button className="btn btn-primary" type="button" style={{ fontSize:'0.78em', padding:'4px 8px' }}
                                onClick={() => { if(isLedgerOpen){setSelectedLedgerDriverId(null);return} openLedger(d) }}>
                                {isLedgerOpen?'Close':'View'}
                              </button>
                            </td>
                            <td>
                              <button className="btn btn-primary" type="button" style={{ fontSize:'0.78em', padding:'4px 8px' }}
                                onClick={() => setExpandedDriverId(isExpanded?null:id)}>
                                {isExpanded?'Close':'Open'}
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize:'0.75em', padding:'3px 8px', color:'#dc2626', borderColor:'#dc2626' }}
                                onClick={() => removeDriverFromSponsor(d)}
                                disabled={!sponsorOrg}
                                title={sponsorOrg ? 'Remove this driver from their sponsor organization' : 'Driver is not in a sponsor organization'}
                              >
                                Remove
                              </button>
                            </td>
                            <td>
                              {isActive
                                ? <button type="button" className="btn btn-secondary" style={{ fontSize:'0.75em', padding:'3px 8px' }} onClick={() => openDeactivate(d)}>Deactivate</button>
                                : <button type="button" className="btn btn-success" style={{ fontSize:'0.75em', padding:'3px 8px' }} onClick={() => handleReactivate(d)}>Reactivate</button>}
                            </td>
                          </tr>

                          {/* Ledger inline */}
                          {isLedgerOpen && (
                            <tr style={{ background:'#f0fdf4' }}>
                              <td colSpan="11" style={{ padding:'14px 20px' }}>
                                <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:'0.9em' }}>
                                  Points ledger — {name}
                                  {ledgerBalance!==null && <span style={{ marginLeft:12, fontWeight:400, color:'#6b7280' }}>Balance: <strong style={{ color:'#16a34a' }}>{Number(ledgerBalance).toLocaleString()}</strong></span>}
                                </p>
                                {ledgerLoading ? <p style={{ color:'#9ca3af', fontSize:'0.85em' }}>Loading…</p>
                                  : ledger.length===0 ? <p style={{ color:'#9ca3af', fontSize:'0.85em', fontStyle:'italic' }}>No entries yet</p>
                                  : (
                                    <table className="table" style={{ background:'#fff' }}>
                                      <thead><tr><th>Date</th><th>Sponsor</th><th className="text-right">Delta</th><th>Reason</th></tr></thead>
                                      <tbody>
                                        {ledger.map((row,i) => (
                                          <tr key={row.id??i}>
                                            <td style={{ fontSize:'0.82em', whiteSpace:'nowrap' }}>{fmtDate(row.created_at)}</td>
                                            <td style={{ fontSize:'0.82em' }}>{row.sponsor_company||(row.sponsor_id==null?<em style={{ color:'#9ca3af' }}>Admin</em>:`#${row.sponsor_id}`)}</td>
                                            <td className="text-right" style={{ fontWeight:700, color: Number(row.delta)>=0?'#16a34a':'#dc2626' }}>{Number(row.delta)>=0?'+':''}{row.delta}</td>
                                            <td style={{ fontSize:'0.82em' }}>{row.reason??'—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                              </td>
                            </tr>
                          )}

                          {/* Expanded detail + actions */}
                          {isExpanded && (
                            <tr style={{ background:'#f9fafb' }}>
                              <td colSpan="10" style={{ padding:'16px 20px' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

                                  {/* Left: profile fields */}
                                  <div>
                                    <p style={{ margin:'0 0 10px', fontWeight:700, fontSize:'0.85em', color:'#374151' }}>Profile</p>
                                    <DetailGrid fields={[
                                      {label:'User ID',value:id},{label:'Email',value:d.email},
                                      {label:'Full Name',value:name},{label:'DOB',value:d.dob},
                                      {label:'Phone',value:d.phone},{label:'City / State',value:[d.city,d.state].filter(Boolean).join(', ')||'—'},
                                      {label:'Sponsor Org',value:sponsorOrg||'None'},
                                      {label:'Last Login',value:fmtDate(d.last_login_at)},
                                      {label:'Joined',value:fmtDate(d.created_at)},
                                      ...(d.deactivate_reason ? [{label:'Deactivate Reason',value:d.deactivate_reason}] : []),
                                    ]} />
                                  </div>

                                  {/* Right: actions */}
                                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                                    {/* Edit */}
                                    <div>
                                      <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:'0.85em', color:'#374151' }}>Edit User</p>
                                      <button className="btn btn-primary" type="button" onClick={() => openEditUser(d)}>Edit name / email / role</button>
                                    </div>

                                    {/* Adjust points */}
                                    <div>
                                      <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:'0.85em', color:'#374151' }}>Adjust Points</p>
                                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
                                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                          <label style={{ fontSize:'0.72em', fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>Amount (±)</label>
                                          <input className="form-input" type="number" placeholder="e.g. 50 or -20" style={{ width:130 }}
                                            value={deltaById[id]??''} onChange={e => setDeltaById(p => ({ ...p,[id]:e.target.value }))} />
                                        </div>
                                        <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1, minWidth:180 }}>
                                          <label style={{ fontSize:'0.72em', fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>Reason (required)</label>
                                          <input className="form-input" type="text" placeholder="Why are you changing points?"
                                            value={reasonById[id]??''} onChange={e => setReasonById(p => ({ ...p,[id]:e.target.value }))} />
                                        </div>
                                        <button className="btn btn-success" type="button" onClick={() => adjustPoints({ ...d,id })}>Apply</button>
                                      </div>
                                    </div>

                                    {/* Remove from sponsor */}
                                    {sponsorOrg && (
                                      <div>
                                        <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:'0.85em', color:'#374151' }}>Sponsor Org</p>
                                        <button className="btn btn-secondary" type="button"
                                          style={{ color:'#dc2626', borderColor:'#dc2626', fontSize:'0.85em' }}
                                          onClick={() => removeDriverFromSponsor({ ...d,id })}>
                                          Remove from "{sponsorOrg}"
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
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

        {/* ══ TRANSACTIONS ══ */}
        {activeTab === 'transactions' && (
          <div style={cardStyle}>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'flex-end' }}>
              {[{label:'Driver',value:txDriverFilter,set:setTxDriverFilter,placeholder:'Name, email, or ID'},{label:'Sponsor',value:txSponsorFilter,set:setTxSponsorFilter,placeholder:'Org, email, or ID'}].map(({ label,value,set,placeholder }) => (
                <div key={label} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <label style={{ fontSize:'0.72em', fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>{label}</label>
                  <input className="form-input" style={{ minWidth:160 }} placeholder={placeholder} value={value} onChange={e => set(e.target.value)} />
                </div>
              ))}
              {[{label:'From',value:txDateFrom,set:setTxDateFrom},{label:'To',value:txDateTo,set:setTxDateTo}].map(({ label,value,set }) => (
                <div key={label} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <label style={{ fontSize:'0.72em', fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>{label}</label>
                  <input className="form-input" type="date" value={value} onChange={e => set(e.target.value)} />
                </div>
              ))}
              <button className="btn btn-primary" type="button" onClick={loadTransactions} disabled={txLoading}>{txLoading?'Loading…':'🔍 Apply'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => { setTxDriverFilter(''); setTxSponsorFilter(''); setTxDateFrom(''); setTxDateTo('') }}>Clear</button>
              <button className="btn btn-success" type="button" onClick={exportCSV} disabled={!transactions.length} style={{ marginLeft:'auto' }}>⬇ Export CSV</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Driver</th><th>Sponsor</th><th className="text-right">Delta</th><th>Reason</th></tr></thead>
                <tbody>
                  {txLoading ? <tr><td colSpan="5" className="table-empty">Loading…</td></tr>
                    : transactions.length===0 ? <tr><td colSpan="5" className="table-empty">Apply filters above to load transactions</td></tr>
                    : transactions.map((t,i) => (
                      <tr key={t.id??i}>
                        <td style={{ fontSize:'0.82em', whiteSpace:'nowrap', color:'#6b7280' }}>{fmtDate(t.created_at)}</td>
                        <td><div style={{ lineHeight:1.4 }}><strong style={{ fontSize:'0.88em' }}>{(t.driver_name||'').trim()||'—'}</strong><br /><span style={{ fontSize:'0.78em', color:'#6b7280' }}>{t.driver_email}</span></div></td>
                        <td style={{ fontSize:'0.85em' }}>{t.sponsor_company?<><strong>{t.sponsor_company}</strong><br /><span style={{ fontSize:'0.85em', color:'#6b7280' }}>{t.sponsor_email}</span></>:t.sponsor_id==null?<em style={{ color:'#6b7280' }}>Admin</em>:`#${t.sponsor_id}`}</td>
                        <td className="text-right" style={{ fontWeight:700, color: Number(t.delta)>=0?'#16a34a':'#dc2626' }}>{Number(t.delta)>=0?'+':''}{t.delta}</td>
                        <td style={{ fontSize:'0.85em' }}>{t.reason||<em style={{ color:'#9ca3af' }}>—</em>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ SPONSOR TOOLS ══ */}
        {activeTab === 'sponsor-tools' && (
          <div style={cardStyle}>
            <p className="page-subtitle" style={{ marginBottom:16 }}>Manage ads, catalogs, and analytics for any sponsor org — same capabilities a sponsor has.</p>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <label style={{ fontSize:'0.85em', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>Select sponsor:</label>
              <select className="form-input" style={{ maxWidth:320 }} value={selectedSponsorId} onChange={e => handleSponsorSelect(e.target.value)}>
                <option value="">— Choose a sponsor org —</option>
                {sponsors.filter(s => s.company_name).map(s => <option key={s.id} value={s.id}>{s.company_name} ({s.email})</option>)}
              </select>
            </div>

            {selectedSponsorId ? (
              <>
                <div style={{ display:'flex', gap:6, marginBottom:16 }}>
                  {stBtn('ads')}{stBtn('catalog')}{stBtn('analytics')}
                </div>
                {sponsorToolsError && <p style={{ color:'#dc2626', fontSize:'0.85em', marginBottom:10 }}>{sponsorToolsError}</p>}
                {sponsorToolsSuccess && <p style={{ color:'#16a34a', fontSize:'0.85em', marginBottom:10 }}>{sponsorToolsSuccess}</p>}

                {/* Ads */}
                {sponsorToolsTab === 'ads' && (
                  <div>
                    <details style={{ marginBottom:16 }}>
                      <summary style={{ cursor:'pointer', fontWeight:600, fontSize:'0.9em', padding:'8px 0', userSelect:'none' }}>+ Create new ad</summary>
                      <form onSubmit={createAd} style={{ marginTop:12, display:'grid', gap:10 }}>
                        <div className="form-group"><label className="form-label">Title</label><input type="text" className="form-input" required value={newAdForm.title} onChange={e => setNewAdForm(p => ({ ...p,title:e.target.value }))} placeholder="e.g. Join Our Program" /></div>
                        <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={3} required value={newAdForm.description} onChange={e => setNewAdForm(p => ({ ...p,description:e.target.value }))} placeholder="Describe the program…" /></div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                          <div className="form-group"><label className="form-label">Requirements</label><textarea className="form-input" rows={2} value={newAdForm.requirements} onChange={e => setNewAdForm(p => ({ ...p,requirements:e.target.value }))} placeholder="Optional" /></div>
                          <div className="form-group"><label className="form-label">Benefits</label><textarea className="form-input" rows={2} value={newAdForm.benefits} onChange={e => setNewAdForm(p => ({ ...p,benefits:e.target.value }))} placeholder="Optional" /></div>
                        </div>
                        <button type="submit" className="btn btn-success" disabled={newAdLoading} style={{ width:'fit-content' }}>{newAdLoading?'Creating…':'Create Ad'}</button>
                      </form>
                    </details>
                    {sponsorAdsLoading ? <p style={{ color:'#9ca3af' }}>Loading ads…</p>
                      : sponsorAds.length===0 ? <p style={{ color:'#9ca3af', fontStyle:'italic' }}>No ads for this sponsor yet.</p>
                      : <div style={{ display:'grid', gap:10 }}>{sponsorAds.map(ad => (
                        <div key={ad.id} style={{ padding:'12px 16px', border:'1px solid var(--border)', borderRadius:8, background:'#f9fafb', display:'flex', justifyContent:'space-between', alignItems:'start', gap:12 }}>
                          <div style={{ flex:1 }}>
                            <p style={{ margin:'0 0 4px', fontWeight:600, fontSize:'0.9em' }}>{ad.title}</p>
                            <p style={{ margin:'0 0 4px', fontSize:'0.82em', color:'#6b7280' }}>{ad.description}</p>
                            {ad.requirements && <p style={{ margin:0, fontSize:'0.78em', color:'#9ca3af' }}>Req: {ad.requirements}</p>}
                            <p style={{ margin:'4px 0 0', fontSize:'0.75em', color:'#9ca3af' }}>Created {fmtDateShort(ad.created_at)}</p>
                          </div>
                          <button type="button" className="btn btn-danger" style={{ fontSize:'0.78em', padding:'3px 10px', flexShrink:0 }} onClick={() => deleteAd(ad.id)}>Delete</button>
                        </div>
                      ))}</div>}
                  </div>
                )}

                {/* Catalog */}
                {sponsorToolsTab === 'catalog' && (
                  <div>
                    {sponsorCatalogLoading ? <p style={{ color:'#9ca3af' }}>Loading catalog…</p>
                      : sponsorCatalog.length===0 ? <p style={{ color:'#9ca3af', fontStyle:'italic' }}>Catalog is empty.</p>
                      : <div className="table-wrap"><table className="table">
                        <thead><tr><th>Item</th><th className="text-right">Retail</th><th className="text-right">Points</th><th style={{ width:90 }}>Availability</th><th style={{ width:80 }}>Remove</th></tr></thead>
                        <tbody>{sponsorCatalog.map(item => (
                          <tr key={item.id}>
                            <td><div style={{ display:'flex', alignItems:'center', gap:10 }}>{item.image_url && <img src={item.image_url} alt="" style={{ width:40, height:40, objectFit:'contain', borderRadius:4 }} />}<span style={{ fontSize:'0.88em' }}>{item.title}</span></div></td>
                            <td className="text-right" style={{ fontSize:'0.85em' }}>${Number(item.price||0).toFixed(2)}</td>
                            <td className="text-right" style={{ fontWeight:600, color:'#2563eb' }}>{item.point_cost}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75em', padding: '3px 8px' }}
                                onClick={async () => {
                                  try {
                                    await api(`/sponsors/${selectedSponsorId}/catalog/${item.id}/availability`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ isAvailable: !item.is_available })
                                    })
                                    await loadSponsorCatalog(selectedSponsorId)
                                  } catch (e) { setSponsorToolsError(e?.message || 'Failed to update availability') }
                                }}
                              >
                                {item.is_available ? 'Disable' : 'Enable'}
                              </button>
                            </td>
                            <td><button type="button" className="btn btn-secondary" style={{ fontSize:'0.75em', padding:'3px 8px', color:'#dc2626', borderColor:'#dc2626' }} onClick={() => deleteCatalogItem(item.id)}>Remove</button></td>
                          </tr>
                        ))}</tbody>
                      </table></div>}
                  </div>
                )}

                {/* Analytics */}
                {sponsorToolsTab === 'analytics' && (
                  <div>
                    <button type="button" className="btn btn-primary" style={{ marginBottom:16 }} onClick={() => loadSponsorAnalytics(selectedSponsorId)}>Refresh</button>
                    {sponsorAnalyticsLoading ? <p style={{ color:'#9ca3af' }}>Loading…</p>
                      : !sponsorAnalytics ? <p style={{ color:'#9ca3af', fontStyle:'italic' }}>No data.</p>
                      : <>
                        <div className="stats-grid" style={{ marginBottom:16 }}>
                          <div className="stat-card"><p className="stat-label">Total Unredeemed</p><p className="stat-value stat-value-blue">{Number(sponsorAnalytics.totalUnredeemed||0).toLocaleString()}</p></div>
                          <div className="stat-card"><p className="stat-label">Awarded This Month</p><p className="stat-value stat-value-green">{Number(sponsorAnalytics.totalAwardedThisMonth||0).toLocaleString()}</p></div>
                          <div className="stat-card"><p className="stat-label">Redeemed This Month</p><p className="stat-value stat-value-amber">{Number(sponsorAnalytics.totalRedeemedThisMonth||0).toLocaleString()}</p></div>
                        </div>
                        {sponsorAnalytics.driverBreakdown?.length>0 && <div className="table-wrap"><table className="table"><thead><tr><th>Driver</th><th>Email</th><th className="text-right">Balance</th></tr></thead><tbody>{sponsorAnalytics.driverBreakdown.map((d,i) => <tr key={i}><td>{(d.driver_name||'').trim()||'—'}</td><td style={{ fontSize:'0.85em', color:'#6b7280' }}>{d.driver_email}</td><td className="text-right" style={{ fontWeight:600 }}>{Number(d.balance||0).toLocaleString()}</td></tr>)}</tbody></table></div>}
                      </>}
                  </div>
                )}
              </>
            ) : <p style={{ color:'#9ca3af', fontStyle:'italic', fontSize:'0.875em' }}>Select a sponsor org above to manage their ads, catalog, and analytics.</p>}
          </div>
        )}

        {/* ══ USER TOOLS ══ */}
        {activeTab === 'tools' && (
          <div style={cardStyle}>
            <section style={{ maxWidth:520 }}>
              <h2 className="section-title" style={{ marginTop:0 }}>Create Temporary Admin</h2>
              <p className="page-subtitle" style={{ marginBottom:16 }}>Account is automatically locked out after the expiry date.</p>
              <form onSubmit={handleCreateTempAdmin}>
                <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" required value={tempAdminForm.email} onChange={e => setTempAdminForm(p => ({ ...p,email:e.target.value }))} placeholder="temp-admin@example.com" /></div>
                <div className="form-group"><label className="form-label">Password (min 8 characters)</label><input type="password" className="form-input" required minLength={8} value={tempAdminForm.password} onChange={e => setTempAdminForm(p => ({ ...p,password:e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Display Name (optional)</label><input type="text" className="form-input" value={tempAdminForm.display_name} onChange={e => setTempAdminForm(p => ({ ...p,display_name:e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Access Expires On</label>
                  <input type="date" className="form-input" required min={new Date(Date.now()+86400000).toISOString().slice(0,10)} value={tempAdminForm.expires_at} onChange={e => setTempAdminForm(p => ({ ...p,expires_at:e.target.value }))} /></div>
                <button type="submit" className="btn btn-success" disabled={tempAdminLoading}>{tempAdminLoading?'Creating…':'Create Temp Admin'}</button>
              </form>
              {tempAdminResult && <div style={{ marginTop:16, padding:'12px 16px', borderRadius:8, background:'#f0fdf4', border:'1px solid #86efac' }}><p style={{ margin:0, fontWeight:700, color:'#166534', fontSize:'0.9em' }}>✓ Temp admin created</p><p style={{ margin:'4px 0 0', fontSize:'0.82em', color:'#374151' }}>User ID: <code>{tempAdminResult.userId}</code> · Expires: <strong>{tempAdminResult.expiresAt}</strong></p></div>}
            </section>

            <hr style={{ margin:'32px 0', border:'none', borderTop:'1px solid var(--border)' }} />

            <section style={{ maxWidth:520 }}>
              <h2 className="section-title" style={{ marginTop:0 }}>Inactive Accounts</h2>
              <p className="page-subtitle" style={{ marginBottom:12 }}>Deactivated users cannot log in. Hover the Inactive badge to see the reason.</p>
              {(() => {
                const inSp = sponsors.filter(s => s.is_active===0); const inDr = drivers.filter(d => d.is_active===0)
                if (!inSp.length && !inDr.length) return <p style={{ color:'#9ca3af', fontStyle:'italic', fontSize:'0.875em' }}>No inactive accounts.</p>
                return <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {inSp.length>0 && <div style={{ padding:'10px 16px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca' }}><p style={{ margin:0, fontWeight:700, color:'#991b1b', fontSize:'0.9em' }}>{inSp.length} inactive sponsor{inSp.length!==1?'s':''}</p>{inSp.map(s => <p key={s.id} style={{ margin:'3px 0 0', fontSize:'0.8em', color:'#374151' }}>{s.email}{s.deactivate_reason?` — ${s.deactivate_reason}`:''}</p>)}</div>}
                  {inDr.length>0 && <div style={{ padding:'10px 16px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca' }}><p style={{ margin:0, fontWeight:700, color:'#991b1b', fontSize:'0.9em' }}>{inDr.length} inactive driver{inDr.length!==1?'s':''}</p>{inDr.slice(0,5).map(d => <p key={d.id} style={{ margin:'3px 0 0', fontSize:'0.8em', color:'#374151' }}>{[d.first_name,d.last_name].filter(Boolean).join(' ')||d.email}{d.deactivate_reason?` — ${d.deactivate_reason}`:''}</p>)}{inDr.length>5 && <p style={{ margin:'3px 0 0', fontSize:'0.8em', color:'#9ca3af' }}>…and {inDr.length-5} more</p>}</div>}
                </div>
              })()}
            </section>
          </div>
        )}

      </main>

      {/* MODAL: Edit User */}
      {editUser && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth:480 }}>
            <h2 className="page-title" style={{ marginBottom:4 }}>Edit User</h2>
            <p className="page-subtitle" style={{ marginBottom:16 }}>ID: <code>{editUser.id}</code> · Current role: <strong>{editUser.role}</strong></p>
            <form onSubmit={handleEditUser}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div className="form-group"><label className="form-label">First Name</label><input type="text" className="form-input" value={editForm.first_name} onChange={e => setEditForm(p => ({ ...p,first_name:e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Last Name</label><input type="text" className="form-input" value={editForm.last_name} onChange={e => setEditForm(p => ({ ...p,last_name:e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" required value={editForm.email} onChange={e => setEditForm(p => ({ ...p,email:e.target.value }))} /></div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={editForm.role} onChange={e => setEditForm(p => ({ ...p,role:e.target.value }))}>
                  <option value="driver">Driver</option>
                  <option value="sponsor">Sponsor</option>
                  <option value="admin">Admin</option>
                </select>
                {editForm.role!==editUser.role && <p style={{ margin:'4px 0 0', fontSize:'0.78em', color:'#d97706' }}>⚠ Role change takes effect on their next login.</p>}
              </div>
              {error && <p className="form-footer" style={{ color:'crimson' }}>{error}</p>}
              <div className="modal-actions" style={{ marginTop:16 }}>
                <button type="submit" className="btn btn-success" disabled={editLoading}>{editLoading?'Saving…':'Save Changes'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setEditUser(null); setError('') }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Deactivate with Reason */}
      {deactivateTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth:440 }}>
            <h2 className="page-title" style={{ marginBottom:4 }}>Deactivate Account</h2>
            <p className="page-subtitle" style={{ marginBottom:16 }}><strong>{deactivateTarget.email}</strong> will be signed out and unable to log back in.</p>
            <div className="form-group">
              <label className="form-label">Reason for deactivation (optional)</label>
              <textarea className="form-input" rows={3} value={deactivateReason} onChange={e => setDeactivateReason(e.target.value)} placeholder="e.g. Violation of terms of service, account under review…" />
              <p style={{ margin:'4px 0 0', fontSize:'0.78em', color:'#6b7280' }}>Stored in the admin UI. The user is not notified.</p>
            </div>
            {error && <p className="form-footer" style={{ color:'crimson' }}>{error}</p>}
            <div className="modal-actions" style={{ marginTop:16 }}>
              <button type="button" className="btn btn-danger" onClick={handleDeactivate} disabled={deactivateLoading}>{deactivateLoading?'Deactivating…':'Deactivate Account'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setDeactivateTarget(null); setError('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create Sponsor */}
      {showCreateSponsor && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth:500 }}>
            <h2 className="page-title" style={{ marginBottom:4 }}>Create Sponsor Org</h2>
            <p className="page-subtitle" style={{ marginBottom:16 }}>Creates a new sponsor account with the given organization name.</p>
            <form onSubmit={handleCreateSponsor}>
              <div className="form-group"><label className="form-label">Organization Name <span style={{ color:'#dc2626' }}>*</span></label><input type="text" className="form-input" required value={createSponsorForm.company_name} onChange={e => setCreateSponsorForm(p => ({ ...p,company_name:e.target.value }))} placeholder="e.g. Acme Trucking Co." /></div>
              <div className="form-group"><label className="form-label">Email <span style={{ color:'#dc2626' }}>*</span></label><input type="email" className="form-input" required value={createSponsorForm.email} onChange={e => setCreateSponsorForm(p => ({ ...p,email:e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Password <span style={{ color:'#dc2626' }}>*</span></label><input type="password" className="form-input" required minLength={8} value={createSponsorForm.password} onChange={e => setCreateSponsorForm(p => ({ ...p,password:e.target.value }))} placeholder="Min 8 characters" /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div className="form-group"><label className="form-label">First Name</label><input type="text" className="form-input" value={createSponsorForm.first_name} onChange={e => setCreateSponsorForm(p => ({ ...p,first_name:e.target.value }))} placeholder="Optional" /></div>
                <div className="form-group"><label className="form-label">Last Name</label><input type="text" className="form-input" value={createSponsorForm.last_name} onChange={e => setCreateSponsorForm(p => ({ ...p,last_name:e.target.value }))} placeholder="Optional" /></div>
              </div>
              <div className="modal-actions" style={{ marginTop:16 }}>
                <button type="submit" className="btn btn-success" disabled={createSponsorLoading}>{createSponsorLoading?'Creating…':'Create Sponsor'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowCreateSponsor(false); setError('') }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Import */}
      {showBulkImport && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth:700 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:4 }}>
              <h2 className="page-title" style={{ marginBottom:0 }}>Bulk Import Drivers</h2>
              <button type="button" className="btn btn-secondary" style={{ fontSize:'0.8em', padding:'4px 10px' }} onClick={downloadBulkTemplate}>⬇ Template</button>
            </div>
            <p className="page-subtitle" style={{ marginBottom:16 }}>Required: <code>email</code>, <code>password</code>. Optional: <code>first_name</code>, <code>last_name</code>, <code>dob</code></p>
            {!bulkResults && <>
              <textarea value={bulkCsvText} onChange={e => { setBulkCsvText(e.target.value); setBulkPreview([]); setBulkParseError('') }} placeholder="email,password,first_name,last_name,dob&#10;john@example.com,password123,John,Doe,1990-01-15" rows={7} style={{ width:'100%', resize:'vertical', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.85em', fontFamily:'monospace', boxSizing:'border-box' }} />
              {bulkParseError && <p style={{ color:'#dc2626', fontSize:'0.85em', marginTop:6 }}>{bulkParseError}</p>}
              <button type="button" className="btn btn-primary" style={{ marginTop:10 }} onClick={parseBulkCsv} disabled={!bulkCsvText.trim()}>Preview ({Math.max(0, bulkCsvText.trim().split('\n').filter(Boolean).length-1)} rows)</button>
            </>}
            {bulkPreview.length>0 && !bulkResults && <div style={{ maxHeight:240, overflowY:'auto', border:'1px solid var(--border)', borderRadius:6, marginTop:12 }}>
              <table className="table" style={{ fontSize:'0.82em' }}><thead><tr><th>#</th><th>Email</th><th>First</th><th>Last</th><th>DOB</th><th>Password</th></tr></thead>
              <tbody>{bulkPreview.map((row,i) => <tr key={i} style={{ background: !row.email||!row.password?'#fef2f2':undefined }}><td>{i+1}</td><td>{row.email||<em style={{ color:'#dc2626' }}>missing</em>}</td><td>{row.first_name||'—'}</td><td>{row.last_name||'—'}</td><td>{row.dob||'—'}</td><td>{row.password?'••••••••':<em style={{ color:'#dc2626' }}>missing</em>}</td></tr>)}</tbody>
              </table>
            </div>}
            {bulkResults && <div style={{ marginTop:14 }}>
              <p style={{ fontWeight:700, fontSize:'0.9em', color: bulkResults.failCount>0?'#92400e':'#166534' }}>{bulkResults.successCount} created · {bulkResults.failCount} failed</p>
              <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid var(--border)', borderRadius:6, marginTop:8 }}>
                <table className="table" style={{ fontSize:'0.82em' }}><thead><tr><th>Email</th><th>Result</th></tr></thead><tbody>{bulkResults.results.map((r,i) => <tr key={i}><td>{r.email}</td><td style={{ color: r.ok?'#16a34a':'#dc2626', fontWeight:600 }}>{r.ok?`✓ Created (ID ${r.userId})`:`✕ ${r.error}`}</td></tr>)}</tbody></table>
              </div>
            </div>}
            <div className="modal-actions" style={{ marginTop:16 }}>
              {bulkPreview.length>0 && !bulkResults && <button type="button" className="btn btn-success" onClick={submitBulkImport} disabled={bulkImporting}>{bulkImporting?'Importing…':`Import ${bulkPreview.length} Drivers`}</button>}
              <button type="button" className="btn btn-ghost" onClick={() => { setShowBulkImport(false); setBulkCsvText(''); setBulkPreview([]); setBulkResults(null); setBulkParseError('') }}>{bulkResults?'Close':'Cancel'}</button>
            </div>
          </div>
        </div>
      )}

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

  // ============ DRIVER SHOP PAGE ============
  const DriverShopPage = () => {
    const [items, setItems] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [availableOnly, setAvailableOnly] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [cartMsg, setCartMsg] = useState('')

    const fetchCategories = async () => {
      try {
        const data = await api('/catalog/categories', { method: 'GET' })
        setCategories(Array.isArray(data?.categories) ? data.categories : [])
      } catch {
        // non-critical - filter just won't have options
      }
    }

    const fetchItems = async (s, cat, avail) => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (s) params.set('search', s)
        if (cat) params.set('category', cat)
        if (avail) params.set('available', '1')
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await api(`/catalog${qs}`, { method: 'GET' })
        setItems(Array.isArray(data?.items) ? data.items : [])
      } catch (e) {
        setError(e?.message || 'Failed to load shop items.')
      } finally {
        setLoading(false)
      }
    }

    useEffect(() => {
      fetchCategories()
      fetchItems('', '', false)
    }, [])

    const handleSearchChange = (e) => {
      const val = e.target.value
      setSearch(val)
      fetchItems(val, selectedCategory, availableOnly)
    }

    const handleCategoryChange = (e) => {
      const val = e.target.value
      setSelectedCategory(val)
      fetchItems(search, val, availableOnly)
    }

    const handleAvailableToggle = (e) => {
      const val = e.target.checked
      setAvailableOnly(val)
      fetchItems(search, selectedCategory, val)
    }

    const openDetail = async (item) => {
      setSelectedItem(item)
      setCartMsg('')
      try {
        const data = await api(`/catalog/${item.id}`, { method: 'GET' })
        if (data?.item) setSelectedItem(data.item)
      } catch {
        // keep the card-level data already set
      }
    }

    const handleAddToCart = (item) => {
      addToCart(item)
      setCartMsg(`Added to cart: ${item.title}`)
    }

    const driverPoints = Number(currentUser?.points ?? 0)

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Shop</h1>
          <p className="page-subtitle">
            Your balance: <strong>{driverPoints} pts</strong>
          </p>

          {/* -- Filters -- */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ flex: '1 1 200px', minWidth: 160 }}
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={handleSearchChange}
            />
            <select
              className="form-input"
              style={{ flex: '0 1 180px' }}
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875em', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={availableOnly} onChange={handleAvailableToggle} />
              Available only
            </label>
          </div>

          {/* -- Detail panel -- */}
          {selectedItem && (
            <div className="card" style={{ marginBottom: 24, position: 'relative' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ position: 'absolute', top: 16, right: 16, fontSize: '0.8em' }}
                onClick={() => setSelectedItem(null)}
              >
                Close
              </button>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {selectedItem.image_url && (
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.title}
                    style={{ width: 180, height: 180, objectFit: 'contain', borderRadius: 8, background: '#f9fafb', flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>{selectedItem.title}</h2>
                  {selectedItem.category && (
                    <span style={{ fontSize: '0.75em', background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '2px 8px', marginBottom: 8, display: 'inline-block' }}>
                      {selectedItem.category}
                    </span>
                  )}
                  <p style={{ color: '#6b7280', margin: '8px 0' }}>
                    {selectedItem.description || 'No description available.'}
                  </p>
                  <p style={{ fontWeight: 700, fontSize: '1.1em', margin: '8px 0' }}>
                    {Number(selectedItem.point_cost || 0)} pts
                  </p>
                  {!selectedItem.is_available && (
                    <p style={{ color: '#dc2626', fontWeight: 600 }}>Currently unavailable</p>
                  )}
                  {selectedItem.is_available && Number(selectedItem.point_cost || 0) > driverPoints && (
                    <p style={{ color: '#d97706' }}>
                      You need <strong>{Number(selectedItem.point_cost || 0) - driverPoints}</strong> more points to redeem this item.
                    </p>
                  )}
                  {selectedItem.is_available && Number(selectedItem.point_cost || 0) <= driverPoints && Number(selectedItem.point_cost || 0) > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn btn-success"
                        onClick={() => handleAddToCart(selectedItem)}
                      >
                        Add to cart
                      </button>
                      {cartMsg && (
                        <p style={{ color: '#059669', fontWeight: 600, marginTop: 8 }}>{cartMsg}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* -- Item grid -- */}
          {loading ? (
            <p className="activity-empty">Loading shop items...</p>
          ) : error ? (
            <p style={{ color: 'crimson' }}>Could not load shop: {error}</p>
          ) : items.length === 0 ? (
            <p className="activity-empty">No items match your filters, or your sponsor's catalog is empty.</p>
          ) : (
            <div className="rewards-grid">
              {items.map(item => {
                const pointCost = Number(item.point_cost || 0)
                const canAfford = driverPoints >= pointCost && pointCost > 0
                const pointsNeeded = pointCost - driverPoints

                return (
                  <div
                    key={item.id}
                    className="reward-card"
                    style={{ cursor: 'pointer', opacity: item.is_available ? 1 : 0.55 }}
                    onClick={() => openDetail(item)}
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        style={{ width: '100%', height: 140, objectFit: 'contain', background: '#f9fafb', borderRadius: 6, marginBottom: 8 }}
                      />
                    )}
                    {item.category && (
                      <span style={{ fontSize: '0.7em', background: '#e0f2fe', color: '#0369a1', borderRadius: 3, padding: '1px 6px', marginBottom: 4, display: 'inline-block' }}>
                        {item.category}
                      </span>
                    )}
                    <h3 className="reward-title">{item.title}</h3>
                    <p className="reward-pts">{pointCost} pts</p>
                    {!item.is_available && (
                      <p style={{ fontSize: '0.8em', color: '#dc2626', marginTop: 4 }}>Unavailable</p>
                    )}
                    {item.is_available && !canAfford && pointsNeeded > 0 && (
                      <p style={{ fontSize: '0.8em', color: '#d97706', marginTop: 4 }}>{pointsNeeded} more pts needed</p>
                    )}
                    {item.is_available && canAfford && (
                      <p style={{ fontSize: '0.8em', color: '#059669', marginTop: 4 }}>Affordable ✓</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    )
  }

  // ============ CART PAGE (driver) ============
  const CartPage = () => {
    const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
    const isDriver = role === 'driver'
    const [checkoutLoading, setCheckoutLoading] = React.useState(false)
    const [checkoutError, setCheckoutError] = React.useState('')
    const totalItems = cart.reduce((sum, x) => sum + Number(x.qty || 1), 0)
    const totalPoints = cart.reduce((sum, x) => sum + (Number(x.point_cost || 0) * Number(x.qty || 1)), 0)
    const balance = Number(currentUser?.points ?? 0)
    const pointsRemaining = balance - totalPoints
    const hasUnavailable = cart.some((x) => x.is_available === 0 || x.is_available === false)
    const canCheckout = !hasUnavailable && totalPoints > 0 && balance >= totalPoints
    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Cart</h1>
          <p className="page-subtitle">Items you plan to redeem.</p>

          {!isDriver ? (
            <div className="card"><p className="activity-empty">Cart is available for drivers only.</p></div>
          ) : cart.length === 0 ? (
            <div className="card"><p className="activity-empty">Your cart is empty.</p></div>
          ) : (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>Cart summary</p>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  {totalItems} item(s) · <strong>{totalPoints.toLocaleString()}</strong> pts total
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div className="cart-pill">
                  Balance: <strong>{balance.toLocaleString()}</strong> pts
                </div>
                <div className="cart-pill">
                  Remaining after checkout:{' '}
                  <strong style={{ color: pointsRemaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {pointsRemaining.toLocaleString()}
                  </strong>{' '}
                  pts
                </div>
                {hasUnavailable && (
                  <div className="cart-pill" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                    Some items are unavailable
                  </div>
                )}
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="text-right">Points</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Subtotal</th>
                      <th style={{ width: 110 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((x) => (
                      <tr key={String(x.id)} style={{ opacity: (x.is_available === 0 || x.is_available === false) ? 0.6 : 1 }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {x.image_url ? (
                              <img src={x.image_url} alt={x.title} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, background: '#f9fafb' }} />
                            ) : null}
                            <div style={{ lineHeight: 1.25 }}>
                              <strong style={{ fontSize: '0.9em' }}>{x.title}</strong>
                              <div style={{ fontSize: '0.8em', color: '#6b7280' }}>#{x.id}</div>
                              {(x.is_available === 0 || x.is_available === false) && (
                                <div style={{ fontSize: '0.8em', color: 'var(--danger)', marginTop: 2 }}>Unavailable</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-right">{Number(x.point_cost || 0).toLocaleString()}</td>
                        <td className="text-right">
                          <div className="cart-qty">
                            <button type="button" className="btn btn-ghost" onClick={() => decrementCartQty(x.id)} aria-label="Decrease quantity">−</button>
                            <input
                              className="form-input"
                              style={{ width: 64, textAlign: 'center' }}
                              type="number"
                              min={1}
                              max={99}
                              value={Number(x.qty || 1)}
                              onChange={(e) => setCartQty(x.id, e.target.value)}
                            />
                            <button type="button" className="btn btn-ghost" onClick={() => incrementCartQty(x.id)} aria-label="Increase quantity">+</button>
                          </div>
                        </td>
                        <td className="text-right">{(Number(x.point_cost || 0) * Number(x.qty || 1)).toLocaleString()}</td>
                        <td>
                          <button type="button" className="btn btn-secondary" style={{ color:'#dc2626', borderColor:'#dc2626' }} onClick={() => removeFromCart(x.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    if (!window.confirm('Clear all items from your cart?')) return
                    clearCart()
                  }}
                >
                  Clear cart
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={!canCheckout || checkoutLoading}
                  title={
                    hasUnavailable
                      ? 'Remove unavailable items before checkout.'
                      : totalPoints <= 0
                        ? 'Cart total must be greater than 0.'
                        : balance < totalPoints
                          ? 'You do not have enough points for this cart.'
                          : 'Place your order.'
                  }
                  onClick={async () => {
                    setCheckoutLoading(true)
                    setCheckoutError('')
                    try {
                      const result = await api('/orders', { method: 'POST' })
                      setLastOrder(result.order)
                      clearCart()
                      setCurrentPage('order-confirmation')
                    } catch (err) {
                      setCheckoutError(err?.message || 'Checkout failed. Please try again.')
                    } finally {
                      setCheckoutLoading(false)
                    }
                  }}
                >
                  {checkoutLoading ? 'Placing order...' : 'Checkout'}
                </button>
              </div>
              {checkoutError && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{checkoutError}</p>}
            </div>
          )}
        </main>
      </div>
    )
  }

  const OrderConfirmationPage = () => {
    const order = lastOrder

    if (!order) {
      return (
        <div>
          <Navigation />
          <main className="app-main">
            <h1 className="page-title">Order Confirmed</h1>
            <div className="card">
              <p>No order data available.</p>
              <button className="btn btn-primary" onClick={() => setCurrentPage('order-history')}>
                View Order History
              </button>
            </div>
          </main>
        </div>
      )
    }

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Order Placed</h1>
          <div className="card">
            <p><strong>Confirmation #:</strong> {order.confirmation_number}</p>
            <p><strong>Status:</strong> {order.status}</p>
            <p><strong>Total Points:</strong> {Number(order.total_points).toLocaleString()}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
              Points will be deducted when the sponsor marks your order as delivered.
            </p>
            <table className="table">
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Points</th></tr>
              </thead>
              <tbody>
                {(order.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_title_snapshot}</td>
                    <td>{item.qty}</td>
                    <td>{(item.points_cost_snapshot * item.qty).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setCurrentPage('order-history')}>
                View Order History
              </button>
              <button className="btn btn-ghost" onClick={() => setCurrentPage('shop')}>
                Continue Shopping
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const OrderHistoryPage = () => {
    const [orders, setOrders] = React.useState([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState('')
    const [statusFilter, setStatusFilter] = React.useState('all')
    const STATUS_TABS = ['all', 'pending', 'confirmed', 'delivered', 'cancelled']
    const STATUS_COLORS = { pending: '#d97706', confirmed: '#2563eb', delivered: '#16a34a', cancelled: '#dc2626' }

    React.useEffect(() => {
      let cancelled = false

      const fetchOrders = async () => {
        setLoading(true)
        setError('')
        try {
          const params = new URLSearchParams()
          if (statusFilter !== 'all') params.set('status', statusFilter)
          const data = await api(`/orders?${params.toString()}`, { method: 'GET' })
          if (!cancelled) setOrders(data.orders || [])
        } catch (e) {
          if (!cancelled) setError(e?.message || 'Failed to load orders')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      fetchOrders()
      return () => { cancelled = true }
    }, [statusFilter])

    const handleExportAll = () => {
      window.open(`${apiBase}/orders/export`, '_blank')
    }

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="page-title">Order History</h1>
            <button className="btn btn-ghost" onClick={handleExportAll}>Export All (PDF)</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setStatusFilter(s)}
                style={{ textTransform: 'capitalize' }}
              >
                {s}
              </button>
            ))}
          </div>

          {loading ? <p>Loading...</p> : error ? (
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          ) : orders.length === 0 ? (
            <div className="card"><p className="activity-empty">No orders found.</p></div>
          ) : (
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Confirmation #</th><th>Date</th><th>Status</th><th>Points</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.confirmation_number}</td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>
                        <span style={{ color: STATUS_COLORS[o.status] || '#374151', fontWeight: 600, textTransform: 'capitalize' }}>
                          {o.status}
                        </span>
                      </td>
                      <td>{Number(o.total_points).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-ghost" onClick={() => { setOrderToView(o.id); setCurrentPage('order-detail') }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    )
  }

  const OrderDetailPage = () => {
    const [order, setOrder] = React.useState(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState('')
    const [cancelLoading, setCancelLoading] = React.useState(false)
    const [cancelError, setCancelError] = React.useState('')
    const STATUS_COLORS = { pending: '#d97706', confirmed: '#2563eb', delivered: '#16a34a', cancelled: '#dc2626' }

    React.useEffect(() => {
      if (!orderToView) {
        setLoading(false)
        return
      }

      let cancelled = false
      const fetchOrder = async () => {
        setLoading(true)
        setError('')
        try {
          const data = await api(`/orders/${orderToView}`, { method: 'GET' })
          if (!cancelled) setOrder(data.order)
        } catch (e) {
          if (!cancelled) setError(e?.message || 'Failed to load order')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      fetchOrder()
      return () => { cancelled = true }
    }, [orderToView])

    const handleCancel = async () => {
      if (!window.confirm('Cancel this order?')) return
      setCancelLoading(true)
      setCancelError('')
      try {
        const data = await api(`/orders/${order.id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Cancelled by driver' })
        })
        setOrder(data.order)
      } catch (e) {
        setCancelError(e?.message || 'Failed to cancel order')
      } finally {
        setCancelLoading(false)
      }
    }

    const handleExport = () => {
      window.open(`${apiBase}/orders/${order?.id}/export`, '_blank')
    }

    if (loading) return <div><Navigation /><main className="app-main"><p>Loading...</p></main></div>
    if (error) return <div><Navigation /><main className="app-main"><p style={{ color: 'var(--danger)' }}>{error}</p></main></div>
    if (!order) return <div><Navigation /><main className="app-main"><p>Order not found.</p></main></div>

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="page-title">Order {order.confirmation_number}</h1>
            <button className="btn btn-ghost" onClick={handleExport}>Export Receipt (PDF)</button>
          </div>
          <div className="card">
            <p><strong>Status:</strong>{' '}<span style={{ color: STATUS_COLORS[order.status], fontWeight: 600, textTransform: 'capitalize' }}>{order.status}</span></p>
            <p><strong>Placed:</strong> {new Date(order.created_at).toLocaleString()}</p>
            {order.confirmed_at && <p><strong>Confirmed:</strong> {new Date(order.confirmed_at).toLocaleString()}</p>}
            {order.status === 'cancelled' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', margin: '8px 0' }}>
                <strong style={{ color: '#dc2626' }}>Cancelled</strong>
                {order.cancellation_reason && <p style={{ margin: '4px 0 0', color: '#dc2626' }}>Reason: {order.cancellation_reason}</p>}
                {order.cancelled_at && <p style={{ margin: '2px 0 0', fontSize: '0.8em', color: '#6b7280' }}>{new Date(order.cancelled_at).toLocaleString()}</p>}
              </div>
            )}
            <p><strong>Total Points:</strong> {Number(order.total_points).toLocaleString()}</p>
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <p style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>Points will be deducted when sponsor marks order delivered.</p>
            )}
            <table className="table" style={{ marginTop: 12 }}>
              <thead><tr><th>Item</th><th>Qty</th><th>Points each</th><th>Subtotal</th></tr></thead>
              <tbody>
                {(order.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_title_snapshot}</td>
                    <td>{item.qty}</td>
                    <td>{Number(item.points_cost_snapshot).toLocaleString()}</td>
                    <td>{(item.points_cost_snapshot * item.qty).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => setCurrentPage('order-history')}>Back to History</button>
              {order.status === 'pending' && (
                <button
                  className="btn btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#dc2626' }}
                  disabled={cancelLoading}
                  onClick={handleCancel}
                >
                  {cancelLoading ? 'Cancelling...' : 'Cancel Order'}
                </button>
              )}
            </div>
            {cancelError && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{cancelError}</p>}
          </div>
        </main>
      </div>
    )
  }

  const SponsorPreviewPage = () => {
    const [items, setItems] = React.useState([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState('')

    React.useEffect(() => {
      let cancelled = false
      const fetchPreview = async () => {
        setLoading(true)
        setError('')
        try {
          const data = await api('/preview-catalog', { method: 'GET' })
          if (!cancelled) setItems(data.items || [])
        } catch (e) {
          if (!cancelled) setError(e?.message || 'Failed to load preview')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      fetchPreview()
      return () => { cancelled = true }
    }, [])

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Catalog Preview</h1>
          <p className="page-subtitle">This is how your catalog appears to affiliated drivers (read-only).</p>
          {loading ? <p>Loading...</p> : error ? (
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          ) : items.length === 0 ? (
            <div className="card"><p className="activity-empty">No available items found.</p></div>
          ) : (
            <div className="card">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 16 }}>
                {items.map((item) => (
                  <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        style={{ width: '100%', height: 120, objectFit: 'contain' }}
                      />
                    )}
                    <p style={{ fontWeight: 600, margin: '8px 0 4px' }}>{item.title}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                      {Number(item.point_cost).toLocaleString()} pts
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ============ REWARDS PAGE ============
  const RewardsPage = () => {
    const [rewardItems, setRewardItems] = useState([])
    const [rewardsLoading, setRewardsLoading] = useState(true)
    const [rewardsError, setRewardsError] = useState('')

    useEffect(() => {
      let cancelled = false

      const fetchRewards = async () => {
        setRewardsLoading(true)
        setRewardsError('')

        try {
          const res = await api('/catalog', { method: 'GET' })
          if (!cancelled) {
            setRewardItems(res.items || [])
          }
        } catch (err) {
          if (!cancelled) {
            setRewardItems([])
            setRewardsError(err.message || 'Could not load rewards.')
          }
        } finally {
          if (!cancelled) {
            setRewardsLoading(false)
          }
        }
      }

      fetchRewards()

      return () => {
        cancelled = true
      }
    }, [])

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Rewards</h1>
          <p className="page-subtitle">Your balance: <strong>{currentUser?.points ?? 0} points</strong></p>
          <div className="rewards-grid">
            {rewardsLoading ? (
              <p className="activity-empty">Loading rewards…</p>
            ) : rewardsError ? (
              <p style={{ color: 'crimson' }}>Could not load rewards: {rewardsError}</p>
            ) : rewardItems.length === 0 ? (
              <p className="activity-empty">No rewards are available in your sponsor catalog yet.</p>
            ) : (
              rewardItems.map(item => {
                const pointCost = Number(item.point_cost || 0)
                const canRedeem = Number(currentUser?.points || 0) >= pointCost && pointCost > 0

                return (
                  <div key={item.id} className="reward-card">
                    <h3 className="reward-title">{item.title}</h3>
                    <p className="reward-pts">{pointCost} pts</p>
                    <p style={{ marginBottom: 12, color: '#6b7280' }}>
                      {item.description || 'No description available.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled
                      title={canRedeem ? 'Reward redemption endpoint is not implemented yet.' : 'You need more points to redeem this item.'}
                    >
                      {canRedeem ? 'Redeem Coming Soon' : 'Not Enough Points'}
                    </button>
                  </div>
                )
              })
            )}
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
          <div className="card">
            <p className="activity-empty">Leaderboard data is not available yet because there is no leaderboard API endpoint in the backend.</p>
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
          <div className="card">
            <p className="activity-empty">Achievements are not available yet because there is no achievements API endpoint in the backend.</p>
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
    const [shopLoading, setShopLoading] = useState(true)
    const [shopError, setShopError] = useState('')
    const [searching, setSearching] = useState(false)
    const [catalogError, setCatalogError] = useState('')
    // '' = no search yet, otherwise = the search term used
    const [resultsLabel, setResultsLabel] = useState('')
    const [sponsorRate, setSponsorRate] = useState(null)
    const [rateLoading, setRateLoading] = useState(true)

    const formatPrice = (value) => {
      const n = Number(value)
      if (!Number.isFinite(n)) return '-'
      return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const fetchShopItems = async () => {
      setShopLoading(true)
      setShopError('')
      try {
        const res = await api('/catalog', { method: 'GET' })
        setShopItems(res.items || [])
      } catch (err) {
        console.error(err)
        setShopItems([])
        setShopError(err.message || 'Could not load your catalog.')
      } finally {
        setShopLoading(false)
      }
    }

    const loadSponsorRate = async () => {
      setRateLoading(true)
      try {
        const data = await api('/conversion-rate', { method: 'GET' })
        setSponsorRate(data?.rate || null)
      } catch {
        setSponsorRate(null)
      } finally {
        setRateLoading(false)
      }
    }

    useEffect(() => {
      fetchShopItems()
      loadSponsorRate()
    }, [])

    const handleSearch = async (e) => {
      e.preventDefault()
      const trimmedQuery = searchQuery.trim()
      if (!trimmedQuery) return
      setSearching(true)
      setCatalogError('')
      try {
        const res = await api(`/fakestore/search?q=${encodeURIComponent(trimmedQuery)}`, { method: 'GET' })
        setSearchResults(res.items || [])
        setResultsLabel(trimmedQuery)
      } catch (err) {
        console.error('Product search failed', err)
        setSearchResults([])
        setResultsLabel(trimmedQuery)
        setCatalogError(err.message || 'Search failed.')
      } finally {
        setSearching(false)
      }
    }

    const handleAddToShop = async (item) => {
      if (shopItems.some(shopItem => String(shopItem.external_item_id) === String(item.itemId))) {
        alert('This item is already in your catalog.')
        return
      }

      const itemPrice = parseFloat(item.price?.value || 0)
      if (!itemPrice || itemPrice <= 0) {
        alert('This item has no price. Only priced items can be added automatically.')
        return
      }

      try {
        await api('/catalog', {
          method: 'POST',
          body: JSON.stringify({
            itemId: item.itemId,
            title: item.title,
            description: item.description,
            imageUrl: item.image,
            price: itemPrice,
            category: item.category || null,
          })
        })
        fetchShopItems()
        alert('Added to shop!')
      } catch (err) {
        console.error('Failed to add to shop', err)
        alert(err.message || 'Failed to add item to shop.')
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

          {!rateLoading && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: sponsorRate ? '#f0fdf4' : '#fef3c7', border: `1px solid ${sponsorRate ? '#86efac' : '#fcd34d'}` }}>
              {sponsorRate
                ? <p style={{ margin: 0, fontSize: '0.875em', color: '#166534' }}>Points are computed automatically: <strong>${Number(sponsorRate.dollars_per_point).toFixed(4)} per point</strong>. Retail price ÷ this rate, rounded up.</p>
                : <p style={{ margin: 0, fontSize: '0.875em', color: '#92400e' }}>⚠ No conversion rate set. Set one before adding items.</p>
              }
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8em', padding: '4px 12px', whiteSpace: 'nowrap' }}
                onClick={() => { setPointMgmtInitialTab('conversion'); setCurrentPage('point-management') }}
              >
                {sponsorRate ? 'Change Rate' : 'Set Rate Now'}
              </button>
            </div>
          )}

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

              {resultsLabel !== '' && (
                <p className="page-subtitle" style={{ marginTop: 0, marginBottom: 8 }}>
                  Results for <strong>"{resultsLabel}"</strong>
                </p>
              )}

              {catalogError && (
                <p style={{ color: 'crimson', marginTop: 0, marginBottom: 12 }}>
                  Could not load catalog products: {catalogError}
                </p>
              )}

              <div className="landing-grid catalog-grid">
                {resultsLabel === '' && !catalogError ? (
                  <p className="activity-empty">Search above to find products to add.</p>
                ) : !catalogError && searchResults.length === 0 ? (
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
                Items currently available for drivers to redeem with their points.
              </p>

              {shopError && (
                <p style={{ color: 'crimson', marginTop: 0, marginBottom: 12 }}>
                  Could not load your catalog: {shopError}
                </p>
              )}

              <div className="landing-grid catalog-grid">
                {shopLoading ? (
                  <p className="activity-empty">Loading your catalog…</p>
                ) : shopItems.length === 0 ? (
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
                        <span className="catalog-item-retail">Retail: ${formatPrice(item.price)}</span>
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
            <h1 className="page-title" style={{ marginBottom: 8 }}>SafeMiles</h1>
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
                { label: 'App', value: 'SafeMiles v1.0' },
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


  // ─── NotificationsPage ──────────────────────────────────────────────────────
  const NotificationsPage = () => {
    const role = ((currentUser?.role || inferRoleFromBase(apiBase) || 'driver') + '').toLowerCase().trim()
    const [activeTab, setActiveTab] = useState('history')
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [preferences, setPreferences] = useState([])
    const [muteSettings, setMuteSettings] = useState({ muted_until: null, quiet_start: null, quiet_end: null })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterRead, setFilterRead] = useState('')
    const [filterFrom, setFilterFrom] = useState('')
    const [filterTo, setFilterTo] = useState('')

    // Admin announcement form
    const [announceTitle, setAnnounceTitle] = useState('')
    const [announceBody, setAnnounceBody] = useState('')
    const [announceType, setAnnounceType] = useState('system_announcement')
    const [announceTarget, setAnnounceTarget] = useState('all')

    // Sponsor announcement form
    const [sponsorAnnounceTitle, setSponsorAnnounceTitle] = useState('')
    const [sponsorAnnounceBody, setSponsorAnnounceBody] = useState('')
    const [sponsorAnnounceType, setSponsorAnnounceType] = useState('sponsor_announcement')

    const notifTypes = role === 'driver'
      ? ['points_added', 'points_deducted', 'order_placed', 'order_shipped', 'order_delivered',
         'sponsor_dropped', 'sponsor_announcement', 'program_rules_update', 'congratulations',
         'new_catalog_item', 'wishlist_sale', 'point_milestone', 'system_announcement', 'system_maintenance']
      : role === 'sponsor'
        ? ['system_announcement', 'system_maintenance', 'sponsor_announcement']
        : ['system_announcement', 'system_maintenance', 'critical_error']

    const fetchNotifications = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filterType) params.set('type', filterType)
        if (filterRead) params.set('read', filterRead)
        if (filterFrom) params.set('from', filterFrom)
        if (filterTo) params.set('to', filterTo)
        params.set('limit', '100')
        const data = await api(`/notifications?${params}`)
        setNotifications(data.notifications || [])
      } catch (e) { setError(e.message) }
      setLoading(false)
    }

    const fetchUnread = async () => {
      try {
        const data = await api('/notifications/unread-count')
        setUnreadCount(data.count || 0)
      } catch { /* ignore */ }
    }

    const fetchPreferences = async () => {
      try {
        const data = await api('/notifications/preferences')
        setPreferences(data.preferences || [])
      } catch { /* ignore */ }
    }

    const fetchMute = async () => {
      try {
        const data = await api('/notifications/mute')
        setMuteSettings(data || { muted_until: null, quiet_start: null, quiet_end: null })
      } catch { /* ignore */ }
    }

    useEffect(() => {
      fetchNotifications()
      fetchUnread()
      fetchPreferences()
      fetchMute()
    }, [])

    const markRead = async (id) => {
      try {
        await api(`/notifications/${id}/read`, { method: 'PUT' })
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch (e) { setError(e.message) }
    }

    const markAllRead = async () => {
      try {
        await api('/notifications/read-all', { method: 'PUT' })
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
        setUnreadCount(0)
        setSuccess('All notifications marked as read.')
      } catch (e) { setError(e.message) }
    }

    const deleteNotification = async (id) => {
      try {
        await api(`/notifications/${id}`, { method: 'DELETE' })
        setNotifications(prev => prev.filter(n => n.id !== id))
        setSuccess('Notification deleted.')
      } catch (e) { setError(e.message) }
    }

    const deleteOld = async () => {
      try {
        const data = await api('/notifications/old?days=30', { method: 'DELETE' })
        setSuccess(`Deleted ${data.deleted || 0} old notifications.`)
        fetchNotifications()
      } catch (e) { setError(e.message) }
    }

    const togglePreference = async (type, current) => {
      try {
        await api('/notifications/preferences', { method: 'PUT', body: JSON.stringify({ type, enabled: !current }) })
        setPreferences(prev => {
          const existing = prev.find(p => p.notif_type === type)
          if (existing) return prev.map(p => p.notif_type === type ? { ...p, is_enabled: !current ? 1 : 0 } : p)
          return [...prev, { notif_type: type, is_enabled: !current ? 1 : 0 }]
        })
        setSuccess(`Preference updated for ${type.replace(/_/g, ' ')}.`)
      } catch (e) { setError(e.message) }
    }

    const saveMute = async (updates) => {
      const newSettings = { ...muteSettings, ...updates }
      try {
        await api('/notifications/mute', { method: 'PUT', body: JSON.stringify(newSettings) })
        setMuteSettings(newSettings)
        setSuccess('Mute settings updated.')
      } catch (e) { setError(e.message) }
    }

    const sendAdminAnnouncement = async (e) => {
      e.preventDefault()
      setError(''); setSuccess('')
      try {
        const data = await api('/notifications/announce', {
          method: 'POST',
          body: JSON.stringify({ title: announceTitle, body: announceBody || undefined, type: announceType, target_role: announceTarget })
        })
        setSuccess(`Announcement sent to ${data.notified} of ${data.total_users} users.`)
        setAnnounceTitle(''); setAnnounceBody('')
      } catch (e) { setError(e.message) }
    }

    const sendSponsorAnnouncement = async (e) => {
      e.preventDefault()
      setError(''); setSuccess('')
      try {
        const data = await api('/notifications/announce', {
          method: 'POST',
          body: JSON.stringify({ title: sponsorAnnounceTitle, body: sponsorAnnounceBody || undefined, type: sponsorAnnounceType })
        })
        setSuccess(`Announcement sent to ${data.notified} of ${data.total_drivers} drivers.`)
        setSponsorAnnounceTitle(''); setSponsorAnnounceBody('')
      } catch (e) { setError(e.message) }
    }

    const isEnabled = (type) => {
      const pref = preferences.find(p => p.notif_type === type)
      return pref ? Boolean(pref.is_enabled) : true
    }

    const isMuted = muteSettings.muted_until && new Date(muteSettings.muted_until) > new Date()

    const tabStyle = (tab) => ({
      padding: '8px 16px', border: 'none', borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
      background: 'none', color: activeTab === tab ? '#2563eb' : '#6b7280', fontWeight: activeTab === tab ? 700 : 500,
      cursor: 'pointer', fontSize: '0.85em'
    })

    const tabs = ['history', 'preferences']
    if (role === 'driver') tabs.push('mute')
    if (role === 'admin') tabs.push('announce')
    if (role === 'sponsor') tabs.push('announce')

    return (
      <div>
        <Navigation />
        <main className="app-main" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Notifications</h1>
            {unreadCount > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: '0.8em', fontWeight: 700 }}>
                {unreadCount} unread
              </span>
            )}
          </div>

          {error && <div className="status-msg error" style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div className="status-msg success" style={{ marginBottom: 12 }}>{success}</div>}
          {isMuted && <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: '0.85em' }}>Notifications muted until {new Date(muteSettings.muted_until).toLocaleString()}</div>}

          <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 16, display: 'flex', gap: 4 }}>
            {tabs.map(t => <button key={t} type="button" style={tabStyle(t)} onClick={() => setActiveTab(t)}>{t === 'history' ? `History (${notifications.length})` : t === 'preferences' ? 'Preferences' : t === 'mute' ? 'Mute / Quiet Hours' : 'Announcements'}</button>)}
          </div>

          {/* ─── HISTORY TAB ────────────────────────────────── */}
          {activeTab === 'history' && (
            <div>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <select className="form-input" style={{ width: 'auto', fontSize: '0.8em' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All types</option>
                  {notifTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <select className="form-input" style={{ width: 'auto', fontSize: '0.8em' }} value={filterRead} onChange={e => setFilterRead(e.target.value)}>
                  <option value="">All</option>
                  <option value="0">Unread</option>
                  <option value="1">Read</option>
                </select>
                <input type="date" className="form-input" style={{ width: 'auto', fontSize: '0.8em' }} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="From" />
                <input type="date" className="form-input" style={{ width: 'auto', fontSize: '0.8em' }} value={filterTo} onChange={e => setFilterTo(e.target.value)} placeholder="To" />
                <button type="button" className="btn btn-primary" style={{ fontSize: '0.8em' }} onClick={fetchNotifications}>Filter</button>
                {unreadCount > 0 && <button type="button" className="btn" style={{ fontSize: '0.8em' }} onClick={markAllRead}>Mark all read</button>}
                <button type="button" className="btn" style={{ fontSize: '0.8em', color: '#dc2626' }} onClick={deleteOld}>Delete old (30d+)</button>
              </div>

              {loading ? <p>Loading...</p> : notifications.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>No notifications yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notifications.map(n => (
                    <div key={n.id} style={{
                      background: n.is_read ? '#f9fafb' : '#eff6ff', border: `1px solid ${n.is_read ? '#e5e7eb' : '#93c5fd'}`,
                      borderRadius: 8, padding: '12px 16px', position: 'relative',
                      borderLeft: n.is_mandatory ? '4px solid #dc2626' : undefined
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '0.9em' }}>{n.title}</span>
                          <span style={{ marginLeft: 8, fontSize: '0.7em', color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>
                            {(n.type || '').replace(/_/g, ' ')}
                          </span>
                          {n.is_mandatory ? <span style={{ marginLeft: 6, fontSize: '0.65em', color: '#dc2626', fontWeight: 700 }}>MANDATORY</span> : null}
                        </div>
                        <span style={{ fontSize: '0.7em', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                      {n.body && <p style={{ margin: '6px 0 0', fontSize: '0.82em', color: '#374151' }}>{n.body}</p>}
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        {!n.is_read && <button type="button" className="btn" style={{ fontSize: '0.72em', padding: '2px 10px' }} onClick={() => markRead(n.id)}>Mark read</button>}
                        {!n.is_mandatory && <button type="button" style={{ fontSize: '0.72em', padding: '2px 10px', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} onClick={() => deleteNotification(n.id)}>Delete</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── PREFERENCES TAB ────────────────────────────── */}
          {activeTab === 'preferences' && (
            <div>
              <p style={{ fontSize: '0.85em', color: '#6b7280', marginBottom: 16 }}>Toggle notification types on or off. Mandatory notifications (like being dropped by a sponsor) cannot be disabled.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {notifTypes.map(type => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '0.85em', fontWeight: 600 }}>{type.replace(/_/g, ' ')}</span>
                    {type === 'sponsor_dropped' ? (
                      <span style={{ fontSize: '0.75em', color: '#9ca3af' }}>Always on (mandatory)</span>
                    ) : (
                      <button type="button" onClick={() => togglePreference(type, isEnabled(type))}
                        style={{ padding: '4px 14px', borderRadius: 6, border: 'none', fontSize: '0.8em', fontWeight: 600, cursor: 'pointer',
                          background: isEnabled(type) ? '#dcfce7' : '#fee2e2', color: isEnabled(type) ? '#166534' : '#991b1b' }}>
                        {isEnabled(type) ? 'Enabled' : 'Disabled'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── MUTE / QUIET HOURS TAB (driver only) ───────── */}
          {activeTab === 'mute' && role === 'driver' && (
            <div>
              <div style={{ background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', padding: 16, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.95em' }}>Temporary Mute</h3>
                <p style={{ fontSize: '0.82em', color: '#6b7280', marginBottom: 10 }}>Mute all non-mandatory notifications for a period of time.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn" style={{ fontSize: '0.8em' }} onClick={() => saveMute({ muted_until: new Date(Date.now() + 1 * 3600000).toISOString() })}>1 hour</button>
                  <button type="button" className="btn" style={{ fontSize: '0.8em' }} onClick={() => saveMute({ muted_until: new Date(Date.now() + 4 * 3600000).toISOString() })}>4 hours</button>
                  <button type="button" className="btn" style={{ fontSize: '0.8em' }} onClick={() => saveMute({ muted_until: new Date(Date.now() + 24 * 3600000).toISOString() })}>24 hours</button>
                  <button type="button" className="btn" style={{ fontSize: '0.8em' }} onClick={() => saveMute({ muted_until: new Date(Date.now() + 7 * 86400000).toISOString() })}>1 week</button>
                  {isMuted && <button type="button" className="btn btn-primary" style={{ fontSize: '0.8em' }} onClick={() => saveMute({ muted_until: null })}>Unmute</button>}
                </div>
              </div>

            <div style={{ background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', padding: 16 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.95em' }}>Quiet Hours</h3>
              <p style={{ fontSize: '0.82em', color: '#6b7280', marginBottom: 10 }}>Set hours when non-mandatory notifications are silenced.</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ fontSize: '0.82em' }}>Start:
                  <input type="time" className="form-input" style={{ marginLeft: 6, width: 'auto' }} value={muteSettings.quiet_start || ''} onChange={e => setMuteSettings(prev => ({ ...prev, quiet_start: e.target.value || null }))} />
                </label>
                <label style={{ fontSize: '0.82em' }}>End:
                  <input type="time" className="form-input" style={{ marginLeft: 6, width: 'auto' }} value={muteSettings.quiet_end || ''} onChange={e => setMuteSettings(prev => ({ ...prev, quiet_end: e.target.value || null }))} />
                </label>
                <button type="button" className="btn btn-primary" style={{ fontSize: '0.8em' }} onClick={() => saveMute({ quiet_start: muteSettings.quiet_start, quiet_end: muteSettings.quiet_end })}>Save</button>
                {(muteSettings.quiet_start || muteSettings.quiet_end) && (
                  <button type="button" className="btn" style={{ fontSize: '0.8em', color: '#dc2626' }} onClick={() => saveMute({ quiet_start: null, quiet_end: null })}>Clear</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── ANNOUNCEMENTS TAB (admin) ──────────────────── */}
        {activeTab === 'announce' && role === 'admin' && (
          <div>
            <h3 style={{ fontSize: '0.95em', marginBottom: 12 }}>Send System-Wide Announcement</h3>
            <form onSubmit={sendAdminAnnouncement} style={{ background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', padding: 16 }}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input type="text" className="form-input" required value={announceTitle} onChange={e => setAnnounceTitle(e.target.value)} placeholder="Announcement title" maxLength={255} />
              </div>
              <div className="form-group">
                <label className="form-label">Body (optional)</label>
                <textarea className="form-input" rows={3} value={announceBody} onChange={e => setAnnounceBody(e.target.value)} placeholder="Details..." maxLength={2000} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={announceType} onChange={e => setAnnounceType(e.target.value)}>
                    <option value="system_announcement">System Announcement</option>
                    <option value="system_maintenance">System Maintenance</option>
                    <option value="critical_error">Critical Error</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Target</label>
                  <select className="form-input" value={announceTarget} onChange={e => setAnnounceTarget(e.target.value)}>
                    <option value="all">All Users</option>
                    <option value="driver">Drivers Only</option>
                    <option value="sponsor">Sponsors Only</option>
                    <option value="admin">Admins Only</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Send Announcement</button>
            </form>
          </div>
        )}

        {/* ─── ANNOUNCEMENTS TAB (sponsor) ────────────────── */}
        {activeTab === 'announce' && role === 'sponsor' && (
          <div>
            <h3 style={{ fontSize: '0.95em', marginBottom: 12 }}>Send Announcement to Your Drivers</h3>
            <form onSubmit={sendSponsorAnnouncement} style={{ background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', padding: 16 }}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input type="text" className="form-input" required value={sponsorAnnounceTitle} onChange={e => setSponsorAnnounceTitle(e.target.value)} placeholder="Announcement title" maxLength={255} />
              </div>
              <div className="form-group">
                <label className="form-label">Body (optional)</label>
                <textarea className="form-input" rows={3} value={sponsorAnnounceBody} onChange={e => setSponsorAnnounceBody(e.target.value)} placeholder="Details..." maxLength={2000} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={sponsorAnnounceType} onChange={e => setSponsorAnnounceType(e.target.value)}>
                  <option value="sponsor_announcement">Program Announcement</option>
                  <option value="program_rules_update">Program Rules Update</option>
                  <option value="congratulations">Congratulations / Recognition</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary">Send to All Drivers</button>
            </form>
          </div>
        )}
        </main>
      </div>
    )
  }

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
      {isLoggedIn && currentPage === 'shop' && <DriverShopPage />}
      {isLoggedIn && currentPage === 'cart' && <CartPage />}
      {isLoggedIn && currentPage === 'order-confirmation' && <OrderConfirmationPage />}
      {isLoggedIn && currentPage === 'order-history' && <OrderHistoryPage />}
      {isLoggedIn && currentPage === 'order-detail' && <OrderDetailPage />}
      {isLoggedIn && currentPage === 'rewards' && <RewardsPage />}
      {isLoggedIn && currentPage === 'leaderboard' && <LeaderboardPage />}
      {isLoggedIn && currentPage === 'achievements' && <AchievementsPage />}
      {isLoggedIn && currentPage === 'sponsor-affiliation' && <SponsorAffiliationPage />}

      {/* Sponsor Pages */}
      {isLoggedIn && currentPage === 'point-management' && <PointManagementPage />}
      {isLoggedIn && currentPage === 'organization' && <OrganizationPage />}

      {/* Sponsor/Admin shared Pages */}
      {isLoggedIn && currentPage === 'applications' && currentUser?.role !== 'admin' && <ApplicationsPage />}
      {isLoggedIn && currentPage === 'drivers' && <SponsorDriversPage />}
      {isLoggedIn && currentPage === 'catalog' && currentUser?.role === 'sponsor' && <SponsorCatalogPage />}
      {isLoggedIn && currentPage === 'sponsor-preview' && currentUser?.role === 'sponsor' && <SponsorPreviewPage />}
      {isLoggedIn && currentPage === 'messages' && <MessagesPage />}
      {isLoggedIn && currentPage === 'notifications' && <NotificationsPage />}

      {/* Admin ONLY Pages */}
      {isLoggedIn && currentPage === 'admin-users' && <AdminUsersPage />}
      {isLoggedIn && currentPage === 'system-monitoring' && <SystemMonitoringPage />}

      {showLogoutConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2 className="page-title" style={{ marginBottom: 4 }}>Log out?</h2>
            <p className="page-subtitle" style={{ marginBottom: 20 }}>
              You’ll be signed out of SafeMiles and returned to the login screen.
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