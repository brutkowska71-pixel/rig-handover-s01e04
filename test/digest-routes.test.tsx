// Plan morning-digest § 2d. Route tests for GET /digest/:night and GET /api/digest/:night.
// Fixtures live in a temp runs dir; runs/ is never touched.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: tmp,
};

// Jobs are written out of order and one line does not parse; retries reach 3 on digest/render
// and the last status of notes/backup is fail, so both warning marks appear.
const BUSY_NIGHT = [
  '{"at":"2026-11-01T23:00:05+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  '{"at":"2026-11-01T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
  '{oops not json',
  '{"at":"2026-11-01T23:10:00+01:00","job":"digest/render","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-11-01T23:11:00+01:00","job":"digest/render","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-11-01T23:12:00+01:00","job":"digest/render","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-11-01T23:13:00+01:00","job":"digest/render","status":"ok","owner":null}',
  '{"at":"2026-11-01T02:00:00+01:00","job":"notes/backup","status":"fail","owner":"rook","error":"quota exceeded"}',
  '',
].join('\n');

beforeAll(() => {
  writeFileSync(join(tmp, '2026-11-01.jsonl'), BUSY_NIGHT);
  writeFileSync(join(tmp, '2026-11-02.jsonl'), '');
});

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// Job names in the page's table, in row order (the first cell of each body row).
function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*>\s*<td>(?:⚠ )?([^<]*)<\/td>/g)].map((m) => m[1]!);
}

describe('GET /digest/:night (page)', () => {
  it('answers 200 and renders the jobs for a night with a file', async () => {
    const res = await createApp(config).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<h1>2026-11-01</h1>');
    expect(pageJobs(html)).toEqual(['digest/render', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(404);
    expect(html).toContain('no run log for that night');
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await createApp(config).request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(pageJobs(html)).toEqual([]);
  });

  it('says how many lines could not be read', async () => {
    const res = await createApp(config).request('/digest/2026-11-01');
    const html = await res.text();
    expect(html).toContain('1 line could not be read');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('answers 200 with the rows and the bad-line count', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-11-01');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
  });

  it('answers 404 with an error for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-01-01' });
  });

  it('answers 200 with no rows for an empty night', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-11-02', rows: [], badLines: 0 });
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order for one night', async () => {
    const app = createApp(config);
    const html = await (await app.request('/digest/2026-11-01')).text();
    const body = (await (await app.request('/api/digest/2026-11-01')).json()) as Night;
    expect(pageJobs(html)).toEqual(body.rows.map((r) => r.job));
  });
});
