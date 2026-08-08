-- ORION Enterprise v1.0
-- Update 017: Regulatory intelligence and portal access

-- Official regulatory source metadata is readable by authenticated ORION users.
drop policy if exists regulatory_sources_read on public.regulatory_sources;
create policy regulatory_sources_read on public.regulatory_sources
for select to authenticated
using (true);

-- Portal users can see their own record and company members can administer their company's portal users.
drop policy if exists portal_users_self_or_admin on public.portal_users;
create policy portal_users_self_or_admin on public.portal_users
for select to authenticated
using (
  id = auth.uid()
  or (company_id is not null and public.is_company_member(company_id))
);

-- Vault records are scoped through the owning property/company.
drop policy if exists document_vault_company_read on public.document_vault;
create policy document_vault_company_read on public.document_vault
for select to authenticated
using (
  property_id is not null and exists (
    select 1 from public.properties p
    where p.id = document_vault.property_id
      and public.is_company_member(p.company_id)
  )
);

-- Portal messages are property/company scoped.
drop policy if exists portal_messages_company_read on public.portal_messages;
create policy portal_messages_company_read on public.portal_messages
for select to authenticated
using (
  property_id is not null and exists (
    select 1 from public.properties p
    where p.id = portal_messages.property_id
      and public.is_company_member(p.company_id)
  )
);

drop policy if exists portal_messages_company_insert on public.portal_messages;
create policy portal_messages_company_insert on public.portal_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and property_id is not null
  and exists (
    select 1 from public.properties p
    where p.id = portal_messages.property_id
      and public.is_company_member(p.company_id)
  )
);
