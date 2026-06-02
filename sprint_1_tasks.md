# Epic/Milestone: Sprint 1 - Fundação & Infraestrutura Full-Stack (Configurações)

Este documento descreve detalhadamente a árvore de tarefas e sub-tarefas para a Sprint 1 do **Open Video Studio**. Cada User Story é detalhada em tarefas com entregas técnicas explícitas, mapeadas com foco em segurança, integridade e automação, prontas para serem importadas ou criadas no seu quadro de tarefas (Kanban Board).

---

## [Epic] Sprint 1: Fundação & Infraestrutura

### US-INF-01: Setup do Monorepo com Turborepo, TSConfigs Strict-Beast (NodeNext), Path Aliases & Hoisting Estrito

* **História:** Como desenvolvedor do projeto, quero configurar a estrutura de monorepo utilizando Turborepo (com cacheamento de envs), hoisting estrito, TSConfigs Strict-Beast com resolução ESM (NodeNext), namespace genérico de pacotes, aliases de caminhos e portas de desenvolvimento com CORS restrito, para que a integridade de dependências, checagem de tipos estrita (sem `any`), portas limpas e comunicação segura entre as APIs seja centralizada e livre de efeitos colaterais.

#### Task 1.1: Inicialização do Workspace pnpm, Turborepo e Regras de Segurança
- [ ] **Sub-task 1.1.1:** Criar o arquivo `pnpm-workspace.yaml` na raiz do monorepo definindo os diretórios de aplicações e pacotes:
  ```yaml
  packages:
    - 'apps/*'
    - 'packages/*'
  ```
- [ ] **Sub-task 1.1.2:** Criar o `turbo.json` na raiz configurando o pipeline de cacheamento de tarefas (`build`, `lint`, `dev`, `test`) e dependências entre pacotes, mapeando variáveis críticas (como `DATABASE_URL` e `NEXT_PUBLIC_API_URL`) para invalidação de cache.
- [ ] **Sub-task 1.1.3:** Configurar o arquivo `.npmrc` na raiz com regras de hoisting estrito e segurança da cadeia de suprimentos:
  ```ini
  shamefully-hoist=false
  ignore-scripts=true
  save-exact=true
  ```
- [ ] **Sub-task 1.1.4:** Inicializar o `package.json` raiz contendo dependências comuns de desenvolvimento como `turbo`, `prettier`, `prettier-plugin-tailwindcss`, `eslint` e `husky`.

#### Task 1.2: Configuração dos Pacotes Compartilhados `@repo/*`
- [ ] **Sub-task 1.2.1:** Configurar o pacote `@repo/tsconfig` em `packages/tsconfig/`:
  - Criar `base.json` com configurações estritas (strict mode ativado, noImplicitAny, etc.).
  - Configurar `"module": "NodeNext"` e `"moduleResolution": "NodeNext"` para ESM estrito.
- [ ] **Sub-task 1.2.2:** Configurar o pacote `@repo/eslint-config` em `packages/eslint-config/`:
  - Definir configurações base estendidas para Next.js (frontend) e TypeScript recomendado para APIs Fastify.
- [ ] **Sub-task 1.2.3:** Configurar o pacote `@repo/types` em `packages/types/`:
  - Criar estruturas TypeScript e schemas Zod de validação compartilhados entre o Fastify e Next.js.

#### Task 1.3: Inicialização das Aplicações em `apps/`
- [ ] **Sub-task 1.3.1:** Inicializar `apps/web` com Next.js 14, App Router, React 18, Tailwind CSS v4, Zustand, Axios, Radix UI e Shadcn UI.
- [ ] **Sub-task 1.3.2:** Configurar `apps/web/next.config.js` contendo a propriedade `transpilePackages` para os módulos do Remotion (`@remotion/player`, `@remotion/transitions`) e as políticas de segurança de imagens em `images.remotePatterns`.
- [ ] **Sub-task 1.3.3:** Inicializar `apps/backend-node` com Fastify, TypeScript estrito e middleware de CORS dinâmico lendo as origens permitidas diretamente do arquivo `.env`.

---

### US-INF-02: Serviços Containerizados (Bridge Network, Public Read Buckets, Redis DB 1, Bull Board), Fila BullMQ & Validação de Ambiente (Zod)

* **História:** Como arquiteto do sistema, quero definir a infraestrutura de serviços via Docker Compose com rede dedicada (incluindo o container pré-configurado do TTS Python), configurar buckets públicos no MinIO com rotas distintas (interno/externo), isolamento de fila no Redis DB 1, painel de monitoramento visual Bull Board e criar esquemas de validação Zod para variáveis de ambiente, para que a inicialização do projeto falhe imediatamente (fail-fast) se houver alguma configuração incorreta.

#### Task 2.1: Configuração do Docker Compose e Redes Isoladas
- [ ] **Sub-task 2.1.1:** Configurar o arquivo `docker-compose.yml` para expor:
  - `postgres` (banco principal na porta 5432).
  - `postgres_test` (banco de testes isolado na porta 5433).
  - `redis` (cache/fila na porta 6379).
  - `minio` (storage na porta 9000/9001).
  - `omnivoice` (container de FastAPI Python TTS rodando imagem parametrizada `${OMNIVOICE_IMAGE:-omnivoice:latest}`).
- [ ] **Sub-task 2.1.2:** Configurar a rede isolada bridge `open-video-studio-net` conectando os serviços.

#### Task 2.2: Inicialização Automática e Política do MinIO
- [ ] **Sub-task 2.2.1:** Implementar rotina de startup no Fastify que valida e cria os buckets `videos`, `voices`, `assets` e `thumbnails` programaticamente caso não existam.
- [ ] **Sub-task 2.2.2:** Configurar política de **Leitura Pública Anônima (Public Read)** para os buckets de `voices`, `assets` e `thumbnails`, mantendo a escrita protegida por autenticação.

#### Task 2.3: Setup do Redis, Fila BullMQ e Dashboard Bull Board
- [ ] **Sub-task 2.3.1:** Configurar a fila BullMQ conectando ao Redis utilizando o index 1 (`redis://localhost:6379/1`) para isolamento absoluto dos dados.
- [ ] **Sub-task 2.3.2:** Definir concorrência estrita a 1 worker ativo por canal, retry de 3 tentativas com backoff exponencial (2s, 4s, 8s) e limpeza automática de jobs finalizados.
- [ ] **Sub-task 2.3.3:** Acoplar o Bull Board em `/admin/queues` no Fastify, encapsulando autenticação básica (Basic Auth) lida do `.env`.

#### Task 2.4: Validação Estrita de Ambiente com Zod e Prevenção de Vazamento de Segredos
- [ ] **Sub-task 2.4.1:** Escrever esquema de Zod em `apps/backend-node/src/env.ts` para carregar e validar as portas locais e credenciais do banco, Redis, MinIO e APIs.
- [ ] **Sub-task 2.4.2:** Escrever esquema de Zod em `apps/web/src/env.ts` validando apenas variáveis de ambiente públicas prefixadas com `NEXT_PUBLIC_`.
- [ ] **Sub-task 2.4.3:** Adicionar validação estrita no frontend que gera um erro imediato de build caso qualquer segredo privado (não prefixado) seja importado no bundle do cliente.

---

### US-INF-03: Modelagem de Dados (Prisma ORM, Connection Singleton, Seeding) & Compatibilidade Docker

* **História:** Como desenvolvedor backend, quero configurar o Prisma ORM como Singleton global com script de seed e os alvos de binários de compatibilidade de SO, para rodar migrations, popular dados iniciais e executar queries de banco de dados de forma segura sem esgotar o pool de conexões com o PostgreSQL local e em produção.

#### Task 3.1: Setup do Prisma Schema e Modelagem Inicial
- [ ] **Sub-task 3.1.1:** Inicializar o Prisma ORM no pacote `@repo/database` e configurar `binaryTargets = ["native", "debian-openssl-1.1.x", "linux-musl-openssl-3.0.x"]` no `schema.prisma`.
- [ ] **Sub-task 3.1.2:** Modelar a estrutura básica das tabelas:
  - `Channel` (Canais cadastrados e tokens OAuth2).
  - `VoiceProfile` (Biblioteca de vozes para narração).
  - `Project` (Projetos de vídeo e roteiros).
  - `Scene` (Cenas contendo texto, áudio e mídias associadas).
- [ ] **Sub-task 3.1.3:** Escrever a classe de Prisma Client Singleton em `packages/database/src/client.ts`.

#### Task 3.2: Database Seeding e Execução do Prisma Client
- [ ] **Sub-task 3.2.1:** Criar o script de população inicial `packages/database/prisma/seed.ts` adicionando canais de teste e perfis de vozes padrão.
- [ ] **Sub-task 3.2.2:** Mapear comandos explícitos de `npx prisma generate` no pipeline de compilação das aplicações (devido ao uso de `ignore-scripts=true`).
- [ ] **Sub-task 3.2.3:** Configurar script de inicialização do backend-node para executar automaticamente `npx prisma migrate dev` / `prisma migrate deploy` e aplicar o seed no startup em desenvolvimento.

---

### US-INF-04: CI/CD Pipeline (Coolify Webhook) & Git Hooks (Vitest, Remotion Chrome Dependencies)

* **Story:** Como engenheiro DevOps, quero configurar git hooks locais, um banco de dados de testes isolado e uma pipeline CI/CD via GitHub Actions com verificações estritas e dependências de renderização Chromium headless no Docker, para garantir que o deploy via webhook do Coolify seja bem-sucedido e os renders de vídeo não travem por falta de dependências.

#### Task 4.1: Git Hooks Locais e Linting de Lockfile
- [ ] **Sub-task 4.1.1:** Inicializar e configurar Husky com um hook de `pre-commit`.
- [ ] **Sub-task 4.1.2:** Configurar o `lint-staged` para rodar ESLint, Prettier (com ordenação Tailwind) nos arquivos em staging.
- [ ] **Sub-task 4.1.3:** Integrar o `lockfile-lint` no pre-commit e CI/CD para assegurar que todas as dependências no pnpm-lock apontem exclusivamente para o registro oficial do npm.

#### Task 4.2: Suíte de Testes Unitários e End-to-End (E2E)
- [ ] **Sub-task 4.2.1:** Configurar e estruturar testes unitários e de integração utilizando **Vitest** contra o banco de testes dedicado `open_video_studio_test` na porta `5433`.
- [ ] **Sub-task 4.2.2:** Configurar e estruturar a suíte de testes E2E com **Playwright** diretamente na pasta de `apps/web` para validar os fluxos críticos de interface e rendering.

#### Task 4.3: Dockerização e Pipeline de CI/CD
- [ ] **Sub-task 4.3.1:** Escrever o Dockerfile multi-stage em `apps/web` com build de produção otimizado Next.js `standalone`.
- [ ] **Sub-task 4.3.2:** Escrever o Dockerfile em `apps/backend-node` baseado em Node Debian (bullseye-slim), instalando as dependências do sistema necessárias para o Chrome headless (`libnss3`, `libasound2`, `libxss1`, etc.).
- [ ] **Sub-task 4.3.3:** Criar o arquivo de workflow do GitHub Actions em `.github/workflows/deploy.yml` contendo:
  - Instalação de pacotes com `pnpm install --frozen-lockfile`.
  - Escaneamento com `pnpm audit --audit-level=high`.
  - Execução de lints, checagem de tipos, testes do Vitest e testes do Playwright.
  - Disparo do webhook de deploy do Coolify via HTTPS POST.
