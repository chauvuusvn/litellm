# Laya gateway and classifier

[Laya](https://github.com/NandhaKishorM/laya) serves typed decisions using the System One protocol. LiteLLM exposes its native API at `POST /laya/v1/systemone` and offers Laya under the auto-router's Decision Model classifier

## Start Laya

Install the server in a separate environment from LiteLLM, then start it on a port reachable from the gateway

```bash
python -m pip install 'laya[serve]==0.3.21'
LAYA_HOST=127.0.0.1 LAYA_PORT=8000 LAYA_MODELS=english laya-serve
```

Set `LAYA_API_BASE=http://127.0.0.1:8000` in the gateway environment. If the Laya server requires authentication, set the same `LAYA_API_KEY` on both processes. The server URL must use HTTP or HTTPS and contain no embedded credentials, query, or fragment

## Call the native API

Use a LiteLLM virtual key with access to `laya/english`. The request names the bare checkpoint; LiteLLM uses `laya/english` for authorization and usage logs

```bash
curl http://localhost:4000/laya/v1/systemone \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "english",
    "state": "My invoice has two identical charges",
    "questions": {
      "department": {
        "type": "choice",
        "instructions": "Choose the department that should help",
        "criteria": {
          "billing": "Invoices, payments, and refunds",
          "technical": "Bugs and connectivity problems"
        }
      }
    }
  }'
```

The response preserves Laya's `answers`, `usage`, and `routing` fields. Every request must explicitly choose `english`, `multilingual`, or `typed-decisions`; unknown names and automatic selection are rejected so model permissions match the checkpoint being called. This integration does not expose `/v1/evaluate` or chat completions

## Use Laya as a classifier

Add this router alongside your existing `small-solver` and `large-solver` deployments

```yaml
model_list:
  - model_name: laya-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        classifier_type: jev
        jev_classifier_config:
          provider: laya
          model: english
          timeout_ms: 15000
        tiers:
          SIMPLE: small-solver
          MEDIUM: small-solver
          COMPLEX: large-solver
          REASONING: large-solver
```

In the dashboard, choose Decision Model, then Laya and a checkpoint. `classifier_type: jev` remains the stored type for both Jev and Laya

Omitting `api_base` uses the gateway's `LAYA_API_BASE` and optional `LAYA_API_KEY`. Administrators may instead set `api_base` and optional `api_key` in `jev_classifier_config`; an explicit base without a key is keyless and does not inherit an environment key. Switching providers or changing the saved server URL discards the previous hidden key. Team members can select a centrally configured Laya checkpoint but cannot set connection credentials or URLs

Laya's catalog token prices are zero because self-hosting has no provider API fee. Hosting costs are separate; operators may register their own token rates. Logs use the selected checkpoint, such as `laya/english`, and record the usage returned by Laya. Evaluate classification accuracy on your own prompts before enabling routing
