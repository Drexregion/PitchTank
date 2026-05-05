-- Drop FK constraint and event_id column from direct_messages.
-- DMs are now global (not scoped to a single event).

ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_event_id_fkey;
ALTER TABLE public.direct_messages DROP COLUMN IF EXISTS event_id;

-- Rebuild indexes without event_id
DROP INDEX IF EXISTS dm_conversation_idx;
DROP INDEX IF EXISTS dm_recipient_unread_idx;

CREATE INDEX dm_pair_idx ON public.direct_messages (sender_id, recipient_id, created_at ASC);
CREATE INDEX dm_pair_reverse_idx ON public.direct_messages (recipient_id, sender_id, created_at ASC);
CREATE INDEX dm_recipient_unread_global_idx ON public.direct_messages (recipient_id, is_read) WHERE is_read = false;
