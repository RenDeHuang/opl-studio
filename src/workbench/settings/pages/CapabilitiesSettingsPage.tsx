import { PackageCatalog } from "../packages";


import { SettingsContributionSection } from "../../settings/primitives";

import { CapabilityDirectory } from "../../settings/capabilities";

import { ManagedCompanionsGroup } from "../../settings/actions";

import type { SettingsPageContext } from "../useSettingsPageContext";
export function CapabilitiesSettingsPage({ manifestInstallAction, model, capabilityCatalog, capabilityStatus, capabilityError, settings, onRefreshCapabilities, navigate, actionBusyKey, onAction, refreshRevision, contributions }: Pick<SettingsPageContext, "manifestInstallAction" | "model" | "capabilityCatalog" | "capabilityStatus" | "capabilityError" | "settings" | "onRefreshCapabilities" | "navigate" | "actionBusyKey" | "onAction" | "refreshRevision" | "contributions">) {

      return (
        <>
          <details className="settings-secondary-details"><summary>{settings.locale === "zh" ? "安装与管理能力模块" : "Install and manage capability modules"}</summary><PackageCatalog kind="capabilities" model={model} settings={settings} actionBusyKey={actionBusyKey} onAction={onAction} manifestInstallAction={manifestInstallAction} /></details>
          <CapabilityDirectory packageLifecycle={model.packageLifecycle} catalog={capabilityCatalog} status={capabilityStatus} error={capabilityError} locale={settings.locale} showTechnicalDetails={settings.developerDetails} onRefresh={onRefreshCapabilities} onNavigate={navigate} />
          {model.managedCompanions.length ? (
            <ManagedCompanionsGroup
              companions={model.managedCompanions}
              locale={settings.locale}
              busyKey={actionBusyKey}
              onAction={onAction}
            />
          ) : null}
          <SettingsContributionSection key={refreshRevision} contributions={contributions} locale={settings.locale} destination="capabilities" />
        </>
      );

}
