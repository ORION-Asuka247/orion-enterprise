
create table if not exists portal_users(
 id uuid primary key,
 company_id uuid,
 role text,
 created_at timestamptz default now()
);

create table if not exists document_vault(
 id uuid primary key,
 property_id uuid,
 category text,
 filename text,
 storage_path text,
 uploaded_at timestamptz default now()
);

create table if not exists portal_messages(
 id uuid primary key,
 property_id uuid,
 sender_id uuid,
 message text,
 created_at timestamptz default now()
);

create table if not exists approval_requests(
 id uuid primary key,
 quotation_id uuid,
 requested_at timestamptz default now(),
 status text
);
