import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, setToken } from '../auth'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const data = await loginUser(form.email, form.password)
      setToken(data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h2>Login</h2>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </label>
        <label>
          Password
          <input type="password" name="password" value={form.password} onChange={handleChange} required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={saving}>{saving ? 'Logging in...' : 'Login'}</button>
      </form>
    </div>
  )
}
