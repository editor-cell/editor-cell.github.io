-- Orbis members: membership, comments and members-only texts.
--
-- Run once in the Supabase project: SQL Editor → New query → paste this file → Run.
-- Running it again is safe; it creates only what is missing and replaces the functions.
--
-- Who can do what is decided here, in the database, not in the page: the page only asks,
-- and these rules answer. A reader can never make themselves editor or paid member,
-- read a members-only text without a paid membership, or post a link.

-- ---------------------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 2 and 40),
  role text not null default 'reader' check (role in ('reader', 'editor')),
  -- Paid membership runs until this moment; null or past means not paid.
  paid_until timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'editor');
$$;

create or replace function public.is_paid() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'editor' or paid_until > now())
  );
$$;

-- Every new sign-up gets a profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A reader may change only their display name. Role, paid time and e-mail are set by the
-- editor in the panel, by the payment provider later, or here in the SQL editor.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_editor() then
    if new.id is distinct from old.id
      or new.role is distinct from old.role
      or new.paid_until is distinct from old.paid_until
      or new.email is distinct from old.email then
      raise exception 'not_allowed';
    end if;
  end if;
  if new.display_name is not null then
    new.display_name := btrim(new.display_name);
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile();

alter table public.profiles enable row level security;

drop policy if exists "profiles: own or editor reads" on public.profiles;
create policy "profiles: own or editor reads" on public.profiles
  for select using (id = auth.uid() or public.is_editor());

drop policy if exists "profiles: own or editor updates" on public.profiles;
create policy "profiles: own or editor updates" on public.profiles
  for update using (id = auth.uid() or public.is_editor());

-- ---------------------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------------------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  story_id text not null check (char_length(story_id) between 1 and 200),
  lang text not null check (lang in ('tr', 'ar', 'en', 'fr', 'es')),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The name shown with the comment, copied from the profile when it is written.
  author_name text not null default '',
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  hidden boolean not null default false,
  report_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists comments_story on public.comments (story_id, lang, created_at);

-- Words a comment may not contain, as whole words. The editor adds and removes them in
-- the panel.
create table if not exists public.blocked_words (
  word text primary key check (char_length(word) between 2 and 40)
);

insert into public.blocked_words (word) values
  ('amk'), ('aq'), ('orospu'), ('piç'), ('siktir'), ('sikerim'), ('sikeyim'), ('yarrak'),
  ('pezevenk'), ('gavat'), ('amına'), ('ibne'),
  ('fuck'), ('fucking'), ('motherfucker'), ('shit'), ('bitch'), ('cunt'), ('asshole'),
  ('nigger'), ('faggot'),
  ('merde'), ('putain'), ('connard'), ('salope'),
  ('mierda'), ('puta'), ('cabrón'), ('gilipollas')
on conflict (word) do nothing;

-- Text folded for the word check: case does not count, and the Turkish dotted and dotless
-- i meet plain i, so "PİÇ" is caught as "piç" whatever the database's locale.
create or replace function public.fold_text(t text) returns text
language sql immutable as $$
  select lower(translate(t,
    'İIıÀÂÄÇÉÈÊËÎÏÔÖÙÛÜÑÁÍÓÚĞŞ',
    'iiiàâäçéèêëîïôöùûüñáíóúğş'));
$$;

-- Checks a comment before it is saved. The page shows a message for each refusal:
-- name_required, links, words, too_fast, too_many.
create or replace function public.prepare_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  name text;
begin
  if auth.uid() is null then
    raise exception 'sign_in_required';
  end if;
  new.user_id := auth.uid();
  new.hidden := false;
  new.report_count := 0;
  new.created_at := now();
  new.body := btrim(new.body);

  select display_name into name from public.profiles where id = new.user_id;
  if name is null or char_length(name) < 2 then
    raise exception 'name_required';
  end if;
  new.author_name := name;

  -- No links: addresses, www. and bare domains.
  if new.body ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|co|tr|info|xyz|ru|me|ly|gl|link|site|online|shop)(/|\M))' then
    raise exception 'links';
  end if;

  if exists (
    select 1 from public.blocked_words w
    where public.fold_text(new.body) ~ ('(^|[^[:alnum:]])'
      || regexp_replace(public.fold_text(w.word), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g')
      || '($|[^[:alnum:]])')
  ) then
    raise exception 'words';
  end if;

  -- One comment a minute, thirty a day.
  if exists (
    select 1 from public.comments
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) then
    raise exception 'too_fast';
  end if;
  if (
    select count(*) from public.comments
    where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'too_many';
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_comment on public.comments;
create trigger prepare_comment
  before insert on public.comments
  for each row execute function public.prepare_comment();

alter table public.comments enable row level security;
alter table public.blocked_words enable row level security;

drop policy if exists "comments: visible to all" on public.comments;
create policy "comments: visible to all" on public.comments
  for select using (not hidden or public.is_editor());

drop policy if exists "comments: members write" on public.comments;
create policy "comments: members write" on public.comments
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "comments: editor hides or restores" on public.comments;
create policy "comments: editor hides or restores" on public.comments
  for update using (public.is_editor());

drop policy if exists "comments: author or editor deletes" on public.comments;
create policy "comments: author or editor deletes" on public.comments
  for delete using (user_id = auth.uid() or public.is_editor());

drop policy if exists "blocked words: editor" on public.blocked_words;
create policy "blocked words: editor" on public.blocked_words
  for all using (public.is_editor()) with check (public.is_editor());

-- ---------------------------------------------------------------------------------------
-- Reports: three reports from three members hide a comment until the editor looks at it.
-- ---------------------------------------------------------------------------------------

create table if not exists public.comment_reports (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create or replace function public.count_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.comments where id = new.comment_id and user_id = new.user_id) then
    raise exception 'own_comment';
  end if;
  update public.comments
    set report_count = report_count + 1,
        hidden = hidden or report_count + 1 >= 3
    where id = new.comment_id;
  return new;
end;
$$;

drop trigger if exists count_report on public.comment_reports;
create trigger count_report
  after insert on public.comment_reports
  for each row execute function public.count_report();

alter table public.comment_reports enable row level security;

drop policy if exists "reports: members report" on public.comment_reports;
create policy "reports: members report" on public.comment_reports
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "reports: own or editor reads" on public.comment_reports;
create policy "reports: own or editor reads" on public.comment_reports
  for select using (user_id = auth.uid() or public.is_editor());

drop policy if exists "reports: editor clears" on public.comment_reports;
create policy "reports: editor clears" on public.comment_reports
  for delete using (public.is_editor());

-- ---------------------------------------------------------------------------------------
-- Members-only texts. The public story file holds only the opening; the full text of a
-- members-only reading lives here, one row per language, readable by paid members.
-- ---------------------------------------------------------------------------------------

create table if not exists public.member_texts (
  story_id text not null check (char_length(story_id) between 1 and 200),
  lang text not null check (lang in ('tr', 'ar', 'en', 'fr', 'es')),
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (story_id, lang)
);

alter table public.member_texts enable row level security;

drop policy if exists "member texts: paid members read" on public.member_texts;
create policy "member texts: paid members read" on public.member_texts
  for select using (public.is_paid());

drop policy if exists "member texts: editor writes" on public.member_texts;
create policy "member texts: editor writes" on public.member_texts
  for all using (public.is_editor()) with check (public.is_editor());

-- ---------------------------------------------------------------------------------------
-- Read counts (the "Most read" column on the front page)
-- ---------------------------------------------------------------------------------------
-- One row per reading. Nobody writes to the table directly: a reading page calls
-- count_read once per visit, and the front page asks most_read for the top of the list.

create table if not exists public.reads (
  story_id text primary key check (story_id ~ '^[a-z0-9-]{1,80}$'),
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.reads enable row level security;

drop policy if exists "reads: anyone reads" on public.reads;
create policy "reads: anyone reads" on public.reads for select using (true);

create or replace function public.count_read(p_story text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_story is null or p_story !~ '^[a-z0-9-]{1,80}$' then
    return;
  end if;
  insert into public.reads (story_id, count) values (p_story, 1)
  on conflict (story_id) do update set count = public.reads.count + 1, updated_at = now();
end;
$$;

create or replace function public.most_read(p_limit int default 5)
returns table (story_id text, count bigint)
language sql stable security definer set search_path = public as $$
  select r.story_id, r.count from public.reads r
  order by r.count desc, r.updated_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

grant execute on function public.count_read(text) to anon, authenticated;
grant execute on function public.most_read(int) to anon, authenticated;
