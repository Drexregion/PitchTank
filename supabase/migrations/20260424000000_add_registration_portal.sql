-- Event questions (admin-defined per event)
CREATE TABLE IF NOT EXISTS event_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'textarea' | 'image' | 'url'
  required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read event_questions" ON event_questions;
CREATE POLICY "Public read event_questions" ON event_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth write event_questions" ON event_questions;
CREATE POLICY "Auth write event_questions" ON event_questions FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Applicant submissions
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  applicant_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  answers JSONB NOT NULL DEFAULT '{}',    -- { [question_id]: answer_string }
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert applications" ON applications;
CREATE POLICY "Public insert applications" ON applications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Auth read applications" ON applications;
CREATE POLICY "Auth read applications" ON applications FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth update applications" ON applications;
CREATE POLICY "Auth update applications" ON applications FOR UPDATE
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
