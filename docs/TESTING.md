# Running tests locally

The integration and e2e suites talk to a real Hedera network. The default is **Solo**
(a local single-node Hedera deployed in a kind cluster), so you can run the full suite
without testnet credentials or rate limits. The same scripts CI uses are exposed as
root-level pnpm scripts.

## Prerequisites

- **Docker** (running)
- **kind**: `brew install kind` (or [kind docs](https://kind.sigs.k8s.io/))
- **kubectl**: `brew install kubectl`
- **Node 22** + **pnpm 9.15+**
- An LLM API key in `.env.test.local`. Only required for tests that exercise the agent (e2e and a subset of integration).

Copy `.env.test.local.example` to `.env.test.local` and fill in `OPENAI_API_KEY` (or
whichever provider matches `E2E_LLM_PROVIDER`).

## One-time setup

```bash
pnpm install
pnpm build
pnpm test:solo:install      # installs the Solo CLI globally (matches CI version)
```

## Bring Solo up

```bash
pnpm test:solo:up
```

That runs, in order:

1. `test:solo:deploy`. Runs `solo one-shot single deploy`, which creates the kind cluster with the port mappings the SDK clients need and deploys consensus node + mirror node + relay.
2. `test:solo:check`. Polls until all probed endpoints report ready.
3. `test:solo:deploy:contracts`. Deploys the ERC-20 / ERC-721 factory contracts the EVM tests need.

When `test:solo:check` prints `Solo endpoints ready.` you're good to go.

## Run tests

```bash
pnpm test:unit                  # fast, no network needed
pnpm test:integration           # core + langchain integration suites
pnpm test:e2e                   # langchain e2e (LLM-driven)

# Single file:
pnpm --filter @hashgraph/hedera-agent-kit-langchain exec vitest run tests/e2e/transfer-hbar.e2e.test.ts
```

## Tear Solo down

```bash
pnpm test:solo:down
```

Runs `solo one-shot single destroy`, deletes leftover kind clusters, removes
`~/.solo`. Safe to run multiple times.

## Individual scripts

You usually only need `up` / `down`, but the granular scripts are there if you want them:

| Script | What it does |
|---|---|
| `pnpm test:solo:install` | Install the pinned Solo CLI version |
| `pnpm test:solo:deploy` | `solo one-shot single deploy` |
| `pnpm test:solo:check` | Probe all endpoints and report status |
| `pnpm test:solo:deploy:contracts` | Deploy the ERC factory contracts the EVM tests need |
| `pnpm test:solo:destroy` | Tear down the Solo network and delete kind clusters |

## Troubleshooting

**`test:solo:check` shows `✗` for an endpoint**
The check prints per-attempt status. If `Mirror node (Web3)` flaps for ~5 to 10s on a
fresh deploy that's normal. The mirror's contract-simulation path warms up after
the REST listener. Just re-run after a few seconds.

**`Failed to fetch account 0x: 400 Bad Request` during the deploy step**
Almost always means `pnpm test:solo:deploy:contracts` hasn't been run yet (or its
output wasn't applied to the test env). The ERC factory contract IDs need to be in
your `.env.test.local` as `HEDERA_ERC20_FACTORY_ADDRESS` / `HEDERA_ERC721_FACTORY_ADDRESS`.

**Endpoints unreachable from the host**
`solo one-shot single deploy` creates the kind cluster with the port mappings the
SDK clients expect (consensus 35211, mirror REST 38081, relay 37546). If your kind
cluster was created some other way and the ports aren't exposed, run `test:solo:down`
followed by `test:solo:up` to recreate it via solo.

## Using testnet instead of Solo

Set `HEDERA_NETWORK=testnet` plus testnet credentials in `.env.test.local` and the
TestProfile resolves to the testnet adapter. Slower (~5 to 10s per Hedera consensus
round-trip vs sub-second on Solo) but useful for verifying behavior on a real
network. No `solo:*` scripts needed in this mode.

For ERC20/ERC721 tests on testnet, also set `HEDERA_ERC20_FACTORY_ADDRESS=0.0.6471814`
and `HEDERA_ERC721_FACTORY_ADDRESS=0.0.6510666` (see `packages/core-contracts/README.md`
for current deployments).
