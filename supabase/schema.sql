-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  brand_name TEXT,
  brand_voice TEXT,
  core_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END;
$$;

-- Create drafts table
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  content TEXT,
  platform TEXT,
  post_length TEXT,
  status TEXT DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS workflow_id UUID;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile." ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Drafts Policies
CREATE POLICY "Users can CRUD own drafts." ON drafts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS credit_accounts (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  platform TEXT NOT NULL,
  post_length TEXT NOT NULL,
  post_type TEXT NOT NULL,
  use_icons BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workflows_status_check CHECK (status IN ('active', 'completed', 'failed'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drafts_workflow_id_fkey'
      AND conrelid = 'public.drafts'::regclass
  ) THEN
    ALTER TABLE drafts
      ADD CONSTRAINT drafts_workflow_id_fkey
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot JSONB,
  input_hash TEXT,
  output_hash TEXT,
  error_message TEXT,
  credit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  credit_transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workflow_steps_status_check CHECK (status IN ('success', 'failed')),
  CONSTRAINT workflow_steps_step_key_check CHECK (
    step_key IN ('outline', 'image_idea', 'content_generation', 'image_generation')
  ),
  CONSTRAINT workflow_steps_attempt_unique UNIQUE (workflow_id, step_key, attempt_number)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  balance_after NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_transactions_type_check CHECK (
    type IN ('initial_grant', 'workflow_charge', 'admin_grant', 'adjustment')
  ),
  CONSTRAINT credit_transactions_amount_nonzero CHECK (amount <> 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_steps_credit_transaction_fk'
      AND conrelid = 'public.workflow_steps'::regclass
  ) THEN
    ALTER TABLE workflow_steps
      ADD CONSTRAINT workflow_steps_credit_transaction_fk
      FOREIGN KEY (credit_transaction_id) REFERENCES credit_transactions(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS credit_transactions_user_created_idx
  ON credit_transactions(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_initial_grant_user_idx
  ON credit_transactions(user_id)
  WHERE type = 'initial_grant';

CREATE INDEX IF NOT EXISTS workflows_user_created_idx
  ON workflows(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workflow_steps_workflow_step_attempt_idx
  ON workflow_steps(workflow_id, step_key, attempt_number DESC);

CREATE INDEX IF NOT EXISTS drafts_workflow_id_idx
  ON drafts(workflow_id);

ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_accounts'
      AND policyname = 'Users can view own credit account.'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own credit account."
        ON credit_accounts
        FOR SELECT
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_transactions'
      AND policyname = 'Users can view own credit transactions.'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own credit transactions."
        ON credit_transactions
        FOR SELECT
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflows'
      AND policyname = 'Users can view own workflows.'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own workflows."
        ON workflows
        FOR SELECT
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflows'
      AND policyname = 'Users can insert own workflows.'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can insert own workflows."
        ON workflows
        FOR INSERT
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflows'
      AND policyname = 'Users can update own workflows.'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can update own workflows."
        ON workflows
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_steps'
      AND policyname = 'Users can view own workflow steps.'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own workflow steps."
        ON workflow_steps
        FOR SELECT
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION initialize_credit_account(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC(12, 2);
BEGIN
  INSERT INTO credit_accounts (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance
  INTO current_balance
  FROM credit_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND type = 'initial_grant'
  ) THEN
    INSERT INTO credit_transactions (
      user_id,
      type,
      amount,
      balance_after,
      reason,
      created_by_user_id
    )
    VALUES (
      p_user_id,
      'initial_grant',
      p_amount,
      current_balance,
      'Initial signup credit grant',
      p_user_id
    )
    ON CONFLICT (user_id) WHERE type = 'initial_grant' DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION record_successful_workflow_step(
  p_user_id UUID,
  p_workflow_id UUID,
  p_step_key TEXT,
  p_attempt_number INTEGER,
  p_input_snapshot JSONB,
  p_output_snapshot JSONB,
  p_input_hash TEXT,
  p_output_hash TEXT,
  p_credit_cost NUMERIC,
  p_reason TEXT
)
RETURNS TABLE(step_id UUID, transaction_id UUID, balance_after NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC(12, 2);
  next_balance NUMERIC(12, 2);
  new_step_id UUID;
  new_transaction_id UUID;
BEGIN
  SELECT balance
  INTO current_balance
  FROM credit_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'credit_account_not_found';
  END IF;

  IF current_balance < p_credit_cost THEN
    RAISE EXCEPTION 'insufficient_credit';
  END IF;

  next_balance := current_balance - p_credit_cost;

  INSERT INTO workflow_steps (
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
  VALUES (
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
  RETURNING id INTO new_step_id;

  UPDATE credit_accounts
  SET balance = next_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (
    user_id,
    workflow_id,
    workflow_step_id,
    type,
    amount,
    balance_after,
    reason,
    created_by_user_id
  )
  VALUES (
    p_user_id,
    p_workflow_id,
    new_step_id,
    'workflow_charge',
    -p_credit_cost,
    next_balance,
    p_reason,
    p_user_id
  )
  RETURNING id INTO new_transaction_id;

  UPDATE workflow_steps
  SET credit_transaction_id = new_transaction_id
  WHERE id = new_step_id;

  RETURN QUERY
  SELECT new_step_id, new_transaction_id, next_balance;
END;
$$;
