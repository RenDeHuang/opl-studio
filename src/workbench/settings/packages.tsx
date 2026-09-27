import { Plus, ArrowDown, ArrowUp, Bot, Boxes, ChevronDown, LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { AgentPackageDependencyRef, AgentPackageLifecycleRef, PackageLifecycleActionRef, WorkbenchModel } from "../workbenchModel";

import type { WorkbenchSettings } from "../settingsModel";

import { actionPayloadComplete, type SettingsActionRequest } from "../settingsActions";

import { SettingsPanelProps } from "./types";
import { trapDialogFocus, statusTone, formatStatus } from "./presentation";
import { StatusValue } from "./primitives";

export function packageRoleLabel(role: string, locale: WorkbenchSettings["locale"]): string {
  const labels: Record<string, [string, string]> = {
    standard_agent: ["领域智能体", "Domain agent"],
    workflow_profile: ["工作流", "Workflow"],
    capability_package: ["能力支持", "Capability support"],
    framework_capability_package: ["能力支持", "Capability support"]
  };
  return labels[role]?.[locale === "zh" ? 0 : 1] ?? (locale === "zh" ? "其他扩展" : "Other extension");
}

export function localizedPackageDescription(
  item: Pick<AgentPackageLifecycleRef, "description" | "descriptionI18n" | "packageRole">,
  locale: WorkbenchSettings["locale"]
): string {
  const ownerLocalized = item.descriptionI18n[locale]?.trim();
  if (ownerLocalized) return ownerLocalized;
  const englishFallback = item.descriptionI18n.en?.trim() || item.description.trim();
  if (englishFallback) return englishFallback;
  const fallback: Record<string, [string, string]> = {
    standard_agent: ["用于专业任务规划、执行与交付的领域智能体。", "A domain agent for planning, execution, and delivery."],
    workflow_profile: ["提供可复用的任务流程与执行步骤。", "Provides reusable task workflows and execution steps."],
    capability_package: ["为智能体提供共享能力与连接支持。", "Provides shared capabilities and connections for agents."],
    framework_capability_package: ["为智能体提供共享能力与连接支持。", "Provides shared capabilities and connections for agents."]
  };
  return fallback[item.packageRole]?.[locale === "zh" ? 0 : 1]
    ?? (locale === "zh" ? "提供可在 One Person Lab 中使用的扩展能力。" : "Adds capabilities to One Person Lab.");
}

export function packageActionLabel(action: PackageLifecycleActionRef, locale: WorkbenchSettings["locale"]): string {
  const labels: Record<PackageLifecycleActionRef["kind"], [string, string]> = {
    install: ["安装", "Install"],
    update: ["更新", "Update"],
    repair: ["修复", "Repair"],
    uninstall: ["卸载", "Uninstall"],
    preferences: ["偏好", "Preferences"],
    other: ["管理", "Manage"]
  };
  return labels[action.kind][locale === "zh" ? 0 : 1];
}

export function booleanStateLabel(value: boolean | null, locale: WorkbenchSettings["locale"]): string {
  if (value === null) return locale === "zh" ? "待确认" : "Not available";
  return value
    ? (locale === "zh" ? "是" : "Yes")
    : (locale === "zh" ? "否" : "No");
}

export function agentPackagePresentationStatus(item: AgentPackageLifecycleRef): string {
  if (item.installed === false) return "not_installed";
  if (item.installed === null) return "checking";
  if (item.activated === false) return "disabled";
  if (item.readiness.callable === false || item.readiness.launchAllowed === false) return "unavailable";
  if (item.activated === true && item.readiness.callable === true && item.readiness.launchAllowed === true) return "ready";
  return "checking";
}

export function agentPackageHasHomeShortcutRoute(item: Pick<AgentPackageLifecycleRef, "homeShortcuts">): boolean {
  return item.homeShortcuts.some((shortcut) => Boolean(shortcut.route));
}

export function componentReadinessStatus(ready: boolean | null | undefined, status?: string): string {
  if (ready === false) return "not_ready";
  if (ready === true) return "ready";
  // An aggregate healthy word is not explicit component readiness.
  return statusTone(status) === "attention" ? status! : "unknown";
}

export function agentAvailabilityDetail(item: AgentPackageLifecycleRef, locale: WorkbenchSettings["locale"]): string {
  const zh = locale === "zh";
  const status = agentPackagePresentationStatus(item);
  if (status === "ready" && item.packageRole === "standard_agent" && !agentPackageHasHomeShortcutRoute(item)) return zh
    ? "智能体已安装、已启用且可调用；首页入口需由智能体更新提供，无需重复修复安装。"
    : "The agent is installed, enabled and callable. A package update must provide its home entry; reinstalling is unnecessary.";
  if (status === "not_installed") return zh ? "安装后可在此管理和使用。" : "Install to manage and use this agent.";
  if (status === "disabled") return zh ? "此智能体已停用。" : "This agent is disabled.";
  if (status === "unavailable") return zh ? "当前调用或启动条件未满足，请查看下方检查详情。" : "Calling or launch requirements are not met. Review the checks below.";
  return zh ? "状态来自本机安装与运行检查。" : "Based on local installation and runtime checks.";
}

export function packageDependencyPresentationStatus(dependency: AgentPackageDependencyRef): string {
  if (dependency.present === false || dependency.callable === false) return "unavailable";
  if (["ready", "available", "callable", "current", "operational"].includes(dependency.status.toLowerCase())) return "ready";
  return "checking";
}

export function isAgentCatalogPackage(item: Pick<AgentPackageLifecycleRef, "packageRole">): boolean {
  return item.packageRole === "standard_agent" || item.packageRole === "workflow_profile";
}

export function isCapabilityCatalogPackage(item: Pick<AgentPackageLifecycleRef, "packageId" | "packageRole">): boolean {
  if (item.packageId === "missing_bridge") return false;
  const role = item.packageRole.trim().toLowerCase();
  return role === "capability_package" || role.endsWith("_capability_package");
}

export function PackageCatalog({
  model,
  settings,
  actionBusyKey,
  onAction,
  manifestInstallAction,
  kind = "agents"
}: {
  kind?: "agents" | "capabilities";
  model: WorkbenchModel;
  settings: WorkbenchSettings;
  actionBusyKey: string | null;
  onAction: (request: SettingsActionRequest) => void;
  manifestInstallAction?: SettingsPanelProps["manifestInstallAction"];
}) {
  const [scope, setScope] = useState<"official" | "all">("official");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [installOpen, setInstallOpen] = useState(false);
  const [customInstall, setCustomInstall] = useState(false);
  const [manifestUrl, setManifestUrl] = useState("");
  const [trustTier, setTrustTier] = useState<"" | "third_party_unverified" | "third_party_verified">("");
  const installDialogRef = useRef<HTMLFormElement | null>(null);
  const installTriggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!installOpen) return;
    const dialog = installDialogRef.current;
    const trigger = installTriggerRef.current;
    dialog?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    return () => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [installOpen]);
  const locale = settings.locale;
  const catalogLabel = kind === "agents" ? "智能体" : "能力模块";
  const packages = model.packageLifecycle.filter((item) => item.packageId !== "missing_bridge" && (kind === "agents" ? isAgentCatalogPackage(item) : isCapabilityCatalogPackage(item)));
  const scoped = packages.filter((item) => scope === "all" || item.official);
  const customCount = packages.filter((item) => !item.official).length;
  const manifestInstallAvailable = Boolean(
    manifestInstallAction
    && manifestInstallAction.dryRunSupported
    && manifestInstallAction.confirmationRequired
    && manifestInstallAction.payloadFields.includes("manifest_url")
    && manifestInstallAction.payloadFields.includes("trust_tier")
  );
  const statusOptions = [...new Set(["not_installed", ...scoped.map(agentPackagePresentationStatus)])].sort();
  const homeShortcutOrder = model.packageLifecycle.flatMap((item) => item.homeShortcuts.map((shortcut) => ({
    packageId: item.packageId,
    ...shortcut
  }))).sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutId.localeCompare(right.shortcutId));
  const normalizedQuery = query.trim().toLowerCase();
  const visible = scoped.filter((item) => {
    if (statusFilter !== "all" && agentPackagePresentationStatus(item) !== statusFilter) return false;
    return !normalizedQuery || item.searchMetadata.query.includes(normalizedQuery);
  });
  const launchableCount = scoped.filter((item) => agentPackagePresentationStatus(item) === "ready").length;
  const groups = [
    { key: "standard_agent", label: locale === "zh" ? `标准${catalogLabel}` : "Standard agents", icon: Bot },
    { key: "workflow_profile", label: locale === "zh" ? "工作流" : "Workflows", icon: Boxes }
  ].map((group) => ({ ...group, items: visible.filter((item) => item.packageRole === group.key) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="agent-catalog" data-testid="opl-settings-agent-catalog">
      <div className="settings-page-summary">
        <span>{locale === "zh" ? `${scoped.length} 个智能体与工作流` : `${scoped.length} agents and workflows`}</span>
        <StatusValue status={`${launchableCount}/${scoped.length}`} locale={locale} />
      </div>
      <div className="agent-catalog-toolbar">
        <label className="settings-search-field">
          <Search aria-hidden="true" size={14} />
          <input aria-label={locale === "zh" ? `搜索${catalogLabel}与工作流` : "Search agents and workflows"} value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={locale === "zh" ? `搜索${catalogLabel}与工作流` : "Search agents and workflows"} />
        </label>
        <div className="segmented-control" role="group" aria-label={locale === "zh" ? "目录范围" : "Catalog scope"}>
          <button type="button" data-active={scope === "official"} aria-pressed={scope === "official"} onClick={() => setScope("official")}>{locale === "zh" ? "官方" : "Official"}</button>
          <button type="button" data-active={scope === "all"} aria-pressed={scope === "all"} onClick={() => setScope("all")}>{locale === "zh" ? "全部" : "All"}</button>
        </div>
        <button
          ref={installTriggerRef}
          className="settings-action-button primary"
          type="button"
          disabled={actionBusyKey !== null}
          title={!manifestInstallAvailable
            ? (locale === "zh" ? "当前 App 尚未提供清单安装通道" : "The App does not currently expose manifest installation")
            : undefined}
          onClick={() => { setCustomInstall(false); setInstallOpen(true); }}
        >
          <Plus aria-hidden="true" size={14} />
          {locale === "zh" ? `添加${catalogLabel}` : "Add agent"}
        </button>
      </div>
      {scope === "all" && customCount === 0 ? (
        <div className="settings-inline-note" role="status">
          {locale === "zh" ? `当前没有自定义${catalogLabel}，因此“全部”与“官方”内容相同。` : "There are no custom modules yet, so All currently matches Official."}
        </div>
      ) : null}
      <div className="agent-catalog-filters">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)} aria-label={locale === "zh" ? "按状态筛选" : "Filter by status"}>
          <option value="all">{locale === "zh" ? "全部状态" : "All statuses"}</option>
          {statusOptions.map((status) => <option key={status} value={status}>{formatStatus(status, locale)}</option>)}
        </select>
        <span>{locale === "zh" ? `${visible.length} 项` : `${visible.length} items`}</span>
      </div>
      {groups.length ? groups.map((group) => (
        <section key={group.key} className="agent-catalog-group">
          <h2><group.icon aria-hidden="true" size={15} />{group.label}<span>{group.items.length}</span></h2>
          <div className="agent-package-list">
            {group.items.map((item) => {
              const executableActions = item.actions.filter((action) => action.status === "available" && actionPayloadComplete(action.payload, action.requiredPayloadFields));
              const preferenceAction = item.actions.find((action) => action.kind === "preferences" && action.status === "available");
              const primaryAction = executableActions.find((action) => action.actionId === item.recommendedActionId)
                ?? (item.installed === false ? executableActions.find((action) => action.kind === "install") : undefined)
                ?? (agentPackagePresentationStatus(item) === "unavailable" ? executableActions.find((action) => action.kind === "repair") : undefined);
              return (
                <details key={item.id} className="agent-package-row" data-testid="opl-settings-agent-row">
                  <summary>
                    <span className="agent-package-copy">
                      <strong>{item.label}</strong>
                      <small>{localizedPackageDescription(item, locale)}</small>
                      <span className="agent-package-meta">
                        {item.version ? <span>{locale === "zh" ? `版本 ${item.version}` : `Version ${item.version}`}</span> : null}
                        {item.automaticUpdate !== null ? <span>{item.automaticUpdate ? (locale === "zh" ? "自动更新" : "Automatic updates") : (locale === "zh" ? "手动更新" : "Manual updates")}</span> : null}
                      </span>
                    </span>
                    <span className="agent-package-summary-actions">
                      <StatusValue status={agentPackagePresentationStatus(item)} locale={locale} />
                      {primaryAction ? (
                        <button
                          className="settings-action-button primary"
                          type="button"
                          disabled={actionBusyKey !== null}
                          onClick={(event) => {
                            event.preventDefault();
                            onAction({
                              key: `${item.packageId}:${primaryAction.actionId}`,
                              actionId: primaryAction.actionId,
                              label: `${packageActionLabel(primaryAction, locale)} ${item.label}`,
                              payload: primaryAction.payload,
                              confirmationRequired: primaryAction.confirmationRequired
                            });
                          }}
                        >
                          {actionBusyKey === `${item.packageId}:${primaryAction.actionId}` ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : null}
                          {packageActionLabel(primaryAction, locale)}
                        </button>
                      ) : null}
                      <ChevronDown className="agent-package-chevron" aria-hidden="true" size={15} />
                    </span>
                  </summary>
                  <div className="agent-package-details">
                    {(agentPackagePresentationStatus(item) !== "ready" || (item.packageRole === "standard_agent" && !agentPackageHasHomeShortcutRoute(item))) ? <p className="settings-inline-note">{agentAvailabilityDetail(item, locale)}</p> : null}
                    {(item.readiness.reason || item.readiness.statusReadError) && agentPackagePresentationStatus(item) !== "ready" ? <details className="settings-secondary-details"><summary>{locale === "zh" ? "检查详情" : "Check details"}</summary><p>{item.readiness.reason}</p><code>{item.readiness.statusReadError}</code></details> : null}
                    <dl className="agent-state-axis-grid">
                      <div><dt>{locale === "zh" ? "目录" : "Directory"}</dt><dd>{locale === "zh" ? "已发现" : "Discovered"}</dd></div>
                      <div><dt>{locale === "zh" ? "安装" : "Installed"}</dt><dd>{booleanStateLabel(item.installed, locale)}</dd></div>
                      <div><dt>{locale === "zh" ? "启用" : "Enabled"}</dt><dd>{booleanStateLabel(item.activated, locale)}</dd></div>
                      <div><dt>{locale === "zh" ? "调用" : "Callable"}</dt><dd>{booleanStateLabel(item.readiness.callable, locale)}</dd></div>
                      <div><dt>{locale === "zh" ? "启动" : "Launchable"}</dt><dd>{booleanStateLabel(item.readiness.launchAllowed, locale)}</dd></div>
                      {item.packageRole === "standard_agent" ? <div><dt>{locale === "zh" ? "首页入口" : "Home entry"}</dt><dd>{booleanStateLabel(agentPackageHasHomeShortcutRoute(item), locale)}</dd></div> : null}
                    </dl>
                    {item.homeShortcuts.length ? (
                      <div className="home-shortcut-preferences">
                        {item.homeShortcuts.map((shortcut) => {
                          const orderIndex = homeShortcutOrder.findIndex((entry) => entry.packageId === item.packageId && entry.shortcutId === shortcut.shortcutId);
                          const previous = orderIndex > 0 ? homeShortcutOrder[orderIndex - 1] : undefined;
                          const next = orderIndex >= 0 && orderIndex < homeShortcutOrder.length - 1 ? homeShortcutOrder[orderIndex + 1] : undefined;
                          const submitPreference = (key: string, visible: boolean, sortOrder: number) => {
                            if (!preferenceAction) return;
                            onAction({
                              key,
                              actionId: preferenceAction.actionId,
                              label: locale === "zh" ? `更新 ${item.label} 的新任务入口` : `Update ${item.label} New Task entry`,
                              payload: {
                                ...preferenceAction.payload,
                                shortcut_id: shortcut.shortcutId,
                                visible,
                                sort_order: sortOrder
                              },
                              confirmationRequired: preferenceAction.confirmationRequired
                            });
                          };
                          const visibilityKey = `home:${item.packageId}:${shortcut.shortcutId}:visibility`;
                          const orderKey = `home:${item.packageId}:${shortcut.shortcutId}:order`;
                          return (
                            <div key={`${item.packageId}:${shortcut.shortcutId}`} className="home-shortcut-preference">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={shortcut.visible}
                                  disabled={!preferenceAction || actionBusyKey !== null}
                                  onChange={(event) => submitPreference(visibilityKey, event.currentTarget.checked, shortcut.sortOrder)}
                                />
                                <span className="home-shortcut-copy">
                                  <strong>{locale === "zh" ? "在新任务中显示" : "Show in New Task"}</strong>
                                  <small>{locale === "zh" ? `开启后，可从新任务页直接选择此${catalogLabel}。` : "Makes this agent available from the New Task screen."}</small>
                                </span>
                              </label>
                              <span className="home-shortcut-order-actions">
                                <button
                                  type="button"
                                  aria-label={locale === "zh" ? "向前移动" : "Move earlier"}
                                  title={locale === "zh" ? "向前移动" : "Move earlier"}
                                  disabled={!preferenceAction || !previous || actionBusyKey !== null}
                                  onClick={() => previous && submitPreference(orderKey, shortcut.visible, previous.sortOrder - 1)}
                                ><ArrowUp aria-hidden="true" size={13} /></button>
                                <button
                                  type="button"
                                  aria-label={locale === "zh" ? "向后移动" : "Move later"}
                                  title={locale === "zh" ? "向后移动" : "Move later"}
                                  disabled={!preferenceAction || !next || actionBusyKey !== null}
                                  onClick={() => next && submitPreference(orderKey, shortcut.visible, next.sortOrder + 1)}
                                ><ArrowDown aria-hidden="true" size={13} /></button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {executableActions.length ? (
                      <div className="agent-package-actions">
                        {executableActions.map((action) => (
                          <button
                            key={`${item.id}:${action.actionId}`}
                            className={`settings-action-button ${action.kind === "uninstall" ? "danger" : ""}`}
                            type="button"
                            disabled={actionBusyKey !== null}
                            onClick={() => onAction({
                              key: `${item.packageId}:${action.actionId}`,
                              actionId: action.actionId,
                              label: `${packageActionLabel(action, locale)} ${item.label}`,
                              payload: action.payload,
                              confirmationRequired: action.confirmationRequired
                            })}
                          >
                            {actionBusyKey === `${item.packageId}:${action.actionId}` ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : null}
                            {packageActionLabel(action, locale)}
                          </button>
                        ))}
                      </div>
                    ) : <small>{locale === "zh" ? "当前没有可直接执行的管理动作" : "No directly executable management action"}</small>}
                    {settings.developerDetails ? (
                      <details className="agent-technical-details">
                        <summary>{locale === "zh" ? "技术详情" : "Technical details"}<ChevronDown aria-hidden="true" size={13} /></summary>
                        <dl>{item.details.map((detail) => <div key={`${item.id}:${detail.label}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
                      </details>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )) : (
          <div className="settings-empty-state"><Search aria-hidden="true" size={18} /><span>{locale === "zh" ? "没有符合条件的项目" : "No matching items"}</span></div>
      )}
      {installOpen ? (
        <div className="settings-action-dialog-backdrop" role="presentation">
          <form
            ref={installDialogRef}
            className="settings-action-dialog settings-add-agent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-add-agent-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setInstallOpen(false);
                return;
              }
              trapDialogFocus(event, installDialogRef.current);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              if (!customInstall || !manifestInstallAction || !manifestUrl.trim() || !trustTier) return;
              onAction({
                key: "agent-package:install-from-manifest",
                actionId: manifestInstallAction.actionId,
                label: locale === "zh" ? `安装自定义${catalogLabel}` : "Install custom agent",
                payload: { manifest_url: manifestUrl.trim(), trust_tier: trustTier },
                confirmationRequired: manifestInstallAction.confirmationRequired,
                dryRunSupported: manifestInstallAction.dryRunSupported
              });
              setInstallOpen(false);
            }}
          >
            <div className="settings-action-dialog-icon"><Plus aria-hidden="true" size={18} /></div>
            <div className="settings-add-agent-fields">
              <h2 id="settings-add-agent-title">{locale === "zh" ? `添加${catalogLabel}` : "Add agent"}</h2>
              {!customInstall ? <>
                <p>{locale === "zh" ? `先从官方目录选择需要的${catalogLabel}；已安装项目可直接在新任务中使用。` : "Choose an agent from the official catalog. Installed agents are available in New Task."}</p>
                <button className="settings-action-button" type="button" onClick={() => { setScope("official"); setStatusFilter("not_installed"); setQuery(""); setInstallOpen(false); }}>{locale === "zh" ? `浏览可安装${catalogLabel}` : "Browse modules to install"}</button>
                <button className="settings-inline-command" type="button" disabled={!manifestInstallAvailable} onClick={() => setCustomInstall(true)}>{locale === "zh" ? "高级：通过清单链接安装" : "Advanced: install from manifest link"}</button>
              </> : <>
              <p>{locale === "zh" ? `从${catalogLabel}作者提供的 OPL Package 清单安装。系统会先检查清单，确认后才会写入。` : "Install from an OPL Package manifest supplied by the module author. The App validates it before asking for confirmation."}</p>
              <label>
                <span>{locale === "zh" ? "清单 URL" : "Manifest URL"}</span>
                <input
                  type="url"
                  value={manifestUrl}
                  onChange={(event) => setManifestUrl(event.currentTarget.value)}
                  placeholder="https://example.com/package-manifest.json"
                  autoFocus
                  required
                />
              </label>
              <label>
                <span>{locale === "zh" ? "信任级别" : "Trust level"}</span>
                <select value={trustTier} onChange={(event) => setTrustTier(event.currentTarget.value as typeof trustTier)} required>
                  <option value="">{locale === "zh" ? "请选择" : "Choose a trust level"}</option>
                  <option value="third_party_unverified">{locale === "zh" ? "未经独立验证" : "Unverified third party"}</option>
                  <option value="third_party_verified">{locale === "zh" ? "已核验来源" : "Verified third party"}</option>
                </select>
              </label>
              <small>{locale === "zh" ? "仅在你已独立核验发布者与来源时选择“已核验”。选择信任级别不会代替系统检查。" : "Choose Verified only after independently verifying the publisher and source. This does not bypass validation."}</small>
              </>}
            </div>
            <div className="settings-action-dialog-actions">
              <button type="button" onClick={() => setInstallOpen(false)}>{locale === "zh" ? "取消" : "Cancel"}</button>
              {customInstall ? <button className="primary" type="submit" disabled={!manifestUrl.trim() || !trustTier || actionBusyKey !== null}>
                {locale === "zh" ? "检查并继续" : "Check and continue"}
              </button> : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
