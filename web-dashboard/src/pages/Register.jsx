import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerUser } from '../auth'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    farm_name: '',
  })
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
      await registerUser(form)
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h2>Create farm account</h2>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Farm name
          <input name="farm_name" value={form.farm_name} onChange={handleChange} required />
        </label>
        <label>
          Full name
          <input name="full_name" value={form.full_name} onChange={handleChange} required />
        </label>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </label>
        <label>
          Password
          <input type="password" name="password" value={form.password} onChange={handleChange} required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Register'}</button>
      </form>
    </div>
  )
}
