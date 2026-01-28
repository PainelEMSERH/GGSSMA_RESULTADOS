/**
 * Busca fuzzy para encontrar unidades e regionais mesmo com erros de digitação
 */

export interface FuzzyMatch {
  text: string;
  score: number;
  original: string;
}

/**
 * Calcula similaridade entre duas strings usando Levenshtein e similaridade de palavras
 */
function similarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const s2 = str2.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - (matrix[len1][len2] / maxLen);
}

/**
 * Busca fuzzy em uma lista de strings
 */
export function fuzzySearch(
  query: string,
  candidates: string[],
  threshold: number = 0.3
): FuzzyMatch[] {
  if (!query || !candidates.length) return [];
  
  const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  
  const matches: FuzzyMatch[] = candidates.map(candidate => {
    const normalizedCandidate = candidate.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    
    // Verifica se a query está contida no candidato ou vice-versa
    if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
      return {
        text: candidate,
        score: 0.95,
        original: candidate,
      };
    }
    
    // Verifica palavras-chave comuns
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
    const candidateWords = normalizedCandidate.split(/\s+/).filter(w => w.length > 2);
    
    let wordScore = 0;
    let matchedWords = 0;
    for (const qw of queryWords) {
      for (const cw of candidateWords) {
        const wordSim = similarity(qw, cw);
        if (wordSim > 0.6) {
          wordScore += wordSim;
          matchedWords++;
        }
      }
    }
    
    const avgWordScore = matchedWords > 0 ? wordScore / matchedWords : 0;
    
    // Similaridade geral
    const generalSim = similarity(normalizedQuery, normalizedCandidate);
    
    // Combina scores
    const finalScore = Math.max(generalSim, avgWordScore * 0.8);
    
    return {
      text: candidate,
      score: finalScore,
      original: candidate,
    };
  }).filter(m => m.score >= threshold);
  
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Extrai possíveis nomes de unidades/regionais de uma pergunta
 */
export function extractLocationNames(question: string): { unidades: string[]; regionais: string[] } {
  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Padrões comuns mais flexíveis
  const patterns = [
    /(?:na|no|da|do|em|unidade|hospital|maternidade|clinica|centro|posto|macro|maternidade|hosp)\s+([a-záàâãéêíóôõúç\s]+?)(?:\s+de\s+([a-záàâãéêíóôõúç\s]+?))?(?:\s+da\s+regional\s+([a-záàâãéêíóôõúç]+))?/gi,
    /(?:regional|regiao|reg)\s+([a-záàâãéêíóôõúç]+)/gi,
    /([a-záàâãéêíóôõúç]+)\s+(?:unidade|hospital|maternidade)/gi,
  ];
  
  const unidades: string[] = [];
  const regionais: string[] = [];
  
  for (const pattern of patterns) {
    const matches = [...question.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        const text = match[1].trim();
        // Remove palavras comuns que não são parte do nome
        const cleaned = text.replace(/\b(na|no|da|do|em|de|a|o|e|ou)\b/gi, '').trim();
        if (cleaned.length > 2) unidades.push(cleaned);
      }
      if (match[2]) {
        const text = match[2].trim();
        if (text.length > 2) unidades.push(text);
      }
      if (match[3]) regionais.push(match[3].trim());
      if (match[4]) regionais.push(match[4].trim());
    }
  }
  
  // Busca por palavras-chave conhecidas (mais flexível)
  const knownUnits = [
    { patterns: ['ruth noleto', 'macro ruth', 'ruth', 'noleto'], name: 'ruth noleto' },
    { patterns: ['feme', 'feme hospital'], name: 'feme' },
    { patterns: ['imperatriz'], name: 'imperatriz' },
    { patterns: ['são luís', 'sao luis', 'sao luiz', 'são luiz'], name: 'são luís' },
    { patterns: ['caxias'], name: 'caxias' },
    { patterns: ['timon'], name: 'timon' },
    { patterns: ['codo', 'codo mendes'], name: 'codo' },
    { patterns: ['bacabal'], name: 'bacabal' },
    { patterns: ['santa ines', 'santa inês', 'santa inez'], name: 'santa inês' },
    { patterns: ['barra do corda', 'barra corda'], name: 'barra do corda' },
    { patterns: ['chapadinha'], name: 'chapadinha' },
    { patterns: ['viana'], name: 'viana' },
    { patterns: ['colinas'], name: 'colinas' },
    { patterns: ['são joão dos patos', 'sao joao dos patos', 'são joão patos'], name: 'são joão dos patos' },
  ];
  
  for (const unit of knownUnits) {
    for (const pattern of unit.patterns) {
      if (q.includes(pattern)) {
        unidades.push(unit.name);
        break;
      }
    }
  }
  
  // Extrai qualquer sequência de palavras que possa ser um nome de unidade
  const words = q.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2 && words.length <= 5) {
    // Tenta combinar palavras consecutivas
    for (let i = 0; i < words.length - 1; i++) {
      const combined = words.slice(i, Math.min(i + 3, words.length)).join(' ');
      if (combined.length > 5) {
        unidades.push(combined);
      }
    }
  }
  
  const knownRegionals = [
    { patterns: ['norte'], name: 'NORTE' },
    { patterns: ['sul'], name: 'SUL' },
    { patterns: ['leste'], name: 'LESTE' },
    { patterns: ['centro', 'central'], name: 'CENTRO' },
  ];
  
  for (const reg of knownRegionals) {
    for (const pattern of reg.patterns) {
      if (q.includes(pattern)) {
        regionais.push(reg.name);
        break;
      }
    }
  }
  
  return {
    unidades: [...new Set(unidades)],
    regionais: [...new Set(regionais)],
  };
}
