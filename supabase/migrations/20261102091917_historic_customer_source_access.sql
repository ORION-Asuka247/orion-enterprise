-- Only exact source files in the currently shared historical report are customer-readable.
create or replace function public.orion_can_read_storage(p_bucket text,p_path text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare c uuid;
begin
 if auth.uid() is null then return false; end if;
 if p_bucket not in ('inspection-evidence','completion-evidence','generated-documents') then return true; end if;
 begin c:=split_part(p_path,'/',1)::uuid; exception when invalid_text_representation then return false; end;
 if not public.is_company_member(c) then return false; end if;
 if not public.orion_is_customer_member(c) then return true; end if;
 if p_bucket='generated-documents' then
   return exists(select 1 from public.document_vault v where (v.storage_path=p_path or v.storage_path='generated-documents/'||p_path)
     and public.orion_can_access_property(v.property_id)) or exists(
     select 1 from public.orion_reports r join public.orion_report_versions rv on rv.report_id=r.id and rv.version_no=r.current_version
     cross join lateral jsonb_array_elements(coalesce(rv.source_snapshot->'historic_source'->'files','[]'::jsonb)) f
     where r.company_id=c and r.status='issued' and public.orion_can_read_report(r.id)
     and public.orion_can_access_property(r.property_id) and f->>'bucket'='generated-documents' and f->>'storage_path'=p_path);

 end if;
 return exists(select 1 from public.orion_reports r join public.orion_report_versions v on v.report_id=r.id and v.version_no=r.current_version
   where r.company_id=c and r.status='issued' and public.orion_can_read_report(r.id) and (
     (p_bucket='inspection-evidence' and exists(
       select 1 from public.orion_inspection_evidence e where e.inspection_id=r.inspection_id and e.storage_path=p_path
       and exists(select 1 from jsonb_array_elements(coalesce(v.source_snapshot->'evidence','[]')) x where x->>'id'=e.id::text)))
     or (p_bucket='completion-evidence' and exists(
       select 1 from jsonb_array_elements(coalesce(v.source_snapshot->'completions','[]')) cs,
         jsonb_array_elements(coalesce(cs->'photos','[]')) ph where ph->>'storage_path'=p_path))
   ));
end; $$;
revoke all on function public.orion_can_read_storage(text,text) from public,anon;
grant execute on function public.orion_can_read_storage(text,text) to authenticated;
