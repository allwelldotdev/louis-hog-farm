import { Link } from 'react-router-dom'
import { isAuthenticated } from '../auth'

export default function Home() {
  return (
    <div className="page">
      <h2>Welcome to Hog Farm Monitoring</h2>
      <p>This frontend connects to the FastAPI backend at <code>/api/v1</code>.</p>
      <div className="card-grid">
        <div className="card">
          <h3>Get started</h3>
          <p>Register a farm and log in to manage hogs, records, and alerts.</p>
          <Link to="/register">Register</Link>
          <Link to="/login">Login</Link>
        </div>
        {isAuthenticated() ? (
          <div className="card">
            <h3>Manage data</h3>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/hogs">Hogs</Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
