// Run with: node deploy.mjs
// Builds the project, copies production files to root for gh-pages, commits+pushes, then restores dev index.html.
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, cpSync, rmSync, existsSync } from 'fs';

function preparePagesDist() {
  if (!existsSync('dist/index.html')) {
    throw new Error('dist/index.html not found. Run vite build first.');
  }
  const prodHtml = readFileSync('dist/index.html', 'utf8');
  writeFileSync('dist/404.html', prodHtml);
  writeFileSync('dist/CNAME', 'fluttershy.horsefucker.ru\n');
}

if (process.argv.includes('--prepare-pages')) {
  preparePagesDist();
  process.exit(0);
}

const devHtml = readFileSync('index.html', 'utf8');

try {
  console.log('Building...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('Copying assets to root...');
  rmSync('assets', { recursive: true, force: true });
  cpSync('dist/assets', 'assets', { recursive: true });

  // Vite's chunk-dep map references assets/index2.css for a CSS chunk
  // that doesn't actually get emitted (highlight.js side-effect import is
  // empty after our overrides). Write a stub so the preload succeeds.
  if (!existsSync('assets/index2.css')) writeFileSync('assets/index2.css', '');
  if (!existsSync('dist/assets/index2.css')) writeFileSync('dist/assets/index2.css', '');

  console.log('Writing production index.html + 404.html...');
  const prodHtml = readFileSync('dist/index.html', 'utf8');
  writeFileSync('index.html', prodHtml);
  writeFileSync('404.html', prodHtml);
  writeFileSync('CNAME', 'fluttershy.horsefucker.ru\n');

  const msg = `Deploy ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "${msg}"`, { stdio: 'inherit' });
  execSync('git push origin gh-pages', { stdio: 'inherit' });

  console.log('Pushed. Restoring dev index.html...');
} finally {
  writeFileSync('index.html', devHtml);
  console.log('Done. Dev index.html restored.');
}
