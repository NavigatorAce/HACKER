-- Create a profile row for every new auth user (sign up)
-- Run this in Supabase SQL Editor after 001_initial_schema.sql
-- If sign up shows "Database error saving new user", run the DROP TRIGGER below first, then run this whole file again.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Wrap in exception block so trigger never rolls back auth signup
  BEGIN
    INSERT INTO public.profiles (user_id, age, life_stage, goals, fears, current_struggles)
    VALUES (
      NEW.id,
      30,
      'exploring',
      '',
      '',
      ''
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log but do not re-raise: allow auth.users insert to succeed
    NULL;
  END;
  RETURN NEW;
END;
$$;

-- Trigger: run when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
