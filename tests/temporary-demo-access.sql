-- Run in BEGIN/ROLLBACK. Synthetic user, existing Chiswick property; no credentials or invitations.
create temporary table demo_expiry_results(test text,passed boolean);
grant all on demo_expiry_results to authenticated;
do $$ declare u uuid:=gen_random_uuid(); c uuid; p uuid; admin_id uuid; storage_path text;
begin
 select id,company_id into p,c from public.properties where id='eee51502-dffc-4f23-b6b7-68b226056718';
 select user_id into admin_id from public.company_memberships m join public.roles r on r.id=m.role_id where company_id=c and r.code='company_admin' and status='active' limit 1;
 insert into auth.users(id,email) values(u,'qa-trial-'||u||'@example.invalid');
 insert into public.company_memberships(company_id,user_id,role_id,status,access_expires_at) select c,u,id,'active',now()+interval '14 days' from public.roles where code='client';
 insert into public.orion_customer_properties(user_id,property_id,granted_by) values(u,p,admin_id);
 select name into storage_path from storage.objects where bucket_id='generated-documents' and name like c||'/'||p||'/rps/%' limit 1;
 -- Explicitly shared source file required; company membership alone never grants it.
 insert into public.document_vault(property_id,category,filename,storage_path) values(p,'QA expiry fixture','QA source',storage_path);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',u::text,true);
 set local role authenticated;
 insert into demo_expiry_results values('Trial can read assigned property',public.orion_can_access_property(p));
 insert into demo_expiry_results values('Trial sees 264 Chiswick doors',(select count(*)=264 from public.assets where property_id=p));
 insert into demo_expiry_results values('Trial cannot read other properties',(select count(*)=0 from public.properties where id<>p));
 insert into demo_expiry_results values('Trial can read explicitly shared source',public.orion_can_read_storage('generated-documents',storage_path));
 insert into demo_expiry_results values('Trial cannot generate or issue reports',not public.has_permission(c,'report.generate') and not public.has_permission(c,'report.issue'));
 reset role;
 update public.company_memberships set access_expires_at=now()-interval '1 second' where company_id=c and user_id=u;
 set local role authenticated;
 insert into demo_expiry_results values('Expired token loses membership',not public.is_company_member(c));
 insert into demo_expiry_results values('Expired token loses property',not public.orion_can_access_property(p));
 insert into demo_expiry_results values('Expired token loses asset rows',(select count(*)=0 from public.assets where property_id=p));
 insert into demo_expiry_results values('Expired token loses storage',not public.orion_can_read_storage('generated-documents',storage_path));
 insert into demo_expiry_results values('Expired own workspace hidden',(select count(*)=0 from public.company_memberships where user_id=u));
 insert into demo_expiry_results values('Expiry retains restrictive customer classification',public.orion_is_customer_member(c));
 reset role;
end $$;
select jsonb_agg(to_jsonb(t)) as results from demo_expiry_results t;
