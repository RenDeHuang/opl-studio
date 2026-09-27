import { MemoryManagerPanel } from "../../plugins/WorkbenchServicesPanel";
import { MemoryRefsPanel } from "../../MemoryRefsPanel";

import type { SettingsPageContext } from "../useSettingsPageContext";
export function MemorySettingsPage({ workbenchServices, settings, onAction, actionBusyKey, serviceRevision, zh, readMemory }: Pick<SettingsPageContext, "workbenchServices" | "settings" | "onAction" | "actionBusyKey" | "serviceRevision" | "zh" | "readMemory">) {
return <>
      {workbenchServices ? <MemoryManagerPanel client={workbenchServices} locale={settings.locale} onAction={onAction} busy={actionBusyKey !== null} revision={serviceRevision} /> : <p>{zh ? "记忆服务尚未连接。" : "Memory service is not connected."}</p>}
      {readMemory ? <details className="settings-secondary-details"><summary>{zh ? "记忆来源详情" : "Memory source details"}</summary><MemoryRefsPanel locale={settings.locale} read={readMemory} /></details> : null}
    </>;
}
