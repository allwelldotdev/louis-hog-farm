import { useFeedRecordsViewModel } from '../viewmodels/useFeedRecordsViewModel'

export default function FeedRecords() {
  const { records, hogs, form, error, saving, loading, handleChange, handleSubmit } = useFeedRecordsViewModel()

  return (
    <div className="page">
      <h2>Feed Records</h2>
      {error ? <p className="error">{error}</p> : null}

      <section>
        <h3>Create feed record</h3>
        {loading ? <p>Loading feed records...</p> : null}
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
            Feed amount
            <input type="number" step="0.01" name="feed_amount" value={form.feed_amount} onChange={handleChange} required />
          </label>
          <label>
            Feed cost
            <input type="number" step="0.01" name="feed_cost" value={form.feed_cost} onChange={handleChange} required />
          </label>
          <label>
            Currency
            <input name="currency_code" value={form.currency_code} onChange={handleChange} required />
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
                  <th>Amount</th>
                  <th>Cost</th>
                  <th>Currency</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>{record.hog_id}</td>
                    <td>{record.record_date}</td>
                    <td>{record.feed_amount}</td>
                    <td>{record.feed_cost}</td>
                    <td>{record.currency_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No feed records available.</p>
        )}
      </section>
    </div>
  )
}
