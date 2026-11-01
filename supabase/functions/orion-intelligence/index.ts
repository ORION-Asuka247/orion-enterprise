import {createHandler} from './handler.ts';
function keyFromMap(name:string) {try{return JSON.parse(Deno.env.get(name)||'{}').default||'';}catch{return '';}}
Deno.serve(createHandler({
 supabaseUrl:Deno.env.get('SUPABASE_URL')||'',
 anonKey:Deno.env.get('SUPABASE_ANON_KEY')||keyFromMap('SUPABASE_PUBLISHABLE_KEYS'),
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||keyFromMap('SUPABASE_SECRET_KEYS'),
 openaiKey:Deno.env.get('OPENAI_API_KEY')||''
}));
