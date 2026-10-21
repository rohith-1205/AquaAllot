/**
 * dev.cjs - lets you start the Python backend with `npm run dev`.
 *
 *   1. finds Python on your laptop (py / python / python3)
 *   2. installs requirements.txt the first time (or when something is missing)
 *   3. starts app.py and prints its logs here
 */
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const here = __dirname;
const isWindows = process.platform === 'win32';
const env = { ...process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };

// ---------- 1. find Python ----------
const candidates = isWindows
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]];

const python = candidates.find(([cmd, args]) => {
  const result = spawnSync(cmd, [...args, '--version'], { encoding: 'utf8', shell: false });
  return result.status === 0 && /Python 3/.test(`${result.stdout}${result.stderr}`);
});

if (!python) {
  console.error('\n❌ Python 3 was not found. Install it from https://www.python.org/downloads/ and tick "Add to PATH".\n');
  process.exit(1);
}
const [pyCmd, pyArgs] = python;
const run = (args, options = {}) => spawnSync(pyCmd, [...pyArgs, ...args], { cwd: here, env, stdio: 'inherit', ...options });

// ---------- 2. install requirements if needed ----------
const check = spawnSync(pyCmd, [...pyArgs, '-c', 'import flask, flask_cors, dotenv, requests, paho.mqtt'], { cwd: here, env });
if (check.status !== 0) {
  console.log('📦 Installing backend packages (first run only)...');
  const install = run(['-m', 'pip', 'install', '-r', 'requirements.txt']);
  if (install.status !== 0) {
    console.error('\n❌ pip install failed. Try manually:  python -m pip install -r requirements.txt\n');
    process.exit(1);
  }
}

// ---------- 3. start the Flask app (or a tool) ----------
//   node dev.cjs          → backend
//   node dev.cjs check    → network check (which MQTT broker/port works here)
//   node dev.cjs fake     → fake ESP32 (pass extra options after it, e.g. --demo)
const [mode, ...extra] = process.argv.slice(2);
const scripts = {
  check: path.join(here, '..', 'tools', 'check_network.py'),
  fake: path.join(here, '..', 'tools', 'fake_esp32.py')
};
const script = scripts[mode] || path.join(here, 'app.py');
if (!scripts[mode]) console.log('🚀 Starting AquaAllot backend on http://localhost:5000 ...\n');
const server = spawn(pyCmd, [...pyArgs, script, ...extra], { cwd: here, env, stdio: 'inherit' });

server.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
