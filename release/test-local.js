const { execSync } = require('node:child_process');

const packages = [
  { dir: 'packages/core', tagMatch: 'v*' },
  { dir: 'packages/ai-sdk', tagMatch: 'v*-ai-sdk' },
  { dir: 'packages/langchain', tagMatch: 'v*-langchain' },
  { dir: 'packages/elizaos', tagMatch: 'v*-elizaos' },
  { dir: 'packages/mcp', tagMatch: 'v*-mcp' },
  { dir: 'packages/create-hedera-agent', tagMatch: 'v*-create-hedera-agent' },
];

for (const { dir, tagMatch } of packages) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 ${dir} (tag: ${tagMatch})`);
  console.log('='.repeat(60));

  const bump = execSync(
    `node release/analyze.js ${dir} "${tagMatch}"`,
    { encoding: 'utf8' },
  ).trim();

  console.log(`Bump: ${bump || '(none — no release needed)'}`);

  const notes = execSync(
    `node release/notes.js ${dir} "${tagMatch}"`,
    { encoding: 'utf8' },
  ).trim();

  console.log(notes);
}
