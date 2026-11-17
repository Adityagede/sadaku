import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const basedir = process.argv[2] || process.env.MYSQL_TEST_BASEDIR;
if (!basedir) {
    console.error('Tentukan direktori instalasi MySQL: npm test -- "C:/laragon/bin/mysql/mysql-8.4.3-winx64"');
    process.exit(1);
}
const directory = resolve(root, `.test-mysql-${Date.now()}`);
const datadir = join(directory, 'data');
const port = 33000 + Math.floor(Math.random() * 1000);
const executable = name => join(basedir, 'bin', process.platform === 'win32' ? `${name}.exe` : name);
const mysqlArguments = ['--no-defaults', '--protocol=TCP', '--host=127.0.0.1', `--port=${port}`, '--user=root', '--password=', '--connect-timeout=1'];
const testEnvironment = {
    ...process.env,
    DB_HOST: '127.0.0.1',
    DB_PORT: String(port),
    DB_DATABASE: 'sadaku_test',
    DB_USERNAME: 'root',
    DB_PASSWORD: '',
    DB_SSL: 'false',
    APP_ENV: 'local',
    APP_RATE_URL: 'https://play.google.com/store/apps/details?id=example.sadaku',
    APP_SUPPORT_URL: 'https://example.org/support',
    SADAKU_ISOLATED_TEST: '1',
};
let mysql;
let mysqlLog = '';
await mkdir(directory);

try {
    console.log('Menyiapkan instance MySQL pengujian yang terpisah…');
    await run(executable('mysqld'), [
        '--no-defaults', '--initialize-insecure', '--console',
        `--basedir=${resolve(basedir)}`, `--datadir=${datadir}`
    ], { cwd: root, timeout: 60000, maxBuffer: 1024 * 1024 });
    mysql = spawn(executable('mysqld'), [
        '--no-defaults', '--console', `--basedir=${resolve(basedir)}`, `--datadir=${datadir}`,
        '--bind-address=127.0.0.1', `--port=${port}`, '--mysqlx=OFF', '--skip-log-bin',
        '--max-allowed-packet=16M', `--tmpdir=${directory}`
    ], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
    mysql.on('error', error => { mysqlLog += error.message; });
    mysql.stderr.on('data', chunk => { mysqlLog += chunk; });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (mysql.exitCode !== null) throw new Error('MySQL pengujian berhenti: ' + mysqlLog.slice(-2500));
        try {
            await run(executable('mysql'), [...mysqlArguments, '--execute=SELECT 1'], { timeout: 3000 });
            ready = true;
            break;
        } catch { await delay(100); }
    }
    if (!ready) throw new Error('MySQL pengujian belum siap: ' + mysqlLog.slice(-2500));
    await run(executable('mysql'), [...mysqlArguments, '--execute=CREATE DATABASE sadaku_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci']);
    const setup = await run('php', ['scripts/setup-database.php'], { cwd: root, env: testEnvironment });
    console.log(setup.stdout.trim());
    const check = await run('php', ['scripts/check-database.php'], { cwd: root, env: testEnvironment });
    console.log(check.stdout.trim());
    const result = await run(process.execPath, ['tests/test-api.mjs'], { cwd: root, env: testEnvironment, timeout: 60000, maxBuffer: 1024 * 1024 });
    console.log(result.stdout.trim());
    const productionResult = await run(process.execPath, ['tests/test-api.mjs'], {
        cwd: root,
        env: { ...testEnvironment, APP_ENV: 'production', APP_KEY: randomBytes(32).toString('hex') },
        timeout: 60000, maxBuffer: 1024 * 1024,
    });
    console.log('Mode produksi: ' + productionResult.stdout.trim());
    const reminders = await run('php', ['tests/reminder-dispatch.test.php'], { cwd: root, env: testEnvironment, timeout: 15000 });
    console.log(reminders.stdout.trim());
} catch (error) {
    console.error(error.stderr || error.message);
    process.exitCode = 1;
} finally {
    if (mysql && mysql.exitCode === null) {
        try {
            await run(executable('mysqladmin'), [...mysqlArguments, 'shutdown'], { timeout: 5000 });
        } catch { mysql.kill(); }
        if (mysql.exitCode === null) await new Promise(resolve => mysql.once('exit', resolve));
    }
    if (!directory.startsWith(resolve(root) + sep) || !directory.split(sep).at(-1).startsWith('.test-mysql-')) {
        throw new Error('Path pembersihan pengujian tidak valid.');
    }
    await rm(directory, { recursive: true, force: true });
}
