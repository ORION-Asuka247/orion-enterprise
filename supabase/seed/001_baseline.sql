-- ORION Enterprise Phase 1 baseline RBAC and asset types

insert into public.permissions(code, description) values
('property.view','View properties and hierarchy'),
('property.create','Create properties, blocks, floors and areas'),
('property.edit','Edit properties and hierarchy'),
('asset.view','View assets'),
('asset.create','Create assets and asset types'),
('asset.edit','Edit assets'),
('inspection.create','Create inspections'),
('inspection.approve','Approve inspections'),
('rule.review','Review compliance rules'),
('rule.approve','Approve compliance rules'),
('quote.create','Create quotations'),
('quote.approve','Approve quotations'),
('report.generate','Generate reports'),
('audit.view','View audit history'),
('user.manage','Manage company users')
on conflict (code) do nothing;

insert into public.roles(code, name, description, is_system) values
('company_admin','Company Administrator','Full tenant administration',true),
('compliance_manager','Compliance Manager','Compliance, inspection and reporting oversight',true),
('property_manager','Property Manager','Property, asset and works oversight',true),
('engineer','Engineer','Field inspection and asset access',true),
('subcontractor','Subcontractor','Restricted assigned-work access',true),
('client','Client','Client portal access',true),
('auditor','Auditor','Read-only compliance and evidence access',true),
('read_only','Read Only','Read-only tenant access',true)
on conflict (code) do nothing;

-- Company Administrator: all baseline permissions
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'company_admin'
on conflict do nothing;

-- Compliance Manager
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'property.view','asset.view','asset.create','asset.edit',
  'inspection.create','inspection.approve','rule.review',
  'report.generate','audit.view'
)
where r.code = 'compliance_manager'
on conflict do nothing;

-- Property Manager
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'property.view','property.create','property.edit',
  'asset.view','asset.create','asset.edit',
  'report.generate'
)
where r.code = 'property_manager'
on conflict do nothing;

-- Engineer
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'property.view','asset.view','inspection.create'
)
where r.code = 'engineer'
on conflict do nothing;

-- Client / Auditor / Read-only
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('property.view','asset.view')
where r.code in ('client','auditor','read_only')
on conflict do nothing;

insert into public.asset_types(company_id, code, name, compliance_domain, is_system) values
(null,'FIRE_DOOR','Fire Door','fire_safety',true),
(null,'EMERGENCY_LIGHT','Emergency Light','emergency_lighting',true),
(null,'AOV','Automatic Opening Vent','fire_safety',true),
(null,'FIRE_ALARM_DEVICE','Fire Alarm Device','fire_safety',true),
(null,'ELECTRICAL_ASSET','Electrical Asset','electrical',true),
(null,'GAS_ASSET','Gas Asset','gas',true),
(null,'ACCESS_DOOR','Access / Security Door','access',true)
on conflict (company_id, code) do nothing;
