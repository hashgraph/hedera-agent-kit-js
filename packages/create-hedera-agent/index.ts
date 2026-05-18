#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import fse from "fs-extra";
import prompts, { PromptObject } from "prompts";
import { bold, cyan, dim, green, red, yellow } from "kolorist";

async function loadExeca() {
  const mod = await import("execa");
  return mod.execa;
}

type Framework = "ai-sdk" | "langchain";
type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

type ScaffoldConfig = {
  name: string;
  framework: Framework;
  operatorId: string;
  operatorKey: string;
  openaiKey: string;
  packageManager: PackageManager;
};

type CliFlags = Partial<{
  name: string;
  framework: Framework;
  operatorId: string;
  operatorKey: string;
  openaiKey: string;
  packageManager: PackageManager;
  yes: boolean;
}>;

const FRAMEWORKS: readonly Framework[] = ["ai-sdk", "langchain"];
const PACKAGE_MANAGERS: readonly PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

function isLikelyEcdsaPrivateKey(key: string): boolean {
  const trimmed = key.trim();
  if (/^303002/i.test(trimmed)) return true;
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return true;
  if (/^[0-9a-fA-F]{64,}$/.test(trimmed)) return true;
  return false;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {};
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
        if (next && (FRAMEWORKS as readonly string[]).includes(next)) {
          flags.framework = next as Framework;
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
        if (next && (PACKAGE_MANAGERS as readonly string[]).includes(next)) {
          flags.packageManager = next as PackageManager;
        }
        break;
    }
  }
  return flags;
}

async function collectConfig(flags: CliFlags): Promise<ScaffoldConfig> {
  // Each prompt is suppressed (`type: null`) when the matching flag is set or
  // when `--yes` is passed (defaults fill in).
  const questions: PromptObject[] = [
    {
      type: flags.name || flags.yes ? null : "text",
      name: "name",
      message: "Project name",
      initial: "hedera-agent-app",
    },
    {
      type: flags.framework || flags.yes ? null : "select",
      name: "framework",
      message: "Framework",
      choices: [
        { title: "Vercel AI SDK", value: "ai-sdk" },
        { title: "LangChain", value: "langchain" },
      ],
      initial: 0,
    },
    {
      type: flags.operatorId || flags.yes ? null : "text",
      name: "operatorId",
      message: "HEDERA_OPERATOR_ID (e.g. 0.0.x, get one at https://portal.hedera.com)",
    },
    {
      type: flags.operatorKey || flags.yes ? null : "password",
      name: "operatorKey",
      message: "HEDERA_OPERATOR_KEY (ECDSA DER hex starting with 303002… or 0x-prefixed 64-hex)",
      validate: (value: string) =>
        !value
          ? "Operator key is required"
          : isLikelyEcdsaPrivateKey(value) ||
            "Must be an ECDSA private key (DER hex starting with 303002… or 0x-prefixed 64-hex).",
    },
    {
      type: flags.openaiKey || flags.yes ? null : "password",
      name: "openaiKey",
      message: "OPENAI_API_KEY",
      validate: (value: string) => !!value?.trim() || "Required",
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
    framework: (flags.framework || responses.framework || "ai-sdk") as Framework,
    operatorId: (flags.operatorId || responses.operatorId || "").trim(),
    operatorKey: (flags.operatorKey || responses.operatorKey || "").trim(),
    openaiKey: (flags.openaiKey || responses.openaiKey || "").trim(),
    packageManager: (flags.packageManager || responses.packageManager || "npm") as PackageManager,
  };
}

type ResolvedPaths = {
  templateDir: string;
  runtimeVariantsDir: string;
};

function resolvePaths(): ResolvedPaths {
  // Packaged: __dirname is dist/, template/ and runtime-variants/ sit next to
  // dist/ in the published tarball (see package.json "files"). Dev fallback:
  // both live one level up from index.ts in the source tree.
  const candidates = [
    path.resolve(__dirname, ".."),
    path.resolve(__dirname),
  ];

  for (const root of candidates) {
    const templateDir = path.resolve(root, "template");
    const runtimeVariantsDir = path.resolve(root, "runtime-variants");
    if (fs.existsSync(templateDir) && fs.existsSync(runtimeVariantsDir)) {
      return { templateDir, runtimeVariantsDir };
    }
  }

  console.error(
    red(
      "Template assets not found. The published package should include template/ and runtime-variants/ directories alongside dist/.",
    ),
  );
  process.exit(1);
}

async function copyTemplate(templateDir: string, targetDir: string): Promise<void> {
  await fse.copy(templateDir, targetDir, {
    filter: (src) => {
      const rel = path.relative(templateDir, src);
      if (rel.includes("node_modules")) return false;
      if (rel.startsWith(".next")) return false;
      if (rel === "tsconfig.tsbuildinfo") return false;
      if (rel === ".env.local") return false;
      return true;
    },
  });
}

async function applyFrameworkOverlay(
  runtimeVariantsDir: string,
  targetDir: string,
  framework: Framework,
): Promise<void> {
  // The default template ships the AI SDK runtime. For LangChain we replace
  // src/features/chat-runtime/ wholesale (the runtime adapter feature),
  // overlay the runtime-coupled chat-hedera files (today: just toolkit.ts —
  // its body wires HederaAIToolkit on the AI SDK side and HederaLangchainToolkit
  // on the LangChain side), and apply the dep diff in package.deps.json.
  if (framework === "ai-sdk") return;

  const variantDir = path.resolve(runtimeVariantsDir, framework);
  const variantRuntimeDir = path.resolve(
    variantDir,
    "src",
    "features",
    "chat-runtime",
  );
  const targetRuntimeDir = path.resolve(
    targetDir,
    "src",
    "features",
    "chat-runtime",
  );
  const depsFile = path.resolve(variantDir, "package.deps.json");

  if (!fs.existsSync(variantRuntimeDir) || !fs.existsSync(depsFile)) {
    console.error(red(`Framework variant assets missing for "${framework}".`));
    process.exit(1);
  }

  await fse.remove(targetRuntimeDir);
  await fse.copy(variantRuntimeDir, targetRuntimeDir);

  // Tests (`*.test.ts(x)`) live alongside source for parity with the rest of
  // the template, but the scaffolded project doesn't ship the langchain test
  // dev-dependencies. Strip them out post-copy so `next build` and the user's
  // own test setup stay untouched.
  await removeTestFiles(targetRuntimeDir);

  // Overlay specific chat-hedera/server files that are runtime-coupled.
  // Anything not present in the variant's chat-hedera directory stays
  // unchanged from the template.
  const variantChatHederaServerDir = path.resolve(
    variantDir,
    "src",
    "features",
    "chat-hedera",
    "server",
  );
  const targetChatHederaServerDir = path.resolve(
    targetDir,
    "src",
    "features",
    "chat-hedera",
    "server",
  );
  if (fs.existsSync(variantChatHederaServerDir)) {
    await fse.copy(variantChatHederaServerDir, targetChatHederaServerDir, {
      overwrite: true,
    });
    await removeTestFiles(targetChatHederaServerDir);
  }

  await applyPackageDepsDiff(targetDir, depsFile);
}

async function removeTestFiles(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) return;
  const entries = await fse.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        await removeTestFiles(entryPath);
        return;
      }
      if (/\.test\.tsx?$/.test(entry.name)) {
        await fse.remove(entryPath);
      }
    }),
  );
}

type PackageDepsDiff = {
  add?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  remove?: { dependencies?: string[]; devDependencies?: string[] };
};

async function applyPackageDepsDiff(targetDir: string, depsFile: string): Promise<void> {
  const pkgPath = path.resolve(targetDir, "package.json");
  const pkg = JSON.parse(await fse.readFile(pkgPath, "utf8")) as Record<string, unknown> & {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const diff = JSON.parse(await fse.readFile(depsFile, "utf8")) as PackageDepsDiff;

  if (diff.remove?.dependencies && pkg.dependencies) {
    for (const name of diff.remove.dependencies) delete pkg.dependencies[name];
  }
  if (diff.remove?.devDependencies && pkg.devDependencies) {
    for (const name of diff.remove.devDependencies) delete pkg.devDependencies[name];
  }
  if (diff.add?.dependencies) {
    pkg.dependencies = { ...(pkg.dependencies ?? {}), ...diff.add.dependencies };
  }
  if (diff.add?.devDependencies) {
    pkg.devDependencies = { ...(pkg.devDependencies ?? {}), ...diff.add.devDependencies };
  }

  if (pkg.dependencies) pkg.dependencies = sortKeys(pkg.dependencies);
  if (pkg.devDependencies) pkg.devDependencies = sortKeys(pkg.devDependencies);

  await fse.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key];
  return out;
}

async function renamePackage(targetDir: string, projectName: string): Promise<void> {
  const pkgPath = path.resolve(targetDir, "package.json");
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(await fse.readFile(pkgPath, "utf8")) as Record<string, unknown>;
  pkg.name = projectName;
  await fse.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function buildEnvFile(config: ScaffoldConfig): string {
  const lines: string[] = [
    "# Hedera operator credentials (testnet, server-side only, no NEXT_PUBLIC_ prefix)",
    `HEDERA_OPERATOR_ID=${config.operatorId}`,
    `HEDERA_OPERATOR_KEY=${config.operatorKey}`,
    "",
    "# LLM API keys (set the one that matches LLM_PROVIDER below; leave the other blank)",
    `OPENAI_API_KEY=${config.openaiKey}`,
    "# ANTHROPIC_API_KEY=",
    "",
    "# LLM provider & model",
    "# LLM_PROVIDER  — which provider to use. Must be: openai | anthropic",
    "# LLM_MODEL     — which model to use. Examples by provider:",
    "#                   openai     -> gpt-4o-mini (default), gpt-4o, gpt-4.1-mini",
    "#                   anthropic  -> claude-haiku-4-5 (default), claude-sonnet-4-6, claude-opus-4-7",
    "LLM_PROVIDER=openai",
    "LLM_MODEL=gpt-4o-mini",
    "",
  ];
  return lines.join("\n");
}

async function writeEnvFile(targetDir: string, config: ScaffoldConfig): Promise<void> {
  await fse.writeFile(path.resolve(targetDir, ".env.local"), buildEnvFile(config), "utf8");
}

async function ensureGitignoresEnvLocal(targetDir: string): Promise<void> {
  // The shipped template's .gitignore already matches `.env*`, but a missing
  // file (or one that's been hand-edited) shouldn't silently leak secrets.
  const gitignorePath = path.resolve(targetDir, ".gitignore");
  let contents = "";
  if (fs.existsSync(gitignorePath)) {
    contents = await fse.readFile(gitignorePath, "utf8");
  }
  if (!/^\.env\*$/m.test(contents) && !/^\.env\.local$/m.test(contents)) {
    const sep = contents.endsWith("\n") || contents === "" ? "" : "\n";
    contents = `${contents}${sep}\n# Local secrets\n.env*\n!.env.local.example\n`;
    await fse.writeFile(gitignorePath, contents, "utf8");
  }
}

function installCommandFor(pm: PackageManager): { command: string; args: string[] } {
  switch (pm) {
    case "npm":
      return { command: "npm", args: ["install"] };
    case "pnpm":
      return { command: "pnpm", args: ["install"] };
    case "yarn":
      return { command: "yarn", args: [] };
    case "bun":
      return { command: "bun", args: ["install"] };
  }
}

async function runInstall(targetDir: string, pm: PackageManager): Promise<boolean> {
  const { command, args } = installCommandFor(pm);
  console.log(dim(`Installing dependencies with ${command}…`));
  try {
    const execa = await loadExeca();
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

async function gitInit(targetDir: string): Promise<void> {
  try {
    const execa = await loadExeca();
    await execa("git", ["init"], { cwd: targetDir, stdio: "pipe" });
    await execa("git", ["add", "."], { cwd: targetDir, stdio: "pipe" });
    await execa("git", ["commit", "-m", "chore: scaffold with create-hedera-agent"], {
      cwd: targetDir,
      stdio: "pipe",
    });
  } catch {
    // git is optional; ignore failures so users without git installed still
    // get a working scaffold.
  }
}

function printNextSteps(config: ScaffoldConfig): void {
  const devCmd =
    config.packageManager === "npm"
      ? "npm run dev"
      : config.packageManager === "yarn"
        ? "yarn dev"
        : `${config.packageManager} run dev`;
  console.log("");
  console.log(green("Done."));
  console.log(
    `${bold("Next steps:")}\n` +
      `  cd ${config.name}\n` +
      `  ${devCmd}\n`,
  );
}

async function main(): Promise<void> {
  console.log(bold(cyan("Create Hedera Agent")));
  const flags = parseFlags(process.argv.slice(2));
  const config = await collectConfig(flags);

  const targetDir = path.resolve(process.cwd(), config.name);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.log(red(`Target directory already exists and is not empty: ${targetDir}`));
    process.exit(1);
  }

  const { templateDir, runtimeVariantsDir } = resolvePaths();

  await copyTemplate(templateDir, targetDir);
  await applyFrameworkOverlay(runtimeVariantsDir, targetDir, config.framework);
  await renamePackage(targetDir, config.name);
  await writeEnvFile(targetDir, config);
  await ensureGitignoresEnvLocal(targetDir);

  await runInstall(targetDir, config.packageManager);
  await gitInit(targetDir);

  printNextSteps(config);
  process.exit(0);
}

main().catch((err) => {
  console.error(red(String(err?.stack || err)));
  process.exit(1);
});
