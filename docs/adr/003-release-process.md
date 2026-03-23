# ADR 003: NPM Release Process

- **Status:** Implemented
- **Date:** 2025-01-27
- **Updated:** 2026-03-20

## Context

The Hedera Agent Kit TypeScript SDK (`typescript/` package) needs to be published to NPM for distribution to developers. Currently, there is no standardized release process, which could lead to:

1. **Inconsistent releases**: Manual releases may miss steps or introduce errors
2. **Version management issues**: No clear process for version bumping and changelog management
3. **Quality assurance gaps**: Releases may not be properly tested before publication
4. **Documentation lag**: Release notes and documentation may not be updated timely
5. **Security concerns**: No automated security checks before releases

The project follows GitLab Flow with a single `main` branch as the primary development and release branch. Feature development is done through feature branches that are merged directly into `main`.

The TypeScript package contains:
- Core SDK functionality for Hedera network interaction
- Multiple framework integrations (LangChain, AI SDK, Model Context Protocol)
- Plugin system for extending functionality
- Shared utilities and types

We need a reliable, automated release process that ensures quality, consistency, and proper version management for the TypeScript SDK package.

## Decision

We will implement a **comprehensive release process** with the following key components:

### 1. Version Management Strategy

#### Semantic Versioning
- Follow [Semantic Versioning 2.0.0](https://semver.org/) (MAJOR.MINOR.PATCH)
- **MAJOR**: Breaking changes in public API
- **MINOR**: New features in a backward-compatible manner
- **PATCH**: Backward-compatible bug fixes

#### Commit Message Conventions
- Follow [Conventional Commits](https://www.conventionalcommits.org/) specification
- **feat**: New features (triggers MINOR version bump)
- **fix**: Bug fixes (triggers PATCH version bump)
- **BREAKING CHANGE**: Breaking changes (triggers MAJOR version bump)
- **docs**: Documentation changes (no version bump)
- **style**: Code style changes (no version bump)
- **refactor**: Code refactoring (no version bump)
- **test**: Test changes (no version bump)
- **chore**: Maintenance tasks (no version bump)

#### Version Bumping
- **Automated**: Use `semantic-release` for managing version bumps and changelogs based on commit messages
- **Manual override**: Allow manual version bumps for hotfixes or special releases

### 2. Release Workflow

#### Test Execution Strategy

##### Branch-Level Testing
- **Any commit on any branch**: Unit tests run automatically
- **Pull requests to main**: Integration tests and tool-calling validation tests run automatically
- **Releases**: All tests (unit, integration, tool-calling validation, end-to-end) run with multiple LLM validation

##### LLM Testing Strategy
- **Single LLM for PRs**: GPT-4 (most reliable for tool-calling accuracy)
- **Multiple LLMs for releases**: GPT-4, and other supported LLMs for compatibility validation

#### Release Process
1. **Commit Changes**: Use conventional commit messages (feat, fix, breaking change, etc.)
2. **Push to Main**: Changes are pushed to the main branch
3. **Manual Release Trigger**: Release is manually triggered via GitHub Actions or CLI on Thursday
4. **Run Tests**: All tests pass (unit, integration, tool-calling validation, E2E) with multiple LLM validation
5. **Analyze Commits**: semantic-release analyzes commit messages to determine version bump
6. **Generate Release Notes**: Automated changelog generation based on commits
7. **Create Git Tag**: semantic-release creates version tag
8. **Publish to NPM**: Automated publication to NPM registry
9. **Create GitHub Release**: Automated GitHub release with release notes

### 3. Automation Tools

#### GitHub Actions Workflows

##### PR Testing Workflow
```yaml
name: PR Tests
on:
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: |
          cd typescript
          npm ci
      - name: Run unit tests
        run: |
          cd typescript
          npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: |
          cd typescript
          npm ci
      - name: Run integration tests
        run: |
          cd typescript
          npm run test:integration
      - name: Run tool-calling validation tests (single LLM)
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          cd typescript
          npm run test:tool-calling -- --llm=gpt-4
```

##### Release Workflow

The actual release workflow (`.github/workflows/release.yml`) uses a multi-job pipeline:

1. **Test gates**: `unit-tests` → `integration-tests` → `e2e-tests` (reusable workflows)
2. **`prepare-release`**: Runs `semantic-release --dry-run` to detect the next version, outputs `version` and `need-release`
3. **`create-github-release`**: Runs semantic-release for real (creates tag, GitHub release, commits version bump), builds the package, packs a tarball, and uploads it as an artifact. Release commits are GPG-signed.
4. **`publish-npm-package`**: Downloads the tarball artifact and publishes to npm with `--access=public --provenance` using OIDC trusted publishing (`id-token: write`). Skipped during dry runs.

```yaml
name: Release
on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run (no actual release)'
        required: true
        default: true
        type: boolean

jobs:
  unit-tests:
    uses: ./.github/workflows/run-unit-tests.yml

  integration-tests:
    needs: [ unit-tests ]
    uses: ./.github/workflows/run-integration-tests.yml

  e2e-tests:
    needs: [ integration-tests ]
    uses: ./.github/workflows/run-e2e-tests.yml

  prepare-release:
    needs: [ e2e-tests ]
    # Runs semantic-release --dry-run, outputs version and need-release

  create-github-release:
    needs: [ prepare-release ]
    # Runs semantic-release, builds, packs tarball, uploads artifact

  publish-npm-package:
    needs: [ create-github-release, prepare-release ]
    # Downloads artifact, publishes with npm publish --provenance
```

##### Branch Testing Workflow
```yaml
name: Branch Tests
on:
  push:
    branches-ignore: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: |
          cd typescript
          npm ci
      - name: Run unit tests
        run: |
          cd typescript
          npm run test:unit
```

#### Semantic-Release Workflow Steps
1. **Verify Conditions**: Check if release should proceed
2. **Get Last Release**: Analyze Git tags to find the last release
3. **Analyze Commits**: Determine release type based on commit messages
4. **Verify Release**: Write VERSION file via `@semantic-release/exec`
5. **Generate Notes**: Create release notes from commits
6. **Create Git Tag**: Tag the new release version
7. **Prepare**: Bump version in `typescript/package.json` via `@semantic-release/exec`
8. **Commit**: Commit updated package.json via `@semantic-release/git`
9. **GitHub Release**: Create GitHub release via `@semantic-release/github`

NPM publishing is handled in a separate workflow job using OIDC trusted publishing.

#### Semantic-Release Configuration
```json
{
  "branches": ["main"],
  "plugins": [
    ["@semantic-release/commit-analyzer", { "preset": "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { "preset": "conventionalcommits" }],
    ["@semantic-release/exec", {
      "verifyReleaseCmd": "echo ${nextRelease.version} > VERSION",
      "prepareCmd": "cd typescript && npm version ${nextRelease.version} --no-git-tag-version"
    }],
    ["@semantic-release/git", {
      "assets": ["typescript/package.json", "typescript/package-lock.json"],
      "message": "chore(release): ${nextRelease.version} [skip ci]"
    }],
    "@semantic-release/github"
  ]
}
```

Note: semantic-release runs from the repository root (not from `typescript/`). The `@semantic-release/exec` plugin writes a `VERSION` file used to pass the version between workflow jobs, and bumps `typescript/package.json`. Publishing to NPM is handled separately via OIDC trusted publishing rather than `@semantic-release/npm`.

### 4. Package Structure

#### TypeScript SDK Package (`@hashgraph/hedera-agent-kit`)
- **Location**: `typescript/`
- **Entry Points**: ESM and CJS builds via tsup
- **Files**: Distribution files only (`dist/**/*`)
- **Dependencies**: All runtime dependencies
- **Dev Dependencies**: Build and test tools
- **Package Name**: `@hashgraph/hedera-agent-kit`

### 5. Release Channels

#### Stable Releases
- **Branch**: `main`
- **Tag Format**: `vX.Y.Z`
- **NPM Tag**: `latest`
- **Trigger**: Manual via GitHub Actions workflow_dispatch on Thursday
- **Frequency**: As needed, typically bi-weekly or monthly

#### Hotfixes
- **Branch**: `hotfix/vX.Y.Z` (temporary branch from main)
- **Tag Format**: `vX.Y.Z`
- **NPM Tag**: `latest`
- **Trigger**: Manual via GitHub Actions workflow_dispatch
- **Frequency**: As needed for critical fixes

### 6. Testing Schedule and LLM Strategy

#### Weekly Testing Schedule
- **Thursday Releases**: Actual releases after successful pre-release testing
- **Continuous**: Unit tests on every commit, integration and tool-calling tests on PRs

#### LLM Testing Configuration
- **Primary LLM (GPT-4)**: Used for all PR testing and as the baseline for releases
- **Secondary LLMs (Claude, others)**: Used for release validation to ensure multi-LLM compatibility
- **Test Coverage**: 
  - PRs: Single LLM (GPT-4) for tool-calling validation
  - Releases: Multiple LLMs for comprehensive compatibility testing

#### Test Execution Matrix
| Test Type | Branch Commits | PR to Main | Release (Thursday) |
|-----------|----------------|------------|-------------------|
| Unit Tests | ✅ | ✅ | ✅ |
| Integration Tests | ❌ | ✅ | ✅ 
| Tool-calling Tests | ❌ | ✅ (GPT-4 only) | ✅ (All LLMs) |
| E2E Tests | ❌ | ❌ | ✅ (All LLMs) |

### 7. Release Triggers

#### Manual Release Control
- **GitHub Actions**: Manual trigger via `workflow_dispatch` event
- **Dry Run Support**: Test release process without actual publishing
- **CLI Option**: Local release via `npx semantic-release` command
- **Release Approval**: Human oversight before publishing to NPM

#### Benefits of Manual Triggers
- **Quality Control**: Ensures releases are intentional and reviewed
- **Batch Releases**: Multiple commits can be released together
- **Timing Control**: Releases can be scheduled for optimal timing
- **Emergency Control**: Prevents accidental releases from broken commits
- **Release Coordination**: Aligns releases with marketing, documentation, and support

### 8. Quality Gates

#### Automated Checks
- **Tests**: All test suites must pass
- **Linting**: ESLint and Prettier checks pass
- **Type Checking**: TypeScript compilation succeeds
- **Build**: Package builds successfully

#### Manual Checks
- **Code Review**: At least one approval required
- **Documentation**: Release notes and API docs updated
- **Breaking Changes**: Proper migration guide if applicable
- **Release Approval**: Manual trigger ensures intentional releases

### 9. Rollback Strategy

#### NPM Unpublish
- **Time Limit**: 72 hours after publication
- **Process**: Unpublish and republish with corrected version
- **Communication**: Immediate notification to users

#### Git Tag Management
- **Delete Tag**: Remove incorrect tag
- **Create New Tag**: Tag with corrected version
- **Force Push**: Update remote repository

## Consequences

### Positive Consequences

1. **Consistency**: Standardized release process reduces errors and inconsistencies
2. **Automation**: Reduces manual work and human error in releases
3. **Quality Assurance**: Automated checks ensure releases meet quality standards
4. **Traceability**: Clear version history and changelog for all releases
5. **Developer Experience**: Reliable and predictable release schedule
6. **Security**: Automated security checks before each release
7. **Documentation**: Automated generation of release notes and changelog
8. **Rollback Capability**: Quick recovery from problematic releases

### Negative Consequences

1. **Complexity**: Additional tooling and processes increase project complexity
2. **Learning Curve**: Team members need to learn new tools and processes
3. **Maintenance Overhead**: Tools and workflows require ongoing maintenance
4. **Process Rigidity**: Structured process may slow down urgent releases
5. **Infrastructure Costs**: CI/CD pipeline and tooling require resources

### Risks and Mitigation

#### Risk: Release Process Failure
- **Mitigation**: Comprehensive testing of release workflow, manual override capabilities

#### Risk: Security Vulnerabilities in Dependencies
- **Mitigation**: Automated security scanning, regular dependency updates

#### Risk: Breaking Changes Without Proper Communication
- **Mitigation**: Automated changelog generation, clear migration guides

#### Risk: NPM Publishing Issues
- **Mitigation**: OIDC trusted publishing (no token rotation needed), rollback procedures, artifact-based publish separates build from publish

#### Risk: Git Tag Conflicts
- **Mitigation**: Unique versioning strategy, proper branch protection rules

## Alternatives Considered

### Alternative 1: Manual Release Process
- Manual version bumping and changelog updates
- Manual NPM publishing
- **Rejected**: Too error-prone and inconsistent

### Alternative 2: Automatic Releases on Every Push
- Automatically publish every commit to main to NPM
- **Rejected**: Too risky, could publish broken code, no quality control

### Alternative 3: Simple GitHub Actions Only
- Basic GitHub Actions workflow without semantic-release
- Manual changelog management
- **Rejected**: Lacks proper version management and changelog automation

### Alternative 4: Monorepo with Lerna
- Use Lerna for managing multiple packages
- **Rejected**: Overkill for current project structure, adds unnecessary complexity

### Alternative 5: Changesets Tool
- Use changesets for managing releases
- **Rejected**: semantic-release better suited for our needs, more mature and widely adopted

### Alternative 6: GitHub Releases Only
- Rely solely on GitHub releases without NPM
- **Rejected**: NPM is essential for JavaScript/TypeScript package distribution

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Semantic-Release Documentation](https://www.npmjs.com/package/semantic-release)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Hiero SDK Release Process](https://github.com/hiero-ledger/hiero-sdk-js)

## Related ADRs

- [ADR-001: Dual Build with tsup for ESM and CJS](./001-build-esm-cjs-bundle.md)
- [ADR-002: Comprehensive Testing Strategy](./002-testing-strategy.md)

## Review Schedule

This ADR should be reviewed:
- **Monthly**: Check implementation progress and effectiveness
- **Quarterly**: Evaluate process efficiency and make improvements
- **Annually**: Comprehensive review and potential updates

---

**Author**: [To be filled]
**Date**: 2025-01-27
**Reviewers**: [To be filled]
