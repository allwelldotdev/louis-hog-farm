import { useHealthRecordsViewModel } from '../viewmodels/useHealthRecordsViewModel'

export default function HealthRecords() {
  const { records, hogs, form, error, saving, loading, handleChange, handleSubmit } = useHealthRecordsViewModel()

  return (
    <div className="page">
      <h2>Health Records</h2>
      {error ? <p className="error">{error}</p> : null}

      <section>
        <h3>Create health record</h3>
        {loading ? <p>Loading health records...</p> : null}
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
            Date
            <input type="date" name="record_date" value={form.record_date} onChange={handleChange} required />
          </label>
          <label>
            Weight
            <input type="number" step="0.01" name="weight" value={form.weight} onChange={handleChange} required />
          </label>
          <label>
            Temperature
            <input type="number" step="0.1" name="temperature" value={form.temperature} onChange={handleChange} />
          </label>
          <label>
            Notes
            <textarea name="notes" value={form.notes} onChange={handleChange} rows="3" />
          </label>
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create record'}</button>
        </form>
      </section>

      <section>
        <h3>Existing records</h3>
        {records.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Hog</th>
                  <th>Date</th>
                  <th>Weight</th>
                  <th>Temp</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>{record.hog_id}</td>
                    <td>{record.record_date}</td>
                    <td>{record.weight}</td>
                    <td>{record.temperature ?? '-'}</td>
                    <td>{record.notes ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No health records available.</p>
        )}
      </section>
    </div>
  )
}
