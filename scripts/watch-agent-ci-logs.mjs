#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const logsRoot = process.argv[2];
const sinceMs = Number(process.argv[3] || process.env.AGENT_CI_WATCH_SINCE_MS || '0');
const initialCutoffMs = Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs - 30_000 : 0;

if (!logsRoot) {
  console.error('Usage: watch-agent-ci-logs.mjs <logs-root> [since-ms]');
  process.exit(1);
}

const watched = new Map();
let currentRunDir = '';
let currentHeader = '';
let announcedWaiting = false;
let announcedRunDir = '';
let announcedStreamingForRun = '';

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return undefined;
  }
}

function readMetadataDate(runDir) {
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(runDir, 'metadata.json'), 'utf8'));
    return typeof metadata.date === 'number' ? metadata.date : 0;
  } catch {
    return 0;
  }
}

function discoverFiles(runDir, { includeInternal = false } = {}) {
  const candidates = [];
  const stepsDir = path.join(runDir, 'steps');
  if (!fs.existsSync(stepsDir)) {
    return candidates;
  }

  for (const entry of fs.readdirSync(stepsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.log')) {
      continue;
    }

    // Internal agent-ci/action runner logs are usually numeric or UUID-named.
    // The human-named step logs contain the useful command output.
    if (!includeInternal && (/^\d+\.log$/.test(entry.name) || /^[0-9a-f-]{36}\.log$/i.test(entry.name))) {
      continue;
    }

    candidates.push(path.join(stepsDir, entry.name));
  }

  candidates.sort((a, b) => {
    const aStat = safeStat(a);
    const bStat = safeStat(b);
    return (aStat?.mtimeMs ?? 0) - (bStat?.mtimeMs ?? 0) || a.localeCompare(b);
  });
  return candidates;
}

function runScore(runDir) {
  let score = readMetadataDate(runDir);
  for (const fileName of ['metadata.json', 'timeline.json', 'debug.log', 'outputs.json']) {
    const stat = safeStat(path.join(runDir, fileName));
    if (stat) {
      score = Math.max(score, stat.mtimeMs);
    }
  }
  const stepsStat = safeStat(path.join(runDir, 'steps'));
  if (stepsStat) {
    score = Math.max(score, stepsStat.mtimeMs);
  }

  // Standalone use (no since-ms) should still pick the latest updated run,
  // even if only a step log changed. Release runs pass since-ms and avoid this
  // more expensive scan across historical log directories.
  if (initialCutoffMs === 0) {
    for (const filePath of discoverFiles(runDir, { includeInternal: true })) {
      const stat = safeStat(filePath);
      if (stat) {
        score = Math.max(score, stat.mtimeMs);
      }
    }
  }
  return score;
}

function latestRunDir() {
  if (!fs.existsSync(logsRoot)) {
    return '';
  }

  const dirs = fs
    .readdirSync(logsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('agent-ci-'))
    .map((d) => path.join(logsRoot, d.name));

  if (dirs.length === 0) {
    return '';
  }

  const scored = dirs
    .map((dir) => ({ dir, score: runScore(dir) }))
    .filter((entry) => entry.score >= initialCutoffMs);

  if (initialCutoffMs > 0 && scored.length === 0) {
    return '';
  }

  const candidates = scored.length > 0 ? scored : dirs.map((dir) => ({ dir, score: runScore(dir) }));
  candidates.sort((a, b) => b.score - a.score || b.dir.localeCompare(a.dir));
  return candidates[0]?.dir ?? '';
}

function redact(text) {
  return text
    .replace(/(\/\/registry\.npmjs\.org\/:_authToken=)[^\s"']+/g, '$1***')
    .replace(/(authId=)[A-Za-z0-9-]+/g, '$1***')
    .replace(/\bnpm_[A-Za-z0-9_=-]+\b/g, 'npm_***')
    .replace(/\bgithub_pat_[A-Za-z0-9_]+\b/g, 'github_pat_***')
    .replace(/\bgh[opsu]_[A-Za-z0-9_]+\b/g, 'gh_***')
    .replace(/((?:NPM_TOKEN|GH_TOKEN|GH_TOKEN_FOR_RELEASES|NODE_AUTH_TOKEN)\s*[:=]\s*)[^\s]+/g, '$1***');
}

function printHeader(filePath) {
  if (announcedStreamingForRun !== currentRunDir) {
    announcedStreamingForRun = currentRunDir;
    process.stdout.write(`[release] Streaming agent-ci logs from ${path.basename(currentRunDir)}\n`);
  }

  if (!currentHeader) {
    currentHeader = filePath;
    process.stdout.write(`\n--- ${path.relative(logsRoot, filePath)} ---\n`);
  } else if (currentHeader !== filePath) {
    currentHeader = filePath;
    process.stdout.write(`\n--- ${path.relative(logsRoot, filePath)} ---\n`);
  }
}

function streamNewBytes(filePath) {
  try {
    const stat = fs.statSync(filePath);
    let prev = watched.get(filePath);

    if (prev === undefined) {
      // When agent-ci reuses a log directory, it can leave stale step logs behind.
      // Skip old files, but stream new/current step logs from the beginning.
      prev = initialCutoffMs > 0 && stat.mtimeMs < initialCutoffMs ? stat.size : 0;
    }

    if (stat.size < prev) {
      prev = 0;
    }
    if (stat.size === prev) {
      watched.set(filePath, prev);
      return;
    }

    const fd = fs.openSync(filePath, 'r');
    const chunk = Buffer.alloc(stat.size - prev);
    fs.readSync(fd, chunk, 0, chunk.length, prev);
    fs.closeSync(fd);

    printHeader(filePath);
    const text = redact(chunk.toString('utf8'));
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
    watched.set(filePath, stat.size);
  } catch {
    // Ignore transient file disappearance while agent-ci rotates/creates logs.
  }
}

function rescan() {
  const runDir = latestRunDir();
  if (!runDir) {
    if (!announcedWaiting) {
      process.stdout.write(`[release] Waiting for agent-ci logs in ${logsRoot}\n`);
      announcedWaiting = true;
    }
    return;
  }

  if (runDir !== currentRunDir) {
    currentRunDir = runDir;
    watched.clear();
    currentHeader = '';
    announcedStreamingForRun = '';
  }

  if (announcedRunDir !== runDir) {
    announcedRunDir = runDir;
    process.stdout.write(`[release] Found agent-ci run ${path.basename(runDir)}; waiting for runner output...\n`);
  }

  for (const filePath of discoverFiles(runDir)) {
    streamNewBytes(filePath);
  }
}

const interval = setInterval(rescan, 500);
process.on('SIGINT', () => {
  clearInterval(interval);
  process.exit(0);
});
process.on('SIGTERM', () => {
  clearInterval(interval);
  process.exit(0);
});

rescan();
