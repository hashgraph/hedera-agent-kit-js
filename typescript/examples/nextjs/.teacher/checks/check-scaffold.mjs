import { statSync } from 'node:fs';

function mustExist(path, msg) {
    try { statSync(path); }
    catch { console.error(`❌ ${msg}`); process.exit(1); }
}

mustExist('./src', 'Missing ./src directory (are you in the Next.js app root?).');
mustExist('./src/lib', 'Missing ./src/lib directory.');
mustExist('./src/lib/plugins', 'Missing ./src/lib/plugins directory.');
mustExist('./src/lib/plugins/hello.ts', 'Missing plugin file at src/lib/plugins/hello.ts.');

console.log('✅ Scaffold detected.');
