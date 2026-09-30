import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Boxes, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import type { SlotCore } from "@deepseek-ai/dsh-client-ui-slots";
import type { OplStudioSurface } from "./oplStudioSurface";
import { contributionLabel, type OplContributionSlotOwner, type OplUiContribution, type OplUiContributionCommand } from "./contributionProjection";
import { declaredItemActions, itemIdentity, itemSummary, itemTitle, parseWorkspaceInput, workspaceEntries, type WorkspaceCollection, type WorkspaceCommandInput, type WorkspaceField } from "./workspaceViewModel";
import { ProjectedContribution } from "./contributionComponents";
import "./workspace.css";

function label(name: string, zh: boolean) {
  const labels: Record<string, string> = {
    title: "标题", summary: "摘要", body: "正文", source_refs: "来源证据", evidence_refs: "证据引用", status: "状态", name: "姓名", aliases: "其他称呼",
    context_id: "场景", entity_id: "人物", memory_id: "记忆", proposal_id: "提案", approval_ref: "审核记录", expected_digest: "内容指纹",
    target_path: "目标路径", operation: "操作", frontmatter: "笔记属性", links: "相关链接", tags: "标签", statement: "内容", category: "类别",
    content: "内容", relationship: "关系", preferences: "偏好", instructions: "要求", output_target: "输出目标", decision: "审核决定",
    enabled: "启用", reason: "原因", approval: "审批", receipt: "执行回执", entity_kind: "类型", display_name: "名称",
    created_at: "创建时间", updated_at: "更新时间", external_write_allowed: "允许对外写入", required: "需要确认",
    proposal: "拟执行内容", proposal_digest: "内容指纹", proposal_kind: "提案类型", target: "输出目标", payload: "内容",
    guidance: "场景要求", person_id: "人物", owner_package_id: "来源模块", owner_ref: "来源接口", confidence: "可信度",
    capture_id: "捕获记录", item_kind: "条目类型", scope: "授权范围", expires_at: "到期时间",
    external_approval: "写入授权", binding_id: "知识库绑定", provider_id: "资源提供方", capability_id: "能力",
    external_approval_ref: "写入授权记录", resource_ref: "资源位置", authority_ref: "实际输出位置",
    readback: "写入核验", matches_written_bytes: "内容与写入一致", bytes: "文件大小", digest: "内容指纹",
    memory_kind: "记忆类型", person_ids: "关联人物", context_ids: "适用场景", mode: "工作模式", review: "审核记录", confirmation: "确认写入"
  };
  return zh ? labels[name] ?? name.replaceAll("_", " ") : name.replaceAll("_", " ");
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function initialValues(spec: WorkspaceCommandInput, defaults: Record<string, unknown>) {
  const result: Record<string, string | boolean> = {};
  for (const [name, field] of Object.entries(spec.fields)) {
    const value = defaults[name] ?? spec.defaults[name];
    result[name] = field.type === "boolean" ? value === true : field.type === "string_list" && Array.isArray(value) ? value.join("\n")
      : name === "approval_ref" && value === undefined ? `studio-review:${crypto.randomUUID()}` : valueText(value);
  }
  return result;
}

function CommandForm({ command, spec, defaults, entry, owner, close }: {
  command: OplUiContributionCommand; spec: WorkspaceCommandInput; defaults: Record<string, unknown>;
  entry: OplUiContribution; owner: OplContributionSlotOwner; close(): void;
}) {
  const [values, setValues] = useState(() => initialValues(spec, defaults));
  const [error, setError] = useState("");
  const zh = owner.locale === "zh";
  const title = contributionLabel(command.label, owner.locale, command.commandId);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    try { owner.onAction(entry, command, parseWorkspaceInput(spec.fields, values)); close(); }
    catch (reason) { setError(zh ? `请检查输入：${String(reason)}` : String(reason)); }
  }
  const fieldControl = (name: string, field: WorkspaceField): ReactNode => {
    const common = { id: `workspace-field-${name}`, required: field.required && field.type !== "string_list", disabled: !owner.actionAvailable };
    if (field.type === "boolean") return <input {...common} type="checkbox" required={false} checked={values[name] === true} onChange={e => setValues({...values, [name]: e.target.checked})} />;
    if (field.enum) return <select {...common} value={String(values[name] ?? "")} onChange={e => setValues({...values, [name]: e.target.value})}><option value="">{zh ? "请选择" : "Select"}</option>{field.enum.map(option => <option key={option} value={option}>{displayValue(option, zh)}</option>)}</select>;
    if (field.type === "object" || field.type === "string_list" || ["body", "content", "summary", "statement", "instructions"].includes(name)) return <textarea {...common} rows={field.type === "object" ? 4 : 3} value={String(values[name] ?? "")} onChange={e => setValues({...values, [name]: e.target.value})} />;
    return <input {...common} readOnly={name in defaults && ["proposal_id", "memory_id", "person_id", "expected_digest"].includes(name)} type={field.type === "number" || field.type === "integer" ? "number" : "text"} value={String(values[name] ?? "")} onChange={e => setValues({...values, [name]: e.target.value})} />;
  };
  const technical = (name: string) => !owner.developerDetails && ((name in defaults && technicalFields.has(name)) || name === "approval_ref");
  const field = ([name, spec]: [string, WorkspaceField]) => <label key={name} htmlFor={`workspace-field-${name}`}><span>{label(name, zh)}{spec.required ? " *" : ""}</span>{fieldControl(name, spec)}</label>;
  return <form className="opl-workspace-form" onSubmit={submit} aria-label={title}>
    <header><h3>{title}</h3><button type="button" title={zh ? "取消" : "Cancel"} aria-label={zh ? "取消" : "Cancel"} onClick={close}><X size={16}/></button></header>
    {Object.entries(spec.fields).filter(([name]) => !technical(name)).map(field)}
    {Object.keys(spec.fields).some(technical) ? <details><summary>{zh ? "审核绑定信息" : "Review binding details"}</summary>{Object.entries(spec.fields).filter(([name]) => technical(name)).map(field)}</details> : null}
    {error ? <p role="alert">{error}</p> : null}
    <footer><button type="button" onClick={close}>{zh ? "取消" : "Cancel"}</button><button type="submit" disabled={!owner.actionAvailable}>{title}</button></footer>
  </form>;
}

function displayValue(value: unknown, zh: boolean) {
  const states: Record<string, string> = {pending: "待审核", approved: "已批准", rejected: "已拒绝", applied: "已应用", candidate: "候选", forgotten: "已忘记", staged: "待整理", routed: "已安排", consumed: "已处理", discarded: "已丢弃", confirmed: "确认", create: "新建", update: "更新", true: "是", false: "否"};
  const text = valueText(value);
  return zh ? states[text] ?? text : text;
}

const technicalFields = new Set(["schema_version", "proposal_id", "proposal_digest", "expected_digest", "approval_ref", "external_approval_ref", "digest", "created_at", "updated_at", "owner_ref", "owner_package_id"]);
const detailOrder = ["summary", "status", "payload", "body", "content", "statement", "proposal", "source_refs", "evidence_refs", "external_approval", "receipt", "approval"];
function orderedDetails(value: Record<string, unknown>) {
  const order = (key: string) => detailOrder.indexOf(key) < 0 ? detailOrder.length : detailOrder.indexOf(key);
  return Object.entries(value).filter(([key]) => key !== "schema_version").sort(([a], [b]) => order(a) - order(b));
}

function DetailValue({ value, zh, depth = 0, developer = false }: { value: unknown; zh: boolean; depth?: number; developer?: boolean }): ReactNode {
  if (depth > 8) return <span>...</span>;
  if (Array.isArray(value)) return <ul>{value.map((item, index) => <li key={index}><DetailValue value={item} zh={zh} depth={depth + 1} developer={developer}/></li>)}</ul>;
  if (value && typeof value === "object") {
    const entries = orderedDetails(value as Record<string, unknown>);
    const rows = (items: [string, unknown][]) => <dl>{items.map(([key, item]) => <div key={key}><dt>{label(key, zh)}</dt><dd><DetailValue value={item} zh={zh} depth={depth + 1} developer={developer}/></dd></div>)}</dl>;
    const technical = entries.filter(([key]) => technicalFields.has(key));
    return <>{rows(entries.filter(([key]) => developer || !technicalFields.has(key)))}{!developer && technical.length ? <details><summary>{zh ? "技术详情" : "Technical details"}</summary>{rows(technical)}</details> : null}</>;
  }
  return <span>{displayValue(value, zh) || "-"}</span>;
}

export function WorkspaceCollectionView({ collection, entry, owner }: {
  collection: WorkspaceCollection; entry: OplUiContribution; owner: OplContributionSlotOwner;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<{command: OplUiContributionCommand; defaults: Record<string, unknown>} | null>(null);
  const zh = owner.locale === "zh";
  const items = collection.items.map((item, index) => ({item, id: itemIdentity(item, index), title: itemTitle(item, index, owner.locale), summary: itemSummary(item, owner.locale)}));
  const filtered = items.filter(({item, title, summary}) => `${title} ${summary} ${valueText(item.status)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const current = filtered.find(item => item.id === selected) ?? filtered[0];
  const rowRefs = new Set(collection.items.flatMap(item => declaredItemActions(item, entry.commands).map(action => action.command.actionRef)));
  useEffect(() => { setAction(null); setSelected(null); setQuery(""); }, [entry.contributionKey]);
  if (collection.state !== "ready") return <p role="status" title={collection.reason}>{zh ? "数据暂不可用" : "Data unavailable"}</p>;
  const prepareAction = (command: OplUiContributionCommand, defaults: Record<string, unknown> = {}) => {
    const spec = collection.commandInputs[command.actionRef];
    if (!command.confirmationRequired && spec && Object.entries(spec.fields).every(([name, field]) => !field.required || name in defaults)) owner.onAction(entry, command, defaults);
    else if (spec && Object.keys(spec.fields).length) setAction({command, defaults});
    else if (spec || Object.keys(defaults).length) owner.onAction(entry, command, defaults);
  };
  return <div className="opl-workspace-collection">
    <div className="opl-workspace-toolbar"><label><Search size={15} aria-hidden="true"/><input type="search" aria-label={zh ? "搜索条目" : "Search items"} value={query} onChange={e => setQuery(e.target.value)}/></label><span>{filtered.length}</span></div>
    <div className="opl-workspace-commandbar">{entry.commands.filter(command => collection.commandInputs[command.actionRef] && !rowRefs.has(command.actionRef)).map(command => <button key={command.commandId} type="button" disabled={!owner.actionAvailable} onClick={() => prepareAction(command)}>{contributionLabel(command.label, owner.locale, command.commandId)}</button>)}</div>
    {action && collection.commandInputs[action.command.actionRef] ? <CommandForm key={`${action.command.actionRef}:${valueText(action.defaults)}`} command={action.command} defaults={action.defaults} spec={collection.commandInputs[action.command.actionRef]} entry={entry} owner={owner} close={() => setAction(null)}/> : null}
    {!filtered.length ? <p className="opl-workspace-empty" role="status">{query ? (zh ? "没有匹配条目" : "No matches") : contributionLabel(entry.view?.emptyState ?? {}, owner.locale, zh ? "暂无条目" : "No items")}</p> : <div className="opl-workspace-split">
      <div className="opl-workspace-items" role="list" aria-label={zh ? "条目" : "Items"}>{filtered.map(({item, id, title, summary}) => <div role="listitem" key={id}><button type="button" aria-current={current?.id === id ? "true" : undefined} onClick={() => {setSelected(id); setAction(null);}}><span><strong>{title}</strong>{summary && summary !== title ? <small>{summary}</small> : null}<small>{item.status ? displayValue(item.status, zh) : ""}</small></span><ChevronRight size={14} aria-hidden="true"/></button></div>)}</div>
      {current ? <article className="opl-workspace-detail"><h3>{current.title}</h3>
        {declaredItemActions(current.item, entry.commands).length ? <div className="opl-workspace-commandbar">{declaredItemActions(current.item, entry.commands).map(({command, input, label}) => <button type="button" key={`${command.commandId}:${valueText(input)}`} disabled={!owner.actionAvailable} onClick={() => prepareAction(command, input)}>{contributionLabel(label ?? command.label, owner.locale, command.commandId)}</button>)}</div> : null}
        <DetailValue value={Object.fromEntries(orderedDetails({...current.item, summary: current.summary}).filter(([name]) => !["actions", "title", "display_name", "name", "id", "proposal_digest", "label_i18n", "title_i18n", "summary_i18n"].includes(name)))} zh={zh} developer={owner.developerDetails}/>
      </article> : null}
    </div>}
  </div>;
}

export const name = "opl-workspace-client";

// A reviewed client plugin consumes the existing admitted Package slots. It
// stores only panel selection, never a second Package registry or domain data.
export function installWorkspaceClientPlugin(core: SlotCore, useSurface: () => OplStudioSurface) {
  let open = false;
  const listeners = new Set<() => void>();
  const setOpen = (value: boolean) => { open = value; listeners.forEach(listener => listener()); };
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  function Launcher({ wide }: { wide: boolean }) {
    const surface = useSurface();
    const label = surface.locale === "zh" ? "能力工作台" : "Capability workspace";
    if (!workspaceEntries(surface.uiContributions.entries).length) return null;
    return <button type="button" className="opl-workspace-launcher" title={label} aria-label={label} onClick={() => setOpen(true)}><Boxes size={wide ? 14 : 18} aria-hidden="true"/>{wide ? <span>{label}</span> : null}</button>;
  }
  function Panel() {
    const surface = useSurface();
    const visible = useSyncExternalStore(subscribe, () => open, () => false);
    const [selection, setSelection] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const entries = workspaceEntries(surface.uiContributions.entries);
    const current = entries.find(entry => entry.contributionKey === selection) ?? entries[0];
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      if (!visible) return;
      const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      const keydown = (event: KeyboardEvent) => {
        if (Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some(dialog => dialog !== ref.current && dialog.getClientRects().length)) return;
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
        if (event.key !== "Tab") return;
        const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]') ?? []).filter(item => item.getClientRects().length);
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      };
      document.addEventListener("keydown", keydown);
      return () => {document.removeEventListener("keydown", keydown); if (previous?.isConnected) previous.focus();};
    }, [visible]);
    useEffect(() => {if (visible && !entries.length) setOpen(false);}, [visible, entries.length]);
    if (!visible || !current) return null;
    const zh = surface.locale === "zh";
    return <div className="opl-workspace-backdrop"><div className="opl-workspace-panel" ref={ref} role="dialog" aria-modal="true" aria-label={zh ? "能力工作台" : "Capability workspace"}>
      <header><div><Boxes size={18} aria-hidden="true"/><h2>{zh ? "能力工作台" : "Capability workspace"}</h2></div><span title={surface.workspacePath}>{surface.workspacePath}</span><button type="button" aria-label={zh ? "刷新" : "Refresh"} title={zh ? "刷新" : "Refresh"} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16}/></button><button type="button" aria-label={zh ? "关闭" : "Close"} title={zh ? "关闭" : "Close"} onClick={() => setOpen(false)}><X size={18}/></button></header>
      <div className="opl-workspace-body"><nav aria-label={zh ? "工作台视图" : "Workspace views"}>{entries.map(entry => <button key={entry.contributionKey} type="button" aria-current={current.contributionKey === entry.contributionKey ? "page" : undefined} onClick={() => setSelection(entry.contributionKey)}>{contributionLabel(entry.view?.title ?? {}, surface.locale, entry.contributionId)}<small>{entry.packageId}</small></button>)}</nav>
        <div className="opl-workspace-content"><ProjectedContribution entry={current} owner={{...surface.contributionOwner, refreshRevision: surface.contributionOwner.refreshRevision + revision}}/></div>
      </div>
    </div></div>;
  }
  const disposers = [
    core.register({name: "sidebar.footer.action", id: name, order: 10, registrant: name}, Launcher),
    core.register({name: "shell.overlay", id: name, order: 10, registrant: name}, Panel)
  ];
  return () => {disposers.forEach(dispose => dispose()); setOpen(false); listeners.clear();};
}

export const workspaceClientPlugin = { name, install: installWorkspaceClientPlugin };
