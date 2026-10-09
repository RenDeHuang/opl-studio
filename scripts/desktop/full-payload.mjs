#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractPath = path.join(root, "contracts/full-payload-carrier.json");

export function readFullPayloadCarrier() {
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  if (contract.schema !== "opl_app_full_payload_carrier.v1") {
    throw new Error("Studio Full payload carrier contract schema is invalid");
  }
  if (contract.authority_owner !== "one-person-lab-app" || contract.carrier_id !== "opl-studio") {
    throw new Error("Studio Full payload must remain App-owned and carrier-scoped");
  }
  if (contract.runtime_boundary?.codex_runtime_owner !== "opl-codex-native") {
    throw new Error("Studio Full payload must keep opl-codex-native as Codex runtime owner");
  }
  if (contract.runtime_boundary?.framework_managed_codex_payload_in_app_bundle_allowed !== false) {
    throw new Error("Studio Full payload must not embed a Framework-managed Codex payload");
  }
  return contract;
}

export function fullBuildEnvironment({ appRoot, studioRoot = root, env = process.env, releaseIdentity } = {}) {
  if (!appRoot) throw new Error("OPL_APP_REPO_ROOT is required for Studio Full builds");
  const carrier = readFullPayloadCarrier();
  const manifestPath = env.OPL_RELEASE_DEPENDENCY_MANIFEST;
  if (!manifestPath) throw new Error("OPL_RELEASE_DEPENDENCY_MANIFEST is required for Studio builds");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const codex = manifest.runtime_payloads?.codex_cli;
  if (manifest.schema !== "opl_app_release_qualification_input_manifest.v1"
    || !/^\d+\.\d+\.\d+$/.test(codex?.version ?? "")
    || !/^sha512-[A-Za-z0-9+/=]+$/.test(codex?.npm_integrity ?? "")
    || !/^sha256-[0-9a-f]{64}$/.test(`sha256-${codex?.tarball_sha256 ?? ""}`)) {
    throw new Error("Studio builds require a valid Framework-resolved Codex qualification input");
  }
  const { version } = JSON.parse(fs.readFileSync(path.join(studioRoot, "package.json"), "utf8"));
  return {
    ...env,
    OPL_APP_REPO_ROOT: path.resolve(appRoot),
    OPL_FULL_GUI_ROOT: path.resolve(studioRoot),
    OPL_FULL_CARRIER_ID: carrier.carrier_id,
    OPL_RELEASE_VERSION: releaseIdentity?.display ?? version,
    OPL_UPDATER_VERSION: releaseIdentity?.machine ?? version,
    OPL_RELEASE_DEPENDENCY_MANIFEST: path.resolve(manifestPath),
    OPL_CODEX_NPM_SPEC: `@openai/codex@${codex.version}`,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const carrier = readFullPayloadCarrier();
  process.stdout.write(`${JSON.stringify({ status: "valid", carrier }, null, 2)}\n`);
}
