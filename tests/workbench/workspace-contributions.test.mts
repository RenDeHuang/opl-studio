import { expect, test } from "bun:test";
import { declaredItemActions, itemSummary, itemTitle, parseWorkspaceInput, readWorkspaceCollection, workspaceEntries } from "../../src/composition/workspaceViewModel";
import type { OplUiContribution } from "../../src/composition/contributionProjection";

const entry: OplUiContribution = {
  contributionKey: "any-package:items", contributionId: "items", packageId: "any-package",
  slot: "settings.section", contributionKind: "view", trustTier: "declarative", scope: "root", sortOrder: 1,
  view: { viewId: "items", viewType: "approval_diff", title: {"en-US": "Review"}, dataRef: "some.capability.v1#items" },
  commands: [{commandId: "review", label: {"en-US": "Review"}, actionRef: "some.capability.v1#review", confirmationRequired: true}], badges: []
};

test("workspace consumes only admitted root collection views without recognizing package brands", () => {
  expect(workspaceEntries([entry, {...entry, slot: "runtime.detail"}, {...entry, scope: "work_item"}, {...entry, view: {...entry.view!, viewType: "service_status"}}])).toEqual([entry]);
});

test("unavailable owner state cannot become a ready empty inbox", () => {
  expect(readWorkspaceCollection({kind: "data", state: "input_required", reason: "binding missing", data: null})).toEqual({items: [], commandInputs: {}, state: "unavailable", reason: "binding missing"});
  expect(readWorkspaceCollection({unexpected: true})).toBeNull();
});

test("item actions cannot escape the descriptor command allowlist", () => {
  const digest = "sha256:reviewed";
  const actions = declaredItemActions({actions: [
    {action_ref: "some.capability.v1#review", input: {expected_digest: digest}},
    {action_ref: "communications.mail.v1#draft.send", input: {draft_id: "forged"}},
    {action_ref: "some.capability.v1#review", input: "invalid"}
  ]}, entry.commands);
  expect(actions).toEqual([{command: entry.commands[0], input: {expected_digest: digest}}]);
});

test("input projection parses structured fields and rejects malformed or missing review inputs", () => {
  const fields = {expected_digest: {type: "string" as const, required: true}, decision: {type: "string" as const, required: true, enum: ["approve", "reject"]}, source_refs: {type: "string_list" as const, required: true}, settings: {type: "object" as const, required: false}, enabled: {type: "boolean" as const, required: true}};
  expect(parseWorkspaceInput(fields, {expected_digest: "sha256:reviewed", decision: "approve", source_refs: "source:a\nsource:b", settings: '{"mode":"mail"}', enabled: false})).toEqual({expected_digest: "sha256:reviewed", decision: "approve", source_refs: ["source:a", "source:b"], settings: {mode: "mail"}, enabled: false});
  expect(() => parseWorkspaceInput(fields, {decision: "approve"})).toThrow("expected_digest");
  expect(() => parseWorkspaceInput({decision: fields.decision}, {decision: "send"})).toThrow("invalid option");
  expect(() => parseWorkspaceInput({settings: fields.settings}, {settings: "[]"})).toThrow("expected object");
});

test("read models expose forms without admitting unsupported field types", () => {
  const collection = readWorkspaceCollection({kind: "data", state: "ready", data: {items: [{id: "p1", title: "Note"}], command_inputs: {"some.capability.v1#review": {input_schema: {proposal_id: {type: "string", required: true}, unsafe: {type: "code", required: true}}, defaults: {proposal_id: "p1"}}}}});
  expect(collection?.commandInputs["some.capability.v1#review"].fields).toEqual({proposal_id: {type: "string", required: true}});
  expect(collection?.items[0].id).toBe("p1");
});

test("localized row labels and empty optional collections remain usable", () => {
  expect(itemTitle({title: "Research", label_i18n: {"zh-CN": "科研", "en-US": "Research"}}, 0, "zh")).toBe("科研");
  expect(itemSummary({summary: "Research context", summary_i18n: {"zh-CN": "科研论证与证据"}}, "zh")).toBe("科研论证与证据");
  expect(parseWorkspaceInput({links: {type: "string_list", required: true}}, {links: ""})).toEqual({links: []});
  const actions = declaredItemActions({actions: [{action_ref: "some.capability.v1#review", input: {status: "approved"}, label_i18n: {"zh-CN": "确认记忆"}}]}, entry.commands);
  expect(actions[0].label).toEqual({"zh-CN": "确认记忆"});
});
