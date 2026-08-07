-- ORION Enterprise Phase 2 baseline domains and demonstration templates.
-- These are starter records, not legal advice or a substitute for verified standards.

insert into public.compliance_domains(code, name, description) values
('FIRE_DOORS','Fire Doors','Fire-door inspection and remedial compliance workflows'),
('EMERGENCY_LIGHTING','Emergency Lighting','Emergency-lighting inspection and testing workflows'),
('AOV','Automatic Opening Vents','Smoke-control and AOV inspection workflows'),
('ELECTRICAL','Electrical','Electrical inspection workflows'),
('GAS','Gas','Gas-related asset compliance workflows'),
('DAMP_MOULD','Damp & Mould','Property-condition and damp/mould inspection workflows')
on conflict (code) do nothing;

-- Reference standard placeholders.
-- Verify clauses and licensing before production use.
insert into public.standards(code, title, issuer, notes) values
('ORION-DEMO-FD','ORION Fire Door Demonstration Standard','ORION','Demonstration only. Replace with verified authorised sources before production compliance use.'),
('ORION-DEMO-EL','ORION Emergency Lighting Demonstration Standard','ORION','Demonstration only. Replace with verified authorised sources before production compliance use.')
on conflict (code) do nothing;

-- Fire Door system template
insert into public.inspection_templates(
  company_id, code, name, compliance_domain_id, asset_type_id, description, is_system
)
select
  null,
  'FIRE_DOOR_CORE',
  'Fire Door Inspection',
  cd.id,
  at.id,
  'Universal ORION fire-door inspection template starter.',
  true
from public.compliance_domains cd
join public.asset_types at on at.code = 'FIRE_DOOR' and at.company_id is null
where cd.code = 'FIRE_DOORS'
on conflict (company_id, code) do nothing;

-- Emergency Lighting system template
insert into public.inspection_templates(
  company_id, code, name, compliance_domain_id, asset_type_id, description, is_system
)
select
  null,
  'EMERGENCY_LIGHT_CORE',
  'Emergency Lighting Inspection',
  cd.id,
  at.id,
  'Universal ORION emergency-lighting inspection template starter.',
  true
from public.compliance_domains cd
join public.asset_types at on at.code = 'EMERGENCY_LIGHT' and at.company_id is null
where cd.code = 'EMERGENCY_LIGHTING'
on conflict (company_id, code) do nothing;

-- Version 1 templates
insert into public.inspection_template_versions(template_id, version_no, status, effective_from, change_summary)
select id, 1, 'approved', current_date, 'Initial ORION Enterprise Phase 2 template'
from public.inspection_templates
where code in ('FIRE_DOOR_CORE','EMERGENCY_LIGHT_CORE')
on conflict (template_id, version_no) do nothing;

-- Fire Door sections
with tv as (
  select tv.id
  from public.inspection_template_versions tv
  join public.inspection_templates t on t.id = tv.template_id
  where t.code = 'FIRE_DOOR_CORE' and tv.version_no = 1
)
insert into public.inspection_sections(template_version_id, code, title, instructions, sort_order)
select tv.id, x.code, x.title, x.instructions, x.sort_order
from tv
cross join (values
  ('IDENTITY','Asset Identity','Confirm the correct door and location before inspection.',10),
  ('CONDITION','Door Condition','Inspect door leaf, frame, gaps and operation.',20),
  ('EVIDENCE','Evidence','Capture required evidence.',30)
) as x(code,title,instructions,sort_order)
on conflict (template_version_id, code) do nothing;

-- Fire Door questions
with s as (
  select s.id, s.code
  from public.inspection_sections s
  join public.inspection_template_versions tv on tv.id = s.template_version_id
  join public.inspection_templates t on t.id = tv.template_id
  where t.code = 'FIRE_DOOR_CORE' and tv.version_no = 1
)
insert into public.inspection_questions(
  section_id, code, prompt, help_text, question_type, unit,
  is_required, evidence_required, min_photos, sort_order
)
select s.id, q.code, q.prompt, q.help_text, q.question_type::public.question_type, q.unit,
       q.is_required, q.evidence_required, q.min_photos, q.sort_order
from s
join (values
  ('IDENTITY','ASSET_CONFIRMED','Confirm this is the correct asset.','Use QR or manual asset identification before proceeding.','boolean',null,true,false,0,10),
  ('CONDITION','TOP_GAP_MM','Measure the top door gap.','Enter the measured gap in millimetres.','number','mm',true,true,1,10),
  ('CONDITION','DOOR_CLOSES','Does the door close fully into the frame?','Operate the door and confirm it closes without assistance.','boolean',null,true,true,1,20),
  ('EVIDENCE','OVERVIEW_PHOTO','Capture an overview photograph of the door.','Show the complete door and frame.','photo',null,true,true,1,10)
) as q(section_code,code,prompt,help_text,question_type,unit,is_required,evidence_required,min_photos,sort_order)
on q.section_code = s.code
on conflict (section_id, code) do nothing;

-- Fire Door rules
insert into public.compliance_rules(company_id, code, name, compliance_domain_id, description, is_system)
select null, 'FD_TOP_GAP_DEMO', 'Fire Door Top Gap Demonstration Rule', id,
       'Demonstration range rule. Verify authorised standard before production use.', true
from public.compliance_domains where code='FIRE_DOORS'
on conflict (company_id, code) do nothing;

insert into public.compliance_rules(company_id, code, name, compliance_domain_id, description, is_system)
select null, 'FD_CLOSES_DEMO', 'Fire Door Closing Demonstration Rule', id,
       'Door must close fully. Verify authorised standard before production use.', true
from public.compliance_domains where code='FIRE_DOORS'
on conflict (company_id, code) do nothing;

insert into public.compliance_rule_versions(
  rule_id, version_no, status, operator, min_value, max_value, unit,
  failure_outcome, severity, failure_message, effective_from
)
select id,1,'approved','between',2,4,'mm','fail','high',
       'Measured top gap is outside the demonstration accepted range.', current_date
from public.compliance_rules where code='FD_TOP_GAP_DEMO'
on conflict (rule_id, version_no) do nothing;

insert into public.compliance_rule_versions(
  rule_id, version_no, status, operator, expected_value,
  failure_outcome, severity, failure_message, effective_from
)
select id,1,'approved','is_true','true'::jsonb,'fail','high',
       'Door did not close fully into the frame.', current_date
from public.compliance_rules where code='FD_CLOSES_DEMO'
on conflict (rule_id, version_no) do nothing;

-- Link Fire Door questions to rules
insert into public.question_rules(question_id, rule_version_id, evaluation_order)
select q.id, rv.id, 10
from public.inspection_questions q
join public.inspection_sections s on s.id = q.section_id
join public.inspection_template_versions tv on tv.id = s.template_version_id
join public.inspection_templates t on t.id = tv.template_id
join public.compliance_rules cr on cr.code = 'FD_TOP_GAP_DEMO'
join public.compliance_rule_versions rv on rv.rule_id = cr.id and rv.version_no=1
where t.code='FIRE_DOOR_CORE' and q.code='TOP_GAP_MM'
on conflict do nothing;

insert into public.question_rules(question_id, rule_version_id, evaluation_order)
select q.id, rv.id, 10
from public.inspection_questions q
join public.inspection_sections s on s.id = q.section_id
join public.inspection_template_versions tv on tv.id = s.template_version_id
join public.inspection_templates t on t.id = tv.template_id
join public.compliance_rules cr on cr.code = 'FD_CLOSES_DEMO'
join public.compliance_rule_versions rv on rv.rule_id = cr.id and rv.version_no=1
where t.code='FIRE_DOOR_CORE' and q.code='DOOR_CLOSES'
on conflict do nothing;

-- Emergency lighting sections/questions starter
with tv as (
  select tv.id
  from public.inspection_template_versions tv
  join public.inspection_templates t on t.id = tv.template_id
  where t.code = 'EMERGENCY_LIGHT_CORE' and tv.version_no = 1
)
insert into public.inspection_sections(template_version_id, code, title, instructions, sort_order)
select tv.id, x.code, x.title, x.instructions, x.sort_order
from tv
cross join (values
  ('IDENTITY','Asset Identity','Confirm luminaire identity and location.',10),
  ('FUNCTION','Functional Test','Record functional operation.',20),
  ('EVIDENCE','Evidence','Capture inspection evidence.',30)
) as x(code,title,instructions,sort_order)
on conflict (template_version_id, code) do nothing;

with s as (
  select s.id, s.code
  from public.inspection_sections s
  join public.inspection_template_versions tv on tv.id = s.template_version_id
  join public.inspection_templates t on t.id = tv.template_id
  where t.code = 'EMERGENCY_LIGHT_CORE' and tv.version_no = 1
)
insert into public.inspection_questions(
  section_id, code, prompt, help_text, question_type,
  is_required, evidence_required, min_photos, sort_order
)
select s.id, q.code, q.prompt, q.help_text, q.question_type::public.question_type,
       q.is_required, q.evidence_required, q.min_photos, q.sort_order
from s
join (values
  ('IDENTITY','ASSET_CONFIRMED','Confirm this is the correct emergency light.','Use QR or manual lookup.','boolean',true,false,0,10),
  ('FUNCTION','FUNCTIONAL_TEST','Did the luminaire illuminate during the functional test?','Record whether emergency operation was observed.','boolean',true,true,1,10),
  ('EVIDENCE','OVERVIEW_PHOTO','Capture an overview photograph.','Show the luminaire and surrounding location.','photo',true,true,1,10)
) as q(section_code,code,prompt,help_text,question_type,is_required,evidence_required,min_photos,sort_order)
on q.section_code = s.code
on conflict (section_id, code) do nothing;

insert into public.compliance_rules(company_id, code, name, compliance_domain_id, description, is_system)
select null, 'EL_FUNCTIONAL_DEMO', 'Emergency Light Functional Demonstration Rule', id,
       'Demonstration functional rule. Verify authorised standard before production use.', true
from public.compliance_domains where code='EMERGENCY_LIGHTING'
on conflict (company_id, code) do nothing;

insert into public.compliance_rule_versions(
  rule_id, version_no, status, operator, failure_outcome, severity,
  failure_message, effective_from
)
select id,1,'approved','is_true','fail','high',
       'Emergency luminaire did not illuminate during the functional test.', current_date
from public.compliance_rules where code='EL_FUNCTIONAL_DEMO'
on conflict (rule_id, version_no) do nothing;

insert into public.question_rules(question_id, rule_version_id, evaluation_order)
select q.id, rv.id, 10
from public.inspection_questions q
join public.inspection_sections s on s.id = q.section_id
join public.inspection_template_versions tv on tv.id = s.template_version_id
join public.inspection_templates t on t.id = tv.template_id
join public.compliance_rules cr on cr.code = 'EL_FUNCTIONAL_DEMO'
join public.compliance_rule_versions rv on rv.rule_id = cr.id and rv.version_no=1
where t.code='EMERGENCY_LIGHT_CORE' and q.code='FUNCTIONAL_TEST'
on conflict do nothing;
