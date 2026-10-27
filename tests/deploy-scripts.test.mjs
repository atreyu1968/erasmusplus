import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('Ubuntu deployment scripts have valid Bash syntax', () => {
  for (const path of [
    'deploy/install-ubuntu.sh',
    'deploy/update-ubuntu.sh',
    'deploy/init-admin-ubuntu.sh',
  ]) {
    const result = spawnSync('bash', ['-n', resolve(root, path)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${path}: ${result.stderr}`);
  }
});

test('Ubuntu installation uses noninteractive package configuration', () => {
  const installer = read('deploy/install-ubuntu.sh');
  assert.match(installer, /DEBIAN_FRONTEND=noninteractive/);
  assert.match(installer, /NEEDRESTART_MODE=l/);
  assert.match(installer, /--force-confold/);
  assert.match(installer, /apt_install\(\).*install -y/);
});

test('administrator bootstrap is idempotent and hides password input', () => {
  const initializer = read('deploy/init-admin-ubuntu.sh');
  assert.match(initializer, /role = \? LIMIT 1/);
  assert.match(initializer, /present\).*Ya existe una cuenta de coordinación/);
  assert.match(initializer, /read -r -s -p 'Contraseña inicial/);
  assert.match(initializer, /MMG_ADMIN_PASSWORD/);
});

test('updater refreshes the bootstrap helper and avoids unattended prompts', () => {
  const updater = read('deploy/update-ubuntu.sh');
  assert.match(updater, /No existe una cuenta de coordinación y esta actualización no tiene terminal/);
  assert.match(updater, /install_admin_helper "\$STAGE\/deploy\/init-admin-ubuntu\.sh"/);
  assert.match(updater, /install_admin_helper "\$FINAL\/deploy\/init-admin-ubuntu\.sh"/);
  assert.match(updater, /\/usr\/local\/sbin\/erasmusplus-init-admin/);
});
