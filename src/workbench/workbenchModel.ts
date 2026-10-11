import {
  initialWorkbenchModel,
  type ActionReceiptSummary,
  type ActiveProjectLine,
  type ArtifactPreview,
  type ConfirmationCard,
  type DeliveryPackage,
  type RuntimeMaintenanceActionRef,
  type RuntimeOverviewRef,
  type WorkbenchActionRef,
  type WorkbenchArtifactRef,
  type WorkbenchModel,
  type WorkbenchSettingsProjection,
  type WorkbenchSourceRef,
  type WorkbenchStarter,
  type WorkspaceSession
} from "./workbenchModel-contracts";
import {
  asBoolean,
  asFiniteNumber,
  asOptionalBoolean,
  asRecord,
  asRecordArray,
  asString,
  asStringArray,
  firstString,
  readWorkItemRuntimeProjection
} from "./workbenchModel-primitives";
import {
  actionStatus,
  artifactPreviewFromItem,
  artifactStatus,
  buildResultsFromTasks,
  buildStarterFields,
  buildTaskSourceRefs,
  compactRef,
  compactText,
  ensureDryRunJsonRoute,
  extractActionId,
  firstPreviewAction,
  formatTimestamp,
  isDeliveryAction,
  isReceiptAction,
  moduleKey,
  pickActiveProjectLines,
  pickAppState,
  previewAuthorityBoundary,
  previewField,
  previewKindFromRef,
  pickTaskKey,
  sourceRef,
  starterPreviewAction,
  taskAcceptedShapes,
  uniqueByRef,
  uniqueStrings,
  usageSummary
} from "./workbenchModel-presentation";
import {
  agentPackageSelectionIntent,
  canonicalSummaryRow,
  legacyPackageRowsFromModules,
  packageLifecycleItem,
  packageRowsFromCanonicalProjection
} from "./workbenchModel-package-lifecycle";
import { deriveFeatureRefs } from "./featureModel";
import { emptyUiContributionsProjection, readUiContributionsProjection } from "../composition/contributionProjection";
import { readManagedCompanions } from "./managedCompanions";
import { deriveServiceRecoveryModel } from "./serviceRecoveryModel";
import { rendererModuleIdForPreviewKind } from "../renderers/moduleRegistry";

// Renderer source-contract markers: these public projection fields and type
// names remain owned by this facade while their implementations live in the
// responsibility modules below.
// sessions: []; results: []; deliverables: []; receipts: []; artifactPreviews: [];
// deliveryPackages: []; actionReceipts: []; confirmations: []; questions: [];
// activeProjectLines: []; contextSources: []; contextActions: []; contextTrace: [];
// "collabAgentToolCall" | "subAgentActivity"; type === "collabagenttoolcall";
// type === "subagentactivity"; parentThreadId; sourceKind;
// function packageDependencies(; readManagedUpdateProjection; mergeManagedUpdateProjections
// artifactStatus contract: nonReadyBoundaryStatusPattern; explicitReadyStatusPattern; "app_canonical"
// App source-contract markers: Consume opl app state/action refs; appState.agent_packages;
// canonical_agent_packages; legacy_modules_fallback; missing_bridge; record.available_actions;
// projectedAction.action_id; projectedAction.action_ref; projectedAction.payload;
// projectedAction.required_payload_fields; projectedAction.confirmation_required;
// task_action_receipt_preview; task_export_bundle_preview; workspace_ensure;
// settings_sync_capabilities; preview_route_not_domain_execution;
// deriveThreadDirectory; deriveThreadMessages; collabAgentToolCall; subAgentActivity;
// parentThreadId; sourceKind

export * from "./workbenchModel-contracts";
export * from "./workbenchModel-primitives";
export * from "./workbenchModel-threads";
export * from "./workbenchModel-managed-updates";
export { agentPackageSelectionIntent } from "./workbenchModel-package-lifecycle";
export { deriveThreadDirectory, deriveThreadMessages } from "./workbenchModel-threads";

export function deriveWorkbenchModelFromState(state: unknown, fallback: WorkbenchModel = initialWorkbenchModel): WorkbenchModel {
  const appState = pickAppState(state);
  if (!appState) return fallback;

  const core = asRecord(appState.core);
  const coreCodex = asRecord(core?.codex);
  const runtimeSource = asRecord(appState.runtime_source);
  const operator = asRecord(appState.operator);
  const workbench = asRecord(operator?.workbench);
  const modules = asRecord(appState.modules);
  const provider = asRecord(appState.provider);
  const temporal = asRecord(provider?.temporal);
  const temporalDetails = asRecord(temporal?.details);
  const temporalWorkerReadiness = asRecord(temporalDetails?.worker_readiness);
  const temporalServiceLifecycle = asRecord(temporalWorkerReadiness?.temporal_service_lifecycle);
  const temporalSupervisor = asRecord(temporalServiceLifecycle?.supervisor);
  const temporalScheduler = asRecord(temporalDetails?.scheduler);
  const temporalManagement = asRecord(temporal?.management);
  const runtimeSourceCarriers = asRecord(appState.runtime_source_carriers);
  const runtimeCarrierSummary = asRecord(runtimeSourceCarriers?.summary);
  const actions = asRecordArray(appState.actions);
  const actionRecords = new Map(actions.flatMap((action): [string, Record<string, unknown>][] => {
    const actionId = asString(action.action_id);
    return actionId ? [[actionId, action]] : [];
  }));
  const projectedMaintenanceAction = (actionId: string | null | undefined): RuntimeMaintenanceActionRef | undefined => {
    if (!actionId) return undefined;
    const action = actionRecords.get(actionId);
    if (!action) return undefined;
    return {
      actionId,
      label: asString(action.label) ?? actionId,
      payload: {},
      requiredPayloadFields: asStringArray(action.payload_fields),
      confirmationRequired: asBoolean(action.confirmation_required),
      dryRunSupported: asBoolean(action.dry_run_supported),
      mutates: asString(action.mutates) ?? "unknown",
      ...(asString(action.danger_level) ? { dangerLevel: asString(action.danger_level) as string } : {})
    };
  };
  const settingsControlCenter = asRecord(appState.settings_control_center);
  const appSettingsReadModel = asRecord(settingsControlCenter?.app_settings_read_model);
  const gatewayAccountProjection = asRecord(appSettingsReadModel?.opl_gateway_account);
  const gatewayAccountRecord = asRecord(gatewayAccountProjection?.account);
  const gatewayAccountBalance = asRecord(gatewayAccountRecord?.balance);
  const gatewayUsage = asRecord(gatewayAccountProjection?.usage);
  const gatewayManagedKey = asRecord(gatewayAccountProjection?.managed_key);
  const gatewayInstallation = asRecord(gatewayAccountProjection?.installation);
  const gatewayFreshness = asRecord(gatewayAccountProjection?.freshness);
  const gatewayAccountStatus = asString(gatewayAccountProjection?.status);
  const gatewayConnectionMode = gatewayAccountProjection?.surface_kind === "opl_gateway_account_read_model.v1"
    && ["none", "manual_key", "account"].includes(asString(gatewayAccountProjection.connection_mode) ?? "")
    ? asString(gatewayAccountProjection.connection_mode) as WorkbenchSettingsProjection["gatewayConnectionMode"]
    : "none";
  const gatewayAccountDisplayName = asString(gatewayAccountRecord?.display_name);
  const gatewayBalanceAmount = asFiniteNumber(gatewayAccountBalance?.amount);
  const gatewayBalanceCurrency = asString(gatewayAccountBalance?.currency);
  const gatewayTodayTokens = asFiniteNumber(gatewayUsage?.today_tokens);
  const gatewayTotalTokens = asFiniteNumber(gatewayUsage?.total_tokens);
  const gatewayTodayCost = asFiniteNumber(gatewayUsage?.today_actual_cost);
  const gatewayTotalCost = asFiniteNumber(gatewayUsage?.total_actual_cost);
  const gatewayUsageCurrency = asString(gatewayUsage?.currency);
  const gatewayUsageTimezone = asString(gatewayUsage?.day_timezone);
  const gatewayManagedKeyName = asString(gatewayManagedKey?.name);
  const gatewayManagedKeyStatus = asString(gatewayManagedKey?.status);
  const gatewayDeviceLabel = asString(gatewayInstallation?.device_label);
  const gatewayDeviceShortId = asString(gatewayInstallation?.short_id);
  const gatewayObservedAt = asString(gatewayFreshness?.observed_at);
  const gatewayLastErrorCode = asString(gatewayFreshness?.last_error_code);
  const gatewayAvailableGroups = asRecordArray(gatewayAccountProjection?.available_groups).flatMap((group) => {
    const id = asString(group.group_id);
    return id ? [{ id, label: asString(group.label) ?? id }] : [];
  });
  const gatewayAccount = gatewayAccountProjection?.surface_kind === "opl_gateway_account_read_model.v1"
    && gatewayAccountProjection.connection_mode === "account"
    && asBoolean(gatewayAccountProjection.account_card_visible)
    && gatewayAccountStatus !== null
    && ["connected", "setup_required", "reauth_required", "attention_needed", "disconnect_pending"].includes(gatewayAccountStatus)
    && gatewayAccountDisplayName !== null
    ? {
        displayName: gatewayAccountDisplayName,
        status: gatewayAccountStatus,
        ...(asString(gatewayAccountRecord?.email) ? { email: asString(gatewayAccountRecord?.email) as string } : {}),
        ...(asString(gatewayAccountRecord?.status) ? { accountStatus: asString(gatewayAccountRecord?.status) as string } : {}),
        ...(gatewayBalanceAmount !== null && gatewayBalanceCurrency
          ? { balance: { amount: gatewayBalanceAmount, currency: gatewayBalanceCurrency } }
          : {}),
        ...(gatewayTodayTokens !== null || gatewayTotalTokens !== null || gatewayTodayCost !== null || gatewayTotalCost !== null
          ? {
              usage: {
                ...(gatewayTodayTokens !== null ? { todayTokens: gatewayTodayTokens } : {}),
                ...(gatewayTotalTokens !== null ? { totalTokens: gatewayTotalTokens } : {}),
                ...(gatewayTodayCost !== null ? { todayCost: gatewayTodayCost } : {}),
                ...(gatewayTotalCost !== null ? { totalCost: gatewayTotalCost } : {}),
                ...(gatewayUsageCurrency ? { currency: gatewayUsageCurrency } : {}),
                ...(gatewayUsageTimezone ? { timezone: gatewayUsageTimezone } : {})
              }
            }
          : {}),
        ...(gatewayManagedKeyName || gatewayManagedKeyStatus
          ? {
              managedKey: {
                ...(gatewayManagedKeyName ? { name: gatewayManagedKeyName } : {}),
                ...(gatewayManagedKeyStatus ? { status: gatewayManagedKeyStatus } : {})
              }
            }
          : {}),
        ...(gatewayAvailableGroups.length ? { availableGroups: gatewayAvailableGroups } : {}),
        ...(gatewayDeviceLabel || gatewayDeviceShortId
          ? {
              installation: {
                ...(gatewayDeviceLabel ? { deviceLabel: gatewayDeviceLabel } : {}),
                ...(gatewayDeviceShortId ? { shortId: gatewayDeviceShortId } : {})
              }
            }
          : {}),
        ...(gatewayObservedAt || gatewayFreshness
          ? {
              freshness: {
                ...(gatewayObservedAt ? { observedAt: gatewayObservedAt } : {}),
                stale: asBoolean(gatewayFreshness?.stale),
                ...(gatewayLastErrorCode ? { lastErrorCode: gatewayLastErrorCode } : {})
              }
            }
          : {}),
        sourceRef: "app_state.settings_control_center.app_settings_read_model.opl_gateway_account.account.display_name"
      }
    : undefined;
  const codexModelPolicy = asRecord(appSettingsReadModel?.codex_model_policy);
  const localEnvironment = asRecord(appSettingsReadModel?.local_environment);
  const workspaceServices = asRecord(appSettingsReadModel?.workspace_services);
  const workspaceRoot = asRecord(workspaceServices?.workspace_root);
  const personalizationRefs = asRecord(workspaceServices?.personalization_refs);
  const connectionsReadModel = asRecord(appSettingsReadModel?.connections);
  const dockerWebui = asRecord(appSettingsReadModel?.docker_webui);
  const dockerRuntimeProxy = asRecord(dockerWebui?.runtime_proxy);
  const dockerFailureRecovery = asRecord(dockerWebui?.failure_recovery);
  const storageLifecycle = asRecord(appSettingsReadModel?.storage_lifecycle);
  const agentPackageStore = asRecord(storageLifecycle?.agent_package_store);
  const webuiDataVolume = asRecord(storageLifecycle?.webui_data_volume);
  const agentPackageInventoryAction = projectedMaintenanceAction(
    asString(agentPackageStore?.inventory_action_id)
      ?? asString(asRecord(agentPackageStore?.projected_action)?.action_id)
  );
  const webuiInventoryAction = projectedMaintenanceAction(
    asString(webuiDataVolume?.inventory_action_id)
      ?? asString(asRecord(webuiDataVolume?.projected_action)?.action_id)
  );
  const codexPersonalization = asRecord(appState.codex_personalization);
  const userAgents = asRecord(codexPersonalization?.user_agents);
  const oplFlowDefaultUserAgents = asRecord(codexPersonalization?.opl_flow_default_user_agents);
  const statusSummary = asRecord(settingsControlCenter?.status_summary);
  const dockerActions = asRecordArray(dockerWebui?.ordinary_next_actions).flatMap((projected): RuntimeMaintenanceActionRef[] => {
    const actionId = asString(projected.action_id);
    if (!actionId) return [];
    const action = actionRecords.get(actionId);
    const dangerLevel = asString(projected.danger_level) ?? asString(action?.danger_level);
    return [{
      actionId,
      label: asString(projected.label) ?? asString(action?.label) ?? actionId,
      ...(asString(projected.state) ? { state: asString(projected.state) as string } : {}),
      payload: {},
      requiredPayloadFields: asStringArray(projected.payload_fields).length
        ? asStringArray(projected.payload_fields)
        : asStringArray(action?.payload_fields),
      confirmationRequired: asOptionalBoolean(projected.confirmation_required)
        ?? asOptionalBoolean(action?.confirmation_required)
        ?? false,
      dryRunSupported: Boolean(asString(projected.dry_run_route)) || asBoolean(action?.dry_run_supported),
      mutates: asString(action?.mutates) ?? "unknown",
      ...(dangerLevel ? { dangerLevel } : {})
    }];
  });
  const externalConnections = asRecordArray(connectionsReadModel?.connections)
    .filter((connection) => {
      const type = asString(connection.connection_type);
      const id = asString(connection.connection_id);
      return type !== "opl_gateway_account" && id !== "opl-gateway-account";
    })
    .map((connection, index) => ({
      id: asString(connection.connection_id) ?? `external-connection-${index}`,
      name: asString(connection.name) ?? asString(connection.connection_id) ?? `Connection ${index + 1}`,
      ...(asString(connection.connection_type) ? { type: asString(connection.connection_type) as string } : {}),
      ...(asString(connection.endpoint) ? { endpoint: asString(connection.endpoint) as string } : {}),
      ...(asString(connection.status) ? { status: asString(connection.status) as string } : {}),
      ...(asString(connection.last_tested_at) ? { lastTestedAt: asString(connection.last_tested_at) as string } : {})
    }));
  const settingsProjection: WorkbenchSettingsProjection | undefined = appSettingsReadModel || coreCodex
    ? {
        sourceRef: "app_state.settings_control_center.app_settings_read_model",
        gatewayConnectionMode,
        codex: {
          installed: asOptionalBoolean(coreCodex?.installed),
          ...(firstString(coreCodex, ["parsed_version", "version"]) ? { version: firstString(coreCodex, ["parsed_version", "version"]) as string } : {}),
          ...(asString(coreCodex?.version_status) ? { versionStatus: asString(coreCodex?.version_status) as string } : {}),
          ...(asString(coreCodex?.binary_path) ? { binaryPath: asString(coreCodex?.binary_path) as string } : {}),
          ...(firstString(codexModelPolicy, ["model"]) ?? firstString(coreCodex, ["default_model", "model"])
            ? { model: (firstString(codexModelPolicy, ["model"]) ?? firstString(coreCodex, ["default_model", "model"])) as string }
            : {}),
          ...(firstString(codexModelPolicy, ["reasoning_effort"]) ?? firstString(coreCodex, ["default_reasoning_effort"])
            ? { reasoningEffort: (firstString(codexModelPolicy, ["reasoning_effort"]) ?? firstString(coreCodex, ["default_reasoning_effort"])) as string }
            : {}),
          ...(firstString(codexModelPolicy, ["provider_name"]) ?? firstString(coreCodex, ["provider_name"])
            ? { providerName: (firstString(codexModelPolicy, ["provider_name"]) ?? firstString(coreCodex, ["provider_name"])) as string }
            : {}),
          ...(firstString(codexModelPolicy, ["provider_base_url"]) ?? firstString(coreCodex, ["provider_base_url"])
            ? { providerBaseUrl: (firstString(codexModelPolicy, ["provider_base_url"]) ?? firstString(coreCodex, ["provider_base_url"])) as string }
            : {}),
          ...(firstString(codexModelPolicy, ["model_access_source"]) ?? firstString(coreCodex, ["model_access_source"])
            ? { modelAccessSource: (firstString(codexModelPolicy, ["model_access_source"]) ?? firstString(coreCodex, ["model_access_source"])) as string }
            : {}),
          ...(firstString(codexModelPolicy, ["access_status", "model_access_status"]) ?? firstString(coreCodex, ["model_access_status"])
            ? { accessStatus: (firstString(codexModelPolicy, ["access_status", "model_access_status"]) ?? firstString(coreCodex, ["model_access_status"])) as string }
            : {}),
          ...(firstString(codexModelPolicy, ["config_path"]) ?? firstString(coreCodex, ["config_path"])
            ? { configPath: (firstString(codexModelPolicy, ["config_path"]) ?? firstString(coreCodex, ["config_path"])) as string }
            : {}),
          apiKeyPresent: asOptionalBoolean(codexModelPolicy?.api_key_present ?? coreCodex?.api_key_present),
          updateAvailable: asOptionalBoolean(coreCodex?.update_available)
        },
        statusSummary: {
          ...(asString(statusSummary?.runtime_source_carrier_health) ? { runtimeSourceHealth: asString(statusSummary?.runtime_source_carrier_health) as string } : {}),
          ...(asString(statusSummary?.agent_package_functional_health) ? { agentPackageHealth: asString(statusSummary?.agent_package_functional_health) as string } : {}),
          ...(firstString(statusSummary, ["temporal_provider"]) ?? firstString(localEnvironment, ["temporal_provider"])
            ? { temporalProvider: (firstString(statusSummary, ["temporal_provider"]) ?? firstString(localEnvironment, ["temporal_provider"])) as string }
            : {}),
          ...(firstString(statusSummary, ["release_channel"]) ?? firstString(localEnvironment, ["release_channel"])
            ? { releaseChannel: (firstString(statusSummary, ["release_channel"]) ?? firstString(localEnvironment, ["release_channel"])) as string }
            : {}),
          ...(asFiniteNumber(statusSummary?.issue_count) !== null ? { issueCount: asFiniteNumber(statusSummary?.issue_count) as number } : {})
        },
        localEnvironment: {
          ...(asString(localEnvironment?.state_dir) ? { stateDir: asString(localEnvironment?.state_dir) as string } : {}),
          ...(asString(localEnvironment?.runtime_sources_root) ? { runtimeSourcesRoot: asString(localEnvironment?.runtime_sources_root) as string } : {}),
          ...(asString(localEnvironment?.logs_dir) ? { logsDir: asString(localEnvironment?.logs_dir) as string } : {}),
          ...(asString(localEnvironment?.release_channel) ? { releaseChannel: asString(localEnvironment?.release_channel) as string } : {}),
          ...(asString(localEnvironment?.temporal_provider) ? { temporalProvider: asString(localEnvironment?.temporal_provider) as string } : {})
        },
        workspace: {
          ...(asString(workspaceRoot?.selected_path) ? { selectedPath: asString(workspaceRoot?.selected_path) as string } : {}),
          exists: asOptionalBoolean(workspaceRoot?.exists),
          writable: asOptionalBoolean(workspaceRoot?.writable),
          ...(asString(workspaceRoot?.health_status) ? { healthStatus: asString(workspaceRoot?.health_status) as string } : {}),
          personalizationSourceCount: asStringArray(personalizationRefs?.source_refs).length
        },
        externalConnections,
        dockerWebui: {
          ...(asString(dockerWebui?.ordinary_status) ? { status: asString(dockerWebui?.ordinary_status) as string } : {}),
          ...(asString(dockerRuntimeProxy?.status) ? { runtimeStatus: asString(dockerRuntimeProxy?.status) as string } : {}),
          ...(asString(dockerFailureRecovery?.status) ? { recoveryStatus: asString(dockerFailureRecovery?.status) as string } : {}),
          actions: dockerActions
        },
        personalization: {
          ...(asString(userAgents?.status) ? {
            userAgents: {
              status: asString(userAgents?.status) as string,
              ...(asString(userAgents?.path) ? { path: asString(userAgents?.path) as string } : {}),
              ...(typeof userAgents?.content === "string" ? { content: userAgents.content } : {}),
              ...(asString(userAgents?.sha256) ? { sha256: asString(userAgents?.sha256) as string } : {}),
              ...(asFiniteNumber(userAgents?.size_bytes) !== null ? { sizeBytes: asFiniteNumber(userAgents?.size_bytes) as number } : {}),
              ...(asFiniteNumber(userAgents?.max_editable_bytes) !== null ? { maxEditableBytes: asFiniteNumber(userAgents?.max_editable_bytes) as number } : {}),
              ...(asString(userAgents?.source) ? { source: asString(userAgents?.source) as string } : {})
            }
          } : {}),
          ...(asString(oplFlowDefaultUserAgents?.status) ? {
            oplFlowDefaultUserAgents: {
              status: asString(oplFlowDefaultUserAgents?.status) as string,
              ...(typeof oplFlowDefaultUserAgents?.content === "string" ? { content: oplFlowDefaultUserAgents.content } : {}),
              ...(asString(oplFlowDefaultUserAgents?.sha256) ? { sha256: asString(oplFlowDefaultUserAgents?.sha256) as string } : {}),
              ...(asString(oplFlowDefaultUserAgents?.source_path) ? { sourcePath: asString(oplFlowDefaultUserAgents?.source_path) as string } : {}),
              ...(asString(oplFlowDefaultUserAgents?.package_version) ? { packageVersion: asString(oplFlowDefaultUserAgents?.package_version) as string } : {}),
              ...(asString(oplFlowDefaultUserAgents?.source) ? { source: asString(oplFlowDefaultUserAgents?.source) as string } : {}),
              ...(asString(oplFlowDefaultUserAgents?.reason) ? { reason: asString(oplFlowDefaultUserAgents?.reason) as string } : {})
            }
          } : {})
        },
        storage: {
          agentPackageStore: {
            ...(asString(agentPackageStore?.status) ? { status: asString(agentPackageStore?.status) as string } : {}),
            ...(asFiniteNumber(agentPackageStore?.bytes) !== null ? { bytes: asFiniteNumber(agentPackageStore?.bytes) as number } : {}),
            ...(asFiniteNumber(agentPackageStore?.reclaimable_bytes) !== null ? { reclaimableBytes: asFiniteNumber(agentPackageStore?.reclaimable_bytes) as number } : {}),
            ...(asString(agentPackageStore?.reason_code) ? { reasonCode: asString(agentPackageStore?.reason_code) as string } : {}),
            ...(asString(agentPackageStore?.observed_at) ? { observedAt: asString(agentPackageStore?.observed_at) as string } : {}),
            stale: asOptionalBoolean(agentPackageStore?.stale),
            ...(asString(agentPackageStore?.owner_route) ? { ownerRoute: asString(agentPackageStore?.owner_route) as string } : {}),
            ...(agentPackageInventoryAction ? { inventoryAction: agentPackageInventoryAction } : {}),
            ...(asRecord(agentPackageStore?.projected_action) ? {
              projectedAction: {
                ...(asString(asRecord(agentPackageStore?.projected_action)?.kind) ? { kind: asString(asRecord(agentPackageStore?.projected_action)?.kind) as string } : {}),
                ...(asString(asRecord(agentPackageStore?.projected_action)?.status) ? { status: asString(asRecord(agentPackageStore?.projected_action)?.status) as string } : {}),
                ...(asString(asRecord(agentPackageStore?.projected_action)?.route) ? { route: asString(asRecord(agentPackageStore?.projected_action)?.route) as string } : {}),
                ...(asString(asRecord(agentPackageStore?.projected_action)?.action_id) ? { actionId: asString(asRecord(agentPackageStore?.projected_action)?.action_id) as string } : {}),
                dryRunRequired: asOptionalBoolean(asRecord(agentPackageStore?.projected_action)?.dry_run_required)
              }
            } : {})
          },
          webuiDataVolume: {
            ...(asString(webuiDataVolume?.status) ? { status: asString(webuiDataVolume?.status) as string } : {}),
            ...(asFiniteNumber(webuiDataVolume?.bytes) !== null ? { bytes: asFiniteNumber(webuiDataVolume?.bytes) as number } : {}),
            ...(asFiniteNumber(webuiDataVolume?.reclaimable_bytes) !== null ? { reclaimableBytes: asFiniteNumber(webuiDataVolume?.reclaimable_bytes) as number } : {}),
            ...(asString(webuiDataVolume?.reason_code) ? { reasonCode: asString(webuiDataVolume?.reason_code) as string } : {}),
            ...(asString(webuiDataVolume?.observed_at) ? { observedAt: asString(webuiDataVolume?.observed_at) as string } : {}),
            stale: asOptionalBoolean(webuiDataVolume?.stale),
            ...(asString(webuiDataVolume?.owner_route) ? { ownerRoute: asString(webuiDataVolume?.owner_route) as string } : {}),
            ...(webuiInventoryAction ? { inventoryAction: webuiInventoryAction } : {}),
            ...(asRecord(webuiDataVolume?.projected_action) ? {
              projectedAction: {
                ...(asString(asRecord(webuiDataVolume?.projected_action)?.kind) ? { kind: asString(asRecord(webuiDataVolume?.projected_action)?.kind) as string } : {}),
                ...(asString(asRecord(webuiDataVolume?.projected_action)?.status) ? { status: asString(asRecord(webuiDataVolume?.projected_action)?.status) as string } : {}),
                ...(asString(asRecord(webuiDataVolume?.projected_action)?.route) ? { route: asString(asRecord(webuiDataVolume?.projected_action)?.route) as string } : {}),
                ...(asString(asRecord(webuiDataVolume?.projected_action)?.action_id) ? { actionId: asString(asRecord(webuiDataVolume?.projected_action)?.action_id) as string } : {}),
                dryRunRequired: asOptionalBoolean(asRecord(webuiDataVolume?.projected_action)?.dry_run_required)
              }
            } : {})
          }
        }
      }
    : undefined;
  const moduleItems = asRecordArray(modules?.items);
  const taskDrilldowns = asRecordArray(workbench?.task_drilldowns);
  const workItemRuntime = readWorkItemRuntimeProjection(workbench?.work_item_projection_v2);
  const settingsTaskEntries = asRecordArray(settingsControlCenter?.task_entries);
  const settingsSections = asRecordArray(settingsControlCenter?.action_sections);
  const safeActionRoutes = asRecordArray(workbench?.safe_action_routes);
  const currentOwnerDelta = asRecord(workbench?.current_owner_delta);
  const currentOwnerDeltaNextAction = asRecord(workbench?.current_owner_delta_next_action);
  const meta = asRecord(appState.meta);

  const runtimeSources = [
    sourceRef("state-fast", "Fast state", runtimeSource?.normal_gui_state_surface, "Normal GUI state read."),
    sourceRef("state-full", "Full state", runtimeSource?.full_gui_state_surface, "Explicit detailed state read."),
    sourceRef("action-boundary", "Action boundary", runtimeSource?.action_boundary_surface, "App action execution surface."),
    sourceRef("full-drilldown", "Full drilldown", runtimeSource?.full_drilldown_exception_surface, "Runtime drilldown exception.")
  ].filter((item): item is WorkbenchSourceRef => Boolean(item));

  const workbenchSources = buildTaskSourceRefs(taskDrilldowns);

  const settingsSources = settingsSections.map((item, index) => sourceRef(
    `settings-section-${asString(item.section_id) ?? index}`,
    asString(item.label) ?? `Settings section ${index + 1}`,
    item.source_ref,
    compactText(item.description, "Settings control center section.")
  )).filter((item): item is WorkbenchSourceRef => Boolean(item));

  const moduleSources = moduleItems.slice(0, 5).map((item, index) => sourceRef(
    `module-${asString(item?.module_id) ?? index}`,
    asString(item?.label) ?? asString(item?.module_id) ?? "Module",
    asString(item?.checkout_path) ?? asString(item?.repo_url),
    compactText(item?.description, asString(item?.health_status) ? `Module health: ${item?.health_status}` : "Managed OPL module ref.")
  )).filter((item): item is WorkbenchSourceRef => Boolean(item));

  const contextSources = uniqueByRef([...runtimeSources, ...settingsSources, ...moduleSources, ...workbenchSources]);

  const baseActions = actions.map((item): WorkbenchActionRef | null => {
    const id = asString(item?.action_id);
    if (!id) return null;
    return {
      id,
      label: asString(item?.label) ?? id,
      route: asString(item?.route) ?? `opl app action execute --action ${id}`,
      payloadFields: asStringArray(item?.payload_fields),
      mutates: asString(item?.mutates) ?? "unknown",
      dryRunSupported: asBoolean(item?.dry_run_supported),
      confirmationRequired: asBoolean(item?.confirmation_required),
      dangerLevel: asString(item?.danger_level) ?? undefined,
      owner: asString(item?.owner) ?? undefined,
      delegatedSurface: asString(item?.delegated_surface) ?? undefined,
      canSubmitToSafeActionShell: asBoolean(item?.can_submit_to_safe_action_shell),
      routeRequiresPayload: asBoolean(item?.route_requires_domain_or_app_payload)
    };
  }).filter((item): item is WorkbenchActionRef => Boolean(item));

  const actionOverrides = new Map<string, Partial<WorkbenchActionRef>>();
  for (const entry of settingsTaskEntries) {
    const id = asString(entry.action_id) ?? asString(entry.task_id);
    if (!id) continue;
    actionOverrides.set(id, {
      label: asString(entry.label) ?? id,
      route: asString(entry.route) ?? `opl app action execute --action ${id}`,
      payloadFields: asStringArray(entry.payload_fields),
      mutates: asString(entry.mutates) ?? "unknown",
      dryRunSupported: asBoolean(entry.dry_run_supported),
      confirmationRequired: asBoolean(entry.confirmation_required),
      dangerLevel: asString(entry.danger_level) ?? undefined,
      delegatedSurface: asString(entry.delegated_surface) ?? asString(entry.dry_run_route) ?? undefined,
      routeRequiresPayload: asBoolean(entry.payload_required)
    });
  }
  for (const route of safeActionRoutes) {
    const id = asString(route.action_id);
    if (!id) continue;
    const existing = actionOverrides.get(id) ?? {};
    actionOverrides.set(id, {
      ...existing,
      label: asString(route.label) ?? existing.label ?? id,
      route: asString(route.route) ?? existing.route ?? `opl app action execute --action ${id}`,
      owner: asString(route.owner) ?? existing.owner,
      dryRunSupported: true
    });
  }

  const actionMap = new Map<string, WorkbenchActionRef>();
  for (const action of baseActions) {
    const override = actionOverrides.get(action.id);
    actionMap.set(action.id, {
      ...action,
      ...(override ?? {})
    });
  }
  for (const [id, override] of actionOverrides.entries()) {
    if (actionMap.has(id)) continue;
    actionMap.set(id, {
      id,
      label: override.label ?? id,
      route: override.route ?? `opl app action execute --action ${id}`,
      payloadFields: override.payloadFields ?? [],
      mutates: override.mutates ?? "unknown",
      dryRunSupported: override.dryRunSupported ?? true,
      confirmationRequired: override.confirmationRequired ?? false,
      dangerLevel: override.dangerLevel,
      owner: override.owner,
      delegatedSurface: override.delegatedSurface,
      canSubmitToSafeActionShell: override.canSubmitToSafeActionShell,
      routeRequiresPayload: override.routeRequiresPayload
    });
  }

  const runtimeMaintenanceActionIds = uniqueStrings([
    asString(localEnvironment?.app_update_action_id),
    "settings_check_app_update",
    "settings_apply_opl_packages",
    "settings_sync_capabilities",
    asString(localEnvironment?.runtime_roots_cleanup_action_id),
    asString(localEnvironment?.runtime_substrate_rollback_action_id),
    ...asStringArray(temporalManagement?.actions)
  ]);
  const runtimeMaintenanceActions = runtimeMaintenanceActionIds.flatMap((actionId): RuntimeMaintenanceActionRef[] => {
    const action = actionMap.get(actionId);
    if (!action) return [];
    return [{
      actionId,
      label: action.label,
      payload: {},
      requiredPayloadFields: action.payloadFields,
      confirmationRequired: action.confirmationRequired,
      dryRunSupported: action.dryRunSupported,
      mutates: action.mutates,
      ...(action.dangerLevel ? { dangerLevel: action.dangerLevel } : {})
    }];
  });
  const temporalSchedulerStatus = firstString(temporalScheduler, ["status", "health_status"]) ?? "unknown";
  const temporalSchedulerReady = asOptionalBoolean(temporalScheduler?.ready);
  const recommendedRuntimeAction = (
    temporalSchedulerReady === false || /attention|error|failed|stale/.test(temporalSchedulerStatus.toLowerCase())
      ? runtimeMaintenanceActions.find((action) => action.actionId === "provider_scheduler_status")
      : null
  ) ?? runtimeMaintenanceActions.find((action) => action.actionId === asString(localEnvironment?.app_update_action_id));
  const runtimeOverview: RuntimeOverviewRef = {
    temporal: {
      status: firstString(temporal, ["health_status", "status"]) ?? firstString(provider, ["status"]) ?? "unknown",
      ready: asOptionalBoolean(temporal?.ready),
      serviceStatus: firstString(temporalSupervisor, ["status", "process_state"])
        ?? firstString(temporalServiceLifecycle, ["service_status"])
        ?? "unknown",
      serviceReady: asOptionalBoolean(temporalSupervisor?.ready ?? temporalWorkerReadiness?.service_ready),
      workerStatus: firstString(temporalWorkerReadiness, ["readiness_status", "lifecycle_status"]) ?? "unknown",
      workerReady: asOptionalBoolean(temporalWorkerReadiness?.worker_ready),
      schedulerStatus: temporalSchedulerStatus,
      schedulerReady: temporalSchedulerReady,
      ...(asString(temporalDetails?.address) ? { address: asString(temporalDetails?.address) as string } : {}),
      ...(asString(temporalDetails?.namespace) ? { namespace: asString(temporalDetails?.namespace) as string } : {}),
      ...(asString(temporalDetails?.task_queue) ? { taskQueue: asString(temporalDetails?.task_queue) as string } : {}),
      ...(firstString(temporalScheduler, ["observed_at"]) ?? firstString(temporalSupervisor, ["observed_at"])
        ? { observedAt: (firstString(temporalScheduler, ["observed_at"]) ?? firstString(temporalSupervisor, ["observed_at"])) as string }
        : {})
    },
    carriers: {
      total: asFiniteNumber(runtimeCarrierSummary?.default_carriers_count) ?? 0,
      present: asFiniteNumber(runtimeCarrierSummary?.present_default_carriers_count) ?? 0,
      healthy: asFiniteNumber(runtimeCarrierSummary?.healthy_default_carriers_count) ?? 0,
      items: asRecordArray(runtimeSourceCarriers?.items).map((carrier, index) => ({
        packageId: asString(carrier.package_id) ?? `runtime-carrier-${index}`,
        label: asString(carrier.label) ?? asString(carrier.package_id) ?? `Runtime source ${index + 1}`,
        ...(asString(carrier.description) ? { description: asString(carrier.description) as string } : {}),
        status: asString(carrier.source_health_status) ?? (asBoolean(carrier.source_present) ? "ready" : "unavailable"),
        ...(asString(carrier.source_origin) ? { sourceOrigin: asString(carrier.source_origin) as string } : {}),
        ...(asString(asRecord(carrier.git)?.sync_status) ? { syncStatus: asString(asRecord(carrier.git)?.sync_status) as string } : {}),
        dirty: asOptionalBoolean(asRecord(carrier.git)?.dirty)
      })),
    },
    maintenanceActions: runtimeMaintenanceActions,
    ...(recommendedRuntimeAction ? { recommendedActionId: recommendedRuntimeAction.actionId } : {})
  };

  const canonicalPackageProjection = asRecord(appState.agent_packages);
  const canonicalPackageRows = packageRowsFromCanonicalProjection(canonicalPackageProjection, appState);
  const canonicalPackageItems = canonicalPackageRows.length
    ? canonicalPackageRows
    : canonicalPackageProjection
      ? [canonicalSummaryRow(canonicalPackageProjection)]
      : [];
  const packageLifecycle = canonicalPackageItems.length
    ? canonicalPackageItems.map((item) => packageLifecycleItem(item, actionMap, "canonical_agent_packages"))
    : moduleItems.length
      ? legacyPackageRowsFromModules(moduleItems).map((item) => packageLifecycleItem(item, actionMap, "legacy_modules_fallback"))
      : fallback.packageLifecycle;

  const priorityActionIds = uniqueByRef(taskDrilldowns.flatMap((task) => {
    const actionReceipt = asRecord(task.action_receipt);
    const taskActionId = asString(actionReceipt?.action_id);
    const exportActionId = asString(actionReceipt?.export_bundle_action_id)
      ?? extractActionId(asRecord(task.artifact_or_blocker)?.export_bundle_action_ref);
    return [taskActionId, exportActionId].filter((item): item is string => Boolean(item)).map((id) => ({
      id,
      ref: id
    }));
  }).concat(
    settingsTaskEntries
      .filter((entry) => ["workspace", "capabilities", "packages", "model_access"].includes(asString(entry.section_id) ?? ""))
      .map((entry) => ({ id: asString(entry.action_id) ?? asString(entry.task_id) ?? "", ref: asString(entry.action_id) ?? asString(entry.task_id) ?? "" })),
    [
      { id: "workspace_ensure", ref: "workspace_ensure" },
      { id: "settings_sync_capabilities", ref: "settings_sync_capabilities" },
      { id: "task_action_receipt_preview", ref: "task_action_receipt_preview" },
      { id: "task_export_bundle_preview", ref: "task_export_bundle_preview" }
    ]
  )).map((item) => item.id);

  const contextActions = uniqueByRef([
    ...priorityActionIds.map((id) => actionMap.get(id)).filter((item): item is WorkbenchActionRef => Boolean(item)),
    ...Array.from(actionMap.values())
      .filter((action) => action.dryRunSupported && (isDeliveryAction(action) || isReceiptAction(action)))
      .slice(0, 8)
  ]);

  const taskDeliverables = taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id);
    const title = asString(task.title);
    const artifact = asRecord(task.artifact_or_blocker);
    const workflowRefs = asRecord(task.workflow_refs);
    if (!taskId || !title || !artifact) return [];
    const refs = [
      {
        id: `deliverable-${taskId}-canonical`,
        title: `${title} canonical ref`,
        ref: asString(artifact.canonical_ref),
        summary: compactText(artifact.content_policy, "Refs-only canonical artifact ref."),
        previewKind: previewKindFromRef(asString(artifact.canonical_ref) ?? title, asString(artifact.content_policy) ?? title)
      },
      {
        id: `deliverable-${taskId}-export`,
        title: `${title} export ref`,
        ref: asString(artifact.export_ref),
        summary: compactText(task.next_visible_step, "Export ref derived from operator workbench."),
        previewKind: previewKindFromRef(asString(artifact.export_ref) ?? title, asString(task.next_visible_step) ?? title)
      },
      {
        id: `deliverable-${taskId}-workflow`,
        title: `${title} workflow ref`,
        ref: asString(workflowRefs?.current_workflow_ref),
        summary: compactText(workflowRefs?.content_policy, "Workflow ref only."),
        previewKind: previewKindFromRef(asString(workflowRefs?.current_workflow_ref) ?? title, asString(workflowRefs?.content_policy) ?? title)
      }
    ];
    return refs
      .filter((item) => item.ref)
      .map((item): WorkbenchArtifactRef => ({
        id: item.id,
        title: item.title,
        kind: "deliverable",
        status: artifactStatus(
          artifact.status ?? artifact.canonical_status ?? artifact.export_status,
          "app_canonical"
        ),
        previewKind: item.previewKind,
        ref: item.ref!,
        summary: item.summary,
        provenance: [
          asString(task.workspace_path),
          asString(artifact.lineage_ref),
          asString(artifact.conformance_ref)
        ].filter((value): value is string => Boolean(value)),
        actions: ["Preview ref", "Attach receipt ref"]
      }));
  });
  const deliverables = taskDeliverables.length ? uniqueByRef(taskDeliverables).slice(0, 6) : fallback.deliverables;

  const taskReceipts = taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id);
    const title = asString(task.title);
    const actionReceipt = asRecord(task.action_receipt);
    const reviewReceipt = asRecord(task.review_receipt);
    const artifact = asRecord(task.artifact_or_blocker);
    if (!taskId || !title) return [];
    const items = [
      {
        id: `receipt-${taskId}-action`,
        title: `${title} action preview`,
        ref: asString(actionReceipt?.preview_ref),
        summary: compactText(actionReceipt?.content_policy, "Dry-run action receipt ref."),
        status: actionReceipt?.preview_ref ? "needs_review" : "blocked"
      },
      {
        id: `receipt-${taskId}-review`,
        title: `${title} review receipt`,
        ref: asString(reviewReceipt?.receipt_ref),
        summary: compactText(reviewReceipt?.authority_policy, "Review receipt summary ref."),
        status: artifactStatus(reviewReceipt?.status ?? task.status ?? task.state)
      },
      {
        id: `receipt-${taskId}-artifact`,
        title: `${title} artifact receipt`,
        ref: asString(artifact?.receipt_ref),
        summary: compactText(artifact?.content_policy, "Artifact receipt ref only."),
        status: artifactStatus(
          artifact?.status ?? artifact?.receipt_status ?? artifact?.canonical_status,
          "app_canonical"
        )
      }
    ];
    return items
      .filter((item) => item.ref)
      .map((item): WorkbenchArtifactRef => ({
        id: item.id,
        title: item.title,
        kind: "receipt",
        status: item.status as WorkbenchArtifactRef["status"],
        previewKind: "code",
        ref: item.ref!,
        summary: item.summary,
        provenance: [
          asString(task.runtime_readback_source),
          asString(task.workspace_path),
          asString(reviewReceipt?.check_ref)
        ].filter((value): value is string => Boolean(value)),
        actions: ["Preview receipt", "Compare refs"]
      }));
  });
  const receipts = taskReceipts.length ? uniqueByRef(taskReceipts).slice(0, 6) : fallback.receipts;

  const leadTask = taskDrilldowns[0] ?? null;
  const leadTaskTitle = asString(leadTask?.title) ?? "Current task";
  const leadArtifact = asRecord(leadTask?.artifact_or_blocker);
  const leadActionReceipt = asRecord(leadTask?.action_receipt);
  const leadActionId = asString(leadActionReceipt?.action_id);
  const leadActionRoute = asString(leadActionReceipt?.route);
  const leadExportActionId = asString(leadActionReceipt?.export_bundle_action_id);
  const leadExportRoute = asString(leadActionReceipt?.export_bundle_route);
  const leadStageRun = asRecord(leadTask?.stage_run_cockpit_summary)
    ?? asRecord(leadTask?.stage_run_current_owner_delta)
    ?? asRecord(leadTask?.stage_run_cockpit);
  const leadAcceptedShapes = taskAcceptedShapes(leadTask ?? {}, currentOwnerDelta);
  const leadUsageSummary = usageSummary(asRecord(leadTask?.current_stage_usage));
  const leadTaskTotalUsage = usageSummary(asRecord(leadTask?.task_total_usage));
  const leadTraceSteps = uniqueStrings([
    leadTaskTitle,
    asString(leadTask?.active_stage_label) ?? asString(leadTask?.active_stage_id),
    asString(leadTask?.status_label) ?? asString(leadTask?.status),
    asString(currentOwnerDelta?.owner) ?? asString(leadStageRun?.current_owner),
    compactText(leadTask?.next_visible_step, "Review current refs before execution.", 88),
    leadAcceptedShapes.length ? `Return ${leadAcceptedShapes.join(" | ")}` : null
  ]);

  const leadPreviewCandidates: ArtifactPreview[] = leadTask ? [
    {
      id: `preview-summary-${asString(leadTask.task_id) ?? "current"}`,
      label: "Summary",
      previewKind: "markdown",
      rendererModuleId: rendererModuleIdForPreviewKind("markdown"),
      title: `${leadTaskTitle} workbench summary`,
      ref: asString(leadArtifact?.current_ref) ?? `opl://task/${asString(leadTask.task_id) ?? "current"}`,
      summary: compactText(leadTask.next_visible_step, "Task-derived summary preview."),
      content: [
        `### ${leadTaskTitle}`,
        "",
        compactText(leadTask.next_visible_step, "Review current refs before execution."),
        "",
        "#### Workbench reading",
        `- Status: ${(asString(leadTask.status_label) ?? asString(leadTask.status) ?? "unknown").replaceAll("_", " ")}`,
        `- Owner: ${asString(currentOwnerDelta?.owner) ?? asString(leadStageRun?.current_owner) ?? "unknown"}`,
        `- Stage: ${asString(leadTask.active_stage_label) ?? asString(leadTask.active_stage_id) ?? "unknown"}`,
        `- Runtime source: ${asString(leadTask.runtime_readback_source) ?? "unknown"}`,
        ...(leadAcceptedShapes.length ? [`- Required return: ${leadAcceptedShapes.join(", ")}`] : []),
        ...(leadUsageSummary ? [`- Stage usage: ${leadUsageSummary}`] : []),
        ...(leadTaskTotalUsage ? [`- Task usage: ${leadTaskTotalUsage}`] : [])
      ].join("\n"),
      fields: [
        previewField("Task", asString(leadTask.task_id)),
        previewField("Primary state", asString(leadTask.primary_state_label) ?? asString(leadTask.primary_state)),
        previewField("Automation", asString(leadTask.automation_state_label) ?? asString(leadTask.automation_state)),
        previewField("Last heartbeat", formatTimestamp(leadTask.last_heartbeat_at)),
        previewField("Last progress", formatTimestamp(leadTask.last_progress_at))
      ].filter((item): item is { label: string; value: string } => Boolean(item)),
      bullets: uniqueStrings([
        asString(leadTask.typed_blocker_summary),
        asString(leadTask.resolution_route),
        asString(leadStageRun?.running_proof_summary)
      ]),
      sourceRefs: uniqueStrings([
        asString(leadArtifact?.current_ref),
        asString(leadTask.workspace_path),
        asString(leadTask.gateway_status_ref),
        asString(leadStageRun?.typed_blocker_resolution_ref)
      ]),
      authorityBoundary: "Summary projection only; task truth, receipts, and artifact bodies remain source-owned."
    },
    {
      id: `preview-receipt-${asString(leadTask.task_id) ?? "current"}`,
      label: "Receipt",
      previewKind: "json",
      rendererModuleId: rendererModuleIdForPreviewKind("json"),
      title: `${leadTaskTitle} action receipt envelope`,
      ref: asString(leadActionReceipt?.preview_ref) ?? (leadActionRoute ? ensureDryRunJsonRoute(leadActionRoute) : `opl://task/${asString(leadTask.task_id) ?? "current"}/receipt-preview-unavailable`),
      summary: compactText(leadActionReceipt?.content_policy, "Structured preview receipt metadata."),
      content: JSON.stringify({
        task_id: asString(leadTask.task_id),
        action_id: leadActionId,
        preview_ref: asString(leadActionReceipt?.preview_ref),
        dry_run_route: leadActionRoute ? ensureDryRunJsonRoute(leadActionRoute) : null,
        export_bundle_action_id: leadExportActionId,
        export_bundle_route: leadExportRoute ? ensureDryRunJsonRoute(leadExportRoute) : null,
        export_bundle_ref: asStringArray(leadArtifact?.export_bundle_refs)[0] ?? asString(leadArtifact?.export_ref),
        content_policy: asString(leadActionReceipt?.content_policy) ?? "refs_only_no_action_receipt_body",
        required_return_shapes: leadAcceptedShapes
      }, null, 2),
      fields: [
        previewField("Action", leadActionId),
        previewField("Export action", leadExportActionId),
        previewField("Payload", "task_id, action_ref"),
        previewField("Boundary", asString(leadActionReceipt?.content_policy) ?? "refs_only_no_action_receipt_body")
      ].filter((item): item is { label: string; value: string } => Boolean(item)),
      bullets: [
        "Dry-run preview route only; no action receipt body is transferred into the renderer.",
        "Use the preview ref and export bundle ref together when preparing a confirmable action."
      ],
      sourceRefs: uniqueStrings([
        asString(leadActionReceipt?.preview_ref),
        asString(leadArtifact?.export_bundle_action_ref),
        asStringArray(leadArtifact?.export_bundle_refs)[0],
        asString(leadArtifact?.receipt_ref)
      ]),
      authorityBoundary: "Receipt envelope only; execute, owner receipt, and rollback truth remain outside the shell."
    },
    {
      id: `preview-trace-${asString(leadTask.task_id) ?? "current"}`,
      label: "Trace",
      previewKind: "mermaid",
      rendererModuleId: rendererModuleIdForPreviewKind("mermaid"),
      title: `${leadTaskTitle} owner-route trace`,
      ref: asString(leadStageRun?.source_ref) ?? asString(leadArtifact?.current_ref) ?? `opl://task/${asString(leadTask.task_id) ?? "current"}/trace`,
      summary: compactText(asString(currentOwnerDelta?.desired_delta_description) ?? asString(leadTask?.resolution_route), "Owner-route trace derived from App state."),
      fields: [
        previewField("Current owner", asString(currentOwnerDelta?.owner) ?? asString(leadStageRun?.current_owner)),
        previewField("Hard gate", asString(asRecord(currentOwnerDelta?.hard_gate)?.state)),
        previewField("Next safe action", asString(leadStageRun?.next_safe_action_ref)),
        previewField("Runtime", asString(leadTask?.runtime_attempt_status))
      ].filter((item): item is { label: string; value: string } => Boolean(item)),
      bullets: uniqueStrings([
        asString(currentOwnerDelta?.desired_delta_description),
        asString(leadStageRun?.resolution_route),
        asString(leadTask?.typed_blocker_summary)
      ]),
      sourceRefs: uniqueStrings([
        asString(leadStageRun?.source_ref),
        asString(leadStageRun?.typed_blocker_resolution_ref),
        asString(leadTask?.gateway_status_ref)
      ]),
      traceSteps: leadTraceSteps,
      authorityBoundary: "Trace projection only; stage transition still requires owner receipt or typed blocker."
    },
    {
      id: `preview-manifest-${asString(leadTask.task_id) ?? "current"}`,
      label: "Manifest",
      previewKind: "code",
      rendererModuleId: rendererModuleIdForPreviewKind("code"),
      title: `${leadTaskTitle} deliverable manifest`,
      ref: asStringArray(leadArtifact?.export_bundle_refs)[0] ?? asString(leadArtifact?.export_ref) ?? asString(leadArtifact?.canonical_ref) ?? `opl://task/${asString(leadTask.task_id) ?? "current"}/deliverable`,
      summary: compactText(leadArtifact?.content_policy, "Manifest-style delivery projection from refs."),
      content: [
        "export const workbenchDeliveryProjection = {",
        `  taskId: ${JSON.stringify(asString(leadTask.task_id) ?? null)},`,
        `  title: ${JSON.stringify(leadTaskTitle)},`,
        `  currentRef: ${JSON.stringify(asString(leadArtifact?.current_ref) ?? null)},`,
        `  canonicalRef: ${JSON.stringify(asString(leadArtifact?.canonical_ref) ?? null)},`,
        `  exportRef: ${JSON.stringify(asString(leadArtifact?.export_ref) ?? null)},`,
        `  exportBundleRef: ${JSON.stringify(asStringArray(leadArtifact?.export_bundle_refs)[0] ?? null)},`,
        `  receiptRef: ${JSON.stringify(asString(leadArtifact?.receipt_ref) ?? null)},`,
        `  lineageRef: ${JSON.stringify(asString(leadArtifact?.lineage_ref) ?? null)},`,
        `  conformanceRef: ${JSON.stringify(asString(leadArtifact?.conformance_ref) ?? null)},`,
        `  sourceRefCount: ${JSON.stringify(leadTask.source_ref_count ?? null)},`,
        `  safeActionRefCount: ${JSON.stringify(leadTask.safe_action_ref_count ?? null)},`,
        '  authorityBoundary: "refs_only_no_artifact_body"',
        "};"
      ].join("\n"),
      fields: [
        previewField("Current ref", compactRef(asString(leadArtifact?.current_ref) ?? "")),
        previewField("Export bundle", compactRef(asStringArray(leadArtifact?.export_bundle_refs)[0] ?? asString(leadArtifact?.export_ref) ?? "")),
        previewField("Lineage", compactRef(asString(leadArtifact?.lineage_ref) ?? "")),
        previewField("Conformance", compactRef(asString(leadArtifact?.conformance_ref) ?? ""))
      ].filter((item): item is { label: string; value: string } => Boolean(item)),
      bullets: [
        "This is a manifest-style projection for export/readback, not an owned artifact body.",
        "Conformance and lineage stay as refs so the workbench can show delivery context without copying truth."
      ],
      sourceRefs: uniqueStrings([
        asString(leadArtifact?.current_ref),
        asString(leadArtifact?.canonical_ref),
        asStringArray(leadArtifact?.export_bundle_refs)[0],
        asString(leadArtifact?.lineage_ref),
        asString(leadArtifact?.conformance_ref)
      ]),
      authorityBoundary: "Manifest projection only; artifact bytes and release authority remain external."
    }
  ] : [];

  const genericArtifactPreviews = uniqueByRef([
    ...deliverables.map(artifactPreviewFromItem),
    ...receipts.map(artifactPreviewFromItem)
  ]);
  const artifactPreviews = uniqueByRef([...leadPreviewCandidates, ...genericArtifactPreviews]).slice(0, 6);

  const taskReceiptSummaries = taskDrilldowns.flatMap((task) => {
    const taskId = asString(task.task_id);
    const title = asString(task.title);
    const actionReceipt = asRecord(task.action_receipt);
    const artifact = asRecord(task.artifact_or_blocker);
    const acceptedShapes = taskAcceptedShapes(task, currentOwnerDelta);
    if (!taskId || !title || !actionReceipt) return [];
    const actionId = asString(actionReceipt.action_id);
    const actionRoute = asString(actionReceipt.route);
    const exportActionId = asString(actionReceipt.export_bundle_action_id);
    const exportRoute = asString(actionReceipt.export_bundle_route);
    const exportBundleRef = asStringArray(artifact?.export_bundle_refs)[0];
    return [
      ...(actionId && actionRoute ? [{
        id: `action-receipt-${taskId}`,
        title: `${title} receipt preview`,
        actionId,
        route: ensureDryRunJsonRoute(actionRoute),
        status: "payload_required" as const,
        mutates: "none_read_only",
        receiptRef: asString(actionReceipt.preview_ref) ?? `receipt://${taskId}/preview`,
        summary: compactText(task.next_visible_step, "Task preview receipt derived from operator workbench."),
        payloadFields: ["task_id", "action_ref"],
        owner: asString(task.typed_blocker_owner) ?? asString(currentOwnerDelta?.owner) ?? asString(task.domain_id) ?? undefined,
        authorityBoundary: "Task receipt preview only; no domain execution or owner receipt is implied.",
        sourceRefs: uniqueStrings([
          asString(actionReceipt.preview_ref),
          asString(artifact?.current_ref),
          asString(task.workspace_path)
        ]),
        checks: uniqueStrings([
          "Bind task_id and action_ref before previewing the receipt.",
          acceptedShapes.length ? `Accepted return shapes: ${acceptedShapes.join(", ")}` : null
        ])
      }] : []),
      ...(exportActionId && exportRoute && exportBundleRef ? [{
        id: `action-export-${taskId}`,
        title: `${title} export bundle preview`,
        actionId: exportActionId,
        route: ensureDryRunJsonRoute(exportRoute),
        status: "payload_required" as const,
        mutates: "none_read_only",
        receiptRef: exportBundleRef,
        summary: compactText(artifact?.content_policy, "Export bundle preview uses refs only."),
        payloadFields: ["task_id", "export_bundle_ref"],
        owner: asString(task.domain_id) ?? undefined,
        authorityBoundary: "Export preview only; bundle contents remain source-owned.",
        sourceRefs: uniqueStrings([
          exportBundleRef,
          asString(artifact?.export_ref),
          asString(artifact?.conformance_ref)
        ]),
        checks: [
          "Confirm the export bundle ref is current before any execute step.",
          "Dry-run does not imply package-ready or owner acceptance."
        ]
      }] : [])
    ];
  });
  const genericReceiptSummaries = contextActions
    .filter((action) => action.dryRunSupported)
    .map((action): ActionReceiptSummary => ({
      id: `action-generic-${action.id}`,
      title: `${action.label} receipt preview`,
      actionId: action.id,
      route: ensureDryRunJsonRoute(action.route),
      status: actionStatus(action),
      mutates: action.mutates,
      receiptRef: `receipt://${action.id}/dry-run`,
      summary: action.payloadFields.length
        ? `Dry-run route exists; payload required: ${action.payloadFields.join(", ")}.`
        : "Dry-run route can preview a refs-only receipt without a domain artifact body."
      ,
      payloadFields: action.payloadFields,
      owner: action.owner,
      authorityBoundary: "Generic action receipt preview only; submit/execute stays outside the renderer.",
      sourceRefs: uniqueStrings([ensureDryRunJsonRoute(action.route), action.delegatedSurface]),
      checks: uniqueStrings([
        action.payloadFields.length ? `Required payload: ${action.payloadFields.join(", ")}` : "No payload required for a preview receipt.",
        action.canSubmitToSafeActionShell ? "Safe-action shell can submit this preview lane." : "Safe-action shell submission is not declared for this route."
      ])
    }));
  const actionReceipts = uniqueByRef([...taskReceiptSummaries, ...genericReceiptSummaries]).slice(0, 8);

  const moduleAvailability = new Map<WorkbenchStarter["id"], { status: string; sourceRef: string }>();
  const moduleRecords = new Map<WorkbenchStarter["id"], Record<string, unknown>>();
  for (const item of moduleItems) {
    const moduleId = asString(item?.module_id) ?? "";
    const label = asString(item?.label) ?? "";
    const key = moduleKey(`${moduleId} ${label}`);
    if (!key) continue;
    const installed = asBoolean(item?.installed);
    const health = asString(item?.health_status) ?? "unknown";
    moduleAvailability.set(key, {
      status: installed ? health : "not_installed",
      sourceRef: asString(item?.checkout_path) ?? asString(item?.repo_url) ?? moduleId
    });
    moduleRecords.set(key, item);
  }

  const starterTasks = new Map<WorkbenchStarter["id"], Record<string, unknown>>();
  for (const task of taskDrilldowns) {
    const key = pickTaskKey(task);
    if (!key) continue;
    const current = starterTasks.get(key);
    const taskId = asString(task.task_id);
    const domainId = asString(task.domain_id);
    if (!current || (taskId && domainId && taskId === domainId)) {
      starterTasks.set(key, task);
    }
  }

  const starters = fallback.starters.map((starter): WorkbenchStarter => {
    const availability = moduleAvailability.get(starter.id);
    const moduleRecord = moduleRecords.get(starter.id) ?? null;
    const task = starterTasks.get(starter.id) ?? null;
    const taskAction = actionMap.get(asString(asRecord(task?.action_receipt)?.action_id) ?? "");
    const exportAction = actionMap.get(
      asString(asRecord(task?.action_receipt)?.export_bundle_action_id)
      ?? extractActionId(asRecord(task?.artifact_or_blocker)?.export_bundle_action_ref)
      ?? ""
    );
    const starterAction = [taskAction, exportAction, starterPreviewAction(starter, contextActions)]
      .find((action): action is WorkbenchActionRef => Boolean(action?.dryRunSupported));
    const routeStatus = starterAction ? actionStatus(starterAction) : "unavailable";
    const taskArtifact = asRecord(task?.artifact_or_blocker);
    const taskActionReceipt = asRecord(task?.action_receipt);
    const starterTitle = asString(task?.title)
      ? `${starter.title.split("/")[0]?.trim() ?? starter.title} / ${asString(task?.title)}`
      : starter.title;
    return {
      ...starter,
      title: starterTitle,
      module: asString(moduleRecord?.label) ?? starter.module,
      intent: compactText(task?.next_visible_step, asString(moduleRecord?.description) ?? starter.intent),
      fields: buildStarterFields(starter, starterAction, task, moduleRecord),
      available: Boolean(starterAction?.dryRunSupported),
      status: routeStatus,
      sourceRef: asString(taskActionReceipt?.preview_ref)
        ?? asString(taskArtifact?.current_ref)
        ?? starterAction?.route
        ?? availability?.sourceRef
        ?? starter.sourceRef,
      previewActionId: starterAction?.id,
      dryRunAction: starterAction?.id
    };
  });

  const runtimeStatus = asString(asRecord(operator?.summary)?.runtime_status)
    ?? asString(asRecord(operator?.summary)?.provider_status)
    ?? asString(currentOwnerDeltaNextAction?.action_kind)
    ?? asString(asRecord(appState.provider)?.status)
    ?? "unknown";

  const effectiveContextSources = contextSources.length ? contextSources : fallback.contextSources;
  const sourceRefs = effectiveContextSources.map((source) => source.ref);
  const previewAction = firstPreviewAction(contextActions);
  const deliveryPackages: DeliveryPackage[] = (deliverables.length || receipts.length || contextActions.length) ? [
    {
      id: "delivery-package",
      title: "Delivery package",
      status: deliverables.length || receipts.length ? "needs_review" : "blocked",
      summary: "Derived from live App action refs, operator task drilldowns, receipt refs, and runtime status; artifact bodies stay source-owned.",
      previewActionId: previewAction?.id,
      deliverableRefs: deliverables.map((item) => item.ref),
      receiptRefs: receipts.map((item) => item.ref),
      sourceRefs,
      runtimeStatus,
      authorityBoundary: "Refs-only delivery context; no artifact body, owner receipt, domain truth, or release authority."
    }
  ] : fallback.deliveryPackages;

  const leadTaskNextStep = compactText(leadTask?.next_visible_step, "Review current App refs before execution.");
  const confirmations: ConfirmationCard[] = previewAction ? [{
    id: `confirm-${previewAction.id}`,
    title: `Preview ${leadTaskTitle} package`,
    question: `Preview ${previewAction.label} for ${leadTaskTitle} as a refs-only delivery package?`,
    risks: [`Runtime status: ${runtimeStatus}`, leadTaskNextStep, "needs_human_confirmation"],
    willChange: [`Create dry-run request for ${previewAction.id}`, "Attach current App state refs"],
    willNotChange: ["No domain artifact body is written", "No owner receipt or release claim is created"],
    receipt: "Preview receipt from opl app action execute --dry-run",
    rollback: "Discard the candidate packet request before explicit execution",
    dryRunAction: previewAction.id
  }] : [];

  const questions = leadTask ? [
    {
      id: "question-owner-shape",
      question: compactText(currentOwnerDelta?.desired_delta_description, leadTaskNextStep),
      whyItMatters: compactText(currentOwnerDeltaNextAction?.action_kind, "Current owner delta defines the next legal answer shape."),
      answerType: asStringArray(currentOwnerDelta?.accepted_answer_shape).join(", ") || "typed owner answer"
    },
    {
      id: "question-review-receipt",
      question: `Which receipt ref should stay attached to ${leadTaskTitle}?`,
      whyItMatters: "Review receipts stay refs-only and do not transfer domain authority.",
      answerType: "receipt ref"
    },
    {
      id: "question-package-export",
      question: "Which export bundle ref should be previewed next?",
      whyItMatters: "Export bundle previews remain App-owned dry-run refs, not artifact bodies.",
      answerType: "export bundle ref"
    }
  ] : [];

  const contextTrace = [
    { id: "profile", label: "Profile", value: `${asString(meta?.profile) ?? "fast"} | ${formatTimestamp(meta?.generated_at) ?? "no timestamp"}` },
    { id: "owner", label: "Owner route", value: `${asString(currentOwnerDelta?.owner) ?? asString(workbench?.operator_next_action_owner) ?? "unknown"} -> ${asString(currentOwnerDeltaNextAction?.action_kind) ?? asString(workbench?.operator_next_action_kind) ?? "unknown next action"}` },
    { id: "runtime", label: "Runtime", value: `${asString(asRecord(operator?.summary)?.runtime_status) ?? "unknown"} | provider ${asString(asRecord(operator?.summary)?.provider_status) ?? "unknown"}` },
    { id: "boundary", label: "Boundary", value: `${asString(runtimeSource?.owner) ?? "opl_framework"} via ${asString(runtimeSource?.app_repo_truth_owner) ?? "one-person-lab-app"} | refs only` },
    { id: "hard-gate", label: "Hard gate", value: `${asString(asRecord(currentOwnerDelta?.hard_gate)?.state) ?? "unknown"}${leadAcceptedShapes.length ? ` | return ${leadAcceptedShapes.join(", ")}` : ""}` },
    { id: "task", label: "Lead task", value: `${leadTaskTitle} | ${compactText(leadTask?.next_visible_step, "Review current refs", 72)}` }
  ].filter((item) => item.value);

  const sessions = taskDrilldowns.length
    ? taskDrilldowns.slice(0, 3).map((task): WorkspaceSession => ({
        id: asString(task.task_id) ?? `session-${Math.random()}`,
        workspace: `${asString(task.domain_label) ?? "OPL"}${asString(task.workspace_label) ? ` / ${asString(task.workspace_label)}` : ""}`,
        session: `${asString(task.title) ?? asString(task.task_id) ?? "Delivery review"}${asString(task.active_stage_label) ? ` · ${asString(task.active_stage_label)}` : ""}`,
        status: `${asString(task.status) ?? asString(task.state) ?? "candidate_surface_only"}${asString(task.priority_bucket) ? ` · ${asString(task.priority_bucket)}` : ""}`,
        nextStep: compactText(task.next_visible_step, "Review current refs")
      }))
    : fallback.sessions;

  const derivedActiveProjectLines = taskDrilldowns.length ? taskDrilldowns.slice(0, 6).map((task): ActiveProjectLine => ({
    status: asString(task.status) ?? asString(task.state) ?? "unknown",
    activeRunId: asString(task.active_run_id),
    nextVisibleStep: compactText(task.next_visible_step, "Review current refs"),
    progressDeltaClassification: asString(task.priority_bucket) ?? asString(asRecord(task.progress)?.status) ?? "platform_or_observability_delta",
    deliverableProgressDelta: asString(asRecord(task.artifact_or_blocker)?.content_policy) ?? "refs_only_no_artifact_body",
    platformRepairDelta: asString(task.runtime_attempt_status) ?? "none",
    nextForcedDelta: asString(asRecord(task.review_receipt)?.next_action) ?? asString(currentOwnerDeltaNextAction?.action_kind) ?? "owner adoption gate"
  })) : pickActiveProjectLines(appState.active_project_lines, fallback.activeProjectLines);

  return {
    ...fallback,
    features: deriveFeatureRefs(state, baseActions),
    sessions,
    results: buildResultsFromTasks(taskDrilldowns),
    deliverables,
    receipts,
    artifactPreviews,
    deliveryPackages,
    actionReceipts,
    packageLifecycle,
    officialProfileRestore: actionMap.get("official_profile_restore"),
    starters,
    confirmations,
    questions,
    activeProjectLines: derivedActiveProjectLines,
    contextSources: effectiveContextSources,
    contextActions: contextActions.length ? contextActions : fallback.contextActions,
    contextTrace: contextTrace.length ? contextTrace : fallback.contextTrace,
    gatewayAccount,
    settingsProjection,
    runtimeOverview,
    serviceRecovery: deriveServiceRecoveryModel({ temporal, actions, stateFresh: true }),
    workItemRuntime,
    managedCompanions: readManagedCompanions(appState),
    uiContributions: readUiContributionsProjection(state),
    stateGeneratedAt: asString(meta?.generated_at) ?? fallback.stateGeneratedAt
  };
}
