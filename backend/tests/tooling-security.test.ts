import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Patched YAML tooling compatibility', () => {
  let directory: string;
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'documind-nyc-test-')); });
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  it('loads YAML coverage configuration without the vulnerable argparse/sprintf chain', async () => {
    const config = path.join(directory, '.nycrc.yaml');
    fs.writeFileSync(config, 'all: true\ncheck-coverage: false\n');
    const { loadNycConfig } = require('@istanbuljs/load-nyc-config');
    const loaded = await loadNycConfig({ cwd: directory, nycrcPath: config });
    expect(loaded.all).toBe(true);
    expect(loaded.checkCoverage).toBe(false);
  });

  it('rejects unsafe executable YAML tags', async () => {
    const config = path.join(directory, '.nycrc.yaml');
    fs.writeFileSync(config, 'hook: !!js/function "function () {}"\n');
    const { loadNycConfig } = require('@istanbuljs/load-nyc-config');
    await expect(loadNycConfig({ cwd: directory, nycrcPath: config })).rejects.toThrow();
  });
});
