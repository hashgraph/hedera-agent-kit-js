#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import fse from "fs-extra";
import prompts from "prompts";
import { bold, cyan, dim, green, red, yellow } from "kolorist";

import { applyScaffoldRule, FRAMEWORKS } from "./scaffold-rule.js";
import { bundledTemplateDir, readTemplateFileMap } from "./read-template.js";
import { resolveKeyType } from "./template/shared/key-type.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];

function validateOperatorKey(key) {
  try {
    resolveKeyType(key);
    return true;
  } catch (error) {
    return error.message;
  }
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--yes":
      case "-y":
        flags.yes = true;
        break;
      case "--name":
      case "--project-name":
        if (next) flags.name = next;
        break;
      case "--framework":
        if (next && FRAMEWORKS.includes(next)) {
          flags.framework = next;
        }
        break;
      case "--operator-id":
        if (next) flags.operatorId = next;
        break;
      case "--operator-key":
        if (next) flags.operatorKey = next;
        break;
      case "--openai-key":
        if (next) flags.openaiKey = next;
        break;
      case "--pm":
      case "--package-manager":
        if (next && PACKAGE_MANAGERS.includes(next)) {
          flags.packageManager = next;
        }
        break;
    }
  }
  return flags;
}

async function collectConfig(flags) {
  const questions = [
    {
      type: flags.name || flags.yes ? null : "text",
      name: "name",
      message: "Project name",
      initial: "hedera-agent-app",
    },
    {
      type: flags.framework || flags.yes ? null : "select",
      name: "framework",
      message: "Framework (CLI runtime; web app always uses Vercel AI SDK)",
      choices: [
        { title: "Vercel AI SDK (recommended)", value: "ai-sdk" },
        { title: "LangChain", value: "langchain" },
      ],
      initial: 0,
    },
    {
      type: flags.operatorId || flags.yes ? null : "text",
      name: "operatorId",
      message: "HEDERA_ACCOUNT_ID (e.g. 0.0.x, get one at https://portal.hedera.com)",
    },
    {
      type: flags.operatorKey || flags.yes ? null : "password",
      name: "operatorKey",
      message: "HEDERA_PRIVATE_KEY (ECDSA/ED25519 DER hex or 0x-prefixed 64-hex)",
      validate: (value) =>
        !value ? "Operator key is required" : validateOperatorKey(value),
    },
    {
      type: flags.openaiKey || flags.yes ? null : "password",
      name: "openaiKey",
      message: "OPENAI_API_KEY",
      validate: (value) => !!value?.trim() || "Required",
    },
    {
      type: flags.packageManager || flags.yes ? null : "select",
      name: "packageManager",
      message: "Package manager",
      choices: [
        { title: "npm", value: "npm" },
        { title: "pnpm", value: "pnpm" },
        { title: "yarn", value: "yarn" },
        { title: "bun", value: "bun" },
      ],
      initial: 0,
    },
  ];

  const responses = await prompts(questions, {
    onCancel: () => {
      console.log(yellow("Aborted."));
      process.exit(1);
    },
  });

  return {
    name: (flags.name || responses.name || "hedera-agent-app").trim(),
    framework: flags.framework || responses.framework || "ai-sdk",
    operatorId: (flags.operatorId || responses.operatorId || "").trim(),
    operatorKey: (flags.operatorKey || responses.operatorKey || "").trim(),
    openaiKey: (flags.openaiKey || responses.openaiKey || "").trim(),
    packageManager: flags.packageManager || responses.packageManager || "npm",
  };
}

function resolveTemplateDir() {
  if (fs.existsSync(bundledTemplateDir)) return bundledTemplateDir;
  console.error(
    red("Template directory not found. The published package should include template/ alongside index.js."),
  );
  process.exit(1);
}

async function writeFileMap(files, targetDir) {
  await fse.ensureDir(targetDir);
  for (const [relPath, content] of Object.entries(files)) {
    const absPath = path.resolve(targetDir, relPath);
    await fse.ensureDir(path.dirname(absPath));
    await fse.writeFile(absPath, content);
  }
}

function renamePackage(files, projectName) {
  const key = "package.json";
  const raw = files[key];
  if (!raw) return;
  const pkg = JSON.parse(raw.toString("utf8"));
  pkg.name = projectName;
  files[key] = Buffer.from(JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function buildEnvFile(config) {
  const lines = [
    "# Hedera operator credentials (server-side only)",
    `HEDERA_ACCOUNT_ID=${config.operatorId}`,
    `HEDERA_PRIVATE_KEY=${config.operatorKey}`,
    "HEDERA_NETWORK=testnet",
    "",
    "# LLM provider & model",
    "LLM_PROVIDER=openai",
    "LLM_MODEL=gpt-4o-mini",
    "",
    "# LLM API keys",
    `OPENAI_API_KEY=${config.openaiKey}`,
    "# ANTHROPIC_API_KEY=",
    "",
  ];
  return lines.join("\n");
}

async function writeEnvFile(targetDir, config) {
  await fse.writeFile(path.resolve(targetDir, ".env"), buildEnvFile(config), "utf8");
}

function installCommandFor(pm) {
  switch (pm) {
    case "npm":
      return { command: "npm", args: ["install"] };
    case "pnpm":
      return { command: "pnpm", args: ["install"] };
    case "yarn":
      return { command: "yarn", args: [] };
    case "bun":
      return { command: "bun", args: ["install"] };
    default:
      return { command: "npm", args: ["install"] };
  }
}

async function runInstall(targetDir, pm) {
  const { command, args } = installCommandFor(pm);
  console.log(dim(`Installing dependencies with ${command}…`));
  try {
    await execa(command, args, { cwd: targetDir, stdio: "inherit" });
    return true;
  } catch (err) {
    console.log(
      yellow(
        `Install failed (${command}). You can finish setup manually by running it inside the project directory.`,
      ),
    );
    if (err instanceof Error && err.message) console.log(dim(err.message));
    return false;
  }
}

async function gitInit(targetDir) {
  try {
    await execa("git", ["init"], { cwd: targetDir, stdio: "pipe" });
    await execa("git", ["add", "."], { cwd: targetDir, stdio: "pipe" });
    await execa("git", ["commit", "-m", "chore: scaffold with create-hedera-agent"], {
      cwd: targetDir,
      stdio: "pipe",
    });
  } catch {
    // git is optional.
  }
}

function printNextSteps(config) {
  const run = (script) =>
    config.packageManager === "yarn" ? `yarn ${script}` : `${config.packageManager} run ${script}`;
  console.log("");
  console.log(green("Done."));
  console.log(
    `${bold("Next steps:")}\n` +
      `  cd ${config.name}\n` +
      `  ${run("web")}    # browser chat\n` +
      `  ${run("cli")}    # terminal chat\n`,
  );
}

export async function scaffold(config, targetDir) {
  const templateDir = resolveTemplateDir();
  const sourceFiles = readTemplateFileMap(templateDir);
  const outputFiles = applyScaffoldRule(sourceFiles, config.framework);
  renamePackage(outputFiles, config.name);
  await writeFileMap(outputFiles, targetDir);
  await writeEnvFile(targetDir, config);
}

async function main() {
  console.log(bold(cyan("Create Hedera Agent")));
  const flags = parseFlags(process.argv.slice(2));
  const config = await collectConfig(flags);

  const targetDir = path.resolve(process.cwd(), config.name);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.log(red(`Target directory already exists and is not empty: ${targetDir}`));
    process.exit(1);
  }

  await scaffold(config, targetDir);
  await runInstall(targetDir, config.packageManager);
  await gitInit(targetDir);

  printNextSteps(config);
  process.exit(0);
}

// Only run when invoked as a script — keep importable for tests.
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error(red(String(err?.stack || err)));
    process.exit(1);
  });
}
