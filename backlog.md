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
  * **Nomenclatura de Pacotes (@repo/):** Criação de pacotes compartilhados sob o escopo `@repo/`:
    * `@repo/tsconfig`: Configurações base do TypeScript usando ESM estrito (`"module": "NodeNext"`, `"moduleResolution": "NodeNext"`).
    * `@repo/eslint-config`: Configurações de ESLint base do monorepo, contendo a configuração padrão do Next.js para o frontend e regras recomendadas simplificadas para TypeScript no backend.
    * `@repo/database`: Prisma schema, client PostgreSQL e script de seed.
  * Configurar aliases de caminho absoluto local (`@/*`) estendidos nos tsconfigs de cada app (`apps/web` e `apps/backend-node`) para evitar caminhos relativos longos (ex: `../../`).
  * **Portas Fixas & CORS:** Mapeamento de portas padrão (`3000` web Next.js, `4000` backend-node Fastify) e middleware de CORS configurado nas APIs para aceitar requisições de origens específicas informadas dinamicamente no `.env`.
  * Criação das aplicações em `apps/`:
    * `apps/web`: Next.js (Dashboard) configurada com **App Router**, utilizando **Tailwind CSS** para estilização visual, **Radix UI / Shadcn UI** para base de componentes interativos e **Zustand** para gerenciamento de estado global.
    * `apps/backend-node`: Fastify API com TypeScript estrito (Rotas, BullMQ, YouTube API).
* **Tarefas Técnicas:**
  * Inicializar workspace do pnpm (`pnpm-workspace.yaml`).
  * Configurar `turbo.json` com mapeamento de `globalEnv` e `env` por tarefa.
  * Configurar os pacotes base `@repo/tsconfig` e `@repo/eslint-config`.
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
  * **Validação de Ambiente Local (Zod):** Cada aplicação (`apps/web` e `apps/backend-node`) deve carregar e validar o `.env` no startup através de um esquema do **Zod isolado por pasta**. O frontend web não valida nem expõe as credenciais privadas do banco e Redis do backend.
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
* **Tarefas Técnicas:**
  * Escrever a classe/arquivo do Prisma Client Singleton em `packages/database/src/client.ts`.
  * Escrever o script de seed básico em `packages/database/prisma/seed.ts`.
  * Escrever o `schema.prisma` com `binaryTargets` e tabelas mapeadas.
  * Configurar scripts de migrations e seeding no monorepo.

### US-INF-04: CI/CD Pipeline (Coolify Webhook) & Git Hooks (Vitest, Remotion Chrome Dependencies)
* **Story:**
  Como engenheiro DevOps, quero configurar git hooks locais, um banco de dados de testes isolado e uma pipeline CI/CD via GitHub Actions com verificações estritas e dependências de renderização Chromium headless no Docker, para garantir que o deploy via webhook do Coolify seja bem-sucedido e os renders de vídeo não travem por falta de dependências.
* **Critérios de Aceite:**
  * **Git Hooks locais:** Husky + Lint-staged configurados no pre-commit executando ESLint e Prettier nos arquivos em staging.
  * **Suíte de Testes Isolada com Vitest:** Configurar testes de integração usando o banco de dados dedicado `open_video_studio_test` na porta `5433` (`DATABASE_TEST_URL`) rodando em container específico para isolar e validar a integridade do Prisma sem corromper os dados locais de desenvolvimento.
  * **CI/CD Pipeline (GitHub Actions):**
    * Executa checagem de tipos estrita no Node (TypeScript strict mode, sem `any`).
    * Executa a suite de testes TDD: **Vitest** para aplicações Node/Web, integrado ao comando `turbo run test`.
    * Caso todas as etapas do runner self-hosted passem, envia uma requisição HTTP POST (Webhook) para o Coolify disparar o deploy na Hostinger VPS.
  * **Remotion Headless Dependencies:** Configurar o Dockerfile da aplicação `backend-node` (que executa a engine do Remotion de forma acoplada) baseado em Node Debian (bullseye-slim), instalando as dependências de sistema do Chrome headless (como `libnss3`, `libasound2`, `libxss1`, `libxtst6`, `libgbm1`, etc.) via apt-get para garantir o correto funcionamento da renderização na VPS.
* **Tarefas Técnicas:**
  * Configurar Husky e lint-staged no monorepo para checar arquivos `.js`, `.ts`, `.tsx` e `.json`.
  * Configurar banco de testes no docker-compose e setup do script de teste do Vitest no backend e frontend.
  * Configurar dependências do Remotion/Chromium no Dockerfile do `apps/backend-node`.
  * Escrever `.github/workflows/deploy.yml` configurado para o runner self-hosted.

---

## Sprint 2: Inteligência Artificial & Voz

### US-AI-01: Geração de Roteiro Dinâmico & Parser de Cenas
* **Story:**
  Como criador de conteúdo, quero inserir um tema na plataforma e obter um roteiro estruturado por IA que seja dividido automaticamente em cenas, para que eu possa editá-lo de forma simplificada.
* **Critérios de Aceite:**
  * Endpoint em `backend-node` conectado ao OpenAI GPT-4o.
  * O prompt da IA deve estruturar o roteiro delimitando as cenas por tags claras (ex: `[CENA X]`).
  * O backend deve processar a resposta e salvar o roteiro no banco de dados, criando registros de `Scene` para cada tag encontrada.
* **Tarefas Técnicas:**
  * Implementar integração com OpenAI SDK.
  * Criar algoritmo de regex/parsing de tags de cena em Node.js.

### US-AI-02: Integração com Container Python TTS (OmniVoice)
* **Story:**
  Como criador de conteúdo, quero que o sistema envie os blocos de texto do roteiro para o container do Python TTS via requisições HTTP internas e salve os arquivos de áudio gerados, para realizar a narração por cenas.
* **Critérios de Aceite:**
  * O backend Node se conecta ao container Python TTS via rede interna (`http://omnivoice:8000`).
  * Envia o texto da cena e o ID da voz do canal.
  * O backend Node recebe o arquivo de áudio gerado (`.wav`/`.mp3`) e grava no storage (MinIO).
* **Tarefas Técnicas:**
  * Implementar cliente HTTP no Fastify para integração com a API do OmniVoice.
  * Configurar uploads do buffer de áudio recebido para o MinIO.

### US-AI-03: Engine de Composição no Remotion
* **Story:**
  Como editor de vídeo, quero que o Remotion combine programaticamente os arquivos de áudio de narração, as legendas geradas e as marcações temporais das cenas, para gerar a estrutura inicial do vídeo completo.
* **Critérios de Aceite:**
  * O pacote `packages/remotion-video` deve conseguir ler o JSON estruturado de um projeto.
  * Renderizar as cenas in sequência horizontal linear.
  * Gerar legendas animadas sobrepostas e sincronizadas com a duração exata do áudio de cada cena.
* **Tarefas Técnicas:**
  * Escrever componentes React no Remotion para ler a estrutura de `Scenes`.
  * Integrar lógica de sincronização temporal (áudio duration -> frame duration).

---

## Sprint 3: Mídias, Armazenamento & Fila de Renderização

### US-MED-01: Integração de APIs de Stock & MinIO Storage
* **Story:**
  Como produtor de vídeo, quero que a IA busque automaticamente fotos e vídeos de stock baseados no roteiro e permita que eu faça uploads de gravações próprias, para compor o visual das cenas.
* **Critérios de Aceite:**
  * Serviço de integração com Pexels API e Pixabay API para realizar consultas por palavras-chave e retornar sugestões visuais.
  * Container MinIO configurado para receber uploads de mídias de usuários e armazenar assets do projeto de forma organizada por canal.
* **Tarefas Técnicas:**
  * Criar rotas de busca de mídias e rotas assinadas (presigned URLs) para upload direto ao MinIO.

### US-MED-02: Fila de Jobs de Render (BullMQ)
* **Story:**
  Como gestor do sistema, quero enfileirar as solicitações de renderização de vídeos usando BullMQ e Redis, para que o processador FFmpeg rode de forma sequencial na VPS sem estourar os recursos de CPU e memória RAM.
* **Critérios de Aceite:**
  * Fila de jobs implementada via BullMQ conectada ao Redis.
  * Somente 1 renderização simultânea de vídeo por canal é permitida por worker do backend.
  * O status da renderização ("Aguardando na Fila", "Renderizando", "Concluído", "Falha") deve ser salvo e transmitido via Server-Sent Events (SSE) para o frontend.
* **Tarefas Técnicas:**
  * Configurar fila BullMQ em `backend-node`.
  * Escrever worker de execução remota de render do Remotion CLI.

### US-MED-03: Editor de Thumbnail Multicamadas
* **Story:**
  Como designer do canal, quero criar e editar graficamente a capa do vídeo através de uma interface de canvas interativa, para maximizar o CTR dos lançamentos sem sair da plataforma.
* **Critérios de Aceite:**
  * Mesa de trabalho de canvas interativa (proporção 1280x720px) com suporte a arrastar e redimensionar elementos.
  * Camadas empilháveis controladas pelo usuário (Fundo IA, recortes PNG transparentes de reação, formas, setas de destaque e caixas de texto com estilo).
  * Botão de exportação que gera o arquivo PNG/JPG final otimizado (< 2MB).
* **Tarefas Técnicas:**
  * Criar componente de Canvas Interativo baseado na **Canvas API nativa do HTML5** com manipulação direta de pixels via javascript em React no Next.js.
  * Rota no backend para gerar imagem de fundo via IA Text-to-Image.

---

## Sprint 4: Integrações, Publicação & Dashboard

### US-PUB-01: Conexão OAuth2 & Publicação Automatizada (YouTube API)
* **Story:**
  Como criador de conteúdo, quero conectar meus canais do YouTube usando o login do Google e agendar a publicação automática dos vídeos gerados, para automatizar completamente a minha esteira de publicação.
* **Critérios de Aceite:**
  * Fluxo de autenticação OAuth2 do Google implementado, armazenando os access e refresh tokens no banco local.
  * Formulário de preenchimento de metadados de publicação (Título, Descrição, Tags e Thumbnail).
  * Scheduler de publicação que envia o vídeo na data e hora selecionadas pelo usuário utilizando a YouTube Data API v3.
* **Tarefas Técnicas:**
  * Implementar rotas OAuth de callback.
  * Escrever serviço de cron/agenda que executa o upload do arquivo de vídeo salvo no MinIO para o YouTube.

### US-PUB-02: Interface Web da Área de Trabalho Unificada (Single-Page)
* **Story:**
  Como usuário da plataforma, quero gerenciar o roteiro, a linha do tempo das cenas, a thumbnail e as configurações de publicação em uma única tela de 3 colunas de alto contraste, para obter máxima produtividade na criação.
* **Critérios de Aceite:**
  * Desenvolvimento da interface conforme o documento de [ux_map.md](file:///C:/Users/mac/Documents/open-video-studio/ux_map.md).
  * A tela deve conter:
    * Coluna Esquerda: Editor de roteiro interativo com badges de cena.
    * Coluna Central: Remotion Video Player integrado e Linha do tempo horizontal rolável com blocos de duração proporcional.
    * Coluna Direita: Seletor de vozes, mini preview da thumbnail (clicar abre modal de edição canvas), metadados de publicação e botões de ação final.
  * Integração de **Zustand** para gerenciar a sincronização do frame ativo, áudio duration e dados editados em tempo real entre as três colunas de maneira performática.
  * Atualização dinâmica do progresso de render do Remotion consumindo a stream de **Server-Sent Events (SSE)** exposta pelo Fastify.
  * Utilização do cliente **Axios** encapsulado em React hooks customizados para chamadas de APIs e mutações de dados.
  * Design visual Dark Mode utilizando a biblioteca **Radix UI / Shadcn UI** combinada com **Tailwind CSS**.
* **Tarefas Técnicas:**
  * Desenvolver a dashboard com Next.js App Router e componentes do Radix/Shadcn.
  * Configurar a store global do Zustand para controle unificado de estados (roteiro, timeline, preview).
  * Implementar hooks de conexão Axios e de escuta do endpoint SSE.
