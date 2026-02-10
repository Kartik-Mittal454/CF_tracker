'use client'

import { useState, useMemo } from 'react'
import { Case } from '@/app/page'
import { parseDateInput } from '@/lib/caseUtils'
import { parseAmount, fuzzyMatch } from '@/lib/formatters'
import * as XLSX from 'xlsx'

interface TeamManagerProps {
  cases: Case[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

type ViewMode = 'analytics' | 'details'
type TimePeriod = 'monthly' | 'quarterly' | 'yearly'

interface MonthlySummary {
  month: number
  year: number
  teamAmounts: Record<string, number>
  total: number
}

export default function TeamManager({ cases }: TeamManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('analytics')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('monthly')

  // Get unique teams sorted by total revenue
  const allTeams = useMemo(() => {
    const teamRevenue = new Map<string, number>()
    
    cases.forEach((c) => {
      if (c.team && c.team.trim() && c.amount) {
        const date = parseDateInput(c.dateReceived)
        if (!date || date.getFullYear() !== selectedYear) return
        
        const team = c.team.trim()
        const amount = parseAmount(c.amount)
        teamRevenue.set(team, (teamRevenue.get(team) || 0) + amount)
      }
    })
    
    // Sort teams by revenue (highest first)
    return Array.from(teamRevenue.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([team]) => team)
  }, [cases, selectedYear])

  // Calculate monthly summary from cases
  const monthlySummary = useMemo<MonthlySummary[]>(() => {
    const summaryMap = new Map<string, MonthlySummary>()

    // Initialize 12 months for selected year
    for (let month = 1; month <= 12; month++) {
      const key = `${selectedYear}-${month}`
      summaryMap.set(key, {
        month,
        year: selectedYear,
        teamAmounts: {},
        total: 0,
      })
    }

    // Aggregate case amounts
    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date || date.getFullYear() !== selectedYear) return
      if (!c.amount || !c.team) return

      const month = date.getMonth() + 1
      const key = `${selectedYear}-${month}`
      const summary = summaryMap.get(key)!

      const amount = parseAmount(c.amount)
      const team = c.team.trim() || 'Unknown'

      summary.teamAmounts[team] = (summary.teamAmounts[team] || 0) + amount
      summary.total += amount
    })

    return Array.from(summaryMap.values()).sort((a, b) => a.month - b.month)
  }, [cases, selectedYear])

  // Calculate totals by team
  const teamTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    let grandTotal = 0

    monthlySummary.forEach((month) => {
      Object.entries(month.teamAmounts).forEach(([team, amount]) => {
        totals[team] = (totals[team] || 0) + amount
        grandTotal += amount
      })
    })

    return { totals, grandTotal }
  }, [monthlySummary])

  // Available years from cases
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (date) years.add(date.getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [cases])

  // Quarterly analysis
  const quarterlySummary = useMemo(() => {
    const quarterMap = new Map<string, { quarter: number; teamAmounts: Record<string, number>; total: number }>()
    
    for (let q = 1; q <= 4; q++) {
      quarterMap.set(`${selectedYear}-Q${q}`, {
        quarter: q,
        teamAmounts: {},
        total: 0,
      })
    }

    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date || date.getFullYear() !== selectedYear) return
      if (!c.amount || !c.team) return

      const quarter = Math.floor(date.getMonth() / 3) + 1
      const key = `${selectedYear}-Q${quarter}`
      const summary = quarterMap.get(key)!
      const team = c.team.trim() || 'Unknown'
      const amount = parseAmount(c.amount)

      summary.teamAmounts[team] = (summary.teamAmounts[team] || 0) + amount
      summary.total += amount
    })

    return Array.from(quarterMap.values()).sort((a, b) => a.quarter - b.quarter)
  }, [cases, selectedYear, allTeams])

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Month', ...allTeams, 'Total'],
      ...monthlySummary.map((m) => [
        MONTHS[m.month - 1],
        ...allTeams.map((team) => m.teamAmounts[team] || 0),
        m.total,
      ]),
      ['Total', ...allTeams.map((team) => teamTotals.totals[team] || 0), teamTotals.grandTotal],
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Team Summary')

    XLSX.writeFile(wb, `Team_Revenue_${selectedYear}.xlsx`)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">👥 Team Performance</h2>
          <p className="text-sm text-slate-600 mt-1">Track monthly revenue by team</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            📊 Export to Excel
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setViewMode('analytics')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'analytics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          📊 Analytics
        </button>
        <button
          onClick={() => setViewMode('details')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'details'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          📋 Team Details
        </button>
      </div>

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-4">
              {/* Time Period Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Period:</span>
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
                  <button
                    onClick={() => setTimePeriod('monthly')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      timePeriod === 'monthly'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setTimePeriod('quarterly')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      timePeriod === 'quarterly'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Quarterly
                  </button>
                  <button
                    onClick={() => setTimePeriod('yearly')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      timePeriod === 'yearly'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>
            </div>

            {/* Year Selection */}
            {(timePeriod === 'monthly' || timePeriod === 'quarterly') && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Top Teams Cards */}
          {timePeriod === 'monthly' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Top Teams by Revenue ({selectedYear})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allTeams.slice(0, 12).map((team, idx) => {
                  const total = teamTotals.totals[team] || 0
                  const percentage = teamTotals.grandTotal > 0 ? (total / teamTotals.grandTotal) * 100 : 0
                  const caseCount = cases.filter((c) => {
                    const date = parseDateInput(c.dateReceived)
                    return date && date.getFullYear() === selectedYear && c.team === team && c.amount
                  }).length
                  
                  return (
                    <div key={team} className="bg-gradient-to-br from-white to-slate-50 rounded-lg border border-slate-200 p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-bold text-slate-900">{team}</h4>
                        <span className="px-2 py-1 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-2xl font-bold text-slate-900">${formatCurrency(total)}</div>
                          <div className="text-xs text-slate-500">{percentage.toFixed(1)}% of total</div>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Cases</span>
                            <span className="font-semibold text-slate-900">{caseCount}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-slate-600">Avg per case</span>
                            <span className="font-semibold text-slate-900">
                              ${formatCurrency(caseCount > 0 ? total / caseCount : 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Data Tables */}
          {timePeriod === 'monthly' ? (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Monthly Team Performance - {selectedYear}</h3>
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10">Month</th>
                        {allTeams.map((team) => (
                          <th key={team} className="px-3 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">{team}</th>
                        ))}
                        <th className="px-3 py-2 text-right font-semibold text-slate-900 bg-slate-100 sticky right-0 z-10">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.map((month, idx) => (
                        <tr key={month.month} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 font-medium text-slate-900 sticky left-0 bg-inherit z-10">{MONTHS[month.month - 1]}</td>
                          {allTeams.map((team) => {
                            const amount = month.teamAmounts[team] || 0
                            return (
                              <td key={team} className="px-3 py-2 text-right text-slate-700">
                                {amount > 0 ? formatCurrency(amount) : '-'}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-right font-semibold text-slate-900 bg-slate-100 sticky right-0 z-10">
                            {formatCurrency(month.total)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-900 text-white font-bold sticky bottom-0">
                        <td className="px-3 py-2 sticky left-0 bg-slate-900 z-10">Total</td>
                        {allTeams.map((team) => (
                          <td key={team} className="px-3 py-2 text-right">
                            {teamTotals.totals[team] ? formatCurrency(teamTotals.totals[team]) : '-'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right text-sm sticky right-0 bg-slate-900 z-10">
                          {formatCurrency(teamTotals.grandTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : timePeriod === 'quarterly' ? (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Quarterly Team Performance - {selectedYear}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Quarter</th>
                        {allTeams.map((team) => (
                          <th key={team} className="px-4 py-3 text-right font-semibold text-slate-700">{team}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quarterlySummary.map((q, idx) => (
                        <tr key={q.quarter} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{QUARTERS[q.quarter - 1]} {selectedYear}</td>
                          {allTeams.map((team) => (
                            <td key={team} className="px-4 py-3 text-right text-slate-700">
                              {q.teamAmounts[team] ? formatCurrency(q.teamAmounts[team]) : '-'}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(q.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Year-over-Year Team Performance</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Year</th>
                        {allTeams.map((team) => (
                          <th key={team} className="px-4 py-3 text-right font-semibold text-slate-700">{team}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableYears.map((year, idx) => {
                        const yearCases = cases.filter((c) => {
                          const date = parseDateInput(c.dateReceived)
                          return date && date.getFullYear() === year
                        })
                        const yearData: Record<string, number> = {}
                        let total = 0
                        yearCases.forEach((c) => {
                          if (c.amount && c.team) {
                            const amount = parseAmount(c.amount)
                            const team = c.team.trim()
                            yearData[team] = (yearData[team] || 0) + amount
                            total += amount
                          }
                        })
                        return (
                          <tr key={year} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{year}</td>
                            {allTeams.map((team) => (
                              <td key={team} className="px-4 py-3 text-right text-slate-700">
                                {yearData[team] ? formatCurrency(yearData[team]) : '-'}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {formatCurrency(total)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        </div>
      )}

      {/* Details View */}
      {viewMode === 'details' && (
        <TeamDetails cases={cases} selectedYear={selectedYear} teams={allTeams} />
      )}
    </div>
  )
}

// Team Details Component
function TeamDetails({
  cases,
  selectedYear,
  teams,
}: {
  cases: Case[]
  selectedYear: number
  teams: string[]
}) {
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date || date.getFullYear() !== selectedYear) return false
      if (selectedTeam && c.team !== selectedTeam) return false
      if (!c.amount) return false
      
      // Fuzzy search across multiple fields
      if (searchQuery) {
        const searchFields = [
          c.billingCaseCode || '',
          c.client || '',
          c.team || '',
          c.type || '',
          c.requestor || '',
          c.office || '',
        ].join(' ')
        if (!fuzzyMatch(searchFields, searchQuery)) return false
      }
      
      return true
    })
  }, [cases, selectedYear, selectedTeam, searchQuery])

  const teamStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number; avgAmount: number }> = {}

    teams.forEach((team) => {
      const teamCases = filteredCases.filter((c) => c.team === team)
      const total = teamCases.reduce((sum, c) => {
        const amount = parseAmount(c.amount)
        return sum + amount
      }, 0)

      stats[team] = {
        count: teamCases.length,
        total,
        avgAmount: teamCases.length > 0 ? total / teamCases.length : 0,
      }
    })

    return stats
  }, [teams, filteredCases])

  const formatCurrency = (amount: string | number | undefined) => {
    if (!amount) return '-'
    const num = parseAmount(amount)
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(num)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-700 mb-1">🔍 Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case code, client, team, type..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Filter by Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
          >
            <option value="">All Teams</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
        {(searchQuery || selectedTeam) && (
          <button
            onClick={() => { setSearchQuery(''); setSelectedTeam(''); }}
            className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Team Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(teamStats)
          .filter(([team]) => !selectedTeam || team === selectedTeam)
          .sort(([, a], [, b]) => b.total - a.total)
          .map(([team, stats]) => (
            <div key={team} className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">{team}</h3>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Cases:</span>
                  <span className="font-medium text-slate-900">{stats.count}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total:</span>
                  <span className="font-medium text-slate-900">{formatCurrency(stats.total)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Avg:</span>
                  <span className="font-medium text-slate-900">{formatCurrency(stats.avgAmount)}</span>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Cases List */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Case Code</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Client</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No cases found
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => {
                  const date = parseDateInput(c.dateReceived)
                  return (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">
                        {date ? date.toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium">
                        {c.billingCaseCode || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{c.client || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{c.team || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{c.type || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(c.amount)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-sm text-slate-600">
        Showing {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
