import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('has 5 jobs, sorted, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night!.night).toBe('2026-10-28');
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, keeps the last status, error and times as written', () => {
    const byJob = Object.fromEntries(night!.rows.map((r) => [r.job, r]));
    expect(byJob['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['lane/sync']).toMatchObject({ retries: 1, lastStatus: 'ok', lastError: 'lock held', firstAt: '2026-10-28T23:00:06+01:00' });
    expect(byJob['notes/backup']).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['rig/rotate-logs']).toMatchObject({ runs: 1, lastStatus: 'ok', lastError: null, owner: 'lane-07' });
  });

  it('keeps a job whose owner is null', () => {
    const row = night!.rows.find((r) => r.job === 'digest/render');
    expect(row).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });
});

describe('readNight edge cases', () => {
  it('returns null for a night with no file', () => {
    expect(readNight(tmp, '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(tmp, '2026-01-02.jsonl'), '');
    expect(readNight(tmp, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts bad lines (bad JSON, missing or invalid fields) and never throws', () => {
    const lines = [
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":null}',
      '{not json',
      '{"at":"2026-01-03T01:01:00+01:00","job":"a","status":"maybe","owner":"x"}',
      '{"at":"2026-01-03T01:02:00+01:00","status":"ok","owner":"x"}',
      '{"at":"2026-01-03T01:03:00+01:00","job":"a","status":"ok"}',
      '[1,2]',
      '{"at":"2026-01-03T01:04:00+01:00","job":"a","status":"retry","owner":"x","error":"e"}',
    ];
    writeFileSync(join(tmp, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const night = readNight(tmp, '2026-01-03');
    expect(night!.badLines).toBe(5);
    expect(night!.rows).toEqual([
      {
        job: 'a',
        owner: 'x',
        runs: 2,
        retries: 1,
        lastStatus: 'retry',
        lastError: 'e',
        firstAt: '2026-01-03T01:00:00+01:00',
        lastAt: '2026-01-03T01:04:00+01:00',
      },
    ]);
  });

  it('keeps owner null when the last line has a null owner', () => {
    writeFileSync(
      join(tmp, '2026-01-04.jsonl'),
      '{"at":"2026-01-04T01:00:00+01:00","job":"b","status":"fail","owner":null,"error":"boom"}\n',
    );
    expect(readNight(tmp, '2026-01-04')!.rows[0]).toMatchObject({ owner: null, lastError: 'boom' });
  });
});
