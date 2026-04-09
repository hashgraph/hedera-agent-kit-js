module.exports = {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    [
      '@semantic-release/exec',
      {
        analyzeCommitsCmd: 'node release/analyze.js packages/core "v*"',
        generateNotesCmd: 'node release/notes.js packages/core "v*"',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'packages/core',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['packages/core/package.json'],
        message: 'chore(release): ${nextRelease.version}',
      },
    ],
    '@semantic-release/github',
  ],
};
