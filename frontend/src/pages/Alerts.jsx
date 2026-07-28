import { useAlertsViewModel, alertTypes } from '../viewmodels/useAlertsViewModel'

export default function Alerts() {
  const { alerts, hogs, form, error, saving, loading, handleChange, handleSubmit } = useAlertsViewModel()

  return (
    <div className="page">
      <h2>Alerts</h2>
      {error ? <p className="error">{error}</p> : null}

      <section>
        <h3>Create alert</h3>
        {loading ? <p>Loading alerts...</p> : null}
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Hog
            <select name="hog_id" value={form.hog_id} onChange={handleChange} required>
              <option value="" disabled>Select a hog</option>
              {hogs.map((hog) => (
                <option key={hog.id} value={hog.id}>
                  {hog.tag_number} ({hog.breed})
                </option>
              ))}
            </select>
          </label>
          <label>
            Alert type
            <select name="alert_type" value={form.alert_type} onChange={handleChange}>
              {alertTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" name="alert_date" value={form.alert_date} onChange={handleChange} required />
          </label>
          <label>
            Message
            <textarea name="message" value={form.message} onChange={handleChange} rows="3" required />
          </label>
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create alert'}</button>
        </form>
      </section>

      <section>
        <h3>Existing alerts</h3>
        {alerts.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Hog</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>{alert.id}</td>
                    <td>{alert.hog_id}</td>
                    <td>{alert.alert_type}</td>
                    <td>{alert.alert_date}</td>
                    <td>{alert.status}</td>
                    <td>{alert.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No alerts found.</p>
        )}
      </section>
    </div>
  )
}
