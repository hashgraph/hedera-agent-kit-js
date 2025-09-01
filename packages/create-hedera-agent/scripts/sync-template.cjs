#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
const fse = require('fs-extra');

async function main() {
    const pkgDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();
    const repoRoot = path.resolve(pkgDir, '..', '..');
    const src = path.resolve(repoRoot, 'typescript', 'examples', 'nextjs');
    const dest = path.resolve(pkgDir, 'template');

    if (!fs.existsSync(src)) {
        console.error('Template source not found at', src);
        process.exit(1);
    }

    await fse.remove(dest);
    await fse.copy(src, dest, {
        filter: (file) => {
            const rel = path.relative(src, file);
            if (!rel) return true;
            if (rel.includes('node_modules')) return false;
            if (rel.startsWith('.next')) return false;
            if (rel === '.env.local' || rel.endsWith('/.env.local')) return false;
            if (rel.endsWith('package-lock.json') || rel.endsWith('pnpm-lock.yaml') || rel.endsWith('yarn.lock')) return false;
            return true;
        }
    });
    // Ensure .env.local is not accidentally present in the destination
    const destEnv = path.resolve(dest, '.env.local');
    if (fs.existsSync(destEnv)) {
        await fse.remove(destEnv);
    }
    console.log('Synced template to', dest);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});


