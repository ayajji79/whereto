import fs from 'fs';
import path from 'path';

console.log('Building index.html with updated modular scripts...');

const indexPath = path.resolve('index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');

// Find the main <script> tag after toast-container
const scriptStartToken = '<script>\n\n/* src/gasCode.js */';
const scriptEndToken = '</script>\n\n    <script>\n      // Additional modal helper for GAS code modal';

let beforePart = '';
let afterPart = '';

if (indexContent.includes(scriptStartToken) && indexContent.includes(scriptEndToken)) {
  beforePart = indexContent.substring(0, indexContent.indexOf(scriptStartToken));
  afterPart = indexContent.substring(indexContent.indexOf(scriptEndToken));
} else {
  // Try regex matching
  const regex = /<script>[\s\S]*?\/\* src\/gasCode\.js \*\/[\s\S]*?<\/script>\s*(?=<script>[\s\S]*?openGasCodeModal)/;
  const match = indexContent.match(regex);
  if (!match) {
    console.error('Could not find script markers in index.html');
    process.exit(1);
  }
  const idx = match.index;
  beforePart = indexContent.substring(0, idx);
  afterPart = indexContent.substring(idx + match[0].length);
}

// Read all modular src files
const gasCode = fs.readFileSync(path.resolve('src/gasCode.js'), 'utf-8');
const defaultData = fs.readFileSync(path.resolve('src/defaultData.js'), 'utf-8');
const storage = fs.readFileSync(path.resolve('src/storage.js'), 'utf-8');
const api = fs.readFileSync(path.resolve('src/api.js'), 'utf-8');
const generators = fs.readFileSync(path.resolve('src/generators.js'), 'utf-8');
const app = fs.readFileSync(path.resolve('src/app.js'), 'utf-8');

const combinedScript = `<script>

/* src/gasCode.js */
${gasCode}

/* src/defaultData.js */
${defaultData}

/* src/storage.js */
${storage}

/* src/api.js */
${api}

/* src/generators.js */
${generators}

/* src/app.js */
${app}

</script>`;

const finalHtml = beforePart + combinedScript + '\n\n    ' + afterPart;

fs.writeFileSync(indexPath, finalHtml, 'utf-8');
console.log('Successfully synchronized and rebuilt index.html!');
