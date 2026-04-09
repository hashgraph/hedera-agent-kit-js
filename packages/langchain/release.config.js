module.exports = {
  branches: ['main'],
  tagFormat: 'v${version}-langchain',
  plugins: [
    [
      '@semantic-release/exec',
      {
        analyzeCommitsCmd: 'node release/analyze.js packages/langchain "v*-langchain"',
        generateNotesCmd: 'node release/notes.js packages/langchain "v*-langchain"',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'packages/langchain',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['packages/langchain/package.json'],
        message: 'chore(release): ${nextRelease.version}',
      },
    ],
    '@semantic-release/github',
  ],
};
