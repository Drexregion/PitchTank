-- investors.email is redundant — email lives on users via profile_user_id
ALTER TABLE investors DROP COLUMN IF EXISTS email;
