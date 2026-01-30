import React, { useState } from 'react'

function App() {
  // ============ STATE MANAGEMENT ============
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState('login')
  const [currentUser, setCurrentUser] = useState(null)

  // ============ AUTH FUNCTIONS ============
  // User login is handled by BACKEND
  // Backend will verify credentials and return user data + token
  const handleLogin = async (email, password) => {
    // TODO: Replace with actual backend call
    // const response = await fetch('http://localhost:3000/api/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email, password })
    // })
    // const data = await response.json()
    // if (data.success) {
    //   localStorage.setItem('authToken', data.token)
    //   setCurrentUser(data.user)
    //   setIsLoggedIn(true)
    //   setCurrentPage('dashboard')
    // }

    // MOCK LOGIN (remove when backend is ready)
    setCurrentUser({
      id: 'DRV001',
      name: 'John Smith',
      email: email,
      role: 'driver', // or 'admin', 'manager'
      points: 2450,
      miles: 850,
      streak: 23,
      rank: 5
    })
    setIsLoggedIn(true)
    setCurrentPage('dashboard')
  }

  const handleLogout = () => {
    // TODO: Clear backend session/token
    // localStorage.removeItem('authToken')
    setIsLoggedIn(false)
    setCurrentPage('login')
    setCurrentUser(null)
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

            <button type="submit" className="btn btn-primary btn-block">
              Sign in
            </button>
          </form>

          <p className="form-footer">
            Forgot password? <a href="#" className="link">Reset here</a>
          </p>
        </div>
      </div>
    )
  }

  // ============ NAVIGATION COMPONENT ============
  const Navigation = () => {
    return (
      <nav className="nav">
        <div className="nav-brand">Driver Rewards</div>
        <div className="nav-links">
          <button type="button" onClick={() => setCurrentPage('dashboard')} className="nav-link">Dashboard</button>
          <button type="button" onClick={() => setCurrentPage('log-trip')} className="nav-link">Log Trip</button>
          <button type="button" onClick={() => setCurrentPage('rewards')} className="nav-link">Rewards</button>
          <button type="button" onClick={() => setCurrentPage('leaderboard')} className="nav-link">Leaderboard</button>
          <button type="button" onClick={() => setCurrentPage('achievements')} className="nav-link">Achievements</button>
          <button type="button" onClick={() => setCurrentPage('profile')} className="nav-link">Profile</button>
          <span className="nav-pts">{currentUser?.points} pts</span>
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
          <h1 className="page-title">Welcome back, {currentUser.name}</h1>
          <p className="page-subtitle">Here’s your overview</p>

          <div className="pts-hero">
            <p className="pts-hero-label">Your points</p>
            <p className="pts-hero-value">{currentUser.points}</p>
          </div>

          <section>
            <h2 className="section-title">Quick stats</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <p className="stat-label">Miles this week</p>
                <p className="stat-value stat-value-blue">{currentUser.miles}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Safe days streak</p>
                <p className="stat-value stat-value-green">{currentUser.streak}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Current rank</p>
                <p className="stat-value stat-value-amber">#{currentUser.rank}</p>
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
      // TODO: Send to backend
      // const response = await fetch('http://localhost:3000/api/trips', {
      //   method: 'POST',
      //   body: JSON.stringify(formData)
      // })
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
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="form-input" required />
              </div>
              <div className="form-group">
                <label className="form-label">Miles driven</label>
                <input type="number" value={formData.miles} onChange={(e) => setFormData({ ...formData, miles: e.target.value })}
                  className="form-input" placeholder="0" required />
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
          <p className="page-subtitle">Your balance: <strong>{currentUser.points} points</strong></p>
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

  // ============ PROFILE PAGE ============
  const ProfilePage = () => {
    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Your account details</p>
          <div className="card profile-card">
            <div className="profile-field">
              <p className="profile-label">Name</p>
              <p className="profile-value">{currentUser.name}</p>
            </div>
            <div className="profile-field">
              <p className="profile-label">Email</p>
              <p className="profile-value">{currentUser.email}</p>
            </div>
            <div className="profile-field">
              <p className="profile-label">Driver ID</p>
              <p className="profile-value">{currentUser.id}</p>
            </div>
            <div className="profile-field">
              <p className="profile-label">Total points</p>
              <p className="profile-value profile-value-lg">{currentUser.points}</p>
            </div>
            <button type="button" className="btn btn-primary">Edit profile</button>
          </div>
        </main>
      </div>
    )
  }

  // ============ MAIN RENDER ============
  return (
    <div>
      {!isLoggedIn && <LoginPage />}
      {isLoggedIn && currentPage === 'dashboard' && <DashboardPage />}
      {isLoggedIn && currentPage === 'log-trip' && <LogTripPage />}
      {isLoggedIn && currentPage === 'rewards' && <RewardsPage />}
      {isLoggedIn && currentPage === 'leaderboard' && <LeaderboardPage />}
      {isLoggedIn && currentPage === 'achievements' && <AchievementsPage />}
      {isLoggedIn && currentPage === 'profile' && <ProfilePage />}
    </div>
  )
}

export default App