import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../auth'

export const initialHogForm = {
  tag_number: '',
  birth_date: '',
  breed: '',
}

export function useHogsViewModel() {
  const [hogs, setHogs] = useState([])
  const [form, setForm] = useState(initialHogForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadHogs = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiRequest('/hogs')
      setHogs(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHogs()
  }, [loadHogs])

  const handleChange = useCallback((event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }, [])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      setSaving(true)
      setError(null)

      try {
        await apiRequest('/hogs', {
          method: 'POST',
          body: JSON.stringify(form),
        })
        setForm(initialHogForm)
        await loadHogs()
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
    },
    [form, loadHogs],
  )

  return {
    hogs,
    form,
    setForm,
    error,
    saving,
    loading,
    handleChange,
    handleSubmit,
    refresh: loadHogs,
  }
}
