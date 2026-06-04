create table public.wishlist_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  search_term text not null check (char_length(search_term) between 2 and 200),
  normalized text not null,
  fulfilled boolean not null default false,
  fulfilled_listing_id uuid references public.listings(id) on delete set null,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index idx_wishlist_alerts_user on public.wishlist_alerts (user_id, created_at desc);
create index idx_wishlist_alerts_pending on public.wishlist_alerts (normalized) where fulfilled = false;

grant select, insert, update, delete on public.wishlist_alerts to authenticated;
grant all on public.wishlist_alerts to service_role;

alter table public.wishlist_alerts enable row level security;

create policy "wishlist_self_select" on public.wishlist_alerts
  for select to authenticated using (auth.uid() = user_id);
create policy "wishlist_self_insert" on public.wishlist_alerts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "wishlist_self_delete" on public.wishlist_alerts
  for delete to authenticated using (auth.uid() = user_id);
create policy "wishlist_self_update" on public.wishlist_alerts
  for update to authenticated using (auth.uid() = user_id);

create or replace function public.notify_wishlist_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  hay text;
begin
  if new.status <> 'active' then
    return new;
  end if;
  hay := lower(coalesce(new.title,'') || ' ' || coalesce(new.category,'') || ' ' || coalesce(new.description,''));
  for r in
    select id, user_id, search_term, normalized
    from public.wishlist_alerts
    where fulfilled = false
      and user_id <> new.owner_id
      and position(normalized in hay) > 0
    limit 20
  loop
    insert into public.notifications (user_id, type, title, body, link)
    values (
      r.user_id,
      'wishlist_match',
      'توفّر ما كنت تبحث عنه',
      'تم نشر إعلان يطابق "' || r.search_term || '": ' || new.title,
      '/listings/' || new.id::text
    );
    update public.wishlist_alerts
      set fulfilled = true, fulfilled_at = now(), fulfilled_listing_id = new.id
      where id = r.id;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_wishlist_matches on public.listings;
create trigger trg_notify_wishlist_matches
  after insert on public.listings
  for each row execute function public.notify_wishlist_matches();