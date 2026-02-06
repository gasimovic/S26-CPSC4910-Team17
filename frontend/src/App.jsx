import React, { useEffect, useMemo, useState } from 'react'

function App() {
  // ============ STATE MANAGEMENT ============
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState('login')
  const [currentUser, setCurrentUser] = useState(null)

  // Keep UI the same: no role selector in the UI.
  // Choose which microservice to hit via env var. Defaults to driver.
  // Valid: admin | driver | sponsor
  const activeRole = (import.meta.env.VITE_ACTIVE_ROLE || 'driver').toLowerCase()

  const API_BASE = useMemo(
    () => ({
      // Defaults match your current running ports (admin=4001, driver=4002, sponsor=4003)
      admin: import.meta.env.VITE_ADMIN_API_BASE || 'http://localhost:4001',
      driver: import.meta.env.VITE_DRIVER_API_BASE || 'http://localhost:4002',
      sponsor: import.meta.env.VITE_SPONSOR_API_BASE || 'http://localhost:4003'
    }),
    []
  )

  const baseUrl = API_BASE[activeRole] || API_BASE.driver

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
    try {
      res = await fetch(`${baseUrl}${path}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          ...options
        }
      )
    } catch (e) {
      // Browser/network/CORS failures land here
      const err = new Error('Network error: could not reach the server')
      err.cause = e
      throw err
    }

    const data = await safeJson(res)
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
      role: userObj.role || activeRole,
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
    if (!user) return ['dashboard']

    const role = (user.role || activeRole || 'driver').toLowerCase()
    const hasSponsor = Boolean((user.profile?.sponsor_org || '').toString().trim())

    if (role === 'admin') {
      return ['dashboard', 'profile', 'account-details', 'change-password']
    }

    if (role === 'sponsor') {
      return ['dashboard', 'applications', 'rewards', 'leaderboard', 'profile', 'account-details', 'change-password', 'sponsor-affiliation']
    }

    // driver
    if (role === 'driver') {
      if (hasSponsor) {
        return ['dashboard', 'log-trip', 'rewards', 'leaderboard', 'achievements', 'profile', 'account-details', 'change-password', 'sponsor-affiliation']
      }
      // Unaffiliated drivers get a minimal view
      return ['dashboard', 'profile', 'account-details', 'change-password', 'sponsor-affiliation']
    }

    // Fallback
    return ['dashboard', 'profile']
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

  // ============ AUTH FUNCTIONS ============
  const handleLogin = async (email, password) => {
    setAuthError('')
    setStatusMsg('')

    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })

      setIsLoggedIn(true)

      const u = await loadMe()

      // If user has no details yet, send them to the details prompt
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

  const handleRegister = async ({ email, password, name, dob }) => {
    setAuthError('')
    setStatusMsg('')

    try {
      // Backend Sprint 1 expects email/password only
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })

      // Log in immediately
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })

      setIsLoggedIn(true)

      // Load profile + prefill if provided
      const u = await loadMe()

      // If they provided name/DOB at registration, prefill in the prompt
      const [first_name, ...rest] = (name || '').trim().split(/\s+/)
      const last_name = rest.join(' ')

      setCurrentUser({
        ...u,
        profile: {
          ...u.profile,
          first_name: u.profile.first_name || first_name || '',
          last_name: u.profile.last_name || last_name || '',
          dob: u.profile.dob || dob || ''
        }
      })

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
  }

  // Optional: if user refreshes while logged in, try to restore
  useEffect(() => {
    // We only attempt restore if they land somewhere inside the app.
    // To avoid UI changes, we don't auto-run on first load.
  }, [])

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
            Forgot password? <a href="#" className="link">Reset here</a>
            <br />
            Don&apos;t have an account?{' '}
            <a
              href="#"
              className="link"
              onClick={(e) => {
                e.preventDefault()
                setAuthError('')
                setStatusMsg('')
                setCurrentPage('create-account')
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
    const allowed = getAllowedPages(currentUser)
    
    return (
      <nav className="nav">
        <div className="nav-brand">Driver Rewards</div>
        <div className="nav-links">
          {allowed.includes('dashboard') && (
            <button type="button" onClick={() => setCurrentPage('dashboard')} className="nav-link">
              Dashboard
            </button>
          )}
          {allowed.includes('log-trip') && (
            <button type="button" onClick={() => setCurrentPage('log-trip')} className="nav-link">
              Log Trip
            </button>
          )}
          {allowed.includes('applications') && (
            <button type="button" onClick={() => setCurrentPage('applications')} className="nav-link">
              Applications
            </button>
          )}
          {allowed.includes('rewards') && (
            <button type="button" onClick={() => setCurrentPage('rewards')} className="nav-link">
              Rewards
            </button>
          )}
          {allowed.includes('leaderboard') && (
            <button type="button" onClick={() => setCurrentPage('leaderboard')} className="nav-link">
              Leaderboard
            </button>
          )}
          {allowed.includes('achievements') && (
            <button type="button" onClick={() => setCurrentPage('achievements')} className="nav-link">
              Achievements
            </button>
          )}
          {allowed.includes('profile') && (
            <button type="button" onClick={() => setCurrentPage('profile')} className="nav-link">
              Profile
            </button>
          )}
          {allowed.includes('sponsor-affiliation') && (
            <button type="button" onClick={() => setCurrentPage('sponsor-affiliation')} className="nav-link">
              Sponsor
            </button>
          )}
          <span className="nav-pts">{currentUser?.points ?? 0} pts</span>
          <button type="button" onClick={handleLogout} className="nav-logout">Log out</button>
        </div>
      </nav>
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
    const [sponsors, setSponsors] = useState([])
    const [error, setError] = useState('')
    const [apps, setApps] = useState([])
    const [statusMsgLocal, setStatusMsgLocal] = useState('')

    const loadSponsors = async () => {
      setError('')
      setLoading(true)
      try {
        const data = await api('/sponsors', { method: 'GET' })
        setSponsors(data.sponsors || [])
      } catch (err) {
        setError(err.message || 'Failed to load sponsors')
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
      // load applications on mount
      loadApplications()
    }, [])

    const applyTo = async (sponsorId) => {
      setStatusMsgLocal('')
      try {
        await api('/applications', { method: 'POST', body: JSON.stringify({ sponsorId }) })
        setStatusMsgLocal('Application submitted')
        await loadApplications()
      } catch (err) {
        setStatusMsgLocal(err.message || 'Failed to apply')
      }
    }

    const currentSponsor = currentUser?.profile?.sponsor_org || ''

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Sponsor Affiliation</h1>
          <p className="page-subtitle">View or join a sponsor program</p>

          {currentSponsor ? (
            <div className="card">
              <h3>Your Sponsor</h3>
              <p>{currentSponsor}</p>
            </div>
          ) : (
            <div className="card">
              <h3>No sponsor affiliated</h3>
              <p>You are not currently affiliated with a sponsor. Browse available sponsors below.</p>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={loadSponsors} disabled={loading}>
                  {loading ? 'Loading…' : 'Find sponsors'}
                </button>
              </div>

              {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

              {sponsors.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <h4>Available sponsors</h4>
                  <ul className="list">
                    {sponsors.map(s => (
                      <li key={s.id} className="list-item">
                        <div>
                          <strong>{s.company_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email}</strong>
                          <div className="muted">{s.email}</div>
                        </div>
                        <div>
                          <button className="btn btn-success" onClick={() => applyTo(s.id)}>Apply</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <section style={{ marginTop: 20 }}>
            <h2 className="section-title">Your applications</h2>
            {statusMsgLocal ? <p className="form-footer" style={{ color: 'green' }}>{statusMsgLocal}</p> : null}
            {apps.length === 0 ? (
              <p className="activity-empty">No applications found</p>
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
                        <td>{a.status}</td>
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
        if (activeRole === 'driver') addIfNonEmpty('sponsor_org', formData.sponsor_org)
        if (activeRole === 'sponsor') addIfNonEmpty('company_name', formData.company_name)
        if (activeRole === 'admin') addIfNonEmpty('display_name', formData.display_name)

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
          <h1 className="page-title">Create Account</h1>
          <p className="page-subtitle">Create an account to start earning points</p>
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
          body: JSON.stringify({ status: action })
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
                    {applications.map(app => (
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


  // ============ MAIN RENDER ============
  return (
    <div>
      {!isLoggedIn && currentPage === 'login' && <LoginPage />}
      {!isLoggedIn && currentPage === 'create-account' && <CreateAccountPage />}

      {isLoggedIn && (() => {
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
            {/* Safety fallback: render dashboard if currentPage somehow invalid */}
            {(!allowed.includes(currentPage)) && <DashboardPage />}
          </>
        )
      })()}
    </div>
  )
}



export default App
