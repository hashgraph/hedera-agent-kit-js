module.exports = {
  branches: ['main'],
  tagFormat: 'v${version}-ai-sdk',
  plugins: [
    [
      '@semantic-release/exec',
      {
        analyzeCommitsCmd: 'node release/analyze.js packages/ai-sdk "v*-ai-sdk"',
        generateNotesCmd: 'node release/notes.js packages/ai-sdk "v*-ai-sdk"',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'packages/ai-sdk',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['packages/ai-sdk/package.json'],
        message: 'chore(release): ${nextRelease.version}',
      },
    ],
    '@semantic-release/github',
  ],
};
