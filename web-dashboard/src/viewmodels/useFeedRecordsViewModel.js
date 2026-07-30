import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../auth'

export const initialFeedForm = {
  hog_id: '',
  feed_amount: '',
  feed_cost: '',
  currency_code: 'NGN',
  record_date: '',
}

export function useFeedRecordsViewModel() {
  const [records, setRecords] = useState([])
  const [hogs, setHogs] = useState([])
  const [form, setForm] = useState(initialFeedForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [hogData, recordData] = await Promise.all([apiRequest('/hogs'), apiRequest('/feed-records')])
      setHogs(hogData)
      setRecords(recordData)
      if (!form.hog_id && hogData.length > 0) {
        setForm((current) => ({ ...current, hog_id: String(hogData[0].id) }))
      }
      return { hogs: hogData, records: recordData }
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
        await apiRequest('/feed-records', {
          method: 'POST',
          body: JSON.stringify({
            hog_id: Number(form.hog_id),
            feed_amount: Number(form.feed_amount),
            feed_cost: Number(form.feed_cost),
            currency_code: form.currency_code,
            record_date: form.record_date,
          }),
        })
        setForm((current) => ({ ...initialFeedForm, hog_id: current.hog_id }))
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
    records,
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
