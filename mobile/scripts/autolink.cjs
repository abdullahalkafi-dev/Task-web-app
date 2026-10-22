// Expo resolves filesystem paths to their physical drive. Keep its JSON paths
// on the same verified SUBST alias as Gradle/CMake on long Windows workspaces.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const pkg = require.resolve('expo-modules-autolinking/package.json');
const output = execFileSync(process.execPath, [path.join(path.dirname(pkg), 'bin/expo-modules-autolinking.js'), 'react-native-config', '--json', ...process.argv.slice(2)], { encoding: 'utf8', cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'inherit'] });
const real = process.env.DAYFLOW_WORKSPACE_REAL, alias = process.env.DAYFLOW_WORKSPACE_ALIAS;
function rewrite(value) {
  if (typeof value === 'string' && real && alias) return value.replaceAll(real, alias).replaceAll(real.replaceAll('\\', '/'), alias.replaceAll('\\', '/'));
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child)]));
  return value;
}
process.stdout.write(JSON.stringify(rewrite(JSON.parse(output))));
