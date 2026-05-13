# Credit Workflow Layered MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authentication-aware credit charging and workflow step history while keeping Supabase as the current database provider and isolating business logic behind service/repository layers.

**Architecture:** Keep Supabase Auth and Supabase Postgres for this version. Move workflow, credit, profile, and draft business rules out of `app/actions.ts` into `lib/server/services/*`, with Supabase-specific reads/writes isolated in `lib/server/repositories/*`. Store full workflow step input/output and HMAC hashes for auditability.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth, Supabase Postgres, SQL/RLS/RPC, Node `crypto`, existing AI client in `lib/ai/client.ts`.

---

## Approved Scope

- Keep Supabase at the current version.
- Design the app data model so it can migrate to an external Postgres database more easily.
- Add a layered server structure: server actions -> services -> repositories -> Supabase.
- Support email/password auth through Supabase Auth.
- Do not store app-level passwords.
- Store user profile fields: `name`, `email`, `phone`, `role`, plus the existing brand fields.
- Create 10 default credits for a new authenticated user.
- Check credit balance before calling AI.
- Charge credit only after a workflow step succeeds.
- Failed AI attempts do not charge credit.
- Regenerated successful attempts charge credit again.
- Store full input/output for each workflow step.
- Store HMAC hashes for workflow step input/output using `APP_HASH_SECRET`.
- Store 3 image prompt options only; do not generate images or upload to Cloudflare R2.
- Keep admin credit management out of this implementation.

## Out Of Scope

- Admin screens for granting credit.
- Payment integration.
- Cloudflare R2 upload.
- Prisma.
- Full auth provider abstraction.
- Major UI redesign.

## File Map

### Create

- `supabase/migrations/20260513_credit_workflow_layered_mvp.sql`
  - Adds profile fields, credit tables, workflow tables, indexes, RLS policies, and atomic RPC helpers.
- `lib/server/auth/currentUser.ts`
  - Gets the authenticated Supabase user and returns normalized auth errors.
- `lib/server/security/hash.ts`
  - Creates canonical JSON and HMAC-SHA256 hashes.
- `lib/server/credits/costs.ts`
  - Defines credit cost by post length.
- `lib/server/repositories/profileRepository.ts`
  - Reads/upserts profile records and role data.
- `lib/server/repositories/creditRepository.ts`
  - Reads credit accounts and calls atomic credit RPC helpers.
- `lib/server/repositories/workflowRepository.ts`
  - Creates workflows, records failed steps, and calls atomic success-step RPC helpers.
- `lib/server/repositories/draftRepository.ts`
  - Owns draft persistence.
- `lib/server/services/accountService.ts`
  - Ensures an authenticated user has a profile and initial credit account.
- `lib/server/services/creditService.ts`
  - Calculates credit cost, checks balance, and charges successful steps.
- `lib/server/services/workflowService.ts`
  - Orchestrates workflow step execution, AI calls, snapshots, hashes, and credit charging.
- `lib/server/services/draftService.ts`
  - Saves workflow drafts through the repository layer.
- `app/auth/actions.ts`
  - Supabase sign in, sign up, and sign out server actions.
- `app/auth/login/page.tsx`
  - Email/password login UI.
- `app/auth/signup/page.tsx`
  - Email/password signup UI.
- `components/credit-balance.tsx`
  - Small client/server-compatible display component for current balance.

### Modify

- `.env.local.example`
  - Add `APP_HASH_SECRET`.
- `lib/types.ts`
  - Add profile, credit, workflow, and action result types.
- `app/actions.ts`
  - Keep exported action names where practical, but delegate to services.
- `app/page.tsx`
  - Store `workflowId`, consume updated action results, show credit errors/balance, and pass workflow id between steps.
- `app/history/actions.ts`
  - Read drafts through `draftRepository` or `draftService`.
- `app/history/page.tsx`
  - Show workflow-linked history data without changing the page's core layout.
- `app/settings/actions.ts`
  - Use `accountService`/`profileRepository`.
- `app/settings/page.tsx`
  - Support `name`, `email`, and `phone` profile fields.
- `components/sidebar.tsx`
  - Add auth/credit affordances without changing navigation structure.
- `package.json`
  - Add a test script only if a test runner is introduced during implementation.

---

## Task 1: Add Postgres Schema For Credits And Workflows

**Files:**
- Create: `supabase/migrations/20260513_credit_workflow_layered_mvp.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260513_credit_workflow_layered_mvp.sql` with this SQL:

```sql
alter table profiles
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists role text not null default 'user';

alter table profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin'));

create table if not exists credit_accounts (
  user_id uuid primary key references profiles(id) on delete cascade,
  balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  topic text not null,
  platform text not null,
  post_length text not null,
  post_type text not null,
  use_icons boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflows_status_check check (status in ('active', 'completed', 'failed'))
);

create table if not exists workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  step_key text not null,
  attempt_number integer not null,
  status text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb,
  input_hash text,
  output_hash text,
  error_message text,
  credit_cost numeric(12, 2) not null default 0,
  credit_transaction_id uuid,
  created_at timestamptz not null default now(),
  constraint workflow_steps_status_check check (status in ('success', 'failed')),
  constraint workflow_steps_step_key_check check (
    step_key in ('outline', 'image_idea', 'content_generation', 'image_generation')
  ),
  constraint workflow_steps_attempt_unique unique (workflow_id, step_key, attempt_number)
);

create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  workflow_id uuid references workflows(id) on delete set null,
  workflow_step_id uuid references workflow_steps(id) on delete set null,
  type text not null,
  amount numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  reason text not null,
  created_by_user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint credit_transactions_type_check check (
    type in ('initial_grant', 'workflow_charge', 'admin_grant', 'adjustment')
  ),
  constraint credit_transactions_amount_nonzero check (amount <> 0)
);

alter table workflow_steps
  add constraint workflow_steps_credit_transaction_fk
  foreign key (credit_transaction_id)
  references credit_transactions(id)
  on delete set null;

alter table drafts
  add column if not exists workflow_id uuid references workflows(id) on delete set null;

create index if not exists credit_transactions_user_created_idx
  on credit_transactions(user_id, created_at desc);

create index if not exists workflows_user_created_idx
  on workflows(user_id, created_at desc);

create index if not exists workflow_steps_workflow_step_attempt_idx
  on workflow_steps(workflow_id, step_key, attempt_number desc);

create index if not exists drafts_workflow_id_idx
  on drafts(workflow_id);

alter table credit_accounts enable row level security;
alter table credit_transactions enable row level security;
alter table workflows enable row level security;
alter table workflow_steps enable row level security;

create policy "Users can view own credit account."
  on credit_accounts for select
  using (auth.uid() = user_id);

create policy "Users can view own credit transactions."
  on credit_transactions for select
  using (auth.uid() = user_id);

create policy "Users can view own workflows."
  on workflows for select
  using (auth.uid() = user_id);

create policy "Users can insert own workflows."
  on workflows for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workflows."
  on workflows for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view own workflow steps."
  on workflow_steps for select
  using (auth.uid() = user_id);

create or replace function initialize_credit_account(p_user_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance numeric(12, 2);
begin
  insert into credit_accounts(user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do nothing;

  select balance into current_balance
  from credit_accounts
  where user_id = p_user_id;

  if not exists (
    select 1
    from credit_transactions
    where user_id = p_user_id and type = 'initial_grant'
  ) then
    insert into credit_transactions(user_id, type, amount, balance_after, reason, created_by_user_id)
    values (p_user_id, 'initial_grant', p_amount, current_balance, 'Initial signup credit grant', p_user_id);
  end if;
end;
$$;

create or replace function record_successful_workflow_step(
  p_user_id uuid,
  p_workflow_id uuid,
  p_step_key text,
  p_attempt_number integer,
  p_input_snapshot jsonb,
  p_output_snapshot jsonb,
  p_input_hash text,
  p_output_hash text,
  p_credit_cost numeric,
  p_reason text
)
returns table(step_id uuid, transaction_id uuid, balance_after numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance numeric(12, 2);
  next_balance numeric(12, 2);
  inserted_step_id uuid;
  inserted_transaction_id uuid;
begin
  select balance into current_balance
  from credit_accounts
  where user_id = p_user_id
  for update;

  if current_balance is null then
    raise exception 'credit_account_not_found';
  end if;

  if current_balance < p_credit_cost then
    raise exception 'insufficient_credit';
  end if;

  next_balance := current_balance - p_credit_cost;

  insert into workflow_steps(
    workflow_id,
    user_id,
    step_key,
    attempt_number,
    status,
    input_snapshot,
    output_snapshot,
    input_hash,
    output_hash,
    credit_cost
  )
  values (
    p_workflow_id,
    p_user_id,
    p_step_key,
    p_attempt_number,
    'success',
    p_input_snapshot,
    p_output_snapshot,
    p_input_hash,
    p_output_hash,
    p_credit_cost
  )
  returning id into inserted_step_id;

  update credit_accounts
  set balance = next_balance,
      updated_at = now()
  where user_id = p_user_id;

  insert into credit_transactions(
    user_id,
    workflow_id,
    workflow_step_id,
    type,
    amount,
    balance_after,
    reason,
    created_by_user_id
  )
  values (
    p_user_id,
    p_workflow_id,
    inserted_step_id,
    'workflow_charge',
    -p_credit_cost,
    next_balance,
    p_reason,
    p_user_id
  )
  returning id into inserted_transaction_id;

  update workflow_steps
  set credit_transaction_id = inserted_transaction_id
  where id = inserted_step_id;

  step_id := inserted_step_id;
  transaction_id := inserted_transaction_id;
  balance_after := next_balance;
  return next;
end;
$$;
```

- [ ] **Step 2: Update the schema snapshot**

Append the same table, index, policy, and function definitions to `supabase/schema.sql` after the existing `drafts` policy block. Keep the existing `profiles` and `drafts` definitions intact, and add the profile/drafts `alter table` statements after those table definitions.

- [ ] **Step 3: Verify SQL syntax locally**

Run:

```powershell
npm run build
```

Expected: the build can still parse the project. SQL itself is applied through the Supabase SQL editor or CLI by the implementer because this repo currently does not define a Supabase CLI script.

---

## Task 2: Add Environment And Core Types

**Files:**
- Modify: `.env.local.example`
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the hash secret example**

Append this line to `.env.local.example`:

```dotenv
APP_HASH_SECRET=replace_with_a_long_random_server_secret
```

- [ ] **Step 2: Add shared domain types**

Add these exports to `lib/types.ts` after the existing types:

```ts
export type UserRole = 'user' | 'admin'

export type CreditTransactionType =
  | 'initial_grant'
  | 'workflow_charge'
  | 'admin_grant'
  | 'adjustment'

export type WorkflowStatus = 'active' | 'completed' | 'failed'
export type WorkflowPersistedStepId =
  | 'outline'
  | 'image_idea'
  | 'content_generation'
  | 'image_generation'
export type WorkflowPersistedStepStatus = 'success' | 'failed'

export interface CreditAccount {
  user_id: string
  balance: number
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  workflow_id: string | null
  workflow_step_id: string | null
  type: CreditTransactionType
  amount: number
  balance_after: number
  reason: string
  created_by_user_id: string | null
  created_at: string
}

export interface Workflow {
  id: string
  user_id: string
  topic: string
  platform: Platform
  post_length: PostLength
  post_type: PostType
  use_icons: boolean
  status: WorkflowStatus
  created_at: string
  updated_at: string
}

export interface WorkflowStepRecord {
  id: string
  workflow_id: string
  user_id: string
  step_key: WorkflowPersistedStepId
  attempt_number: number
  status: WorkflowPersistedStepStatus
  input_snapshot: Record<string, unknown>
  output_snapshot: Record<string, unknown> | null
  input_hash: string | null
  output_hash: string | null
  error_message: string | null
  credit_cost: number
  credit_transaction_id: string | null
  created_at: string
}

export interface WorkflowActionResult<T> {
  success: boolean
  data?: T
  workflowId?: string
  stepId?: string
  balance?: number
  error?: string
}
```

- [ ] **Step 3: Verify TypeScript still compiles**

Run:

```powershell
npm run build
```

Expected: build reaches the existing project compile phase without type errors from `lib/types.ts`.

---

## Task 3: Add Hash And Credit Cost Utilities

**Files:**
- Create: `lib/server/security/hash.ts`
- Create: `lib/server/credits/costs.ts`

- [ ] **Step 1: Create HMAC helper**

Create `lib/server/security/hash.ts`:

```ts
import { createHmac } from 'crypto'

export function canonicalJson(value: unknown) {
  return JSON.stringify(sortJson(value))
}

export function createPayloadHash(input: {
  userId: string
  workflowId: string
  stepKey: string
  attemptNumber: number
  payload: unknown
}) {
  const secret = process.env.APP_HASH_SECRET
  if (!secret) {
    throw new Error('APP_HASH_SECRET is required for workflow payload hashing.')
  }

  const message = [
    input.userId,
    input.workflowId,
    input.stepKey,
    String(input.attemptNumber),
    canonicalJson(input.payload),
  ].join(':')

  return createHmac('sha256', secret).update(message).digest('hex')
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJson((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }

  return value
}
```

- [ ] **Step 2: Create credit cost helper**

Create `lib/server/credits/costs.ts`:

```ts
import type { PostLength } from '@/lib/types'

const CREDIT_COST_BY_POST_LENGTH: Record<PostLength, number> = {
  short: 0.2,
  medium: 0.4,
  long: 1.0,
}

export function getWorkflowStepCreditCost(postLength: PostLength) {
  return CREDIT_COST_BY_POST_LENGTH[postLength]
}
```

- [ ] **Step 3: Verify imports and aliases**

Run:

```powershell
npm run build
```

Expected: build resolves `@/lib/types` and Node `crypto` in server-only files.

---

## Task 4: Add Current User And Account Initialization Services

**Files:**
- Create: `lib/server/auth/currentUser.ts`
- Create: `lib/server/repositories/profileRepository.ts`
- Create: `lib/server/services/accountService.ts`
- Modify: `app/settings/actions.ts`

- [ ] **Step 1: Create current user helper**

Create `lib/server/auth/currentUser.ts`:

```ts
import { createClient } from '@/utils/supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase, user: null, error: 'Bạn cần đăng nhập để tiếp tục.' }
  }

  return { supabase, user, error: null }
}
```

- [ ] **Step 2: Create profile repository**

Create `lib/server/repositories/profileRepository.ts`:

```ts
import type { SupabaseClient, User } from '@supabase/supabase-js'

export async function getProfileById(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  return data
}

export async function upsertProfileFromUser(supabase: SupabaseClient, user: User) {
  const metadata = user.user_metadata ?? {}
  const name = typeof metadata.name === 'string' ? metadata.name : null
  const phone = typeof metadata.phone === 'string' ? metadata.phone : null

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    name,
    email: user.email ?? null,
    phone,
    role: 'user',
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateProfile(
  supabase: SupabaseClient,
  input: {
    userId: string
    name: string
    email: string
    phone: string
    brand_name: string
    brand_voice: string
    core_context: string
  }
) {
  const { error } = await supabase.from('profiles').upsert({
    id: input.userId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    brand_name: input.brand_name,
    brand_voice: input.brand_voice,
    core_context: input.core_context,
  })

  if (error) {
    throw new Error(error.message)
  }
}
```

- [ ] **Step 3: Create account service**

Create `lib/server/services/accountService.ts`:

```ts
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { upsertProfileFromUser } from '@/lib/server/repositories/profileRepository'

export async function ensureUserAccount(supabase: SupabaseClient, user: User) {
  await upsertProfileFromUser(supabase, user)

  const { error } = await supabase.rpc('initialize_credit_account', {
    p_user_id: user.id,
    p_amount: 10,
  })

  if (error) {
    throw new Error(error.message)
  }
}
```

- [ ] **Step 4: Update settings actions**

Modify `app/settings/actions.ts` so `getProfile` and `upsertProfile` use `getCurrentUser`, `ensureUserAccount`, and `updateProfile`. Keep the existing function names so the settings page does not need a full rewrite.

```ts
'use server'

import { getCurrentUser } from '@/lib/server/auth/currentUser'
import { getProfileById, updateProfile } from '@/lib/server/repositories/profileRepository'
import { ensureUserAccount } from '@/lib/server/services/accountService'

export async function getProfile() {
  const { supabase, user } = await getCurrentUser()
  if (!user) return null

  await ensureUserAccount(supabase, user)
  return getProfileById(supabase, user.id)
}

export async function upsertProfile(formData: {
  name: string
  email: string
  phone: string
  brand_name: string
  brand_voice: string
  core_context: string
}) {
  const { supabase, user, error } = await getCurrentUser()
  if (!user) return { success: false, error }

  await ensureUserAccount(supabase, user)
  await updateProfile(supabase, { userId: user.id, ...formData })

  return { success: true }
}
```

- [ ] **Step 5: Verify account initialization compiles**

Run:

```powershell
npm run build
```

Expected: no TypeScript errors from new server modules.

---

## Task 5: Add Auth Pages And Actions

**Files:**
- Create: `app/auth/actions.ts`
- Create: `app/auth/login/page.tsx`
- Create: `app/auth/signup/page.tsx`
- Modify: `components/sidebar.tsx`

- [ ] **Step 1: Create auth actions**

Create `app/auth/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { success: false, error: error.message }
  }

  redirect('/')
}

export async function signUp(formData: FormData) {
  const name = String(formData.get('name') || '')
  const phone = String(formData.get('phone') || '')
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone },
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
```

- [ ] **Step 2: Create login page**

Create `app/auth/login/page.tsx` with a small server form that posts to `signIn`. Include fields named `email` and `password`, a submit button with text `Đăng nhập`, and a link to `/auth/signup`.

- [ ] **Step 3: Create signup page**

Create `app/auth/signup/page.tsx` with a small server form that posts to `signUp`. Include fields named `name`, `phone`, `email`, and `password`, a submit button with text `Tạo tài khoản`, and a link to `/auth/login`.

- [ ] **Step 4: Add auth affordance to sidebar**

Modify `components/sidebar.tsx` to add links for login/signup when no user data is available from the current client context. If client-side user state is not available without extra plumbing, add static links to `/auth/login` and `/auth/signup` in the lower sidebar area and keep the existing navigation untouched.

- [ ] **Step 5: Verify auth pages build**

Run:

```powershell
npm run build
```

Expected: Next builds the new route segments.

---

## Task 6: Add Credit Repository And Service

**Files:**
- Create: `lib/server/repositories/creditRepository.ts`
- Create: `lib/server/services/creditService.ts`

- [ ] **Step 1: Create credit repository**

Create `lib/server/repositories/creditRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getCreditAccount(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('credit_accounts')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getCreditTransactions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}
```

- [ ] **Step 2: Create credit service**

Create `lib/server/services/creditService.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostLength } from '@/lib/types'
import { getWorkflowStepCreditCost } from '@/lib/server/credits/costs'
import { getCreditAccount } from '@/lib/server/repositories/creditRepository'

export async function assertEnoughCreditForStep(
  supabase: SupabaseClient,
  input: { userId: string; postLength: PostLength }
) {
  const cost = getWorkflowStepCreditCost(input.postLength)
  const account = await getCreditAccount(supabase, input.userId)
  const balance = Number(account.balance)

  if (balance < cost) {
    return {
      ok: false,
      cost,
      balance,
      error: `Không đủ credit. Step này cần ${cost} credit, số dư hiện tại là ${balance}.`,
    }
  }

  return { ok: true, cost, balance, error: null }
}
```

- [ ] **Step 3: Verify credit service compiles**

Run:

```powershell
npm run build
```

Expected: no import or type errors in credit modules.

---

## Task 7: Add Workflow Repository

**Files:**
- Create: `lib/server/repositories/workflowRepository.ts`

- [ ] **Step 1: Create workflow repository**

Create `lib/server/repositories/workflowRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Platform,
  PostLength,
  PostType,
  WorkflowPersistedStepId,
} from '@/lib/types'

export async function createWorkflow(
  supabase: SupabaseClient,
  input: {
    userId: string
    topic: string
    platform: Platform
    postLength: PostLength
    postType: PostType
    useIcons: boolean
  }
) {
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      user_id: input.userId,
      topic: input.topic,
      platform: input.platform,
      post_length: input.postLength,
      post_type: input.postType,
      use_icons: input.useIcons,
      status: 'active',
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getWorkflowById(
  supabase: SupabaseClient,
  input: { userId: string; workflowId: string }
) {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', input.workflowId)
    .eq('user_id', input.userId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getNextAttemptNumber(
  supabase: SupabaseClient,
  input: { workflowId: string; stepKey: WorkflowPersistedStepId }
) {
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('attempt_number')
    .eq('workflow_id', input.workflowId)
    .eq('step_key', input.stepKey)
    .order('attempt_number', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return (data?.[0]?.attempt_number ?? 0) + 1
}

export async function recordFailedWorkflowStep(
  supabase: SupabaseClient,
  input: {
    userId: string
    workflowId: string
    stepKey: WorkflowPersistedStepId
    attemptNumber: number
    inputSnapshot: Record<string, unknown>
    inputHash: string
    errorMessage: string
  }
) {
  const { data, error } = await supabase
    .from('workflow_steps')
    .insert({
      workflow_id: input.workflowId,
      user_id: input.userId,
      step_key: input.stepKey,
      attempt_number: input.attemptNumber,
      status: 'failed',
      input_snapshot: input.inputSnapshot,
      input_hash: input.inputHash,
      error_message: input.errorMessage,
      credit_cost: 0,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function recordSuccessfulWorkflowStepWithCharge(
  supabase: SupabaseClient,
  input: {
    userId: string
    workflowId: string
    stepKey: WorkflowPersistedStepId
    attemptNumber: number
    inputSnapshot: Record<string, unknown>
    outputSnapshot: Record<string, unknown>
    inputHash: string
    outputHash: string
    creditCost: number
    reason: string
  }
) {
  const { data, error } = await supabase.rpc('record_successful_workflow_step', {
    p_user_id: input.userId,
    p_workflow_id: input.workflowId,
    p_step_key: input.stepKey,
    p_attempt_number: input.attemptNumber,
    p_input_snapshot: input.inputSnapshot,
    p_output_snapshot: input.outputSnapshot,
    p_input_hash: input.inputHash,
    p_output_hash: input.outputHash,
    p_credit_cost: input.creditCost,
    p_reason: input.reason,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data?.[0]
}
```

- [ ] **Step 2: Verify repository compiles**

Run:

```powershell
npm run build
```

Expected: build resolves workflow repository types and Supabase RPC calls.

---

## Task 8: Add Workflow Service And Move AI Step Orchestration

**Files:**
- Create: `lib/server/services/workflowService.ts`
- Modify: `app/actions.ts`

- [ ] **Step 1: Create workflow service shell**

Create `lib/server/services/workflowService.ts` with these exports:

```ts
import type {
  Platform,
  PostLength,
  PostType,
  WorkflowActionResult,
  WorkflowImageOption,
  WorkflowPersistedStepId,
} from '@/lib/types'
import { generateText } from '@/lib/ai/client'
import { getCurrentUser } from '@/lib/server/auth/currentUser'
import { ensureUserAccount } from '@/lib/server/services/accountService'
import { assertEnoughCreditForStep } from '@/lib/server/services/creditService'
import { createPayloadHash } from '@/lib/server/security/hash'
import {
  createWorkflow,
  getNextAttemptNumber,
  getWorkflowById,
  recordFailedWorkflowStep,
  recordSuccessfulWorkflowStepWithCharge,
} from '@/lib/server/repositories/workflowRepository'

const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
  facebook: 'Viết cho Facebook. Sử dụng emoji phù hợp, đoạn ngắn, dễ đọc trên di động. Có thể kèm Call-to-Action cuối bài.',
  linkedin: 'Viết cho LinkedIn. Giọng chuyên nghiệp, chia sẻ insight ngành, có hook mở đầu hấp dẫn. Sử dụng hashtag cuối bài.',
  blog: 'Viết bài Blog/SEO. Có tiêu đề chính (H1), các tiêu đề phụ (H2/H3), đoạn mở đầu hấp dẫn, nội dung chi tiết, và kết luận.',
  tiktok: 'Viết script/caption cho TikTok. Ngắn gọn, bắt trend, gần gũi giới trẻ. Mở đầu hook mạnh trong 3 giây đầu. Kèm hashtag phù hợp.',
  instagram: 'Viết caption Instagram. Hấp dẫn, có storytelling, emoji sáng tạo, và hashtag liên quan ở cuối.',
  twitter: 'Viết cho Twitter/X. Ngắn gọn, súc tích, có thể dạng thread (đánh số 1/n). Mỗi tweet tối đa 280 ký tự.',
}

const LENGTH_INSTRUCTIONS: Record<PostLength, string> = {
  short: 'Viết ngắn gọn, khoảng 80-120 từ.',
  medium: 'Viết mức độ vừa phải, khoảng 250-350 từ.',
  long: 'Viết bài dài, chi tiết, khoảng 500-700 từ.',
}

const TYPE_INSTRUCTIONS: Record<PostType, string> = {
  promotional: 'Mục đích quảng cáo/bán hàng. Nhấn mạnh lợi ích sản phẩm, tạo urgency, có CTA rõ ràng.',
  educational: 'Mục đích chia sẻ kiến thức. Cung cấp giá trị thực, data/stats nếu có, dễ hiểu.',
  storytelling: 'Mục đích kể chuyện. Có nhân vật, tình huống, cảm xúc, bài học. Tạo kết nối với người đọc.',
  engagement: 'Mục đích tạo tương tác. Đặt câu hỏi mở, tạo poll, khuyến khích bình luận và chia sẻ.',
  announcement: 'Mục đích thông báo/sự kiện. Rõ ràng, highlight thông tin quan trọng (ngày, giờ, địa điểm, link).',
}

export interface WorkflowRunInput {
  workflowId?: string | null
  topic: string
  platform: Platform
  postLength: PostLength
  postType: PostType
  useIcons?: boolean
  outline?: string
  imageIdea?: string
}

async function getOrCreateWorkflow(input: WorkflowRunInput) {
  const { supabase, user, error } = await getCurrentUser()
  if (!user) {
    return { supabase, user: null, workflow: null, error }
  }

  await ensureUserAccount(supabase, user)

  const workflow = input.workflowId
    ? await getWorkflowById(supabase, { userId: user.id, workflowId: input.workflowId })
    : await createWorkflow(supabase, {
        userId: user.id,
        topic: input.topic,
        platform: input.platform,
        postLength: input.postLength,
        postType: input.postType,
        useIcons: input.useIcons ?? true,
      })

  return { supabase, user, workflow, error: null }
}

async function runChargedTextStep<T>(
  stepKey: WorkflowPersistedStepId,
  input: WorkflowRunInput,
  inputSnapshot: Record<string, unknown>,
  buildPrompt: () => string,
  toOutputSnapshot: (raw: string) => { data: T; outputSnapshot: Record<string, unknown> }
): Promise<WorkflowActionResult<T>> {
  try {
    const context = await getOrCreateWorkflow(input)
    if (!context.user || !context.workflow) {
      return { success: false, error: context.error ?? 'Bạn cần đăng nhập để tiếp tục.' }
    }

    const credit = await assertEnoughCreditForStep(context.supabase, {
      userId: context.user.id,
      postLength: input.postLength,
    })
    if (!credit.ok) {
      return { success: false, workflowId: context.workflow.id, balance: credit.balance, error: credit.error }
    }

    const attemptNumber = await getNextAttemptNumber(context.supabase, {
      workflowId: context.workflow.id,
      stepKey,
    })

    const inputHash = createPayloadHash({
      userId: context.user.id,
      workflowId: context.workflow.id,
      stepKey,
      attemptNumber,
      payload: inputSnapshot,
    })

    try {
      const raw = await generateText(buildPrompt())
      const { data, outputSnapshot } = toOutputSnapshot(raw)
      const outputHash = createPayloadHash({
        userId: context.user.id,
        workflowId: context.workflow.id,
        stepKey,
        attemptNumber,
        payload: outputSnapshot,
      })

      const saved = await recordSuccessfulWorkflowStepWithCharge(context.supabase, {
        userId: context.user.id,
        workflowId: context.workflow.id,
        stepKey,
        attemptNumber,
        inputSnapshot,
        outputSnapshot,
        inputHash,
        outputHash,
        creditCost: credit.cost,
        reason: `Workflow step charge: ${stepKey}`,
      })

      return {
        success: true,
        data,
        workflowId: context.workflow.id,
        stepId: saved?.step_id,
        balance: Number(saved?.balance_after ?? credit.balance - credit.cost),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi tạo nội dung.'
      await recordFailedWorkflowStep(context.supabase, {
        userId: context.user.id,
        workflowId: context.workflow.id,
        stepKey,
        attemptNumber,
        inputSnapshot,
        inputHash,
        errorMessage: message,
      })
      return { success: false, workflowId: context.workflow.id, balance: credit.balance, error: message }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi workflow.',
    }
  }
}
```

- [ ] **Step 2: Add outline/image/content/image-options functions**

Append these functions to `lib/server/services/workflowService.ts`:

```ts
export async function runOutlineStep(input: WorkflowRunInput) {
  const inputSnapshot = {
    topic: input.topic,
    platform: input.platform,
    postLength: input.postLength,
    postType: input.postType,
    useIcons: input.useIcons ?? true,
  }

  return runChargedTextStep('outline', input, inputSnapshot, () => {
    return `Tạo dàn ý nội dung marketing bằng tiếng Việt cho chủ đề: "${input.topic}".\n\nYêu cầu:\n- 1 hook mở đầu\n- 3-5 ý chính dạng bullet\n- 1 CTA gợi ý\n- Trả về ngắn gọn, không giải thích.`
  }, raw => ({
    data: raw,
    outputSnapshot: { outline: raw },
  }))
}

export async function runImageIdeaStep(input: WorkflowRunInput) {
  const inputSnapshot = {
    topic: input.topic,
    outline: input.outline,
  }

  return runChargedTextStep('image_idea', input, inputSnapshot, () => {
    return `Tạo 1 ý tưởng hình ảnh chủ đạo cho bài viết tiếng Việt.\n\nChủ đề: ${input.topic}\nDàn ý: ${input.outline}\n\nYêu cầu:\n- 1 concept hình ảnh rõ ràng\n- Mô tả mood/style\n- Mô tả thành phần chính\n- Trả về ngắn gọn.`
  }, raw => ({
    data: raw,
    outputSnapshot: { imageIdea: raw },
  }))
}

export async function runContentStep(input: WorkflowRunInput) {
  const inputSnapshot = {
    topic: input.topic,
    platform: input.platform,
    postLength: input.postLength,
    postType: input.postType,
    outline: input.outline,
    imageIdea: input.imageIdea,
    useIcons: input.useIcons ?? true,
  }

  return runChargedTextStep('content_generation', input, inputSnapshot, () => {
    return `Bạn là một chuyên gia viết nội dung Marketing, SEO và GEO.\n\n## Input workflow\n- Chủ đề: "${input.topic}"\n- Dàn ý: ${input.outline}\n- Ý tưởng hình ảnh: ${input.imageIdea}\n- ${PLATFORM_INSTRUCTIONS[input.platform]}\n- ${LENGTH_INSTRUCTIONS[input.postLength]}\n- ${TYPE_INSTRUCTIONS[input.postType]}\n- Quy tắc icon/emoji: ${input.useIcons ? 'Được phép sử dụng icon/emoji phù hợp ngữ cảnh.' : 'Không sử dụng icon/emoji trong nội dung.'}\n\n## Output\n- Viết hoàn toàn bằng tiếng Việt tự nhiên\n- Trả về trực tiếp nội dung cuối cùng, không giải thích\n- Nếu là blog, dùng markdown heading hợp lý`
  }, raw => ({
    data: raw,
    outputSnapshot: { content: raw },
  }))
}

export async function runImageOptionsStep(input: WorkflowRunInput) {
  const inputSnapshot = {
    topic: input.topic,
    imageIdea: input.imageIdea,
  }

  return runChargedTextStep<WorkflowImageOption[]>('image_generation', input, inputSnapshot, () => {
    return `Dựa trên chủ đề và image idea, tạo đúng 3 prompt ảnh khác nhau để đưa vào công cụ text-to-image.\n\nChủ đề: ${input.topic}\nImage idea: ${input.imageIdea}\n\nĐịnh dạng trả về strict JSON array:\n[{"id":"1","prompt":"..."},{"id":"2","prompt":"..."},{"id":"3","prompt":"..."}]`
  }, raw => {
    const jsonText = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(jsonText) as WorkflowImageOption[]
    if (!Array.isArray(parsed) || parsed.length !== 3) {
      throw new Error('Không parse được 3 image options.')
    }
    return {
      data: parsed,
      outputSnapshot: { imageOptions: parsed },
    }
  })
}
```

- [ ] **Step 3: Refactor server actions to call service functions**

Modify `app/actions.ts` so exported functions delegate:

```ts
export async function generateOutline(input: {
  workflowId?: string | null
  topic: string
  platform: Platform
  postLength: PostLength
  postType: PostType
  useIcons?: boolean
}) {
  return runOutlineStep(input)
}
```

Apply the same pattern for `generateImageIdea`, `generateContentFromWorkflow`, and `generateImages3Options`, passing the extra `outline` and `imageIdea` fields required by each step.

- [ ] **Step 4: Verify workflow service compiles**

Run:

```powershell
npm run build
```

Expected: build surfaces only call-site mismatches in `app/page.tsx`, which Task 10 resolves.

---

## Task 9: Add Draft Repository And Service

**Files:**
- Create: `lib/server/repositories/draftRepository.ts`
- Create: `lib/server/services/draftService.ts`
- Modify: `app/actions.ts`
- Modify: `app/history/actions.ts`

- [ ] **Step 1: Create draft repository**

Create `lib/server/repositories/draftRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Platform, PostLength, WorkflowMetadata } from '@/lib/types'

export async function createDraft(
  supabase: SupabaseClient,
  input: {
    userId: string
    workflowId?: string | null
    topic: string
    content: string
    platform: Platform
    postLength: PostLength
    metadata: WorkflowMetadata
  }
) {
  const { data, error } = await supabase
    .from('drafts')
    .insert({
      user_id: input.userId,
      workflow_id: input.workflowId ?? null,
      topic: input.topic,
      content: input.content,
      platform: input.platform,
      post_length: input.postLength,
      status: 'draft',
      metadata: input.metadata,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function listDrafts(
  supabase: SupabaseClient,
  input: { userId: string; statusFilter?: string }
) {
  let query = supabase
    .from('drafts')
    .select('*')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })

  if (input.statusFilter && input.statusFilter !== 'all') {
    query = query.eq('status', input.statusFilter)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return data || []
}
```

- [ ] **Step 2: Create draft service**

Create `lib/server/services/draftService.ts`:

```ts
import type { Platform, PostLength, WorkflowMetadata } from '@/lib/types'
import { getCurrentUser } from '@/lib/server/auth/currentUser'
import { ensureUserAccount } from '@/lib/server/services/accountService'
import { createDraft, listDrafts } from '@/lib/server/repositories/draftRepository'

export async function saveDraft(input: {
  workflowId?: string | null
  topic: string
  content: string
  platform: Platform
  postLength: PostLength
  metadata: WorkflowMetadata
}) {
  const { supabase, user, error } = await getCurrentUser()
  if (!user) return { success: false, error }

  await ensureUserAccount(supabase, user)
  const draft = await createDraft(supabase, { userId: user.id, ...input })

  return { success: true, draftId: draft.id }
}

export async function getUserDrafts(statusFilter?: string) {
  const { supabase, user } = await getCurrentUser()
  if (!user) return []

  await ensureUserAccount(supabase, user)
  return listDrafts(supabase, { userId: user.id, statusFilter })
}
```

- [ ] **Step 3: Wire actions to draft service**

Modify `saveWorkflowDraft` in `app/actions.ts` to call `saveDraft`. Modify `app/history/actions.ts` to call `getUserDrafts`.

- [ ] **Step 4: Verify draft flow compiles**

Run:

```powershell
npm run build
```

Expected: draft action imports resolve.

---

## Task 10: Update Generator UI For Workflow Id And Balance

**Files:**
- Modify: `app/page.tsx`
- Create: `components/credit-balance.tsx`

- [ ] **Step 1: Create balance component**

Create `components/credit-balance.tsx`:

```tsx
export function CreditBalance({ balance }: { balance: number | null }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">
      Credit: {balance == null ? '—' : balance.toFixed(2)}
    </div>
  )
}
```

- [ ] **Step 2: Add workflow and balance state**

In `app/page.tsx`, add state near the existing workflow state:

```tsx
const [workflowId, setWorkflowId] = useState<string | null>(null)
const [creditBalance, setCreditBalance] = useState<number | null>(null)
```

- [ ] **Step 3: Pass workflow id and config into each action**

Update `runOutline` to call the new action shape:

```tsx
const result = await generateOutline({
  workflowId,
  topic,
  platform,
  postLength,
  postType,
  useIcons,
})
```

After each successful step result:

```tsx
if (result.workflowId) setWorkflowId(result.workflowId)
if (typeof result.balance === 'number') setCreditBalance(result.balance)
```

Apply the same result handling in `runImageIdea`, `runContent`, `runImageOptions`, and `runAll`.

- [ ] **Step 4: Preserve workflow id on draft save**

Update `runSave` to pass `workflowId`:

```tsx
const result = await saveWorkflowDraft({
  workflowId,
  topic,
  content: generatedContent,
  platform,
  postLength,
  metadata: { outline, imageIdea, imageOptions },
})
```

- [ ] **Step 5: Reset workflow id on full reset**

In `handleResetAll`, add:

```tsx
setWorkflowId(null)
setCreditBalance(null)
```

- [ ] **Step 6: Render the balance**

Import `CreditBalance` and place it near the workflow header:

```tsx
<CreditBalance balance={creditBalance} />
```

- [ ] **Step 7: Verify UI compile**

Run:

```powershell
npm run build
```

Expected: `app/page.tsx` compiles with the new action result shape.

---

## Task 11: Update Settings And History UI

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `app/history/page.tsx`

- [ ] **Step 1: Add profile fields to settings**

In `app/settings/page.tsx`, add controlled fields for:

```ts
name
email
phone
```

Submit these fields to `upsertProfile` along with the existing brand fields.

- [ ] **Step 2: Keep history compatible**

In `app/history/page.tsx`, display `workflow_id` when present:

```tsx
{draft.workflow_id && (
  <p className="text-xs text-muted-foreground">Workflow ID: {draft.workflow_id}</p>
)}
```

- [ ] **Step 3: Verify pages compile**

Run:

```powershell
npm run build
```

Expected: settings and history pages compile without type errors.

---

## Task 12: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run lint**

Run:

```powershell
npm run lint
```

Expected: no lint errors from edited files.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual database verification**

Apply `supabase/migrations/20260513_credit_workflow_layered_mvp.sql` to the Supabase project. Then verify:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'credit_accounts',
    'credit_transactions',
    'workflows',
    'workflow_steps'
  );
```

Expected: all four table names are returned.

- [ ] **Step 4: Manual product verification**

Use the app in this order:

1. Sign up with email/password.
2. Open settings and confirm profile fields can be saved.
3. Start with 10 credits.
4. Run a `short` outline step and confirm balance becomes 9.80.
5. Force an AI failure by temporarily using an invalid API key and confirm credit does not decrease.
6. Restore the API key, regenerate the outline, and confirm credit decreases by 0.20.
7. Run image options and confirm three prompts are saved as workflow step output.
8. Save the draft and confirm `drafts.workflow_id` is populated.

Expected: credit ledger, workflow step records, full input/output snapshots, and hashes are present in Supabase.

---

## Self-Review Results

- Spec coverage: covered auth, profile fields, default 10 credits, pre-check before AI, post-success charge, failed retry without charge, regenerate with charge, full input/output storage, HMAC hashes, 3 prompt image options, layered service/repository structure, and Supabase-only current provider.
- Scope check: admin credit management, Cloudflare R2, Prisma, payment, and full provider abstraction are explicitly out of scope.
- Placeholder scan: no unresolved implementation markers remain.
- Type consistency: `workflowId`, `WorkflowPersistedStepId`, `WorkflowActionResult`, `CreditAccount`, and credit transaction types are introduced before use.
- Risk note: the plan uses a Supabase RPC for atomic successful-step recording and credit charging. This keeps balance updates safe under concurrent browser tabs.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-credit-workflow-layered-mvp.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session with checkpoints.

Choose an execution option before implementation starts.
