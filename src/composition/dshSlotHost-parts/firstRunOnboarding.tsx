import { AlertCircle, Check, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SettingsDestinationId } from "../../workbench/SettingsPanel";
import { trapDialogFocus } from "../../workbench/settings/presentation";
import { useStudio } from "./studioContext";
import { settingsSectionId } from "./shellSettingsSlots";

function firstRunItemLabel(itemId: string, fallback: string | undefined, locale: "zh" | "en"): string {
  const labels: Record<string, [string, string]> = {
    workspace_root: ["工作目录", "Working directory"],
    codex: ["本机助手", "Local assistant"],
    codex_cli: ["本机助手", "Local assistant"],
    codex_config: ["模型访问", "Model access"],
    domain_modules: ["专业能力", "Professional capabilities"],
    family_runtime_provider: ["后台任务服务", "Background task service"]
  };
  return labels[itemId]?.[locale === "zh" ? 0 : 1] ?? fallback ?? itemId;
}

export function FirstRunOnboardingSlot({
  complete,
  openSection
}: {
  complete(): void;
  openSection(id: string): void;
}) {
  const studio = useStudio();
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");
  const systemInitialize = studio.initialization?.systemInitialize;
  const setupFlow = systemInitialize?.setupFlow;
  const visible = studio.initializationStatus === "ready" && Boolean(systemInitialize && setupFlow?.isFirstRun && setupFlow.readyToLaunch === false);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!visible) return;
    const appRoot = document.getElementById("root");
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousInert = appRoot?.inert;
    const previousAriaHidden = appRoot?.getAttribute("aria-hidden");
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute("aria-hidden", "true");
    }
    dialogRef.current?.focus();
    return () => {
      if (appRoot) {
        appRoot.inert = previousInert ?? false;
        if (previousAriaHidden === null || previousAriaHidden === undefined) appRoot.removeAttribute("aria-hidden");
        else appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [visible]);
  if (!visible || !systemInitialize) return null;
  const coreItems = systemInitialize.checklist.filter((item) => item.readinessLayer === "core_launch");
  const nextCoreItemId = coreItems.find((item) => item.blocking)?.itemId ?? setupFlow?.phase;
  const destination: SettingsDestinationId = nextCoreItemId === "workspace_root" ? "workspace" : "account";
  const directSetup = nextCoreItemId === "workspace_root" && studio.setupCapabilities.workspaceRoot
    ? { label: studio.locale === "zh" ? "选择工作目录" : "Choose working directory", run: studio.chooseWorkspaceRoot }
    : ["codex", "codex_cli"].includes(nextCoreItemId ?? "") && studio.setupCapabilities.codexInstall
      ? { label: studio.locale === "zh" ? "安装本机助手" : "Install local assistant", run: studio.installCodex }
      : null;
  const runPrimarySetup = async () => {
    if (!directSetup) {
      complete();
      openSection(settingsSectionId(destination));
      return;
    }
    setSetupBusy(true);
    setSetupError("");
    const result = await directSetup.run();
    if (result.status === "error") setSetupError(result.message ?? (studio.locale === "zh" ? "此步骤未完成。" : "This step did not complete."));
    setSetupBusy(false);
  };
  return createPortal(
    <div className="opl-first-run-surface">
      <section ref={dialogRef} tabIndex={-1} onKeyDown={(event) => trapDialogFocus(event, dialogRef.current)} className="opl-first-run" role="dialog" aria-modal="true" aria-labelledby="opl-first-run-title">
        <header>
          <span className="opl-first-run-mark" aria-hidden="true">OPL</span>
          <div>
            <p>{studio.locale === "zh" ? "首次启动" : "First launch"}</p>
            <h1 id="opl-first-run-title">{studio.locale === "zh" ? "完成本机准备" : "Finish local setup"}</h1>
            <span>{studio.locale === "zh" ? "检查只读取本机状态；后台能力不会阻止你进入应用。" : "The check reads local state only; background capabilities do not block entry."}</span>
          </div>
        </header>
        <div className="opl-first-run-checklist">
          {coreItems.map((item) => {
            const ready = !item.blocking;
            return (
              <div key={item.itemId} data-ready={ready}>
                {ready ? <CheckCircle2 aria-hidden="true" size={18} /> : <AlertCircle aria-hidden="true" size={18} />}
                <span><strong>{firstRunItemLabel(item.itemId, item.label, studio.locale)}</strong><small>{ready ? (studio.locale === "zh" ? "已就绪" : "Ready") : item.nextVisibleStep ?? (studio.locale === "zh" ? "需要设置" : "Setup required")}</small></span>
              </div>
            );
          })}
        </div>
        {setupError ? <p className="opl-first-run-error" role="alert">{setupError}</p> : null}
        <footer>
          <button className="settings-icon-button" type="button" aria-label={studio.locale === "zh" ? "重新检查" : "Check again"} title={studio.locale === "zh" ? "重新检查" : "Check again"} disabled={setupBusy} onClick={studio.refreshInitialization}><RefreshCw aria-hidden="true" size={16} /></button>
          <button className="settings-action-button" type="button" disabled={setupBusy} onClick={complete}>{studio.locale === "zh" ? "稍后处理" : "Do this later"}</button>
          <button className="settings-action-button primary" type="button" disabled={setupBusy} onClick={() => { void runPrimarySetup(); }}>
            {setupBusy ? <LoaderCircle className="spin" aria-hidden="true" size={14} /> : null}
            {directSetup?.label ?? (studio.locale === "zh" ? "打开设置" : "Open settings")}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
