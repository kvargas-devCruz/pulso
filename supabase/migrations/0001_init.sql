-- Pulso: esquema inicial
-- Supabase es la única fuente de verdad (ADR-0001). Nombres en inglés; comentarios en español.

create extension if not exists "pgcrypto";

-- Empresa (una por usuario en el prototipo)
create table companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tax_id text,                                   -- cédula jurídica
  categories text[] not null default array['hacienda','ccss','ins','bancos','proveedores','clientes','contador'],
  gmail_connected boolean not null default false,
  gmail_refresh_token text,                      -- guardar cifrado en producción
  owner_whatsapp text,                           -- formato whatsapp:+506XXXXXXXX
  notify_level text not null default 'graves' check (notify_level in ('graves','todo')),
  digest_hour int not null default 7 check (digest_hour between 0 and 23),
  created_at timestamptz not null default now()
);

-- Cada vez que se procesa una fuente
create table runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  source text not null check (source in ('demo','gmail')),
  label text,                                    -- p. ej. 'lote-1'
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Correos tal como llegan de un adaptador
create table emails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  source text not null check (source in ('demo','gmail')),
  external_id text not null,                     -- id de Gmail o id del archivo demo
  sender text not null,
  subject text,
  body text,
  received_at timestamptz not null,
  attachments jsonb not null default '[]',       -- [{nombre, tipo, contenido|storage_path}]
  content_hash text not null,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, source, external_id)
);

-- Documentos extraídos (una factura XML, un PDF, o el contenido útil de un correo)
create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email_id uuid not null references emails(id) on delete cascade,
  kind text not null check (kind in ('xml','pdf','image','text')),
  numeric_key text,                              -- clave numérica (50 dígitos)
  issuer_name text,
  issuer_tax_id text,
  doc_number text,                               -- número consecutivo
  issued_at timestamptz,
  due_date date,
  amount numeric(14,2),
  currency text default 'CRC',
  tax_amount numeric(14,2),
  payment_terms text check (payment_terms in ('contado','credito')),
  hacienda_status text check (hacienda_status in ('aceptado','rechazado','sin_respuesta')),
  hacienda_detail text,
  amount_source text not null default 'ia' check (amount_source in ('xml','ia')),  -- ADR-0002
  doubtful_fields text[] not null default '{}',
  extraction_confidence numeric(3,2),
  created_at timestamptz not null default now()
);
create index on documents (company_id, issuer_tax_id);
create index on documents (company_id, numeric_key);

-- Historial por proveedor (se recalcula desde documents)
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  tax_id text,
  invoice_count int not null default 0,
  avg_amount numeric(14,2),
  last_amount numeric(14,2),
  updated_at timestamptz not null default now(),
  unique (company_id, tax_id)
);

-- "Asuntos": lo que el dueño tiene que saber de cada documento
create table items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  category text not null check (category in ('hacienda','ccss','ins','bancos','proveedores','clientes','contador','ruido')),
  kind text not null check (kind in ('factura','aviso','cobro','solicitud','pago_recibido','cobro_pendiente','ruido')),
  counterparty text,
  status text not null check (status in ('pendiente','pagado','vencido','informativo')),
  summary text,
  created_at timestamptz not null default now()
);

-- Reglas aprendidas (ADR-0007)
create table learned_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  supplier_tax_id text,
  alert_type text not null check (alert_type in ('duplicado','monto_inusual','cobro_sin_factura','vencido')),  -- nunca rechazo_hacienda
  condition jsonb not null default '{}',         -- p. ej. {"max_ratio": 2.0, "month": 11}
  reason text,
  created_from text not null check (created_from in ('panel','whatsapp')),
  source_alert_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Alertas (ADR-0003)
create table alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  type text not null check (type in ('duplicado','monto_inusual','cobro_sin_factura','rechazo_hacienda','vencido')),
  confidence text not null check (confidence in ('alta','media','baja')),
  reason text not null,                          -- "mismo consecutivo y mismo monto"
  rule_applied text not null,                    -- id de la regla en lib/engine/rules
  related_document_ids uuid[] not null,
  explanation text,                              -- redactada por Claude a partir de los datos
  amount_at_risk numeric(14,2),
  status text not null default 'abierta'
    check (status in ('abierta','descartada','confirmada','recuperada','normal_aprendido')),
  learned_rule_id uuid references learned_rules(id) on delete set null,
  analyzed_at timestamptz not null default now()
);
alter table learned_rules
  add constraint learned_rules_source_alert_fk foreign key (source_alert_id) references alerts(id) on delete set null;

-- Acciones propuestas (ADR-0004: nada se envía sin aprobación)
create table actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  alert_id uuid references alerts(id) on delete cascade,
  kind text not null check (kind in ('correo_proveedor','cobro','recordatorio')),
  to_address text,
  subject text,
  draft text not null,
  status text not null default 'pendiente'
    check (status in ('pendiente','aprobada','guardada_en_gmail','descartada')),
  approved_via text check (approved_via in ('panel','whatsapp')),
  approved_at timestamptz,
  gmail_draft_id text,
  created_at timestamptz not null default now()
);

-- Mensajes de WhatsApp (ADR-0005)
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  alert_id uuid references alerts(id) on delete set null,
  direction text not null check (direction in ('saliente','entrante')),
  kind text not null check (kind in ('alerta','resumen','respuesta')),
  body text not null,
  status text check (status in ('enviado','entregado','fallido','recibido')),
  provider_sid text,
  created_at timestamptz not null default now()
);

-- Bitácora del agente (lo que se muestra arriba del panel)
create table agent_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  run_id uuid references runs(id) on delete cascade,
  step text not null,                            -- 'leer','extraer','hacienda','clasificar','reglas','aprendido','explicar','notificar'
  detail text,
  count int,
  created_at timestamptz not null default now()
);

-- Seguridad: cada dueño ve solo su empresa
alter table companies enable row level security;
alter table runs enable row level security;
alter table emails enable row level security;
alter table documents enable row level security;
alter table suppliers enable row level security;
alter table items enable row level security;
alter table learned_rules enable row level security;
alter table alerts enable row level security;
alter table actions enable row level security;
alter table whatsapp_messages enable row level security;
alter table agent_log enable row level security;

create policy "dueño de su empresa" on companies
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['runs','emails','documents','suppliers','items','learned_rules','alerts','actions','whatsapp_messages','agent_log']
  loop
    execute format(
      'create policy "solo mi empresa" on %I for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()))',
      t);
  end loop;
end $$;

-- El servidor (rutas API, webhook de WhatsApp) usa la service role key, que no pasa por RLS.
