import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../auth'

export const alertTypes = [
  { value: 'growth_anomaly', label: 'Growth anomaly' },
  { value: 'vaccination_due', label: 'Vaccination due' },
  { value: 'breeding_event', label: 'Breeding event' },
  { value: 'data_gap', label: 'Data gap' },
]

export const initialAlertForm = {
  hog_id: '',
  alert_type: alertTypes[0].value,
  alert_date: '',
  message: '',
  alert_rule_id: '',
}

export function useAlertsViewModel() {
  const [alerts, setAlerts] = useState([])
  const [hogs, setHogs] = useState([])
  const [form, setForm] = useState(initialAlertForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [hogData, alertData] = await Promise.all([apiRequest('/hogs'), apiRequest('/alerts')])
      setHogs(hogData)
      setAlerts(alertData)
      if (!form.hog_id && hogData.length > 0) {
        setForm((current) => ({ ...current, hog_id: String(hogData[0].id) }))
      }
      return { hogs: hogData, alerts: alertData }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [form.hog_id])

  useEffect(() => {
    loadData()
  }, [loadData])

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
        await apiRequest('/alerts', {
          method: 'POST',
          body: JSON.stringify({
            hog_id: Number(form.hog_id),
            alert_type: form.alert_type,
            alert_date: form.alert_date,
            message: form.message,
            alert_rule_id: form.alert_rule_id ? Number(form.alert_rule_id) : null,
          }),
        })
        setForm((current) => ({ ...current, message: '' }))
        await loadData()
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
    },
    [form, loadData],
  )

  return {
    alerts,
    hogs,
    form,
    setForm,
    error,
    saving,
    loading,
    handleChange,
    handleSubmit,
    refresh: loadData,
  }
}
