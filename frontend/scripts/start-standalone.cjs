const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const standalone = path.join(root, '.next', 'standalone');
const server = path.join(standalone, 'server.js');
if (!fs.existsSync(server)) {
  console.error('Production build missing. Run npm run build before npm start.');
  process.exit(1);
}

fs.cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
fs.cpSync(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });
process.env.HOSTNAME = process.env.APP_HOST || '127.0.0.1';
process.env.PORT ||= '3000';
require(server);
