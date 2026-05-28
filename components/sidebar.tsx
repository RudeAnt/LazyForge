'use client'

import { useMemo, useState } from 'react'
import { useProjects, ROLE_CHOICES, type Role } from '@/lib/project-store'
import { FolderPlus, ChevronRight, Minus, Settings } from 'lucide-react'

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  if (diffDays <= 7) return 'На прошлой неделе'
  return 'Ранее'
}

interface GroupedProjects {
  [key: string]: { name: string; created_at: string }[]
}

export function Sidebar() {
  const { projects, activeProject, currentRole, setActiveProject, setCurrentRole, createProject } = useProjects()
  const [showRoles, setShowRoles] = useState(false)

  const groupedProjects = useMemo<GroupedProjects>(() => {
    const groups: GroupedProjects = {
      'Сегодня': [],
      'Вчера': [],
      'На прошлой неделе': [],
      'Ранее': []
    }
    
    Object.values(projects)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach(project => {
        const group = formatRelativeDate(project.created_at)
        if (groups[group]) {
          groups[group].push({ name: project.name, created_at: project.created_at })
        }
      })
    
    return groups
  }, [projects])

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <span className="text-[#9ece6a] text-sm">LazyForge-AI v1.2</span>
      </div>
      
      {/* Role Selector */}
      <div className="p-4 border-b border-border">
        <button
          onClick={() => setShowRoles(!showRoles)}
          className="w-full flex items-center justify-between text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>РОЛЬ:</span>
          <Settings className="w-4 h-4" />
        </button>
        {showRoles && (
          <div className="mt-2 space-y-1">
            {ROLE_CHOICES.map(role => (
              <button
                key={role}
                onClick={() => {
                  setCurrentRole(role)
                  setShowRoles(false)
                }}
                className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                  currentRole === role 
                    ? 'text-[#7aa2f7] bg-secondary' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {currentRole === role ? '> ' : '  '}{role}
              </button>
            ))}
          </div>
        )}
        {!showRoles && (
          <div className="mt-1 text-xs text-[#7aa2f7] truncate">{currentRole}</div>
        )}
      </div>
      
      {/* Projects Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#7dcfff] text-xs uppercase tracking-wider">Проекты</span>
          </div>
          
          {/* New Project Button */}
          <button
            onClick={() => setActiveProject(null)}
            className="w-full flex items-center gap-2 px-3 py-2 mb-4 text-sm text-[#7aa2f7] border border-border hover:border-[#7aa2f7] hover:bg-[#7aa2f7] hover:text-[#1a1b26] transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            <span>новый_проект</span>
          </button>
          
          {/* Project Groups */}
          {Object.entries(groupedProjects).map(([group, items]) => {
            if (items.length === 0) return null
            
            return (
              <div key={group} className="mb-4">
                <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{group}</div>
                <div className="space-y-1">
                  {items.map(project => {
                    const isActive = activeProject === project.name
                    return (
                      <button
                        key={project.name}
                        onClick={() => setActiveProject(project.name)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left transition-colors ${
                          isActive 
                            ? 'text-[#7aa2f7] bg-secondary' 
                            : 'text-foreground hover:bg-secondary'
                        }`}
                      >
                        {isActive ? (
                          <ChevronRight className="w-3 h-3 text-[#7aa2f7]" />
                        ) : (
                          <Minus className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="truncate">{project.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          
          {Object.keys(projects).length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              Нет проектов
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
