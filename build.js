import fs from 'fs';
import path from 'path';

const scriptFiles = [
  'src/gasCode.js',
  'src/defaultData.js',
  'src/api.js',
  'src/storage.js',
  'src/generators.js',
  'src/app.js'
];

let bundledJs = '';
for (const file of scriptFiles) {
  const filePath = path.resolve(file);
  if (fs.existsSync(filePath)) {
    bundledJs += `\n/* --- ${file} --- */\n` + fs.readFileSync(filePath, 'utf-8') + '\n';
  }
}

const distDir = path.resolve('dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Write dist/bundle.js
const bundlePath = path.join(distDir, 'bundle.js');
fs.writeFileSync(bundlePath, bundledJs, 'utf-8');

// 2. Copy src folder to dist/src
const distSrcDir = path.join(distDir, 'src');
if (!fs.existsSync(distSrcDir)) {
  fs.mkdirSync(distSrcDir, { recursive: true });
}
for (const file of scriptFiles) {
  const target = path.join(distDir, file);
  fs.copyFileSync(path.resolve(file), target);
}

// 3. Update dist/index.html
const distIndexPath = path.join(distDir, 'index.html');
if (fs.existsSync(distIndexPath)) {
  let html = fs.readFileSync(distIndexPath, 'utf-8');
  html = html.replace(/<!-- Application Script Files -->[\s\S]*?<script src="\/src\/app\.js"><\/script>/, '<!-- Application Bundled Script -->\n    <script src="./bundle.js"></script>');
  html = html.replace(/<script src="\/src\/[a-zA-Z0-9]+\.js"><\/script>\s*/g, '');
  if (!html.includes('bundle.js')) {
    html = html.replace('</body>', '    <script src="./bundle.js"></script>\n  </body>');
  }
  fs.writeFileSync(distIndexPath, html, 'utf-8');
}
