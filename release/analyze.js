const { execSync } = require('node:child_process');

const [pkgDir, tagMatch] = process.argv.slice(2);

if (!pkgDir || !tagMatch) {
  console.error('Usage: node analyze.js <pkgDir> <tagMatch>');
  process.exit(1);
}

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

function getLastTag() {
  try {
    return sh(`git describe --tags --match "${tagMatch}" --abbrev=0`);
  } catch {
    return null;
  }
}

function getCommits(range) {
  const fmt = '--pretty=format:%H';
  const cmd = range
    ? `git log ${range} ${fmt}`
    : `git log ${fmt}`;
  const output = execSync(cmd, { encoding: 'utf8' }).trim();
  return output ? output.split('\n') : [];
}

function getCommitMessage(hash) {
  return execSync(`git log -1 --pretty=format:%s ${hash}`, {
    encoding: 'utf8',
  }).trim();
}

function getCommitFiles(hash) {
  return execSync(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
}

function touchesPackage(files) {
  return files.some((f) => f.startsWith(`${pkgDir}/`));
}

function getBumpType(subject) {
  if (/^.+!:\s/.test(subject)) return 'major';
  if (/^feat(\(.+\))?:\s/.test(subject)) return 'minor';
  if (/^(fix|perf)(\(.+\))?:\s/.test(subject)) return 'patch';
  return null;
}

const tag = getLastTag();
const hashes = getCommits(tag ? `${tag}..HEAD` : null);

let level = null;
const rank = { patch: 1, minor: 2, major: 3 };

for (const hash of hashes) {
  const files = getCommitFiles(hash);
  if (!touchesPackage(files)) continue;

  const subject = getCommitMessage(hash);
  const t = getBumpType(subject);
  if (t && (!level || rank[t] > rank[level])) level = t;
}

if (level) process.stdout.write(level);
