import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

function isWarn(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function Row({ row }: { row: DigestRow }) {
  const warn = isWarn(row);
  return (
    <tr class={warn ? 'warn' : undefined}>
      <td>{warn ? `⚠ ${row.job}` : row.job}</td>
      <td>{row.owner ?? dash}</td>
      <td>{row.runs}</td>
      <td>{row.retries >= 3 ? `⚠ ${row.retries}` : row.retries}</td>
      <td>{row.lastStatus === 'fail' ? '⚠ fail' : row.lastStatus}</td>
      <td>{row.lastError ?? dash}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>{night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <Row row={row} />
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 && (
        <p class="mute">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      )}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>{night}</h1>
      <p class="mute">no run log for that night</p>
    </>
  );
}
