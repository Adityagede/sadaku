import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Windows PHP needs OPENSSL_CONF before the process starts to create push keys.
const environment = { ...process.env };
if (process.platform === 'win32' && !environment.OPENSSL_CONF) {
    const directory = execFileSync('php', ['-r', 'echo dirname(php_ini_loaded_file() ?: PHP_BINARY);'], { encoding: 'utf8' }).trim();
    const configuration = join(directory, 'extras', 'ssl', 'openssl.cnf');
    if (existsSync(configuration)) environment.OPENSSL_CONF = configuration;
}
const children = [];
function run(args) {
    const child = spawn('php', args, { env: environment, stdio: 'inherit', windowsHide: true });
    children.push(child);
    child.on('error', error => { console.error(error.message); stop(1); });
    child.on('exit', code => { if (!stopping) stop(code ?? 1); });
    return child;
}
let stopping = false;
function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) if (child.exitCode === null) child.kill();
    process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
if (process.argv[2] === '--dev') {
    run(['-d', 'upload_max_filesize=4M', '-d', 'post_max_size=4352K', '-S', '127.0.0.1:8080', 'scripts/serve.php']);
    const configured = execFileSync('php', ['-r', "require 'php/push.php'; echo push_status()['configured'] ? 'yes' : 'no';"], { env: environment, encoding: 'utf8' }).trim();
    if (configured === 'yes') run(['scripts/send-reminders.php', '--watch']);
    else console.log('Pengingat belum diaktifkan. Ikuti bagian Rencana menabung di README.md untuk konfigurasi.');
} else run(process.argv.slice(2));
