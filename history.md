# Conversation History

Date: 2026-05-13  
Workspace: `Z:\CongThien\Temp\gen-blog\gen-blog`  
Project: Generate Content App / ContentAI

## Purpose

This file compacts the planning conversation for the next development phase. It captures the requirement analysis, decisions already approved, design direction, and the implementation plan file that was created.

## Original Input

The user provided `requirement.md` describing the next phase:

- Email/password authentication.
- Store user information: name, email, password concept, phone.
- Manage user credits.
- Track credit consumption history.
- Charge credit per workflow step:
  - short content: `0.2` credit per step.
  - medium content: `0.4` credit per step.
  - long content: `1.0` credit per step.
- Store generated content plus workflow inputs/outputs.
- Integrate generated image storage with Cloudflare R2 later.
- Target stack from the requirement: Next.js, Postgres, Prisma, Cloudflare R2, Vercel.

## Current Repository Context

The repo is already a Next.js app using:

- `next@16.2.0`
- `react@19.2.4`
- Supabase packages:
  - `@supabase/ssr`
  - `@supabase/supabase-js`
- Current Supabase schema in `supabase/schema.sql`.
- Existing workflow UI in `app/page.tsx`.
- Existing server actions in `app/actions.ts`.
- Existing profile/settings flow in `app/settings/*`.
- Existing draft/history flow in `app/history/*`.

Important current tables:

- `profiles`
- `drafts`

Current workflow already has these conceptual steps:

1. `outline`
2. `image_idea`
3. `content_generation`
4. `image_generation`, currently only generating three image prompt options
5. `save`

Git status during planning showed:

- `requirement.md` is untracked.
- `docs/` was created for the plan file.
- No implementation code was changed during planning.

## Key Decisions Approved

### Database And Architecture

Decision: keep Supabase for now.

The user chose the lightweight portability target:

- Keep current Supabase Auth and Supabase Postgres.
- Do not introduce Prisma in this phase.
- Design app data so it can migrate more easily to external Postgres later.
- Use a layered MVP architecture:
  - server actions
  - services
  - repositories
  - Supabase client

Recommended server structure:

```txt
lib/server/
  auth/
    currentUser.ts
  credits/
    costs.ts
  repositories/
    profileRepository.ts
    creditRepository.ts
    workflowRepository.ts
    draftRepository.ts
  security/
    hash.ts
  services/
    accountService.ts
    creditService.ts
    workflowService.ts
    draftService.ts
```

### Authentication

Decision: Supabase Auth handles email/password.

Important clarification:

- The app supports password login.
- The app must not store raw passwords or password hashes in app tables.
- User-facing profile data should store `name`, `email`, `phone`, and `role`.

### Credit Rules

Decisions:

- New users receive `10` default credits.
- The initial credit grant must be written to `credit_transactions`.
- Admin credit management is for a later phase.
- The current phase may prepare schema support for `admin_grant`, but should not build admin UI.
- Credit is checked before calling AI.
- Credit is charged only after a workflow step succeeds.
- Failed AI attempts do not charge credit.
- Retry after failure is free unless the retry succeeds.
- Regenerating an already successful step charges credit again if the new attempt succeeds.

Credit cost per successful workflow step:

- `short`: `0.2`
- `medium`: `0.4`
- `long`: `1.0`

### Workflow Step History

Decision: store full input and output for each workflow step.

Each persisted step should include:

- `workflow_id`
- `user_id`
- `step_key`
- `attempt_number`
- `status`
- `input_snapshot`
- `output_snapshot`
- `input_hash`
- `output_hash`
- `error_message`
- `credit_cost`
- `credit_transaction_id`

### Hashing And Auditability

Decision: use HMAC-SHA256 with a server secret.

Do not use simple `hash(user_id)`. Use a server-only secret:

- `APP_HASH_SECRET`

Hash intent:

- Improve auditability.
- Detect out-of-band changes to saved payloads.
- Avoid treating hashes as authorization.

Authorization must still rely on:

- `user_id`
- Supabase Auth
- RLS or server-side checks

Suggested hash inputs:

```txt
user_id + workflow_id + step_key + attempt_number + canonical_payload_json
```

### Image Scope

Decision: do not generate or upload images in this MVP.

For now:

- Step 4 stores only three image prompt options.
- Cloudflare R2 is out of scope for this phase.
- Schema can remain extensible for future assets.

### Admin Scope

Decision: admin credit management is a later phase.

This phase should not include:

- Admin add-credit screen.
- Admin dashboard.
- Manual credit grant UI.

## Approved Design Summary

The approved design is `Layered MVP`.

High-level flow:

1. User signs up or signs in with Supabase Auth.
2. App ensures `profiles` and `credit_accounts` exist.
3. New user receives `10` credits via `initial_grant`.
4. User runs a workflow step.
5. App checks credit balance before calling AI.
6. If balance is insufficient, AI is not called.
7. If AI fails, save failed attempt and do not charge.
8. If AI succeeds, save full input/output, generate hashes, charge credit atomically, and link the credit transaction to the step.
9. Saving final content creates a `drafts` row linked to `workflow_id`.

The current `app/actions.ts` should become thinner. Business rules should move into service files.

## Planned Database Objects

Profile changes:

- Add `name`
- Add `email`
- Add `phone`
- Add `role`

New tables:

- `credit_accounts`
- `credit_transactions`
- `workflows`
- `workflow_steps`

Drafts change:

- Add nullable `workflow_id`

Important indexes:

- `credit_transactions(user_id, created_at)`
- `workflows(user_id, created_at)`
- `workflow_steps(workflow_id, step_key, attempt_number)`
- `drafts(workflow_id)`

Important DB function:

- `initialize_credit_account`
- `record_successful_workflow_step`

The successful-step function should atomically:

1. Lock the credit account row.
2. Verify balance.
3. Insert the successful workflow step.
4. Update balance.
5. Insert the credit transaction.
6. Link transaction back to the workflow step.

## Implementation Plan File

The implementation plan was created here:

```txt
docs/superpowers/plans/2026-05-13-credit-workflow-layered-mvp.md
```

The plan includes 12 tasks:

1. Add Postgres schema for credits and workflows.
2. Add environment and core types.
3. Add hash and credit cost utilities.
4. Add current user and account initialization services.
5. Add auth pages and actions.
6. Add credit repository and service.
7. Add workflow repository.
8. Add workflow service and move AI step orchestration.
9. Add draft repository and service.
10. Update generator UI for workflow id and balance.
11. Update settings and history UI.
12. Final verification.

The plan was self-reviewed for:

- requirement coverage,
- placeholder scan,
- type consistency,
- scope boundaries,
- concurrency risk around credit charging.

## Files Created During Planning

Created:

```txt
docs/superpowers/plans/2026-05-13-credit-workflow-layered-mvp.md
history.md
```

Previously untracked:

```txt
requirement.md
```

## Next Recommended Step

Implementation has not started yet.

Recommended execution mode:

1. Use subagent-driven development if available.
2. Implement one task at a time from the plan.
3. Review after each task.
4. Keep changes surgical.
5. Run `npm run build` after meaningful TypeScript changes.

If continuing inline, start with Task 1 from:

```txt
docs/superpowers/plans/2026-05-13-credit-workflow-layered-mvp.md
```

## Important Constraints

Follow project rules from `AGENTS.md`:

- Think before coding.
- Always provide a `[PLAN]` before edits.
- Keep changes simple and surgical.
- Do not touch more than necessary.
- For multi-file edits, ask before modifying more than 3 files at once.
- Define success criteria and verify.

Do not implement out-of-scope items in the MVP:

- Prisma.
- Admin credit management UI.
- Cloudflare R2.
- Payments.
- Full provider abstraction.
- Major UI redesign.
