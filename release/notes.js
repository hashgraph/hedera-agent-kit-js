const { execSync } = require('node:child_process');

const [pkgDir, tagMatch] = process.argv.slice(2);

if (!pkgDir || !tagMatch) {
  console.error('Usage: node notes.js <pkgDir> <tagMatch>');
  process.exit(1);
}

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

function getRepoSlug() {
  const remote = sh('git remote get-url origin');
  const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

function getRepoUrl() {
  const slug = getRepoSlug();
  return slug ? `https://github.com/${slug}` : null;
}

function getLastTag() {
  try {
    return sh(`git describe --tags --match "${tagMatch}" --abbrev=0`);
  } catch {
    return null;
  }
}

function getCommitHashes(range) {
  const fmt = '--pretty=format:%H';
  const cmd = range
    ? `git log ${range} ${fmt}`
    : `git log ${fmt}`;
  const output = execSync(cmd, { encoding: 'utf8' }).trim();
  return output ? output.split('\n') : [];
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

const loginCache = new Map();

function getGitHubLogin(hash) {
  const slug = getRepoSlug();
  if (!slug) return null;

  if (loginCache.has(hash)) return loginCache.get(hash);

  try {
    const json = sh(`gh api repos/${slug}/commits/${hash} --jq ".author.login"`);
    const login = json || null;
    loginCache.set(hash, login);
    return login;
  } catch {
    loginCache.set(hash, null);
    return null;
  }
}

function getAssociatedPR(hash) {
  const slug = getRepoSlug();
  if (!slug) return null;

  try {
    const prNum = sh(
      `gh api repos/${slug}/commits/${hash}/pulls --jq ".[0].number"`,
    );
    return prNum || null;
  } catch {
    return null;
  }
}

function formatEntry(hash, subject, repoUrl) {
  const login = getGitHubLogin(hash);
  const authorPart = login ? `@${login}` : sh(`git log -1 --pretty=format:%an ${hash}`);

  let prNum = subject.match(/\(#(\d+)\)\s*$/)?.[1] ?? null;
  if (!prNum) prNum = getAssociatedPR(hash);

  if (prNum && repoUrl) {
    return `* ${subject} by ${authorPart} in ${repoUrl}/pull/${prNum}`;
  }

  return `* ${subject} by ${authorPart}`;
}

const repoUrl = getRepoUrl();
const tag = getLastTag();
const range = tag ? `${tag}..HEAD` : 'HEAD';
const hashes = getCommitHashes(range);

const entries = [];
for (const hash of hashes) {
  const files = getCommitFiles(hash);
  if (!touchesPackage(files)) continue;

  const subject = sh(`git log -1 --pretty=format:%s ${hash}`);
  entries.push(formatEntry(hash, subject, repoUrl));
}

const parts = [];

if (entries.length) {
  parts.push('## What\'s Changed', ...entries);
} else {
  parts.push('No changes');
}

if (tag) {
  parts.push('', `**Full Changelog**: ${repoUrl}/compare/${tag}...HEAD`);
}

process.stdout.write(parts.join('\n'));
