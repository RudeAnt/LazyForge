'use client'

import { useState, useMemo, useRef } from 'react'
import { useProjects } from '@/lib/project-store'
import { assignStatus, getDatasetMetrics } from '@/lib/math-engine'
import { Upload, GitCommit, RotateCcw, Download, ChevronLeft, ChevronRight } from 'lucide-react'

const ROWS_PER_PAGE = 200

export function DataVersionsTab() {
  const { projects, activeProject, currentRole, createVersion, rollbackToVersion, mergeNewData, uploadDataset } = useProjects()
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const project = activeProject ? projects[activeProject] : null
  const data = project?.data || []
  const classes = project?.classes || []
  const versions = project?.versions || []

  // Role-based access
  if (currentRole === 'Разметчик' || currentRole === 'Эксперт предметной области') {
    return (
      <div className="p-6">
        <span className="text-[#f7768e]">Доступ закрыт. Управление версиями доступно Администраторам, ML-инженерам и Аналитикам.</span>
      </div>
    )
  }

  const metrics = useMemo(() => {
    if (!data.length) return { imbalanceIndex: 0, readinessLevel: 0 }
    return getDatasetMetrics(data, classes)
  }, [data, classes])

  const displayData = useMemo(() => 
    data.map(row => ({
      ...row,
      Статус: assignStatus(row)
    }))
  , [data])

  // Pagination
  const totalPages = Math.ceil(displayData.length / ROWS_PER_PAGE)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return displayData.slice(start, start + ROWS_PER_PAGE)
  }, [displayData, currentPage])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeProject) return

    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) return

    const headers = lines[0].split(',').map(h => h.trim())
    const rawData = lines.slice(1).map(line => {
      const values = line.split(',')
      const obj: Record<string, unknown> = {}
      headers.forEach((header, i) => {
        const val = values[i]?.trim()
        // Try to parse as number
        const num = parseFloat(val)
        obj[header] = isNaN(num) ? val : num
      })
      return obj
    })

    if (data.length === 0) {
      uploadDataset(activeProject, rawData)
    } else {
      mergeNewData(activeProject, rawData)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setCurrentPage(1)
  }

  const handleCreateCommit = () => {
    if (!activeProject) return
    const versionName = `commit_${new Date().toTimeString().slice(0, 8)}`
    createVersion(activeProject, versionName)
  }

  const handleRollback = () => {
    if (!activeProject || !selectedVersion) return
    rollbackToVersion(activeProject, selectedVersion)
    setCurrentPage(1)
  }

  const handleExport = () => {
    if (!data.length || !activeProject) return
    
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeProject}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!data.length) {
    return (
      <div className="p-6">
        <span className="text-muted-foreground">Нет данных.</span>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    'OK': '#9ece6a',
    'Ent_Chaos': '#e0af68',
    'Potential_ERR': '#f7768e',
    'Need_Info': '#7aa2f7'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm text-[#7dcfff]">Система управления версиями данных (DVC)</h4>
          <span className="text-xs text-muted-foreground">Всего объектов: {displayData.length}</span>
        </div>
        
        {currentRole === 'Администратор проекта' && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border hover:border-[#7aa2f7] cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4" />
              Загрузить CSV
            </label>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border hover:border-[#9ece6a] transition-colors"
            >
              <Download className="w-4 h-4" />
              Экспорт
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">id</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">name</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">Статус</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">истинный_класс</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">предсказанный_класс</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">уверенность</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">вер_ошибки</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">новизна</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">дефицит</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">полезность</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">энтропия</th>
              <th className="text-center py-2 px-2 text-xs text-muted-foreground font-normal">дубликат</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">комментарий</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(row => (
              <tr key={row.id} className="border-b border-border hover:bg-secondary">
                <td className="py-2 px-2 text-[#7dcfff] font-mono">{row.id}</td>
                <td className="py-2 px-2 text-muted-foreground">{row.name}</td>
                <td className="py-2 px-2">
                  <span 
                    className="px-2 py-0.5 text-xs border"
                    style={{ 
                      color: statusColors[row.Статус], 
                      borderColor: statusColors[row.Статус] 
                    }}
                  >
                    {row.Статус}
                  </span>
                </td>
                <td className="py-2 px-2">{row.истинный_класс}</td>
                <td className="py-2 px-2">{row.предсказанный_класс}</td>
                <td className="py-2 px-2 text-right">{row.уверенность}</td>
                <td className="py-2 px-2 text-right">{row.вероятность_ошибки_разметки}</td>
                <td className="py-2 px-2 text-right">{row.новизна}</td>
                <td className="py-2 px-2 text-right">{row.дефицит_класса.toFixed(2)}</td>
                <td className="py-2 px-2 text-right">{row.полезность}</td>
                <td className="py-2 px-2 text-right">{row.энтропия}</td>
                <td className="py-2 px-2 text-center">{row.дубликат ? 'да' : 'нет'}</td>
                <td className="py-2 px-2 text-muted-foreground truncate max-w-32">{row.комментарий || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages}
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

      {/* Version Control */}
      <div className="border-t border-border pt-6">
        <h4 className="text-sm text-muted-foreground mb-4">История коммитов (Откат версий)</h4>
        
        {versions.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <select
                value={selectedVersion}
                onChange={e => setSelectedVersion(e.target.value)}
                className="flex-1 bg-input border border-border px-3 py-2 text-sm outline-none focus:border-[#7aa2f7]"
              >
                <option value="">Выберите версию для возврата:</option>
                {versions.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name} (готовность: {v.readiness}%)
                  </option>
                ))}
              </select>
              <button
                onClick={handleRollback}
                disabled={!selectedVersion}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-border hover:border-[#e0af68] hover:text-[#e0af68] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Откатить
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground bg-input border border-border p-4">
            Нет сохраненных версий.
          </div>
        )}

        <button
          onClick={handleCreateCommit}
          className="mt-4 flex items-center gap-2 px-4 py-2 text-sm border border-border hover:border-[#9ece6a] hover:text-[#9ece6a] transition-colors"
        >
          <GitCommit className="w-4 h-4" />
          Создать коммит (Сохранить текущую версию)
        </button>
      </div>
    </div>
  )
}
