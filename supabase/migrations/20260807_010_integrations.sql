
create table if not exists api_clients(
 id uuid primary key,
 company_id uuid,
 client_name text,
 status text,
 created_at timestamptz default now()
);

create table if not exists webhook_subscriptions(
 id uuid primary key,
 company_id uuid,
 event_name text,
 callback_url text,
 secret text,
 is_enabled boolean default true
);

create table if not exists integration_connectors(
 id uuid primary key,
 connector_code text unique,
 provider text,
 status text,
 created_at timestamptz default now()
);

create table if not exists api_audit_log(
 id uuid primary key,
 api_client_id uuid,
 endpoint text,
 http_method text,
 response_code integer,
 created_at timestamptz default now()
);
