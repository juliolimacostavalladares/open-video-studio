# Open Video Studio

Base monorepo da Sprint 0 para o MVP do Open Video Studio.

## Apps

- `apps/web`: interface web base em Next.js
- `apps/api`: API base em Fastify
- `packages/config`: configuracao compartilhada e validada para o workspace

## Setup local

1. Instale Node.js 20.
2. Rode `pnpm install`.
3. Rode `pnpm dev`.

Aplicacoes locais por padrao:

- `web`: `http://localhost:3000`
- `api`: `http://localhost:4000/health`

## Scripts

- `pnpm dev`: sobe `web` e `api`
- `pnpm build`: build de todos os workspaces
- `pnpm lint`: lint dos workspaces e do pacote compartilhado
- `pnpm typecheck`: typecheck de todos os workspaces
- `pnpm test`: executa suites unit e integration
- `pnpm test:e2e`: smoke E2E do app base
- `pnpm test:unit`: valida o carregamento da configuracao compartilhada
- `pnpm test:integration`: smoke de boot de `web` e `api`

## Suites de teste

- `tests/helpers`: helpers compartilhados de processo, espera e teardown
- `tests/fixtures`: dados e portas padrao usados pelas suites
- `tests/integration`: smoke checks entre camadas
- `tests/e2e`: smoke do fluxo visivel do app base

Fluxo recomendado:

1. `pnpm test:unit`
2. `pnpm test:integration`
3. `pnpm test:e2e`

## Checklist de bootstrap local

- `pnpm install` sem ajustes manuais
- `pnpm dev` sobe `web` e `api`
- `pnpm build` passa
- `pnpm typecheck` passa
