-- All fixture records must be wrapped in BEGIN/ROLLBACK.
create temporary table historic_source_access_results(test text,passed boolean);
grant all on historic_source_access_results to authenticated;
do $$ declare c uuid:=gen_random_uuid();p uuid:=gen_random_uuid();u uuid:=gen_random_uuid();r uuid:=gen_random_uuid();path text;
begin
 insert into auth.users(id,email) values(u,'qa-historic-access-'||u||'@example.invalid');
 insert into public.companies(id,name,slug) values(c,'TEST historical customer access','qa-historic-'||c);
 insert into public.properties(id,company_id,name,reference_code) values(p,c,'TEST only','TEST-HISTORIC');
 insert into public.company_memberships(company_id,user_id,role_id,status,access_expires_at) select c,u,id,'active',now()+interval '14 days' from public.roles where code='client';
 insert into public.orion_customer_properties(user_id,property_id,granted_by) values(u,p,u);
 path:=c||'/'||p||'/rps/qa-photo.jpeg';
 insert into public.orion_reports(id,company_id,property_id,document_number,report_type,title,status,current_version,created_by) values(r,c,p,'QA-HISTORIC-'||r,'property_fire_door_report','TEST historic demo','generated',1,u);
 insert into public.orion_report_versions(report_id,version_no,source_snapshot,generated_by) values(r,1,jsonb_build_object('historic_source',jsonb_build_object('files',jsonb_build_array(jsonb_build_object('bucket','generated-documents','storage_path',path)))),u);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',u::text,true);
 set local role authenticated;
 insert into historic_source_access_results values('Unshared historic source denied',not public.orion_can_read_storage('generated-documents',path));
 reset role;update public.orion_reports set status='issued',issued_at=now() where id=r;
 set local role authenticated;
 insert into historic_source_access_results values('Exact issued historic source allowed',public.orion_can_read_storage('generated-documents',path));
 insert into historic_source_access_results values('Unlisted path in same folder denied',not public.orion_can_read_storage('generated-documents',c||'/'||p||'/rps/not-listed.jpeg'));
 insert into historic_source_access_results values('Wrong storage bucket denied',not public.orion_can_read_storage('inspection-evidence',path));
 reset role;update public.company_memberships set access_expires_at=now()-interval '1 second' where user_id=u and company_id=c;
 set local role authenticated;
 insert into historic_source_access_results values('Expired issued historic source denied',not public.orion_can_read_storage('generated-documents',path));
 reset role;
end $$;
select jsonb_agg(to_jsonb(t)) as results from historic_source_access_results t;
