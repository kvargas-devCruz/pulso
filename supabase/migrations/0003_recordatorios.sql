-- Pulso: recordatorios que el dueño pide por WhatsApp ("acordame el viernes a las 9 que debo pagar la CCSS").
create table reminders (
  id text primary key,
  company_id uuid not null references companies(id) on delete cascade,
  due_at timestamptz not null,
  status text not null check (status in ('pendiente','hecho','borrado')),
  created_at timestamptz not null default now(),
  data jsonb not null                                           -- tarea, detalle, correo relacionado
);
create index on reminders (company_id, status, due_at);

alter table reminders enable row level security;
create policy "solo mi empresa" on reminders
  for all using (company_id in (select id from companies where owner_id = auth.uid())) with check (company_id in (select id from companies where owner_id = auth.uid()));
grant select, insert, update, delete on reminders to service_role, authenticated;
