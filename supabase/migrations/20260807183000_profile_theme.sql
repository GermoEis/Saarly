-- Iga kasutaja hele/tume eelistus. Muuta saab ainult enda profiili olemasoleva RLS-poliitika kaudu.
alter table public.profiles
  add column theme_preference text not null default 'light'
  check (theme_preference in ('light', 'dark'));
