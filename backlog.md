# Backlog de User Stories - Open Video Studio

Este documento organiza o desenvolvimento do **Open Video Studio** em sprints focadas em entregas funcionais e técnicas de valor, estruturado no modelo de Monorepo (Turborepo) e infraestrutura VPS self-hosted (Coolify/Docker Compose).

---

## Estrutura de Sprints & Sizing

```mermaid
gantt
    title Cronograma de Sprints (MVP)
    dateFormat  YYYY-MM-DD
    section Sprint 1: Fundação
    Setup Monorepo & Turbo       :s1, 2026-06-03, 4d
    Docker Compose & Servicos    :s2, after s1, 3d
    Modelagem Prisma & DB        :s3, after s2, 3d
    CI/CD & Git Hooks            :s4, after s3, 4d
    section Sprint 2: IA & Voz
    Script GPT-4o & Parser       :s5, after s4, 5d
    TTS Integracao               :s6, after s5, 4d
    Remotion Core Engine         :s7, after s6, 4d
    section Sprint 3: Mídias & Fila
    APIs Pexels & MinIO Storage  :s8, after s7, 5d
    Fila BullMQ (Redis)          :s9, after s8, 4d
    Editor Thumbnail Canvas      :s10, after s9, 5d
    section Sprint 4: Integrações
    YouTube API v3 OAuth2        :s11, after s10, 5d
    Interface Single-Page Web    :s12, after s11, 7d
```

---

## Sprint 1: Fundação & Infraestrutura Full-Stack (Configurações)

### US-INF-01: Setup do Monorepo com Turborepo, TSConfigs Strict-Beast (NodeNext), Path Aliases & Hoisting Estrito
* **Story:**
  Como desenvolvedor do projeto, quero configurar a estrutura de monorepo utilizando Turborepo (com cacheamento de envs), hoisting estrito, TSConfigs Strict-Beast com resolução ESM (NodeNext), namespace genérico de pacotes, aliases de caminhos e portas de desenvolvimento com CORS restrito, para que a integridade de dependências, checagem de tipos estrita (sem `any`), portas limpas e comunicação segura entre as APIs seja centralizada e livre de efeitos colaterais.
* **Critérios de Aceite:**
  * O diretório raiz deve estar inicializado com Turborepo (`turbo.json` configurado).
  * O `turbo.json` deve mapear as variáveis de ambiente críticas (ex: `DATABASE_URL`, `NEXT_PUBLIC_API_URL`) para invalidar e recriar o cache de compilação quando os valores mudarem na VPS.
  * O workspace do pnpm deve operar com **Hoisting Estrito** (sem `shamefully-hoist=true` no `.npmrc`), garantindo que cada sub-projeto declare suas próprias dependências explícitas.
  * **Segurança na Cadeia de Dependências (.npmrc):** Configurar o arquivo `.npmrc` na raiz com:
    * `ignore-scripts=true` para desativar a execução automática de scripts de pós-instalação de dependências de terceiros, prevenindo ataques de execução de comandos maliciosos no install.
    * `save-exact=true` para salvar sempre a versão exata do pacote sem prefixos caret (`^`) ou tilde (`~`), prevenindo downloads automáticos de pacotes secundários comprometidos.
  * **Nomenclatura de Pacotes (@repo/):** Criação de pacotes compartilhados sob o escopo `@repo/` (evitando a criação de um pacote compartilhado de UI `@repo/ui` para simplificar a arquitetura no MVP, mantendo os componentes de Radix UI/Shadcn UI locais no app frontend):
    * `@repo/tsconfig`: Configurações base do TypeScript usando ESM estrito (`"module": "NodeNext"`, `"moduleResolution": "NodeNext"`).
    * `@repo/eslint-config`: Configurações de ESLint base do monorepo, contendo a configuração padrão do Next.js para o frontend e regras recomendadas simplificadas para TypeScript no backend.
    * `@repo/database`: Prisma schema, client PostgreSQL e script de seed.
    * `@repo/types`: Definições TypeScript compartilhadas e schemas de validação Zod para unificar tipos de requisição/resposta entre Fastify e Next.js.
  * Configurar aliases de caminho absoluto local (`@/*`) estendidos nos tsconfigs de cada app (`apps/web` e `apps/backend-node`) para evitar caminhos relativos longos (ex: `../../`).
  * **Configuração do next.config.js:** 
    * Registrar as rotas autorizadas sob `images.remotePatterns` para carregar mídias de stock (Pexels, Pixabay) e o domínio externo do MinIO (`MINIO_ENDPOINT_EXTERNAL`) no componente `<Image>` do Next.js.
    * Configurar cabeçalhos estritos de **Content Security Policy (CSP)** limitando a execução de scripts e conexões apenas a origens seguras e autorizadas (como fonts.gstatic.com para Google Fonts, o domínio do backend Fastify e os domínios do MinIO/Pexels/Pixabay), mitigando ataques de script injection (XSS) e vazamento de dados.
  * **Portas Fixas & CORS:** Mapeamento de portas padrão (`3000` web Next.js, `4000` backend-node Fastify) e middleware de CORS configurado nas APIs para aceitar requisições de origens específicas informadas dinamicamente no `.env`.
  * Criação das aplicações em `apps/`:
    * `apps/web`: Next.js 14 (Dashboard, com React 18 para compatibilidade garantida com Remotion) configurada com **App Router**, utilizando **Tailwind CSS v4** (configuração puramente baseada em arquivos CSS) para estilização visual, **Radix UI / Shadcn UI** para base de componentes interativos e **Zustand** para gerenciamento de estado global. O arquivo `next.config.js` deve ser configurado com `transpilePackages: ['@remotion/player', '@remotion/transitions']` para evitar erros de importação CommonJS/ESM.
    * `apps/backend-node`: Fastify API com TypeScript estrito (Rotas, BullMQ, YouTube API).
  * **Ordenação de Estilos (Prettier):** Incluir o plugin `prettier-plugin-tailwindcss` no arquivo base de configuração do Prettier para ordenação automática e consistente das classes do Tailwind CSS em todo o monorepo.
* **Tarefas Técnicas:**
  * Inicializar workspace do pnpm (`pnpm-workspace.yaml`).
  * Configurar `turbo.json` com mapeamento de `globalEnv` e `env` por tarefa.
  * Configurar os pacotes base `@repo/tsconfig` e `@repo/eslint-config`, além do `prettier-plugin-tailwindcss` na raiz.
  * Implementar middleware de CORS dinâmico no Fastify.

### US-INF-02: Serviços Containerizados (Bridge Network, Public Read Buckets, Redis DB 1, Bull Board), Fila BullMQ & Validação de Ambiente (Zod)
* **Story:**
  Como arquiteto do sistema, quero definir a infraestrutura de serviços via Docker Compose com rede dedicada (incluindo o container pré-configurado do TTS Python), configurar buckets públicos no MinIO com rotas distintas (interno/externo), isolamento de fila no Redis DB 1, painel de monitoramento visual Bull Board e criar esquemas de validação Zod para variáveis de ambiente, para que a inicialização do projeto falhe imediatamente (fail-fast) se houver alguma configuração incorreta.
* **Critérios de Aceite:**
  * O arquivo `docker-compose.yml` deve expor as portas de PostgreSQL (`5432`), PostgreSQL de Testes (`5433`), Redis (`6379`), MinIO (`9000` API, `9001` Console) e o container pré-construído do **OmniVoice Studio (FastAPI Python TTS na porta 8000)**.
  * A imagem do container do TTS `omnivoice` deve ser configurada utilizando uma variável de ambiente parametrizada com valor padrão no `docker-compose.yml`: `${OMNIVOICE_IMAGE:-omnivoice:latest}`, permitindo alterar a imagem no `.env`.
  * Os containers devem rodar conectados a uma rede isolada do tipo bridge (`open-video-studio-net`), permitindo que o Fastify se comunique com o container do Python TTS internamente via DNS (`http://omnivoice:8000`).
  * **MinIO Auto-initialization & Security:** O backend Fastify deve verificar no startup se os buckets obrigatórios (`videos`, `voices`, `assets`, `thumbnails`) existem no MinIO, criando-os programaticamente e configurando a política de **Leitura Pública Anônima (Public Read)** para `voices`, `assets` e `thumbnails` (a escrita/upload continua restrita e autenticada via backend).
  * **Dual MinIO Endpoints:** Configuração de endpoints separados no `.env`: `MINIO_ENDPOINT_INTERNAL` (ex: `http://minio:9000`) para chamadas do backend Fastify e `MINIO_ENDPOINT_EXTERNAL` (ex: `http://localhost:9000` ou domínio público) para renderização de URLs de mídias consumidas pelo navegador do usuário.
  * **Configuração da Fila BullMQ & Redis DB 1:** Fila robusta configurada com concorrência estrita de 1 worker simultâneo por canal, tentativas limitadas a 3 com exponencial backoff (atraso de 2s, 4s, 8s) e limpeza automática de metadados de jobs concluídos no Redis. O BullMQ deve se conectar usando o índice 1 do Redis (`redis://localhost:6379/1`) para isolar os dados de filas de outros caches.
  * **Painel Administrativo da Fila (Bull Board):** Configurar o painel visual do Bull Board acoplado a uma rota administrativa no backend Fastify (ex: `/admin/queues`), protegida por Basic Authentication (credenciais informadas via `.env`).
  * **Validação de Ambiente Local & Segurança de Chaves (Zod):** Cada aplicação (`apps/web` e `apps/backend-node`) deve carregar e validar o `.env` no startup através de um esquema do **Zod isolado por pasta**. O frontend web não valida nem expõe as credenciais privadas do banco e Redis do backend. O schema do Zod do frontend (`apps/web`) deve forçar a validação estrita das variáveis de ambiente de forma que qualquer tentativa de importação de variáveis secretas não prefixadas com `NEXT_PUBLIC_` resulte em erro de compilação imediato no build.
  * **Tabela de Variáveis de Ambiente (.env.example):**
    | Variável | Descrição | Exemplo Padrão |
    | :--- | :--- | :--- |
    | `NODE_ENV` | Modo de ambiente | `development` |
    | `PORT` | Porta do backend Fastify | `4000` |
    | `DATABASE_URL` | URL de conexão PostgreSQL principal | `postgresql://postgres:postgres@localhost:5432/open_video_studio?schema=public` |
    | `DATABASE_TEST_URL` | URL de conexão PostgreSQL para suíte de testes | `postgresql://postgres:postgres@localhost:5433/open_video_studio_test?schema=public` |
    | `REDIS_URL` | URL do Redis (inclui DB index 1 para BullMQ) | `redis://localhost:6379/1` |
    | `MINIO_ROOT_USER` | Usuário administrador do MinIO | `minioadmin` |
    | `MINIO_ROOT_PASSWORD` | Senha administradora do MinIO | `minioadmin` |
    | `MINIO_ENDPOINT_INTERNAL` | Endpoint do MinIO para chamadas do backend | `http://localhost:9000` |
    | `MINIO_ENDPOINT_EXTERNAL` | Endpoint do MinIO exposto ao navegador | `http://localhost:9000` |
    | `OMNIVOICE_IMAGE` | Imagem docker para o serviço Python TTS | `omnivoice:latest` |
    | `OPENAI_API_KEY` | Chave de acesso à API do OpenAI (GPT-4o) | `sk-proj-...` |
    | `PEXELS_API_KEY` | Chave da API de mídias stock Pexels | `your_pexels_key` |
    | `PIXABAY_API_KEY` | Chave da API de mídias stock Pixabay | `your_pixabay_key` |
    | `YOUTUBE_CLIENT_ID` | OAuth2 Client ID do Google Cloud Console | `google_client_id` |
    | `YOUTUBE_CLIENT_SECRET` | OAuth2 Client Secret do Google Cloud Console | `google_client_secret` |
    | `YOUTUBE_REDIRECT_URI` | URI de redirecionamento para o OAuth2 callback | `http://localhost:4000/api/v1/auth/callback/youtube` |
    | `BULL_BOARD_USERNAME` | Usuário para o painel Bull Board | `admin` |
    | `BULL_BOARD_PASSWORD` | Senha para o painel Bull Board | `admin` |
    | `ALLOWED_ORIGINS` | Origens autorizadas para CORS no Fastify | `http://localhost:3000` |
* **Tarefas Técnicas:**
  * Escrever `docker-compose.yml` com a declaração da rede customizada `open-video-studio-net`, do container do TTS Python com imagem parametrizada e do container `postgres_test` de testes.
  * Implementar script de inicialização e política de leitura pública de buckets no backend Fastify via MinIO SDK.
  * Configurar fila do BullMQ no backend Node com opções de retry, backoff e auto-cleanup apontando para o Redis DB index 1.
  * Configurar a rota e middleware do Bull Board com Basic Auth no Fastify.
  * Implementar schemas de Zod de ambiente locais em `apps/web/src/env.ts` e `apps/backend-node/src/env.ts`.

### US-INF-03: Modelagem de Dados (Prisma ORM, Connection Singleton, Seeding) & Compatibilidade Docker
* **Story:**
  Como desenvolvedor backend, quero configurar o Prisma ORM como Singleton global com script de seed e os alvos de binários de compatibilidade de SO, para rodar migrations, popular dados iniciais e executar queries de banco de dados de forma segura sem esgotar o pool de conexões com o PostgreSQL local e em produção.
* **Critérios de Aceite:**
  * **Prisma Client Singleton:** O cliente do Prisma deve ser instanciado como um objeto global único (singleton) no pacote `@repo/database` para reutilizar conexões abertas e evitar o erro 'too many clients' do PostgreSQL durante o hot reloading.
  * **Prisma Database Seeding:** Criação de script `prisma/seed.ts` em `@repo/database` executado automaticamente após cada migrate para popular o banco com canais de teste e perfis de vozes padrões.
  * Configurar `binaryTargets = ["native", "debian-openssl-1.1.x", "linux-musl-openssl-3.0.x"]` no `schema.prisma` para compatibilidade entre macOS/Windows de desenvolvimento e o container Linux (Debian/Alpine) do Coolify.
  * Mapeamento inicial das tabelas básicas (colunas detalhadas e relações serão refinadas conforme o desenvolvimento de cada sprint):
    * `Channel` (Cadastro de canais e tokens de autenticação)
    * `VoiceProfile` (Perfis de vozes salvas na biblioteca)
    * `Project` (Roteiros criados e status)
    * `Scene` (Cenas associadas aos projetos)
  * O pipeline de deploy do Coolify deve rodar `prisma migrate deploy` na etapa de build/pre-deploy.
  * **Prisma Generation Explícito:** Como `ignore-scripts=true` está ativo nas configurações do pnpm, o comando de geração do Prisma Client (`npx prisma generate`) deve ser configurado como uma tarefa técnica explícita a ser rodada de forma segura nas etapas pós-migração e compilação do backend.
* **Tarefas Técnicas:**
  * Escrever a classe/arquivo do Prisma Client Singleton em `packages/database/src/client.ts`.
  * Escrever o script de seed básico em `packages/database/prisma/seed.ts`.
  * Escrever o `schema.prisma` com `binaryTargets` e tabelas mapeadas.
  * Configurar scripts de migrations, seeding e comandos manuais de prisma generate nos pacotes.

### US-INF-04: CI/CD Pipeline (Coolify Webhook) & Git Hooks (Vitest, Remotion Chrome Dependencies)
* **Story:**
  Como engenheiro DevOps, quero configurar git hooks locais, um banco de dados de testes isolado e uma pipeline CI/CD via GitHub Actions com verificações estritas e dependências de renderização Chromium headless no Docker, para garantir que o deploy via webhook do Coolify seja bem-sucedido e os renders de vídeo não travem por falta de dependências.
* **Critérios de Aceite:**
  * **Git Hooks locais:** Husky + Lint-staged configurados no pre-commit executando ESLint e Prettier nos arquivos em staging.
  * **Auditoria de Lockfile (lockfile-lint):** Configurar validação de metadados do lockfile (`lockfile-lint`) localmente no pre-commit (via lint-staged) e no CI/CD, garantindo que todas as dependências instaladas resolvam para o registro npm oficial (`https://registry.npmjs.org/`) e prevenindo ataques de substituição de host ou injeção maliciosa.
  * **Suíte de Testes Isolada com Vitest:** Configurar testes de integração usando o banco de dados dedicado `open_video_studio_test` na porta `5433` (`DATABASE_TEST_URL`) rodando em container específico para isolar e validar a integridade do Prisma sem corromper os dados locais de desenvolvimento.
  * **CI/CD Pipeline & Auditoria de Segurança (GitHub Actions):**
    * A instalação de pacotes nos ambientes de CI/CD e VPS (Coolify) deve ser feita estritamente utilizando a flag `pnpm install --frozen-lockfile` para garantir a imutabilidade das dependências do lockfile.
    * **Auditoria de Vulnerabilidades npm:** O pipeline deve executar um passo de `pnpm audit --audit-level=high` para escanear a árvore de dependências e bloquear builds caso existam vulnerabilidades conhecidas classificadas como High ou Critical.
    * Executa checagem de tipos estrita no Node (TypeScript strict mode, sem `any`).
    * Executa a suite de testes TDD: **Vitest** para aplicações Node/Web, integrado ao comando `turbo run test`.
    * Executa testes de ponta a ponta (E2E) com **Playwright** no CI/CD para validar os fluxos críticos de renderização de mídias e navegação da dashboard.
    * Caso todas as etapas do runner self-hosted passem, envia uma requisição HTTP POST (Webhook) para o Coolify disparar o deploy na Hostinger VPS.
  * **Next.js Standalone Deploy:** Configurar o Dockerfile da aplicação `apps/web` com compilação multi-stage utilizando o output `standalone` do Next.js para otimizar o tamanho da imagem final e simplificar a execução no Coolify.
  * **Remotion Headless Dependencies:** Configurar o Dockerfile da aplicação `backend-node` (que executa a engine do Remotion de forma acoplada) baseado em Node Debian (bullseye-slim), instalando as dependências de sistema do Chrome headless (como `libnss3`, `libasound2`, `libxss1`, `libxtst6`, `libgbm1`, etc.) via apt-get para garantir o correto funcionamento da renderização na VPS.
* **Tarefas Técnicas:**
  * Configurar Husky e lint-staged no monorepo para checar arquivos `.js`, `.ts`, `.tsx` e `.json`.
  * Configurar banco de testes no docker-compose e setup do script de teste do Vitest no backend e frontend.
  * Configurar a suíte de testes E2E com Playwright na pasta correspondente.
  * Criar o Dockerfile standalone em `apps/web/Dockerfile`.
  * Configurar dependências do Remotion/Chromium no Dockerfile do `apps/backend-node`.
  * Escrever `.github/workflows/deploy.yml` configurado para o runner self-hosted.
