-- Pulso: esquema inicial (Supabase/Postgres).
-- Supabase es la única fuente de verdad (ADR-0001). Cada tabla guarda columnas para consultar
-- y filtrar, y el objeto completo en `data` (jsonb) para que el motor y la base no se desalineen.

create extension if not exists "pgcrypto";

create table companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,  -- null en el prototipo de una sola empresa
  name text not null,
  tax_id text not null unique,                                  -- cédula jurídica
  owner_whatsapp text,                                          -- whatsapp:+506XXXXXXXX
  notify_level text not null default 'graves' check (notify_level in ('graves','todo')),
  created_at timestamptz not null default now()
);

-- Cada procesamiento de una fuente, con la bitácora del agente en data.steps
create table runs (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  source text not null check (source in ('demo','gmail')),
  label text,
  started_at timestamptz not null,
  finished_at timestamptz,
  data jsonb not null
);

-- Correos tal como llegan de un adaptador (idempotente por fuente + id externo)
create table emails (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  run_id text,
  source text not null check (source in ('demo','gmail')),
  external_id text not null,
  sender text not null,
  subject text,
  received_at timestamptz not null,
  content_hash text not null,
  data jsonb not null,                                          -- cuerpo y adjuntos
  unique (company_id, source, external_id)
);

-- Lo que Pulso entiende de cada correo (documento + asunto)
create table extractions (
  email_id text primary key references emails(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  category text not null check (category in ('hacienda','ccss','ins','bancos','proveedores','clientes','contador','ruido')),
  kind text not null,
  counterparty text,
  counterparty_tax_id text,
  numeric_key text,                                             -- clave numérica de la factura (50 dígitos)
  doc_number text,
  amount numeric(14,2),
  due_date date,
  status text not null check (status in ('pendiente','pagado','vencido','informativo')),
  hacienda_status text check (hacienda_status in ('aceptado','rechazado','sin_respuesta')),
  amount_source text check (amount_source in ('xml','ia','heuristica')),  -- ADR-0002
  data jsonb not null
);
create index on extractions (company_id, counterparty_tax_id);
create index on extractions (company_id, numeric_key);

-- Reglas aprendidas (ADR-0007): nunca para rechazo_hacienda
create table learned_rules (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  alert_type text not null check (alert_type in ('duplicado','monto_inusual','cobro_sin_factura','vencido')),
  counterparty_tax_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  data jsonb not null                                           -- condición, motivo, origen
);

-- Alertas (ADR-0003)
create table alerts (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  key text not null,                                            -- estable entre corridas
  type text not null check (type in ('duplicado','monto_inusual','cobro_sin_factura','rechazo_hacienda','vencido')),
  confidence text not null check (confidence in ('alta','media','baja')),
  status text not null check (status in ('abierta','descartada','confirmada','recuperada','normal_aprendido')),
  amount_at_risk numeric(14,2),
  analyzed_at timestamptz not null,
  data jsonb not null,                                          -- razón, regla, documentos, evidencia
  unique (company_id, key)
);

-- Acciones propuestas (ADR-0004: nada se envía sin aprobación)
create table actions (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  alert_id text references alerts(id) on delete cascade,
  status text not null check (status in ('pendiente','aprobada','guardada_en_gmail','descartada')),
  approved_via text check (approved_via in ('panel','whatsapp')),
  created_at timestamptz not null default now(),
  data jsonb not null                                           -- asunto, borrador, destinatario
);

-- Mensajes de WhatsApp (ADR-0005)
create table whatsapp_messages (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  direction text not null check (direction in ('saliente','entrante')),
  status text not null,
  created_at timestamptz not null,
  data jsonb not null
);

-- Seguridad: cada dueño ve solo su empresa. El servidor usa la service role key (no pasa por RLS).
alter table companies enable row level security;
alter table runs enable row level security;
alter table emails enable row level security;
alter table extractions enable row level security;
alter table learned_rules enable row level security;
alter table alerts enable row level security;
alter table actions enable row level security;
alter table whatsapp_messages enable row level security;

create policy "dueño de su empresa" on companies
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Una política por tabla (sin bloque DO: el SQL Editor de Supabase no lo acepta).
create policy "solo mi empresa" on runs
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()));
create policy "solo mi empresa" on emails
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()));
create policy "solo mi empresa" on extractions
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()));
create policy "solo mi empresa" on learned_rules
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()));
create policy "solo mi empresa" on alerts
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()));
create policy "solo mi empresa" on actions
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()));
create policy "solo mi empresa" on whatsapp_messages
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()));

-- Permisos para la Data API. Los proyectos nuevos de Supabase no los dan automáticamente.
-- service_role: el servidor de Pulso. authenticated: el dueño con Supabase Auth (filtrado por RLS).
-- anon no recibe nada: sin sesión no se lee ni se escribe.
grant usage on schema public to service_role, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role, authenticated;
