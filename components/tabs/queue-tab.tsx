'use client'

import { useState, useMemo } from 'react'
import { useProjects } from '@/lib/project-store'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ROWS_PER_PAGE = 200

export function QueueTab() {
  const { projects, activeProject, currentRole } = useProjects()
  const [searchId, setSearchId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeQueueTab, setActiveQueueTab] = useState('top')
  
  const project = activeProject ? projects[activeProject] : null
  const data = project?.data || []
  const classes = project?.classes || []

  // Role-based access
  if (currentRole === 'Разметчик') {
    return (
      <div className="p-6">
        <span className="text-[#f7768e]">Доступ закрыт.</span>
      </div>
    )
  }

  const selectedRow = useMemo(() => {
    if (!searchId.trim()) return null
    return data.find(row => 
      row.name === searchId.trim() || 
      row.id.toString() === searchId.trim()
    )
  }, [data, searchId])

  // Different queue categories
  const queues = useMemo(() => {
    // Top useful (by utility score)
    const topUseful = [...data]
      .filter(row => !row.дубликат)
      .sort((a, b) => b.полезность - a.полезность)

    // Labeling conflict (high error probability)
    const conflictQueue = [...data]
      .filter(row => row.вероятность_ошибки_разметки > 0.5)
      .sort((a, b) => b.вероятность_ошибки_разметки - a.вероятность_ошибки_разметки)

    // Chaos zone (high entropy)
    const chaosQueue = [...data]
      .filter(row => row.norm_entropy > 0.6)
      .sort((a, b) => b.энтропия - a.энтропия)

    // Rare classes (high deficit)
    const rareQueue = [...data]
      .filter(row => row.дефицит_класса > 1.0)
      .sort((a, b) => b.дефицит_класса - a.дефицит_класса)

    // Duplicates (for deletion)
    const trashQueue = [...data].filter(row => row.дубликат)

    return { topUseful, conflictQueue, chaosQueue, rareQueue, trashQueue }
  }, [data])

  // Get current queue based on active tab
  const currentQueue = useMemo(() => {
    switch (activeQueueTab) {
      case 'conflict': return queues.conflictQueue
      case 'chaos': return queues.chaosQueue
      case 'rare': return queues.rareQueue
      case 'trash': return queues.trashQueue
      default: return queues.topUseful
    }
  }, [activeQueueTab, queues])

  // Pagination
  const totalPages = Math.ceil(currentQueue.length / ROWS_PER_PAGE)
  const paginatedQueue = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return currentQueue.slice(start, start + ROWS_PER_PAGE)
  }, [currentQueue, currentPage])

  // Reset page when switching tabs
  const handleTabChange = (value: string) => {
    setActiveQueueTab(value)
    setCurrentPage(1)
  }

  // Get probability distribution for selected row
  const probDistribution = useMemo(() => {
    if (!selectedRow) return []
    return classes.map(cls => ({
      name: cls,
      value: Number(selectedRow[`prob_${cls}`]) || 0
    }))
  }, [selectedRow, classes])

  // Get recommendation
  const getRecommendation = (row: typeof selectedRow) => {
    if (!row) return { rec: '', reason: '' }
    if (row.дубликат) return { rec: 'Удалить', reason: 'Обнаружен дубликат' }
    if (row.вероятность_ошибки_разметки > 0.5) return { rec: 'Переразметить', reason: 'Конфликт разметки и модели' }
    if (row.norm_entropy > 0.6) return { rec: 'Экспертиза', reason: 'Высокая неопределенность (Хаос предсказаний)' }
    return { rec: 'Оставить в базе', reason: 'Нормальные показатели' }
  }

  // Get columns for current queue type
  const getQueueColumns = () => {
    switch (activeQueueTab) {
      case 'conflict':
        return ['id', 'name', 'разметчик', 'истинный_класс', 'предсказанный_класс', 'вероятность_ошибки_разметки', 'уверенность']
      case 'chaos':
        return ['id', 'name', 'истинный_класс', 'предсказанный_класс', 'энтропия', 'уверенность', 'новизна']
      case 'rare':
        return ['id', 'name', 'истинный_класс', 'предсказанный_класс', 'дефицит_класса', 'полезность']
      case 'trash':
        return ['id', 'name', 'истинный_класс', 'предсказанный_класс', 'уверенность']
      default:
        return ['id', 'name', 'истинный_класс', 'предсказанный_класс', 'полезность', 'вероятность_ошибки_разметки', 'новизна', 'дефицит_класса']
    }
  }

  if (!data.length) {
    return (
      <div className="p-6">
        <span className="text-muted-foreground">Нет данных.</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Object Search */}
      <div>
        <h4 className="text-sm text-[#9ece6a] mb-3">Детальная карточка объекта</h4>
        <div className="flex items-center gap-2 border border-border bg-input px-3 py-2 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            placeholder="Введите id или name (например: 7429472 или extreme_00000.jpg):"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Object Card */}
      {searchId.trim() && selectedRow && (
        <div className="border border-border p-4 space-y-4">
          <h3 className="text-lg">
            Данные по объекту: <code className="text-[#7aa2f7]">{selectedRow.id}</code>{' '}
            <span className="text-muted-foreground text-sm">({selectedRow.name})</span>
          </h3>
          
          <div className="grid grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">ID:</span>
              <div className="text-[#7dcfff] font-mono">{selectedRow.id}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Разметчик:</span>
              <div className="text-[#e0af68]">{selectedRow.разметчик || selectedRow.автор_разметки || '-'}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Разметчик (Текущая метка):</span>
              <div className="text-[#bb9af7]">{selectedRow.истинный_класс}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Предсказание нейросети:</span>
              <div className="text-[#7aa2f7]">{selectedRow.предсказанный_класс}</div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-4 gap-4">
              <MetricBox label="Уверенность" value={selectedRow.уверенность} />
              <MetricBox label="Энтропия" value={selectedRow.энтропия} />
              <MetricBox label="Вер. ошибки" value={selectedRow.вероятность_ошибки_разметки} />
              <MetricBox label="Полезность (AL)" value={selectedRow.полезность} />
            </div>
          </div>

          {/* Probability Distribution */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm text-muted-foreground mb-3">Распределение вероятностей по классам:</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={probDistribution}>
                  <XAxis dataKey="name" stroke="#565f89" fontSize={10} tick={{ fill: '#a9b1d6' }} />
                  <YAxis stroke="#565f89" fontSize={10} domain={[0, 1]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2335', 
                      border: '1px solid #292e42',
                      borderRadius: 0,
                      color: '#a9b1d6'
                    }}
                    formatter={(value: number) => value.toFixed(4)}
                  />
                  <Bar dataKey="value" radius={0}>
                    {probDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="#bb9af7" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recommendation */}
          {(() => {
            const { rec, reason } = getRecommendation(selectedRow)
            return (
              <div className="bg-input border border-border p-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Причина попадания в очередь:</span> {reason}
                </div>
                <div className="text-sm mt-1">
                  <span className="text-muted-foreground">Рекомендация:</span>{' '}
                  <span className="text-[#7aa2f7]">{rec}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {searchId.trim() && !selectedRow && (
        <div className="border border-[#e0af68] bg-[#e0af68]/10 p-4">
          <span className="text-[#e0af68]">Объект не найден.</span>
        </div>
      )}

      {/* Queue Categories with Sub-tabs */}
      <div className="border-t border-border pt-6">
        <h4 className="text-sm text-[#9ece6a] mb-3">Очереди активного обучения (Категории)</h4>
        
        <Tabs value={activeQueueTab} onValueChange={handleTabChange}>
          <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 h-auto p-0">
            <TabsTrigger 
              value="top" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] rounded-none px-4 py-2 text-muted-foreground"
            >
              Топ полезных ({queues.topUseful.length})
            </TabsTrigger>
            <TabsTrigger 
              value="conflict"
              className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] rounded-none px-4 py-2 text-muted-foreground"
            >
              Конфликт разметки ({queues.conflictQueue.length})
            </TabsTrigger>
            <TabsTrigger 
              value="chaos"
              className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] rounded-none px-4 py-2 text-muted-foreground"
            >
              Зона хаоса ({queues.chaosQueue.length})
            </TabsTrigger>
            <TabsTrigger 
              value="rare"
              className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] rounded-none px-4 py-2 text-muted-foreground"
            >
              Редкие классы ({queues.rareQueue.length})
            </TabsTrigger>
            <TabsTrigger 
              value="trash"
              className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] rounded-none px-4 py-2 text-muted-foreground"
            >
              На удаление ({queues.trashQueue.length})
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {/* Queue description */}
            <p className="text-sm text-muted-foreground mb-4">
              {activeQueueTab === 'top' && 'Самые ценные объекты для следующей итерации (сортировка по Интегральной полезности)'}
              {activeQueueTab === 'conflict' && 'Объекты с высоким риском ошибки (Модель не согласна с разметчиком)'}
              {activeQueueTab === 'chaos' && 'Объекты, в которых модель максимально не уверена (Высокая энтропия предсказаний)'}
              {activeQueueTab === 'rare' && 'Представители дефицитных классов (Сильный дисбаланс, нужно больше данных)'}
              {activeQueueTab === 'trash' && 'Дубликаты и зашумленные данные (Кандидаты на исключение из датасета)'}
            </p>

            {/* Queue Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {getQueueColumns().map(col => (
                      <th key={col} className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedQueue.map((row) => (
                    <tr 
                      key={row.id} 
                      className="border-b border-border hover:bg-secondary cursor-pointer"
                      onClick={() => setSearchId(row.id.toString())}
                    >
                      {getQueueColumns().map(col => (
                        <td key={col} className={`py-2 px-2 ${col === 'id' ? 'text-[#7dcfff] font-mono' : ''}`}>
                          {col === 'разметчик' 
                            ? (row.разметчик || row.автор_разметки || '-')
                            : typeof row[col] === 'number' 
                              ? (row[col] as number).toFixed(4) 
                              : String(row[col] ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Страница {currentPage} из {totalPages} | Всего: {currentQueue.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border hover:border-[#7aa2f7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Назад
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border hover:border-[#7aa2f7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Вперед
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {currentQueue.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Нет объектов в этой категории
              </div>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold text-[#7aa2f7]">{value.toFixed(4)}</div>
    </div>
  )
}
