'use client'

import { useState, useMemo } from 'react'
import { useProjects } from '@/lib/project-store'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'

const ROWS_PER_PAGE = 200

export function AnnotationTab() {
  const { projects, activeProject, currentRole, updateRow } = useProjects()
  const [currentPage, setCurrentPage] = useState(1)
  
  const project = activeProject ? projects[activeProject] : null
  const data = project?.data || []
  const classes = project?.classes || []

  // Role-based access
  if (currentRole === 'Аналитик данных' || currentRole === 'ML-инженер') {
    return (
      <div className="p-6">
        <span className="text-[#f7768e]">Доступ закрыт. Разметку ведут Разметчики и Эксперты.</span>
      </div>
    )
  }

  // Filter for problematic cases
  const editSubset = useMemo(() => 
    data
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => row.вероятность_ошибки_разметки > 0.5 || row.нужен_эксперт)
  , [data])

  // Pagination
  const totalPages = Math.ceil(editSubset.length / ROWS_PER_PAGE)
  const paginatedSubset = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return editSubset.slice(start, start + ROWS_PER_PAGE)
  }, [editSubset, currentPage])

  if (!data.length) {
    return (
      <div className="p-6">
        <span className="text-muted-foreground">Нет данных.</span>
      </div>
    )
  }

  if (editSubset.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-[#9ece6a]/10 border border-[#9ece6a] p-4">
          <span className="text-[#9ece6a]">Ошибок нет. Датасет чист.</span>
        </div>
      </div>
    )
  }

  const handleClassChange = (originalIndex: number, newClass: string) => {
    if (activeProject) {
      updateRow(activeProject, originalIndex, { истинный_класс: newClass })
    }
  }

  const handleCommentChange = (originalIndex: number, comment: string) => {
    if (activeProject) {
      updateRow(activeProject, originalIndex, { комментарий: comment })
    }
  }

  const handleExpertToggle = (originalIndex: number, value: boolean) => {
    if (activeProject) {
      updateRow(activeProject, originalIndex, { нужен_эксперт: value })
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm text-[#e0af68]">Интерактивный редактор сложных случаев</h4>
        <span className="text-sm text-muted-foreground">Всего: {editSubset.length}</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">id</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">name</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">истинный_класс</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">предсказанный_класс</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">уверенность</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">вер_ошибки</th>
              <th className="text-right py-2 px-2 text-xs text-muted-foreground font-normal">новизна</th>
              <th className="text-left py-2 px-2 text-xs text-muted-foreground font-normal">комментарий</th>
              <th className="text-center py-2 px-2 text-xs text-muted-foreground font-normal">В эскалацию</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSubset.map(({ row, originalIndex }) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2 px-2 text-[#7dcfff] font-mono">{row.id}</td>
                <td className="py-2 px-2 text-muted-foreground">{row.name}</td>
                <td className="py-2 px-2">
                  <select
                    value={row.истинный_класс}
                    onChange={e => handleClassChange(originalIndex, e.target.value)}
                    className="bg-input border border-border px-2 py-1 text-sm outline-none focus:border-[#7aa2f7]"
                  >
                    {classes.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-2 text-muted-foreground">{row.предсказанный_класс}</td>
                <td className="py-2 px-2 text-right text-muted-foreground">{row.уверенность.toFixed(4)}</td>
                <td className="py-2 px-2 text-right text-[#f7768e]">{row.вероятность_ошибки_разметки.toFixed(4)}</td>
                <td className="py-2 px-2 text-right text-muted-foreground">{row.новизна.toFixed(4)}</td>
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={row.комментарий}
                    onChange={e => handleCommentChange(originalIndex, e.target.value)}
                    className="w-full bg-input border border-border px-2 py-1 text-sm outline-none focus:border-[#7aa2f7]"
                    placeholder="..."
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <button
                    onClick={() => handleExpertToggle(originalIndex, !row.нужен_эксперт)}
                    className={`w-6 h-6 border flex items-center justify-center transition-colors ${
                      row.нужен_эксперт 
                        ? 'bg-[#7aa2f7] border-[#7aa2f7] text-[#1a1b26]' 
                        : 'border-border hover:border-[#7aa2f7]'
                    }`}
                  >
                    {row.нужен_эксперт && <Check className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
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

      <div className="mt-4 text-xs text-muted-foreground">
        Показано {paginatedSubset.length} из {editSubset.length} объектов с высокой вероятностью ошибки или требующих экспертизы.
      </div>
    </div>
  )
}
