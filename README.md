# Open Video Studio

Base monorepo da Sprint 0 para o MVP do Open Video Studio.

## Apps

- `apps/web`: interface web base em Next.js
- `apps/api`: API base em Fastify
- `packages/config`: configuracao compartilhada e validada para o workspace
- `packages/database`: schema, migrations, seed e acesso aos modelos centrais

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
- `pnpm test:unit`: valida o carregamento da configuracao compartilhada
- `pnpm test:integration`: smoke de boot de `web` e `api` e CRUD minimo do banco
- `pnpm db:start`: sobe o PostgreSQL local via Docker Compose
- `pnpm db:stop`: derruba o PostgreSQL local e remove o volume
- `pnpm db:generate`: gera o client do banco
- `pnpm db:migrate`: aplica migrations locais
- `pnpm db:seed`: popula dados minimos de desenvolvimento
- `pnpm db:reset`: recria o banco local com migration e seed

## Banco local

O pacote `@repo/database` usa PostgreSQL local via Docker Compose.

Fluxo local:

1. `cp packages/database/.env.example packages/database/.env`
2. `pnpm db:start`
3. `pnpm db:generate`
4. `pnpm db:migrate`
5. `pnpm db:seed`

Reset completo:

1. `pnpm db:reset`

## Checklist de bootstrap local

- `pnpm install` sem ajustes manuais
- `pnpm dev` sobe `web` e `api`
- `pnpm build` passa
- `pnpm typecheck` passa
