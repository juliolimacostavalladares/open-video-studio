/**
 * Serviço de busca de imagens com estratégia avançada.
 * 
 * Implementa:
 * - Busca principal com query otimizada por AI
 * - Fallback automático com query simplificada
 * - Parâmetros de qualidade (editors_choice, min_width, orientation)
 * - Ranking por likes/views para selecionar melhor imagem
 * - Suporte a múltiplos provedores (Pexels, Pixabay)
 */

export interface ImageSearchResult {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  photographer: string;
  provider: 'pexels' | 'pixabay';
  likes?: number;
  views?: number;
}

export interface ImageSearchOptions {
  /** Query de busca (ex: "business+meeting+confident") */
  query: string;
  /** Tipo de imagem */
  imageType?: 'photo' | 'illustration' | 'any';
  /** Orientação preferida */
  orientation?: 'landscape' | 'portrait' | 'square' | 'any';
  /** Largura mínima em pixels */
  minWidth?: number;
  /** Altura mínima em pixels */
  minHeight?: number;
  /** Número máximo de resultados */
  limit?: number;
  /** API Key do Pexels */
  pexelsApiKey?: string;
  /** API Key do Pixabay */
  pixabayApiKey?: string;
}

const DEFAULT_MIN_WIDTH = 1280;
const DEFAULT_MIN_HEIGHT = 720;
const DEFAULT_LIMIT = 20;

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
  };
  liked: boolean;
  alt: string;
  avg_color: string;
}

interface PexelsResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
}

interface PixabayImage {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  views: number;
  downloads: number;
  collections: number;
  likes: number;
  comments: number;
  user_id: number;
  user: string;
  userImageURL: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayImage[];
}

/**
 * Realiza busca no Pexels com parâmetros otimizados
 */
async function searchPexels(options: ImageSearchOptions): Promise<ImageSearchResult[]> {
  const {
    query,
    imageType = 'any',
    orientation = 'any',
    minWidth = DEFAULT_MIN_WIDTH,
    minHeight = DEFAULT_MIN_HEIGHT,
    limit = DEFAULT_LIMIT,
    pexelsApiKey,
  } = options;

  if (!pexelsApiKey) {
    throw new Error('Pexels API key is required');
  }

  const params = new URLSearchParams({
    query,
    per_page: limit.toString(),
    page: '1',
  });

  // Adicionar filtros de orientação se não for 'any'
  if (orientation !== 'any') {
    params.append('orientation', orientation);
  }

  const url = `https://api.pexels.com/v1/search?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: pexelsApiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
  }

  const data: PexelsResponse = await response.json();

  // Filtrar por tamanho mínimo e rankear por qualidade
  const filteredPhotos = data.photos
    .filter(photo => photo.width >= minWidth && photo.height >= minHeight)
    .sort((a, b) => {
      // Priorizar fotos com alt text (mais descritivas)
      const aScore = (a.alt ? 1 : 0) + (a.liked ? 2 : 0);
      const bScore = (b.alt ? 1 : 0) + (b.liked ? 2 : 0);
      return bScore - aScore;
    });

  return filteredPhotos.map(photo => ({
    id: `pexels_${photo.id}`,
    url: photo.src.large2x,
    previewUrl: photo.src.medium,
    width: photo.width,
    height: photo.height,
    photographer: photo.photographer,
    provider: 'pexels',
    likes: undefined, // Pexels não retorna contador público
    views: undefined,
  }));
}

/**
 * Realiza busca no Pixabay com parâmetros otimizados
 */
async function searchPixabay(options: ImageSearchOptions): Promise<ImageSearchResult[]> {
  const {
    query,
    imageType = 'any',
    orientation = 'any',
    minWidth = DEFAULT_MIN_WIDTH,
    minHeight = DEFAULT_MIN_HEIGHT,
    limit = DEFAULT_LIMIT,
    pixabayApiKey,
  } = options;

  if (!pixabayApiKey) {
    throw new Error('Pixabay API key is required');
  }

  const params = new URLSearchParams({
    key: pixabayApiKey,
    q: query,
    image_type: imageType === 'any' ? 'photo,illustration' : imageType,
    orientation: orientation === 'any' ? 'all' : orientation,
    min_width: minWidth.toString(),
    min_height: minHeight.toString(),
    per_page: limit.toString(),
    page: '1',
    order: 'popular', // Ordenar por popularidade (likes/views)
    editors_choice: 'true', // Apenas escolhas dos editores para maior qualidade
  });

  const url = `https://pixabay.com/api/?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Pixabay API error: ${response.status} ${response.statusText}`);
  }

  const data: PixabayResponse = await response.json();

  // Rankear por likes e views (sinal de qualidade visual)
  const sortedHits = data.hits.sort((a, b) => {
    const aScore = a.likes * 2 + a.views / 100;
    const bScore = b.likes * 2 + b.views / 100;
    return bScore - aScore;
  });

  return sortedHits.map(hit => ({
    id: `pixabay_${hit.id}`,
    url: hit.largeImageURL,
    previewUrl: hit.webformatURL,
    width: hit.imageWidth,
    height: hit.imageHeight,
    photographer: hit.user,
    provider: 'pixabay',
    likes: hit.likes,
    views: hit.views,
  }));
}

/**
 * Estratégia de busca com fallback automático
 * 
 * Fluxo:
 * 1. Busca principal com query completa
 * 2. Se retornar < 5 resultados, simplifica query (remove adjetivos)
 * 3. Tenta busca secundária com query simplificada
 * 4. Retorna melhores resultados rankeados
 */
export async function searchImagesWithFallback(
  options: ImageSearchOptions,
): Promise<{
  results: ImageSearchResult[];
  usedQuery: string;
  hadToFallback: boolean;
  provider: 'pexels' | 'pixabay' | 'none';
}> {
  const MIN_RESULTS_THRESHOLD = 5;
  
  // Tentar provedor principal (Pixabay tem mais filtros de qualidade)
  const preferredProvider = options.pixabayApiKey ? 'pixabay' : 
                           options.pexelsApiKey ? 'pexels' : 'none';

  if (preferredProvider === 'none') {
    return {
      results: [],
      usedQuery: options.query,
      hadToFallback: false,
      provider: 'none',
    };
  }

  try {
    // Primeira tentativa com query completa
    let results: ImageSearchResult[] = [];
    
    if (preferredProvider === 'pixabay') {
      results = await searchPixabay(options);
    } else {
      results = await searchPexels(options);
    }

    // Verificar se precisa de fallback
    if (results.length >= MIN_RESULTS_THRESHOLD) {
      return {
        results,
        usedQuery: options.query,
        hadToFallback: false,
        provider: preferredProvider,
      };
    }

    console.log(`[ImageSearch] Only ${results.length} results, trying fallback with simplified query...`);

    // Importar função de simplificação (lazy import para evitar circular dependency)
    const { simplifyQueryForFallback } = await import('./image-keyword-generator.js');
    const simplifiedQuery = simplifyQueryForFallback(options.query);

    // Não tentar fallback se query já é muito curta
    if (simplifiedQuery === options.query || simplifiedQuery.split('+').length < 2) {
      return {
        results,
        usedQuery: options.query,
        hadToFallback: false,
        provider: preferredProvider,
      };
    }

    // Segunda tentativa com query simplificada
    const fallbackOptions: ImageSearchOptions = {
      ...options,
      query: simplifiedQuery,
      // Relaxar filtros na segunda tentativa
      minWidth: Math.floor(options.minWidth ?? DEFAULT_MIN_WIDTH * 0.8),
      minHeight: Math.floor(options.minHeight ?? DEFAULT_MIN_HEIGHT * 0.8),
    };

    let fallbackResults: ImageSearchResult[] = [];
    
    if (preferredProvider === 'pixabay') {
      fallbackResults = await searchPixabay(fallbackOptions);
    } else {
      fallbackResults = await searchPexels(fallbackOptions);
    }

    // Combinar resultados (priorizando os da primeira busca)
    const combinedResults = [...results, ...fallbackResults].slice(0, options.limit ?? DEFAULT_LIMIT);

    return {
      results: combinedResults,
      usedQuery: simplifiedQuery,
      hadToFallback: true,
      provider: preferredProvider,
    };
  } catch (error) {
    console.error('[ImageSearch] Provider failed:', error);
    
    // Tentar provedor alternativo se disponível
    if (preferredProvider === 'pixabay' && options.pexelsApiKey) {
      console.log('[ImageSearch] Falling back to Pexels...');
      try {
        const results = await searchPexels(options);
        return {
          results,
          usedQuery: options.query,
          hadToFallback: false,
          provider: 'pexels',
        };
      } catch (secondaryError) {
        console.error('[ImageSearch] Secondary provider also failed:', secondaryError);
      }
    } else if (preferredProvider === 'pexels' && options.pixabayApiKey) {
      console.log('[ImageSearch] Falling back to Pixabay...');
      try {
        const results = await searchPixabay(options);
        return {
          results,
          usedQuery: options.query,
          hadToFallback: false,
          provider: 'pixabay',
        };
      } catch (secondaryError) {
        console.error('[ImageSearch] Secondary provider also failed:', secondaryError);
      }
    }

    return {
      results: [],
      usedQuery: options.query,
      hadToFallback: false,
      provider: 'none',
    };
  }
}

/**
 * Seleciona a melhor imagem baseada em métricas de qualidade
 */
export function selectBestImage(results: ImageSearchResult[]): ImageSearchResult | null {
  if (results.length === 0) {
    return null;
  }

  // Rankear por score composto
  const ranked = results.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    // Likes (peso alto)
    scoreA += (a.likes ?? 0) * 2;
    scoreB += (b.likes ?? 0) * 2;

    // Views (peso médio)
    scoreA += (a.views ?? 0) / 100;
    scoreB += (b.views ?? 0) / 100;

    // Resolução (peso baixo)
    scoreA += (a.width * a.height) / 10000;
    scoreB += (b.width * b.height) / 10000;

    // Preferir Pixabay (tem mais metadados de qualidade)
    scoreA += a.provider === 'pixabay' ? 5 : 0;
    scoreB += b.provider === 'pixabay' ? 5 : 0;

    return scoreB - scoreA;
  });

  return ranked[0];
}
