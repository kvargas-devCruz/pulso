-- Pulso: todas las migraciones (0001, 0002 y 0003) en UNA sola instrucción,
-- para editores o herramientas que dan "Only singular query allowed".
-- Generado a partir de supabase/migrations/*.sql: si cambian, hay que regenerarlo.
do $pulso$
begin
  execute $q$create extension if not exists "pgcrypto"$q$;
  execute $q$create table companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  tax_id text not null unique,
  owner_whatsapp text,
  notify_level text not null default 'graves' check (notify_level in ('graves','todo')),
  created_at timestamptz not null default now()
)$q$;
  execute $q$create table runs (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  source text not null check (source in ('demo','gmail')),
  label text,
  started_at timestamptz not null,
  finished_at timestamptz,
  data jsonb not null
)$q$;
  execute $q$create table emails (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  run_id text,
  source text not null check (source in ('demo','gmail')),
  external_id text not null,
  sender text not null,
  subject text,
  received_at timestamptz not null,
  content_hash text not null,
  data jsonb not null,
  unique (company_id, source, external_id)
)$q$;
  execute $q$create table extractions (
  email_id text primary key references emails(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  category text not null check (category in ('hacienda','ccss','ins','bancos','proveedores','clientes','contador','ruido')),
  kind text not null,
  counterparty text,
  counterparty_tax_id text,
  numeric_key text,
  doc_number text,
  amount numeric(14,2),
  due_date date,
  status text not null check (status in ('pendiente','pagado','vencido','informativo')),
  hacienda_status text check (hacienda_status in ('aceptado','rechazado','sin_respuesta')),
  amount_source text check (amount_source in ('xml','ia','heuristica')),
  data jsonb not null
)$q$;
  execute $q$create index on extractions (company_id, counterparty_tax_id)$q$;
  execute $q$create index on extractions (company_id, numeric_key)$q$;
  execute $q$create table learned_rules (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  alert_type text not null check (alert_type in ('duplicado','monto_inusual','cobro_sin_factura','vencido')),
  counterparty_tax_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  data jsonb not null
)$q$;
  execute $q$create table alerts (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  key text not null,
  type text not null check (type in ('duplicado','monto_inusual','cobro_sin_factura','rechazo_hacienda','vencido')),
  confidence text not null check (confidence in ('alta','media','baja')),
  status text not null check (status in ('abierta','descartada','confirmada','recuperada','normal_aprendido')),
  amount_at_risk numeric(14,2),
  analyzed_at timestamptz not null,
  data jsonb not null,
  unique (company_id, key)
)$q$;
  execute $q$create table actions (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  alert_id text references alerts(id) on delete cascade,
  status text not null check (status in ('pendiente','aprobada','guardada_en_gmail','descartada')),
  approved_via text check (approved_via in ('panel','whatsapp')),
  created_at timestamptz not null default now(),
  data jsonb not null
)$q$;
  execute $q$create table whatsapp_messages (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  direction text not null check (direction in ('saliente','entrante')),
  status text not null,
  created_at timestamptz not null,
  data jsonb not null
)$q$;
  execute $q$alter table companies enable row level security$q$;
  execute $q$alter table runs enable row level security$q$;
  execute $q$alter table emails enable row level security$q$;
  execute $q$alter table extractions enable row level security$q$;
  execute $q$alter table learned_rules enable row level security$q$;
  execute $q$alter table alerts enable row level security$q$;
  execute $q$alter table actions enable row level security$q$;
  execute $q$alter table whatsapp_messages enable row level security$q$;
  execute $q$create policy "dueño de su empresa" on companies
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())$q$;
  execute $q$create policy "solo mi empresa" on runs
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))$q$;
  execute $q$create policy "solo mi empresa" on emails
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))$q$;
  execute $q$create policy "solo mi empresa" on extractions
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))$q$;
  execute $q$create policy "solo mi empresa" on learned_rules
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))$q$;
  execute $q$create policy "solo mi empresa" on alerts
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))$q$;
  execute $q$create policy "solo mi empresa" on actions
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))$q$;
  execute $q$create policy "solo mi empresa" on whatsapp_messages
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))$q$;
  execute $q$grant usage on schema public to service_role, authenticated$q$;
  execute $q$grant select, insert, update, delete on all tables in schema public to service_role, authenticated$q$;
  execute $q$alter table extractions drop constraint if exists extractions_category_check$q$;
  execute $q$alter table extractions add constraint extractions_category_check
  check (category in ('hacienda','ccss','ins','bancos','proveedores','clientes','contador','ventas','ruido'))$q$;
  execute $q$alter table extractions drop constraint if exists extractions_amount_source_check$q$;
  execute $q$alter table extractions add constraint extractions_amount_source_check
  check (amount_source in ('xml','archivo','ia','heuristica'))$q$;
  execute $q$alter table alerts drop constraint if exists alerts_type_check$q$;
  execute $q$alter table alerts add constraint alerts_type_check
  check (type in ('duplicado','monto_inusual','cobro_sin_factura','rechazo_hacienda','vencido','cierre_descuadre'))$q$;
  execute $q$alter table learned_rules drop constraint if exists learned_rules_alert_type_check$q$;
  execute $q$alter table learned_rules add constraint learned_rules_alert_type_check
  check (alert_type in ('duplicado','monto_inusual','cobro_sin_factura','vencido','cierre_descuadre'))$q$;
  execute $q$create table reminders (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  due_at timestamptz not null,
  status text not null check (status in ('pendiente','hecho','borrado')),
  created_at timestamptz not null default now(),
  data jsonb not null
)$q$;
  execute $q$create index on reminders (company_id, status, due_at)$q$;
  execute $q$alter table reminders enable row level security$q$;
  execute $q$create policy "solo mi empresa" on reminders
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))$q$;
  execute $q$grant select, insert, update, delete on reminders to service_role, authenticated$q$;
end
$pulso$;
