// Make Error Handler — Deterministic Error Normalizer
// Parses "client_slug | scenario_name" naming convention (fallback 'default_client'),
// normalizes module name, execution id/url, and classifies status ('timeout' vs 'failed').
export function normalizeMakeErrorPayload(item = {}) {
  const scenarioNameRaw = String(item.scenario?.name || item.workflow?.name || 'unnamed_scenario').trim();
  const scenarioId = String(item.scenario?.id || item.workflow?.id || '').trim();
  const executionId = String(item.execution?.id || item.executionId || '').trim();
  const executionUrl = String(item.execution?.url || item.executionUrl || '').trim();
  const failedModule = String(
    item.module?.name || item.execution?.lastNodeExecuted || item.failed_node || 'unknown_module'
  ).trim();

  let clientSlug = 'default_client';
  let workflowName = scenarioNameRaw;

  if (scenarioNameRaw.includes('|')) {
    const [prefix, ...rest] = scenarioNameRaw.split('|');
    const cleanedPrefix = prefix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const cleanedRest = rest.join('|').trim();
    if (cleanedPrefix) clientSlug = cleanedPrefix;
    if (cleanedRest) workflowName = cleanedRest;
  }

  const rawError =
    item.error?.message ||
    item.execution?.error?.message ||
    item.execution?.error?.description ||
    'Unspecified Make execution error';

  const errorMessage = String(rawError).replace(/\s+/g, ' ').trim().slice(0, 1000);
  const status = errorMessage.toLowerCase().includes('timeout') ? 'timeout' : 'failed';

  return {
    execution_id: executionId || `make_${Date.now()}`,
    client_slug: clientSlug,
    workflow_id: scenarioId || null,
    workflow_name: workflowName,
    failed_node: failedModule,
    status,
    error_message: errorMessage,
    execution_url: executionUrl || null,
    created_at: new Date().toISOString(),
  };
}
