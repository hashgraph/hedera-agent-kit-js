# Contributing to Hedera Agent Kit

We are thrilled that you’re interested in contributing to the **Hedera Agent Kit**! Whether it’s a simple doc fix or a major feature, we appreciate your help.

---

## 1. Getting Started

1. **Fork** the repository.
2. **Clone** your fork:

```bash
  git clone https://github.com/<your-github-username>/hedera-agent-kit.git
```

3. Create a new branch for your work:

```bash
  git checkout -b feat/your-feature-name
```

4. Make your changes, write or update tests as needed, and commit with a DCO sign-off (details below).
5. Push your branch to GitHub and open a pull request (PR) against main.

## Developer Certificate of Origin (DCO)

This project requires DCO sign-offs. When you commit, include a line in your commit message:

```bash
Signed-off-by: Your Name <your.email@example.com>
```

If you use the CLI, you can add the -s or --signoff flag:

```bash
git commit -s -m "Implement a new feature"
```

Make sure the name and email match the identity you’ve set in Git. GitHub Actions will verify DCO compliance on every PR. If you forget, you can amend your commit or force-push once you’ve added the sign-off line.

---

## 3. Code Style & Testing

1. Linting: This project uses ESLint. Run npm run lint to check for coding style issues.
2. Testing: Ensure all tests pass locally via npm run test.
3. Formatting: Use Prettier or your favorite formatter—just keep code consistent!

---

## 4. How to Contribute

### Create an Issue requesting Toolkit Features

[Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.md&title=[FEATURE]%20-%20) in the hedera-agent-kit SDK repository.

### Find a Task

- Check out our Roadmap or look for open Issues in the repository.
- We use labels like `good-first-issue`, `help-wanted`, and `enhancement` to help identify tasks.

### Submit a Pull Request

1. Open a PR on GitHub, linking it to the relevant Issue if applicable.
2. The PR will run automated checks (lint, test, DCO).
3. Once approved, a maintainer will merge it. We’ll thank you for your contribution!

#### Contribution Example

**Create a different Tool Calling Agent with another LLM**

1. Using `examples/langchain-v1/plugin-tool-calling-agent.ts` as a template, create a new file `typescript/examples/langchain/tool-calling-agent-anthropic.ts` and make the following changes:

```js
  // Change import
  import { ChatAnthropic } from '@langchain/anthropic';

  // Change LLM initialization
   const llm = new ChatAnthropic({
     model: 'claude-3-5-sonnet-20241022',
     temperature: 0,
     apiKey: process.env.ANTHROPIC_API_KEY,
   });

  // Enhanced system prompt for Anthropic
   ['system', 'You are a helpful assistant that can interact with the Hedera blockchain. You have access
   to various tools for creating tokens, managing topics, and querying account information. Use these
  tools to help users accomplish their blockchain-related tasks.'],
```

  2. Update package.json dependencies

```js
  Add:
  "@langchain/anthropic": "^0.x.x"
```


  3. Update .env file
```js
  ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## 5. Community & Support

- Use GitHub to propose ideas and [open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.md&title=[FEATURE]%20-%20) or ask questions.
- [Join the Hedera Discord Server] (https://discord.gg/DNx3r3CW) and reach out in the approppriate channel.


Thank you for helping make the Hedera Agent Kit better!

