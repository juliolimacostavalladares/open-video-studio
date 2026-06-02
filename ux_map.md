# UX/UI Map - Open Video Studio: Área de Trabalho Unificada (Single-Page)

Este documento define o mapeamento de fluxo de telas, o layout visual dos componentes e o comportamento interativo da interface do **Open Video Studio**, assegurando consistência visual e facilidade de desenvolvimento.

---

## 1. Diretrizes de Design & Identidade Visual

### Estética Premium (Dark Mode Nativo)
* **Cores Principais (Paleta HSL):**
  * `Fundo App`: `#0d0f12` (Cinza chumbo quase preto, profundo).
  * `Fundo Painéis`: `#14171c` (Cinza escuro com bordas sutis).
  * `Destaques / Ações Primárias`: `#3b82f6` (Azul neon vibrante para botões principais).
  * `Ações Secundárias / IA`: `#8b5cf6` (Roxo elétrico para botões e inputs inteligentes).
  * `Texto Principal`: `#f3f4f6` (Branco gelo).
  * `Texto Secundário / Placeholders`: `#9ca3af` (Cinza neutro).
  * `Status Sucesso / Ativo`: `#10b981` (Verde esmeralda).
  * `Status Alerta / Erro`: `#ef4444` (Vermelho escarlate).

### Tipografia
* **Fonte do Painel:** `Inter` ou `Outfit` (importada do Google Fonts) para alta legibilidade.
* **Tamanhos e Hierarquia:**
  * Título Principal: `24px`, Semi-Bold, cor branca.
  * Títulos de Painéis: `16px`, Medium, cor cinza claro com ícone.
  * Texto do Roteiro (Notion-like): `15px`, Regular, espaçamento de linha `1.6`, cor branca.
  * Legendas e Metadados: `12px` a `14px`, Regular.

### Limitações de Layout
* **Fixo Desktop (1920x1080):** A plataforma será exibida apenas em monitores desktop de alta resolução. O layout usa um grid de altura fixa (`vh: 100`) para eliminar barras de rolagem globais na página (apenas painéis internos rolam).

---

## 2. Layout da Tela Principal (3 Colunas)

```
+---------------------------------------------------------------------------------------------------+
|  [Logo] Open Video Studio         Projeto: [Minha Curiosidade #1]           Canal: [Canal Dark A v] |
+---------------------------------+---------------------------------+-------------------------------+
|                                 |                                 |                               |
|  COLUNA ESQUERDA (30%)          |  COLUNA CENTRAL (40%)           |  COLUNA DIREITA (30%)         |
|  [Roteiro & Escrita Livre]      |  [Preview de Vídeo - Remotion]  |  [Configurações & Metadados]  |
|                                 |  +---------------------------+  |                               |
|  [CENA 1]                       |  |                           |  |  Brand Kit & Voz:             |
|  Este é o hook inicial de...    |  |       Video Player        |  |  Voz: [Narrador Fatos A v]    |
|                                 |  |         (Remotion)        |  |  Legenda: [Customized v]      |
|  [CENA 2]                       |  |                           |  |                               |
|  Em seguida, vamos mostrar...   |  +---------------------------+  |  Thumbnail Preview:           |
|                                 |  |                               |  +-------------+              |
|  [CENA 3]                       |  [Timeline de Cenas - Clássica] |  | [Thumbnail] | [Editar Thumbnail]
|  Por fim, o call to action...   |  +---+------+---+-----------+---+  |  1280x720   |              |
|                                 |  |C1 |  C2  |C3 |    C4     |C5 |  +-------------+              |
|                                 |  +---+------+---+-----------+---+  |                               |
|                                 |                                 |  Metadados do YouTube:        |
|  +---------------------------+  |  [Trilha Sonora & Música]       |  Título: [__________________]  |
|  | Ajustar com IA: [  (Prompt)  |  | Volume: [||||||||||  ]        |  Descrição: [_______________]  |
|  +---------------------------+  |  | Trilha: [Mood Dinâmico v]     |  Tags: [____________________]  |
|                                 |  +-----------------------------+  |                               |
|                                 |                                 |  [Renderizar] [Agendar/Publicar]
+---------------------------------+---------------------------------+-------------------------------+
```

### 2.1. Cabeçalho Superior (Header)
* **Esquerda:** Logotipo do Open Video Studio em gradiente roxo-azul.
* **Centro:** Seletor de projetos ativos (dropdown) e indicador de progresso de renderizações em segundo plano (fila ativa).
* **Direita:** Dropdown de seleção do Canal ativo do YouTube (vinculado ao OAuth2) com foto de perfil e botão de configurações.

### 2.2. Coluna Esquerda: Roteiro & Assistência de IA (30% da largura)
* **Área de Escrita Notion-like:**
  * Editor de texto contínuo, limpo e minimalista.
  * Parsing automático: O editor detecta tags `[CENA X]` e destaca a linha com um badge colorido indicando o início de uma nova cena.
* **Barra Flutuante de IA:**
  * Surge ao selecionar qualquer trecho do texto.
  * Opções rápidas: "Reescrever", "Encurtar", "Melhorar Retenção (Adicionar Hook)", e campo de texto livre para enviar instruções personalizadas para a API GPT-4o.

### 2.3. Coluna Central: Visualizador & Timeline Horizontal (40% da largura)
* **Player de Vídeo (Remotion):**
  * Canvas do player centralizado com controles de reprodução (Play, Pause, Skip de cena, tempo atual/total).
  * Renderiza o áudio gerado pelo TTS integrado com a composição visual.
* **Timeline Clássica Horizontal:**
  * Disposição horizontal de blocos de cena.
  * O tamanho horizontal de cada bloco é proporcional à duração estimada da cena em segundos.
  * Cada bloco mostra: ID da cena (`C1`, `C2`), ícone indicador do tipo de mídia (vídeo ou imagem), e uma miniatura borrada da mídia ativa.
  * Clicar em um bloco move a agulha de reprodução do vídeo para o início da respectiva cena.
* **Painel de Trilha Sonora:**
  * Dropdown para seleção de músicas de fundo categorizadas por *mood* (energético, inspirador, suspense, relaxante).
  * Slider de controle de volume da música (com ducking ativo pré-configurado).

### 2.4. Coluna Direita: Metadados, Thumbnail & Ações (30% da largura)
* **Seletor de Brand Kit & Voz:**
  * Dropdown para selecionar a voz do canal cadastrada na Biblioteca de Perfis.
  * Link rápido para abrir a biblioteca e criar/clonar novas vozes.
* **Painel de Thumbnail:**
  * Exibe um preview estático (proporção 16:9 compactada) da Thumbnail gerada.
  * Botão de destaque "Editar Thumbnail" para expandir a mesa de trabalho em tela cheia.
* **Campos de Metadados de Publicação:**
  * Inputs dedicados para: Título do Vídeo, Descrição Completa e Tags.
  * Botão com ícone de varinha mágica para autogerar/sugerir títulos de alto impacto usando IA.
* **Ações de Renderização e Publicação:**
  * Botão primário grande `[Renderizar Vídeo]` (dispara o job para a fila BullMQ).
  * Botão secundário grande `[Agendar / Publicar]` (dispara o fluxo de upload).

---

## 3. Modais e Interfaces Expandidas (Overlays)

### 3.1. Modal Central de Busca e Biblioteca de Mídias (Módulo 3)
* **Gatilho:** Clicar em uma cena na Timeline Horizontal ou clicar no botão "Substituir Mídia" nas opções da cena.
* **Layout da Modal:**
  * **Aba 1: Pesquisar Stock (Pexels/Pixabay):** Barra de pesquisa de palavras-chave, botões de filtro (Apenas Vídeos, Apenas Imagens, Orientação Horizontal) e um grid de resultados rolável infinito. Ao passar o mouse sobre o vídeo de stock, ele exibe um preview rápido em loop.
  * **Aba 2: Meus Uploads (MinIO):** Exibe as mídias salvas na VPS pelo usuário para aquele canal específico. Inclui um container pontilhado de Drag and Drop para enviar novos arquivos de até 200MB.
* **Ação:** Clicar na mídia desejada fecha a modal e atualiza instantaneamente a linha do tempo e o player do Remotion.

### 3.2. Modal do Editor de Thumbnail Multicamadas (Módulo 5)
* **Gatilho:** Clicar na miniatura da thumbnail ou no botão "Editar Thumbnail" na Coluna Direita.
* **Layout da Modal:**
  * Centralizado: Um canvas grande em resolução de proporção exata de 1280x720px.
  * Barra Lateral Esquerda: Lista de Camadas ativas em formato de pilha (z-index). O usuário pode arrastar para reordenar, ocultar ou excluir camadas.
  * Barra de Ferramentas Superior:
    * `[Adicionar Texto]` (insere uma nova caixa de texto editável).
    * `[Upload de Recorte]` (carrega imagens transparentes/PNG locais).
    * `[Trocar Fundo]` (abre o prompt de geração Text-to-Image por IA ou upload de imagem).
    * `[Adicionar Formas/Setas]` (insere vetores simples de indicação).
  * Clicar sobre um elemento no Canvas ativa seletores de redimensionamento, rotação e um menu rápido de estilos (cor, borda, sombra e fonte).
* **Ação:** Botão `[Salvar e Aplicar]` salva a imagem no MinIO e atualiza o preview no painel principal.

---

## 4. Fluxos Principais de Interação (User Flows)

### Fluxo A: Criação Completa (Tema ao Render)
```
1. Usuário entra no App -> 2. Insere Tema no input do cabeçalho e seleciona o Canal/Voz ->
3. IA GPT-4o gera o roteiro contínuo na Coluna Esquerda ->
4. Sistema faz o parsing do roteiro, gera arquivos TTS locais por cena e busca assets stock no Pexels ->
5. Player do Remotion carrega a composição inicial com as mídias e legendas sincronizadas ->
6. Usuário revisa o roteiro, faz ajustes finos no texto e clica em "Renderizar Vídeo".
```

### Fluxo B: Substituição de Mídia de Cena
```
1. Usuário ouve/vê uma cena específica na Coluna Central ->
2. Clica sobre o bloco da cena C2 na Timeline Horizontal ->
3. Modal Central de Busca e Biblioteca é aberta ->
4. Usuário pesquisa por "programação de computadores" na aba de stock ->
5. Clica no vídeo que mais lhe agrada ->
6. Modal se fecha e o player de preview atualiza a cena C2 com o novo vídeo selecionado.
```

### Fluxo C: Criação de Thumbnail e Publicação
```
1. Vídeo finalizado na fila de render ->
2. Usuário clica na miniatura de Thumbnail no painel direito ->
3. Modal expansível do Editor de Thumbnail abre ->
4. Usuário digita um título chamativo, arrasta para o lado, adiciona uma seta vermelha apontando para o centro ->
5. Clica em "Salvar e Aplicar" ->
6. Edita os metadados sugeridos pela IA nos inputs da direita ->
7. Clica em "Agendar / Publicar" ->
8. Escolhe a data e horário no calendário ->
9. Confirma a publicação. O sistema enfileira o envio final para o YouTube API v3.
```
