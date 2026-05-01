// Run with: node deploy.mjs
// Builds the project, copies production files to root for gh-pages, commits+pushes, then restores dev index.html.
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, cpSync, rmSync } from 'fs';

const devHtml = readFileSync('index.html', 'utf8');

try {
  console.log('Building...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('Copying assets to root...');
  rmSync('assets', { recursive: true, force: true });
  cpSync('dist/assets', 'assets', { recursive: true });

  console.log('Writing production index.html + 404.html...');
  const prodHtml = readFileSync('dist/index.html', 'utf8');
  writeFileSync('index.html', prodHtml);
  writeFileSync('404.html', prodHtml);

  const msg = `Deploy ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "${msg}"`, { stdio: 'inherit' });
  execSync('git push origin gh-pages', { stdio: 'inherit' });

  console.log('Pushed. Restoring dev index.html...');
} finally {
  writeFileSync('index.html', devHtml);
  console.log('Done. Dev index.html restored.');
}
