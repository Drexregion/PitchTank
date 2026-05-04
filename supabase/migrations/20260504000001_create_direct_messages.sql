CREATE TABLE public.direct_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_id      TEXT NOT NULL,
  recipient_id   TEXT NOT NULL,
  sender_name    TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  text           TEXT NOT NULL,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dm_conversation_idx ON public.direct_messages
  (event_id, sender_id, recipient_id, created_at ASC);

CREATE INDEX dm_recipient_unread_idx ON public.direct_messages
  (event_id, recipient_id, is_read) WHERE is_read = false;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Only sender or recipient can read their messages
CREATE POLICY "dm_select" ON public.direct_messages FOR SELECT
  USING (sender_id = auth.uid()::text OR recipient_id = auth.uid()::text);

-- Only the authenticated sender can insert
CREATE POLICY "dm_insert" ON public.direct_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid()::text);

-- Only recipient can mark messages as read
CREATE POLICY "dm_update_read" ON public.direct_messages FOR UPDATE
  USING (recipient_id = auth.uid()::text)
  WITH CHECK (recipient_id = auth.uid()::text);
