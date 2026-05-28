'use client'

import { useRef, useState } from 'react'
import { useProjects } from '@/lib/project-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnalyticsTab } from './tabs/analytics-tab'
import { QueueTab } from './tabs/queue-tab'
import { AnnotationTab } from './tabs/annotation-tab'
import { DataVersionsTab } from './tabs/data-versions-tab'
import { LLMRoadmapTab } from './tabs/llm-roadmap-tab'
import { X, Upload, Download } from 'lucide-react'

export function ProjectView() {
  const { projects, activeProject, currentRole, setActiveProject, uploadDataset } = useProjects()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const project = activeProject ? projects[activeProject] : null

  if (!project) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeProject) return

    setUploading(true)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length < 2) return

      const headers = lines[0].split(',').map(h => h.trim())
      const rawData = lines.slice(1).map(line => {
        const values = line.split(',')
        const obj: Record<string, unknown> = {}
        headers.forEach((header, i) => {
          const val = values[i]?.trim()
          const num = parseFloat(val)
          obj[header] = isNaN(num) ? val : num
        })
        return obj
      })

      uploadDataset(activeProject, rawData)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleExport = () => {
    if (!project.data?.length || !activeProject) return
    
    const data = project.data
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-lg text-[#7dcfff]">Проект: {activeProject}</h3>
          <span className="text-xs text-muted-foreground">допуск: {currentRole}</span>
        </div>
        <div className="flex items-center gap-2">
          {project.data && currentRole === 'Администратор проекта' && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border hover:border-[#9ece6a] transition-colors"
            >
              <Download className="w-4 h-4" />
              экспорт_csv
            </button>
          )}
          <button
            onClick={() => setActiveProject(null)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border hover:border-[#f7768e] hover:text-[#f7768e] transition-colors"
          >
            <X className="w-4 h-4" />
            закрыть
          </button>
        </div>
      </div>

      {/* Content */}
      {project.data === null ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <h4 className="text-lg text-[#bb9af7] mb-4">Инициализация датасета</h4>
            <p className="text-sm text-muted-foreground mb-6">
              Загрузите CSV файл с данными для начала работы. Файл должен содержать столбцы с вероятностями классов (prob_*) и истинными метками.
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="init-csv-upload"
            />
            <label
              htmlFor="init-csv-upload"
              className={`inline-flex items-center gap-2 px-6 py-3 text-sm border border-[#7aa2f7] text-[#7aa2f7] hover:bg-[#7aa2f7] hover:text-[#1a1b26] cursor-pointer transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Сборка тензоров...' : 'Загрузить первичный CSV'}
            </label>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="analytics" className="h-full flex flex-col">
            <TabsList className="w-full justify-start px-6 pt-4 gap-2 bg-transparent border-b border-border">
              <TabsTrigger 
                value="analytics" 
                className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] bg-card text-muted-foreground px-4 py-2"
              >
                Аналитика
              </TabsTrigger>
              <TabsTrigger 
                value="queue"
                className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] bg-card text-muted-foreground px-4 py-2"
              >
                Очередь (Карточка объекта)
              </TabsTrigger>
              <TabsTrigger 
                value="annotation"
                className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] bg-card text-muted-foreground px-4 py-2"
              >
                Разметка
              </TabsTrigger>
              <TabsTrigger 
                value="versions"
                className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] bg-card text-muted-foreground px-4 py-2"
              >
                База и Версии
              </TabsTrigger>
              <TabsTrigger 
                value="llm"
                className="data-[state=active]:bg-secondary data-[state=active]:text-[#7aa2f7] data-[state=active]:border-b-2 data-[state=active]:border-[#7aa2f7] bg-card text-muted-foreground px-4 py-2"
              >
                LLM Roadmap
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto">
              <TabsContent value="analytics" className="h-full m-0">
                <AnalyticsTab />
              </TabsContent>
              <TabsContent value="queue" className="h-full m-0">
                <QueueTab />
              </TabsContent>
              <TabsContent value="annotation" className="h-full m-0">
                <AnnotationTab />
              </TabsContent>
              <TabsContent value="versions" className="h-full m-0">
                <DataVersionsTab />
              </TabsContent>
              <TabsContent value="llm" className="h-full m-0">
                <LLMRoadmapTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  )
}
