// n8n Global Error Workflow — Normalize Error Payload (Code node)
// Saved 2026-11-23, pasted by Demetrius.
// Parses "client_slug | workflow_name" naming convention (fallback
// 'default_client'), extracts failed node, error message, execution id/url.
// Status 'timeout' if the error mentions timeout, else 'failed'.
const item = $input.first().json;

const workflowNameRaw = String(item.workflow?.name || 'unnamed_workflow').trim();
const workflowId = String(item.workflow?.id || '').trim();
const executionId = String(item.execution?.id || '').trim();
const executionUrl = String(item.execution?.url || '').trim();
const lastNodeExecuted = String(item.execution?.lastNodeExecuted || 'unknown_node').trim();

// Parse "client_slug | workflow_name" convention (fallback to 'default_client')
let clientSlug = 'default_client';
let workflowName = workflowNameRaw;

if (workflowNameRaw.includes('|')) {
  const [prefix, ...rest] = workflowNameRaw.split('|');
  const cleanedPrefix = prefix.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const cleanedRest = rest.join('|').trim();
  if (cleanedPrefix) clientSlug = cleanedPrefix;
  if (cleanedRest) workflowName = cleanedRest;
}

const rawError =
  item.execution?.error?.message ||
  item.execution?.error?.description ||
  item.error?.message ||
  'Unspecified n8n execution error';

const errorMessage = String(rawError).replace(/\s+/g, ' ').trim().slice(0, 1000);
const status = errorMessage.toLowerCase().includes('timeout') ? 'timeout' : 'failed';

return [
  {
    json: {
      execution_id: executionId || `manual_${Date.now()}`,
      client_slug: clientSlug,
      workflow_id: workflowId || null,
      workflow_name: workflowName,
      failed_node: lastNodeExecuted,
      status,
      error_message: errorMessage,
      execution_url: executionUrl || null,
      created_at: new Date().toISOString(),
    },
  },
];
