-- ORION Enterprise v1.0
-- Update 018: Security hardening

-- Ensure the taxonomy health view respects the querying user's permissions/RLS.
alter view public.asset_type_taxonomy_health set (security_invoker = true);

-- Pin search_path on public functions that do not already define one.
do $$
declare r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end $$;

-- No SECURITY DEFINER RPC should be executable anonymously.
do $$
declare r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.prokind = 'f'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end $$;
