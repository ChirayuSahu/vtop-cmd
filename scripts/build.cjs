const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Compile src/*.ts into the scripts the packages ship. The source archive needs no compiling.
if (!process.argv.includes('--source-only')) {
  // TypeScript's package exports don't expose bin/tsc, so run it by path.
  const tscBin = path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');
  const tsc = spawnSync(process.execPath, [tscBin, '-p', path.join(__dirname, '..')], { stdio: 'inherit' });
  if (tsc.error) {
    console.error(`Could not run the TypeScript compiler: ${tsc.error.message}`);
    process.exit(1);
  }
  if (tsc.status !== 0) process.exit(tsc.status ?? 1);
}

const isWindows = process.platform === 'win32';
const command = isWindows ? 'py' : 'python3';
const args = [...(isWindows ? ['-3'] : []), 'scripts/build.py', ...process.argv.slice(2)];
const result = spawnSync(command, args, { stdio: 'inherit' });

if (result.error) {
  console.error(`Could not start ${command}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
