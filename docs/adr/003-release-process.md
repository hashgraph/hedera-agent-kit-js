# ADR 003: NPM Release Process

- **Status:** Proposed
- **Date:** 2025-01-27

## Context

The Hedera Agent Kit TypeScript SDK (`typescript/` package) needs to be published to NPM for distribution to developers. Currently, there is no standardized release process, which could lead to:

1. **Inconsistent releases**: Manual releases may miss steps or introduce errors
2. **Version management issues**: No clear process for version bumping and changelog management
3. **Quality assurance gaps**: Releases may not be properly tested before publication
4. **Documentation lag**: Release notes and documentation may not be updated timely
5. **Security concerns**: No automated security checks before releases

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
- **Pre-release support**: Support for alpha, beta, and RC releases

### 2. Release Workflow

#### Pre-release Checklist
1. **Code Quality**: All tests pass (unit, integration, E2E)
2. **Documentation**: README, API docs, and examples are up-to-date
3. **Security**: Security audit passes, no known vulnerabilities
4. **Dependencies**: All dependencies are up-to-date and secure
5. **Build Verification**: Package builds successfully for both ESM and CJS

#### Release Process
1. **Commit Changes**: Use conventional commit messages (feat, fix, breaking change, etc.)
2. **Push to Main**: Changes are pushed to the main branch
3. **Manual Release Trigger**: Release is manually triggered via GitHub Actions or CLI
4. **Run Tests**: All tests pass (unit, integration, E2E)
5. **Analyze Commits**: semantic-release analyzes commit messages to determine version bump
6. **Generate Release Notes**: Automated changelog generation based on commits
7. **Create Git Tag**: semantic-release creates version tag
8. **Publish to NPM**: Automated publication to NPM registry
9. **Create GitHub Release**: Automated GitHub release with release notes

### 3. Automation Tools

#### GitHub Actions Workflow
```yaml
name: Release
on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run (no actual release)'
        required: false
        default: 'false'
        type: boolean

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          
      - name: Install dependencies
        run: |
          cd typescript
          npm ci
          
      - name: Run tests
        run: |
          cd typescript
          npm run test
          npm run test:coverage
          
      - name: Build package
        run: |
          cd typescript
          npm run build
          
      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          cd typescript
          if [ "${{ github.event.inputs.dry_run }}" = "true" ]; then
            npx semantic-release --dry-run
          else
            npx semantic-release
          fi
```

#### Semantic-Release Workflow Steps
1. **Verify Conditions**: Check if release should proceed
2. **Get Last Release**: Analyze Git tags to find the last release
3. **Analyze Commits**: Determine release type based on commit messages
4. **Verify Release**: Ensure release conformity
5. **Generate Notes**: Create release notes from commits
6. **Create Git Tag**: Tag the new release version
7. **Prepare**: Prepare the release artifacts
8. **Publish**: Publish to NPM registry
9. **Notify**: Notify about new releases

#### Semantic-Release Configuration
```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/git",
    "@semantic-release/github"
  ]
}
```

### 4. Package Structure

#### TypeScript SDK Package (`hedera-agent-kit`)
- **Location**: `typescript/`
- **Entry Points**: ESM and CJS builds via tsup
- **Files**: Distribution files only (`dist/**/*`)
- **Dependencies**: All runtime dependencies
- **Dev Dependencies**: Build and test tools
- **Package Name**: `hedera-agent-kit`

### 5. Release Channels

#### Stable Releases
- **Branch**: `main`
- **Tag Format**: `vX.Y.Z`
- **NPM Tag**: `latest`
- **Trigger**: Manual via GitHub Actions workflow_dispatch
- **Frequency**: As needed, typically bi-weekly or monthly

#### Pre-releases
- **Branch**: `develop` or feature branches
- **Tag Format**: `vX.Y.Z-alpha.N`, `vX.Y.Z-beta.N`, `vX.Y.Z-rc.N`
- **NPM Tag**: `alpha`, `beta`, `rc`
- **Trigger**: Manual via GitHub Actions workflow_dispatch
- **Frequency**: Weekly or as needed

#### Hotfixes
- **Branch**: `hotfix/vX.Y.Z`
- **Tag Format**: `vX.Y.Z`
- **NPM Tag**: `latest`
- **Trigger**: Manual via GitHub Actions workflow_dispatch
- **Frequency**: As needed for critical fixes

### 6. Release Triggers

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

### 7. Quality Gates

#### Automated Checks
- **Tests**: All test suites must pass
- **Linting**: ESLint and Prettier checks pass
- **Type Checking**: TypeScript compilation succeeds
- **Build**: Package builds successfully
- **Security**: No known vulnerabilities in dependencies

#### Manual Checks
- **Code Review**: At least one approval required
- **Documentation**: Release notes and API docs updated
- **Breaking Changes**: Proper migration guide if applicable
- **Release Approval**: Manual trigger ensures intentional releases

### 8. Rollback Strategy

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
- **Mitigation**: Multiple NPM accounts, proper token management, rollback procedures

#### Risk: Git Tag Conflicts
- **Mitigation**: Unique versioning strategy, proper branch protection rules

## Implementation

### Phase 1: Foundation Setup
- Install and configure `semantic-release` and required plugins
- Set up GitHub Actions release workflow with manual triggers
- Configure NPM publishing tokens
- Create initial changelog structure
- Set up dry-run capabilities for testing

### Phase 2: Automation Implementation
- Implement automated version bumping based on commit messages
- Set up automated changelog generation
- Configure automated NPM publishing with manual triggers
- Set up GitHub release automation
- Implement dry-run testing capabilities

### Phase 3: Quality Gates
- Implement pre-release testing workflow
- Set up security scanning
- Configure dependency vulnerability checks
- Implement build verification

### Phase 4: Documentation and Training
- Create release process documentation
- Train team members on new process
- Create troubleshooting guides
- Set up monitoring and alerting

### Phase 5: Optimization
- Optimize release workflow performance
- Implement parallel processing where possible
- Add advanced rollback capabilities
- Implement release analytics

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
