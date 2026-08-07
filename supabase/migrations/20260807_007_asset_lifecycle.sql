
create table if not exists asset_lifecycle(
 id uuid primary key,
 asset_id uuid,
 install_date date,
 warranty_expiry date,
 expected_life_years integer,
 replacement_due date,
 replacement_cost numeric,
 health_score numeric,
 created_at timestamptz default now()
);

create table if not exists asset_predictions(
 id uuid primary key,
 asset_id uuid,
 predicted_failure date,
 confidence numeric,
 recommendation text,
 created_at timestamptz default now()
);

create table if not exists building_health(
 id uuid primary key,
 property_id uuid,
 fire_score numeric,
 electrical_score numeric,
 fabric_score numeric,
 compliance_score numeric,
 overall_score numeric,
 calculated_at timestamptz default now()
);
