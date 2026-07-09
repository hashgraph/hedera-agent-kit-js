// Provide fake env vars so importing `shared/config.js` succeeds in test
// environments. Tests that exercise env-var failure modes override these
// locally (see `shared/config.test.js`).
process.env.HEDERA_ACCOUNT_ID ||= "0.0.1234";
process.env.HEDERA_PRIVATE_KEY ||= "0x" + "a".repeat(64);
process.env.HEDERA_NETWORK ||= "testnet";
process.env.LLM_PROVIDER ||= "openai";
process.env.LLM_MODEL ||= "gpt-4o-mini";
process.env.OPENAI_API_KEY ||= "sk-test-fake";
