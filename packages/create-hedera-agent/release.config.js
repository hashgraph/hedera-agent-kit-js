module.exports = {
  branches: ['main'],
  tagFormat: 'v${version}-create-hedera-agent',
  plugins: [
    [
      '@semantic-release/exec',
      {
        analyzeCommitsCmd:
          'node release/analyze.js packages/create-hedera-agent "v*-create-hedera-agent"',
        generateNotesCmd:
          'node release/notes.js packages/create-hedera-agent "v*-create-hedera-agent"',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'packages/create-hedera-agent',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['packages/create-hedera-agent/package.json'],
        message: 'chore(release): ${nextRelease.version}',
      },
    ],
    '@semantic-release/github',
  ],
};
