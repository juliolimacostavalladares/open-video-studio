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

Configuracao de IA local recomendada para este projeto:

```bash
AI_PROVIDER=qwenproxy
QWENPROXY_BASE_URL=http://127.0.0.1:3000/v1
QWENPROXY_API_KEY=sk-no-key-required
QWENPROXY_MODEL=qwen-plus
```

Esse formato segue a compatibilidade OpenAI exposta pelo [QwenProxy](https://github.com/pedrofariasx/qwenproxy).

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
- `pnpm infra:start`: sobe Redis e MinIO locais para fila e storage
- `pnpm infra:stop`: derruba Redis e MinIO locais e remove volumes
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

## Fila e storage locais

Para a infra do pipeline:

1. `pnpm infra:start`
2. Redis: `redis://127.0.0.1:6379`
3. MinIO S3 compatível: `http://127.0.0.1:9000`
4. Credenciais padrão do MinIO: `minioadmin` / `minioadmin`

Defaults do workspace:

- `QUEUE_NAME=video-pipeline`
- `STORAGE_DRIVER=local`
- `STORAGE_BASE_PATH=storage`
- `STORAGE_BUCKET=open-video-studio`

## Checklist de bootstrap local

- `pnpm install` sem ajustes manuais
- `pnpm dev` sobe `web` e `api`
- `pnpm build` passa
- `pnpm typecheck` passa

## Deploy com Coolify

O fluxo de deploy segue o modelo recomendado pela documentacao do Coolify para GitHub Actions:

1. o workflow `CI Pipeline` valida `lint`, `typecheck`, `build`, `unit`, `integration` e `e2e`
2. quando esse workflow passa em `master`, o workflow `Deploy to Coolify`:
   - builda `Dockerfile.web` e `Dockerfile.api`
   - publica as imagens no `GHCR`
   - chama os webhooks de redeploy do Coolify

Imagens publicadas:

- `ghcr.io/<owner>/open-video-studio-web:latest`
- `ghcr.io/<owner>/open-video-studio-api:latest`

Secrets esperados no GitHub Actions:

- `COOLIFY_TOKEN`
- `COOLIFY_WEBHOOK_WEB`
- `COOLIFY_WEBHOOK_BACKEND`

Configuracao esperada no Coolify:

1. habilitar `API Access`
2. criar um `API Token` com permissao de deploy
3. configurar os apps `web` e `api` para usar imagens prebuildadas do GHCR
4. autenticar o servidor do Coolify no `ghcr.io`
5. cadastrar os webhooks de deploy nas secrets do repositorio/ambiente

Ao usar Docker Compose no Coolify, a aplicacao deve apontar para imagens prebuildadas, por exemplo:

```yaml
services:
  web:
    image: ghcr.io/<owner>/open-video-studio-web:latest
  api:
    image: ghcr.io/<owner>/open-video-studio-api:latest
```
