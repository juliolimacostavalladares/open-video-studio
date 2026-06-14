/**
 * Serviço de geração de keywords otimizadas para busca de imagens.
 * 
 * Este módulo usa IA para transformar trechos de narração em queries
 * de busca otimizadas para APIs de banco de imagens (Pexels, Pixabay, etc).
 * 
 * Estratégia:
 * - Atua como "Diretor de Arte" para interpretar contexto semântico
 * - Foca em objeto principal, ação e clima emocional
 * - Evita termos genéricos
 * - Converte conceitos abstratos em representações visuais concretas
 * - Retorna keywords em inglês para melhor compatibilidade com APIs internacionais
 */

import type { AiClient } from './client.js';

export interface ImageKeywordInput {
  sceneTitle: string;
  sceneScript: string;
  fullContext?: string; // Contexto completo do vídeo para coerência visual
  videoStyle?: 'corporate' | 'creative' | 'educational' | 'documentary';
}

export interface ImageKeywordResult {
  /** Query otimizada para busca (ex: "man+running+rain+dramatic") */
  searchQuery: string;
  /** Keywords individuais para fallback */
  keywords: string[];
  /** Tipo de imagem recomendado */
  imageType: 'photo' | 'illustration' | 'any';
  /** Justificativa da escolha (opcional, para debug) */
  reasoning?: string;
}

const STYLE_MAPPING: Record<string, string> = {
  corporate: 'professional photo, clean composition, business setting',
  creative: 'artistic illustration, vibrant colors, conceptual',
  educational: 'clear diagram, educational illustration, simple',
  documentary: 'realistic photo, natural lighting, authentic moment',
};

function buildPrompt(input: ImageKeywordInput): string {
  const styleHint = input.videoStyle 
    ? `Estilo visual: ${STYLE_MAPPING[input.videoStyle] || STYLE_MAPPING.educational}`
    : 'Estilo visual: versátil, alta qualidade';

  return `Você é um Diretor de Arte especialista em curadoria de imagens para vídeos.

Sua tarefa é analisar um trecho de narração e criar uma query de busca OTIMIZADA para bancos de imagens (Pexels, Pixabay, Unsplash).

CONTEXTO DA CENA:
- Título: ${input.sceneTitle}
- Narração: "${input.sceneScript}"
${input.fullContext ? `- Contexto Completo: ${input.fullContext}` : ''}
- ${styleHint}

INSTRUÇÕES OBRIGATÓRIAS:
1. Identifique o OBJETO PRINCIPAL da cena (pessoa, objeto, lugar)
2. Identifique a AÇÃO ou ESTADO emocional (correndo, frustrado, celebrando)
3. Identifique o CLIMA/AMBIENTE (chuva, escritório, amanhecer, dramático)
4. Se o conceito for ABSTRATO (ex: "sucesso", "liberdade"), traduza para representação visual concreta (ex: "pessoa escalando montanha", "pássaro voando livre")
5. EVITE termos genéricos como "bonito", "legal", "coisa"
6. Gere keywords EM INGLÊS (APIs de imagens funcionam melhor em inglês)
7. Use formato de URL: palavras separadas por "+" (ex: "business+meeting+confident")

EXEMPLOS:
- Narração: "O mercado financeiro colapsou rapidamente"
  → Query: "stock+market+crash+panic+traders+red+charts"
  
- Narração: "A tecnologia transforma nossas vidas"
  → Query: "person+using+smartphone+digital+transformation+glow"
  
- Narração: "Sucesso requer persistência"
  → Query: "athlete+climbing+mountain+sunrise+determination"

FORMATO DE RESPOSTA (JSON estrito, sem markdown):
{
  "searchQuery": "string formatada com +",
  "keywords": ["array", "de", "palavras", "individuais"],
  "imageType": "photo ou illustration",
  "reasoning": "breve explicação da escolha visual"
}

Retorne APENAS o JSON válido.`;
}

export async function generateImageKeywords(
  input: ImageKeywordInput,
  aiClient: AiClient,
): Promise<ImageKeywordResult> {
  try {
    const prompt = buildPrompt(input);
    const rawResponse = await aiClient.generate(prompt);
    
    // Limpar resposta e extrair JSON
    const cleanedResponse = rawResponse
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    const parsed = JSON.parse(cleanedResponse) as ImageKeywordResult;
    
    // Validação básica
    if (!parsed.searchQuery || typeof parsed.searchQuery !== 'string') {
      throw new Error('AI did not return valid searchQuery');
    }
    
    if (!Array.isArray(parsed.keywords) || parsed.keywords.length === 0) {
      // Fallback: extrair keywords da searchQuery
      parsed.keywords = parsed.searchQuery.split('+').filter(k => k.length > 0);
    }
    
    if (!['photo', 'illustration', 'any'].includes(parsed.imageType)) {
      parsed.imageType = 'any';
    }
    
    return parsed;
  } catch (error) {
    console.error('[generateImageKeywords] AI failed, falling back to basic extraction:', error);
    
    // Fallback determinístico em caso de falha da AI
    return generateFallbackKeywords(input);
  }
}

/**
 * Fallback determinístico quando a AI falha ou não está disponível
 */
function generateFallbackKeywords(input: ImageKeywordInput): ImageKeywordResult {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'dare', 'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'whom',
    'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also'
  ]);

  const normalizeToken = (value: string) => {
    return value
      .normalize('NFD')
      .replaceAll(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '');
  };

  const extractTokens = (text: string) => {
    return normalizeToken(text)
      .split(/\s+/)
      .filter(token => token.length >= 3 && !stopWords.has(token));
  };

  // Extrair tokens do título e script
  const allTokens = [
    ...extractTokens(input.sceneTitle),
    ...extractTokens(input.sceneScript),
  ];

  // Remover duplicatas mantendo ordem
  const uniqueTokens = [...new Set(allTokens)];
  
  // Tradução básica PT->EN para keywords comuns (pode ser expandido)
  const ptToEnMap: Record<string, string> = {
    'tecnologia': 'technology',
    'negocios': 'business',
    'mercado': 'market',
    'sucesso': 'success',
    'crescimento': 'growth',
    'equipe': 'team',
    'pessoa': 'person',
    'pessoas': 'people',
    'tempo': 'time',
    'dados': 'data',
    'informacao': 'information',
    'internet': 'internet',
    'digital': 'digital',
    'futuro': 'future',
    'inovacao': 'innovation',
    'ideia': 'idea',
    'projeto': 'project',
    'trabalho': 'work',
    'empresa': 'company',
    'dinheiro': 'money',
    'investimento': 'investment',
  };

  const translatedTokens = uniqueTokens.map(token => 
    ptToEnMap[token] || token
  ).slice(0, 8);

  const searchQuery = translatedTokens.join('+');
  
  // Determinar tipo de imagem baseado no estilo ou conteúdo
  let imageType: 'photo' | 'illustration' | 'any' = 'any';
  if (input.videoStyle === 'corporate' || input.videoStyle === 'documentary') {
    imageType = 'photo';
  } else if (input.videoStyle === 'creative' || input.videoStyle === 'educational') {
    imageType = 'illustration';
  }

  return {
    searchQuery,
    keywords: translatedTokens,
    imageType,
    reasoning: 'Fallback: extracted from title and script tokens',
  };
}

/**
 * Simplifica uma query removendo adjetivos para busca fallback
 * Ex: "man+running+frustrated+rain" → "man+running"
 */
export function simplifyQueryForFallback(searchQuery: string): string {
  const keywords = searchQuery.split('+');
  
  // Palavras que podem ser removidas em fallback (adjetivos, advérbios)
  const removableWords = new Set([
    'dramatic', 'beautiful', 'amazing', 'great', 'good', 'bad', 'ugly',
    'fast', 'slow', 'quick', 'rapid', 'happy', 'sad', 'angry', 'frustrated',
    'excited', 'calm', 'peaceful', 'chaotic', 'bright', 'dark', 'light',
    'heavy', 'small', 'big', 'large', 'tiny', 'huge', 'modern', 'ancient',
    'new', 'old', 'young', 'fresh', 'clean', 'dirty', 'professional', 'casual',
    'formal', 'informal', 'elegant', 'simple', 'complex', 'easy', 'difficult',
    'hard', 'soft', 'rough', 'smooth', 'warm', 'cold', 'hot', 'cool',
    'vibrant', 'colorful', 'monochrome', 'minimalist', 'detailed', 'abstract',
    'concrete', 'realistic', 'fantasy', 'magical', 'mysterious', 'clear',
    'blurry', 'sharp', 'focused', 'dynamic', 'static', 'active', 'passive',
  ]);

  // Manter apenas substantivos/verbos principais (primeiras 2-3 palavras não removíveis)
  const essentialKeywords = keywords.filter(k => !removableWords.has(k.toLowerCase()));
  
  return essentialKeywords.slice(0, 3).join('+') || keywords.slice(0, 2).join('+');
}
