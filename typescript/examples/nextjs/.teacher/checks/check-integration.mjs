import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const candidates = [
    './src/lib/agent.ts',
    './src/lib/agent.tsx',
    './src/lib/agent.js',
    './src/lib/agent.jsx'
];

let agentPath = null, content = null;
for (const p of candidates) {
    try { content = readFileSync(p, 'utf8'); agentPath = p; break; } catch { }
}

if (!agentPath) {
    console.error('❌ Agent configuration not found. Checked:\n' + candidates.map(c => ` - ${c}`).join('\n'));
    process.exit(1);
}

// Must import from TS plugin
const importPath = /from ['"]@\/lib\/plugins\/hello['"]/;
const importNamed = /import\s+helloPlugin(?:\s*,\s*\{\s*HELLO\s*\})?/;

assert(importPath.test(content) && importNamed.test(content),
    '❌ Expected import of helloPlugin and HELLO from "@/lib/plugins/hello".');

// In config: plugins: [ ..., helloPlugin ]
const usesPlugin = /plugins\s*:\s*\[[^\]]*helloPlugin[^\]]*\]/s.test(content);
assert(usesPlugin, '❌ helloPlugin not present in the toolkit plugins array.');

// In config: tools: [ ..., HELLO ]
const usesTool = /tools\s*:\s*\[[^\]]*\bHELLO\b[^\]]*\]/s.test(content);
assert(usesTool, '❌ HELLO identifier not present in the toolkit tools array.');

console.log('✅ Plugin integrated and responding as expected.');
