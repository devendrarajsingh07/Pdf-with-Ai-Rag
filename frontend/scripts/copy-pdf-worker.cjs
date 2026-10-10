// Keep the locally served worker exactly matched to React-PDF's PDF.js dependency.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const reactPdf = path.dirname(require.resolve('react-pdf/package.json'));
const worker = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs', { paths: [reactPdf] });
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.copyFileSync(worker, path.join(root, 'public', 'pdf.worker.min.mjs'));
console.log('Copied matching local PDF.js worker.');
