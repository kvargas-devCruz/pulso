# ADR-0006: Stack: Next.js, Supabase, Claude y Vercel

**Estado:** aceptada · 19/11/2026

## Contexto
Un solo desarrollador, tres días, y el producto tiene que quedar publicado con un link y listo para venderse en Dojo Marketplace.

## Decisión
- **Next.js (App Router, TypeScript):** frontend y rutas API en un mismo proyecto.
- **Supabase:** Postgres + Auth + almacenamiento de adjuntos, plan gratis.
- **Claude API:** Haiku para clasificar volumen; Sonnet para extracción sin XML, visión de PDF e imágenes, explicaciones y borradores. Salidas en JSON validadas.
- **Vercel:** despliegue con link público.
- **Claude Code:** desarrollo agéntico, guiado por `PRD.md`, `docs/adr/` y `CLAUDE.md`.

## Consecuencias
- (+) Setup en minutos y despliegue continuo.
- (+) Todo en un repo que cualquiera puede correr siguiendo el README.
- (−) Dependencia de servicios en la nube con planes gratis; suficiente para el prototipo y el piloto.
