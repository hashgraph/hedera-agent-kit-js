# ADR-002: Comprehensive Testing Strategy

## Status

**Proposed** - This ADR is under review and discussion.

## Context

The Hedera Agent Kit is a complex TypeScript SDK that integrates multiple frameworks (LangChain, AI SDK, Model Context Protocol) with the Hedera blockchain network. The project currently has:

- Smart contract unit tests (Hardhat + Chai)
- No tests for the TypeScript SDK components
- Manual testing through example scripts
- Multiple plugins and tools that need validation

As the project grows and gains adoption, we need a systematic approach to testing that ensures:

1. **Reliability**: Code changes don't break existing functionality
2. **Quality**: High standards for production-ready code
3. **Developer Experience**: Fast feedback loops for development
4. **Maintainability**: Tests serve as documentation and prevent regressions
5. **Integration Confidence**: Complex interactions between AI models, frameworks, and blockchain work correctly

## Decision

We will implement a **four-tier testing strategy**:

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions and Hedera network integration
3. **Tool-Calling Validation Tests**: Test AI model tool selection and parameter validation without executing transactions
4. **End-to-End Tests**: Test complete workflows with AI models executing actual transactions

### Key Decisions

#### Testing Framework

- **Vitest** for TypeScript unit, integration, and tool-calling validation tests
- **Hardhat + Chai** for smart contract tests (existing)

#### Test Organization

- Separate test directories for unit, integration, tool-calling validation, and E2E tests
- Multiple Jest configurations for different test types
- Clear separation of concerns and test responsibilities

#### CI/CD Integration

- GitHub Actions workflow with staged test execution
- Unit tests run on every commit/PR
- Integration tests run on PR to main
- Tool-calling validation tests run on PR to main
- E2E tests run before releases

#### Coverage Requirements

- 80% line coverage for unit tests
- 70% integration coverage
- 85% tool-calling validation coverage
- 100% critical path coverage for E2E tests

#### E2E Testing Strategy

- Test both **Autonomous** and **ReturnBytes** modes for the primary framework
- Focus on critical user workflows and edge cases
- Use testnet for actual transaction execution
- Implement proper cleanup and test isolation

#### Framework Testing Strategy

- **Primary Framework**: LangChain (most mature integration with 4+ examples, comprehensive tool support)
- **Secondary Frameworks**: AI SDK and Model Context Protocol (manual smoke tests for critical paths only)
- **Rationale**:
  - LangChain has the most extensive examples
  - Testing all frameworks equally would triple maintenance overhead with diminishing returns
  - Most SDK logic is framework-agnostic (tools, Hedera integration)
  - Framework differences are mainly in tool-calling syntax, not core functionality
  - Can expand framework coverage based on user feedback and adoption patterns

#### LLM Testing Strategy

- **Primary LLM**: Use a single, reliable LLM (e.g., GPT-4) across all test tiers to ensure consistency and reliability
- **Multi-LLM Validation**: Run a subset of critical tests against multiple LLMs (GPT-4, Claude, etc.) before releases to ensure compatibility
- **Model Selection Criteria**: Choose the most cost-effective LLM that meets our minimum quality requirements for tool-calling accuracy
- **Consistency**: Use the same LLM for tool-calling validation, and E2E tests to avoid inconsistencies between test tiers

#### Tool-Calling Validation Tests

- **Purpose**: Validate that AI models correctly select and parameterize tools based on user prompts
- **Scope**: Test tool selection logic, parameter parsing, and validation without executing actual transactions
- **Benefits**: Faster execution than E2E tests (no waiting for Hedera confirmations), immediate feedback on AI model integration
- **Examples**:
  - "Transfer 100 HBAR to Alice" → Should call `transfer-hbar` tool with correct parameters
  - "Create an ERC20 token called MyToken" → Should call `create-erc20` tool with proper configuration
  - "What's my account balance?" → Should call `get-hbar-balance` tool
- **Frameworks**: Test LangChain thoroughly; perform manual smoke tests for AI SDK and MCP
- **Modes**: Test both Autonomous and ReturnBytes modes for tool selection accuracy

## Consequences

### Positive Consequences

1. **Increased Confidence**: Developers can make changes with confidence that they won't break existing functionality
2. **Faster Development**: Unit tests provide immediate feedback during development
3. **Better Documentation**: Tests serve as living documentation of component behavior
4. **Reduced Bugs**: Comprehensive testing catches issues before they reach production
5. **Improved Onboarding**: New contributors can understand code behavior through tests
6. **Quality Assurance**: Automated testing ensures consistent quality standards
7. **Fast AI Testing**: Tool-calling validation tests provide immediate feedback on AI integration without waiting for blockchain confirmations
8. **Comprehensive Mode Coverage**: Testing both Autonomous and ReturnBytes modes ensures all use cases are validated
9. **Multi-LLM Compatibility**: Ensures the SDK works reliably across different AI models
10. **Consistent LLM Testing**: Using the same LLM across all test tiers ensures reliable and predictable test results

### Negative Consequences

1. **Development Overhead**: Writing and maintaining tests requires additional time
2. **Complexity**: Multiple test types and configurations increase project complexity
3. **Infrastructure Costs**: CI/CD pipeline and test environments require resources
4. **Test Maintenance**: Tests need to be updated when code changes

### Risks and Mitigation

#### Risk: Test Maintenance Burden

- **Mitigation**: Start with high-value tests, focus on critical paths, automate test generation where possible

#### Risk: Test Flakiness

- **Mitigation**: Use stable test environments, proper mocking, and retry logic for integration tests

#### Risk: Slow Test Execution

- **Mitigation**: Parallel test execution, test isolation, and selective test running

#### Risk: False Sense of Security

- **Mitigation**: Combine automated tests with manual testing, code reviews, and production monitoring

#### Risk: LLM API Costs

- **Mitigation**: Choose cost-effective but reliable LLM, implement cost monitoring, optimize test execution to minimize API calls, use testnet for free transaction testing

#### Risk: LLM API Reliability

- **Mitigation**: Implement retry logic, use multiple LLM providers, have fallback strategies for test failures

#### Risk: Test Flakiness from AI Models

- **Mitigation**: Use proper prompts, implement proper mocking for non-critical AI interactions, validate tool selection rather than exact responses

## Implementation

### Phase 1: Foundation

- Set up Jest configuration and test directory structure
- Implement basic unit tests for core utilities
- Establish CI/CD pipeline

### Phase 2: Core SDK Testing

- Unit tests for all tools, toolkits, and plugins
- Integration tests for SDK components

### Phase 3: Tool-Calling Validation

- Implement tool-calling validation tests for all frameworks
- Test tool selection logic with various prompts
- Validate parameter parsing and validation
- Test against multiple LLMs for compatibility

### Phase 4: Hedera Integration

- Integration tests with testnet
- Error handling and performance tests
- Test both Autonomous and ReturnBytes modes

### Phase 5: E2E Testing

- Complete E2E tests with AI models executing transactions
- Comprehensive LangChain E2E tests, smoke tests for AI SDK and MCP
- Multi-LLM validation for critical paths
- Performance optimization and test parallelization

## Alternatives Considered

### Alternative 1: Minimal Testing

- Only unit tests for critical components
- Manual testing for integration scenarios
- **Rejected**: Insufficient for complex integrations and AI model interactions

### Alternative 2: Heavy E2E Focus

- Primarily end-to-end tests with real AI models
- Minimal unit testing
- **Rejected**: Too slow for development feedback, expensive to maintain

### Alternative 3: Contract Testing

- Focus on API contracts between components
- Consumer-driven contract tests
- **Rejected**: Doesn't address the specific needs of AI model integration and blockchain interactions

### Alternative 4: Property-Based Testing

- Use property-based testing frameworks like Fast-Check
- Generate test cases automatically
- **Rejected**: Too complex for initial implementation, better suited for specific components later

### Alternative 5: Single LLM Testing

- Test only against one LLM to reduce complexity and costs
- **Rejected**: Would miss compatibility issues across different AI models and reduce confidence in multi-LLM support

### Alternative 6: Manual Tool-Calling Validation

- Rely on manual testing for tool selection validation
- **Rejected**: Would be error-prone, slow, and not scalable as the number of tools grows

### Alternative 7: Equal Framework Testing

- Test all frameworks (LangChain, AI SDK, MCP) equally across all test tiers
- **Rejected**: Would triple maintenance overhead with diminishing returns, most logic is framework-agnostic

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Hardhat Testing Guide](https://hardhat.org/tutorial/testing-contracts)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Related ADRs

- None currently (this is the first ADR)

## Review Schedule

This ADR should be reviewed:

- **Monthly**: Check implementation progress
- **Quarterly**: Evaluate effectiveness and adjust strategy
- **Annually**: Comprehensive review and potential updates

---

**Author**: [To be filled]
**Date**: [Current Date]
**Reviewers**: [To be filled]
