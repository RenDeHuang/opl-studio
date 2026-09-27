import { PackageCatalog } from "../../settings/packages";

import type { SettingsPageContext } from "../useSettingsPageContext";
export function AgentsSettingsPage({ model, settings, actionBusyKey, onAction, manifestInstallAction }: Pick<SettingsPageContext, "model" | "settings" | "actionBusyKey" | "onAction" | "manifestInstallAction">) {

      return (
        <PackageCatalog model={model} settings={settings} actionBusyKey={actionBusyKey} onAction={onAction} manifestInstallAction={manifestInstallAction} />
      );

}
