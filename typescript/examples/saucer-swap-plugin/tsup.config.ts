import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["./src/index.ts"],
		outDir: "dist",
		format: ["cjs", "esm"],
		dts: true,
		sourcemap: true,
		external: ["@hashgraph/sdk", "hedera-agent-kit"],
	},
]);