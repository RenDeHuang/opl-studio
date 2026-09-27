import type { SettingsPageContext } from "../useSettingsPageContext";
import { SettingRow, SettingsGroup } from "../primitives";
export function SchedulesSettingsPage({ zh, navigate, onOpenSchedules }: Pick<SettingsPageContext, "zh" | "navigate" | "onOpenSchedules">) {
 return <SettingsGroup title={zh ? "后台运行" : "Background execution"}>
 <SettingRow label={zh ? "计划任务" : "Scheduled tasks"} detail={zh ? "在工作台创建、管理任务和查看运行历史。" : "Create and manage tasks and view run history in the workbench."}><button className="settings-action-button" onClick={onOpenSchedules}>{zh ? "打开计划任务" : "Open scheduled tasks"}</button></SettingRow>
 <SettingRow label={zh ? "运行条件" : "Runtime requirements"} detail={zh ? "任务执行时，此设备及后台服务需要保持运行。" : "This device and its background services must be running when a task is due."}><button className="settings-inline-command" onClick={() => navigate("services")}>{zh ? "检查后台服务" : "Check background services"}</button></SettingRow>
 </SettingsGroup>;
}
