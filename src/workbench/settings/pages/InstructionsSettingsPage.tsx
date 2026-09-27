import { SettingRow, SettingsGroup, StatusValue } from "../../settings/primitives";

import { CodexInstructionsEditor } from "../../settings/instructions";

import type { SettingsPageContext } from "../useSettingsPageContext";
export function InstructionsSettingsPage({ projection, settings, readbackStatus, additionalConversationInstructions, actionBusyKey, onRefresh, onAction, onAdditionalConversationInstructionsChange, zh, model, navigate }: Pick<SettingsPageContext, "projection" | "settings" | "readbackStatus" | "additionalConversationInstructions" | "actionBusyKey" | "onRefresh" | "onAction" | "onAdditionalConversationInstructionsChange" | "zh" | "model" | "navigate">) {

      const userAgents = projection?.personalization.userAgents;
      const defaultAgents = projection?.personalization.oplFlowDefaultUserAgents;
      return (
        <>
          <div className="settings-page-summary"><span>{settings.locale === "zh" ? "本机 AGENTS.md 与新会话附加指令" : "Local AGENTS.md and new-conversation instructions"}</span><StatusValue status={readbackStatus} locale={settings.locale} /></div>
          <CodexInstructionsEditor
            userAgents={userAgents}
            defaultAgents={defaultAgents}
            additionalInstructions={additionalConversationInstructions}
            locale={settings.locale}
            busyKey={actionBusyKey}
            onRefresh={onRefresh}
            onAction={onAction}
            onAdditionalInstructionsChange={onAdditionalConversationInstructionsChange}
          />
          <details className="settings-secondary-details"><summary>{zh ? "技术来源" : "Technical sources"}</summary><SettingsGroup title={settings.locale === "zh" ? "当前上下文来源" : "Current context sources"}>
            {model.contextSources.length ? model.contextSources.map((source) => (
              <SettingRow key={source.id} label={source.label} detail={source.summary}><code>{source.ref}</code></SettingRow>
            )) : <SettingRow label={settings.locale === "zh" ? "上下文" : "Context"}><span className="settings-muted">{settings.locale === "zh" ? "当前没有额外上下文来源" : "No additional context sources"}</span></SettingRow>}
          </SettingsGroup></details>
          <button className="settings-inline-command" type="button" onClick={() => navigate("memory")}>{zh ? "查看记忆与纠错" : "Review memory and corrections"}</button>
        </>
      );

}
