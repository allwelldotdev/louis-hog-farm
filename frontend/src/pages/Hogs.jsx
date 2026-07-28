import { useHogsViewModel } from '../viewmodels/useHogsViewModel'

export default function Hogs() {
  const { hogs, form, error, saving, loading, handleChange, handleSubmit } = useHogsViewModel()

  return (
    <div className="page">
      <h2>Hogs</h2>
      {error ? <p className="error">{error}</p> : null}

      <section>
        <h3>Create new hog</h3>
        {loading ? <p>Loading hogs...</p> : null}
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Tag number
            <input name="tag_number" value={form.tag_number} onChange={handleChange} required />
          </label>
          <label>
            Birth date
            <input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} required />
          </label>
          <label>
            Breed
            <input name="breed" value={form.breed} onChange={handleChange} required />
          </label>
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create hog'}</button>
        </form>
      </section>

      <section>
        <h3>Hog list</h3>
        {hogs.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tag</th>
                  <th>Breed</th>
                  <th>Birth date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hogs.map((hog) => (
                  <tr key={hog.id}>
                    <td>{hog.id}</td>
                    <td>{hog.tag_number}</td>
                    <td>{hog.breed}</td>
                    <td>{hog.birth_date}</td>
                    <td>{hog.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No hogs found.</p>
        )}
      </section>
    </div>
  )
}
