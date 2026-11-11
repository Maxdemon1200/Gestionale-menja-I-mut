-- Supporto a più listini per cliente, mantenendo il campo singolo per compatibilità.
alter table public.profiles
add column if not exists price_list_ids uuid[] not null default '{}'::uuid[];

-- I clienti approvati possono leggere solo i listini assegnati al proprio profilo.
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
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and (
            payload->>'id' = p.price_list_id::text
            or (payload->>'id')::uuid = any(coalesce(p.price_list_ids, '{}'::uuid[]))
          )
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
