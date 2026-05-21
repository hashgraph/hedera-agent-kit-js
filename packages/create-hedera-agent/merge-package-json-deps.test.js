import { describe, expect, it } from "vitest";

import { mergePackageJsonDeps } from "./merge-package-json-deps.js";

function bufFrom(obj) {
  return Buffer.from(JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function uint8From(obj) {
  return new TextEncoder().encode(JSON.stringify(obj, null, 2) + "\n");
}

function parseFile(fileMap, path = "package.json") {
  return JSON.parse(new TextDecoder().decode(fileMap[path]));
}

describe("mergePackageJsonDeps", () => {
  describe("no-op cases", () => {
    it("should return the input file map reference unchanged when deps is empty", () => {
      const fileMap = { "package.json": bufFrom({ name: "x", dependencies: {} }) };
      const result = mergePackageJsonDeps(fileMap, {});
      expect(result).toBe(fileMap);
    });

    it("should return the input file map reference unchanged when deps is null", () => {
      const fileMap = { "package.json": bufFrom({ name: "x" }) };
      const result = mergePackageJsonDeps(fileMap, null);
      expect(result).toBe(fileMap);
    });
  });

  describe("merging", () => {
    it("should add new deps and keep existing ones", () => {
      const fileMap = {
        "package.json": bufFrom({
          name: "x",
          dependencies: { "@hashgraph/hedera-agent-kit": "4.0.0" },
        }),
      };
      const result = mergePackageJsonDeps(fileMap, {
        "hak-saucerswap-plugin": "^2.1.0",
      });
      const pkg = parseFile(result);
      expect(pkg.dependencies["@hashgraph/hedera-agent-kit"]).toBe("4.0.0");
      expect(pkg.dependencies["hak-saucerswap-plugin"]).toBe("^2.1.0");
    });

    it("should sort dependency keys alphabetically", () => {
      const fileMap = {
        "package.json": bufFrom({
          name: "x",
          dependencies: { zoo: "1.0.0", apple: "1.0.0" },
        }),
      };
      const result = mergePackageJsonDeps(fileMap, { middle: "1.0.0" });
      const pkg = parseFile(result);
      expect(Object.keys(pkg.dependencies)).toEqual(["apple", "middle", "zoo"]);
    });

    it("should let merged deps win on key collision (caller's value overrides)", () => {
      const fileMap = {
        "package.json": bufFrom({
          name: "x",
          dependencies: { foo: "1.0.0" },
        }),
      };
      const result = mergePackageJsonDeps(fileMap, { foo: "2.0.0" });
      const pkg = parseFile(result);
      expect(pkg.dependencies.foo).toBe("2.0.0");
    });

    it("should preserve other top-level package.json fields", () => {
      const fileMap = {
        "package.json": bufFrom({
          name: "x",
          version: "1.0.0",
          scripts: { web: "next dev" },
          dependencies: {},
        }),
      };
      const result = mergePackageJsonDeps(fileMap, { foo: "1.0.0" });
      const pkg = parseFile(result);
      expect(pkg.name).toBe("x");
      expect(pkg.version).toBe("1.0.0");
      expect(pkg.scripts.web).toBe("next dev");
    });

    it("should not mutate the input file map", () => {
      const fileMap = {
        "package.json": bufFrom({ name: "x", dependencies: {} }),
      };
      const inputKeys = Object.keys(fileMap);
      const originalBytes = fileMap["package.json"];
      mergePackageJsonDeps(fileMap, { foo: "1.0.0" });
      expect(Object.keys(fileMap)).toEqual(inputKeys);
      expect(fileMap["package.json"]).toBe(originalBytes);
    });

    it("should write back bytes that round-trip through JSON.parse (no Uint8Array.toString regression)", () => {
      const fileMap = {
        "package.json": uint8From({ name: "x", dependencies: {} }),
      };
      const result = mergePackageJsonDeps(fileMap, { foo: "1.0.0" });
      // If we accidentally encoded via Uint8Array#toString, the file would
      // start with `91,32,...` (comma-separated bytes) and fail JSON.parse.
      expect(() => parseFile(result)).not.toThrow();
    });
  });

  describe("custom package.json path", () => {
    it("should target the path supplied via options.packageJsonPath", () => {
      const fileMap = {
        "monorepo/package.json": bufFrom({ name: "y", dependencies: {} }),
      };
      const result = mergePackageJsonDeps(
        fileMap,
        { foo: "1.0.0" },
        { packageJsonPath: "monorepo/package.json" },
      );
      const pkg = parseFile(result, "monorepo/package.json");
      expect(pkg.dependencies.foo).toBe("1.0.0");
    });
  });

  describe("error handling", () => {
    it("should throw when the package.json file is missing", () => {
      expect(() => mergePackageJsonDeps({}, { foo: "1.0.0" })).toThrow(
        /file map is missing "package\.json"/,
      );
    });

    it("should throw when package.json is unparseable", () => {
      const fileMap = { "package.json": Buffer.from("{ not json", "utf8") };
      expect(() => mergePackageJsonDeps(fileMap, { foo: "1.0.0" })).toThrow(
        /not valid JSON/,
      );
    });
  });
});
