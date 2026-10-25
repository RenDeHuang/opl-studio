import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

Object.assign(globalThis, {
  __OPL_CODEX_MODEL_POLICY__: {
    source: "bridge-module-parity-test",
    defaultModel: "test-model",
    defaultReasoningEffort: "high",
    visibleModels: [{ id: "test-model" }],
    reasoningEfforts: ["high"],
    autoLabel: { zh: "Auto", en: "Auto" },
    knownModelReasoningEffortOverrides: {},
    acceptUnknownCatalogDefault: true,
    useHighestSupportedReasoningForUnknown: true
  }
});

const [root, commands, action, events, models, platform, threads] = await Promise.all([
  import("../../src/bridge/oplBridge"),
  import("../../src/bridge/oplBridge-commands"),
  import("../../src/bridge/oplBridge-normalizers-action"),
  import("../../src/bridge/oplBridge-normalizers-events"),
  import("../../src/bridge/oplBridge-normalizers-codex"),
  import("../../src/bridge/oplBridge-normalizers-platform"),
  import("../../src/bridge/oplBridge-normalizers-threads")
]);

const bridgeDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../src/bridge");
const leafModules = [
  "oplBridge-commands.ts",
  "oplBridge-primitives.ts",
  "oplBridge-types-state.ts",
  "oplBridge-types-codex-workspace.ts",
  "oplBridge-types-platform-events.ts",
  "oplBridge-normalizers-action.ts",
  "oplBridge-normalizers-codex.ts",
  "oplBridge-normalizers-domain.ts",
  "oplBridge-normalizers-events.ts",
  "oplBridge-normalizers-platform.ts",
  "oplBridge-normalizers-state.ts",
  "oplBridge-normalizers-threads.ts"
];

test("root facade preserves module export identity", () => {
  expect(root.OPL_COMMANDS).toBe(commands.OPL_COMMANDS);
  expect(root.CODEX_APP_SERVER).toBe(commands.CODEX_APP_SERVER);
  expect(root.buildActionCommandArgs).toBe(commands.buildActionCommandArgs);
  expect(root.normalizeActionReceipt).toBe(action.normalizeActionReceipt);
  expect(root.normalizeBridgeEvent).toBe(events.normalizeBridgeEvent);
  expect(root.normalizeCodexModelCatalog).toBe(models.normalizeCodexModelCatalog);
  expect(root.normalizeCarrierDiagnostics).toBe(platform.normalizeCarrierDiagnostics);
  expect(root.normalizeCodexThread).toBe(threads.normalizeCodexThread);
});

test("bridge leaves keep the root facade as the upper dependency", () => {
  const rootImport = /(?:from|import\()\s*["']\.\/oplBridge["']/;
  for (const moduleName of leafModules) {
    const source = readFileSync(join(bridgeDirectory, moduleName), "utf8");
    expect(source).not.toMatch(rootImport);
  }

  const facade = readFileSync(join(bridgeDirectory, "oplBridge.ts"), "utf8");
  expect(facade).toContain('export * from "./oplBridge-types-state"');
  expect(facade).toContain('export * from "./oplBridge-types-codex-workspace"');
  expect(facade).toContain('export * from "./oplBridge-types-platform-events"');
});

test("command builders preserve ordering, JSON payloads, and dry-run defaults", () => {
  expect(root.buildActionCommandArgs({ actionId: "package.review", payload: { id: "p1" } })).toEqual([
    "opl", "app", "action", "execute", "--action", "package.review",
    "--payload", '{"id":"p1"}', "--dry-run", "--json"
  ]);
  expect(root.buildActionCommandArgs({ actionId: "package.review", dryRun: false })).toEqual([
    "opl", "app", "action", "execute", "--action", "package.review", "--json"
  ]);
  expect(root.buildDomainDetailViewCommandArgs({ itemId: "item-1", viewId: "detail", ifRevision: 7 })).toEqual([
    "opl", "app", "view", "read", "--item-id", "item-1", "--view-id", "detail",
    "--if-revision", "7", "--json"
  ]);
});

test("representative normalizers retain their public readback behavior", () => {
  const receipt = root.normalizeActionReceipt({
    actionId: "package.review",
    dryRun: false,
    confirmationRequired: false,
    canExecute: true,
    receiptKind: "execute",
    status: "executed",
    command: "opl",
    commandArgs: ["app"],
    exitCode: 0,
    stdout: JSON.stringify({ ok: true }),
    stderr: "",
    timedOut: false
  }, { actionId: "package.review", dryRun: false, payload: { confirmed: true } });
  expect(receipt.status).toBe("executed");
  expect(receipt.stdoutJson).toEqual({ ok: true });

  expect(root.normalizeBridgeEvent({ method: "item/permission/request", params: { turnId: "turn-1" } }, "test")).toMatchObject({
    method: "item/permission/request",
    eventKind: "permission",
    source: "test",
    turnId: "turn-1"
  });

  expect(root.normalizeCodexModelCatalog({ models: [{ id: "gpt", supportedReasoningEfforts: ["low", "high"] }] })).toEqual({
    source: "codex_app_server_model_list",
    models: [{
      id: "gpt",
      model: "gpt",
      displayName: "gpt",
      isDefault: false,
      defaultReasoningEffort: "high",
      supportedReasoningEfforts: ["low", "high"]
    }]
  });

  expect(root.normalizeCodexThread({
    id: "thread-1",
    status: { type: "active", activeFlags: ["turn"] },
    turns: [{ id: "turn-1", status: "inProgress" }],
    source: { type: "codex" }
  })).toMatchObject({
    id: "thread-1",
    state: "running",
    activeTurnId: "turn-1",
    sourceKind: "codex"
  });
});
