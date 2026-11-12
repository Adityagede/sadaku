import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const root = fileURLToPath(new URL('../', import.meta.url));
const inputPath = resolve(root, 'assets/css/tailwind.css');
const input = await readFile(inputPath, 'utf8');
const compiler = await compile(input, {
    base: resolve(root, 'assets/css'),
    onDependency() {}
});
const scanner = new Scanner({
    sources: [
        { base: root, pattern: 'index.html', negated: false },
        { base: root, pattern: 'pages/**/*.{html,php}', negated: false },
        { base: root, pattern: 'assets/js/**/*.js', negated: false }
    ]
});

await writeFile(resolve(root, 'assets/css/style.css'), compiler.build(scanner.scan()));
console.log('CSS selesai dibangun: assets/css/style.css');
