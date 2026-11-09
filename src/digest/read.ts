// Plan morning-digest § 1. Reads runs/<night>.jsonl into one row per job.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Parses one log line; null when it isn't valid JSON or a field is missing or wrong.
export function parseLine(text: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const { at, job, status, owner, error } = raw;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status as RunStatus)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const line: RunLine = { at, job, status: status as RunStatus, owner };
  if (error !== undefined) line.error = error;
  return line;
}

export const readNight: ReadNight = (runsDir, night) => {
  // Only a plain date names a night; anything else (e.g. "../x") has no file.
  if (!NIGHT.test(night)) return null;

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if (isRecord(err) && (err.code === 'ENOENT' || err.code === 'EISDIR')) return null;
    throw err;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const rawLine of text.split('\n')) {
    if (rawLine.trim() === '') continue;
    const line = parseLine(rawLine);
    if (!line) {
      badLines++;
      continue;
    }
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.owner = line.owner;
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    if (line.error !== undefined) row.lastError = line.error;
    row.lastAt = line.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  const result: Night = { night, rows, badLines };
  return result;
};
