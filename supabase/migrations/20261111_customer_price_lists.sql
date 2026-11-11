-- Menja i Mut: listini multipli e assegnazione per singolo cliente.
-- Eseguire una sola volta nel SQL Editor di Supabase.
-- Mantiene intatte le policy di lettura già presenti e aggiunge solo gli accessi necessari.

alter table public.profiles
  add column if not exists price_list_id uuid;

-- Policy dedicata ai clienti approvati: non sostituisce la policy di lettura esistente.
drop policy if exists "approved customers read catalog and assigned pricelists"
  on public.records;

create policy "approved customers read catalog and assigned pricelists"
on public.records
for select
to authenticated
using (
  public.is_approved_customer()
  and (
    kind = 'products'
    or (
      kind = 'pricelists'
      and payload->>'id' = (
        select price_list_id::text
        from public.profiles
        where id = (select auth.uid())
      )
    )
    or (
      kind = 'orders'
      and payload->>'customer_code' = (
        select customer_code
        from public.profiles
        where id = (select auth.uid())
      )
    )
  )
);
