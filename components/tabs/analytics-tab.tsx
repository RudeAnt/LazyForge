'use client'

import { useProjects } from '@/lib/project-store'
import { getDatasetMetrics, assignStatus, DataRow } from '@/lib/math-engine'
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export function AnalyticsTab() {
  const { projects, activeProject, currentRole } = useProjects()
  
  const project = activeProject ? projects[activeProject] : null
  const data = project?.data || []
  const classes = project?.classes || []

  const metrics = useMemo(() => {
    if (!data.length) return { imbalanceIndex: 0, readinessLevel: 0 }
    return getDatasetMetrics(data, classes)
  }, [data, classes])

  const suspiciousCount = useMemo(() => 
    data.filter(row => row.вероятность_ошибки_разметки > 0.5).length
  , [data])

  const classDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    classes.forEach(cls => counts[cls] = 0)
    data.forEach(row => {
      if (counts[row.истинный_класс] !== undefined) {
        counts[row.истинный_класс]++
      }
    })
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
  }, [data, classes])

  // Errors by author (new feature from updated app)
  const errorsByAuthor = useMemo(() => {
    const errorRows = data.filter(row => row.вероятность_ошибки_разметки > 0.5)
    const counts: Record<string, number> = {}
    
    errorRows.forEach(row => {
      const author = row.разметчик || row.автор_разметки || 'Unknown'
      counts[author] = (counts[author] || 0) + 1
    })
    
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [data])

  // Role-based access
  if (currentRole === 'Разметчик' || currentRole === 'Эксперт предметной области') {
    return (
      <div className="p-6">
        <span className="text-[#f7768e]">Доступ закрыт.</span>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="p-6">
        <span className="text-muted-foreground">Нет данных для анализа.</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard 
          label="Всего объектов" 
          value={data.length.toString()} 
        />
        <MetricCard 
          label="Уровень готовности" 
          value={`${metrics.readinessLevel}%`}
          color={metrics.readinessLevel > 70 ? '#9ece6a' : metrics.readinessLevel > 40 ? '#e0af68' : '#f7768e'}
        />
        <MetricCard 
          label="Индекс дисбаланса" 
          value={metrics.imbalanceIndex.toString()}
          color={metrics.imbalanceIndex < 0.3 ? '#9ece6a' : '#e0af68'}
        />
        <MetricCard 
          label="Потенциальных ошибок" 
          value={suspiciousCount.toString()}
          color={suspiciousCount === 0 ? '#9ece6a' : '#f7768e'}
        />
      </div>

      {/* Charts Row - Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Class Distribution Chart */}
        <div className="border border-border p-4">
          <h4 className="text-sm text-muted-foreground mb-4">Распределение объектов по классам</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDistribution}>
                <XAxis 
                  dataKey="name" 
                  stroke="#565f89" 
                  fontSize={10}
                  tick={{ fill: '#a9b1d6' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#565f89" fontSize={10} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2335', 
                    border: '1px solid #292e42',
                    borderRadius: 0,
                    color: '#a9b1d6'
                  }}
                />
                <Bar dataKey="count" radius={0}>
                  {classDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill="#7aa2f7" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Errors by Author Chart (NEW) */}
        <div className="border border-border p-4">
          <h4 className="text-sm text-muted-foreground mb-4">Количество ошибок по разметчикам</h4>
          <div className="h-64">
            {errorsByAuthor.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={errorsByAuthor}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#565f89" 
                    fontSize={10}
                    tick={{ fill: '#a9b1d6' }}
                  />
                  <YAxis stroke="#565f89" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2335', 
                      border: '1px solid #292e42',
                      borderRadius: 0,
                      color: '#a9b1d6'
                    }}
                  />
                  <Bar dataKey="count" radius={0}>
                    {errorsByAuthor.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="#f7768e" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <span className="text-[#9ece6a]">Ошибок разметки не обнаружено</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="border border-border p-4">
        <h4 className="text-sm text-muted-foreground mb-4 uppercase tracking-wider">Статусы объектов</h4>
        <div className="grid grid-cols-4 gap-4">
          {(['OK', 'Ent_Chaos', 'Potential_ERR', 'Need_Info'] as const).map(status => {
            const count = data.filter(row => assignStatus(row) === status).length
            const colors = {
              'OK': '#9ece6a',
              'Ent_Chaos': '#e0af68',
              'Potential_ERR': '#f7768e',
              'Need_Info': '#7aa2f7'
            }
            return (
              <div key={status} className="text-center">
                <div className="text-2xl font-bold" style={{ color: colors[status] }}>
                  {count}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{status}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color = '#a9b1d6' }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
