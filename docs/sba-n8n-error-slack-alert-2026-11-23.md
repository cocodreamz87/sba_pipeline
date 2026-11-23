# n8n Error Alert — Slack Incoming Webhook Payload

Saved 2026-11-23, pasted by Demetrius.
Compact Slack alert for n8n error alerts — client slug, workflow name, failed node, error message, clickable execution URL, without cluttering the ops channel. Pairs with the Global Error Workflow (`sba-n8n-global-error-workflow-2026-11-23.md`).

## 1. Block Kit Payload (n8n HTTP Request node → Slack Incoming Webhook URL)

```json
{
  "text": "[{{ $json.client_slug }}] {{ $json.workflow_name }} failed at {{ $json.failed_node }}",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*n8n Failure Alert* — `{{ $json.client_slug }}`\n*Workflow:* `{{ $json.workflow_name }}` | *Node:* `{{ $json.failed_node }}`\n*Error:* {{ $json.error_message }}"
      },
      "accessory": {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "Open Run"
        },
        "url": "{{ $json.execution_url || 'https://app.n8n.io' }}"
      }
    }
  ]
}
```

## 2. Minimal Text-Only Alternative

```json
{
  "text": ":warning: *[{{ $json.client_slug }}]* `{{ $json.workflow_name }}` failed at `{{ $json.failed_node }}` — {{ $json.error_message }} | <{{ $json.execution_url }}|Execution Log>"
}
```

## Guardrails

- **Keep `text` populated:** Slack uses the top-level `"text"` field for push notifications, unread summaries, and fallback rendering — even when `"blocks"` are present.
- **Guard `execution_url`:** Ensure `execution_url` is a valid `https://` URL (or omit the button / fall back to your n8n base URL) because Slack rejects malformed or empty button URLs with an invalid block error.
