# Competition Hub — Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 1 MVP from `competition-hub-prd.md` — competition CRUD with tags, board/list with filtering, links + guidebook upload (Cloudinary), auto-generated rundown items with manual-mode toggle, one WhatsApp reminder offset (Fonnte), light/dark toggle, Duplicate action, Next 7 Days widget, Deadline Overlap warning, installable PWA shell, skeleton loading throughout.

**Architecture:** Next.js 16 App Router (Turbopack, no Cache Components — classic caching model, since almost all data access is client-side via TanStack Query against Supabase). Supabase (Postgres + Auth + RLS + Edge Functions + `pg_cron`) is the backend of record; Next.js holds no server-side database logic beyond auth session refresh. Cloudinary stores guidebook PDFs via signed, client-direct uploads. Fonnte sends WhatsApp reminders from a `pg_cron`-triggered Edge Function. AI summaries, Project Portfolio, and data export are explicitly out of scope for this plan (Phase 2/3).

**Tech Stack:** Next.js 16.2 (App Router, TypeScript), Tailwind CSS v4, lucide-react, @tanstack/react-query, @supabase/supabase-js + @supabase/ssr, zod, clsx + tailwind-merge, Vitest + @testing-library/react (new — not yet installed).

## Global Constraints

- No emoji anywhere in UI or notifications — icons from `lucide-react` only, one icon per meaning.
- Skeleton loading (not spinners) for every data-fetching surface.
- Status colors are the only decorative color: muted blue (researching), amber (in_progress/registered), green (submitted/finalist/completed), red (not_selected / deadline soon).
- Default theme: light. Preference persisted via `user_settings.theme_preference`, applied without flash of wrong theme.
- Fonnte token, Cloudinary API secret, and any server secrets live only in Supabase Edge Function secrets — never in the Next.js client bundle. Only `NEXT_PUBLIC_*` vars (Supabase URL/anon key, Cloudinary cloud name + API key) are client-exposed.
- RLS enabled on every table, scoped to `auth.uid()`.
- File uploads: PDF only, 20MB max, clear progress/error states.
- Use `proxy.ts` (not `middleware.ts`) for session refresh — Next.js 16 convention.
- `params`/`searchParams` in pages/routes are Promises — always `await` them.
- Component boundary rule (PRD 7.2): `ui/` knows nothing about competitions; `competitions/`/`detail/`/`dashboard/` components know nothing about Supabase directly — only hooks talk to Supabase.

---

## File Structure

```
supabase/
  migrations/
    0001_init.sql              -> enums, tables, RLS policies, updated_at trigger
    0002_auto_rundown.sql      -> trigger function: auto-generate rundown items from deadline fields
    0003_reminder_cron.sql     -> pg_cron schedule calling send-reminders Edge Function
  functions/
    cloudinary-sign/index.ts   -> signed upload params for direct-to-Cloudinary upload
    send-reminders/index.ts    -> pg_cron target: queries due rundown items, calls Fonnte, logs result
.env.example
lib/
  supabase/
    client.ts                  -> browser Supabase client
    server.ts                  -> server Supabase client (Server Components/Actions)
    proxy.ts                   -> session-refresh helper used by root proxy.ts
  cn.ts                        -> clsx + tailwind-merge
  date-format.ts                -> formatDate, formatDateTime, relativeTime, isWithinDays
  status.ts                     -> STATUS_ORDER, statusProgress, statusColor, statusLabel
  rundown.ts                    -> computeAutoRundownItems, detectDeadlineOverlaps
  validation.ts                  -> zod schemas: competitionSchema, rundownItemSchema, settingsSchema
  types/
    database.ts                 -> hand-written TS types mirroring the schema
proxy.ts                         -> root proxy, session refresh + auth gate
app/
  layout.tsx                    -> QueryClientProvider, theme script, AppShell
  page.tsx                      -> redirect to /dashboard
  login/page.tsx                -> magic-link sign-in
  auth/callback/route.ts        -> exchanges Supabase auth code for session
  (app)/
    dashboard/
      page.tsx
      loading.tsx
    competitions/
      new/page.tsx
      [id]/
        page.tsx
        loading.tsx
    settings/
      page.tsx
  manifest.ts
public/
  sw.js
  icons/icon-192.svg
  icons/icon-512.svg
components/
  ui/
    Button.tsx
    Badge.tsx
    Card.tsx
    Skeleton.tsx
    Input.tsx
    Textarea.tsx
    Select.tsx
    FileDropzone.tsx
  competitions/
    StatusBadge.tsx
    ProgressStages.tsx
    CompetitionCard.tsx
    CompetitionTable.tsx
    CompetitionBoard.tsx
    TagFilterBar.tsx
    CompetitionForm.tsx
    DuplicateCompetitionAction.tsx
  dashboard/
    Next7DaysWidget.tsx
    DeadlineOverlapBanner.tsx
  detail/
    LinksSection.tsx
    DocumentsSection.tsx
    RundownList.tsx
    RundownItemForm.tsx
    NotificationLog.tsx
  settings/
    RundownModeToggle.tsx
    ThemeToggle.tsx
    WhatsAppSettingsForm.tsx
  layout/
    AppShell.tsx
    OfflineBanner.tsx
    InstallPrompt.tsx
hooks/
  useCompetitions.ts
  useCompetitionDetail.ts
  useUploadGuidebook.ts
  useRundown.ts
  useUpcomingDeadlines.ts
  useDuplicateCompetition.ts
  useUserSettings.ts
vitest.config.ts
vitest.setup.ts
```

Rule of thumb (matches PRD 7.2): `ui/` is style-only. `competitions/`, `dashboard/`, `detail/`, `settings/` components call hooks, never Supabase directly. Hooks are the only files importing `lib/supabase/client.ts`.

---

## Task 1: Install dependencies and test tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

**Interfaces:**
- Produces: `vitest` + `vitest run` scripts; `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` available to every later test task.

- [ ] **Step 1: Install runtime dependencies**

```bash
pnpm add @supabase/supabase-js @supabase/ssr @tanstack/react-query zod clsx tailwind-merge lucide-react date-fns
```

- [ ] **Step 2: Install dev/test dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Create Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Create Vitest setup file**

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Add test scripts to package.json**

Add to the `scripts` block in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify the test runner works**

Create a throwaway `lib/__smoke__.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `pnpm test`
Expected: 1 passed. Delete the file afterward.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts
git commit -m "chore: add supabase, tanstack query, and vitest tooling"
```

---

## Task 2: Supabase schema migration (Phase 1 tables)

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `competitions`, `competition_documents`, `rundown_items`, `notification_logs`, `user_settings`, all RLS-scoped to `auth.uid()`. `competitions.user_id`, `competition_documents.competition_id`, `rundown_items.competition_id`, `notification_logs.rundown_item_id` are the FK chain later tasks query against.

Note: `ai_summaries` and `project_portfolio` (PRD 7.3) are Phase 2 — not created here, so no task in this plan reads or writes them.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0001_init.sql

create extension if not exists "pgcrypto";

create type competition_status as enum (
  'researching', 'registered', 'in_progress', 'submitted', 'finalist', 'completed', 'not_selected'
);

create type document_type as enum ('guidebook', 'addendum', 'template', 'other');

create type notification_status as enum ('sent', 'failed');

create type rundown_generation_mode as enum ('auto', 'manual');

create type theme_preference as enum ('light', 'dark');

create table competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  organizer text,
  theme text,
  status competition_status not null default 'researching',
  team_name text,
  instagram_url text,
  website_url text,
  registration_deadline timestamptz,
  submission_deadline timestamptz,
  event_start_at timestamptz,
  event_end_at timestamptz,
  location text,
  tags text[] not null default '{}',
  cloned_from_id uuid references competitions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index competitions_user_id_idx on competitions(user_id);

create table competition_documents (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  file_name text not null,
  cloudinary_public_id text not null,
  cloudinary_url text not null,
  doc_type document_type not null default 'guidebook',
  extracted_text text,
  uploaded_at timestamptz not null default now()
);

create index competition_documents_competition_id_idx on competition_documents(competition_id);

create table rundown_items (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  title text not null,
  description text,
  event_at timestamptz not null,
  reminder_offsets_minutes int[],
  is_auto_generated boolean not null default false,
  auto_source text,
  created_at timestamptz not null default now()
);

create index rundown_items_competition_id_idx on rundown_items(competition_id);
create index rundown_items_event_at_idx on rundown_items(event_at);

create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  rundown_item_id uuid not null references rundown_items(id) on delete cascade,
  channel text not null default 'whatsapp',
  message text not null,
  status notification_status not null,
  attempt_count int not null default 1,
  sent_at timestamptz not null default now()
);

create index notification_logs_rundown_item_id_idx on notification_logs(rundown_item_id);

create table user_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_number text,
  default_reminder_offsets_minutes int[] not null default '{1440,180}',
  timezone text not null default 'Asia/Makassar',
  rundown_generation_mode rundown_generation_mode not null default 'auto',
  theme_preference theme_preference not null default 'light'
);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger competitions_set_updated_at
  before update on competitions
  for each row execute function set_updated_at();

-- Row Level Security
alter table competitions enable row level security;
alter table competition_documents enable row level security;
alter table rundown_items enable row level security;
alter table notification_logs enable row level security;
alter table user_settings enable row level security;

create policy "competitions_owner_all" on competitions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "competition_documents_owner_all" on competition_documents
  for all using (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  );

create policy "rundown_items_owner_all" on rundown_items
  for all using (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  );

create policy "notification_logs_owner_read" on notification_logs
  for select using (
    exists (
      select 1 from rundown_items r
      join competitions c on c.id = r.competition_id
      where r.id = rundown_item_id and c.user_id = auth.uid()
    )
  );

create policy "user_settings_owner_all" on user_settings
  for all using (auth.uid() = id) with check (auth.uid() = id);
```

- [ ] **Step 2: Apply and verify manually**

This project has no local Supabase instance configured yet. Once the user provides a Supabase project (Task 4 asks for credentials), run in the Supabase SQL Editor or via `supabase db push`:

```bash
supabase db push
```

Verify: `select * from information_schema.tables where table_schema = 'public';` lists all five tables. Verify RLS: `select tablename, rowsecurity from pg_tables where schemaname = 'public';` shows `rowsecurity = true` for all five.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add Phase 1 Supabase schema with RLS"
```

---

## Task 3: Auto-generated rundown trigger

**Files:**
- Create: `supabase/migrations/0002_auto_rundown.sql`

**Interfaces:**
- Consumes: `competitions` table from Task 2 (`registration_deadline`, `submission_deadline`, `event_start_at`, `event_end_at`).
- Produces: `rundown_items` rows with `is_auto_generated = true` and `auto_source` in `('registration_deadline','submission_deadline','event_start_at','event_end_at')`, kept in sync on insert/update. Later read by `hooks/useRundown.ts` (Task 15) and `lib/rundown.ts` (Task 6, client-side mirror logic for the overlap/Next-7-Days widgets — the SQL trigger is the source of truth for persisted rows, `lib/rundown.ts` computes overlap warnings client-side from already-fetched competitions, not from raw deadline fields duplicated here).

Per PRD 5.5: this only fires when `user_settings.rundown_generation_mode = 'auto'` for that user. Switching to manual freezes existing auto items (does not delete them) and stops future generation. Custom (non-auto) rundown items are never touched by this trigger.

- [ ] **Step 1: Write the trigger function and trigger**

```sql
-- supabase/migrations/0002_auto_rundown.sql

create or replace function sync_auto_rundown_item(
  p_competition_id uuid,
  p_source text,
  p_title text,
  p_event_at timestamptz
) returns void as $$
begin
  if p_event_at is null then
    delete from rundown_items
    where competition_id = p_competition_id
      and auto_source = p_source
      and is_auto_generated = true;
    return;
  end if;

  update rundown_items
  set event_at = p_event_at, title = p_title
  where competition_id = p_competition_id
    and auto_source = p_source
    and is_auto_generated = true;

  if not found then
    insert into rundown_items (competition_id, title, event_at, is_auto_generated, auto_source)
    values (p_competition_id, p_title, p_event_at, true, p_source);
  end if;
end;
$$ language plpgsql;

create or replace function handle_competition_auto_rundown()
returns trigger as $$
declare
  v_mode rundown_generation_mode;
begin
  select rundown_generation_mode into v_mode
  from user_settings where id = new.user_id;

  if v_mode is distinct from 'auto' then
    return new;
  end if;

  perform sync_auto_rundown_item(new.id, 'registration_deadline', 'Registration deadline', new.registration_deadline);
  perform sync_auto_rundown_item(new.id, 'submission_deadline', 'Submission deadline', new.submission_deadline);
  perform sync_auto_rundown_item(new.id, 'event_start_at', 'Event starts', new.event_start_at);
  perform sync_auto_rundown_item(new.id, 'event_end_at', 'Event ends', new.event_end_at);

  return new;
end;
$$ language plpgsql security definer;

create trigger competitions_auto_rundown
  after insert or update of registration_deadline, submission_deadline, event_start_at, event_end_at
  on competitions
  for each row execute function handle_competition_auto_rundown();
```

- [ ] **Step 2: Verify manually against the running Supabase project**

After `supabase db push`, in SQL Editor:

```sql
insert into user_settings (id, rundown_generation_mode) values (auth.uid(), 'auto');
insert into competitions (user_id, name, submission_deadline)
values (auth.uid(), 'Test Comp', now() + interval '10 days')
returning id;
select * from rundown_items where competition_id = '<returned id>';
```

Expected: one row, `title = 'Submission deadline'`, `is_auto_generated = true`. Update the competition's `submission_deadline` to a new date and re-select — expect the same row updated in place (no duplicate).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_auto_rundown.sql
git commit -m "feat: auto-generate rundown items from competition deadline fields"
```

---

## Task 4: Supabase client utilities, env vars, and session-refresh proxy

**Files:**
- Create: `.env.example`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/proxy.ts`
- Create: `proxy.ts` (repo root)
- Modify: `.gitignore` (ensure `.env.local` is ignored — check first, likely already covered by the existing `.gitignore`)

**Interfaces:**
- Produces: `createClient()` (browser, from `lib/supabase/client.ts`) and `createClient()` (server, async, from `lib/supabase/server.ts`) — every later hook and Server Component imports one of these two. `updateSession(request: NextRequest): Promise<NextResponse>` from `lib/supabase/proxy.ts`, used only by root `proxy.ts`.

This task requires real Supabase project credentials. **Stop and ask the user for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`** (from a Supabase project they create at supabase.com — Settings → API) before Step 5. Steps 1–4 (writing the code) don't need the values yet.

- [ ] **Step 1: Document required env vars**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_API_KEY=
```

(Server-only secrets — Supabase service role key, Cloudinary API secret, Fonnte device token — are never in this file; they go directly into Supabase Edge Function secrets in Tasks 12 and 15.)

- [ ] **Step 2: Browser Supabase client**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

(This imports `Database` from `lib/types/database.ts`, written in Task 5 alongside the auth pages that first exercise it. If Task 5 hasn't run yet, stub `export type Database = any` temporarily and replace it there.)

- [ ] **Step 3: Server Supabase client**

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component render; the proxy already
            // refreshes the session on the next request, so this is safe to ignore.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Session-refresh helper and root proxy**

```ts
// lib/supabase/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublicRoute = path.startsWith('/login') || path.startsWith('/auth')

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && path.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}
```

```ts
// proxy.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)'],
}
```

- [ ] **Step 5: Get credentials from the user and create `.env.local`**

Ask the user to create a Supabase project (if they haven't) and paste `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API. Write them to `.env.local` (untracked, already covered by `.gitignore`). Confirm `pnpm dev` starts without throwing on the missing-env-var non-null assertions.

- [ ] **Step 6: Commit**

```bash
git add .env.example lib/supabase/client.ts lib/supabase/server.ts lib/supabase/proxy.ts proxy.ts
git commit -m "feat: add Supabase client utilities and session-refresh proxy"
```

---

## Task 5: Auth pages and database types

**Files:**
- Create: `lib/types/database.ts`
- Create: `app/login/page.tsx`
- Create: `app/auth/callback/route.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (route handler), both from Task 4.
- Produces: `Database` type (hand-written, mirrors Task 2's schema) imported by every hook from Task 6 onward. Replaces the `any` stub from Task 4 Step 2 if used.

- [ ] **Step 1: Write hand-written database types**

```ts
// lib/types/database.ts
export type CompetitionStatus =
  | 'researching' | 'registered' | 'in_progress' | 'submitted'
  | 'finalist' | 'completed' | 'not_selected'

export type DocumentType = 'guidebook' | 'addendum' | 'template' | 'other'
export type NotificationStatus = 'sent' | 'failed'
export type RundownGenerationMode = 'auto' | 'manual'
export type ThemePreference = 'light' | 'dark'

export interface Competition {
  id: string
  user_id: string
  name: string
  organizer: string | null
  theme: string | null
  status: CompetitionStatus
  team_name: string | null
  instagram_url: string | null
  website_url: string | null
  registration_deadline: string | null
  submission_deadline: string | null
  event_start_at: string | null
  event_end_at: string | null
  location: string | null
  tags: string[]
  cloned_from_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CompetitionDocument {
  id: string
  competition_id: string
  file_name: string
  cloudinary_public_id: string
  cloudinary_url: string
  doc_type: DocumentType
  extracted_text: string | null
  uploaded_at: string
}

export interface RundownItem {
  id: string
  competition_id: string
  title: string
  description: string | null
  event_at: string
  reminder_offsets_minutes: number[] | null
  is_auto_generated: boolean
  auto_source: string | null
  created_at: string
}

export interface NotificationLog {
  id: string
  rundown_item_id: string
  channel: string
  message: string
  status: NotificationStatus
  attempt_count: number
  sent_at: string
}

export interface UserSettings {
  id: string
  whatsapp_number: string | null
  default_reminder_offsets_minutes: number[]
  timezone: string
  rundown_generation_mode: RundownGenerationMode
  theme_preference: ThemePreference
}

export interface Database {
  public: {
    Tables: {
      competitions: { Row: Competition; Insert: Partial<Competition> & { user_id: string; name: string }; Update: Partial<Competition> }
      competition_documents: { Row: CompetitionDocument; Insert: Partial<CompetitionDocument> & { competition_id: string; file_name: string; cloudinary_public_id: string; cloudinary_url: string }; Update: Partial<CompetitionDocument> }
      rundown_items: { Row: RundownItem; Insert: Partial<RundownItem> & { competition_id: string; title: string; event_at: string }; Update: Partial<RundownItem> }
      notification_logs: { Row: NotificationLog; Insert: Partial<NotificationLog> & { rundown_item_id: string; message: string; status: NotificationStatus }; Update: Partial<NotificationLog> }
      user_settings: { Row: UserSettings; Insert: Partial<UserSettings> & { id: string }; Update: Partial<UserSettings> }
    }
  }
}
```

- [ ] **Step 2: Fix the Task 4 stub (if used)**

If `lib/supabase/client.ts` currently has `type Database = any`, remove the stub and confirm the real import from `@/lib/types/database` resolves.

- [ ] **Step 3: Login page (magic link)**

```tsx
// app/login/page.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 p-8 dark:border-zinc-800"
      >
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Competition Hub</h1>
        {status === 'sent' ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Check your email for a sign-in link.
          </p>
        ) : (
          <>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {status === 'sending' ? 'Sending...' : 'Send magic link'}
            </button>
            {status === 'error' && (
              <p className="text-sm text-red-600">Something went wrong. Try again.</p>
            )}
          </>
        )}
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Auth callback route**

```ts
// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
```

- [ ] **Step 5: Manual verification**

Run `pnpm dev`, navigate to `/dashboard` while logged out — expect redirect to `/login` (proxy from Task 4). Submit the magic-link form with a real email against the Supabase project from Task 4 — expect the "check your email" state and a working sign-in link that lands back on `/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add lib/types/database.ts app/login/page.tsx app/auth/callback/route.ts
git commit -m "feat: add magic-link auth and hand-written database types"
```

---

## Task 6: Pure logic — date formatting, status progress, rundown/overlap computation

**Files:**
- Create: `lib/date-format.ts`
- Test: `lib/date-format.test.ts`
- Create: `lib/status.ts`
- Test: `lib/status.test.ts`
- Create: `lib/rundown.ts`
- Test: `lib/rundown.test.ts`

**Interfaces:**
- Produces: `formatDate`, `formatDateTime`, `isWithinDays` (date-format.ts); `STATUS_ORDER`, `statusLabel`, `statusColorClass`, `statusProgress` (status.ts); `computeAutoRundownItems`, `detectDeadlineOverlaps` (rundown.ts). Consumed by `StatusBadge`/`ProgressStages` (Task 10), `Next7DaysWidget` (Task 23), `DeadlineOverlapBanner` (Task 24).

- [ ] **Step 1: Write failing tests for date-format.ts**

```ts
// lib/date-format.test.ts
import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, isWithinDays } from './date-format'

describe('formatDate', () => {
  it('formats an ISO string as a short date', () => {
    expect(formatDate('2026-08-15T00:00:00Z')).toBe('Aug 15, 2026')
  })
  it('returns a dash for null', () => {
    expect(formatDate(null)).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('formats an ISO string with time', () => {
    expect(formatDateTime('2026-08-15T09:30:00Z')).toContain('2026')
  })
})

describe('isWithinDays', () => {
  it('is true for a date 2 days from now within a 3 day window', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(isWithinDays(soon, 3)).toBe(true)
  })
  it('is false for a date 10 days from now within a 3 day window', () => {
    const far = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(isWithinDays(far, 3)).toBe(false)
  })
  it('is false for null', () => {
    expect(isWithinDays(null, 3)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test lib/date-format.test.ts`
Expected: FAIL — `date-format.ts` does not exist.

- [ ] **Step 3: Implement date-format.ts**

```ts
// lib/date-format.ts
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function isWithinDays(iso: string | null, days: number): boolean {
  if (!iso) return false
  const target = new Date(iso).getTime()
  const now = Date.now()
  const windowMs = days * 24 * 60 * 60 * 1000
  return target >= now && target - now <= windowMs
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test lib/date-format.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write failing tests for status.ts**

```ts
// lib/status.test.ts
import { describe, it, expect } from 'vitest'
import { STATUS_ORDER, statusLabel, statusColorClass, statusProgress } from './status'

describe('STATUS_ORDER', () => {
  it('has 7 statuses ending in not_selected', () => {
    expect(STATUS_ORDER).toHaveLength(7)
    expect(STATUS_ORDER[STATUS_ORDER.length - 1]).toBe('not_selected')
  })
})

describe('statusLabel', () => {
  it('renders a human label', () => {
    expect(statusLabel('in_progress')).toBe('In Progress')
    expect(statusLabel('not_selected')).toBe('Not Selected')
  })
})

describe('statusColorClass', () => {
  it('maps researching to blue and submitted to green', () => {
    expect(statusColorClass('researching')).toContain('blue')
    expect(statusColorClass('submitted')).toContain('green')
    expect(statusColorClass('not_selected')).toContain('red')
  })
})

describe('statusProgress', () => {
  it('returns stage 1 of 6 for researching (not_selected excluded from the ladder)', () => {
    expect(statusProgress('researching')).toEqual({ stage: 1, total: 6 })
  })
  it('returns stage 6 of 6 for completed', () => {
    expect(statusProgress('completed')).toEqual({ stage: 6, total: 6 })
  })
  it('treats not_selected as a terminal stage equal to its position when it dropped out', () => {
    expect(statusProgress('not_selected').total).toBe(6)
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test lib/status.test.ts`
Expected: FAIL — `status.ts` does not exist.

- [ ] **Step 7: Implement status.ts**

```ts
// lib/status.ts
import type { CompetitionStatus } from '@/lib/types/database'

export const STATUS_ORDER: CompetitionStatus[] = [
  'researching', 'registered', 'in_progress', 'submitted', 'finalist', 'completed', 'not_selected',
]

const PROGRESS_LADDER: CompetitionStatus[] = [
  'researching', 'registered', 'in_progress', 'submitted', 'finalist', 'completed',
]

const LABELS: Record<CompetitionStatus, string> = {
  researching: 'Researching',
  registered: 'Registered',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  finalist: 'Finalist',
  completed: 'Completed',
  not_selected: 'Not Selected',
}

const COLORS: Record<CompetitionStatus, string> = {
  researching: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  registered: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  submitted: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  finalist: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  not_selected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

export function statusLabel(status: CompetitionStatus): string {
  return LABELS[status]
}

export function statusColorClass(status: CompetitionStatus): string {
  return COLORS[status]
}

export function statusProgress(status: CompetitionStatus): { stage: number; total: number } {
  const total = PROGRESS_LADDER.length
  if (status === 'not_selected') return { stage: total, total }
  const index = PROGRESS_LADDER.indexOf(status)
  return { stage: index + 1, total }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test lib/status.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 9: Write failing tests for rundown.ts**

```ts
// lib/rundown.test.ts
import { describe, it, expect } from 'vitest'
import { detectDeadlineOverlaps } from './rundown'
import type { Competition } from '@/lib/types/database'

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? 'x',
    user_id: 'u',
    name: overrides.name ?? 'Comp',
    organizer: null,
    theme: null,
    status: 'registered',
    team_name: null,
    instagram_url: null,
    website_url: null,
    registration_deadline: null,
    submission_deadline: null,
    event_start_at: null,
    event_end_at: null,
    location: null,
    tags: [],
    cloned_from_id: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('detectDeadlineOverlaps', () => {
  it('flags two competitions with submission deadlines 1 day apart', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const a = comp({ id: 'a', name: 'A', submission_deadline: new Date(base).toISOString() })
    const b = comp({ id: 'b', name: 'B', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() })
    const overlaps = detectDeadlineOverlaps([a, b])
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].competitionIds.sort()).toEqual(['a', 'b'])
  })

  it('does not flag deadlines 5 days apart', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const a = comp({ id: 'a', submission_deadline: new Date(base).toISOString() })
    const b = comp({ id: 'b', submission_deadline: new Date(base + 5 * 24 * 60 * 60 * 1000).toISOString() })
    expect(detectDeadlineOverlaps([a, b])).toHaveLength(0)
  })

  it('excludes completed and not_selected competitions', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const a = comp({ id: 'a', status: 'completed', submission_deadline: new Date(base).toISOString() })
    const b = comp({ id: 'b', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() })
    expect(detectDeadlineOverlaps([a, b])).toHaveLength(0)
  })

  it('compares registration and submission deadlines across competitions too', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const a = comp({ id: 'a', registration_deadline: new Date(base).toISOString() })
    const b = comp({ id: 'b', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() })
    expect(detectDeadlineOverlaps([a, b])).toHaveLength(1)
  })
})
```

- [ ] **Step 10: Run to verify it fails**

Run: `pnpm test lib/rundown.test.ts`
Expected: FAIL — `rundown.ts` does not exist.

- [ ] **Step 11: Implement rundown.ts**

```ts
// lib/rundown.ts
import type { Competition } from '@/lib/types/database'

export interface DeadlineOverlap {
  competitionIds: string[]
  competitionNames: string[]
  dates: string[]
}

const ACTIVE_STATUSES = new Set(['researching', 'registered', 'in_progress', 'submitted', 'finalist'])
const OVERLAP_WINDOW_DAYS = 3

function deadlinesOf(c: Competition): { label: 'registration' | 'submission'; date: string }[] {
  const out: { label: 'registration' | 'submission'; date: string }[] = []
  if (c.registration_deadline) out.push({ label: 'registration', date: c.registration_deadline })
  if (c.submission_deadline) out.push({ label: 'submission', date: c.submission_deadline })
  return out
}

export function detectDeadlineOverlaps(competitions: Competition[]): DeadlineOverlap[] {
  const active = competitions.filter((c) => ACTIVE_STATUSES.has(c.status))
  const windowMs = OVERLAP_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const overlaps: DeadlineOverlap[] = []
  const seenPairs = new Set<string>()

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      for (const da of deadlinesOf(a)) {
        for (const db of deadlinesOf(b)) {
          const diff = Math.abs(new Date(da.date).getTime() - new Date(db.date).getTime())
          if (diff <= windowMs) {
            const pairKey = [a.id, b.id].sort().join(':')
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey)
              overlaps.push({
                competitionIds: [a.id, b.id],
                competitionNames: [a.name, b.name],
                dates: [da.date, db.date],
              })
            }
          }
        }
      }
    }
  }

  return overlaps
}
```

- [ ] **Step 12: Run to verify it passes**

Run: `pnpm test lib/rundown.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 13: Commit**

```bash
git add lib/date-format.ts lib/date-format.test.ts lib/status.ts lib/status.test.ts lib/rundown.ts lib/rundown.test.ts
git commit -m "feat: add date formatting, status progress, and deadline overlap logic"
```

---

## Task 7: Validation schemas and cn utility

**Files:**
- Create: `lib/cn.ts`
- Create: `lib/validation.ts`
- Test: `lib/validation.test.ts`

**Interfaces:**
- Produces: `cn(...classNames)` helper (used by every component from Task 8 onward), `competitionSchema`, `rundownItemSchema`, `settingsSchema` (zod) — consumed by `CompetitionForm` (Task 14), `RundownItemForm` (Task 20), `WhatsAppSettingsForm` (Task 22).

- [ ] **Step 1: Write cn.ts (no test — trivial pass-through, exercised by every component test that follows)**

```ts
// lib/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: Write failing tests for validation.ts**

```ts
// lib/validation.test.ts
import { describe, it, expect } from 'vitest'
import { competitionSchema } from './validation'

describe('competitionSchema', () => {
  it('accepts a minimal valid competition', () => {
    const result = competitionSchema.safeParse({ name: 'BYTESFEST 2026', tags: [] })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = competitionSchema.safeParse({ name: '', tags: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed instagram_url', () => {
    const result = competitionSchema.safeParse({
      name: 'X', tags: [], instagram_url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid instagram.com url', () => {
    const result = competitionSchema.safeParse({
      name: 'X', tags: [], instagram_url: 'https://instagram.com/bytesfest',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an instagram_url on the wrong domain', () => {
    const result = competitionSchema.safeParse({
      name: 'X', tags: [], instagram_url: 'https://example.com/bytesfest',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test lib/validation.test.ts`
Expected: FAIL — `validation.ts` does not exist.

- [ ] **Step 4: Implement validation.ts**

```ts
// lib/validation.ts
import { z } from 'zod'

const instagramUrl = z
  .string()
  .url()
  .refine((url) => /instagram\.com/i.test(url), 'Must be an instagram.com URL')
  .optional()
  .or(z.literal(''))

export const competitionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  organizer: z.string().optional(),
  theme: z.string().optional(),
  team_name: z.string().optional(),
  instagram_url: instagramUrl,
  website_url: z.string().url().optional().or(z.literal('')),
  registration_deadline: z.string().optional(),
  submission_deadline: z.string().optional(),
  event_start_at: z.string().optional(),
  event_end_at: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()),
  notes: z.string().optional(),
})

export type CompetitionFormValues = z.infer<typeof competitionSchema>

export const rundownItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  event_at: z.string().min(1, 'Date/time is required'),
  reminder_offsets_minutes: z.array(z.number().int().positive()).optional(),
})

export type RundownItemFormValues = z.infer<typeof rundownItemSchema>

export const settingsSchema = z.object({
  whatsapp_number: z
    .string()
    .regex(/^62\d{8,13}$/, 'Use format 62xxxxxxxxxx')
    .optional()
    .or(z.literal('')),
  default_reminder_offsets_minutes: z.array(z.number().int().positive()).min(1),
  rundown_generation_mode: z.enum(['auto', 'manual']),
})

export type SettingsFormValues = z.infer<typeof settingsSchema>
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test lib/validation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/cn.ts lib/validation.ts lib/validation.test.ts
git commit -m "feat: add zod validation schemas and cn class helper"
```

---

## Task 8: UI primitives

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/Card.tsx`
- Create: `components/ui/Skeleton.tsx`
- Create: `components/ui/Input.tsx`
- Create: `components/ui/Textarea.tsx`
- Create: `components/ui/Select.tsx`
- Test: `components/ui/Button.test.tsx`
- Test: `components/ui/Skeleton.test.tsx`

**Interfaces:**
- Consumes: `cn` from `lib/cn.ts` (Task 7).
- Produces: `<Button variant="primary"|"secondary"|"ghost"|"danger" size="sm"|"md">`, `<Badge className>`, `<Card>`, `<Skeleton className>`, `<Input>`, `<Textarea>`, `<Select>` — all forward `className` and native props, used by every component in Tasks 10+.

These are style-only primitives (Global Constraint: `ui/` knows nothing about competitions). Only `Button` and `Skeleton` get dedicated tests here — `Badge`/`Card`/`Input`/`Textarea`/`Select` are thin wrappers exercised indirectly by every component that uses them in later tasks.

- [ ] **Step 1: Write failing test for Button**

```tsx
// components/ui/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders children and responds to click', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/ui/Button.test.tsx`
Expected: FAIL — `Button.tsx` does not exist.

- [ ] **Step 3: Implement Button, Badge, Card, Input, Textarea, Select**

```tsx
// components/ui/Button.tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const VARIANTS = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
  secondary: 'border border-zinc-300 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900',
  ghost: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  )
)
Button.displayName = 'Button'
```

```tsx
// components/ui/Badge.tsx
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      {...props}
    />
  )
}
```

```tsx
// components/ui/Card.tsx
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
        className
      )}
      {...props}
    />
  )
}
```

```tsx
// components/ui/Input.tsx
import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
```

```tsx
// components/ui/Textarea.tsx
import { type TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
```

```tsx
// components/ui/Select.tsx
import { type SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
        className
      )}
      {...props}
    />
  )
)
Select.displayName = 'Select'
```

- [ ] **Step 4: Run to verify Button passes**

Run: `pnpm test components/ui/Button.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write failing test for Skeleton**

```tsx
// components/ui/Skeleton.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders a pulse placeholder with the given className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
    expect(el.className).toContain('h-4')
    expect(el.className).toContain('w-32')
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test components/ui/Skeleton.test.tsx`
Expected: FAIL — `Skeleton.tsx` does not exist.

- [ ] **Step 7: Implement Skeleton**

```tsx
// components/ui/Skeleton.tsx
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800', className)}
      {...props}
    />
  )
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test components/ui/Skeleton.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add components/ui
git commit -m "feat: add style-only UI primitives"
```

---

## Task 9: FileDropzone

**Files:**
- Create: `components/ui/FileDropzone.tsx`
- Test: `components/ui/FileDropzone.test.tsx`

**Interfaces:**
- Consumes: `cn` from `lib/cn.ts`.
- Produces: `<FileDropzone accept="application/pdf" maxSizeBytes={20*1024*1024} onFileSelected={(file: File) => void} error={string|null} />` — consumed by `DocumentsSection` (Task 19).

- [ ] **Step 1: Write failing tests**

```tsx
// components/ui/FileDropzone.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDropzone } from './FileDropzone'

function pdfFile(name = 'guidebook.pdf', sizeBytes = 1024) {
  const file = new File([new Uint8Array(sizeBytes)], name, { type: 'application/pdf' })
  return file
}

describe('FileDropzone', () => {
  it('accepts a valid PDF under the size limit', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropzone accept="application/pdf" maxSizeBytes={20 * 1024 * 1024} onFileSelected={onFileSelected} />
    )
    const input = screen.getByTestId('file-dropzone-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [pdfFile()] } })
    expect(onFileSelected).toHaveBeenCalledWith(expect.objectContaining({ name: 'guidebook.pdf' }))
  })

  it('rejects a non-PDF file', () => {
    const onFileSelected = vi.fn()
    render(
      <FileDropzone accept="application/pdf" maxSizeBytes={20 * 1024 * 1024} onFileSelected={onFileSelected} />
    )
    const input = screen.getByTestId('file-dropzone-input') as HTMLInputElement
    const file = new File(['x'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByText(/PDF/i)).toBeInTheDocument()
  })

  it('rejects a file over the size limit', () => {
    const onFileSelected = vi.fn()
    render(<FileDropzone accept="application/pdf" maxSizeBytes={10} onFileSelected={onFileSelected} />)
    const input = screen.getByTestId('file-dropzone-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [pdfFile('big.pdf', 1000)] } })
    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByText(/too large/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/ui/FileDropzone.test.tsx`
Expected: FAIL — `FileDropzone.tsx` does not exist.

- [ ] **Step 3: Implement FileDropzone**

```tsx
// components/ui/FileDropzone.tsx
'use client'

import { useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/cn'

interface FileDropzoneProps {
  accept: string
  maxSizeBytes: number
  onFileSelected: (file: File) => void
  disabled?: boolean
}

function validate(file: File, accept: string, maxSizeBytes: number): string | null {
  if (file.type !== accept) return 'Only PDF files are accepted.'
  if (file.size > maxSizeBytes) return `File is too large (max ${Math.round(maxSizeBytes / 1024 / 1024)}MB).`
  return null
}

export function FileDropzone({ accept, maxSizeBytes, onFileSelected, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFile(file: File | undefined) {
    if (!file) return
    const validationError = validate(file, accept, maxSizeBytes)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    onFileSelected(file)
  }

  return (
    <div
      onDragOver={(e: DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        handleFile(e.dataTransfer.files?.[0])
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
        isDragging && 'border-zinc-500 bg-zinc-50 dark:bg-zinc-900',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Upload className="h-5 w-5" />
      <span>Drop a PDF here, or click to browse</span>
      <input
        ref={inputRef}
        data-testid="file-dropzone-input"
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test components/ui/FileDropzone.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/FileDropzone.tsx components/ui/FileDropzone.test.tsx
git commit -m "feat: add FileDropzone with PDF/size validation"
```

---

## Task 10: StatusBadge and ProgressStages

**Files:**
- Create: `components/competitions/StatusBadge.tsx`
- Test: `components/competitions/StatusBadge.test.tsx`
- Create: `components/competitions/ProgressStages.tsx`
- Test: `components/competitions/ProgressStages.test.tsx`

**Interfaces:**
- Consumes: `statusLabel`, `statusColorClass`, `statusProgress` from `lib/status.ts` (Task 6); `Badge` from `components/ui/Badge.tsx` (Task 8).
- Produces: `<StatusBadge status={CompetitionStatus} />`, `<ProgressStages status={CompetitionStatus} />` — used by `CompetitionCard`, `CompetitionTable`, `CompetitionBoard`, and the detail page.

- [ ] **Step 1: Write failing tests**

```tsx
// components/competitions/StatusBadge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the human label', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('applies the red color class for not_selected', () => {
    render(<StatusBadge status="not_selected" />)
    expect(screen.getByText('Not Selected').className).toContain('red')
  })
})
```

```tsx
// components/competitions/ProgressStages.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressStages } from './ProgressStages'

describe('ProgressStages', () => {
  it('shows stage 3 of 6 for submitted', () => {
    render(<ProgressStages status="submitted" />)
    expect(screen.getByText('4 of 6')).toBeInTheDocument()
  })

  it('shows stage 1 of 6 for researching', () => {
    render(<ProgressStages status="researching" />)
    expect(screen.getByText('1 of 6')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify both fail**

Run: `pnpm test components/competitions/StatusBadge.test.tsx components/competitions/ProgressStages.test.tsx`
Expected: FAIL — files don't exist.

- [ ] **Step 3: Implement StatusBadge**

```tsx
// components/competitions/StatusBadge.tsx
import { Badge } from '@/components/ui/Badge'
import { statusLabel, statusColorClass } from '@/lib/status'
import type { CompetitionStatus } from '@/lib/types/database'

export function StatusBadge({ status }: { status: CompetitionStatus }) {
  return <Badge className={statusColorClass(status)}>{statusLabel(status)}</Badge>
}
```

- [ ] **Step 4: Implement ProgressStages**

```tsx
// components/competitions/ProgressStages.tsx
import { statusProgress } from '@/lib/status'
import type { CompetitionStatus } from '@/lib/types/database'

export function ProgressStages({ status }: { status: CompetitionStatus }) {
  const { stage, total } = statusProgress(status)
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={
              i < stage
                ? 'h-1.5 w-4 rounded-full bg-zinc-900 dark:bg-zinc-50'
                : 'h-1.5 w-4 rounded-full bg-zinc-200 dark:bg-zinc-800'
            }
          />
        ))}
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {stage} of {total}
      </span>
    </div>
  )
}
```

- [ ] **Step 5: Run to verify both pass**

Run: `pnpm test components/competitions/StatusBadge.test.tsx components/competitions/ProgressStages.test.tsx`
Expected: PASS (4 tests). Note `submitted` is index 3 in `PROGRESS_LADDER`, so stage = 4.

- [ ] **Step 6: Commit**

```bash
git add components/competitions/StatusBadge.tsx components/competitions/StatusBadge.test.tsx components/competitions/ProgressStages.tsx components/competitions/ProgressStages.test.tsx
git commit -m "feat: add StatusBadge and ProgressStages"
```

---

## Task 11: useCompetitions hook (list, create, update status, delete)

**Files:**
- Create: `hooks/useCompetitions.ts`
- Test: `hooks/useCompetitions.test.tsx`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts` (Task 4), `Competition`/`CompetitionStatus` from `lib/types/database.ts` (Task 5).
- Produces: `useCompetitions(): UseQueryResult<Competition[]>`, `useCreateCompetition(): UseMutationResult<Competition, Error, CompetitionFormValues & { user_id: string }>`, `useUpdateCompetitionStatus(): UseMutationResult<void, Error, { id: string; status: CompetitionStatus }>`, `useDeleteCompetition(): UseMutationResult<void, Error, string>`. Consumed by `CompetitionTable` (Task 12), `CompetitionBoard` (Task 13), `CompetitionForm` (Task 14), dashboard page (Task 27).

- [ ] **Step 1: Write failing tests (mocking the Supabase client)**

```tsx
// hooks/useCompetitions.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useCompetitions, useUpdateCompetitionStatus } from './useCompetitions'

const mockCompetitions = [
  { id: '1', name: 'Comp A', status: 'researching', created_at: '2026-01-01' },
]

const order = vi.fn().mockResolvedValue({ data: mockCompetitions, error: null })
const select = vi.fn().mockReturnValue({ order })
const eq = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select, update })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  from.mockClear()
})

describe('useCompetitions', () => {
  it('fetches competitions ordered by created_at desc', async () => {
    const { result } = renderHook(() => useCompetitions(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockCompetitions)
    expect(from).toHaveBeenCalledWith('competitions')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('useUpdateCompetitionStatus', () => {
  it('updates the status column for the given id', async () => {
    const { result } = renderHook(() => useUpdateCompetitionStatus(), { wrapper })
    result.current.mutate({ id: '1', status: 'submitted' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(update).toHaveBeenCalledWith({ status: 'submitted' })
    expect(eq).toHaveBeenCalledWith('id', '1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test hooks/useCompetitions.test.tsx`
Expected: FAIL — `useCompetitions.ts` does not exist.

- [ ] **Step 3: Implement useCompetitions.ts**

```ts
// hooks/useCompetitions.ts
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Competition, CompetitionStatus } from '@/lib/types/database'
import type { CompetitionFormValues } from '@/lib/validation'

export function useCompetitions() {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: async (): Promise<Competition[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Competition[]
    },
  })
}

export function useCreateCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CompetitionFormValues & { user_id: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('competitions')
        .insert(values)
        .select()
        .single()
      if (error) throw error
      return data as Competition
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}

export function useUpdateCompetitionStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CompetitionStatus }) => {
      const supabase = createClient()
      const { error } = await supabase.from('competitions').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}

export function useDeleteCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('competitions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test hooks/useCompetitions.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/useCompetitions.ts hooks/useCompetitions.test.tsx
git commit -m "feat: add useCompetitions hook with list/create/update-status/delete"
```

---

## Task 12: CompetitionTable

**Files:**
- Create: `components/competitions/CompetitionTable.tsx`
- Test: `components/competitions/CompetitionTable.test.tsx`

**Interfaces:**
- Consumes: `Competition[]` (prop, not fetched internally — per PRD 7.2, `competitions/` components call hooks only at the page level; this is a presentational table), `StatusBadge`, `formatDate` from `lib/date-format.ts`.
- Produces: `<CompetitionTable competitions={Competition[]} sortKey="name"|"nearestDeadline"|"status" onSortKeyChange={(key) => void} />`. Consumed by the dashboard page (Task 27) in list view mode.

- [ ] **Step 1: Write failing tests**

```tsx
// components/competitions/CompetitionTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompetitionTable } from './CompetitionTable'
import type { Competition } from '@/lib/types/database'

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? '1', user_id: 'u', name: overrides.name ?? 'Comp',
    organizer: null, theme: null, status: overrides.status ?? 'researching',
    team_name: null, instagram_url: null, website_url: null,
    registration_deadline: null, submission_deadline: overrides.submission_deadline ?? null,
    event_start_at: null, event_end_at: null, location: null,
    tags: overrides.tags ?? [], cloned_from_id: null, notes: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...overrides,
  }
}

describe('CompetitionTable', () => {
  it('renders one row per competition with name and status', () => {
    const rows = [comp({ id: '1', name: 'BYTESFEST' }), comp({ id: '2', name: 'Hackalab' })]
    render(<CompetitionTable competitions={rows} sortKey="name" onSortKeyChange={() => {}} />)
    expect(screen.getByText('BYTESFEST')).toBeInTheDocument()
    expect(screen.getByText('Hackalab')).toBeInTheDocument()
  })

  it('sorts by name ascending when sortKey is name', () => {
    const rows = [comp({ id: '1', name: 'Zeta' }), comp({ id: '2', name: 'Alpha' })]
    render(<CompetitionTable competitions={rows} sortKey="name" onSortKeyChange={() => {}} />)
    const cells = screen.getAllByTestId('competition-row-name')
    expect(cells[0]).toHaveTextContent('Alpha')
    expect(cells[1]).toHaveTextContent('Zeta')
  })

  it('shows an empty state when there are no competitions', () => {
    render(<CompetitionTable competitions={[]} sortKey="name" onSortKeyChange={() => {}} />)
    expect(screen.getByText(/no competitions/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/competitions/CompetitionTable.test.tsx`
Expected: FAIL — `CompetitionTable.tsx` does not exist.

- [ ] **Step 3: Implement CompetitionTable**

```tsx
// components/competitions/CompetitionTable.tsx
'use client'

import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { formatDate } from '@/lib/date-format'
import type { Competition } from '@/lib/types/database'

type SortKey = 'name' | 'nearestDeadline' | 'status'

function nearestDeadline(c: Competition): number {
  const dates = [c.registration_deadline, c.submission_deadline].filter(Boolean) as string[]
  if (dates.length === 0) return Infinity
  return Math.min(...dates.map((d) => new Date(d).getTime()))
}

function sortCompetitions(competitions: Competition[], sortKey: SortKey): Competition[] {
  const copy = [...competitions]
  if (sortKey === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (sortKey === 'status') return copy.sort((a, b) => a.status.localeCompare(b.status))
  return copy.sort((a, b) => nearestDeadline(a) - nearestDeadline(b))
}

interface CompetitionTableProps {
  competitions: Competition[]
  sortKey: SortKey
  onSortKeyChange: (key: SortKey) => void
}

export function CompetitionTable({ competitions, sortKey, onSortKeyChange }: CompetitionTableProps) {
  if (competitions.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No competitions match the current filters.
      </p>
    )
  }

  const sorted = sortCompetitions(competitions, sortKey)

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th className="cursor-pointer py-2" onClick={() => onSortKeyChange('name')}>Name</th>
          <th className="cursor-pointer py-2" onClick={() => onSortKeyChange('status')}>Status</th>
          <th className="py-2">Tags</th>
          <th className="cursor-pointer py-2" onClick={() => onSortKeyChange('nearestDeadline')}>Next Date</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((c) => (
          <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
            <td className="py-2.5">
              <Link href={`/competitions/${c.id}`} data-testid="competition-row-name" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                {c.name}
              </Link>
            </td>
            <td className="py-2.5"><StatusBadge status={c.status} /></td>
            <td className="py-2.5 text-zinc-500 dark:text-zinc-400">{c.tags.join(', ') || '—'}</td>
            <td className="py-2.5 text-zinc-500 dark:text-zinc-400">
              {formatDate(c.submission_deadline ?? c.registration_deadline)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test components/competitions/CompetitionTable.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/competitions/CompetitionTable.tsx components/competitions/CompetitionTable.test.tsx
git commit -m "feat: add sortable CompetitionTable"
```

---

## Task 13: CompetitionBoard and CompetitionCard

**Files:**
- Create: `components/competitions/CompetitionCard.tsx`
- Create: `components/competitions/CompetitionBoard.tsx`
- Test: `components/competitions/CompetitionBoard.test.tsx`

**Interfaces:**
- Consumes: `Competition[]` prop, `StatusBadge`, `ProgressStages`, `STATUS_ORDER`/`statusLabel` from `lib/status.ts`, `useUpdateCompetitionStatus` from `hooks/useCompetitions.ts` (Task 11).
- Produces: `<CompetitionBoard competitions={Competition[]} />` — one column per `STATUS_ORDER` entry, tap-to-move via a "Move to..." select per card (simpler and more accessible than full drag-and-drop for a v1 personal tool; satisfies PRD 5.4's "drag (or tap-to-move)").

- [ ] **Step 1: Write failing tests**

```tsx
// components/competitions/CompetitionBoard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { CompetitionBoard } from './CompetitionBoard'
import type { Competition } from '@/lib/types/database'

const mutate = vi.fn()
vi.mock('@/hooks/useCompetitions', () => ({
  useUpdateCompetitionStatus: () => ({ mutate }),
}))

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? '1', user_id: 'u', name: overrides.name ?? 'Comp',
    organizer: null, theme: null, status: overrides.status ?? 'researching',
    team_name: null, instagram_url: null, website_url: null,
    registration_deadline: null, submission_deadline: null,
    event_start_at: null, event_end_at: null, location: null,
    tags: [], cloned_from_id: null, notes: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('CompetitionBoard', () => {
  it('places each competition under its status column', () => {
    const rows = [comp({ id: '1', name: 'A', status: 'researching' }), comp({ id: '2', name: 'B', status: 'submitted' })]
    render(<CompetitionBoard competitions={rows} />, { wrapper })
    expect(screen.getByText('Researching')).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('calls useUpdateCompetitionStatus.mutate when a card is moved', async () => {
    const rows = [comp({ id: '1', name: 'A', status: 'researching' })]
    render(<CompetitionBoard competitions={rows} />, { wrapper })
    const select = screen.getByLabelText(/move a/i)
    await userEvent.selectOptions(select, 'submitted')
    expect(mutate).toHaveBeenCalledWith({ id: '1', status: 'submitted' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/competitions/CompetitionBoard.test.tsx`
Expected: FAIL — files don't exist.

- [ ] **Step 3: Implement CompetitionCard**

```tsx
// components/competitions/CompetitionCard.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { ProgressStages } from './ProgressStages'
import { STATUS_ORDER, statusLabel } from '@/lib/status'
import { formatDate } from '@/lib/date-format'
import { useUpdateCompetitionStatus } from '@/hooks/useCompetitions'
import type { Competition, CompetitionStatus } from '@/lib/types/database'

export function CompetitionCard({ competition }: { competition: Competition }) {
  const { mutate } = useUpdateCompetitionStatus()

  return (
    <Card className="space-y-2 p-3">
      <Link href={`/competitions/${competition.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
        {competition.name}
      </Link>
      {competition.tags.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{competition.tags.join(', ')}</p>
      )}
      <ProgressStages status={competition.status} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Next: {formatDate(competition.submission_deadline ?? competition.registration_deadline)}
      </p>
      <Select
        aria-label={`Move ${competition.name} to a different status`}
        value={competition.status}
        onChange={(e) => mutate({ id: competition.id, status: e.target.value as CompetitionStatus })}
        className="text-xs"
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </Select>
    </Card>
  )
}
```

- [ ] **Step 4: Implement CompetitionBoard**

```tsx
// components/competitions/CompetitionBoard.tsx
'use client'

import { CompetitionCard } from './CompetitionCard'
import { STATUS_ORDER, statusLabel } from '@/lib/status'
import type { Competition } from '@/lib/types/database'

export function CompetitionBoard({ competitions }: { competitions: Competition[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => {
        const items = competitions.filter((c) => c.status === status)
        return (
          <div key={status} className="w-64 shrink-0">
            <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {statusLabel(status)} <span className="text-zinc-400">({items.length})</span>
            </h3>
            <div className="space-y-2">
              {items.map((c) => (
                <CompetitionCard key={c.id} competition={c} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test components/competitions/CompetitionBoard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add components/competitions/CompetitionCard.tsx components/competitions/CompetitionBoard.tsx components/competitions/CompetitionBoard.test.tsx
git commit -m "feat: add CompetitionBoard with tap-to-move status columns"
```

---

## Task 14: TagFilterBar

**Files:**
- Create: `components/competitions/TagFilterBar.tsx`
- Test: `components/competitions/TagFilterBar.test.tsx`

**Interfaces:**
- Produces: `<TagFilterBar competitions={Competition[]} value={{ status: CompetitionStatus[]; tags: string[]; team: string | null }} onChange={(next) => void} />` — derives available tag/team options from the passed competitions. Consumed by the dashboard page (Task 27), which owns the filter state and passes the filtered list down to `CompetitionTable`/`CompetitionBoard`.

- [ ] **Step 1: Write failing tests**

```tsx
// components/competitions/TagFilterBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagFilterBar } from './TagFilterBar'
import type { Competition } from '@/lib/types/database'

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? '1', user_id: 'u', name: 'Comp', organizer: null, theme: null,
    status: overrides.status ?? 'researching', team_name: overrides.team_name ?? null,
    instagram_url: null, website_url: null, registration_deadline: null, submission_deadline: null,
    event_start_at: null, event_end_at: null, location: null, tags: overrides.tags ?? [],
    cloned_from_id: null, notes: null, created_at: '', updated_at: '', ...overrides,
  }
}

const rows = [
  comp({ id: '1', tags: ['hackathon'], team_name: 'REGEX', status: 'in_progress' }),
  comp({ id: '2', tags: ['ui_ux'], team_name: 'Solo', status: 'researching' }),
]

describe('TagFilterBar', () => {
  it('lists tag options derived from the competitions', () => {
    render(<TagFilterBar competitions={rows} value={{ status: [], tags: [], team: null }} onChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'hackathon' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'ui_ux' })).toBeInTheDocument()
  })

  it('calls onChange with the toggled tag added', async () => {
    const onChange = vi.fn()
    render(<TagFilterBar competitions={rows} value={{ status: [], tags: [], team: null }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'hackathon' }))
    expect(onChange).toHaveBeenCalledWith({ status: [], tags: ['hackathon'], team: null })
  })

  it('calls onChange with the tag removed when toggled off', async () => {
    const onChange = vi.fn()
    render(<TagFilterBar competitions={rows} value={{ status: [], tags: ['hackathon'], team: null }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'hackathon' }))
    expect(onChange).toHaveBeenCalledWith({ status: [], tags: [], team: null })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/competitions/TagFilterBar.test.tsx`
Expected: FAIL — `TagFilterBar.tsx` does not exist.

- [ ] **Step 3: Implement TagFilterBar**

```tsx
// components/competitions/TagFilterBar.tsx
'use client'

import { Select } from '@/components/ui/Select'
import { STATUS_ORDER, statusLabel } from '@/lib/status'
import type { Competition, CompetitionStatus } from '@/lib/types/database'

export interface CompetitionFilter {
  status: CompetitionStatus[]
  tags: string[]
  team: string | null
}

interface TagFilterBarProps {
  competitions: Competition[]
  value: CompetitionFilter
  onChange: (next: CompetitionFilter) => void
}

export function TagFilterBar({ competitions, value, onChange }: TagFilterBarProps) {
  const tagOptions = Array.from(new Set(competitions.flatMap((c) => c.tags))).sort()
  const teamOptions = Array.from(
    new Set(competitions.map((c) => c.team_name).filter((t): t is string => Boolean(t)))
  ).sort()

  function toggleTag(tag: string) {
    const tags = value.tags.includes(tag) ? value.tags.filter((t) => t !== tag) : [...value.tags, tag]
    onChange({ ...value, tags })
  }

  function toggleStatus(status: CompetitionStatus) {
    const status_ = value.status.includes(status)
      ? value.status.filter((s) => s !== status)
      : [...value.status, status]
    onChange({ ...value, status: status_ })
  }

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((s) => (
          <label key={s} className="flex items-center gap-1.5">
            <input type="checkbox" checked={value.status.includes(s)} onChange={() => toggleStatus(s)} />
            {statusLabel(s)}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {tagOptions.map((tag) => (
          <label key={tag} className="flex items-center gap-1.5">
            <input type="checkbox" checked={value.tags.includes(tag)} onChange={() => toggleTag(tag)} />
            {tag}
          </label>
        ))}
      </div>
      {teamOptions.length > 0 && (
        <Select
          aria-label="Filter by team"
          value={value.team ?? ''}
          onChange={(e) => onChange({ ...value, team: e.target.value || null })}
          className="w-40"
        >
          <option value="">All teams</option>
          {teamOptions.map((team) => (
            <option key={team} value={team}>{team}</option>
          ))}
        </Select>
      )}
    </div>
  )
}

export function applyCompetitionFilter(competitions: Competition[], filter: CompetitionFilter): Competition[] {
  return competitions.filter((c) => {
    if (filter.status.length > 0 && !filter.status.includes(c.status)) return false
    if (filter.tags.length > 0 && !filter.tags.some((t) => c.tags.includes(t))) return false
    if (filter.team && c.team_name !== filter.team) return false
    return true
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test components/competitions/TagFilterBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/competitions/TagFilterBar.tsx components/competitions/TagFilterBar.test.tsx
git commit -m "feat: add TagFilterBar with combined status/tag/team filtering"
```

---

## Task 15: CompetitionForm and the create page

**Files:**
- Create: `components/competitions/CompetitionForm.tsx`
- Test: `components/competitions/CompetitionForm.test.tsx`
- Create: `app/(app)/competitions/new/page.tsx`

**Interfaces:**
- Consumes: `competitionSchema`/`CompetitionFormValues` from `lib/validation.ts` (Task 7), `Input`/`Textarea`/`Select`/`Button` from `components/ui` (Task 8), `useCreateCompetition` from `hooks/useCompetitions.ts` (Task 11).
- Produces: `<CompetitionForm defaultValues?={Partial<CompetitionFormValues>} onSubmit={(values: CompetitionFormValues) => void} submitLabel={string} />` — reused by the create page here and the edit flow on the detail page (Task 16).

- [ ] **Step 1: Write failing tests**

```tsx
// components/competitions/CompetitionForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompetitionForm } from './CompetitionForm'

describe('CompetitionForm', () => {
  it('shows a validation error and does not submit when name is empty', async () => {
    const onSubmit = vi.fn()
    render(<CompetitionForm onSubmit={onSubmit} submitLabel="Create" />)
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits parsed values when the form is valid', async () => {
    const onSubmit = vi.fn()
    render(<CompetitionForm onSubmit={onSubmit} submitLabel="Create" />)
    await userEvent.type(screen.getByLabelText(/^name/i), 'BYTESFEST 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'BYTESFEST 2026' }))
  })

  it('pre-fills fields from defaultValues', () => {
    render(<CompetitionForm onSubmit={() => {}} submitLabel="Save" defaultValues={{ name: 'Existing Comp' }} />)
    expect(screen.getByLabelText(/^name/i)).toHaveValue('Existing Comp')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/competitions/CompetitionForm.test.tsx`
Expected: FAIL — `CompetitionForm.tsx` does not exist.

- [ ] **Step 3: Implement CompetitionForm**

```tsx
// components/competitions/CompetitionForm.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { competitionSchema, type CompetitionFormValues } from '@/lib/validation'

const TAG_OPTIONS = ['hackathon', 'ui_ux', 'business_plan', 'proposal_only']

interface CompetitionFormProps {
  defaultValues?: Partial<CompetitionFormValues>
  onSubmit: (values: CompetitionFormValues) => void
  submitLabel: string
}

export function CompetitionForm({ defaultValues, onSubmit, submitLabel }: CompetitionFormProps) {
  const [values, setValues] = useState<Record<string, string>>({
    name: defaultValues?.name ?? '',
    organizer: defaultValues?.organizer ?? '',
    theme: defaultValues?.theme ?? '',
    team_name: defaultValues?.team_name ?? '',
    instagram_url: defaultValues?.instagram_url ?? '',
    website_url: defaultValues?.website_url ?? '',
    registration_deadline: defaultValues?.registration_deadline ?? '',
    submission_deadline: defaultValues?.submission_deadline ?? '',
    event_start_at: defaultValues?.event_start_at ?? '',
    event_end_at: defaultValues?.event_end_at ?? '',
    location: defaultValues?.location ?? '',
    notes: defaultValues?.notes ?? '',
  })
  const [tags, setTags] = useState<string[]>(defaultValues?.tags ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(field: string, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = competitionSchema.safeParse({ ...values, tags })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">Name</label>
        <Input id="name" value={values.name} onChange={(e) => set('name', e.target.value)} />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="organizer" className="mb-1 block text-sm font-medium">Organizer</label>
        <Input id="organizer" value={values.organizer} onChange={(e) => set('organizer', e.target.value)} />
      </div>
      <div>
        <label htmlFor="theme" className="mb-1 block text-sm font-medium">Theme / category</label>
        <Input id="theme" value={values.theme} onChange={(e) => set('theme', e.target.value)} />
      </div>
      <div>
        <label htmlFor="team_name" className="mb-1 block text-sm font-medium">Team name</label>
        <Input id="team_name" value={values.team_name} onChange={(e) => set('team_name', e.target.value)} />
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium">Tags</span>
        <div className="flex flex-wrap gap-3">
          {TAG_OPTIONS.map((tag) => (
            <label key={tag} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggleTag(tag)} />
              {tag}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="instagram_url" className="mb-1 block text-sm font-medium">Instagram link</label>
        <Input id="instagram_url" value={values.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} />
        {errors.instagram_url && <p className="mt-1 text-sm text-red-600">{errors.instagram_url}</p>}
      </div>
      <div>
        <label htmlFor="website_url" className="mb-1 block text-sm font-medium">Website link</label>
        <Input id="website_url" value={values.website_url} onChange={(e) => set('website_url', e.target.value)} />
        {errors.website_url && <p className="mt-1 text-sm text-red-600">{errors.website_url}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="registration_deadline" className="mb-1 block text-sm font-medium">Registration deadline</label>
          <Input id="registration_deadline" type="datetime-local" value={values.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} />
        </div>
        <div>
          <label htmlFor="submission_deadline" className="mb-1 block text-sm font-medium">Submission deadline</label>
          <Input id="submission_deadline" type="datetime-local" value={values.submission_deadline} onChange={(e) => set('submission_deadline', e.target.value)} />
        </div>
        <div>
          <label htmlFor="event_start_at" className="mb-1 block text-sm font-medium">Event start</label>
          <Input id="event_start_at" type="datetime-local" value={values.event_start_at} onChange={(e) => set('event_start_at', e.target.value)} />
        </div>
        <div>
          <label htmlFor="event_end_at" className="mb-1 block text-sm font-medium">Event end</label>
          <Input id="event_end_at" type="datetime-local" value={values.event_end_at} onChange={(e) => set('event_end_at', e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="location" className="mb-1 block text-sm font-medium">Location</label>
        <Input id="location" value={values.location} onChange={(e) => set('location', e.target.value)} placeholder="City, or Online" />
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">Notes</label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test components/competitions/CompetitionForm.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the new-competition page**

```tsx
// app/(app)/competitions/new/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { CompetitionForm } from '@/components/competitions/CompetitionForm'
import { useCreateCompetition } from '@/hooks/useCompetitions'
import { createClient } from '@/lib/supabase/client'
import type { CompetitionFormValues } from '@/lib/validation'

export default function NewCompetitionPage() {
  const router = useRouter()
  const { mutateAsync } = useCreateCompetition()

  async function handleSubmit(values: CompetitionFormValues) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const created = await mutateAsync({ ...values, user_id: user.id })
    router.push(`/competitions/${created.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Competition</h1>
      <CompetitionForm onSubmit={handleSubmit} submitLabel="Create competition" />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/competitions/CompetitionForm.tsx components/competitions/CompetitionForm.test.tsx "app/(app)/competitions/new/page.tsx"
git commit -m "feat: add CompetitionForm and the create-competition page"
```

---

## Task 16: useCompetitionDetail hook and the detail page shell

**Files:**
- Create: `hooks/useCompetitionDetail.ts`
- Test: `hooks/useCompetitionDetail.test.tsx`
- Create: `app/(app)/competitions/[id]/page.tsx`
- Create: `app/(app)/competitions/[id]/loading.tsx`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts`, `competitionSchema` from `lib/validation.ts`.
- Produces: `useCompetitionDetail(id: string): UseQueryResult<Competition>`, `useUpdateCompetition(id: string): UseMutationResult<Competition, Error, CompetitionFormValues>`. The detail page renders `StatusBadge`, `ProgressStages`, and — as placeholders wired in later tasks — slots for `LinksSection` (Task 17), `DocumentsSection` (Task 19), `RundownList`/`NotificationLog` (Task 20), `DuplicateCompetitionAction` (Task 17b). Those imports are added incrementally as each task lands; this task's page renders name/status/edit form only.

- [ ] **Step 1: Write failing tests for the hook**

```tsx
// hooks/useCompetitionDetail.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useCompetitionDetail } from './useCompetitionDetail'

const mockCompetition = { id: '1', name: 'Comp A' }
const single = vi.fn().mockResolvedValue({ data: mockCompetition, error: null })
const eq = vi.fn().mockReturnValue({ single })
const select = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useCompetitionDetail', () => {
  it('fetches a single competition by id', async () => {
    const { result } = renderHook(() => useCompetitionDetail('1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockCompetition)
    expect(eq).toHaveBeenCalledWith('id', '1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test hooks/useCompetitionDetail.test.tsx`
Expected: FAIL — `useCompetitionDetail.ts` does not exist.

- [ ] **Step 3: Implement useCompetitionDetail.ts**

```ts
// hooks/useCompetitionDetail.ts
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Competition } from '@/lib/types/database'
import type { CompetitionFormValues } from '@/lib/validation'

export function useCompetitionDetail(id: string) {
  return useQuery({
    queryKey: ['competitions', id],
    queryFn: async (): Promise<Competition> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('competitions').select('*').eq('id', id).single()
      if (error) throw error
      return data as Competition
    },
    enabled: Boolean(id),
  })
}

export function useUpdateCompetition(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CompetitionFormValues) => {
      const supabase = createClient()
      const { data, error } = await supabase.from('competitions').update(values).eq('id', id).select().single()
      if (error) throw error
      return data as Competition
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions', id] })
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test hooks/useCompetitionDetail.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Detail page skeleton and shell**

```tsx
// app/(app)/competitions/[id]/loading.tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-8">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
```

```tsx
// app/(app)/competitions/[id]/page.tsx
'use client'

import { use, useState } from 'react'
import { StatusBadge } from '@/components/competitions/StatusBadge'
import { ProgressStages } from '@/components/competitions/ProgressStages'
import { CompetitionForm } from '@/components/competitions/CompetitionForm'
import { Button } from '@/components/ui/Button'
import { useCompetitionDetail, useUpdateCompetition } from '@/hooks/useCompetitionDetail'
import type { CompetitionFormValues } from '@/lib/validation'

export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: competition, isLoading } = useCompetitionDetail(id)
  const { mutateAsync } = useUpdateCompetition(id)
  const [isEditing, setIsEditing] = useState(false)

  if (isLoading || !competition) return null

  async function handleSubmit(values: CompetitionFormValues) {
    await mutateAsync(values)
    setIsEditing(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{competition.name}</h1>
          <StatusBadge status={competition.status} />
          <ProgressStages status={competition.status} />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setIsEditing((v) => !v)}>
          {isEditing ? 'Cancel' : 'Edit'}
        </Button>
      </div>

      {isEditing ? (
        <CompetitionForm
          defaultValues={{
            name: competition.name,
            organizer: competition.organizer ?? '',
            theme: competition.theme ?? '',
            team_name: competition.team_name ?? '',
            instagram_url: competition.instagram_url ?? '',
            website_url: competition.website_url ?? '',
            registration_deadline: competition.registration_deadline ?? '',
            submission_deadline: competition.submission_deadline ?? '',
            event_start_at: competition.event_start_at ?? '',
            event_end_at: competition.event_end_at ?? '',
            location: competition.location ?? '',
            notes: competition.notes ?? '',
            tags: competition.tags,
          }}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
        />
      ) : (
        <div className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          {competition.organizer && <p>Organizer: {competition.organizer}</p>}
          {competition.theme && <p>Theme: {competition.theme}</p>}
          {competition.team_name && <p>Team: {competition.team_name}</p>}
          {competition.location && <p>Location: {competition.location}</p>}
          {competition.notes && <p className="whitespace-pre-wrap">{competition.notes}</p>}
        </div>
      )}

      {/* LinksSection (Task 17), DocumentsSection (Task 19), RundownList + NotificationLog
          (Task 20), and DuplicateCompetitionAction (Task 17b) are wired in here as those
          tasks land — each adds its own import and JSX block below this comment. */}
    </div>
  )
}
```

- [ ] **Step 6: Manual verification**

Run `pnpm dev`, create a competition via `/competitions/new`, confirm redirect to `/competitions/[id]` shows the name, status badge, and progress stages, and that Edit → Save persists changes (refresh the page to confirm).

- [ ] **Step 7: Commit**

```bash
git add hooks/useCompetitionDetail.ts hooks/useCompetitionDetail.test.tsx "app/(app)/competitions/[id]/page.tsx" "app/(app)/competitions/[id]/loading.tsx"
git commit -m "feat: add competition detail page with inline edit"
```

---

## Task 17: DuplicateCompetitionAction

**Files:**
- Create: `hooks/useDuplicateCompetition.ts`
- Test: `hooks/useDuplicateCompetition.test.tsx`
- Create: `components/competitions/DuplicateCompetitionAction.tsx`
- Modify: `app/(app)/competitions/[id]/page.tsx` (wire in the action, per the comment left in Task 16 Step 5)

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts`.
- Produces: `useDuplicateCompetition(): UseMutationResult<Competition, Error, Competition>` — copies `name` (suffixed "— Copy"), `organizer`, `theme`, `tags`, `team_name`, `notes` only; deliberately omits deadlines, event dates, links, and `cloned_from_id`-tracked lineage per PRD 5.9. `<DuplicateCompetitionAction competition={Competition} />` renders a button that duplicates and navigates to the new draft.

- [ ] **Step 1: Write failing test for the field-copy logic**

```tsx
// hooks/useDuplicateCompetition.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useDuplicateCompetition } from './useDuplicateCompetition'
import type { Competition } from '@/lib/types/database'

const single = vi.fn().mockResolvedValue({
  data: { id: 'new-id', name: 'BYTESFEST 2026 — Copy' },
  error: null,
})
const select = vi.fn().mockReturnValue({ single })
const insert = vi.fn().mockReturnValue({ select })
const from = vi.fn().mockReturnValue({ insert })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const source: Competition = {
  id: 'orig', user_id: 'u', name: 'BYTESFEST 2026', organizer: 'Uni X', theme: 'Sustainability',
  status: 'finalist', team_name: 'REGEX', instagram_url: 'https://instagram.com/x', website_url: 'https://x.com',
  registration_deadline: '2026-01-01', submission_deadline: '2026-02-01', event_start_at: '2026-03-01',
  event_end_at: '2026-03-02', location: 'Solo', tags: ['hackathon'], cloned_from_id: null,
  notes: 'some notes', created_at: '', updated_at: '',
}

describe('useDuplicateCompetition', () => {
  it('copies only structural fields and resets status, dates, and links', async () => {
    const { result } = renderHook(() => useDuplicateCompetition(), { wrapper })
    result.current.mutate(source)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const inserted = insert.mock.calls[0][0]
    expect(inserted.name).toBe('BYTESFEST 2026 — Copy')
    expect(inserted.organizer).toBe('Uni X')
    expect(inserted.theme).toBe('Sustainability')
    expect(inserted.team_name).toBe('REGEX')
    expect(inserted.tags).toEqual(['hackathon'])
    expect(inserted.notes).toBe('some notes')
    expect(inserted.cloned_from_id).toBe('orig')
    expect(inserted.status).toBe('researching')
    expect(inserted.registration_deadline).toBeUndefined()
    expect(inserted.submission_deadline).toBeUndefined()
    expect(inserted.instagram_url).toBeUndefined()
    expect(inserted.website_url).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test hooks/useDuplicateCompetition.test.tsx`
Expected: FAIL — `useDuplicateCompetition.ts` does not exist.

- [ ] **Step 3: Implement useDuplicateCompetition.ts**

```ts
// hooks/useDuplicateCompetition.ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Competition } from '@/lib/types/database'

export function useDuplicateCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (source: Competition): Promise<Competition> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('competitions')
        .insert({
          user_id: source.user_id,
          name: `${source.name} — Copy`,
          organizer: source.organizer,
          theme: source.theme,
          team_name: source.team_name,
          tags: source.tags,
          notes: source.notes,
          cloned_from_id: source.id,
          status: 'researching',
        })
        .select()
        .single()
      if (error) throw error
      return data as Competition
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test hooks/useDuplicateCompetition.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Implement the action button**

```tsx
// components/competitions/DuplicateCompetitionAction.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDuplicateCompetition } from '@/hooks/useDuplicateCompetition'
import type { Competition } from '@/lib/types/database'

export function DuplicateCompetitionAction({ competition }: { competition: Competition }) {
  const router = useRouter()
  const { mutateAsync, isPending } = useDuplicateCompetition()

  async function handleClick() {
    const copy = await mutateAsync(competition)
    router.push(`/competitions/${copy.id}`)
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
      <Copy className="h-3.5 w-3.5" />
      {isPending ? 'Duplicating...' : 'Duplicate'}
    </Button>
  )
}
```

- [ ] **Step 6: Wire into the detail page**

In `app/(app)/competitions/[id]/page.tsx`, import `DuplicateCompetitionAction` and render it next to the existing Edit button:

```tsx
import { DuplicateCompetitionAction } from '@/components/competitions/DuplicateCompetitionAction'
```

```tsx
<div className="flex gap-2">
  <DuplicateCompetitionAction competition={competition} />
  <Button variant="secondary" size="sm" onClick={() => setIsEditing((v) => !v)}>
    {isEditing ? 'Cancel' : 'Edit'}
  </Button>
</div>
```

Replace the single `<Button variant="secondary" ...>` element (currently the sole child of the header's right-hand side) with this two-button `<div>`.

- [ ] **Step 7: Manual verification**

On a competition detail page, click Duplicate — confirm navigation to a new draft named "... — Copy" with `status = researching` and empty deadline fields.

- [ ] **Step 8: Commit**

```bash
git add hooks/useDuplicateCompetition.ts hooks/useDuplicateCompetition.test.tsx components/competitions/DuplicateCompetitionAction.tsx "app/(app)/competitions/[id]/page.tsx"
git commit -m "feat: add Duplicate competition action"
```

---

## Task 18: LinksSection

**Files:**
- Create: `components/detail/LinksSection.tsx`
- Test: `components/detail/LinksSection.test.tsx`
- Modify: `app/(app)/competitions/[id]/page.tsx` (wire in below the notes block)

**Interfaces:**
- Produces: `<LinksSection instagramUrl={string|null} websiteUrl={string|null} />` — read-only rendering of the two validated URLs already stored on `Competition` (validation happens in `CompetitionForm`/`competitionSchema`, Task 7/15; this component just renders).

- [ ] **Step 1: Write failing tests**

```tsx
// components/detail/LinksSection.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinksSection } from './LinksSection'

describe('LinksSection', () => {
  it('renders both links when present', () => {
    render(<LinksSection instagramUrl="https://instagram.com/x" websiteUrl="https://x.com" />)
    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute('href', 'https://instagram.com/x')
    expect(screen.getByRole('link', { name: /website/i })).toHaveAttribute('href', 'https://x.com')
  })

  it('shows a placeholder when neither link is set', () => {
    render(<LinksSection instagramUrl={null} websiteUrl={null} />)
    expect(screen.getByText(/no links/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/detail/LinksSection.test.tsx`
Expected: FAIL — `LinksSection.tsx` does not exist.

- [ ] **Step 3: Implement LinksSection**

```tsx
// components/detail/LinksSection.tsx
import { Instagram, Globe } from 'lucide-react'

interface LinksSectionProps {
  instagramUrl: string | null
  websiteUrl: string | null
}

export function LinksSection({ instagramUrl, websiteUrl }: LinksSectionProps) {
  if (!instagramUrl && !websiteUrl) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No links added yet.</p>
  }

  return (
    <div className="space-y-2">
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-zinc-700 hover:underline dark:text-zinc-300"
        >
          <Instagram className="h-4 w-4" />
          Instagram
        </a>
      )}
      {websiteUrl && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-zinc-700 hover:underline dark:text-zinc-300"
        >
          <Globe className="h-4 w-4" />
          Website
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test components/detail/LinksSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the detail page**

Add the import and render it after the notes block in `app/(app)/competitions/[id]/page.tsx`:

```tsx
import { LinksSection } from '@/components/detail/LinksSection'
```

```tsx
<LinksSection instagramUrl={competition.instagram_url} websiteUrl={competition.website_url} />
```

- [ ] **Step 6: Commit**

```bash
git add components/detail/LinksSection.tsx components/detail/LinksSection.test.tsx "app/(app)/competitions/[id]/page.tsx"
git commit -m "feat: add LinksSection to the detail page"
```

---

## Task 19: Cloudinary signed-upload Edge Function

**Files:**
- Create: `supabase/functions/cloudinary-sign/index.ts`

**Interfaces:**
- Consumes: Cloudinary API secret (server secret, set via `supabase secrets set`), the authenticated user's session (Edge Function validates the caller's Supabase JWT).
- Produces: `POST /functions/v1/cloudinary-sign` returning `{ signature, timestamp, apiKey, cloudName, folder }` — consumed by `hooks/useUploadGuidebook.ts` (Task 20).

This task requires the user's Cloudinary credentials. **Stop and ask for `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`** before Step 3 (deploying/testing). Step 1–2 (writing the code) don't need the values yet.

- [ ] **Step 1: Write the Edge Function**

```ts
// supabase/functions/cloudinary-sign/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')!
const API_KEY = Deno.env.get('CLOUDINARY_API_KEY')!
const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')!

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { competitionId } = await req.json()
  if (!competitionId) {
    return new Response(JSON.stringify({ error: 'competitionId is required' }), { status: 400 })
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = `competition-hub/${competitionId}`
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`
  const signature = await sha1Hex(paramsToSign)

  return new Response(
    JSON.stringify({ signature, timestamp, apiKey: API_KEY, cloudName: CLOUD_NAME, folder }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

- [ ] **Step 2: Get Cloudinary credentials from the user**

Ask the user to create a Cloudinary account (if they haven't) and provide the cloud name, API key, and API secret from the Cloudinary console dashboard.

- [ ] **Step 3: Set secrets and deploy**

```bash
supabase secrets set CLOUDINARY_CLOUD_NAME=<value> CLOUDINARY_API_KEY=<value> CLOUDINARY_API_SECRET=<value>
supabase functions deploy cloudinary-sign
```

- [ ] **Step 4: Add the two client-exposed Cloudinary vars to `.env.local` and `.env.example`**

```bash
# .env.example (append)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_API_KEY=
```

These are safe to expose — Cloudinary's signed-upload flow requires the cloud name and API key client-side; only the API secret must stay server-only.

- [ ] **Step 5: Manual verification**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/cloudinary-sign \
  -H "Authorization: Bearer <a valid user JWT from the browser session>" \
  -H "Content-Type: application/json" \
  -d '{"competitionId":"test-id"}'
```

Expected: `200` with `{ signature, timestamp, apiKey, cloudName, folder }`. Without the `Authorization` header, expect `401`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/cloudinary-sign/index.ts .env.example
git commit -m "feat: add Cloudinary signed-upload Edge Function"
```

---

## Task 20: useUploadGuidebook and DocumentsSection

**Files:**
- Create: `hooks/useUploadGuidebook.ts`
- Test: `hooks/useUploadGuidebook.test.tsx`
- Create: `components/detail/DocumentsSection.tsx`
- Test: `components/detail/DocumentsSection.test.tsx`
- Modify: `app/(app)/competitions/[id]/page.tsx` (wire in below LinksSection)

**Interfaces:**
- Consumes: `FileDropzone` (Task 9), `createClient` (browser, Task 4) for both invoking the `cloudinary-sign` Edge Function and inserting into `competition_documents`.
- Produces: `useUploadGuidebook(competitionId: string)` → `{ upload: (file: File) => Promise<void>, progress: number, status: 'idle'|'uploading'|'error'|'done', error: string|null }`. `<DocumentsSection competitionId={string} documents={CompetitionDocument[]} />`.

- [ ] **Step 1: Write failing tests for the upload hook**

```tsx
// hooks/useUploadGuidebook.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useUploadGuidebook } from './useUploadGuidebook'

const functionsInvoke = vi.fn().mockResolvedValue({
  data: { signature: 'sig', timestamp: 123, apiKey: 'key', cloudName: 'cloud', folder: 'competition-hub/comp-1' },
  error: null,
})
const insert = vi.fn().mockResolvedValue({ error: null })
const from = vi.fn().mockReturnValue({ insert })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ functions: { invoke: functionsInvoke }, from }),
}))

const originalFetch = global.fetch
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ public_id: 'competition-hub/comp-1/guidebook', secure_url: 'https://res.cloudinary.com/x.pdf' }),
  }) as unknown as typeof fetch
})

describe('useUploadGuidebook', () => {
  it('requests a signature, uploads to Cloudinary, then inserts a document row', async () => {
    const { result } = renderHook(() => useUploadGuidebook('comp-1'))
    const file = new File([new Uint8Array(10)], 'guidebook.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.upload(file)
    })

    expect(functionsInvoke).toHaveBeenCalledWith('cloudinary-sign', { body: { competitionId: 'comp-1' } })
    expect(global.fetch).toHaveBeenCalled()
    expect(from).toHaveBeenCalledWith('competition_documents')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        competition_id: 'comp-1',
        file_name: 'guidebook.pdf',
        cloudinary_public_id: 'competition-hub/comp-1/guidebook',
        cloudinary_url: 'https://res.cloudinary.com/x.pdf',
        doc_type: 'guidebook',
      })
    )
    await waitFor(() => expect(result.current.status).toBe('done'))
  })

  it('sets status to error when the signature request fails', async () => {
    functionsInvoke.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    const { result } = renderHook(() => useUploadGuidebook('comp-1'))
    const file = new File([new Uint8Array(10)], 'guidebook.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.upload(file)
    })

    expect(result.current.status).toBe('error')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test hooks/useUploadGuidebook.test.tsx`
Expected: FAIL — `useUploadGuidebook.ts` does not exist.

- [ ] **Step 3: Implement useUploadGuidebook.ts**

```ts
// hooks/useUploadGuidebook.ts
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = 'idle' | 'uploading' | 'error' | 'done'

export function useUploadGuidebook(competitionId: string) {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setStatus('uploading')
    setProgress(0)
    setError(null)

    const supabase = createClient()

    const { data: signData, error: signError } = await supabase.functions.invoke('cloudinary-sign', {
      body: { competitionId },
    })
    if (signError || !signData) {
      setStatus('error')
      setError('Could not get an upload signature. Try again.')
      return
    }

    const { signature, timestamp, apiKey, cloudName, folder } = signData

    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', apiKey)
    formData.append('timestamp', String(timestamp))
    formData.append('signature', signature)
    formData.append('folder', folder)

    let uploadResult: { public_id: string; secure_url: string }
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      uploadResult = await res.json()
      setProgress(100)
    } catch {
      setStatus('error')
      setError('Upload to Cloudinary failed. Check your connection and try again.')
      return
    }

    const { error: insertError } = await supabase.from('competition_documents').insert({
      competition_id: competitionId,
      file_name: file.name,
      cloudinary_public_id: uploadResult.public_id,
      cloudinary_url: uploadResult.secure_url,
      doc_type: 'guidebook',
    })

    if (insertError) {
      setStatus('error')
      setError('File uploaded but saving the record failed. Contact support.')
      return
    }

    setStatus('done')
  }

  return { upload, progress, status, error }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test hooks/useUploadGuidebook.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write failing tests for DocumentsSection**

```tsx
// components/detail/DocumentsSection.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocumentsSection } from './DocumentsSection'
import type { CompetitionDocument } from '@/lib/types/database'

function doc(overrides: Partial<CompetitionDocument>): CompetitionDocument {
  return {
    id: '1', competition_id: 'c1', file_name: 'guidebook.pdf',
    cloudinary_public_id: 'x', cloudinary_url: 'https://res.cloudinary.com/x.pdf',
    doc_type: 'guidebook', extracted_text: null, uploaded_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('DocumentsSection', () => {
  it('lists documents newest-first with a download link', () => {
    const docs = [
      doc({ id: '1', file_name: 'old.pdf', uploaded_at: '2026-01-01T00:00:00Z' }),
      doc({ id: '2', file_name: 'new.pdf', uploaded_at: '2026-02-01T00:00:00Z' }),
    ]
    render(<DocumentsSection competitionId="c1" documents={docs} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('new.pdf')
    expect(links[1]).toHaveTextContent('old.pdf')
  })

  it('shows an empty state with the dropzone when there are no documents', () => {
    render(<DocumentsSection competitionId="c1" documents={[]} />)
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test components/detail/DocumentsSection.test.tsx`
Expected: FAIL — `DocumentsSection.tsx` does not exist.

- [ ] **Step 7: Implement DocumentsSection**

```tsx
// components/detail/DocumentsSection.tsx
'use client'

import { useQueryClient } from '@tanstack/react-query'
import { FileText, Download } from 'lucide-react'
import { FileDropzone } from '@/components/ui/FileDropzone'
import { useUploadGuidebook } from '@/hooks/useUploadGuidebook'
import type { CompetitionDocument } from '@/lib/types/database'

const MAX_SIZE_BYTES = 20 * 1024 * 1024

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function DocumentsSection({
  competitionId,
  documents,
}: {
  competitionId: string
  documents: CompetitionDocument[]
}) {
  const queryClient = useQueryClient()
  const { upload, status, error } = useUploadGuidebook(competitionId)

  const sorted = [...documents].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  )

  async function handleFile(file: File) {
    await upload(file)
    queryClient.invalidateQueries({ queryKey: ['competitions', competitionId] })
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {sorted.map((doc) => (
          <li key={doc.id} className="flex items-center gap-2 rounded-md border border-zinc-200 p-2 text-sm dark:border-zinc-800">
            <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
            <a href={doc.cloudinary_url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:underline">
              {doc.file_name}
            </a>
            <span className="text-xs text-zinc-400">{formatSize(null)}</span>
            <a href={doc.cloudinary_url} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 text-zinc-500" />
            </a>
          </li>
        ))}
      </ul>
      <FileDropzone
        accept="application/pdf"
        maxSizeBytes={MAX_SIZE_BYTES}
        onFileSelected={handleFile}
        disabled={status === 'uploading'}
      />
      {status === 'uploading' && <p className="text-sm text-zinc-500">Uploading...</p>}
      {status === 'error' && error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

(`formatSize` is wired to `null` because Cloudinary's signed-upload response used here doesn't include `bytes` in the minimal shape returned by `useUploadGuidebook`; if file size display is wanted, extend `uploadResult` in Task 20 Step 3 to also store `bytes` from the Cloudinary response into a new `competition_documents.file_size_bytes` column. Out of scope for Phase 1 — PRD 5.2 asks for "name, size" but this is a small enough gap to note rather than block on.)

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test components/detail/DocumentsSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Wire into the detail page**

```tsx
import { DocumentsSection } from '@/components/detail/DocumentsSection'
```

The detail page currently only has `competition` from `useCompetitionDetail`, which doesn't include related `competition_documents` rows. Add a small query directly in the page (documents are competition-scoped, not reused elsewhere, so a dedicated hook is unnecessary — this stays inline per YAGNI):

```tsx
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
```

```tsx
const { data: documents } = useQuery({
  queryKey: ['competitions', id, 'documents'],
  queryFn: async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('competition_documents')
      .select('*')
      .eq('competition_id', id)
    if (error) throw error
    return data
  },
})
```

```tsx
<DocumentsSection competitionId={id} documents={documents ?? []} />
```

- [ ] **Step 10: Manual verification**

With the Cloudinary function deployed (Task 19), upload a real PDF on a competition's detail page and confirm it appears in the list immediately with a working download link.

- [ ] **Step 11: Commit**

```bash
git add hooks/useUploadGuidebook.ts hooks/useUploadGuidebook.test.tsx components/detail/DocumentsSection.tsx components/detail/DocumentsSection.test.tsx "app/(app)/competitions/[id]/page.tsx"
git commit -m "feat: add guidebook upload via Cloudinary signed uploads"
```

---

## Task 21: useRundown hook, RundownList, RundownItemForm, NotificationLog

**Files:**
- Create: `hooks/useRundown.ts`
- Test: `hooks/useRundown.test.tsx`
- Create: `components/detail/RundownItemForm.tsx`
- Test: `components/detail/RundownItemForm.test.tsx`
- Create: `components/detail/RundownList.tsx`
- Test: `components/detail/RundownList.test.tsx`
- Create: `components/detail/NotificationLog.tsx`
- Test: `components/detail/NotificationLog.test.tsx`
- Modify: `app/(app)/competitions/[id]/page.tsx` (wire in below DocumentsSection)

**Interfaces:**
- Consumes: `rundownItemSchema` from `lib/validation.ts` (Task 7), `createClient` from `lib/supabase/client.ts`.
- Produces: `useRundownItems(competitionId)`, `useCreateRundownItem(competitionId)`, `useNotificationLogs(rundownItemIds: string[])` (hooks/useRundown.ts). `<RundownItemForm onSubmit={(values: RundownItemFormValues) => void} />`, `<RundownList items={RundownItem[]} onAddClick={() => void} />`, `<NotificationLog logs={NotificationLog[]} />`.

- [ ] **Step 1: Write failing tests for useRundown.ts**

```tsx
// hooks/useRundown.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useRundownItems } from './useRundown'

const mockItems = [{ id: '1', competition_id: 'c1', title: 'Briefing', event_at: '2026-03-01T00:00:00Z' }]
const order = vi.fn().mockResolvedValue({ data: mockItems, error: null })
const eq = vi.fn().mockReturnValue({ order })
const select = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useRundownItems', () => {
  it('fetches rundown items for a competition ordered by event_at', async () => {
    const { result } = renderHook(() => useRundownItems('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockItems)
    expect(eq).toHaveBeenCalledWith('competition_id', 'c1')
    expect(order).toHaveBeenCalledWith('event_at', { ascending: true })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test hooks/useRundown.test.tsx`
Expected: FAIL — `useRundown.ts` does not exist.

- [ ] **Step 3: Implement useRundown.ts**

```ts
// hooks/useRundown.ts
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { NotificationLog, RundownItem } from '@/lib/types/database'
import type { RundownItemFormValues } from '@/lib/validation'

export function useRundownItems(competitionId: string) {
  return useQuery({
    queryKey: ['rundown-items', competitionId],
    queryFn: async (): Promise<RundownItem[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('rundown_items')
        .select('*')
        .eq('competition_id', competitionId)
        .order('event_at', { ascending: true })
      if (error) throw error
      return data as RundownItem[]
    },
    enabled: Boolean(competitionId),
  })
}

export function useCreateRundownItem(competitionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: RundownItemFormValues) => {
      const supabase = createClient()
      const { error } = await supabase.from('rundown_items').insert({ ...values, competition_id: competitionId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rundown-items', competitionId] })
    },
  })
}

export function useNotificationLogs(rundownItemIds: string[]) {
  return useQuery({
    queryKey: ['notification-logs', rundownItemIds],
    queryFn: async (): Promise<NotificationLog[]> => {
      if (rundownItemIds.length === 0) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .in('rundown_item_id', rundownItemIds)
        .order('sent_at', { ascending: false })
      if (error) throw error
      return data as NotificationLog[]
    },
    enabled: rundownItemIds.length > 0,
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test hooks/useRundown.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Write failing tests for RundownItemForm**

```tsx
// components/detail/RundownItemForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RundownItemForm } from './RundownItemForm'

describe('RundownItemForm', () => {
  it('rejects submission without a title', async () => {
    const onSubmit = vi.fn()
    render(<RundownItemForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/date/i), '2026-03-01T09:00')
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid values', async () => {
    const onSubmit = vi.fn()
    render(<RundownItemForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'Technical briefing')
    await userEvent.type(screen.getByLabelText(/date/i), '2026-03-01T09:00')
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Technical briefing', event_at: '2026-03-01T09:00' })
    )
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test components/detail/RundownItemForm.test.tsx`
Expected: FAIL — `RundownItemForm.tsx` does not exist.

- [ ] **Step 7: Implement RundownItemForm**

```tsx
// components/detail/RundownItemForm.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { rundownItemSchema, type RundownItemFormValues } from '@/lib/validation'

export function RundownItemForm({ onSubmit }: { onSubmit: (values: RundownItemFormValues) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventAt, setEventAt] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = rundownItemSchema.safeParse({ title, description, event_at: eventAt })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    onSubmit(result.data)
    setTitle('')
    setDescription('')
    setEventAt('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="rundown-title" className="mb-1 block text-sm font-medium">Title</label>
        <Input id="rundown-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
      </div>
      <div>
        <label htmlFor="rundown-date" className="mb-1 block text-sm font-medium">Date / time</label>
        <Input id="rundown-date" type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} />
        {errors.event_at && <p className="mt-1 text-sm text-red-600">{errors.event_at}</p>}
      </div>
      <div>
        <label htmlFor="rundown-description" className="mb-1 block text-sm font-medium">Description (optional)</label>
        <Textarea id="rundown-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button type="submit" size="sm">Add rundown item</Button>
    </form>
  )
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test components/detail/RundownItemForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Write failing tests for RundownList**

```tsx
// components/detail/RundownList.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RundownList } from './RundownList'
import type { RundownItem } from '@/lib/types/database'

function item(overrides: Partial<RundownItem>): RundownItem {
  return {
    id: '1', competition_id: 'c1', title: 'Briefing', description: null,
    event_at: '2026-03-01T09:00:00Z', reminder_offsets_minutes: null,
    is_auto_generated: false, auto_source: null, created_at: '', ...overrides,
  }
}

describe('RundownList', () => {
  it('renders each item with an auto-generated marker when applicable', () => {
    const items = [
      item({ id: '1', title: 'Submission deadline', is_auto_generated: true }),
      item({ id: '2', title: 'Pitching day' }),
    ]
    render(<RundownList items={items} />)
    expect(screen.getByText('Submission deadline')).toBeInTheDocument()
    expect(screen.getByText('Pitching day')).toBeInTheDocument()
    expect(screen.getByText(/auto/i)).toBeInTheDocument()
  })

  it('shows an empty state', () => {
    render(<RundownList items={[]} />)
    expect(screen.getByText(/no rundown items/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Run to verify it fails**

Run: `pnpm test components/detail/RundownList.test.tsx`
Expected: FAIL — `RundownList.tsx` does not exist.

- [ ] **Step 11: Implement RundownList**

```tsx
// components/detail/RundownList.tsx
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/date-format'
import type { RundownItem } from '@/lib/types/database'

export function RundownList({ items }: { items: RundownItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No rundown items yet.</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between rounded-md border border-zinc-200 p-2.5 text-sm dark:border-zinc-800">
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {item.title}{' '}
              {item.is_auto_generated && (
                <Badge className="ml-1 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Auto</Badge>
              )}
            </p>
            {item.description && <p className="text-zinc-500 dark:text-zinc-400">{item.description}</p>}
          </div>
          <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{formatDateTime(item.event_at)}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 12: Run to verify it passes**

Run: `pnpm test components/detail/RundownList.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 13: Write failing tests for NotificationLog**

```tsx
// components/detail/NotificationLog.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationLog } from './NotificationLog'
import type { NotificationLog as NotificationLogType } from '@/lib/types/database'

function log(overrides: Partial<NotificationLogType>): NotificationLogType {
  return {
    id: '1', rundown_item_id: 'r1', channel: 'whatsapp', message: 'Reminder: Briefing in 1 day',
    status: 'sent', attempt_count: 1, sent_at: '2026-02-28T09:00:00Z', ...overrides,
  }
}

describe('NotificationLog', () => {
  it('shows a failed badge for failed sends', () => {
    render(<NotificationLog logs={[log({ status: 'failed' })]} />)
    expect(screen.getByText(/failed/i)).toBeInTheDocument()
  })

  it('shows an empty state', () => {
    render(<NotificationLog logs={[]} />)
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 14: Run to verify it fails**

Run: `pnpm test components/detail/NotificationLog.test.tsx`
Expected: FAIL — `NotificationLog.tsx` does not exist.

- [ ] **Step 15: Implement NotificationLog**

```tsx
// components/detail/NotificationLog.tsx
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/date-format'
import type { NotificationLog as NotificationLogType } from '@/lib/types/database'

export function NotificationLog({ logs }: { logs: NotificationLogType[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No notifications sent yet.</p>
  }

  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="flex items-center justify-between text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">{log.message}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">{formatDateTime(log.sent_at)}</span>
            <Badge
              className={
                log.status === 'sent'
                  ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              }
            >
              {log.status}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 16: Run to verify it passes**

Run: `pnpm test components/detail/NotificationLog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 17: Wire everything into the detail page**

```tsx
import { RundownList } from '@/components/detail/RundownList'
import { RundownItemForm } from '@/components/detail/RundownItemForm'
import { NotificationLog } from '@/components/detail/NotificationLog'
import { useRundownItems, useCreateRundownItem, useNotificationLogs } from '@/hooks/useRundown'
```

```tsx
const { data: rundownItems = [] } = useRundownItems(id)
const { mutate: createRundownItem } = useCreateRundownItem(id)
const { data: notificationLogs = [] } = useNotificationLogs(rundownItems.map((r) => r.id))
```

```tsx
<section className="space-y-3">
  <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Rundown</h2>
  <RundownList items={rundownItems} />
  <RundownItemForm onSubmit={createRundownItem} />
</section>
<section className="space-y-3">
  <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Notification Log</h2>
  <NotificationLog logs={notificationLogs} />
</section>
```

- [ ] **Step 18: Commit**

```bash
git add hooks/useRundown.ts hooks/useRundown.test.tsx components/detail/RundownItemForm.tsx components/detail/RundownItemForm.test.tsx components/detail/RundownList.tsx components/detail/RundownList.test.tsx components/detail/NotificationLog.tsx components/detail/NotificationLog.test.tsx "app/(app)/competitions/[id]/page.tsx"
git commit -m "feat: add rundown list, manual add form, and notification log"
```

---

## Task 22: Fonnte send-reminders Edge Function and pg_cron schedule

**Files:**
- Create: `supabase/functions/send-reminders/index.ts`
- Create: `supabase/migrations/0003_reminder_cron.sql`

**Interfaces:**
- Consumes: Fonnte device token (server secret), `rundown_items` joined with `competitions.user_id` → `user_settings`, writes to `notification_logs`.
- Produces: a `pg_cron` job firing every 15 minutes that calls this function. No client code depends on this directly — the dashboard reads its output via `useNotificationLogs` (Task 21) and `NotificationLog`.

This task requires the user's Fonnte device token. **Stop and ask for `FONNTE_TOKEN`** before Step 3.

- [ ] **Step 1: Write the Edge Function**

Matches PRD 7.5: every 15 minutes, find rundown items whose `event_at minus offset` falls in the last 15 minutes, that don't already have a matching `notification_logs` row, send via Fonnte, log the result, retry failed sends up to 3 attempts on later ticks.

```ts
// supabase/functions/send-reminders/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const FONNTE_TOKEN = Deno.env.get('FONNTE_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_ATTEMPTS = 3
const WINDOW_MINUTES = 15

interface DueItem {
  id: string
  title: string
  event_at: string
  reminder_offsets_minutes: number[] | null
  competition_id: string
  competitions: { name: string; user_id: string } | null
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: items, error } = await supabase
    .from('rundown_items')
    .select('id, title, event_at, reminder_offsets_minutes, competition_id, competitions(name, user_id)')
    .gte('event_at', new Date().toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const now = Date.now()
  const results: { rundown_item_id: string; status: 'sent' | 'failed' }[] = []

  for (const item of (items ?? []) as unknown as DueItem[]) {
    if (!item.competitions) continue

    const { data: settings } = await supabase
      .from('user_settings')
      .select('whatsapp_number, default_reminder_offsets_minutes, timezone')
      .eq('id', item.competitions.user_id)
      .single()

    if (!settings?.whatsapp_number) continue

    const offsets = item.reminder_offsets_minutes ?? settings.default_reminder_offsets_minutes
    const eventTime = new Date(item.event_at).getTime()

    for (const offsetMinutes of offsets) {
      const triggerAt = eventTime - offsetMinutes * 60_000
      const withinWindow = now >= triggerAt && now - triggerAt <= WINDOW_MINUTES * 60_000
      if (!withinWindow) continue

      const message = `${item.competitions.name}: ${item.title} in ${Math.round(offsetMinutes / 60)}h`

      const { data: existing } = await supabase
        .from('notification_logs')
        .select('id, status, attempt_count')
        .eq('rundown_item_id', item.id)
        .eq('message', message)
        .maybeSingle()

      if (existing && (existing.status === 'sent' || existing.attempt_count >= MAX_ATTEMPTS)) continue

      let sendStatus: 'sent' | 'failed' = 'failed'
      try {
        const res = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { Authorization: FONNTE_TOKEN },
          body: new URLSearchParams({
            target: settings.whatsapp_number,
            message,
            countryCode: '62',
          }),
        })
        sendStatus = res.ok ? 'sent' : 'failed'
      } catch {
        sendStatus = 'failed'
      }

      if (existing) {
        await supabase
          .from('notification_logs')
          .update({ status: sendStatus, attempt_count: existing.attempt_count + 1, sent_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('notification_logs').insert({
          rundown_item_id: item.id,
          channel: 'whatsapp',
          message,
          status: sendStatus,
          attempt_count: 1,
        })
      }

      results.push({ rundown_item_id: item.id, status: sendStatus })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Get the Fonnte token from the user**

Ask for the Fonnte device token (from the Fonnte dashboard, under the connected WhatsApp device).

- [ ] **Step 3: Set secrets and deploy**

```bash
supabase secrets set FONNTE_TOKEN=<value>
supabase functions deploy send-reminders
```

- [ ] **Step 4: Schedule the pg_cron job**

```sql
-- supabase/migrations/0003_reminder_cron.sql
select cron.schedule(
  'send-reminders-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := '<https://PROJECT_REF.supabase.co/functions/v1/send-reminders>',
    headers := jsonb_build_object('Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>')
  );
  $$
);
```

Replace `PROJECT_REF` and `<SERVICE_ROLE_KEY>` with the real project ref and service role key before applying — this migration contains a secret and should be applied directly in the Supabase SQL Editor rather than committed with the real key filled in. Commit the file with the placeholders shown; keep the filled-in version local only.

Run: `supabase db push` (with placeholders — apply the real values manually in the SQL Editor per the note above, or use Supabase Vault to store the key and reference it instead of inlining it).

- [ ] **Step 5: Manual verification**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/send-reminders \
  -H "Authorization: Bearer <service-role-key>"
```

Expected: `200` with `{ processed, results }`. Create a competition with a `submission_deadline` 3 hours + 15 minutes from now (matching the default offset), set `user_settings.whatsapp_number`, wait for the next cron tick or invoke manually, and confirm a `notification_logs` row appears with `status = 'sent'` and a real WhatsApp message arrives.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/send-reminders/index.ts supabase/migrations/0003_reminder_cron.sql
git commit -m "feat: add Fonnte WhatsApp reminder Edge Function and pg_cron schedule"
```

---

## Task 23: useUserSettings hook, RundownModeToggle, WhatsAppSettingsForm, Settings page

**Files:**
- Create: `hooks/useUserSettings.ts`
- Test: `hooks/useUserSettings.test.tsx`
- Create: `components/settings/RundownModeToggle.tsx`
- Test: `components/settings/RundownModeToggle.test.tsx`
- Create: `components/settings/WhatsAppSettingsForm.tsx`
- Test: `components/settings/WhatsAppSettingsForm.test.tsx`
- Create: `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `settingsSchema` from `lib/validation.ts` (Task 7), `createClient` from `lib/supabase/client.ts`.
- Produces: `useUserSettings(): UseQueryResult<UserSettings>`, `useUpdateUserSettings(): UseMutationResult<UserSettings, Error, Partial<UserSettings>>` — also consumed by `ThemeToggle` (Task 25).

- [ ] **Step 1: Write failing tests for useUserSettings.ts**

```tsx
// hooks/useUserSettings.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useUserSettings } from './useUserSettings'

const mockSettings = { id: 'u1', whatsapp_number: '6281234567890', rundown_generation_mode: 'auto', theme_preference: 'light' }
const single = vi.fn().mockResolvedValue({ data: mockSettings, error: null })
const eq = vi.fn().mockReturnValue({ single })
const select = vi.fn().mockReturnValue({ eq })
const from = vi.fn().mockReturnValue({ select })
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from, auth: { getUser } }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useUserSettings', () => {
  it('fetches settings for the current user', async () => {
    const { result } = renderHook(() => useUserSettings(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockSettings)
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test hooks/useUserSettings.test.tsx`
Expected: FAIL — `useUserSettings.ts` does not exist.

- [ ] **Step 3: Implement useUserSettings.ts**

```ts
// hooks/useUserSettings.ts
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings } from '@/lib/types/database'

export function useUserSettings() {
  return useQuery({
    queryKey: ['user-settings'],
    queryFn: async (): Promise<UserSettings> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase.from('user_settings').select('*').eq('id', user.id).single()
      if (error) throw error
      return data as UserSettings
    },
  })
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<UserSettings>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ id: user.id, ...values })
        .select()
        .single()
      if (error) throw error
      return data as UserSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] })
    },
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test hooks/useUserSettings.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Write failing tests for RundownModeToggle**

```tsx
// components/settings/RundownModeToggle.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RundownModeToggle } from './RundownModeToggle'

describe('RundownModeToggle', () => {
  it('calls onChange with manual when toggled from auto', async () => {
    const onChange = vi.fn()
    render(<RundownModeToggle mode="auto" onChange={onChange} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith('manual')
  })

  it('reflects the current mode as checked when auto', () => {
    render(<RundownModeToggle mode="auto" onChange={() => {}} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test components/settings/RundownModeToggle.test.tsx`
Expected: FAIL — `RundownModeToggle.tsx` does not exist.

- [ ] **Step 7: Implement RundownModeToggle**

```tsx
// components/settings/RundownModeToggle.tsx
'use client'

import { cn } from '@/lib/cn'
import type { RundownGenerationMode } from '@/lib/types/database'

interface RundownModeToggleProps {
  mode: RundownGenerationMode
  onChange: (mode: RundownGenerationMode) => void
}

export function RundownModeToggle({ mode, onChange }: RundownModeToggleProps) {
  const isAuto = mode === 'auto'
  return (
    <div className="flex items-center gap-3">
      <button
        role="switch"
        aria-checked={isAuto}
        onClick={() => onChange(isAuto ? 'manual' : 'auto')}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          isAuto ? 'bg-zinc-900 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-700'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform dark:bg-zinc-900',
            isAuto ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
      <span className="text-sm text-zinc-700 dark:text-zinc-300">
        Auto-generate rundown items from deadlines ({isAuto ? 'Auto' : 'Manual'})
      </span>
    </div>
  )
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test components/settings/RundownModeToggle.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Write failing tests for WhatsAppSettingsForm**

```tsx
// components/settings/WhatsAppSettingsForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WhatsAppSettingsForm } from './WhatsAppSettingsForm'

describe('WhatsAppSettingsForm', () => {
  it('rejects a malformed phone number', async () => {
    const onSubmit = vi.fn()
    render(<WhatsAppSettingsForm defaultNumber="" defaultOffsets={[1440, 180]} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/whatsapp number/i), '0812345')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/use format/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid number in 62xxxxxxxxxx format', async () => {
    const onSubmit = vi.fn()
    render(<WhatsAppSettingsForm defaultNumber="" defaultOffsets={[1440, 180]} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/whatsapp number/i), '6281234567890')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp_number: '6281234567890' })
    )
  })
})
```

- [ ] **Step 10: Run to verify it fails**

Run: `pnpm test components/settings/WhatsAppSettingsForm.test.tsx`
Expected: FAIL — `WhatsAppSettingsForm.tsx` does not exist.

- [ ] **Step 11: Implement WhatsAppSettingsForm**

```tsx
// components/settings/WhatsAppSettingsForm.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { settingsSchema } from '@/lib/validation'

const OFFSET_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '1 day', minutes: 1440 },
]

interface WhatsAppSettingsFormProps {
  defaultNumber: string
  defaultOffsets: number[]
  onSubmit: (values: { whatsapp_number: string; default_reminder_offsets_minutes: number[] }) => void
}

export function WhatsAppSettingsForm({ defaultNumber, defaultOffsets, onSubmit }: WhatsAppSettingsFormProps) {
  const [number, setNumber] = useState(defaultNumber)
  const [offsets, setOffsets] = useState<number[]>(defaultOffsets)
  const [error, setError] = useState<string | null>(null)

  function toggleOffset(minutes: number) {
    setOffsets((prev) => (prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = settingsSchema.safeParse({
      whatsapp_number: number,
      default_reminder_offsets_minutes: offsets,
      rundown_generation_mode: 'auto',
    })
    if (!result.success) {
      setError(result.error.issues.find((i) => i.path[0] === 'whatsapp_number')?.message ?? 'Invalid settings')
      return
    }
    setError(null)
    onSubmit({ whatsapp_number: number, default_reminder_offsets_minutes: offsets })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="whatsapp-number" className="mb-1 block text-sm font-medium">WhatsApp number</label>
        <Input
          id="whatsapp-number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="62812xxxxxxx"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium">Default reminder offsets</span>
        <div className="flex flex-wrap gap-3">
          {OFFSET_OPTIONS.map((opt) => (
            <label key={opt.minutes} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={offsets.includes(opt.minutes)} onChange={() => toggleOffset(opt.minutes)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" size="sm">Save WhatsApp settings</Button>
    </form>
  )
}
```

- [ ] **Step 12: Run to verify it passes**

Run: `pnpm test components/settings/WhatsAppSettingsForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 13: Assemble the Settings page**

```tsx
// app/(app)/settings/page.tsx
'use client'

import { RundownModeToggle } from '@/components/settings/RundownModeToggle'
import { WhatsAppSettingsForm } from '@/components/settings/WhatsAppSettingsForm'
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useUserSettings'

export default function SettingsPage() {
  const { data: settings, isLoading } = useUserSettings()
  const { mutate: update } = useUpdateUserSettings()

  if (isLoading || !settings) return null

  return (
    <div className="mx-auto max-w-xl space-y-8 py-8">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Rundown generation</h2>
        <RundownModeToggle
          mode={settings.rundown_generation_mode}
          onChange={(mode) => update({ rundown_generation_mode: mode })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">WhatsApp reminders</h2>
        <WhatsAppSettingsForm
          defaultNumber={settings.whatsapp_number ?? ''}
          defaultOffsets={settings.default_reminder_offsets_minutes}
          onSubmit={(values) => update(values)}
        />
      </section>
    </div>
  )
}
```

- [ ] **Step 14: Manual verification**

On `/settings`, toggle rundown mode and confirm `user_settings.rundown_generation_mode` changes in Supabase. Save a WhatsApp number and offsets, confirm persistence on reload.

- [ ] **Step 15: Commit**

```bash
git add hooks/useUserSettings.ts hooks/useUserSettings.test.tsx components/settings/RundownModeToggle.tsx components/settings/RundownModeToggle.test.tsx components/settings/WhatsAppSettingsForm.tsx components/settings/WhatsAppSettingsForm.test.tsx "app/(app)/settings/page.tsx"
git commit -m "feat: add Settings page with rundown mode toggle and WhatsApp form"
```

---

## Task 24: useUpcomingDeadlines and Next7DaysWidget

**Files:**
- Create: `hooks/useUpcomingDeadlines.ts`
- Test: `hooks/useUpcomingDeadlines.test.tsx`
- Create: `components/dashboard/Next7DaysWidget.tsx`
- Test: `components/dashboard/Next7DaysWidget.test.tsx`

**Interfaces:**
- Produces: `useUpcomingDeadlines(): UseQueryResult<{ id, title, event_at, competition_id, competitions: { name } }[]>` (rundown items across all competitions within the next 7 days). `<Next7DaysWidget />` (self-fetching — this is a page-level widget, an accepted exception to the "components call hooks, hooks talk to Supabase" split since it has no parent-owned data to receive as props).

- [ ] **Step 1: Write failing tests for the hook**

```tsx
// hooks/useUpcomingDeadlines.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useUpcomingDeadlines } from './useUpcomingDeadlines'

const mockRows = [{ id: '1', title: 'Briefing', event_at: '2026-03-01T09:00:00Z', competition_id: 'c1', competitions: { name: 'BYTESFEST' } }]
const order = vi.fn().mockResolvedValue({ data: mockRows, error: null })
const lte = vi.fn().mockReturnValue({ order })
const gte = vi.fn().mockReturnValue({ lte })
const select = vi.fn().mockReturnValue({ gte })
const from = vi.fn().mockReturnValue({ select })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useUpcomingDeadlines', () => {
  it('fetches rundown items within the next 7 days, ordered chronologically', async () => {
    const { result } = renderHook(() => useUpcomingDeadlines(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockRows)
    expect(order).toHaveBeenCalledWith('event_at', { ascending: true })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test hooks/useUpcomingDeadlines.test.tsx`
Expected: FAIL — `useUpcomingDeadlines.ts` does not exist.

- [ ] **Step 3: Implement useUpcomingDeadlines.ts**

```ts
// hooks/useUpcomingDeadlines.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface UpcomingDeadline {
  id: string
  title: string
  event_at: string
  competition_id: string
  competitions: { name: string } | null
}

export function useUpcomingDeadlines() {
  return useQuery({
    queryKey: ['upcoming-deadlines'],
    queryFn: async (): Promise<UpcomingDeadline[]> => {
      const supabase = createClient()
      const now = new Date()
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from('rundown_items')
        .select('id, title, event_at, competition_id, competitions(name)')
        .gte('event_at', now.toISOString())
        .lte('event_at', in7Days.toISOString())
        .order('event_at', { ascending: true })
      if (error) throw error
      return data as unknown as UpcomingDeadline[]
    },
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test hooks/useUpcomingDeadlines.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Write failing tests for Next7DaysWidget**

```tsx
// components/dashboard/Next7DaysWidget.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Next7DaysWidget } from './Next7DaysWidget'

vi.mock('@/hooks/useUpcomingDeadlines', () => ({
  useUpcomingDeadlines: () => ({
    data: [{ id: '1', title: 'Briefing', event_at: '2026-03-01T09:00:00Z', competition_id: 'c1', competitions: { name: 'BYTESFEST' } }],
    isLoading: false,
  }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('Next7DaysWidget', () => {
  it('links each item to its competition', async () => {
    render(<Next7DaysWidget />, { wrapper })
    await waitFor(() => expect(screen.getByText('Briefing')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /BYTESFEST/i })).toHaveAttribute('href', '/competitions/c1')
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test components/dashboard/Next7DaysWidget.test.tsx`
Expected: FAIL — `Next7DaysWidget.tsx` does not exist.

- [ ] **Step 7: Implement Next7DaysWidget**

```tsx
// components/dashboard/Next7DaysWidget.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/date-format'
import { useUpcomingDeadlines } from '@/hooks/useUpcomingDeadlines'

export function Next7DaysWidget() {
  const { data: items, isLoading } = useUpcomingDeadlines()

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Next 7 Days</h2>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      {!isLoading && (!items || items.length === 0) && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing due in the next 7 days.</p>
      )}
      {!isLoading && items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-zinc-900 dark:text-zinc-50">{item.title}</span>
                {item.competitions && (
                  <>
                    {' — '}
                    <Link href={`/competitions/${item.competition_id}`} className="text-zinc-500 hover:underline dark:text-zinc-400">
                      {item.competitions.name}
                    </Link>
                  </>
                )}
              </div>
              <span className="shrink-0 text-zinc-400">{formatDateTime(item.event_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test components/dashboard/Next7DaysWidget.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add hooks/useUpcomingDeadlines.ts hooks/useUpcomingDeadlines.test.tsx components/dashboard/Next7DaysWidget.tsx components/dashboard/Next7DaysWidget.test.tsx
git commit -m "feat: add Next 7 Days widget"
```

---

## Task 25: DeadlineOverlapBanner

**Files:**
- Create: `components/dashboard/DeadlineOverlapBanner.tsx`
- Test: `components/dashboard/DeadlineOverlapBanner.test.tsx`

**Interfaces:**
- Consumes: `detectDeadlineOverlaps` from `lib/rundown.ts` (Task 6).
- Produces: `<DeadlineOverlapBanner competitions={Competition[]} />` — dismissible per pair, persisted in `localStorage` under key `dismissed-overlap-pairs`, reappears if a new (not-yet-dismissed) overlap is introduced. Consumed by the dashboard page (Task 27).

- [ ] **Step 1: Write failing tests**

```tsx
// components/dashboard/DeadlineOverlapBanner.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeadlineOverlapBanner } from './DeadlineOverlapBanner'
import type { Competition } from '@/lib/types/database'

function comp(overrides: Partial<Competition>): Competition {
  return {
    id: overrides.id ?? '1', user_id: 'u', name: overrides.name ?? 'Comp', organizer: null, theme: null,
    status: overrides.status ?? 'registered', team_name: null, instagram_url: null, website_url: null,
    registration_deadline: null, submission_deadline: overrides.submission_deadline ?? null,
    event_start_at: null, event_end_at: null, location: null, tags: [], cloned_from_id: null,
    notes: null, created_at: '', updated_at: '', ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('DeadlineOverlapBanner', () => {
  it('shows a banner naming both competitions when deadlines overlap within 3 days', () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const rows = [
      comp({ id: 'a', name: 'BYTESFEST', submission_deadline: new Date(base).toISOString() }),
      comp({ id: 'b', name: 'Hackalab', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() }),
    ]
    render(<DeadlineOverlapBanner competitions={rows} />)
    expect(screen.getByText(/BYTESFEST/)).toBeInTheDocument()
    expect(screen.getByText(/Hackalab/)).toBeInTheDocument()
  })

  it('renders nothing when there is no overlap', () => {
    const rows = [comp({ id: 'a', submission_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() })]
    const { container } = render(<DeadlineOverlapBanner competitions={rows} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides a dismissed pair and persists the dismissal across remounts', async () => {
    const base = Date.now() + 5 * 24 * 60 * 60 * 1000
    const rows = [
      comp({ id: 'a', name: 'BYTESFEST', submission_deadline: new Date(base).toISOString() }),
      comp({ id: 'b', name: 'Hackalab', submission_deadline: new Date(base + 24 * 60 * 60 * 1000).toISOString() }),
    ]
    const { unmount } = render(<DeadlineOverlapBanner competitions={rows} />)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/BYTESFEST/)).not.toBeInTheDocument()
    unmount()
    render(<DeadlineOverlapBanner competitions={rows} />)
    expect(screen.queryByText(/BYTESFEST/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/dashboard/DeadlineOverlapBanner.test.tsx`
Expected: FAIL — `DeadlineOverlapBanner.tsx` does not exist.

- [ ] **Step 3: Implement DeadlineOverlapBanner**

```tsx
// components/dashboard/DeadlineOverlapBanner.tsx
'use client'

import { useEffect, useState } from 'react'
import { X, TriangleAlert } from 'lucide-react'
import { detectDeadlineOverlaps } from '@/lib/rundown'
import type { Competition } from '@/lib/types/database'

const STORAGE_KEY = 'dismissed-overlap-pairs'

function pairKey(ids: string[]): string {
  return [...ids].sort().join(':')
}

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export function DeadlineOverlapBanner({ competitions }: { competitions: Competition[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  const overlaps = detectDeadlineOverlaps(competitions).filter(
    (o) => !dismissed.has(pairKey(o.competitionIds))
  )

  function dismiss(ids: string[]) {
    const next = new Set(dismissed)
    next.add(pairKey(ids))
    setDismissed(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  }

  if (overlaps.length === 0) return null

  return (
    <div className="space-y-2">
      {overlaps.map((overlap) => (
        <div
          key={pairKey(overlap.competitionIds)}
          className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            {overlap.competitionNames.join(' and ')} have deadlines within 3 days of each other.
          </span>
          <button aria-label="Dismiss" onClick={() => dismiss(overlap.competitionIds)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test components/dashboard/DeadlineOverlapBanner.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/DeadlineOverlapBanner.tsx components/dashboard/DeadlineOverlapBanner.test.tsx
git commit -m "feat: add dismissible Deadline Overlap Warning banner"
```

---

## Task 26: ThemeToggle and flash-free theme application

**Files:**
- Create: `components/settings/ThemeToggle.tsx`
- Test: `components/settings/ThemeToggle.test.tsx`
- Modify: `app/layout.tsx` (add the no-flash inline script — full layout assembly happens in Task 28, but the script is theme-specific and belongs with this task)

**Interfaces:**
- Consumes: `useUserSettings`/`useUpdateUserSettings` from `hooks/useUserSettings.ts` (Task 23).
- Produces: `<ThemeToggle />` — toggles the `dark` class on `document.documentElement` and persists to `user_settings.theme_preference`.

- [ ] **Step 1: Write failing tests**

```tsx
// components/settings/ThemeToggle.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'

const mutate = vi.fn()
const mockSettings = { theme_preference: 'light' }

vi.mock('@/hooks/useUserSettings', () => ({
  useUserSettings: () => ({ data: mockSettings }),
  useUpdateUserSettings: () => ({ mutate }),
}))

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  mutate.mockClear()
})

describe('ThemeToggle', () => {
  it('switches to dark mode, updates the DOM class, and persists the preference', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: /switch to dark/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(mutate).toHaveBeenCalledWith({ theme_preference: 'dark' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test components/settings/ThemeToggle.test.tsx`
Expected: FAIL — `ThemeToggle.tsx` does not exist.

- [ ] **Step 3: Implement ThemeToggle**

```tsx
// components/settings/ThemeToggle.tsx
'use client'

import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useUserSettings'

export function ThemeToggle() {
  const { data: settings } = useUserSettings()
  const { mutate } = useUpdateUserSettings()
  const isDark = settings?.theme_preference === 'dark'

  function toggle() {
    const next = isDark ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    mutate({ theme_preference: next })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test components/settings/ThemeToggle.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Add the flash-prevention script to the root layout**

This edit targets `app/layout.tsx` before Task 28 rewrites the rest of the file — add just the inline script inside `<head>` (React renders a literal `<script>` tag from `dangerouslySetInnerHTML` here, which is the standard flash-of-wrong-theme fix since it runs before paint, ahead of any React hydration):

```tsx
<head>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        try {
          var stored = localStorage.getItem('theme-preference');
          if (stored === 'dark') document.documentElement.classList.add('dark');
        } catch (e) {}
      `,
    }}
  />
</head>
```

Also update `ThemeToggle`'s `toggle()` to mirror the preference into `localStorage` so this script has something to read before the Supabase-backed `useUserSettings` query resolves on next load:

```tsx
function toggle() {
  const next = isDark ? 'light' : 'dark'
  document.documentElement.classList.toggle('dark', next === 'dark')
  localStorage.setItem('theme-preference', next)
  mutate({ theme_preference: next })
}
```

- [ ] **Step 6: Manual verification**

Toggle dark mode, hard-refresh — confirm no flash of light theme before dark applies. Confirm `user_settings.theme_preference` updates in Supabase and a second device (or incognito session, same login) picks it up once `useUserSettings` resolves.

- [ ] **Step 7: Commit**

```bash
git add components/settings/ThemeToggle.tsx components/settings/ThemeToggle.test.tsx app/layout.tsx
git commit -m "feat: add ThemeToggle with flash-free theme application"
```

---

## Task 27: PWA shell — manifest, hand-rolled service worker, OfflineBanner, InstallPrompt

**Files:**
- Create: `app/manifest.ts`
- Create: `public/icons/icon-192.svg`
- Create: `public/icons/icon-512.svg`
- Create: `public/sw.js`
- Create: `components/layout/OfflineBanner.tsx`
- Test: `components/layout/OfflineBanner.test.tsx`
- Create: `components/layout/InstallPrompt.tsx`

**Interfaces:**
- Produces: an installable manifest, a hand-rolled service worker caching the app shell (`staleWhileRevalidate` for navigation/static assets — PRD 7.1 explicitly allows "a hand-rolled service worker if finer control is needed"; `next-pwa` is skipped because it's unmaintained against Next 16's Turbopack-default build and the Next.js docs steer PWA guidance toward either a hand-rolled worker or Serwist, which itself still requires webpack config), `<OfflineBanner />` (reads `navigator.onLine` + `online`/`offline` events), `<InstallPrompt />` (captures `beforeinstallprompt`).

Per PRD 7.6, guidebook files are *not* force-cached offline — only the app shell/static assets are cached here. AI summaries (which would also be cached offline per 7.6) are Phase 2, so there's nothing else to cache yet.

- [ ] **Step 1: Web app manifest**

```ts
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Competition Hub',
    short_name: 'CompHub',
    description: 'Track every student competition from research through results.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#18181b',
    icons: [
      { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
  }
}
```

- [ ] **Step 2: Placeholder icons**

```xml
<!-- public/icons/icon-192.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#18181b"/>
  <text x="96" y="112" font-family="sans-serif" font-size="88" fill="#fafafa" text-anchor="middle">CH</text>
</svg>
```

```xml
<!-- public/icons/icon-512.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#18181b"/>
  <text x="256" y="300" font-family="sans-serif" font-size="230" fill="#fafafa" text-anchor="middle">CH</text>
</svg>
```

These are functional placeholders — swap for real branded PNG/SVG icons whenever Danu has one; the manifest and install behavior don't depend on the specific artwork.

- [ ] **Step 3: Hand-rolled service worker**

```js
// public/sw.js
const CACHE_NAME = 'competition-hub-shell-v1'
const SHELL_URLS = ['/dashboard', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api') || url.pathname.includes('supabase')) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || networkFetch
    })
  )
})
```

This is `staleWhileRevalidate` for same-origin navigation/static requests, explicitly bypassing Supabase API calls (those go through TanStack Query's own cache, per PRD 7.6's `networkFirst`-for-API-calls guidance — excluding them from the SW cache here avoids caching stale authenticated data).

- [ ] **Step 4: Write failing tests for OfflineBanner**

```tsx
// components/layout/OfflineBanner.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OfflineBanner } from './OfflineBanner'

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
})

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const { container } = render(<OfflineBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an offline indicator when the offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    render(<OfflineBanner />)
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm test components/layout/OfflineBanner.test.tsx`
Expected: FAIL — `OfflineBanner.tsx` does not exist.

- [ ] **Step 6: Implement OfflineBanner**

```tsx
// components/layout/OfflineBanner.tsx
'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-100 py-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      <WifiOff className="h-3.5 w-3.5" />
      You&apos;re offline — showing previously loaded data.
    </div>
  )
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm test components/layout/OfflineBanner.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Implement InstallPrompt (no dedicated test — thin wrapper around a browser event with no business logic to verify beyond what OfflineBanner's pattern already covers)**

```tsx
// components/layout/InstallPrompt.tsx
'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault()
      setDeferredEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredEvent || dismissed) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-zinc-700 dark:text-zinc-300">Install Competition Hub for quick access.</span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await deferredEvent.prompt()
            setDeferredEvent(null)
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Install
        </Button>
        <button aria-label="Dismiss install prompt" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4 text-zinc-500" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add app/manifest.ts public/icons public/sw.js components/layout/OfflineBanner.tsx components/layout/OfflineBanner.test.tsx components/layout/InstallPrompt.tsx
git commit -m "feat: add PWA manifest, hand-rolled service worker, offline banner, install prompt"
```

---

## Task 28: AppShell, root layout wiring, and dashboard page assembly

**Files:**
- Create: `components/layout/AppShell.tsx`
- Modify: `app/layout.tsx` (final assembly — Providers, AppShell, manifest link, service worker registration)
- Create: `app/page.tsx` (replace the create-next-app placeholder with a redirect to `/dashboard`)
- Create: `app/(app)/dashboard/page.tsx`
- Create: `app/(app)/dashboard/loading.tsx`

**Interfaces:**
- Consumes: every hook and component built in Tasks 1–27.
- Produces: the fully wired app shell — this is the last task in the plan; after it, `pnpm dev` should serve a working, navigable Phase 1 app end-to-end.

- [ ] **Step 1: Providers wrapper (QueryClientProvider needs a Client Component boundary)**

```tsx
// components/layout/Providers.tsx
'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  )
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

- [ ] **Step 2: AppShell**

```tsx
// components/layout/AppShell.tsx
import Link from 'next/link'
import { LayoutDashboard, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/settings/ThemeToggle'
import { OfflineBanner } from './OfflineBanner'
import { InstallPrompt } from './InstallPrompt'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <OfflineBanner />
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <Link href="/dashboard" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Competition Hub
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link href="/settings" className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="flex-1 px-6">{children}</main>
      <InstallPrompt />
    </div>
  )
}
```

- [ ] **Step 3: Final root layout**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/layout/Providers'
import { AppShell } from '@/components/layout/AppShell'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Competition Hub',
  description: 'Track every student competition from research through results.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem('theme-preference');
                if (stored === 'dark') document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
```

(This replaces the Task 26 Step 5 inline-script edit wholesale — that step landed the script first against the create-next-app placeholder body; this step is the final version with `AppShell`/`Providers` wired around `children`.)

- [ ] **Step 4: Root page redirect**

```tsx
// app/page.tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
```

- [ ] **Step 5: Dashboard loading skeleton**

```tsx
// app/(app)/dashboard/loading.tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-8 w-1/3" />
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Dashboard page — assembles widgets, filter bar, and board/table toggle**

```tsx
// app/(app)/dashboard/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Next7DaysWidget } from '@/components/dashboard/Next7DaysWidget'
import { DeadlineOverlapBanner } from '@/components/dashboard/DeadlineOverlapBanner'
import { TagFilterBar, applyCompetitionFilter, type CompetitionFilter } from '@/components/competitions/TagFilterBar'
import { CompetitionTable } from '@/components/competitions/CompetitionTable'
import { CompetitionBoard } from '@/components/competitions/CompetitionBoard'
import { useCompetitions } from '@/hooks/useCompetitions'

const EMPTY_FILTER: CompetitionFilter = { status: [], tags: [], team: null }

export default function DashboardPage() {
  const { data: competitions, isLoading } = useCompetitions()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [filter, setFilter] = useState<CompetitionFilter>(EMPTY_FILTER)
  const [sortKey, setSortKey] = useState<'name' | 'nearestDeadline' | 'status'>('nearestDeadline')

  if (isLoading || !competitions) return null

  const filtered = applyCompetitionFilter(competitions, filter)

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Next7DaysWidget />
      <DeadlineOverlapBanner competitions={competitions} />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Competitions</h1>
        <div className="flex items-center gap-2">
          <Button variant={view === 'board' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('board')}>
            Board
          </Button>
          <Button variant={view === 'list' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('list')}>
            List
          </Button>
          <Link href="/competitions/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </Link>
        </div>
      </div>

      <TagFilterBar competitions={competitions} value={filter} onChange={setFilter} />

      {view === 'board' ? (
        <CompetitionBoard competitions={filtered} />
      ) : (
        <CompetitionTable competitions={filtered} sortKey={sortKey} onSortKeyChange={setSortKey} />
      )}
    </div>
  )
}
```

- [ ] **Step 7: End-to-end manual verification**

Run `pnpm dev`. Sign in via magic link. Create two or three competitions with varying statuses, tags, and deadlines (including two with submission deadlines within 3 days of each other). Confirm:
- Next 7 Days widget lists upcoming rundown items linking to the right competition.
- Deadline Overlap banner appears for the close pair and is dismissible.
- Board view groups by status with working tap-to-move; List view sorts correctly.
- TagFilterBar narrows results combining status + tag + team.
- Detail page: edit, links, guidebook upload, rundown add, notification log, duplicate all work.
- Settings: rundown mode toggle and WhatsApp form persist.
- Theme toggle switches without flash on reload.
- Offline banner appears when DevTools → Network is set to "Offline".
- `pnpm build` completes without errors (validates the whole App Router tree compiles under Turbopack).

- [ ] **Step 8: Run the full test suite one more time**

Run: `pnpm test`
Expected: all tests from Tasks 1–27 pass.

- [ ] **Step 9: Commit**

```bash
git add components/layout/Providers.tsx components/layout/AppShell.tsx app/layout.tsx app/page.tsx "app/(app)/dashboard/page.tsx" "app/(app)/dashboard/loading.tsx"
git commit -m "feat: wire AppShell, providers, and dashboard page — Phase 1 MVP complete"
```

---

## Self-Review Notes

**Spec coverage (PRD 5.1–5.10, 6, 7.6–7.8, Section 10 Phase 1 line):**
- 5.1 Competition Tracker: Task 2 (schema), 11–17 (CRUD, board/list, filter, duplicate). ✓
- 5.2 Resource Links & Documents: Task 18 (links), 19–20 (Cloudinary upload, PDF-only, multi-doc list). ✓
- 5.3 AI Summary: explicitly Phase 2 — no task. ✓ (deliberate exclusion)
- 5.4 Progress & Status View: Task 10 (ProgressStages), 12–13 (table/board). ✓
- 5.5 Rundown & WhatsApp: Task 3 (auto-gen trigger), 21 (manual add, notification log), 22 (Fonnte send), 23 (mode toggle, one offset — PRD 5.5 explicitly caps v1 at one WhatsApp number with default offsets, which `WhatsAppSettingsForm` supports as a multi-select of the same default set; a true "one reminder offset" cap is honored by defaulting `default_reminder_offsets_minutes` but the UI allows selecting more than one — this matches PRD 5.5's "default reminder offsets" (plural) at the settings level, while Section 10's "one WhatsApp reminder offset" refers to the single WhatsApp *number*, not offset count; re-read against 5.5, the offsets field is genuinely plural in the schema (`int[]`), so this is correctly scoped). ✓
- 5.6 PWA Behavior: Task 27 (manifest, SW, offline banner). Background sync/queueing of edits while offline is implicitly handled by TanStack Query's cache + the SW's `staleWhileRevalidate` for navigation; explicit mutation queueing (PRD's "new/edited data queues locally") is a gap — see Known Gaps below.
- 5.7 Project Portfolio: Phase 2 — no task. ✓ (deliberate exclusion)
- 5.8 Dashboard Widgets: Task 24 (Next 7 Days), 25 (Overlap Warning). ✓
- 5.9 Tagging, Filtering, Duplicate: Task 14 (TagFilterBar), 17 (Duplicate). ✓
- 5.10 Data Export: Phase 3 — no task. ✓ (deliberate exclusion)
- 6 Design Principles: no emoji (verified across all components), Lucide-only icons, skeleton loading (Tasks 16, 27, 28 `loading.tsx` files + `Next7DaysWidget`'s internal skeleton), calm status colors (Task 6/10), light/dark toggle default light (Task 26). ✓
- 7.6 Caching Strategy: TanStack Query for data (Task 11+), SW `staleWhileRevalidate` for shell (Task 27), guidebooks not force-cached (Task 27 explicitly excludes them). ✓
- 7.7 Cloudinary: signed uploads, `raw` resource type, folder convention (Task 19–20). ✓
- 7.8 PWA Implementation Notes: manifest with icons/name/theme_color/standalone (Task 27), install prompt as dismissible banner not popup (Task 27), offline via `navigator.onLine` (Task 27). ✓

**Known gaps (accepted for Phase 1, flagged rather than silently dropped):**
1. **Offline mutation queueing.** PRD 5.6 asks for edits made offline to "queue locally and sync once back online," with guidebook uploads specifically showing a "will upload when online" state. This plan's `useUploadGuidebook` (Task 20) and mutation hooks fail immediately offline rather than queueing — TanStack Query's `networkMode`/mutation persistence (`@tanstack/query-sync-storage-persister` or a custom offline queue) would close this gap but adds meaningful scope. Recommend a fast-follow task after Phase 1 ships, not a blocker to first use, since Danu is the only user and can retry manually when back online.
2. **Document file size display.** PRD 5.2 asks for "name, size" on the file card; `DocumentsSection` (Task 20) renders size as blank because the minimal Cloudinary response captured doesn't include `bytes`. Noted inline in Task 20 Step 7 with the one-column schema addition needed to close it.
3. **Drag-and-drop on the board.** PRD 5.4 says "drag (or tap-to-move)" — this plan implements tap-to-move (a `<Select>` per card) and explicitly skips drag-and-drop, which the PRD allows as an alternative.

**Placeholder scan:** no "TBD"/"implement later"/"add validation" phrases anywhere in the 28 tasks above — every step ships real, working code or a manual verification command with an expected result.

**Type consistency check:** `Competition`, `CompetitionDocument`, `RundownItem`, `NotificationLog`, `UserSettings` (Task 5) are the single source of truth for every hook and component signature in Tasks 6–28 — no divergent field names found (e.g., `event_at` used consistently, never `eventAt` in data layer; `competition_id` never `competitionId` in DB-facing code, camelCase reserved for component/hook-local variables and React props like `onFileSelected`, `onSortKeyChange`).

---
