import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = resolve(root, 'assets/js');
function filesIn(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = resolve(directory, entry.name);
        return entry.isDirectory() ? filesIn(file) : file.endsWith('.js') ? [file] : [];
    });
}
const files = filesIn(sourceRoot);
const dependencies = new Map();
for (const file of files) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)].map(match => resolve(dirname(file), match[1]));
    for (const target of imports) {
        if (!target.startsWith(sourceRoot + sep) || !files.includes(target)) throw new Error(`Import tidak valid: ${relative(root, file)} → ${target}`);
    }
    dependencies.set(file, imports);
}
const reached = new Set();
function visit(file) {
    if (reached.has(file)) return;
    reached.add(file);
    for (const dependency of dependencies.get(file) || []) visit(dependency);
}
visit(resolve(sourceRoot, 'app.js'));
visit(resolve(sourceRoot, 'components/theme.js'));
const unused = files.filter(file => !reached.has(file));
if (unused.length) throw new Error('Modul tidak terhubung ke aplikasi: ' + unused.map(file => relative(root, file)).join(', '));
const router = readFileSync(resolve(root, 'scripts/serve.php'), 'utf8');
const worker = readFileSync(resolve(root, 'sw.js'), 'utf8');
for (const file of files) {
    const url = relative(root, file).split(sep).join('/');
    if (!router.includes(`'/${url}'`) || !worker.includes(`'${url}'`)) throw new Error(`Modul belum masuk router/cache offline: ${url}`);
}
console.log(`${files.length} modul: sintaks, impor, keterjangkauan, router, dan cache offline valid.`);
