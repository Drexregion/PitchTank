# Database Schema — Pitch Tank

Project: `ccwwdkpafpxfxyuzgmjs` (Pitch Tank) · Region: us-east-1 · Postgres 17

---

## Tables

### `users`
Profile table for authenticated users (linked via `auth_user_id → auth.users.id`).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `auth_user_id` | uuid | NO | — | FK → auth.users.id (unique) |
| `email` | text | NO | — | |
| `first_name` | text | YES | — | |
| `last_name` | text | YES | — | |
| `profile_picture_url` | text | YES | — | Stored in `avatars` bucket |
| `bio` | text | YES | — | |
| `linkedin_url` | text | YES | — | |
| `twitter_url` | text | YES | — | |
| `role` | text | YES | — | `'pitcher'` \| `'sponsor'` \| `'judge'` \| `'member'` |
| `looking_to_connect` | text | YES | — | Private; used for AI match recommendations |
| `is_admin` | boolean | NO | `false` | Platform admin flag |
| `created_at` | timestamptz | YES | `now()` | |
| `updated_at` | timestamptz | YES | `now()` | |

**RLS policies:**
- `users_public_read` — SELECT: public
- `users_owner_write` / `Founder users can update their own data` — UPDATE: own row (`auth_user_id = auth.uid()`)
- `Allow public insert access to founder users` — INSERT: public
- `users_admin_manage` — ALL: `is_platform_admin()`

---

### `events`
Top-level event container for pitch competitions.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | `uuid_generate_v4()` | PK |
| `name` | text | NO | — | |
| `description` | text | YES | — | |
| `start_time` | timestamptz | NO | — | |
| `end_time` | timestamptz | NO | — | |
| `closing_at` | timestamptz | YES | — | Registration deadline |
| `status` | text | NO | `'draft'` | `'draft'` \| `'active'` \| `'closed'` |
| `schedule` | jsonb | YES | — | Agenda items array |
| `registration_questions` | jsonb | NO | `[]` | Array of question objects |
| `snapshot_interval_seconds` | integer | NO | `60` | Price history snapshot frequency |
| `max_price_history_points` | integer | NO | `1000` | Cap on stored price history rows |
| `hide_leaderboard_and_prices` | boolean | NO | `false` | |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**RLS policies:**
- `events_public_read` / `events_view_active` — SELECT: public / active events
- `events_view_participants` — SELECT: enrolled users
- `events_admin_manage` — ALL: `is_platform_admin()`

---

### `applications`
Attendee registrations submitted through the event portal.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `event_id` | uuid | NO | — | FK → events.id |
| `applicant_email` | text | NO | — | |
| `status` | text | NO | `'pending'` | `'pending'` \| `'approved'` \| `'rejected'` |
| `answers` | jsonb | NO | `{}` | Map of question_id → answer |
| `claim_token` | uuid | YES | `gen_random_uuid()` | One-time token sent in confirmation email |
| `claimed_by_user_id` | uuid | YES | — | FK → users.id; set when user claims profile |
| `submitted_at` | timestamptz | YES | `now()` | |
| `reviewed_at` | timestamptz | YES | — | |
| `created_at` | timestamptz | YES | `now()` | |

**RLS policies:**
- `Public insert applications` — INSERT: public
- `applications_read_by_token` — SELECT: unclaimed rows by token
- `applications_read_own_claimed` — SELECT: own claimed application
- `applications_claim` — UPDATE: claim unclaimed approved apps
- `applications_admin_read` / `applications_admin_update` — admin only

---

### `pitches`
Startup pitches within an event; each pitch has an AMM-style share pool.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | `uuid_generate_v4()` | PK |
| `event_id` | uuid | NO | — | FK → events.id |
| `name` | text | NO | — | Company/pitch name |
| `bio` | text | YES | — | Short description |
| `logo_url` | text | YES | — | |
| `pitch_summary` | text | YES | — | |
| `pitch_url` | text | YES | — | Link to deck/video |
| `profile_user_id` | uuid | YES | — | FK → users.id; founder who claimed this pitch |
| `application_id` | uuid | YES | — | FK → applications.id |
| `shares_in_pool` | numeric | NO | `100000` | AMM pool shares |
| `cash_in_pool` | numeric | NO | `1000000` | AMM pool cash |
| `k_constant` | numeric | NO | `100000000000` | AMM constant product k |
| `min_reserve_shares` | numeric | NO | `1000` | Minimum shares kept in pool |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**RLS policies:**
- Multiple overlapping public read policies; admin full access.

---

### `investors`
Attendees participating in the simulated trading game.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | `uuid_generate_v4()` | PK |
| `event_id` | uuid | NO | — | FK → events.id |
| `name` | text | NO | — | Display name |
| `profile_user_id` | uuid | YES | — | FK → users.id |
| `initial_balance` | numeric | NO | `1000000` | Starting play-money |
| `current_balance` | numeric | NO | `1000000` | Current cash balance |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

---

### `investor_holdings`
Current share positions for each investor per pitch.

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `uuid_generate_v4()` |
| `investor_id` | uuid | NO | — (FK → investors.id) |
| `pitch_id` | uuid | NO | — (FK → pitches.id) |
| `shares` | numeric | NO | `0` |
| `cost_basis` | numeric | NO | `0` |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

---

### `trades`
Individual buy/sell transactions.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `event_id` | uuid | NO | FK → events.id |
| `investor_id` | uuid | NO | FK → investors.id |
| `pitch_id` | uuid | NO | FK → pitches.id |
| `type` | text | NO | `'buy'` \| `'sell'` |
| `shares` | numeric | NO | |
| `amount` | numeric | NO | Cash exchanged |
| `price_per_share` | numeric | NO | |
| `note` | text | YES | |
| `created_at` | timestamptz | NO | `now()` |

---

### `price_history`
Periodic AMM price snapshots per pitch.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `event_id` | uuid | NO | FK → events.id |
| `pitch_id` | uuid | NO | FK → pitches.id |
| `price` | numeric | NO | |
| `shares_in_pool` | numeric | NO | |
| `cash_in_pool` | numeric | NO | |
| `source` | text | NO | `'trade'` \| `'snapshot'` |
| `recorded_at` | timestamptz | NO | `now()` |

---

### `chat_messages`
Event-scoped public chat.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `event_id` | uuid | FK → events.id |
| `user_id` | text | auth.uid() as text |
| `display_name` | text | |
| `text` | text | |
| `type` | text | `'message'` \| `'announcement'` |
| `upvotes` | integer | default 0 |
| `created_at` | timestamptz | |

### `chat_upvotes`
| Column | Type |
|---|---|
| `message_id` | uuid (FK → chat_messages.id) |
| `user_id` | text |

---

### `direct_messages`
Private 1-to-1 messages between attendees within an event.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `event_id` | uuid | FK → events.id |
| `sender_id` | text | auth.uid() as text |
| `recipient_id` | text | auth.uid() as text |
| `sender_name` | text | |
| `recipient_name` | text | |
| `text` | text | |
| `is_read` | boolean | default false |
| `created_at` | timestamptz | |

**RLS:** sender and recipient can SELECT; recipient can UPDATE (mark read); INSERT open.

---

### `trades_old` *(legacy)*
Old trades table kept for historical data. Same shape as `trades` but with `founder_id` instead of `pitch_id`. Do not write to this table.

---

## Key Relationships

```
events ──< pitches ──< trades >── investors
       ──< applications        ──< investor_holdings
       ──< investors
       ──< chat_messages
       ──< direct_messages

users ──< investors (profile_user_id)
      ──< pitches   (profile_user_id)
      ──< applications (claimed_by_user_id)
```

---

## Storage Buckets

| Bucket | Access | Notes |
|---|---|---|
| `avatars` | Public read | User profile pictures — path: `{auth_user_id}/avatar.{ext}` |

---

## Helper Functions

| Function | Purpose |
|---|---|
| `is_platform_admin()` | Returns true if current user has `is_admin = true` in `users` |
| `is_enrolled_in_event(event_id)` | Returns true if current user has an investor or pitch row for the event |
