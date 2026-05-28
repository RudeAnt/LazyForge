'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProjects } from '@/lib/project-store'
import Fuse from 'fuse.js'
import { Search, Plus, FolderOpen } from 'lucide-react'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { projects, currentRole, setActiveProject, createProject } = useProjects()
  const [query, setQuery] = useState('')

  const projectList = useMemo(() => Object.values(projects), [projects])
  
  const fuse = useMemo(() => new Fuse(projectList, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true
  }), [projectList])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return fuse.search(query).map(result => ({
      name: result.item.name,
      score: Math.round((1 - (result.score || 0)) * 100)
    }))
  }, [query, fuse])

  const handleSelect = useCallback((name: string) => {
    setActiveProject(name)
    setQuery('')
    onClose()
  }, [setActiveProject, onClose])

  const handleCreate = useCallback(() => {
    if (query.trim() && currentRole === 'Администратор проекта') {
      createProject(query.trim())
      setQuery('')
      onClose()
    }
  }, [query, currentRole, createProject, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && query.trim()) {
      if (searchResults.length > 0) {
        handleSelect(searchResults[0].name)
      } else if (currentRole === 'Администратор проекта') {
        handleCreate()
      }
    }
  }, [query, searchResults, currentRole, handleSelect, handleCreate, onClose])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-card border border-border shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="> _"
            autoFocus
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          <span className="text-xs text-muted-foreground">Ctrl+Space</span>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.trim() && searchResults.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1 text-xs text-[#9ece6a] uppercase tracking-wider">
                -- СОВПАДЕНИЯ --
              </div>
              {searchResults.map(result => (
                <button
                  key={result.name}
                  onClick={() => handleSelect(result.name)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-secondary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-[#7aa2f7]" />
                    открыть: {result.name}
                  </span>
                  <span className="text-xs text-muted-foreground">[{result.score}%]</span>
                </button>
              ))}
            </div>
          )}

          {query.trim() && searchResults.length === 0 && (
            <div className="p-2">
              <div className="px-2 py-1 text-xs text-[#f7768e] uppercase tracking-wider">
                -- НЕТ СОВПАДЕНИЙ --
              </div>
            </div>
          )}

          {query.trim() && (
            <div className="p-2 border-t border-border">
              <div className="px-2 py-1 text-xs text-[#e0af68] uppercase tracking-wider">
                -- ДЕЙСТВИЯ --
              </div>
              {currentRole === 'Администратор проекта' ? (
                <button
                  onClick={handleCreate}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#9ece6a]" />
                  {"создать: '"}{query}{"'"}
                </button>
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Отказано: Создание проектов доступно Администратору.
                </div>
              )}
            </div>
          )}

          {!query.trim() && projectList.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1 text-xs text-muted-foreground uppercase tracking-wider">
                -- НЕДАВНИЕ --
              </div>
              {projectList.slice(0, 5).map(project => (
                <button
                  key={project.name}
                  onClick={() => handleSelect(project.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary transition-colors"
                >
                  <Minus className="w-3 h-3 text-muted-foreground" />
                  {project.name}
                </button>
              ))}
            </div>
          )}

          {!query.trim() && projectList.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Начните вводить название проекта
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
