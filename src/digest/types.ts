// Plan morning-digest § 1. The shape every part of the digest builds against: the reader fills
// it, the page (§ 2a), the JSON (§ 2b) and the board link (§ 2c) only read it.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string; // ISO 8601 with the log's own offset; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as "—"
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one; null renders as "—"
  firstAt: string; // `at` of the first line, as written in the log
  lastAt: string; // `at` of the last line, as written in the log
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
};

// Reads runs/<night>.jsonl. Returns null when the night has no file (the routes answer 404).
// An empty file returns { rows: [], badLines: 0 }.
export type ReadNight = (runsDir: string, night: string) => Night | null;
