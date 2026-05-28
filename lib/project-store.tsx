'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { DataRow, ProjectData } from '@/lib/math-engine'
import { 
  initialProcessDataset, 
  recalculateDynamicMetrics, 
  getDatasetMetrics 
} from '@/lib/math-engine'

export type Role = 
  | 'Администратор проекта' 
  | 'ML-инженер' 
  | 'Разметчик' 
  | 'Эксперт предметной области' 
  | 'Аналитик данных'

export const ROLE_CHOICES: Role[] = [
  'Администратор проекта',
  'ML-инженер',
  'Разметчик',
  'Эксперт предметной области',
  'Аналитик данных'
]

interface Project {
  name: string
  created_at: string
  data: DataRow[] | null
  classes: string[]
  versions: { name: string; data: DataRow[]; readiness: number }[]
}

interface ProjectStore {
  projects: Record<string, Project>
  activeProject: string | null
  currentRole: Role
  
  // Actions
  setActiveProject: (name: string | null) => void
  setCurrentRole: (role: Role) => void
  createProject: (name: string) => void
  deleteProject: (name: string) => void
  uploadDataset: (projectName: string, rawData: Record<string, unknown>[]) => void
  updateRow: (projectName: string, rowIndex: number, updates: Partial<DataRow>) => void
  createVersion: (projectName: string, versionName: string) => void
  rollbackToVersion: (projectName: string, versionName: string) => void
  mergeNewData: (projectName: string, rawData: Record<string, unknown>[]) => void
}

const ProjectContext = createContext<ProjectStore | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Record<string, Project>>({})
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<Role>('Администратор проекта')

  const createProject = useCallback((name: string) => {
    const now = new Date()
    const created_at = now.toISOString().slice(0, 16).replace('T', ' ')
    
    setProjects(prev => ({
      ...prev,
      [name]: {
        name,
        created_at,
        data: null,
        classes: [],
        versions: []
      }
    }))
    setActiveProject(name)
  }, [])

  const deleteProject = useCallback((name: string) => {
    setProjects(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
    if (activeProject === name) {
      setActiveProject(null)
    }
  }, [activeProject])

  const uploadDataset = useCallback((projectName: string, rawData: Record<string, unknown>[]) => {
    const { rows, classes } = initialProcessDataset(rawData)
    const processedRows = recalculateDynamicMetrics(rows, classes)
    const { readinessLevel } = getDatasetMetrics(processedRows, classes)
    
    setProjects(prev => ({
      ...prev,
      [projectName]: {
        ...prev[projectName],
        data: processedRows,
        classes,
        versions: [
          ...prev[projectName].versions,
          { name: 'v1_init', data: [...processedRows], readiness: readinessLevel }
        ]
      }
    }))
  }, [])

  const updateRow = useCallback((projectName: string, rowIndex: number, updates: Partial<DataRow>) => {
    setProjects(prev => {
      const project = prev[projectName]
      if (!project?.data) return prev
      
      const newData = [...project.data]
      newData[rowIndex] = { ...newData[rowIndex], ...updates }
      
      // Recalculate dynamic metrics
      const recalculated = recalculateDynamicMetrics(newData, project.classes)
      
      return {
        ...prev,
        [projectName]: {
          ...project,
          data: recalculated
        }
      }
    })
  }, [])

  const createVersion = useCallback((projectName: string, versionName: string) => {
    setProjects(prev => {
      const project = prev[projectName]
      if (!project?.data) return prev
      
      const { readinessLevel } = getDatasetMetrics(project.data, project.classes)
      
      return {
        ...prev,
        [projectName]: {
          ...project,
          versions: [
            ...project.versions,
            { name: versionName, data: [...project.data], readiness: readinessLevel }
          ]
        }
      }
    })
  }, [])

  const rollbackToVersion = useCallback((projectName: string, versionName: string) => {
    setProjects(prev => {
      const project = prev[projectName]
      if (!project?.data) return prev
      
      const version = project.versions.find(v => v.name === versionName)
      if (!version) return prev
      
      // Create backup before rollback
      const { readinessLevel } = getDatasetMetrics(project.data, project.classes)
      const backupName = `backup_${new Date().toTimeString().slice(0, 8)}`
      
      return {
        ...prev,
        [projectName]: {
          ...project,
          data: [...version.data],
          versions: [
            ...project.versions,
            { name: backupName, data: [...project.data], readiness: readinessLevel }
          ]
        }
      }
    })
  }, [])

  const mergeNewData = useCallback((projectName: string, rawData: Record<string, unknown>[]) => {
    setProjects(prev => {
      const project = prev[projectName]
      if (!project) return prev
      
      // Save current version before merge
      if (project.data) {
        const { readinessLevel } = getDatasetMetrics(project.data, project.classes)
        const backupName = `v_before_merge_${new Date().toTimeString().slice(0, 8)}`
        project.versions.push({ name: backupName, data: [...project.data], readiness: readinessLevel })
      }
      
      const { rows, classes } = initialProcessDataset(rawData)
      const processedRows = recalculateDynamicMetrics(rows, classes)
      
      return {
        ...prev,
        [projectName]: {
          ...project,
          data: processedRows,
          classes
        }
      }
    })
  }, [])

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      currentRole,
      setActiveProject,
      setCurrentRole,
      createProject,
      deleteProject,
      uploadDataset,
      updateRow,
      createVersion,
      rollbackToVersion,
      mergeNewData
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjects() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProjects must be used within ProjectProvider')
  }
  return context
}
