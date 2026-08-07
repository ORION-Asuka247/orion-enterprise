
create table if not exists ai_conversations(
 id uuid primary key,
 company_id uuid,
 user_id uuid,
 created_at timestamptz default now()
);

create table if not exists ai_insights(
 id uuid primary key,
 company_id uuid,
 category text,
 summary text,
 confidence numeric,
 created_at timestamptz default now()
);

create table if not exists executive_briefs(
 id uuid primary key,
 company_id uuid,
 title text,
 generated_at timestamptz default now()
);
