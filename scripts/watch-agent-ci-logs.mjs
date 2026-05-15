#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const logsRoot = process.argv[2];
if (!logsRoot) {
  console.error('Usage: watch-agent-ci-logs.mjs <logs-root>');
  process.exit(1);
}

const watched = new Map();
let currentRunDir = '';
let currentHeader = '';

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
  dirs.sort((a, b) => {
    const aStat = fs.statSync(a);
    const bStat = fs.statSync(b);
    return bStat.mtimeMs - aStat.mtimeMs;
  });
  return dirs[0];
}

function discoverFiles(runDir) {
  const candidates = [];
  const stepsDir = path.join(runDir, 'steps');
  if (fs.existsSync(stepsDir)) {
    for (const entry of fs.readdirSync(stepsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.log')) {
        candidates.push(path.join(stepsDir, entry.name));
      }
    }
  }
  return candidates;
}

function streamNewBytes(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const prev = watched.get(filePath) ?? 0;
    if (stat.size < prev) {
      watched.set(filePath, 0);
      return;
    }
    if (stat.size === prev) {
      return;
    }
    const fd = fs.openSync(filePath, 'r');
    const chunk = Buffer.alloc(stat.size - prev);
    fs.readSync(fd, chunk, 0, chunk.length, prev);
    fs.closeSync(fd);
    if (!currentHeader) {
      currentHeader = filePath;
      process.stdout.write(`\n--- ${path.relative(logsRoot, filePath)} ---\n`);
    } else if (currentHeader !== filePath) {
      currentHeader = filePath;
      process.stdout.write(`\n--- ${path.relative(logsRoot, filePath)} ---\n`);
    }
    const text = chunk.toString('utf8');
    for (const line of text.split(/\r?\n/)) {
      if (line.length > 0) {
        process.stdout.write(`[${new Date().toISOString()}] ${line}\n`);
      }
    }
    watched.set(filePath, stat.size);
  } catch {
    // ignore transient file disappearance
  }
}

function rescan() {
  const runDir = latestRunDir();
  if (!runDir) {
    return;
  }
  if (runDir !== currentRunDir) {
    currentRunDir = runDir;
    watched.clear();
    currentHeader = '';
  }
  for (const filePath of discoverFiles(runDir)) {
    if (!watched.has(filePath)) {
      watched.set(filePath, 0);
    }
    streamNewBytes(filePath);
  }
}

const interval = setInterval(rescan, 250);
process.on('SIGINT', () => {
  clearInterval(interval);
  process.exit(0);
});
process.on('SIGTERM', () => {
  clearInterval(interval);
  process.exit(0);
});

rescan();
