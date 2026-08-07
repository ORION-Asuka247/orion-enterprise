
-- Skeleton schema
create table if not exists work_orders(
 id uuid primary key,
 reference text unique,
 defect_id uuid,
 status text,
 created_at timestamptz default now()
);

create table if not exists quotations(
 id uuid primary key,
 work_order_id uuid,
 reference text unique,
 status text,
 subtotal numeric,
 vat numeric,
 total numeric
);

create table if not exists contractor_assignments(
 id uuid primary key,
 work_order_id uuid,
 contractor_id uuid,
 scheduled_date date,
 status text
);

create table if not exists completion_records(
 id uuid primary key,
 work_order_id uuid,
 completed_at timestamptz,
 qa_status text
);
