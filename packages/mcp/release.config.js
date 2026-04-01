module.exports = {
  branches: ['main'],
  tagFormat: 'v${version}-mcp',
  plugins: [
    [
      '@semantic-release/exec',
      {
        analyzeCommitsCmd: 'node release/analyze.js packages/mcp "v*-mcp"',
        generateNotesCmd: 'node release/notes.js packages/mcp "v*-mcp"',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'packages/mcp',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['packages/mcp/package.json'],
        message: 'chore(release): ${nextRelease.version}',
      },
    ],
    '@semantic-release/github',
  ],
};
