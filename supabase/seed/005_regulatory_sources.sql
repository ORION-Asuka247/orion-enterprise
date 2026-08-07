-- ORION Phase 5 source registry starter.
-- Review endpoints before each production rollout.

insert into public.regulatory_sources(
  code, name, organisation, source_type, trust_tier, base_url,
  query_config, polling_interval_minutes, requires_human_verification
) values
(
  'GOVUK_SEARCH',
  'GOV.UK Search API',
  'Government Digital Service',
  'govuk_search',
  'tier_2_official_guidance',
  'https://www.gov.uk/api/search.json',
  '{
    "queries": [
      "building safety",
      "fire safety",
      "fire doors",
      "emergency lighting",
      "building regulations",
      "housing safety",
      "property management"
    ],
    "count": 50,
    "order": "-public_timestamp"
  }'::jsonb,
  360,
  true
),
(
  'GOVUK_CONTENT',
  'GOV.UK Content API',
  'Government Digital Service',
  'govuk_content',
  'tier_2_official_guidance',
  'https://www.gov.uk/api/content',
  '{"fetch_discovered_pages": true}'::jsonb,
  360,
  true
),
(
  'LEGISLATION_UK',
  'Legislation.gov.uk',
  'The National Archives',
  'legislation',
  'tier_1_primary',
  'https://www.legislation.gov.uk',
  '{
    "formats": ["akn","html"],
    "topics": ["building", "fire", "housing", "health and safety"]
  }'::jsonb,
  720,
  true
),
(
  'HSE_NEWS',
  'HSE News and Guidance',
  'Health and Safety Executive',
  'web',
  'tier_2_official_guidance',
  'https://www.hse.gov.uk',
  '{"paths":["/news/","/guidance/"]}'::jsonb,
  720,
  true
)
on conflict(code) do nothing;

-- Initial topic mappings
insert into public.regulatory_topic_mappings(
  source_id, keyword, compliance_domain_code, asset_type_code,
  inspection_template_code, weight
)
select s.id, x.keyword, x.domain, x.asset, x.template, x.weight
from public.regulatory_sources s
cross join (values
  ('fire door','FIRE_DOORS','FIRE_DOOR','FIRE_DOOR_CORE',5.0),
  ('fire doors','FIRE_DOORS','FIRE_DOOR','FIRE_DOOR_CORE',5.0),
  ('emergency lighting','EMERGENCY_LIGHTING','EMERGENCY_LIGHT','EMERGENCY_LIGHT_CORE',5.0),
  ('automatic opening vent','AOV','AOV',null,4.5),
  ('AOV','AOV','AOV',null,4.0),
  ('building safety','FIRE_DOORS',null,null,2.0),
  ('fire safety','FIRE_DOORS',null,null,2.0),
  ('electrical safety','ELECTRICAL','ELECTRICAL_ASSET',null,4.0),
  ('gas safety','GAS','GAS_ASSET',null,4.0),
  ('damp and mould','DAMP_MOULD',null,null,4.0)
) as x(keyword,domain,asset,template,weight)
where s.code in ('GOVUK_SEARCH','GOVUK_CONTENT','LEGISLATION_UK','HSE_NEWS');
