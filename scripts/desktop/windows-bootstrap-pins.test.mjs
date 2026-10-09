import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWindowsBootstrapPins } from './prepare-wsl-host-payload.mjs';

function fixture() {
  return {
    policy: { schema: 'opl_app_windows_bootstrap_pins.v1', platform: 'linux', arch: 'x64', node: { dependency_id: 'node' }, codex: { dependency_id: 'codex-cli' } },
    qualification: { runtime_payloads: { codex_cli: { dependency_id: 'codex-cli' } } },
    resolved: { schema_version: 'opl.resolved-dependency-releases.v1', platform: 'linux', architecture: 'x64', dependencies: [
      { dependency_id: 'node', version: '24.1.0', archive_url: 'https://nodejs.org/dist/v24.1.0/node-v24.1.0-linux-x64.tar.gz', archive_sha256: 'a'.repeat(64) },
      { dependency_id: 'codex-cli', version: '0.162.0', install_metadata: { npm_platform: { package: '@openai/codex', version: '0.162.0-linux-x64', tarball_url: 'https://registry.npmjs.org/@openai/codex/-/codex-0.162.0-linux-x64.tgz', tarball_sha256: 'b'.repeat(64), npm_integrity: 'sha512-YWJjZA==' } } },
    ] },
  };
}
test('unversioned App policy consumes the exact Framework Linux platform archive', () => {
  const x = fixture();
  const pins = resolveWindowsBootstrapPins(x.policy, x.qualification, x.resolved);
  assert.equal(pins.codex.version, '0.162.0');
  assert.equal(pins.codex.sha256, 'b'.repeat(64));
  assert.equal(pins.codex.url, x.resolved.dependencies[1].install_metadata.npm_platform.tarball_url);
});
test('rejects another platform, mismatched Codex version and unverified archives', () => {
  for (const mutate of [x => { x.resolved.platform = 'darwin'; }, x => { x.resolved.dependencies[1].install_metadata.npm_platform.version = '0.161.0-linux-x64'; }, x => { delete x.resolved.dependencies[0].archive_sha256; }]) {
    const x = fixture(); mutate(x);
    assert.throws(() => resolveWindowsBootstrapPins(x.policy, x.qualification, x.resolved));
  }
});
