-- Historic source imports preserve provenance and do not create inspection runs or live defect conclusions.
create or replace function public.orion_build_historic_fire_door_snapshot(p_property_id uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
 'property',(select to_jsonb(p)-'company_id'-'created_at'-'updated_at' from public.properties p where p.id=p_property_id),
 'historic_source',(select a.metadata->'historic_source' from public.assets a where a.property_id=p_property_id and a.metadata ? 'historic_source' order by a.asset_code limit 1),
 'summary',jsonb_build_object('assets',count(*),'actions',coalesce(sum(jsonb_array_length(a.metadata->'historic_rps'->'actions')),0),'detail_available',count(*) filter(where (a.metadata->'historic_rps'->>'detail_available')::boolean),'photo_links',coalesce(sum(jsonb_array_length(a.metadata->'historic_rps'->'photos')),0)),
 'doors',coalesce(jsonb_agg((a.metadata->'historic_rps')||jsonb_build_object('asset_id',a.id,'asset_code',a.asset_code) order by a.metadata->'historic_rps'->>'floor',a.asset_code),'[]'::jsonb),
 'generated_at',now()
) from public.assets a where a.property_id=p_property_id and a.metadata ? 'historic_rps';
$$;
revoke all on function public.orion_build_historic_fire_door_snapshot(uuid) from public,anon,authenticated;

create or replace function public.orion_generate_property_fire_door_report(p_property_id uuid,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_property public.properties%rowtype;v_report_id uuid;v_version integer;v_snapshot jsonb;v_doc_no text;v_historic boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into v_property from public.properties where id=p_property_id;
 if not found then raise exception 'Property not found';end if;
 if not (public.is_platform_admin() or public.has_permission(v_property.company_id,'report.generate')) or public.orion_is_customer_member(v_property.company_id) then raise exception 'You do not have permission to generate reports';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text||':property-report',0));
 select exists(select 1 from public.assets where property_id=p_property_id and metadata ? 'historic_source') into v_historic;
 if v_historic then v_snapshot:=public.orion_build_historic_fire_door_snapshot(p_property_id);
 else v_snapshot:=public.orion_build_property_fire_door_snapshot(p_property_id);end if;
 select id,current_version into v_report_id,v_version from public.orion_reports where property_id=p_property_id and report_type='property_fire_door_report' for update;
 if v_report_id is null then
  v_doc_no:='FDR-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.orion_report_number_seq')::text,5,'0');
  insert into public.orion_reports(company_id,property_id,inspection_id,document_number,report_type,title,current_version,created_by)
  values(v_property.company_id,p_property_id,null,v_doc_no,'property_fire_door_report',case when v_historic then 'Historic RPS Survey Review - ' else 'Fire Door Inspection & Remedial Report - ' end||v_property.name,1,auth.uid()) returning id into v_report_id;
  v_version:=1;
 else
  v_version:=v_version+1;
  update public.orion_reports set current_version=v_version,status='generated',updated_at=now() where id=v_report_id;
 end if;
 insert into public.orion_report_versions(report_id,version_no,source_snapshot,generated_by,notes) values(v_report_id,v_version,v_snapshot,auth.uid(),nullif(trim(p_notes),''));
 return v_report_id;
end;$$;
revoke all on function public.orion_generate_property_fire_door_report(uuid,text) from public,anon;
grant execute on function public.orion_generate_property_fire_door_report(uuid,text) to authenticated;
