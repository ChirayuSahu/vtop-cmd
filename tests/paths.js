// Where a file that ships in the extension package lives in the repo, matching scripts/build.py:
// compiled scripts in build/ (tsc output), third-party code in vendor/, everything else in static/.
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function packaged(name) {
  if (name.startsWith('vendor/')) return path.join(root, name);
  if (/\.m?js$/.test(name)) return path.join(root, 'build', name);
  return path.join(root, 'static', name);
}

module.exports = { root, packaged };
