// Math Engine - ported from Python math_engine.py

export interface DataRow {
  id: number // Unique numeric ID
  name: string // Display name (can be duplicate, e.g. filename)
  истинный_класс: string
  предсказанный_класс: string
  уверенность: number
  неуверенность: number
  энтропия: number
  norm_entropy: number
  дубликат: boolean
  новизна: number
  вероятность_ошибки_разметки: number
  дефицит_класса: number
  полезность: number
  комментарий: string
  нужен_эксперт: boolean
  автор_разметки: string
  разметчик?: string // Alternative column name for author
  вероятность_ошибки_человека: number
  [key: string]: string | number | boolean | undefined
}

// Generate unique numeric ID
let idCounter = 1000000
function generateUniqueId(): number {
  return idCounter++ + Math.floor(Math.random() * 9000000)
}

export interface ProjectData {
  created_at: string
  data: DataRow[] | null
  classes: string[]
  versions: { name: string; data: DataRow[]; readiness: number }[]
}

export interface Project {
  name: string
  data: ProjectData
}

// Calculate base metrics from probability columns
export function calculateBaseMetrics(rows: DataRow[], classes: string[]): DataRow[] {
  const probCols = classes.map(c => `prob_${c}`)
  
  return rows.map(row => {
    const probs = probCols.map(col => Number(row[col]) || 0)
    const maxProb = Math.max(...probs)
    const maxIdx = probs.indexOf(maxProb)
    
    // Entropy calculation
    const maxEntropy = Math.log2(classes.length + 1e-9)
    const entropy = -probs.reduce((sum, p) => {
      if (p > 0) return sum + p * Math.log2(p + 1e-9)
      return sum
    }, 0)
    
    return {
      ...row,
      уверенность: Number(maxProb.toFixed(4)),
      неуверенность: Number((1 - maxProb).toFixed(4)),
      энтропия: Number(entropy.toFixed(4)),
      norm_entropy: Number((entropy / maxEntropy).toFixed(4)),
      предсказанный_класс: classes[maxIdx] || row.истинный_класс,
    }
  })
}

// Mark duplicates based on probability columns and class
export function markDuplicates(rows: DataRow[], classes: string[]): DataRow[] {
  const probCols = classes.map(c => `prob_${c}`)
  const seen = new Set<string>()
  const duplicateKeys = new Set<string>()
  
  // First pass: find all duplicate keys
  rows.forEach(row => {
    const key = [...probCols.map(col => row[col]), row.истинный_класс].join('|')
    if (seen.has(key)) {
      duplicateKeys.add(key)
    }
    seen.add(key)
  })
  
  // Second pass: mark duplicates
  return rows.map(row => {
    const key = [...probCols.map(col => row[col]), row.истинный_класс].join('|')
    return {
      ...row,
      дубликат: duplicateKeys.has(key)
    }
  })
}

// Calculate novelty score (OOD-score) using simulated embeddings
export function calculateNovelty(rows: DataRow[], classes: string[]): DataRow[] {
  // Generate stable pseudo-random embeddings
  const embeddings = rows.map((_, i) => {
    const emb: number[] = []
    for (let j = 0; j < 16; j++) {
      // Seeded random for stability
      emb.push(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453 % 1)
    }
    return emb
  })
  
  // Calculate centroids for each class
  const centroids: Record<string, number[]> = {}
  
  classes.forEach(cls => {
    const classRows = rows
      .map((row, i) => ({ row, emb: embeddings[i] }))
      .filter(({ row }) => row.предсказанный_класс === cls && row.уверенность > 0.7)
    
    if (classRows.length > 0) {
      const centroid = Array(16).fill(0)
      classRows.forEach(({ emb }) => {
        emb.forEach((val, i) => centroid[i] += val)
      })
      centroids[cls] = centroid.map(v => v / classRows.length)
    } else {
      // Fallback: use global mean
      const globalCentroid = Array(16).fill(0)
      embeddings.forEach(emb => {
        emb.forEach((val, i) => globalCentroid[i] += val)
      })
      centroids[cls] = globalCentroid.map(v => v / embeddings.length)
    }
  })
  
  // Calculate novelty scores
  const noveltyScores = rows.map((row, i) => {
    const vec = embeddings[i]
    const cent = centroids[row.предсказанный_класс] || centroids[classes[0]]
    
    // Cosine distance
    const dot = vec.reduce((sum, v, j) => sum + v * cent[j], 0)
    const normVec = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    const normCent = Math.sqrt(cent.reduce((sum, v) => sum + v * v, 0))
    
    if (normVec === 0 || normCent === 0) return 1.0
    
    const sim = dot / (normVec * normCent)
    return 1.0 - sim
  })
  
  // Normalize
  const maxDist = Math.max(...noveltyScores, 0.001)
  
  return rows.map((row, i) => ({
    ...row,
    новизна: Number((noveltyScores[i] / maxDist).toFixed(4))
  }))
}

// Calculate Bayesian error probability
export function calculateBayesianError(rows: DataRow[]): DataRow[] {
  return rows.map(row => {
    // Support both column names: разметчик (new) and автор_разметки (old)
    const author = row.разметчик || row.автор_разметки || (Math.random() > 0.5 ? 'AutoLabel' : 'Intern_Vasya')
    
    // Specific error rates: Intern_Vasya = 40%, AutoLabel = 10%
    const humanErrorProb = author === 'Intern_Vasya' ? 0.40 : 0.10
    
    const mismatch = row.истинный_класс !== row.предсказанный_класс
    
    let errorProb: number
    if (mismatch) {
      errorProb = row.уверенность * (1 + humanErrorProb)
    } else {
      errorProb = (1 - row.уверенность) * humanErrorProb * 0.5
    }
    
    return {
      ...row,
      автор_разметки: author,
      вероятность_ошибки_человека: humanErrorProb,
      вероятность_ошибки_разметки: Number(Math.min(Math.max(errorProb, 0), 1).toFixed(4))
    }
  })
}

// Calculate class deficit
export function calculateClassDeficit(rows: DataRow[], classes: string[]): DataRow[] {
  const classCounts: Record<string, number> = {}
  classes.forEach(cls => classCounts[cls] = 0)
  rows.forEach(row => {
    if (classCounts[row.истинный_класс] !== undefined) {
      classCounts[row.истинный_класс]++
    }
  })
  
  const total = rows.length
  const idealShare = 1.0 / classes.length
  
  return rows.map(row => {
    const count = classCounts[row.истинный_класс] || 0
    const deficit = count === 0 ? 10.0 : idealShare / (count / total)
    
    return {
      ...row,
      дефицит_класса: Number(deficit.toFixed(4))
    }
  })
}

// Calculate utility score
export function calculateUtility(rows: DataRow[]): DataRow[] {
  return rows.map(row => {
    const utility = row.дубликат 
      ? 0.0 
      : row.norm_entropy * 0.3 + 
        row.вероятность_ошибки_разметки * 0.3 + 
        row.дефицит_класса * 0.2 + 
        row.новизна * 0.2
    
    return {
      ...row,
      полезность: Number(utility.toFixed(4))
    }
  })
}

// Get dataset metrics
export function getDatasetMetrics(rows: DataRow[], classes: string[]): { imbalanceIndex: number; readinessLevel: number } {
  if (rows.length === 0) return { imbalanceIndex: 0, readinessLevel: 0 }
  
  const total = rows.length
  const dupes = rows.filter(r => r.дубликат).length
  const errors = rows.filter(r => r.вероятность_ошибки_разметки > 0.5).length
  
  // Calculate class shares
  const classCounts: Record<string, number> = {}
  classes.forEach(cls => classCounts[cls] = 0)
  rows.forEach(row => {
    if (classCounts[row.истинный_класс] !== undefined) {
      classCounts[row.истинный_класс]++
    }
  })
  
  const shares = classes.map(cls => (classCounts[cls] || 0) / total)
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length
  const variance = shares.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / shares.length
  const imbalanceIndex = Math.sqrt(variance) * classes.length
  
  const readiness = Math.max(0, 100 - (dupes / total * 100) - (errors / total * 100) - (imbalanceIndex * 15))
  
  return {
    imbalanceIndex: Number(imbalanceIndex.toFixed(4)),
    readinessLevel: Number(readiness.toFixed(1))
  }
}

// Initial process dataset
export function initialProcessDataset(rawRows: Record<string, unknown>[]): { rows: DataRow[]; classes: string[] } {
  // Extract classes from prob_ columns
  const probCols = Object.keys(rawRows[0] || {}).filter(col => col.startsWith('prob_'))
  const classes = probCols.map(col => col.replace('prob_', ''))
  
  // Initialize rows with default values and UNIQUE IDs
  let rows: DataRow[] = rawRows.map((raw, idx) => ({
    id: generateUniqueId(), // Unique numeric ID
    name: (raw.id_объекта as string) || (raw.name as string) || `obj_${idx}`, // Display name (can be duplicated)
    истинный_класс: (raw.истинный_класс as string) || classes[0] || '',
    предсказанный_класс: '',
    уверенность: 0,
    неуверенность: 0,
    энтропия: 0,
    norm_entropy: 0,
    дубликат: false,
    новизна: 0,
    вероятность_ошибки_разметки: 0,
    дефицит_класса: 0,
    полезность: 0,
    комментарий: (raw.комментарий as string) || '',
    нужен_эксперт: Boolean(raw.нужен_эксперт) || false,
    автор_разметки: (raw.автор_разметки as string) || (raw.разметчик as string) || '',
    разметчик: (raw.разметчик as string) || (raw.автор_разметки as string) || '',
    вероятность_ошибки_человека: 0,
    ...Object.fromEntries(probCols.map(col => [col, Number(raw[col]) || 0]))
  }))
  
  rows = calculateBaseMetrics(rows, classes)
  rows = markDuplicates(rows, classes)
  rows = calculateNovelty(rows, classes)
  
  return { rows, classes }
}

// Recalculate dynamic metrics
export function recalculateDynamicMetrics(rows: DataRow[], classes: string[]): DataRow[] {
  let result = calculateNovelty(rows, classes)
  result = calculateBayesianError(result)
  result = calculateClassDeficit(result, classes)
  result = calculateUtility(result)
  return result
}

// Assign status
export function assignStatus(row: DataRow): 'OK' | 'Ent_Chaos' | 'Potential_ERR' | 'Need_Info' {
  if (row.нужен_эксперт) return 'Need_Info'
  if (row.вероятность_ошибки_разметки > 0.5) return 'Potential_ERR'
  if (row.norm_entropy > 0.6) return 'Ent_Chaos'
  return 'OK'
}

// Generate deterministic roadmap
export function generateDeterministicRoadmap(rows: DataRow[], classes: string[]): string[] {
  const actions: string[] = []
  
  const dupes = rows.filter(r => r.дубликат).length
  if (dupes > 0) {
    actions.push(`Удалить ${dupes} дубликатов для снижения шума в обучающей выборке.`)
  }
  
  const errors = rows.filter(r => r.вероятность_ошибки_разметки > 0.5).length
  if (errors > 0) {
    actions.push(`Отправить на переразметку ${errors} объектов (вероятность ошибки > 50%).`)
  }
  
  const chaos = rows.filter(r => r.norm_entropy > 0.6).length
  if (chaos > 0) {
    actions.push(`Привлечь эксперта для ${chaos} сложных случаев (высокая энтропия предсказаний).`)
  }
  
  // Class deficit
  const classCounts: Record<string, number> = {}
  classes.forEach(cls => classCounts[cls] = 0)
  rows.forEach(row => {
    if (classCounts[row.истинный_класс] !== undefined) {
      classCounts[row.истинный_класс]++
    }
  })
  
  const idealCount = rows.length / classes.length
  
  classes.forEach(cls => {
    const count = classCounts[cls] || 0
    if (count < idealCount * 0.8) {
      const missing = Math.ceil(idealCount - count)
      actions.push(`Собрать минимум ${missing} новых примеров для недонасыщенного класса '${cls}'.`)
    }
  })
  
  if (actions.length === 0) {
    actions.push('Датасет сбалансирован и готов к обучению. Дополнительные действия не требуются.')
  }
  
  return actions
}
