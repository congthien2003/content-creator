# Hono API MVP Design

## Purpose

Build a standalone Hono API for the Gen Blog product so web, mobile, and future external clients can run content-generation workflows through one backend surface.

The MVP focuses on a complete demo flow:

- Clients authenticate with an App API Key.
- The system uses one OpenRouter API key managed by the product.
- Each workflow step can override the model.
- If a step does not choose a model, the API uses the app default model.
- The API records enough request history to debug, demo, and measure usage.

## Assumptions

- OpenRouter is the only AI provider in the MVP.
- Users do not enter their own AI provider keys in this phase.
- The product owner provides and manages `OPENROUTER_API_KEY`.
- Mobile and web clients call the same API contract.
- Existing Next.js UI remains the dashboard surface.
- Hono runs as a separate API surface, not as a replacement for the current UI.

## Non-Goals

- No billing or credit system.
- No user-supplied AI provider keys.
- No multi-provider implementation.
- No automatic OpenRouter model catalog sync.
- No complex workflow builder.
- No public marketplace or third-party developer portal.

These can be added after the MVP proves the full flow.

## Architecture

```txt
Next.js Dashboard
Mobile App
External Client
   |
   | Authorization: Bearer app_xxx
   v
Hono API
   |
   | Resolve app, default model, and requested step model
   v
OpenRouter
   |
   v
Model Response
   |
   v
Hono API stores generation log and returns result
```

## API Principles

- Version every endpoint under `/v1`.
- Use `Authorization: Bearer <app_api_key>` for client authentication.
- Return JSON for all success and error responses.
- Keep request contracts explicit and stable for mobile clients.
- Let each request choose a `model`.
- Fall back to the app default model when `model` is omitted.
- Use OpenRouter internally, but avoid leaking provider-specific implementation details unless needed.

## Authentication

The API has two authentication contexts:

- External clients use App API Keys for workflow execution.
- Dashboard users use the existing authenticated session for key and settings management.

The exact dashboard session integration can follow the current Supabase SSR auth pattern during implementation.

### External Client Auth

Clients authenticate with an App API Key:

```http
Authorization: Bearer app_live_xxxxxxxxx
```

API keys are shown once when created. The server stores only:

- `key_hash`
- `key_prefix`
- `status`
- `last_used_at`

The raw key is never stored.

### Invalid Key Behavior

Invalid, revoked, or missing keys return:

```json
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "Invalid or missing API key."
  }
}
```

## Model Resolution

Each generation request resolves the model in this order:

1. Use `model` from the request body when present.
2. Use the app `default_model`.
3. Use the system fallback model from environment config.

System fallback:

```txt
OPENROUTER_DEFAULT_MODEL=openai/gpt-5.2
```

Resolved model is always saved in `generation_logs.model`.

## Workflow Steps

The MVP supports these workflow steps:

| Step | Purpose |
| --- | --- |
| `outline` | Generate a content outline from a topic. |
| `image_idea` | Generate one visual concept from a topic and outline. |
| `image_prompts` | Generate three image prompts from a topic and image idea. |
| `content` | Generate final Vietnamese marketing content from workflow inputs. |

The API should validate required fields per step.

## Endpoints

### Health Check

```http
GET /v1/health
```

Response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### Run Workflow Step

```http
POST /v1/workflows/run-step
Authorization: Bearer app_live_xxxxxxxxx
Content-Type: application/json
```

Request:

```json
{
  "workflowStep": "outline",
  "model": "google/gemini-2.5-flash",
  "input": {
    "topic": "AI marketing cho spa"
  }
}
```

`model` is optional.

Response:

```json
{
  "success": true,
  "data": {
    "workflowStep": "outline",
    "model": "google/gemini-2.5-flash",
    "output": "..."
  },
  "meta": {
    "requestId": "gen_123",
    "logged": true
  }
}
```

### Create App API Key

This endpoint is called from the authenticated dashboard, not from external clients.

```http
POST /v1/app-api-keys
```

Auth:

- Requires dashboard session auth.
- Does not accept App API Key auth.

Request:

```json
{
  "name": "Mobile demo key"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "key_123",
    "name": "Mobile demo key",
    "keyPrefix": "app_live_abcd",
    "apiKey": "app_live_abcdxxxxxxxx"
  }
}
```

`apiKey` appears only in this response.

### Revoke App API Key

```http
DELETE /v1/app-api-keys/:id
```

Auth:

- Requires dashboard session auth.
- Does not accept App API Key auth.

Response:

```json
{
  "success": true,
  "data": {
    "id": "key_123",
    "status": "revoked"
  }
}
```

### Get App Settings

```http
GET /v1/app-settings
```

Auth:

- Requires dashboard session auth.
- Does not accept App API Key auth.

Response:

```json
{
  "success": true,
  "data": {
    "defaultModel": "openai/gpt-5.2"
  }
}
```

### Update App Settings

```http
PATCH /v1/app-settings
```

Auth:

- Requires dashboard session auth.
- Does not accept App API Key auth.

Request:

```json
{
  "defaultModel": "google/gemini-2.5-flash"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "defaultModel": "google/gemini-2.5-flash"
  }
}
```

## Step Input Contracts

### `outline`

```json
{
  "workflowStep": "outline",
  "input": {
    "topic": "AI marketing cho spa"
  }
}
```

Required:

- `input.topic`

### `image_idea`

```json
{
  "workflowStep": "image_idea",
  "input": {
    "topic": "AI marketing cho spa",
    "outline": "..."
  }
}
```

Required:

- `input.topic`
- `input.outline`

### `image_prompts`

```json
{
  "workflowStep": "image_prompts",
  "input": {
    "topic": "AI marketing cho spa",
    "imageIdea": "..."
  }
}
```

Required:

- `input.topic`
- `input.imageIdea`

### `content`

```json
{
  "workflowStep": "content",
  "model": "openai/gpt-5.2",
  "input": {
    "topic": "AI marketing cho spa",
    "platform": "facebook",
    "postLength": "medium",
    "postType": "promotional",
    "outline": "...",
    "imageIdea": "...",
    "useIcons": true
  }
}
```

Required:

- `input.topic`
- `input.platform`
- `input.postLength`
- `input.postType`
- `input.outline`
- `input.imageIdea`

Optional:

- `input.useIcons`

## Response Format

All successful responses use:

```json
{
  "success": true,
  "data": {}
}
```

Responses may include `meta`:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "gen_123"
  }
}
```

All errors use:

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Missing required field: input.topic."
  }
}
```

## Error Codes

| Code | HTTP Status | Meaning |
| --- | ---: | --- |
| `unauthorized` | 401 | Missing, invalid, or revoked API key. |
| `validation_error` | 400 | Request body is missing required fields. |
| `model_required` | 400 | No request model, app default, or system fallback exists. |
| `ai_provider_error` | 502 | OpenRouter failed or returned an invalid response. |
| `internal_error` | 500 | Unexpected server error. |

## Data Model

### `apps`

Represents one API application.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `owner_user_id` | uuid | Dashboard user that owns the app. |
| `name` | text | Display name. |
| `default_model` | text | Optional default OpenRouter model. |
| `created_at` | timestamptz | Created timestamp. |
| `updated_at` | timestamptz | Updated timestamp. |

### `app_api_keys`

Stores App API Keys.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `app_id` | uuid | References `apps.id`. |
| `name` | text | Display name. |
| `key_prefix` | text | First visible key segment. |
| `key_hash` | text | Hashed raw key. |
| `status` | text | `active` or `revoked`. |
| `last_used_at` | timestamptz | Updated after successful API use. |
| `created_at` | timestamptz | Created timestamp. |

### `generation_logs`

Stores each workflow execution.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `app_id` | uuid | References `apps.id`. |
| `api_key_id` | uuid | References `app_api_keys.id`. |
| `workflow_step` | text | One of the supported workflow steps. |
| `model` | text | Resolved OpenRouter model. |
| `input` | jsonb | Request input payload. |
| `output` | text | Generated output, when successful. |
| `status` | text | `success` or `error`. |
| `error_code` | text | Error code, when failed. |
| `created_at` | timestamptz | Created timestamp. |

## Environment Variables

```txt
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=openai/gpt-5.2
APP_API_KEY_SECRET=
```

`APP_API_KEY_SECRET` is used when hashing or deriving key verification data.

## Security Requirements

- Never expose `OPENROUTER_API_KEY` to clients.
- Never store raw App API Keys.
- Return the raw App API Key only once during creation.
- Keep dashboard session auth separate from external App API Key auth.
- Support key revocation.
- Keep request logs useful, but avoid storing unnecessary secrets.
- Validate request shape before calling OpenRouter.

## Testing Strategy

MVP verification should cover:

- Health endpoint returns `ok`.
- Missing API key returns `401`.
- Invalid API key returns `401`.
- Revoked API key returns `401`.
- Valid API key can run `outline`.
- Request model overrides app default model.
- Missing request model uses app default model.
- Missing request model and app default uses system fallback model.
- Missing required step input returns `400`.
- OpenRouter errors return `502`.
- Generation log records resolved model and status.

## Implementation Boundary

This spec only defines the Hono API design. Implementation should be handled in a separate plan before code changes.

The first implementation pass should be limited to:

- Hono API setup.
- OpenRouter generation client.
- App API Key auth middleware.
- `/v1/health`.
- `/v1/workflows/run-step`.
- Minimal app settings and key management endpoints needed for demo.
- Generation logging.

## Acceptance Criteria

The MVP is successful when:

- A client can call the Hono API with an App API Key.
- The API can run all four workflow steps through OpenRouter.
- Each request can choose a model.
- Requests without a model use the configured default.
- Results and failures are logged.
- The same API contract can be used by web and mobile clients.
