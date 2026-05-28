'use client'

import { useMemo, useState } from 'react'
import { useProjects } from '@/lib/project-store'
import Fuse from 'fuse.js'
import { Search, FolderOpen, Plus, Clock } from 'lucide-react'

export function HomeView() {
  const { projects, currentRole, setActiveProject, createProject } = useProjects()
  const [searchQuery, setSearchQuery] = useState('')

  const projectList = useMemo(() => Object.values(projects), [projects])
  
  const fuse = useMemo(() => new Fuse(projectList, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true
  }), [projectList])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return projectList
    return fuse.search(searchQuery).map(result => result.item)
  }, [searchQuery, fuse, projectList])

  const fuzzyMatches = useMemo(() => {
    if (!searchQuery.trim()) return []
    return fuse.search(searchQuery).map(result => ({
      name: result.item.name,
      score: Math.round((1 - (result.score || 0)) * 100)
    }))
  }, [searchQuery, fuse])

  const handleCreate = () => {
    if (searchQuery.trim() && currentRole === 'Администратор проекта') {
      createProject(searchQuery.trim())
      setSearchQuery('')
    }
  }

  return (
    <div className="flex-1 p-8">
      {/* Header */}
      <h3 className="text-xl text-[#bb9af7] font-light mb-6">Поиск / Создание проекта</h3>

      {/* Search Bar */}
      <div className="flex items-center gap-2 border border-border bg-input px-4 py-3 max-w-2xl mb-6 focus-within:border-[#7aa2f7] transition-colors">
        <Search className="w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="> _"
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          onKeyDown={e => {
            if (e.key === 'Enter' && searchQuery.trim()) {
              if (fuzzyMatches.length > 0) {
                setActiveProject(fuzzyMatches[0].name)
              } else if (currentRole === 'Администратор проекта') {
                handleCreate()
              }
            }
          }}
        />
        <span className="text-xs text-muted-foreground">Ctrl+Space для фокуса | Enter для поиска...</span>
      </div>

      {/* Search Results or Actions */}
      {searchQuery.trim() && (
        <div className="mb-8 max-w-2xl">
          {fuzzyMatches.length > 0 ? (
            <div className="mb-4">
              <div className="text-xs text-[#9ece6a] mb-2 uppercase tracking-wider">-- СОВПАДЕНИЯ --</div>
              <div className="space-y-1">
                {fuzzyMatches.map(match => (
                  <button
                    key={match.name}
                    onClick={() => setActiveProject(match.name)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left border border-border hover:border-[#7aa2f7] hover:bg-secondary transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-[#7aa2f7]" />
                      открыть: {match.name}
                    </span>
                    <span className="text-xs text-muted-foreground">[{match.score}%]</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <div className="text-xs text-[#f7768e] mb-2 uppercase tracking-wider">-- НЕТ СОВПАДЕНИЙ --</div>
            </div>
          )}

          <div>
            <div className="text-xs text-[#e0af68] mb-2 uppercase tracking-wider">-- ДЕЙСТВИЯ --</div>
            {currentRole === 'Администратор проекта' ? (
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-border hover:border-[#9ece6a] hover:bg-secondary transition-colors"
              >
                <Plus className="w-4 h-4 text-[#9ece6a]" />
                {"создать: '"}{searchQuery}{"'"}
              </button>
            ) : (
              <div className="text-xs text-muted-foreground px-3 py-2">
                Отказано: Создание проектов доступно Администратору.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Projects Grid */}
      {!searchQuery.trim() && (
        <>
          <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">-- НЕДАВНИЕ --</div>
          
          {projectList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projectList.map(project => (
                <button
                  key={project.name}
                  onClick={() => setActiveProject(project.name)}
                  className="text-left p-4 border border-border hover:border-[#7aa2f7] bg-card transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <FolderOpen className="w-6 h-6 text-[#7aa2f7] group-hover:text-[#bb9af7] transition-colors" />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {project.created_at}
                    </div>
                  </div>
                  <div className="text-sm font-medium truncate">{project.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {project.data ? `${project.data.length} объектов` : 'Нет данных'}
                  </div>
                  {project.data && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-1.5 py-0.5 bg-secondary text-[#9ece6a]">
                        {project.classes.length} классов
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-secondary text-[#7aa2f7]">
                        {project.versions.length} версий
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <div className="text-sm">Нет проектов</div>
              <div className="text-xs mt-1">Создайте новый проект через поиск или Ctrl+Space</div>
            </div>
          )}
        </>
      )}

      {/* Floating Action Button */}
      {currentRole === 'Администратор проекта' && (
        <button
          onClick={() => {
            const name = `проект_${Date.now().toString(36)}`
            createProject(name)
          }}
          className="fixed bottom-8 right-8 w-14 h-14 flex items-center justify-center bg-[#7aa2f7] text-[#1a1b26] hover:bg-[#bb9af7] transition-colors shadow-lg"
          title="Новый проект"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
