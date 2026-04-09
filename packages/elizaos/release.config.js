module.exports = {
  branches: ['main'],
  tagFormat: 'v${version}-elizaos',
  plugins: [
    [
      '@semantic-release/exec',
      {
        analyzeCommitsCmd: 'node release/analyze.js packages/elizaos "v*-elizaos"',
        generateNotesCmd: 'node release/notes.js packages/elizaos "v*-elizaos"',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'packages/elizaos',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['packages/elizaos/package.json'],
        message: 'chore(release): ${nextRelease.version}',
      },
    ],
    '@semantic-release/github',
  ],
};
