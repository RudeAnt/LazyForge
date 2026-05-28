'use client'

import { useState, useMemo } from 'react'
import { useProjects } from '@/lib/project-store'
import { generateDeterministicRoadmap, getDatasetMetrics } from '@/lib/math-engine'
import { AlertTriangle, CheckCircle, Trash2, Zap, Send } from 'lucide-react'

export function LLMRoadmapTab() {
  const { projects, activeProject, currentRole } = useProjects()
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [generatedTask, setGeneratedTask] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const project = activeProject ? projects[activeProject] : null
  const data = project?.data || []
  const classes = project?.classes || []

  // Role-based access (match Python app: Разметчик and Эксперт предметной области blocked)
  if (currentRole === 'Разметчик' || currentRole === 'Эксперт предметной области') {
    return (
      <div className="p-6">
        <span className="text-[#f7768e]">Доступ закрыт. Дорожную карту формируют ML-инженеры и Аналитики.</span>
      </div>
    )
  }

  const metrics = useMemo(() => {
    if (!data.length) return { imbalanceIndex: 0, readinessLevel: 0 }
    return getDatasetMetrics(data, classes)
  }, [data, classes])

  const duplicatesCount = useMemo(() => 
    data.filter(r => r.дубликат).length
  , [data])

  const errorsCount = useMemo(() => 
    data.filter(r => r.вероятность_ошибки_разметки > 0.5).length
  , [data])

  const chaosCount = useMemo(() => 
    data.filter(r => r.norm_entropy > 0.6).length
  , [data])

  const roadmap = useMemo(() => {
    if (!data.length) return []
    return generateDeterministicRoadmap(data, classes)
  }, [data, classes])

  const handleGenerateTask = async () => {
    if (!roadmap.length) return
    
    setIsLoading(true)
    setError('')
    setGeneratedTask('')
    
    const actionsText = roadmap.map(a => `- ${a}`).join('\n')
    const prompt = `Ты MLOps-руководитель. Ниже приведен точный список задач, рассчитанный аналитической системой. 
Твоя задача — написать краткое, профессиональное Техническое Задание (ТЗ) для команды Data-инженеров и разметчиков на основе ТОЛЬКО этих пунктов. 
Не выдумывай новые цифры и метрики!
Список задач:
${actionsText}`

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
      })
      
      if (res.ok) {
        const json = await res.json()
        setGeneratedTask(json.response || 'Пустой ответ от модели')
      } else {
        setError(`Ошибка API: ${res.status}`)
      }
    } catch {
      setError('Нет подключения к Ollama. Проверь, запущен ли локальный сервер на http://localhost:11434')
    } finally {
      setIsLoading(false)
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
      <h4 className="text-lg text-[#9ece6a]">Математически выверенный план действий</h4>

      {/* Generated Roadmap Steps */}
      <div className="space-y-3">
        {roadmap.map((action, i) => {
          const isPositive = action.includes('готов') || action.includes('не требуются')
          return (
            <div 
              key={i} 
              className={`flex items-start gap-3 p-4 border ${
                isPositive 
                  ? 'border-[#9ece6a]/30 bg-[#9ece6a]/5' 
                  : 'border-[#7aa2f7]/30 bg-[#7aa2f7]/5'
              }`}
            >
              {isPositive ? (
                <CheckCircle className="w-5 h-5 text-[#9ece6a] mt-0.5 flex-shrink-0" />
              ) : (
                <Zap className="w-5 h-5 text-[#7aa2f7] mt-0.5 flex-shrink-0" />
              )}
              <div className="text-sm">
                <span className="text-[#7aa2f7] font-bold">Шаг {i + 1}:</span> {action}
              </div>
            </div>
          )
        })}
      </div>

      {/* Ollama Integration */}
      <div className="border-t border-border pt-6">
        <h4 className="text-sm text-[#bb9af7] mb-2">Генерация управленческого задания (Ollama)</h4>
        <p className="text-xs text-muted-foreground mb-4">
          LLM использует только детерминированные данные выше, чтобы исключить галлюцинации.
        </p>
        
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Название модели Ollama:</label>
            <input
              type="text"
              value={ollamaModel}
              onChange={e => setOllamaModel(e.target.value)}
              placeholder="llama3.2"
              className="w-full bg-input border border-border px-3 py-2 text-sm outline-none focus:border-[#7aa2f7]"
            />
          </div>
          <button
            onClick={handleGenerateTask}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 mt-5 text-sm border border-border hover:border-[#bb9af7] hover:text-[#bb9af7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {isLoading ? 'Генерация...' : 'Сгенерировать ТЗ для команды'}
          </button>
        </div>

        {error && (
          <div className="border border-[#f7768e] bg-[#f7768e]/10 p-4 text-sm text-[#f7768e]">
            {error}
          </div>
        )}

        {generatedTask && (
          <div className="border border-[#9ece6a] bg-[#9ece6a]/10 p-4 text-sm whitespace-pre-wrap">
            {generatedTask}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="border-t border-border pt-6">
        <h4 className="text-sm text-muted-foreground mb-4 uppercase tracking-wider">Метрики для roadmap</h4>
        
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-4 h-4 text-[#f7768e]" />
              <span className="text-muted-foreground">Дубликаты</span>
            </div>
            <div className="text-2xl font-bold text-[#f7768e]">{duplicatesCount}</div>
          </div>
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-[#e0af68]" />
              <span className="text-muted-foreground">Ошибки разметки</span>
            </div>
            <div className="text-2xl font-bold text-[#e0af68]">{errorsCount}</div>
          </div>
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#bb9af7]" />
              <span className="text-muted-foreground">Зона хаоса</span>
            </div>
            <div className="text-2xl font-bold text-[#bb9af7]">{chaosCount}</div>
          </div>
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-[#9ece6a]" />
              <span className="text-muted-foreground">Готовность</span>
            </div>
            <div className="text-2xl font-bold" style={{ 
              color: metrics.readinessLevel > 70 ? '#9ece6a' : metrics.readinessLevel > 40 ? '#e0af68' : '#f7768e' 
            }}>
              {metrics.readinessLevel}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
