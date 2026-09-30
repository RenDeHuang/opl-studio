import type { OplUiContribution, OplUiContributionCommand } from "./contributionProjection";

export const WORKSPACE_VIEW_TYPES = new Set(["list_detail", "timeline", "approval_diff", "activity_log"]);

export function workspaceEntries(entries: readonly OplUiContribution[]): OplUiContribution[] {
  return entries.filter(entry => entry.slot === "settings.section" && entry.scope === "root"
    && entry.contributionKind === "view" && entry.view && WORKSPACE_VIEW_TYPES.has(entry.view.viewType));
}

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export type WorkspaceField = {
  type: "string" | "string_list" | "object" | "boolean" | "integer" | "number";
  required: boolean;
  enum?: string[];
};
export type WorkspaceCommandInput = { fields: Record<string, WorkspaceField>; defaults: Record<string, unknown> };
export type WorkspaceCollection = {
  items: Record<string, unknown>[];
  commandInputs: Record<string, WorkspaceCommandInput>;
  state: "ready" | "unavailable";
  reason: string;
};

export function readWorkspaceCollection(value: unknown): WorkspaceCollection | null {
  const root = record(value);
  if (!root) return null;
  const envelope = record(root.result) ?? root;
  const data = record(envelope.data) ?? (Array.isArray(envelope.items) ? envelope : null);
  if (envelope.state && envelope.state !== "ready") {
    return { items: [], commandInputs: {}, state: "unavailable", reason: String(envelope.reason ?? envelope.state) };
  }
  if (!data || !Array.isArray(data.items)) return null;
  const commandInputs: Record<string, WorkspaceCommandInput> = {};
  const inputs = record(data.command_inputs) ?? record(envelope.command_inputs) ?? {};
  for (const [ref, raw] of Object.entries(inputs)) {
    const spec = record(raw);
    const schema = record(spec?.input_schema);
    if (!schema) continue;
    const fields: Record<string, WorkspaceField> = {};
    for (const [name, field] of Object.entries(schema)) {
      const candidate = record(field);
      if (!candidate || !["string", "string_list", "object", "boolean", "integer", "number"].includes(String(candidate.type))) continue;
      fields[name] = {
        type: candidate.type as WorkspaceField["type"],
        required: candidate.required === true,
        ...(Array.isArray(candidate.enum) ? { enum: candidate.enum.filter((item): item is string => typeof item === "string") } : {})
      };
    }
    commandInputs[ref] = { fields, defaults: record(spec?.defaults) ?? {} };
  }
  return { items: data.items.map(record).filter((item): item is Record<string, unknown> => item !== null), commandInputs, state: "ready", reason: "" };
}

export function itemIdentity(item: Record<string, unknown>, index: number): string {
  return String(item.id ?? item.proposal_id ?? item.item_id ?? item.memory_id ?? item.entity_id ?? item.context_id ?? index);
}

export function itemTitle(item: Record<string, unknown>, index: number, locale: "zh" | "en" = "en"): string {
  const labels = record(item.label_i18n) ?? record(item.title_i18n);
  const localized = labels?.[locale === "zh" ? "zh-CN" : "en-US"];
  if (typeof localized === "string" && localized.trim()) return localized;
  return String(item.title ?? item.display_name ?? item.name ?? item.summary ?? itemIdentity(item, index));
}

export function itemSummary(item: Record<string, unknown>, locale: "zh" | "en"): string {
  const localized = record(item.summary_i18n)?.[locale === "zh" ? "zh-CN" : "en-US"];
  return typeof localized === "string" && localized.trim() ? localized : String(item.summary ?? "");
}

export function declaredItemActions(item: Record<string, unknown>, commands: readonly OplUiContributionCommand[]) {
  const actions = Array.isArray(item.actions) ? item.actions : [];
  return actions.flatMap(value => {
    const action = record(value);
    const command = commands.find(candidate => candidate.actionRef === action?.action_ref);
    const input = record(action?.input);
    const labels = record(action?.label_i18n);
    const actionLabel = Object.fromEntries(Object.entries(labels ?? {}).filter(([, text]) => typeof text === "string")) as Record<string, string>;
    return command && input ? [{ command, input, ...(Object.keys(actionLabel).length ? {label: actionLabel} : {}) }] : [];
  });
}

export function parseWorkspaceInput(fields: Record<string, WorkspaceField>, values: Record<string, string | boolean>): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(fields)) {
    const raw = values[name];
    if (field.type === "string_list" && raw === "") {
      if (field.required) input[name] = [];
      continue;
    }
    if (raw === undefined || raw === "") {
      if (field.required) throw new Error(`${name}: required`);
      continue;
    }
    if (field.type === "boolean") {
      if (typeof raw !== "boolean") throw new Error(`${name}: invalid boolean`);
      input[name] = raw;
    } else if (field.type === "object") {
      const parsed: unknown = JSON.parse(String(raw));
      if (!record(parsed)) throw new Error(`${name}: expected object`);
      input[name] = parsed;
    } else if (field.type === "string_list") {
      input[name] = String(raw).split("\n").map(line => line.trim()).filter(Boolean);
    } else if (field.type === "number" || field.type === "integer") {
      const number = Number(raw);
      if (!Number.isFinite(number) || (field.type === "integer" && !Number.isInteger(number))) throw new Error(`${name}: invalid number`);
      input[name] = number;
    } else {
      const text = String(raw);
      if (field.enum && !field.enum.includes(text)) throw new Error(`${name}: invalid option`);
      if (!text.trim()) throw new Error(`${name}: required`);
      input[name] = text;
    }
  }
  return input;
}
