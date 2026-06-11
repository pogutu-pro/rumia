CREATE TABLE public.feedback (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category  TEXT NOT NULL CHECK (category IN ('suggest_hostel', 'feature_request', 'report_problem', 'general')),
  message   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Students can insert their own feedback
CREATE POLICY "Students can insert own feedback"
  ON public.feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Students can read their own feedback
CREATE POLICY "Students can read own feedback"
  ON public.feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all feedback (for the admin panel)
CREATE POLICY "Admins can read all feedback"
  ON public.feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
