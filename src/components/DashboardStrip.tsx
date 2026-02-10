'use client'

import { useState } from 'react'
import { Case } from '@/app/page'
import { isActiveStatus } from '@/lib/caseUtils'

interface DashboardStripProps {
  cases: Case[]
}

// Tooltip component with info icon
function KpiCard({
  label,
  value,
  tooltip,
  valueColor = 'text-gray-900',
}: {
  label: string
  value: number
  tooltip: string
  valueColor?: string
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 px-6 py-5 flex items-center justify-between relative shadow-lg hover:shadow-xl transition-all duration-200 hover:border-slate-300">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-600 font-bold">{label}</span>
        <div 
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <svg 
            className="w-5 h-5 text-slate-400 cursor-help hover:text-slate-600 transition-colors duration-200" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          {showTooltip && (
            <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-2 text-xs text-white bg-slate-900 rounded-xl shadow-2xl whitespace-nowrap font-medium">
              {tooltip}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
            </div>
          )}
        </div>
      </div>
      <span className={`text-4xl font-bold ${valueColor}`}>{value}</span>
    </div>
  )
}

export default function DashboardStrip({ cases }: DashboardStripProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Open = any non-closed/non-cancelled/non-delivered status
  const openCases = cases.filter((c) => isActiveStatus(c.status))

  const overdueCases = cases.filter((c) => {
    if (!isActiveStatus(c.status)) return false
    if (!c.promisedDateForDelivery) return false
    const promised = new Date(c.promisedDateForDelivery)
    return promised < today
  })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <KpiCard 
        label="Total Open" 
        value={openCases.length}
        tooltip="Status = Open or In Progress"
      />
      <KpiCard 
        label="Overdue" 
        value={overdueCases.length}
        tooltip="Promised Date < Today AND Status = Open/In Progress"
        valueColor={overdueCases.length > 0 ? 'text-red-600' : 'text-gray-900'}
      />
    </div>
  )
}
