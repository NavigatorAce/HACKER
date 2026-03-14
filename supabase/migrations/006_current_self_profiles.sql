-- Single table for "Your current self": all profile fields in one place.
-- Run this entire script in Supabase: SQL Editor → New query → paste → Run.
-- After this, the app uses only current_self_profiles (not profiles).
-- WARNING: This drops and recreates profile-related tables; existing data in them will be lost.

-- 0. Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Drop view that depends on branch_answers
DROP VIEW IF EXISTS session_with_answers CASCADE;

-- 2. Drop dependent tables (order matters: references first)
DROP TABLE IF EXISTS branch_answers;
DROP TABLE IF EXISTS dialogue_sessions;
DROP TABLE IF EXISTS future_branches;

-- 3. Drop trigger and function that write to profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 4. Drop old profile tables so we can recreate
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS current_self_profiles;

-- 5. Create the single "your current self" table with all fields
-- gender: 'male' | 'female' | 'other'
CREATE TABLE current_self_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gender TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  status TEXT,
  university TEXT NOT NULL DEFAULT '',
  major TEXT NOT NULL DEFAULT '',
  job TEXT NOT NULL DEFAULT '',
  age INTEGER NOT NULL DEFAULT 30,
  life_stage TEXT NOT NULL DEFAULT 'exploring',
  personality_traits TEXT[] DEFAULT '{}',
  goals TEXT NOT NULL DEFAULT '',
  fears TEXT NOT NULL DEFAULT '',
  current_struggles TEXT NOT NULL DEFAULT '',
  additional_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 6. RLS for current_self_profiles
ALTER TABLE current_self_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own current self profile" ON current_self_profiles;
CREATE POLICY "Users can manage own current self profile"
  ON current_self_profiles FOR ALL USING (auth.uid() = user_id);

-- 7. Trigger: create a row in current_self_profiles for every new sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.current_self_profiles (user_id, age, life_stage, goals, fears, current_struggles)
    VALUES (NEW.id, 30, 'exploring', '', '', '')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Recreate dependent tables (reference current_self_profiles)
CREATE TABLE future_branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES current_self_profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  age_at_future INTEGER NOT NULL,
  one_liner TEXT NOT NULL,
  core_values TEXT[] DEFAULT '{}',
  signature_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, slug)
);

CREATE TABLE dialogue_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES current_self_profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branch_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES dialogue_sessions(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES future_branches(id) ON DELETE CASCADE,
  branch_slug TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE future_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialogue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view branches for own profile" ON future_branches;
DROP POLICY IF EXISTS "Users can insert branches for own profile" ON future_branches;
CREATE POLICY "Users can view branches for own profile"
  ON future_branches FOR SELECT
  USING (EXISTS (SELECT 1 FROM current_self_profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can insert branches for own profile"
  ON future_branches FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM current_self_profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own sessions" ON dialogue_sessions;
CREATE POLICY "Users can manage own sessions"
  ON dialogue_sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage answers for own sessions" ON branch_answers;
CREATE POLICY "Users can manage answers for own sessions"
  ON branch_answers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM dialogue_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_future_branches_profile_id ON future_branches(profile_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_sessions_user_id ON dialogue_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_sessions_created_at ON dialogue_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branch_answers_session_id ON branch_answers(session_id);
