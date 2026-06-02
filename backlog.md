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
    TTS Local OmniVoice          :s6, after s5, 5d
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

## Sprint 1: Fundação & Infraestrutura Full-Stack

### US-INF-01: Setup do Monorepo com Turborepo
* **Story:**
  Como desenvolvedor do projeto, quero configurar a estrutura de monorepo utilizando Turborepo, para que o gerenciamento de dependências, builds, linting e formatação de código de todas as aplicações seja unificado e de alta performance.
* **Critérios de Aceite:**
  * O diretório raiz deve estar inicializado com Turborepo (`turbo.json` configurado).
  * Devem ser criadas as seguintes aplicações em `apps/`:
    * `apps/web`: Next.js (Dashboard).
    * `apps/backend-node`: Express/Fastify (Rotas, BullMQ, YouTube API).
    * `apps/backend-python`: FastAPI (TTS e clonagem de voz).
  * Devem ser criados os seguintes pacotes em `packages/`:
    * `packages/database`: Prisma schema e client.
    * `packages/remotion-video`: Estrutura base de composições de vídeo.
* **Tarefas Técnicas:**
  * Inicializar workspace do pnpm (`pnpm-workspace.yaml`).
  * Configurar scripts de build, dev e lint no root `package.json` integrados ao `turbo`.

### US-INF-02: Serviços Containerizados (Docker Compose)
* **Story:**
  Como arquiteto do sistema, quero definir e configurar os serviços auxiliares em um arquivo `docker-compose.yml`, para que o banco de dados PostgreSQL, o storage MinIO e o Redis (BullMQ) possam ser inicializados localmente e na VPS de forma consistente.
* **Critérios de Aceite:**
  * O arquivo `docker-compose.yml` deve expor as portas de:
    * PostgreSQL (porta `5432`).
    * Redis (porta `6379`).
    * MinIO (porta `9000` API, `9001` Console).
  * Todos os volumes de dados dos containers devem ser persistidos localmente (pastas ignoradas no `.gitignore`).
* **Tarefas Técnicas:**
  * Escrever `docker-compose.yml` com variáveis de ambiente configuráveis via arquivo `.env`.

### US-INF-03: Modelagem de Dados & Prisma Setup
* **Story:**
  Como desenvolvedor backend, quero configurar o Prisma ORM e modelar as tabelas no PostgreSQL, para gerenciar com segurança o estado de canais, perfis de voz, projetos de vídeo e metadados.
* **Critérios de Aceite:**
  * Configuração do cliente do Prisma no pacote `packages/database`.
  * Criação do schema inicial contendo as entidades:
    * `Channel`: Informações do canal do YouTube e tokens OAuth2 de publicação.
    * `VoiceProfile`: Perfis de voz clonados (nome da voz, path do áudio de amostra).
    * `Project`: Projetos de vídeo (título, descrição, roteiro bruto, status de renderização).
    * `Scene`: Blocos de cena (texto TTS, path da narração gerada, URL da mídia associada, ordem).
  * Execução da primeira migration do Prisma com sucesso no banco local.
* **Tarefas Técnicas:**
  * Escrever as entidades no `schema.prisma`.
  * Configurar script `db:migrate` e `db:generate` no monorepo.

### US-INF-04: CI/CD & Git Hooks (Self-hosted)
* **Story:**
  Como engenheiro DevOps, quero configurar um workflow do GitHub Actions e git hooks, para garantir automação de deploys para a VPS via Coolify e padronização do código antes de cada commit.
* **Critérios de Aceite:**
  * Configuração do Husky no repositório com hook de `pre-commit` executando testes rápidos, prettier e linter.
  * Criação de workflow `.github/workflows/deploy.yml` configurado para rodar em runner self-hosted conectado à Hostinger VPS.
  * O workflow deve validar o build do Turborepo e disparar a atualização de containers no Coolify.
* **Tarefas Técnicas:**
  * Configurar Husky e lint-staged.
  * Escrever arquivos yaml do GitHub Actions.

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
  * Criar algoritmo de regex/parsing de tags de cena in Node.js.

### US-AI-02: Narração TTS Segmentada por Cenas (Python Backend)
* **Story:**
  Como criador de conteúdo, quero que o sistema gere a narração de voz para cada cena individualmente a partir do texto do roteiro usando perfis de voz clonados locais, para otimizar o tempo de regeneração de áudios.
* **Critérios de Aceite:**
  * Endpoint in `backend-python` (FastAPI) que receba um texto e o ID da voz do canal.
  * Geração local de áudio (`.wav`/`.mp3`) de alta fidelidade rodando OmniVoice Studio localmente.
  * Gravação dos arquivos de áudio de forma indexada por cena no storage (MinIO).
* **Tarefas Técnicas:**
  * Configurar runtime Python com dependências do OmniVoice Studio (coqui-tts/similar).
  * Expor API de síntese e integração com MinIO SDK em Python.

### US-AI-03: Engine de Composição no Remotion
* **Story:**
  Como editor de vídeo, quero que o Remotion combine programaticamente os arquivos de áudio de narração, as legendas geradas e as marcações temporais das cenas, para gerar a estrutura inicial do vídeo completo.
* **Critérios de Aceite:**
  * O pacote `packages/remotion-video` deve conseguir ler o JSON estruturado de um projeto.
  * Renderizar as cenas em sequência horizontal linear.
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
  * O status da renderização ("Aguardando na Fila", "Renderizando", "Concluído", "Falha") deve ser salvo e transmitido via WebSockets.
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
  * Criar componente de Canvas Interativo (usando Fabric.js ou Canvas API padrão) em React no Next.js.
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
  * Tema visual Dark Mode com transições suaves e design premium de alto contraste.
* **Tarefas Técnicas:**
  * Desenvolver os painéis da dashboard em Next.js.
  * Integrar chamadas de API com Tailwind CSS / CSS Modules estruturados.
