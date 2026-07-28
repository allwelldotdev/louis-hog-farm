import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../auth'

export function useDashboardViewModel() {
  const [kpis, setKpis] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadKpis = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiRequest('/dashboard/kpis')
      setKpis(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKpis()
  }, [loadKpis])

  return {
    kpis,
    error,
    loading,
    refresh: loadKpis,
  }
}
