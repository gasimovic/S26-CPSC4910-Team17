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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          width: '400px'
        }}>
          <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
            🚛 Driver Rewards
          </h1>
          
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Email or Driver ID
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  fontSize: '16px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  fontSize: '16px'
                }}
                required
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Login
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
            Forgot password? <a href="#" style={{ color: '#2563eb' }}>Reset here</a>
          </p>
        </div>
      </div>
    )
  }

  // ============ NAVIGATION COMPONENT ============
  const Navigation = () => {
    return (
      <nav style={{
        backgroundColor: '#1f2937',
        padding: '15px 30px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
          🚛 Driver Rewards
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button onClick={() => setCurrentPage('dashboard')} 
            style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            Dashboard
          </button>
          <button onClick={() => setCurrentPage('log-trip')} 
            style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            Log Trip
          </button>
          <button onClick={() => setCurrentPage('rewards')} 
            style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            Rewards
          </button>
          <button onClick={() => setCurrentPage('leaderboard')} 
            style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            Leaderboard
          </button>
          <button onClick={() => setCurrentPage('achievements')} 
            style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            Achievements
          </button>
          <button onClick={() => setCurrentPage('profile')} 
            style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            Profile
          </button>
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>
            {currentUser?.points} pts
          </span>
          <button onClick={handleLogout} 
            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            Logout
          </button>
        </div>
      </nav>
    )
  }

  // ============ DASHBOARD PAGE ============
  const DashboardPage = () => {
    return (
      <div>
        <Navigation />
        <main style={{ padding: '30px', backgroundColor: '#f3f4f6', minHeight: 'calc(100vh - 70px)' }}>
          <h1>Welcome back, {currentUser.name}! 👋</h1>
          
          {/* Points Display */}
          <div style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '40px',
            borderRadius: '10px',
            textAlign: 'center',
            marginTop: '20px'
          }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Your Points</h2>
            <p style={{ margin: '10px 0 0 0', fontSize: '48px', fontWeight: 'bold' }}>
              {currentUser.points}
            </p>
          </div>

          {/* Quick Stats */}
          <section style={{ marginTop: '30px' }}>
            <h2>Quick Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '15px' }}>
              {/* TODO: Fetch from backend */}
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>Miles This Week</h3>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>{currentUser.miles}</p>
              </div>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>Safe Days Streak</h3>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>{currentUser.streak}</p>
              </div>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>Current Rank</h3>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>#{currentUser.rank}</p>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section style={{ marginTop: '30px' }}>
            <h2>Recent Activity</h2>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              {/* TODO: Map through activities from backend */}
              <p style={{ color: '#666' }}>No recent activity</p>
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
        <main style={{ padding: '30px', backgroundColor: '#f3f4f6', minHeight: 'calc(100vh - 70px)' }}>
          <h1>Log a Trip</h1>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', maxWidth: '600px', marginTop: '20px' }}>
            <form onSubmit={handleSubmit}>
              {/* TODO: Add all form fields */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }} required />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Miles Driven</label>
                <input type="number" value={formData.miles} onChange={(e) => setFormData({...formData, miles: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }} required />
              </div>
              {/* TODO: Add more fields */}
              <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                Submit Trip
              </button>
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
        <main style={{ padding: '30px', backgroundColor: '#f3f4f6', minHeight: 'calc(100vh - 70px)' }}>
          <h1>Rewards Store</h1>
          <p>Your balance: <strong>{currentUser.points} points</strong></p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '30px' }}>
            {/* TODO: Map through rewards from backend */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <h3>$25 Gas Card</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>500 pts</p>
              <button style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Redeem
              </button>
            </div>
            {/* Add more reward cards */}
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
        <main style={{ padding: '30px', backgroundColor: '#f3f4f6', minHeight: 'calc(100vh - 70px)' }}>
          <h1>Leaderboard</h1>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginTop: '30px' }}>
            {/* TODO: Fetch leaderboard data from backend */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Rank</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Driver</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {/* Map through leaderboard entries */}
                <tr><td colSpan="3" style={{ padding: '15px', textAlign: 'center', color: '#666' }}>Loading...</td></tr>
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
        <main style={{ padding: '30px', backgroundColor: '#f3f4f6', minHeight: 'calc(100vh - 70px)' }}>
          <h1>Achievements & Badges</h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginTop: '30px' }}>
            {/* TODO: Map through achievements from backend */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '48px' }}>🏆</div>
              <h3>Road Warrior</h3>
              <p style={{ fontSize: '12px', color: '#666' }}>30 days accident-free</p>
              <p style={{ fontWeight: 'bold', color: '#10b981' }}>Unlocked!</p>
            </div>
            {/* Add more badges */}
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
        <main style={{ padding: '30px', backgroundColor: '#f3f4f6', minHeight: 'calc(100vh - 70px)' }}>
          <h1>Profile</h1>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', maxWidth: '600px', marginTop: '20px' }}>
            {/* TODO: Fetch user profile from backend */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Name</label>
              <p>{currentUser.name}</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Email</label>
              <p>{currentUser.email}</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Driver ID</label>
              <p>{currentUser.id}</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Total Points</label>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>{currentUser.points}</p>
            </div>
            {/* TODO: Add edit functionality */}
            <button style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Edit Profile
            </button>
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