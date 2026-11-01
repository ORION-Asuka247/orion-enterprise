-- Run after the completion migration inside BEGIN/ROLLBACK. No real customer data.
create temporary table orion_qa_results (name text, passed boolean, detail jsonb);
create temporary table orion_qa_reports (asset_code text, snapshot jsonb);
grant all on orion_qa_results,orion_qa_reports to authenticated;
insert into orion_qa_results values('Anonymous completion submit denied',not has_function_privilege('anon','public.orion_submit_completion(uuid,text,text,text)','EXECUTE'),'{}');
insert into orion_qa_results values('Anonymous completion review denied',not has_function_privilege('anon','public.orion_review_completion(uuid,boolean,text)','EXECUTE'),'{}');
insert into orion_qa_results values('Completion bucket stays private',(select public=false from storage.buckets where id='completion-evidence'),'{}');
do $$
declare
  tenant uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); engineer uuid:='77551716-4200-4acb-9b3e-6cbe5d6416a0'; reviewer uuid:=gen_random_uuid();
  prop uuid; atype uuid; tmpl uuid; asset uuid; run uuid; answer jsonb; item record;
  defect uuid; submission uuid; rpt uuid; state jsonb; wide text; detail text; i int;
begin
  -- Isolated temporary tenant and reviewer; no password/token or invite is created.
  insert into auth.users(id,email) values(reviewer,'orion-review-'||reviewer||'@example.invalid');
  insert into public.profiles(user_id,display_name) values(reviewer,'ORION QA reviewer') on conflict do nothing;
  insert into public.companies(id,name,slug) values(tenant,'ORION DUMMY RUN — NOT A CUSTOMER','orion-qa-'||tenant),(outsider,'ORION ISOLATION TEST','orion-qa-'||outsider);
  insert into public.company_memberships(company_id,user_id,role_id,status)
    select tenant,engineer,id,'active' from public.roles where code='company_admin';
  insert into public.company_memberships(company_id,user_id,role_id,status)
    select tenant,reviewer,id,'active' from public.roles where code='company_admin';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',engineer,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',engineer::text,true);
  set local role authenticated;
  prop:=public.create_building_setup(tenant,'{"name":"ORION DUMMY RUN — demonstration building","reference_code":"QA-ONLY","address_line1":"SIMULATED — not a real address"}'::jsonb,'["Test block"]'::jsonb,0,0,true);
  insert into orion_qa_results values('Building setup RPC',prop is not null,'{}');
  reset role;
  -- Independent synthetic rules, using the established 2–4 mm perimeter example.
  insert into public.asset_types(company_id,code,name) values(tenant,'QA_FIRE_DOOR','TEST ONLY — simulated door') returning id into atype;
  insert into public.orion_inspection_templates(company_id,code,name,asset_type_code)
    values(tenant,'QA-DOOR','ORION DUMMY RUN — demonstration rules, not approved compliance rules','QA_FIRE_DOOR') returning id into tmpl;
  insert into public.orion_inspection_template_items(template_id,item_code,section_name,prompt,rule_type,input_type,min_value,max_value,unit,photo_required_on_fail,notes_required_on_fail,suggested_action,display_order)
    values(tmpl,'QA-GAP','Perimeter','Simulated perimeter gap','numeric_range','number',2,4,'mm',true,true,'TEST ONLY — assess alignment and adjust after competent review',1);
  insert into public.orion_inspection_template_items(template_id,item_code,section_name,prompt,rule_type,input_type,choices,pass_values,photo_required_on_fail,notes_required_on_fail,display_order)
    values(tmpl,'QA-CLOSER','Closer','Simulated closer operation','choice','choice','["Closes and latches","Fails to latch"]','["Closes and latches"]',true,true,2);
  for i in 1..2 loop
    update public.company_memberships set role_id=(select id from public.roles where code='company_admin') where company_id=tenant and user_id=engineer;
    set local role authenticated;
    asset:=public.create_asset_record(tenant,prop,null,null,null,atype,'QA-DOOR-00'||i,'TEST ONLY — dummy door '||i,p_notes=>'ORION DUMMY RUN. Synthetic observations; no actual inspection or certification.');
    insert into orion_qa_results values('Asset registration '||i,asset is not null,'{}');
    reset role;
    update public.company_memberships set role_id=(select id from public.roles where code='engineer') where company_id=tenant and user_id=engineer;
    set local role authenticated;
    run:=public.orion_start_asset_inspection(tenant,asset);
    begin
      perform public.orion_submit_inspection(run,'ORION DUMMY RUN — premature submission');
      insert into orion_qa_results values('Missing answers blocked '||i,false,'{}');
    exception when others then insert into orion_qa_results values('Missing answers blocked '||i,sqlerrm like '%All inspection items%',jsonb_build_object('message',sqlerrm)); end;
    for item in select * from public.orion_inspection_template_items where template_id=tmpl order by display_order loop
      answer:=public.orion_save_inspection_answer(run,item.id,
        case when item.input_type='choice' then 'Closes and latches' else null end,
        case when item.input_type='number' then case when i=1 then 3 else 6 end else null end,
        'ORION DUMMY RUN — simulated observation only');
      if i=2 and item.item_code='QA-GAP' then
        defect:=(answer->>'defect_id')::uuid;

      end if;
      -- Database evidence fixture only. This does not test the actual Storage upload API.
      if not (i=2 and item.item_code='QA-GAP') then
      insert into public.orion_inspection_evidence(company_id,inspection_id,answer_id,asset_id,storage_path,file_name,mime_type,captured_by)
        values(tenant,run,(answer->>'answer_id')::uuid,asset,tenant||'/'||run||'/QA-NO-BINARY-'||item.item_code||'.png','TEST ONLY — simulated photograph reference.png','image/png',engineer);
      end if;
    end loop;
    if i=2 then
      begin
        perform public.orion_submit_inspection(run,'ORION DUMMY RUN — missing photo check');
        insert into orion_qa_results values('Missing failure photo blocked',false,'{}');
      exception when others then insert into orion_qa_results values('Missing failure photo blocked',sqlerrm like '%Photographic evidence%',jsonb_build_object('message',sqlerrm)); end;
      insert into public.orion_inspection_evidence(company_id,inspection_id,answer_id,asset_id,storage_path,file_name,mime_type,captured_by)
        select tenant,run,d.answer_id,asset,tenant||'/'||run||'/QA-NO-BINARY-gap.png','TEST ONLY — simulated photograph reference.png','image/png',engineer
        from public.orion_inspection_defects d where d.id=defect;
    end if;
    begin
      perform public.orion_submit_inspection(run,'   ');
      insert into orion_qa_results values('Blank sign-off blocked '||i,false,'{}');
    exception when others then insert into orion_qa_results values('Blank sign-off blocked '||i,sqlerrm like '%Final inspection notes%',jsonb_build_object('message',sqlerrm)); end;
    state:=public.orion_submit_inspection(run,'ORION DUMMY RUN — SIMULATED DATA. No real property was inspected. Synthetic evidence references only.');
    insert into orion_qa_results values('Inspection outcome '||i,state->>'outcome'=case when i=1 then 'pass' else 'fail' end,state);
    begin
      perform public.commercial_get_pricing_config(tenant);
      insert into orion_qa_results values('Engineer pricing denied '||i,false,'{}');
    exception when others then insert into orion_qa_results values('Engineer pricing denied '||i,true,jsonb_build_object('message',sqlerrm)); end;
    if i=2 then
      perform public.orion_update_defect(defect,'assigned',engineer,null,'ORION DUMMY RUN — allocated',null);
      perform public.orion_update_defect(defect,'in_progress',null,null,'ORION DUMMY RUN — work started',null);
      begin
        perform public.orion_update_defect(defect,'resolved',null,null,'ORION DUMMY RUN','Simulated completion without evidence');
        insert into orion_qa_results values('Unreviewed closure blocked',false,'{}');
      exception when others then insert into orion_qa_results values('Unreviewed closure blocked',sqlerrm like '%accepted completion evidence%',jsonb_build_object('message',sqlerrm)); end;
      reset role;
      wide:=tenant||'/'||engineer||'/'||defect||'/wide.png'; detail:=tenant||'/'||engineer||'/'||defect||'/detail.png';
      -- Storage metadata fixtures, never presented as uploaded binaries.
      insert into storage.objects(bucket_id,name,metadata) values
        ('completion-evidence',wide,'{"mimetype":"image/png","size":100}'),
        ('completion-evidence',detail,'{"mimetype":"image/png","size":100}');
      set local role authenticated;
      submission:=public.orion_submit_completion(defect,'ORION DUMMY RUN — simulated adjustment completed; awaiting independent review.',wide,detail);
      insert into orion_qa_results values('Submission leaves work in progress',(select status='in_progress' from public.orion_inspection_defects where id=defect),'{}');
      begin
        perform public.orion_review_completion(submission,true,'ORION DUMMY RUN — self review attempt');
        insert into orion_qa_results values('Self review denied',false,'{}');
      exception when others then insert into orion_qa_results values('Self review denied',sqlerrm like '%Reviewer permission%' or sqlerrm like '%different authorised person%',jsonb_build_object('message',sqlerrm)); end;
      reset role;
      perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated')::text,true);
      perform set_config('request.jwt.claim.sub',reviewer::text,true);
      set local role authenticated;
      perform public.orion_review_completion(submission,false,'ORION DUMMY RUN — request clearer simulated detail photo.');
      begin
        perform public.orion_review_completion(submission,true,'ORION DUMMY RUN — duplicate review');
        insert into orion_qa_results values('Repeat review denied',false,'{}');
      exception when others then insert into orion_qa_results values('Repeat review denied',sqlerrm like '%already been reviewed%',jsonb_build_object('message',sqlerrm)); end;
      reset role;
      perform set_config('request.jwt.claims',jsonb_build_object('sub',engineer,'role','authenticated')::text,true);
      perform set_config('request.jwt.claim.sub',engineer::text,true);
      set local role authenticated;
      submission:=public.orion_submit_completion(defect,'ORION DUMMY RUN — corrected simulated detail and completion notes.',wide,detail);
      reset role;
      perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated')::text,true);
      perform set_config('request.jwt.claim.sub',reviewer::text,true);
      set local role authenticated;
      perform public.orion_review_completion(submission,true,'ORION DUMMY RUN — evidence accepted for database workflow test only.');
      insert into orion_qa_results values('Acceptance does not auto-complete',(select status='in_progress' from public.orion_inspection_defects where id=defect),'{}');
      perform public.orion_update_defect(defect,'resolved',null,null,'ORION DUMMY RUN — synthetic repair','ORION DUMMY RUN — accepted evidence and completion review');
      perform public.orion_update_defect(defect,'verified',null,null,null,null);
      perform public.orion_update_defect(defect,'closed',null,null,null,null);
      insert into orion_qa_results values('Resolved verified closed flow',(select status='closed' from public.orion_inspection_defects where id=defect),'{}');
    end if;
    reset role;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',reviewer::text,true);
    set local role authenticated;
    if i=2 then
      begin
        perform public.orion_generate_report(run,'certificate','ORION DUMMY RUN — failed inspection must not produce a certificate');
        insert into orion_qa_results values('Failed inspection certificate blocked',false,'{}');
      exception when others then insert into orion_qa_results values('Failed inspection certificate blocked',sqlerrm like '%Only a passed submitted inspection%',jsonb_build_object('message',sqlerrm)); end;
    end if;
    rpt:=public.orion_generate_report(run,'fraew_report','ORION DUMMY RUN — TEST ONLY. Synthetic evidence; do not send to customer.');
    insert into orion_qa_reports select 'QA-DOOR-00'||i,source_snapshot from public.orion_report_versions where report_id=rpt and version_no=1;
    perform public.orion_generate_report(run,'fraew_report','ORION DUMMY RUN — versioning test');
    insert into orion_qa_results values('Report versioning '||i,(select current_version=2 from public.orion_reports where id=rpt),'{}');
    begin
      update public.orion_report_versions set notes='Tamper attempt - must fail' where report_id=rpt;
      insert into orion_qa_results values('Snapshot API alteration denied '||i,false,'{}');
    exception when insufficient_privilege then insert into orion_qa_results values('Snapshot API alteration denied '||i,true,jsonb_build_object('message',sqlerrm)); end;
    perform public.orion_issue_report(rpt);
    insert into orion_qa_results values('Report issue status '||i,(select status='issued' from public.orion_reports where id=rpt),'{}');
    insert into orion_qa_results values('Foreign company denied '||i,not public.is_company_member(outsider),'{}');
    insert into orion_qa_results values('Foreign tenant asset RLS '||i,(select count(*)=0 from public.assets where company_id=outsider),'{}');
    if i=2 then
      insert into orion_qa_results values('Report freezes accepted evidence',(select jsonb_array_length(source_snapshot->'completions')=1 from public.orion_report_versions where report_id=rpt and version_no=1),'{}');
      perform public.orion_update_defect(defect,'in_progress',null,null,'ORION DUMMY RUN — reopening to check stale evidence',null);
      begin
        perform public.orion_update_defect(defect,'resolved',null,null,'ORION DUMMY RUN — reuse stale evidence','ORION DUMMY RUN — must fail');
        insert into orion_qa_results values('Reopened work needs fresh evidence',false,'{}');
      exception when others then insert into orion_qa_results values('Reopened work needs fresh evidence',sqlerrm like '%accepted completion evidence%',jsonb_build_object('message',sqlerrm)); end;
    end if;
    reset role;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',engineer,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',engineer::text,true);
  end loop;
end $$;
select jsonb_build_object('tests',(select jsonb_agg(to_jsonb(t)) from orion_qa_results t),'reports',(select jsonb_agg(to_jsonb(r)) from orion_qa_reports r),'mode','DATABASE TRANSACTION ONLY; STORAGE METADATA FIXTURES; NO BROWSER AUTH, BINARY UPLOAD OR EMAIL TESTED; ROLLED BACK') as dummy_run;
