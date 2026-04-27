import fs from 'fs';

const diff = fs.readFileSync('/tmp/pkg-diff.txt', 'utf8');
const lines = diff.split('\n');

const changes = [];
let currentFile = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('diff --git a/')) {
    const m = line.match(/diff --git a\/(.+?) b\/\1/);
    if (m) currentFile = m[1];
    continue;
  }
  if (!currentFile) continue;
  // Look for removed version lines
  if (line.startsWith('-    "') && line.includes('": "') && !line.includes('+++')) {
    const nextLine = lines[i + 1];
    if (nextLine && nextLine.startsWith('+    "') && nextLine.includes('": "')) {
      const oldMatch = line.match(/-    "([^"]+)": "([^"]+)"/);
      const newMatch = nextLine.match(/\+    "([^"]+)": "([^"]+)"/);
      if (oldMatch && newMatch && oldMatch[1] === newMatch[1]) {
        changes.push({ file: currentFile, pkg: oldMatch[1], old: oldMatch[2], new: newMatch[2] });
        i++; // skip next line
      }
    }
  }
}

// Group by pkg
const grouped = {};
for (const c of changes) {
  const key = `${c.pkg}|${c.old}|${c.new}`;
  if (!grouped[key]) grouped[key] = { pkg: c.pkg, old: c.old, new: c.new, files: [] };
  grouped[key].files.push(c.file);
}

const rows = Object.values(grouped).sort((a, b) => a.pkg.localeCompare(b.pkg));

console.log('| Package | Old | New | Location |');
console.log('|---|---|---|---|');
for (const row of rows) {
  const files = row.files.length > 5 ? row.files.slice(0, 5).join(', ') + ` and ${row.files.length - 5} more` : row.files.join(', ');
  console.log(`| ${row.pkg} | ${row.old} | ${row.new} | ${files} |`);
}
