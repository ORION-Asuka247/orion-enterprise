-- ORION Enterprise v1.0
-- Update 019: Restrict SECURITY DEFINER execution to authenticated users

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
      'revoke execute on function %I.%I(%s) from public',
      r.schema_name,
      r.function_name,
      r.args
    );
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end $$;
