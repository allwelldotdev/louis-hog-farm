import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Hogs from './pages/Hogs'
import FeedRecords from './pages/FeedRecords'
import HealthRecords from './pages/HealthRecords'
import Alerts from './pages/Alerts'
import NotFound from './pages/NotFound'
import { isAuthenticated, removeToken } from './auth'

function App() {
  const auth = isAuthenticated()

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header>
          <h1>Hog Farm Monitoring</h1>
          <p>React frontend connected to FastAPI backend.</p>
          <nav className="site-nav">
            <NavLink to="/" end>
              Home
            </NavLink>
            {auth ? (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/hogs">Hogs</NavLink>
                <NavLink to="/feed-records">Feed</NavLink>
                <NavLink to="/health-records">Health</NavLink>
                <NavLink to="/alerts">Alerts</NavLink>
                <button type="button" className="link-button" onClick={() => removeToken()}>Logout</button>
              </>
            ) : (
              <>
                <NavLink to="/login">Login</NavLink>
                <NavLink to="/register">Register</NavLink>
              </>
            )}
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/hogs" element={<Hogs />} />
            <Route path="/feed-records" element={<FeedRecords />} />
            <Route path="/health-records" element={<HealthRecords />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
