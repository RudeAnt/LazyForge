'use client'

import { useState, useEffect } from 'react'
import { ProjectProvider, useProjects } from '@/lib/project-store'
import { Sidebar } from '@/components/sidebar'
import { CommandPalette } from '@/components/command-palette'
import { ProjectView } from '@/components/project-view'
import { HomeView } from '@/components/home-view'

function DataForgeApp() {
  const { activeProject } = useProjects()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Global Ctrl+Space hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeProject ? <ProjectView /> : <HomeView />}
      </main>

      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
    </div>
  )
}

export default function Page() {
  return (
    <ProjectProvider>
      <DataForgeApp />
    </ProjectProvider>
  )
}
