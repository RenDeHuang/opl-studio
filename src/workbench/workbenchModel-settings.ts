import type {
  RuntimeMaintenanceActionRef,
  WorkbenchGatewayAccount,
  WorkbenchSettingsProjection
} from "./workbenchModel-contracts";
import {
  asBoolean,
  asFiniteNumber,
  asOptionalBoolean,
  asRecord,
  asRecordArray,
  asString,
  asStringArray,
  firstString
} from "./workbenchModel-primitives";

export type WorkbenchSettingsProjectionInput = {
  coreCodex: Record<string, unknown> | null;
  settingsControlCenter: Record<string, unknown> | null;
  codexPersonalization: Record<string, unknown> | null;
  actionRecords: ReadonlyMap<string, Record<string, unknown>>;
};

export type WorkbenchSettingsProjectionResult = {
  gatewayAccount?: WorkbenchGatewayAccount;
  settingsProjection?: WorkbenchSettingsProjection;
};

function projectedMaintenanceAction(
  actionRecords: ReadonlyMap<string, Record<string, unknown>>,
  actionId: string | null | undefined
): RuntimeMaintenanceActionRef | undefined {
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
}

function gatewayConnectionMode(
  gatewayAccountProjection: Record<string, unknown> | null
): WorkbenchSettingsProjection["gatewayConnectionMode"] {
  return gatewayAccountProjection?.surface_kind === "opl_gateway_account_read_model.v1"
    && ["none", "manual_key", "account"].includes(asString(gatewayAccountProjection.connection_mode) ?? "")
    ? asString(gatewayAccountProjection.connection_mode) as WorkbenchSettingsProjection["gatewayConnectionMode"]
    : "none";
}

function gatewayUsage(gatewayUsageRecord: Record<string, unknown> | null): WorkbenchGatewayAccount["usage"] {
  const todayTokens = asFiniteNumber(gatewayUsageRecord?.today_tokens);
  const totalTokens = asFiniteNumber(gatewayUsageRecord?.total_tokens);
  const todayCost = asFiniteNumber(gatewayUsageRecord?.today_actual_cost);
  const totalCost = asFiniteNumber(gatewayUsageRecord?.total_actual_cost);
  if (todayTokens === null && totalTokens === null && todayCost === null && totalCost === null) return undefined;
  return {
    ...(todayTokens !== null ? { todayTokens } : {}),
    ...(totalTokens !== null ? { totalTokens } : {}),
    ...(todayCost !== null ? { todayCost } : {}),
    ...(totalCost !== null ? { totalCost } : {}),
    ...(asString(gatewayUsageRecord?.currency) ? { currency: asString(gatewayUsageRecord?.currency) as string } : {}),
    ...(asString(gatewayUsageRecord?.day_timezone) ? { timezone: asString(gatewayUsageRecord?.day_timezone) as string } : {})
  };
}

function gatewayFreshness(gatewayFreshnessRecord: Record<string, unknown> | null): WorkbenchGatewayAccount["freshness"] {
  if (!gatewayFreshnessRecord) return undefined;
  return {
    ...(asString(gatewayFreshnessRecord.observed_at) ? { observedAt: asString(gatewayFreshnessRecord.observed_at) as string } : {}),
    stale: asBoolean(gatewayFreshnessRecord.stale),
    ...(asString(gatewayFreshnessRecord.last_error_code) ? { lastErrorCode: asString(gatewayFreshnessRecord.last_error_code) as string } : {})
  };
}

function deriveGatewayAccount(
  gatewayAccountProjection: Record<string, unknown> | null
): WorkbenchGatewayAccount | undefined {
  const account = asRecord(gatewayAccountProjection?.account);
  const balance = asRecord(account?.balance);
  const usage = gatewayUsage(asRecord(gatewayAccountProjection?.usage));
  const managedKey = asRecord(gatewayAccountProjection?.managed_key);
  const installation = asRecord(gatewayAccountProjection?.installation);
  const freshnessRecord = asRecord(gatewayAccountProjection?.freshness);
  const status = asString(gatewayAccountProjection?.status);
  const displayName = asString(account?.display_name);
  if (gatewayAccountProjection?.surface_kind !== "opl_gateway_account_read_model.v1"
    || gatewayAccountProjection.connection_mode !== "account"
    || !asBoolean(gatewayAccountProjection.account_card_visible)
    || status === null
    || !["connected", "setup_required", "reauth_required", "attention_needed", "disconnect_pending"].includes(status)
    || displayName === null) return undefined;

  const availableGroups = asRecordArray(gatewayAccountProjection.available_groups).flatMap((group) => {
    const id = asString(group.group_id);
    return id ? [{ id, label: asString(group.label) ?? id }] : [];
  });
  const accountBalance = asFiniteNumber(balance?.amount);
  const balanceCurrency = asString(balance?.currency);
  const managedKeyName = asString(managedKey?.name);
  const managedKeyStatus = asString(managedKey?.status);
  const deviceLabel = asString(installation?.device_label);
  const deviceShortId = asString(installation?.short_id);
  return {
    displayName,
    status,
    ...(asString(account?.email) ? { email: asString(account?.email) as string } : {}),
    ...(asString(account?.status) ? { accountStatus: asString(account?.status) as string } : {}),
    ...(accountBalance !== null && balanceCurrency ? { balance: { amount: accountBalance, currency: balanceCurrency } } : {}),
    ...(usage ? { usage } : {}),
    ...(managedKeyName || managedKeyStatus ? {
      managedKey: {
        ...(managedKeyName ? { name: managedKeyName } : {}),
        ...(managedKeyStatus ? { status: managedKeyStatus } : {})
      }
    } : {}),
    ...(availableGroups.length ? { availableGroups } : {}),
    ...(deviceLabel || deviceShortId ? {
      installation: {
        ...(deviceLabel ? { deviceLabel } : {}),
        ...(deviceShortId ? { shortId: deviceShortId } : {})
      }
    } : {}),
    ...(freshnessRecord ? { freshness: gatewayFreshness(freshnessRecord) } : {}),
    sourceRef: "app_state.settings_control_center.app_settings_read_model.opl_gateway_account.account.display_name"
  };
}

function deriveGatewayProjection(appSettingsReadModel: Record<string, unknown> | null): {
  gatewayAccount?: WorkbenchGatewayAccount;
  gatewayConnectionMode: WorkbenchSettingsProjection["gatewayConnectionMode"];
} {
  const gatewayAccountProjection = asRecord(appSettingsReadModel?.opl_gateway_account);
  return {
    gatewayAccount: deriveGatewayAccount(gatewayAccountProjection),
    gatewayConnectionMode: gatewayConnectionMode(gatewayAccountProjection)
  };
}

function deriveCodexProjection(
  coreCodex: Record<string, unknown> | null,
  codexModelPolicy: Record<string, unknown> | null
): WorkbenchSettingsProjection["codex"] {
  const model = firstString(codexModelPolicy, ["model"]) ?? firstString(coreCodex, ["default_model", "model"]);
  const reasoningEffort = firstString(codexModelPolicy, ["reasoning_effort"]) ?? firstString(coreCodex, ["default_reasoning_effort"]);
  const providerName = firstString(codexModelPolicy, ["provider_name"]) ?? firstString(coreCodex, ["provider_name"]);
  const providerBaseUrl = firstString(codexModelPolicy, ["provider_base_url"]) ?? firstString(coreCodex, ["provider_base_url"]);
  const modelAccessSource = firstString(codexModelPolicy, ["model_access_source"]) ?? firstString(coreCodex, ["model_access_source"]);
  const accessStatus = firstString(codexModelPolicy, ["access_status", "model_access_status"]) ?? firstString(coreCodex, ["model_access_status"]);
  const configPath = firstString(codexModelPolicy, ["config_path"]) ?? firstString(coreCodex, ["config_path"]);
  return {
    installed: asOptionalBoolean(coreCodex?.installed),
    ...(firstString(coreCodex, ["parsed_version", "version"]) ? { version: firstString(coreCodex, ["parsed_version", "version"]) as string } : {}),
    ...(asString(coreCodex?.version_status) ? { versionStatus: asString(coreCodex?.version_status) as string } : {}),
    ...(asString(coreCodex?.binary_path) ? { binaryPath: asString(coreCodex?.binary_path) as string } : {}),
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(providerName ? { providerName } : {}),
    ...(providerBaseUrl ? { providerBaseUrl } : {}),
    ...(modelAccessSource ? { modelAccessSource } : {}),
    ...(accessStatus ? { accessStatus } : {}),
    ...(configPath ? { configPath } : {}),
    apiKeyPresent: asOptionalBoolean(codexModelPolicy?.api_key_present ?? coreCodex?.api_key_present),
    updateAvailable: asOptionalBoolean(coreCodex?.update_available)
  };
}

function deriveStatusSummary(
  statusSummary: Record<string, unknown> | null,
  localEnvironment: Record<string, unknown> | null
): WorkbenchSettingsProjection["statusSummary"] {
  const temporalProvider = firstString(statusSummary, ["temporal_provider"]) ?? firstString(localEnvironment, ["temporal_provider"]);
  const releaseChannel = firstString(statusSummary, ["release_channel"]) ?? firstString(localEnvironment, ["release_channel"]);
  const issueCount = asFiniteNumber(statusSummary?.issue_count);
  return {
    ...(asString(statusSummary?.runtime_source_carrier_health) ? { runtimeSourceHealth: asString(statusSummary?.runtime_source_carrier_health) as string } : {}),
    ...(asString(statusSummary?.agent_package_functional_health) ? { agentPackageHealth: asString(statusSummary?.agent_package_functional_health) as string } : {}),
    ...(temporalProvider ? { temporalProvider } : {}),
    ...(releaseChannel ? { releaseChannel } : {}),
    ...(issueCount !== null ? { issueCount } : {})
  };
}

function deriveLocalEnvironment(
  localEnvironment: Record<string, unknown> | null
): WorkbenchSettingsProjection["localEnvironment"] {
  return {
    ...(asString(localEnvironment?.state_dir) ? { stateDir: asString(localEnvironment?.state_dir) as string } : {}),
    ...(asString(localEnvironment?.runtime_sources_root) ? { runtimeSourcesRoot: asString(localEnvironment?.runtime_sources_root) as string } : {}),
    ...(asString(localEnvironment?.logs_dir) ? { logsDir: asString(localEnvironment?.logs_dir) as string } : {}),
    ...(asString(localEnvironment?.release_channel) ? { releaseChannel: asString(localEnvironment?.release_channel) as string } : {}),
    ...(asString(localEnvironment?.temporal_provider) ? { temporalProvider: asString(localEnvironment?.temporal_provider) as string } : {})
  };
}

function deriveWorkspace(
  workspaceServices: Record<string, unknown> | null
): WorkbenchSettingsProjection["workspace"] {
  const workspaceRoot = asRecord(workspaceServices?.workspace_root);
  const personalizationRefs = asRecord(workspaceServices?.personalization_refs);
  return {
    ...(asString(workspaceRoot?.selected_path) ? { selectedPath: asString(workspaceRoot?.selected_path) as string } : {}),
    exists: asOptionalBoolean(workspaceRoot?.exists),
    writable: asOptionalBoolean(workspaceRoot?.writable),
    ...(asString(workspaceRoot?.health_status) ? { healthStatus: asString(workspaceRoot?.health_status) as string } : {}),
    personalizationSourceCount: asStringArray(personalizationRefs?.source_refs).length
  };
}

function deriveExternalConnections(
  connectionsReadModel: Record<string, unknown> | null
): WorkbenchSettingsProjection["externalConnections"] {
  return asRecordArray(connectionsReadModel?.connections)
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
}

function deriveDockerWebui(
  dockerWebui: Record<string, unknown> | null,
  actionRecords: ReadonlyMap<string, Record<string, unknown>>
): WorkbenchSettingsProjection["dockerWebui"] {
  const dockerRuntimeProxy = asRecord(dockerWebui?.runtime_proxy);
  const dockerFailureRecovery = asRecord(dockerWebui?.failure_recovery);
  const actions = asRecordArray(dockerWebui?.ordinary_next_actions).flatMap((projected): RuntimeMaintenanceActionRef[] => {
    const actionId = asString(projected.action_id);
    if (!actionId) return [];
    const action = actionRecords.get(actionId);
    const payloadFields = asStringArray(projected.payload_fields);
    const dangerLevel = asString(projected.danger_level) ?? asString(action?.danger_level);
    return [{
      actionId,
      label: asString(projected.label) ?? asString(action?.label) ?? actionId,
      ...(asString(projected.state) ? { state: asString(projected.state) as string } : {}),
      payload: {},
      requiredPayloadFields: payloadFields.length ? payloadFields : asStringArray(action?.payload_fields),
      confirmationRequired: asOptionalBoolean(projected.confirmation_required)
        ?? asOptionalBoolean(action?.confirmation_required)
        ?? false,
      dryRunSupported: Boolean(asString(projected.dry_run_route)) || asBoolean(action?.dry_run_supported),
      mutates: asString(action?.mutates) ?? "unknown",
      ...(dangerLevel ? { dangerLevel } : {})
    }];
  });
  return {
    ...(asString(dockerWebui?.ordinary_status) ? { status: asString(dockerWebui?.ordinary_status) as string } : {}),
    ...(asString(dockerRuntimeProxy?.status) ? { runtimeStatus: asString(dockerRuntimeProxy?.status) as string } : {}),
    ...(asString(dockerFailureRecovery?.status) ? { recoveryStatus: asString(dockerFailureRecovery?.status) as string } : {}),
    actions
  };
}

function derivePersonalization(
  codexPersonalization: Record<string, unknown> | null
): WorkbenchSettingsProjection["personalization"] {
  const userAgents = asRecord(codexPersonalization?.user_agents);
  const oplFlowDefaultUserAgents = asRecord(codexPersonalization?.opl_flow_default_user_agents);
  return {
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
  };
}

function deriveProjectedStorageAction(
  projectedAction: Record<string, unknown>
): NonNullable<WorkbenchSettingsProjection["storage"]["agentPackageStore"]["projectedAction"]> {
  return {
    ...(asString(projectedAction.kind) ? { kind: asString(projectedAction.kind) as string } : {}),
    ...(asString(projectedAction.status) ? { status: asString(projectedAction.status) as string } : {}),
    ...(asString(projectedAction.route) ? { route: asString(projectedAction.route) as string } : {}),
    ...(asString(projectedAction.action_id) ? { actionId: asString(projectedAction.action_id) as string } : {}),
    dryRunRequired: asOptionalBoolean(projectedAction.dry_run_required)
  };
}

function deriveStorageItem(
  storageRecord: Record<string, unknown> | null,
  actionRecords: ReadonlyMap<string, Record<string, unknown>>
): WorkbenchSettingsProjection["storage"]["agentPackageStore"] {
  const projectedAction = asRecord(storageRecord?.projected_action);
  const inventoryAction = projectedMaintenanceAction(
    actionRecords,
    asString(storageRecord?.inventory_action_id) ?? asString(projectedAction?.action_id)
  );
  return {
    ...(asString(storageRecord?.status) ? { status: asString(storageRecord?.status) as string } : {}),
    ...(asFiniteNumber(storageRecord?.bytes) !== null ? { bytes: asFiniteNumber(storageRecord?.bytes) as number } : {}),
    ...(asFiniteNumber(storageRecord?.reclaimable_bytes) !== null ? { reclaimableBytes: asFiniteNumber(storageRecord?.reclaimable_bytes) as number } : {}),
    ...(asString(storageRecord?.reason_code) ? { reasonCode: asString(storageRecord?.reason_code) as string } : {}),
    ...(asString(storageRecord?.observed_at) ? { observedAt: asString(storageRecord?.observed_at) as string } : {}),
    stale: asOptionalBoolean(storageRecord?.stale),
    ...(asString(storageRecord?.owner_route) ? { ownerRoute: asString(storageRecord?.owner_route) as string } : {}),
    ...(inventoryAction ? { inventoryAction } : {}),
    ...(projectedAction ? { projectedAction: deriveProjectedStorageAction(projectedAction) } : {})
  };
}

function deriveStorage(
  storageLifecycle: Record<string, unknown> | null,
  actionRecords: ReadonlyMap<string, Record<string, unknown>>
): WorkbenchSettingsProjection["storage"] {
  return {
    agentPackageStore: deriveStorageItem(asRecord(storageLifecycle?.agent_package_store), actionRecords),
    webuiDataVolume: deriveStorageItem(asRecord(storageLifecycle?.webui_data_volume), actionRecords)
  };
}

export function deriveWorkbenchSettingsProjection({
  coreCodex,
  settingsControlCenter,
  codexPersonalization,
  actionRecords
}: WorkbenchSettingsProjectionInput): WorkbenchSettingsProjectionResult {
  const appSettingsReadModel = asRecord(settingsControlCenter?.app_settings_read_model);
  const gateway = deriveGatewayProjection(appSettingsReadModel);
  const codexModelPolicy = asRecord(appSettingsReadModel?.codex_model_policy);
  const localEnvironment = asRecord(appSettingsReadModel?.local_environment);
  const statusSummary = asRecord(settingsControlCenter?.status_summary);
  const workspaceServices = asRecord(appSettingsReadModel?.workspace_services);
  const settingsProjection: WorkbenchSettingsProjection | undefined = appSettingsReadModel || coreCodex
    ? {
        sourceRef: "app_state.settings_control_center.app_settings_read_model",
        gatewayConnectionMode: gateway.gatewayConnectionMode,
        codex: deriveCodexProjection(coreCodex, codexModelPolicy),
        statusSummary: deriveStatusSummary(statusSummary, localEnvironment),
        localEnvironment: deriveLocalEnvironment(localEnvironment),
        workspace: deriveWorkspace(workspaceServices),
        externalConnections: deriveExternalConnections(asRecord(appSettingsReadModel?.connections)),
        dockerWebui: deriveDockerWebui(asRecord(appSettingsReadModel?.docker_webui), actionRecords),
        personalization: derivePersonalization(codexPersonalization),
        storage: deriveStorage(asRecord(appSettingsReadModel?.storage_lifecycle), actionRecords)
      }
    : undefined;

  return { gatewayAccount: gateway.gatewayAccount, settingsProjection };
}
