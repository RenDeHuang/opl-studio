import { type ReactNode } from "react";

import type { WorkbenchSettings } from "../settingsModel";

import { statusTone, formatStatus } from "./presentation";

export function SettingRow({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return (
    <div className="settings-row" data-slot="settings.general.item">
      <div className="settings-row-label">
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
      <div className="settings-row-value">{children}</div>
    </div>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group" data-testid="opl-settings-section">
      <h2>{title}</h2>
      <div className="settings-rows">{children}</div>
    </section>
  );
}

export function StatusValue({ status, locale }: { status?: string; locale: WorkbenchSettings["locale"] }) {
  return (
    <span className="settings-status" data-tone={statusTone(status)}>
      <span aria-hidden="true" />
      {formatStatus(status, locale)}
    </span>
  );
}

export function SettingsContributionSection({
  contributions,
  locale,
  destination
}: {
  contributions?: ReactNode;
  locale: WorkbenchSettings["locale"];
  destination: "resources" | "services" | "capabilities";
}) {
  if (!contributions) return null;
  const titles = locale === "zh"
    ? { resources: "消息与连接", services: "已安装服务", capabilities: "模块扩展" }
    : { resources: "Messages & connections", services: "Installed services", capabilities: "Module extensions" };
  return (
    <section className="settings-contribution-section" data-testid="opl-settings-contributions">
      <h2>{titles[destination]}</h2>
      <div className="opl-contribution-slot">{contributions}</div>
    </section>
  );
}

export type OfficialDshCapability = {
  id: string;
  pluginIds: string[];
  label: { zh: string; en: string };
  description: { zh: string; en: string };
  owner: { zh: string; en: string };
  integrated: boolean;
};
