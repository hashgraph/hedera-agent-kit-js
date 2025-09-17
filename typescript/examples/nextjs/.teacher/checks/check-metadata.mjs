import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tsPath = './src/lib/plugins/hello.ts';

let src = '';
try {
    src = readFileSync(tsPath, 'utf8');
} catch (e) {
    console.error(`❌ Unable to read ${tsPath}:`, e?.message || e);
    process.exit(1);
}

// Quick static checks for name/version/description presence in default export
const hasName = /name\s*:\s*['"][^'"]+['"]/.test(src);
const hasVersion = /version\s*:\s*['"][^'"]+['"]/.test(src);
const hasDescription = /description\s*:\s*['"][^'"]+['"]/.test(src);
const hasTools = /tools\s*:\s*\(\)\s*=>\s*\[/.test(src) || /tools\s*:\s*\(\)\s*=>\s*\w+/.test(src);

assert(hasName, '❌ Plugin.name missing in default export.');
assert(hasVersion, '❌ Plugin.version missing in default export.');
assert(hasDescription, '❌ Plugin.description missing in default export.');
assert(hasTools, '❌ Plugin.tools() missing or not returning a collection.');

if (!/HELLO/.test(src)) {
    console.error('❌ Expected Hello tool (method "HELLO") to be registered in tools().');
    process.exit(1);
}

console.log('✅ Plugin metadata and tool registration complete.');
