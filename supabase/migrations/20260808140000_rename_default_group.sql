-- Asenda varasem vaikimisi tööruumi nimi neutraalse grupinimega.
update public.groups
set name = 'Meie grupp', updated_at = now()
where name = 'Meie pere';
