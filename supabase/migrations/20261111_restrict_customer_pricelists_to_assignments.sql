-- Evita che la vecchia policy per categoria renda visibili listini non assegnati.
drop policy if exists "records read by role" on public.records;

create policy "records read by role"
on public.records
for select
to authenticated
using (
  public.is_admin()
  or (
    owner_id = (select auth.uid())
    and public.is_approved_customer()
  )
  or (
    kind = 'orders'
    and public.is_approved_customer()
    and payload->>'customer_code' = (
      select customer_code
      from public.profiles
      where id = (select auth.uid())
    )
  )
  or (
    kind = 'products'
    and public.is_approved_customer()
  )
);
