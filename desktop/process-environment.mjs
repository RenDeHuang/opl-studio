import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function uniqueDirectories(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function nodeVersionBins(homeDir, readDirectory) {
  const root = path.join(homeDir, ".nvm", "versions", "node");
  try {
    return readDirectory(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .map((name) => path.join(root, name, "bin"));
  } catch {
    return [];
  }
}

function managedRuntimeBins(homeDir, readDirectory) {
  const bins = [
    path.join(homeDir, "Library", "Application Support", "opl-studio", "runtime", "current", "bin"),
    path.join(homeDir, "Library", "Application Support", "OPL", "runtime", "current", "bin")
  ];
  const toolchainRoot = path.join(homeDir, ".opl", "toolchain");
  try {
    const toolchains = readDirectory(toolchainRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    bins.push(...toolchains.map((name) => path.join(toolchainRoot, name, "bin")));
  } catch {
    // The managed toolchain is optional on clean machines.
  }
  return bins;
}

function packagedFullRuntimeBins(resourcesPath) {
  if (!resourcesPath) return [];
  return [path.join(resourcesPath, "opl-studio-full-runtime", "runtime", "current", "bin")];
}

function findExecutable(name, directories, executable) {
  const candidates = process.platform === "win32" ? [`${name}.exe`, `${name}.cmd`, name] : [name];
  for (const directory of directories) {
    for (const candidateName of candidates) {
      const candidate = path.join(directory, candidateName);
      if (executable(candidate)) return candidate;
    }
  }
  return undefined;
}

function defaultExecutable(candidate) {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

export function resolveDesktopRuntimeEnvironment({
  env = process.env,
  homeDir = os.homedir(),
  resourcesPath = process.resourcesPath,
  activatedCodexPath,
  readDirectory = fs.readdirSync,
  executable = defaultExecutable
} = {}) {
  const searchDirectories = uniqueDirectories([
    ...String(env.PATH ?? "").split(path.delimiter),
    path.join(homeDir, ".local", "bin"),
    // `npm install -g` with a custom prefix installs here; a Finder-launched
    // App inherits only the system PATH, so the prefix has to be searched
    // explicitly or an existing Codex CLI stays invisible.
    path.join(homeDir, ".npm-global", "bin"),
    path.join(homeDir, ".volta", "bin"),
    path.join(homeDir, ".asdf", "shims"),
    path.join(homeDir, ".bun", "bin"),
    path.join(homeDir, "Library", "pnpm"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    ...nodeVersionBins(homeDir, readDirectory),
    ...managedRuntimeBins(homeDir, readDirectory),
    "/Applications/ChatGPT.app/Contents/Resources"
  ]);
  const oplSearchDirectories = uniqueDirectories([
    ...packagedFullRuntimeBins(resourcesPath),
    ...searchDirectories
  ]);
  const resolved = { ...env, PATH: searchDirectories.join(path.delimiter) };

  // App-owned resources seed first launch; they must not turn into a permanent
  // external override that prevents Framework's verified current activation.
  const bundledCodex = Boolean(env.OPL_CODEX_BIN && (env.OPL_CODEX_RUNTIME_SOURCE === "opl_bundle_seed"
    || resourcesPath && path.resolve(env.OPL_CODEX_BIN).startsWith(path.resolve(resourcesPath) + path.sep)));
  const explicitCodex = env.CODEX_APP_SERVER_COMMAND
    || env.OPL_CODEX_BIN && !bundledCodex
    || env.CODEX_CLI_PATH || env.CODEX_BIN;
  if (bundledCodex) resolved.OPL_CODEX_RUNTIME_SOURCE = "opl_bundle_seed";
  if (!explicitCodex && activatedCodexPath && path.isAbsolute(activatedCodexPath) && executable(activatedCodexPath)) {
    resolved.OPL_CODEX_BIN = activatedCodexPath;
    resolved.OPL_CODEX_RUNTIME_SOURCE = "opl_managed_current";
    if (!env.OPL_CODEX_PLUGIN_BIN || env.OPL_CODEX_PLUGIN_BIN === env.OPL_CODEX_BIN) {
      resolved.OPL_CODEX_PLUGIN_BIN = activatedCodexPath;
    }
  }

  if (!resolved.OPL_CODEX_BIN && !resolved.CODEX_APP_SERVER_COMMAND) {
    const codex = [env.CODEX_CLI_PATH, env.CODEX_BIN].filter(Boolean).find(executable)
      ?? findExecutable("codex", [path.join(env.CODEX_HOME || homeDir, ...(env.CODEX_HOME ? [] : [".codex"]), "packages", "standalone", "current"), ...searchDirectories], executable);
    if (codex) resolved.OPL_CODEX_BIN = codex;
  }
  if (!resolved.OPL_APP_OPL_BIN && !resolved.OPL_COMMAND) {
    const opl = findExecutable("opl", oplSearchDirectories, executable);
    if (opl) resolved.OPL_APP_OPL_BIN = opl;
  }
  // Framework Package actions must use the same selected Codex executable
  // even when it is outside PATH (for example a migrated standalone carrier).
  if (!resolved.OPL_CODEX_PLUGIN_BIN && resolved.OPL_CODEX_BIN) {
    resolved.OPL_CODEX_PLUGIN_BIN = resolved.OPL_CODEX_BIN;
  }
  return resolved;
}
