-- Add user email and name columns to feedback table for admin display
ALTER TABLE public.feedback
  ADD COLUMN user_email TEXT,
  ADD COLUMN user_name TEXT;
