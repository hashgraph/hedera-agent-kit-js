#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import fse from "fs-extra";
import prompts, { PromptObject } from "prompts";
import { bold, cyan, green, red, yellow } from "kolorist";
// Lazy import to avoid early ESM/CJS warnings disrupting prompts
async function loadExeca() {
    const mod = await import("execa");
    return mod.execa;
}

type Mode = "autonomous" | "human";
type Network = "testnet" | "mainnet";

type CliFlags = {
    mode?: Mode;
    network?: Network;
    name?: string;
};

function parseFlags(argv: string[]): CliFlags {
    const flags: CliFlags = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = argv[i + 1];
        if (arg === "--mode" && next) flags.mode = next as Mode;
        if (arg === "--network" && next) flags.network = next as Network;
        if ((arg === "--name" || arg === "--project-name") && next) flags.name = next;
    }
    return flags;
}

async function main() {
    console.log(bold(cyan("Create Hedera Agent")));
    const isLikelyEcdsaPrivateKey = (key: string | undefined): boolean => {
        if (!key || typeof key !== "string") return false;
        const trimmed = key.trim();
        // Accept Hedera ECDSA DER encodings: typically start with 303002... (EC Private Key structure)
        // Common form: 30300201010420<32-byte-hex>...
        if (/^303002/i.test(trimmed)) return true;
        if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return true;
        // Fallback: long hex string >= 64 chars
        if (/^[0-9a-fA-F]{64,}$/.test(trimmed)) return true;
        return false;
    };

    const flags = parseFlags(process.argv.slice(2));

    const responses = await prompts(
        [
            {
                type: flags.name ? null : "text",
                name: "name",
                message: "Project name",
                initial: "hedera-agent-app",
            } as PromptObject,
            {
                type: flags.mode ? null : "select",
                name: "mode",
                message: "Mode",
                choices: [
                    { title: "Autonomous (server signs)", value: "autonomous" },
                    { title: "Human-in-the-Loop (WalletConnect)", value: "human" },
                ],
                initial: 1,
            } as PromptObject,
            {
                type: flags.network ? null : "select",
                name: "network",
                message: "Network",
                choices: [
                    { title: "testnet", value: "testnet" },
                    { title: "mainnet", value: "mainnet" },
                ],
                initial: 0,
            } as PromptObject,
            {
                type: (prev, values) => (values.mode === "autonomous" && !process.env.HEDERA_OPERATOR_ID ? "text" : null),
                name: "HEDERA_OPERATOR_ID",
                message: "HEDERA_OPERATOR_ID (autonomous, e.g. 0.0.x)",
            } as PromptObject,
            {
                type: (prev, values) => (values.mode === "autonomous" && !process.env.HEDERA_OPERATOR_KEY ? "password" : null),
                name: "HEDERA_OPERATOR_KEY",
                message: "HEDERA_OPERATOR_KEY (autonomous, ECDSA – DER hex starting with 303002… or 0x-prefixed 64-hex; get from https://portal.hedera.com)",
                validate: (value: string) =>
                    isLikelyEcdsaPrivateKey(value) ||
                    "Must be an ECDSA private key (DER hex starting with 303002… or 0x-prefixed 64-hex).",
            } as PromptObject,
            {
                type: (prev, values) => (values.mode === "human" ? "text" : null),
                name: "NEXT_PUBLIC_WC_PROJECT_ID",
                message: "NEXT_PUBLIC_WC_PROJECT_ID (WalletConnect – get from https://dashboard.reown.com)",
                validate: (v: string) => !!v?.trim() || "WalletConnect Project ID is required",
            } as PromptObject,
            {
                type: "select",
                name: "aiProvider",
                message: "AI provider",
                choices: [
                    { title: "OpenAI", value: "openai" },
                    { title: "Anthropic", value: "anthropic" },
                    { title: "Groq", value: "groq" },
                    { title: "Ollama", value: "ollama" },
                ],
                initial: 0,
            } as PromptObject,
            {
                type: (prev, values) => (values.aiProvider === "openai" ? "password" : null),
                name: "OPENAI_API_KEY",
                message: "OPENAI_API_KEY",
                validate: (v: string) => !!v?.trim() || "OPENAI_API_KEY is required for OpenAI",
            } as PromptObject,
            {
                type: (prev, values) => (values.aiProvider === "anthropic" ? "password" : null),
                name: "ANTHROPIC_API_KEY",
                message: "ANTHROPIC_API_KEY",
                validate: (v: string) => !!v?.trim() || "ANTHROPIC_API_KEY is required for Anthropic",
            } as PromptObject,
            {
                type: (prev, values) => (values.aiProvider === "groq" ? "password" : null),
                name: "GROQ_API_KEY",
                message: "GROQ_API_KEY",
                validate: (v: string) => !!v?.trim() || "GROQ_API_KEY is required for Groq",
            } as PromptObject,
            {
                type: (prev, values) => (values.aiProvider === "ollama" ? "text" : null),
                name: "OLLAMA_BASE_URL",
                message: "OLLAMA_BASE_URL (e.g. http://localhost:11434)",
                initial: "http://localhost:11434",
                validate: (v: string) => !!v?.trim() || "OLLAMA_BASE_URL is required for Ollama",
            } as PromptObject,
        ],
        {
            onCancel: () => {
                console.log(yellow("Aborted."));
                process.exit(1);
            },
        }
    );

    const projectName = (flags.name || responses.name || "hedera-agent-app").trim();
    const mode = (flags.mode || responses.mode || "human") as Mode;
    const network = (flags.network || responses.network || "testnet") as Network;

    const targetDir = path.resolve(process.cwd(), projectName);
    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
        console.log(red(`Target directory already exists and is not empty: ${targetDir}`));
        process.exit(1);
    }

    // Prefer packaged template when installed via npm, fallback to repo path during local dev
    const packagedTemplatePrimary = path.resolve(__dirname, "..", "template"); // package root
    const packagedTemplateAlt = path.resolve(__dirname, "template"); // in case bundler layout differs
    let templateDir = packagedTemplatePrimary;
    if (!fs.existsSync(templateDir)) templateDir = packagedTemplateAlt;
    if (!fs.existsSync(templateDir)) {
        const repoRoot = path.resolve(__dirname, "..", "..", "..");
        const devTemplate = path.resolve(repoRoot, "typescript", "examples", "nextjs");
        if (fs.existsSync(devTemplate)) {
            templateDir = devTemplate;
        } else {
            console.error(
                red(
                    "Template not found. The package should include a 'template' directory. If developing locally, ensure typescript/examples/nextjs exists."
                )
            );
            process.exit(1);
        }
    }

    // Copy template
    await fse.copy(templateDir, targetDir, {
        filter: (src) => {
            const rel = path.relative(templateDir, src);
            // Exclude lockfiles and .next
            if (rel.includes("node_modules") || rel.startsWith(".next")) return false;
            return true;
        },
    });

    // Write .env.local
    const envLines: string[] = [];
    envLines.push(`NEXT_PUBLIC_NETWORK=${network}`);
    envLines.push(`NEXT_PUBLIC_AGENT_MODE=${mode}`);
    if (mode === "autonomous") {
        const id = responses.HEDERA_OPERATOR_ID || process.env.HEDERA_OPERATOR_ID || "";
        const key = responses.HEDERA_OPERATOR_KEY || process.env.HEDERA_OPERATOR_KEY || "";
        envLines.push(`HEDERA_OPERATOR_ID=${id}`);
        envLines.push(`HEDERA_OPERATOR_KEY=${key}`);
    } else {
        const wcId = responses.NEXT_PUBLIC_WC_PROJECT_ID || process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
        envLines.push(`NEXT_PUBLIC_WC_PROJECT_ID=${wcId}`);
    }

    // Optional AI provider keys
    const aiProvider = responses.aiProvider as
        | "openai"
        | "anthropic"
        | "groq"
        | "ollama"
        | undefined;
    if (aiProvider) {
        envLines.push(`AI_PROVIDER=${aiProvider}`);
        if (aiProvider === "openai" && responses.OPENAI_API_KEY) {
            envLines.push(`OPENAI_API_KEY=${responses.OPENAI_API_KEY}`);
        } else if (aiProvider === "anthropic" && responses.ANTHROPIC_API_KEY) {
            envLines.push(`ANTHROPIC_API_KEY=${responses.ANTHROPIC_API_KEY}`);
        } else if (aiProvider === "groq" && responses.GROQ_API_KEY) {
            envLines.push(`GROQ_API_KEY=${responses.GROQ_API_KEY}`);
        } else if (aiProvider === "ollama" && responses.OLLAMA_BASE_URL) {
            envLines.push(`OLLAMA_BASE_URL=${responses.OLLAMA_BASE_URL}`);
        }
    }

    await fse.writeFile(path.join(targetDir, ".env.local"), envLines.join("\n") + "\n", "utf8");

    // Update package.json name field in generated app if present
    const appPkgPath = path.join(targetDir, "package.json");
    if (fs.existsSync(appPkgPath)) {
        const appPkg = JSON.parse(await fse.readFile(appPkgPath, "utf8"));
        appPkg.name = projectName;
        await fse.writeFile(appPkgPath, JSON.stringify(appPkg, null, 2) + "\n", "utf8");
    }

    // Skipping automatic dependency installation to let the user install manually

    // Initialize git (optional)
    try {
        const execa = await loadExeca();
        await execa("git", ["init"], { cwd: targetDir, stdio: "pipe" });
        await execa("git", ["add", "."], { cwd: targetDir, stdio: "pipe" });
        await execa("git", ["commit", "-m", "chore: scaffold with create-hedera-agent"], {
            cwd: targetDir,
            stdio: "pipe",
        });
    } catch { }

    // Next steps
    console.log("");
    console.log(green("Done."));
    console.log(
        `${bold("Next steps:")}\n` +
        `  cd ${projectName}\n` +
        `  npm i\n` +
        `  npm run dev\n`
    );
    // Ensure the CLI exits cleanly even if some child process leaves open handles
    process.exit(0);
}

main().catch((err) => {
    console.error(red(String(err?.stack || err)));
    process.exit(1);
});


