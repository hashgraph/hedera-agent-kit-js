# Rule: Generate Feature Issues for Proposed Hedera Tools (Batch)

### Context for Human User
Use this rule when you already know the set of new Tools to add and want one GitHub Issue per tool, without interactive diff/file review.

- Say: "I have a tool (or list of tools) to add. Please use the feature-issue batch rule to generate a gh issue create command for each tool."
- Provide a list like:
  - Tool: TRANSFER_TOKEN_TOOL; Plugin: core-hts-plugin; Labels (optional): "feature,tool"; Assignee (optional): @githubusername
  - Tool: CREATE_ACCOUNT_TOOL; Plugin: core-account-plugin; Labels "feature,tool";

### Context for AI Assistant
- First, confirm the GitHub CLI is available:
  - Ask the user to run: `gh --version` (if not installed, ask them to `brew install gh`).
- Do not run `git diff` or prompt per-file changes. This batch rule skips interactive analysis.
- For each listed tool, output a separate `gh issue create` command.
- Ensure each body includes:
  - `Plugin: <PLUGIN>` and `Project Tag: v3`
  - The markdown sections: User Story, Files Changed, Acceptance Criteria (templated below)
- Always include the label `v3` and any other labels provided by the user in instructions. Optionally include plugin/service labels (e.g., `plugin: core-hts-plugin`, `service: HTS`).
- Prefix the issue title with `feat:` (if the provided title already starts with `feat:`, do not duplicate).
- After running each command, capture the created issue link from gh output and end your response with: "Please go to the issue at [issue link] and assign it to the Hedera Agent Kit project and assign a status."
- The different plugins names are: core-account-plugin, core-schedule-plugin, core schedule-query-plugin, core-account-query-plugin, core-consensus-plugin, core-consensus-query-plugin, core-file-plugin, core-file-query-plugin, core-token-plugin, core-token-query-plugin, core-evm-plugin (instead of core-smart-contract-plugin), core-evm-query-plugin, core-schedule-plugin, core-schedule-query-plugin. there may or may not be a core-misc-plugin category as well
- core-queries-plugin (and a couple other plugins) are old but still supported plugin group that will be replaced with a query plugin for each service/ area of functionality for Hedera.
- Use the information in docs/HEDERAPLUGINS.md to understand the types of plugins, and even suggest the best plugin to include a tool in if the one the user suggested isn't the best fit.
- Also look on the internet at the Hedera Docs here: https://docs.hedera.com/hedera/sdks-and-apis/hedera-api. the categories here roughly align with the different plugins. Crypto Accounts map to core-account-plugin and Smart Contracts map to core-evm-plugin

### Goal
Create one GitHub Issue per tool with consistent release tagging and clear implementation guidance. 

## Output
- Format: One shell command per tool using the GitHub CLI

### Command Structure (per tool)
```bash
gh issue create \
  --title "feat: <TITLE>" \
  --body $'Plugin: <PLUGIN>\nProject Tag: 3.2.0\n\n## User Story\n<PART1_USER_STORY>\n\n## Files Changed\n<PART2_FILES_CHANGED>\n\n## Acceptance Criteria\n<PART3_ACCEPTANCE_CRITERIA>\n' \
  --label "v3,feature,tool,<OPTIONAL_PLUGIN_OR_SERVICE_LABELS>" \
  --assignee <OPTIONAL_ASSIGNEE> \
  -R hedera-dev/hedera-agent-kit
```
Notes:
- Use $'..' to embed newlines safely in macOS zsh.
- If content becomes long, you may use `--body-file <path>` instead of `--body`.
- If you also want to attach a project automatically and your CLI/org supports it, you may add `--project "Hedera Agent Kit"`. This is optional; we still end by instructing the user to assign the issue to the project and set a status.

### Service-Based Defaults (seed content)
Use these concise defaults to populate `<PART1_USER_STORY>`, `<PART2_FILES_CHANGED>`, `<PART3_ACCEPTANCE_CRITERIA>` based on the tool’s plugin/service. Tailor specifics (transaction types, params) per tool.

- Account (core-account-plugin)
  - User Story: As a developer using Hedera Agent Kit, I want <TOOL_NAME> so I can manage and interact with Hedera accounts programmatically.
  - Files Changed:
    - [ ] typescript/src/plugins/core-account-plugin/tools/account/<tool-name>.ts (new tool)
    - [ ] typescript/src/plugins/core-account-plugin/index.ts (import, register, export tool name)
    - [ ] docs/HEDERAPLUGINS.md (add tool to Account section)
  - Acceptance Criteria:
    - Uses appropriate Hiero/Hedera SDK classes (e.g., AccountCreate/Update/DeleteTransaction) with correct params.
    - Optional fields truly optional; clear errors for invalid input.
    - Returns structured result (transaction ID, receipt/record) consistent with existing tools.

- Token Service / HTS (core-hts-plugin)
  - User Story: As a developer, I want <TOOL_NAME> to manage tokens (FT/NFT) via the Agent Kit.
  - Files Changed:
    - [ ] typescript/src/plugins/core-hts-plugin/tools/<area>/<kebab-tool>.ts (e.g., fungible-token/, non-fungible-token/)
    - [ ] typescript/src/plugins/core-hts-plugin/index.ts (register, export)
    - [ ] docs/HEDERAPLUGINS.md (update HTS table)
  - Acceptance Criteria:
    - Builds correct HTS transaction (e.g., TokenAssociate/Transfer/Burn/Wipe/etc.).
    - Supports multiple tokens/serials where applicable; handles allowances if specified.
    - Mirrors existing tool I/O patterns; includes memo fields when relevant.

- Consensus / HCS (core-consensus-plugin)
  - User Story: As a developer, I want <TOOL_NAME> to manage/operate HCS topics.
  - Files Changed: tool under tools/consensus/, plugin index, docs/HEDERAPLUGINS.md, tests.
  - Acceptance Criteria: Uses TopicUpdate/Delete/Info where relevant; key/submit-key semantics handled; message/submit options validated.

- Smart Contract Service / SCS (core-scs-plugin)
  - User Story: As a developer, I want <TOOL_NAME> to deploy/execute/query EVM smart contracts.
  - Files Changed: tool under tools/erc20|erc721|contracts, plugin index, docs/HEDERAPLUGINS.md, tests.
  - Acceptance Criteria: Uses ContractCreate/Execute/CallLocal (or EthereumTransaction) appropriately; ABI/params handled; returns tx ID and payload/return value as applicable.

- File Service (new: core-file-plugin)
  - User Story: As a developer, I want <TOOL_NAME> to manage Hedera files.
  - Files Changed: create plugin (if absent), tool under tools/file/, plugin index, docs/HEDERAPLUGINS.md, tests.
  - Acceptance Criteria: Correct FileCreate/Append/Update/Delete transactions; content and keys handled; query tools return contents/info.

- Schedule Service (new: core-schedule-plugin)
  - User Story: As a developer, I want <TOOL_NAME> to create/sign/manage schedules.
  - Files Changed: create plugin (if absent), tool under tools/schedule/, plugin index, docs/HEDERAPLUGINS.md, tests.
  - Acceptance Criteria: ScheduleCreate/Sign/Delete supported; schedule info query returns expected fields.

- Queries / Mirror (core-queries-plugin)
  - User Story: As a developer, I want <TOOL_NAME> to query network state (accounts, tokens, contracts, files, topics, transactions).
  - Files Changed: tool under tools/queries/, plugin index, docs/HEDERAPLUGINS.md, tests.
  - Acceptance Criteria: Returns typed response shapes; supports filters (id/time/limit); uses operator defaults when appropriate.

### Batch Flow
1) Collect the tool list (Tool, Plugin, Service, Title, optional Labels/Assignee).
2) For each tool, fill defaults above into the body placeholders and generate the command using the template.
3) Present commands and ask for confirmation to run. Do not give the next command until the userhas approved/ disapproved the CLI command. If they disapprove it, ask if they want to modify it, or if they want to skip. If they want to modify, modify the CLI command, and if not, move on to the next tool.
4) After each command, copy the created issue link from gh output and end the response with: "Please go to the issue at [issue link] and assign it to the Hedera Agent Kit project and assign a status."

### Examples
- Example input item:
  - Tool: TRANSFER_TOKEN_TOOL; Plugin: core-hts-plugin; Service: HTS; Labels: "feature,tool"; 
- Example command (abbreviated body):
```bash
gh issue create \
  --title "feat: core-het-plugin: TRANSFER_TOKEN_TOOL" \
  --body $'Plugin: core-hts-plugin\nProject Tag: 3.2.0\n\n## User Story\nAs a developer, I want TRANSFER_TOKEN_TOOL to transfer tokens (FT/NFT).\n\n## Files Changed\ntypescript/src/plugins/core-hts-plugin/tools/fungible-token/transfer-token.ts (new)\n\n## Acceptance Criteria\nBuilds TokenTransferTransaction; supports multiple transfers and NFTs.\n' \
  --label "3.2.0,feature,tool,plugin: core-hts-plugin,service: HTS" \
  -R hedera-dev/hedera-agent-kit
```

### Post-creation requirement
- Based on the gh CLI output, you should have a link like `https://github.com/hedera-dev/hedera-agent-kit/issues/118`.
- The last thing in your LLM output must be: "Please go to the issue at [issue link] and assign it to the Hedera Agent Kit project and assign a status."
