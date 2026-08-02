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
$$ language plpgsql set search_path = public, pg_temp;

create or replace function sync_all_user_auto_rundowns(p_user_id uuid)
returns void as $$
declare
  c record;
begin
  for c in select * from competitions where user_id = p_user_id loop
    perform sync_auto_rundown_item(c.id, 'registration_deadline', 'Registration deadline', c.registration_deadline);
    perform sync_auto_rundown_item(c.id, 'submission_deadline', 'Submission deadline', c.submission_deadline);
    perform sync_auto_rundown_item(c.id, 'event_start_at', 'Event starts', c.event_start_at);
    perform sync_auto_rundown_item(c.id, 'event_end_at', 'Event ends', c.event_end_at);
  end loop;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function handle_competition_auto_rundown()
returns trigger as $$
declare
  v_mode rundown_generation_mode;
begin
  select rundown_generation_mode into v_mode
  from user_settings where id = new.user_id;

  if coalesce(v_mode, 'auto') != 'auto' then
    return new;
  end if;

  perform sync_auto_rundown_item(new.id, 'registration_deadline', 'Registration deadline', new.registration_deadline);
  perform sync_auto_rundown_item(new.id, 'submission_deadline', 'Submission deadline', new.submission_deadline);
  perform sync_auto_rundown_item(new.id, 'event_start_at', 'Event starts', new.event_start_at);
  perform sync_auto_rundown_item(new.id, 'event_end_at', 'Event ends', new.event_end_at);

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists competitions_auto_rundown on competitions;
create trigger competitions_auto_rundown
  after insert or update of registration_deadline, submission_deadline, event_start_at, event_end_at
  on competitions
  for each row execute function handle_competition_auto_rundown();

create or replace function handle_user_settings_auto_rundown()
returns trigger as $$
begin
  if new.rundown_generation_mode = 'auto' and (old is null or old.rundown_generation_mode != 'auto') then
    perform sync_all_user_auto_rundowns(new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists user_settings_auto_rundown on user_settings;
create trigger user_settings_auto_rundown
  after insert or update of rundown_generation_mode
  on user_settings
  for each row execute function handle_user_settings_auto_rundown();
