-- Rename profile_name to gender (run this if you already have current_self_profiles with profile_name).
-- Skip this if you are running 006 from scratch (006 now creates the table with gender).

ALTER TABLE current_self_profiles
  RENAME COLUMN profile_name TO gender;
