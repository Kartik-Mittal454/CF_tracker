'use client'

import { useState, useEffect, useMemo } from 'react'
import { Case } from '@/app/page'
import { parseDateInput } from '@/lib/caseUtils'
import { parseAmount, fuzzyMatch } from '@/lib/formatters'
import * as XLSX from 'xlsx'
import { BillingAdjustment } from '@/lib/types'
import {
  fetchAllAdjustments,
  addAdjustment,
  modifyAdjustment,
  removeAdjustment,
} from '@/app/actions'

interface BillingManagerProps {
  cases: Case[]
}

const BILLING_TYPES = ['Full', 'Short', 'Standard', 'Very Short', 'Others', 'New IP', 'Pre-CD', 'Add-ons']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

type ViewMode = 'adjustments' | 'details' | 'analytics' | 'addons'
type TimePeriod = 'monthly' | 'quarterly' | 'yearly'
type AnalyticsMode = 'trend' | 'compare'

interface MonthlySummary {
  month: number
  year: number
  typeAmounts: Record<string, number>
  total: number
}

export default function BillingManager({ cases }: BillingManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('analytics')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()])
  const [isMultiYearMode, setIsMultiYearMode] = useState(false)
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false)
  const [adjustments, setAdjustments] = useState<BillingAdjustment[]>([])
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false)
  const [showMoveForm, setShowMoveForm] = useState(false)
  const [editingAdjustment, setEditingAdjustment] = useState<BillingAdjustment | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAddonCategory, setSelectedAddonCategory] = useState<'typeOnly' | 'bundled' | 'addonsOnly' | null>(null)
  const [addonDetailFilters, setAddonDetailFilters] = useState({
    client: '',
    team: '',
    requestor: '',
  })
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('monthly')
  const [analyticsMode, setAnalyticsMode] = useState<AnalyticsMode>('trend')
  const [adjustmentSearchQuery, setAdjustmentSearchQuery] = useState('')

  // Load adjustments
  useEffect(() => {
    loadAdjustments()
  }, [])

  const loadAdjustments = async () => {
    try {
      const data = await fetchAllAdjustments()
      setAdjustments(data)
    } catch (error) {
      console.error('Failed to load adjustments:', error)
    }
  }

  // Calculate monthly summary from cases
  const monthlySummary = useMemo<MonthlySummary[]>(() => {
    const summaryMap = new Map<string, MonthlySummary>()

    // Initialize 12 months for selected year
    for (let month = 1; month <= 12; month++) {
      const key = `${selectedYear}-${month}`
      summaryMap.set(key, {
        month,
        year: selectedYear,
        typeAmounts: {},
        total: 0,
      })
    }

    // Aggregate case amounts
    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date || date.getFullYear() !== selectedYear) return

      const month = date.getMonth() + 1
      const key = `${selectedYear}-${month}`
      const summary = summaryMap.get(key)!

      // Add regular type amount
      if (c.amount && c.type) {
        const amount = parseAmount(c.amount)
        const type = c.type || 'Others'
        summary.typeAmounts[type] = (summary.typeAmounts[type] || 0) + amount
        summary.total += amount
      }

      // Add add-ons billing separately
      if (c.addOnsBilling && c.addOnsBilling.trim() !== '') {
        const addOnAmount = parseAmount(c.addOnsBilling)
        summary.typeAmounts['Add-ons'] = (summary.typeAmounts['Add-ons'] || 0) + addOnAmount
        summary.total += addOnAmount
      }
    })

    // Apply adjustments
    adjustments.forEach((adj) => {
      if (adj.year !== selectedYear) return
      const key = `${adj.year}-${adj.month}`
      const summary = summaryMap.get(key)
      if (!summary) return

      summary.typeAmounts[adj.type] = (summary.typeAmounts[adj.type] || 0) + adj.amount
      summary.total += adj.amount
    })

    return Array.from(summaryMap.values()).sort((a, b) => a.month - b.month)
  }, [cases, selectedYear, adjustments])

  // Calculate totals by type
  const typeTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    let grandTotal = 0

    monthlySummary.forEach((month) => {
      Object.entries(month.typeAmounts).forEach(([type, amount]) => {
        totals[type] = (totals[type] || 0) + amount
        grandTotal += amount
      })
    })

    return { totals, grandTotal }
  }, [monthlySummary])

  // Filter adjustments by year and search query
  const yearAdjustments = useMemo(
    () => adjustments.filter((a) => {
      if (a.year !== selectedYear) return false
      if (!adjustmentSearchQuery) return true
      const searchLower = adjustmentSearchQuery.toLowerCase()
      const haystack = [
        MONTHS[a.month - 1],
        a.type,
        a.reason,
        String(a.amount)
      ].join(' ').toLowerCase()
      return fuzzyMatch(haystack, searchLower)
    }),
    [adjustments, selectedYear, adjustmentSearchQuery]
  )

  // Available years from cases
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (date) years.add(date.getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [cases])

  // Multi-year monthly summary for comparison
  const multiYearSummary = useMemo(() => {
    // Compute if multi-year mode OR if in analytics compare mode
    if ((!isMultiYearMode && !(viewMode === 'analytics' && analyticsMode === 'compare')) || selectedYears.length === 0) return null

    const yearsData: Record<number, MonthlySummary[]> = {}
    
    selectedYears.forEach(year => {
      const summaryMap = new Map<string, MonthlySummary>()
      
      // Initialize 12 months for this year
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${month}`
        summaryMap.set(key, {
          month,
          year,
          typeAmounts: {},
          total: 0,
        })
      }

      // Aggregate case amounts
      cases.forEach((c) => {
        const date = parseDateInput(c.dateReceived)
        if (!date || date.getFullYear() !== year) return

        const month = date.getMonth() + 1
        const key = `${year}-${month}`
        const summary = summaryMap.get(key)!

        // Add regular type amount
        if (c.amount && c.type) {
          const amount = parseAmount(c.amount)
          const type = c.type || 'Others'
          summary.typeAmounts[type] = (summary.typeAmounts[type] || 0) + amount
          summary.total += amount
        }

        // Add add-ons billing separately
        if (c.addOnsBilling && c.addOnsBilling.trim() !== '') {
          const addOnAmount = parseAmount(c.addOnsBilling)
          summary.typeAmounts['Add-ons'] = (summary.typeAmounts['Add-ons'] || 0) + addOnAmount
          summary.total += addOnAmount
        }
      })

      // Apply adjustments
      adjustments.forEach((adj) => {
        if (adj.year !== year) return
        const key = `${adj.year}-${adj.month}`
        const summary = summaryMap.get(key)
        if (!summary) return

        summary.typeAmounts[adj.type] = (summary.typeAmounts[adj.type] || 0) + adj.amount
        summary.total += adj.amount
      })

      yearsData[year] = Array.from(summaryMap.values()).sort((a, b) => a.month - b.month)
    })

    return yearsData
  }, [cases, selectedYears, isMultiYearMode, viewMode, analyticsMode, adjustments])

  // Quarterly analysis
  const quarterlySummary = useMemo(() => {
    const quarterMap = new Map<string, { quarter: number; typeAmounts: Record<string, number>; total: number }>()
    
    for (let q = 1; q <= 4; q++) {
      quarterMap.set(`${selectedYear}-Q${q}`, {
        quarter: q,
        typeAmounts: {},
        total: 0,
      })
    }

    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date || date.getFullYear() !== selectedYear) return

      const quarter = Math.floor(date.getMonth() / 3) + 1
      const key = `${selectedYear}-Q${quarter}`
      const summary = quarterMap.get(key)!

      // Add regular type amount
      if (c.amount && c.type) {
        const type = c.type || 'Others'
        const amount = parseAmount(c.amount)
        summary.typeAmounts[type] = (summary.typeAmounts[type] || 0) + amount
        summary.total += amount
      }

      // Add add-ons billing separately
      if (c.addOnsBilling && c.addOnsBilling.trim() !== '') {
        const addOnAmount = parseAmount(c.addOnsBilling)
        summary.typeAmounts['Add-ons'] = (summary.typeAmounts['Add-ons'] || 0) + addOnAmount
        summary.total += addOnAmount
      }
    })

    return Array.from(quarterMap.values()).sort((a, b) => a.quarter - b.quarter)
  }, [cases, selectedYear])

  // Multi-year quarterly analysis
  const multiYearQuarterly = useMemo(() => {
    // Compute if multi-year mode OR if in analytics compare mode
    if ((!isMultiYearMode && !(viewMode === 'analytics' && analyticsMode === 'compare')) || selectedYears.length === 0) return null

    const yearsData: Record<number, Array<{ quarter: number; typeAmounts: Record<string, number>; total: number }>> = {}
    
    selectedYears.forEach(year => {
      const quarterMap = new Map<string, { quarter: number; typeAmounts: Record<string, number>; total: number }>()
      
      for (let q = 1; q <= 4; q++) {
        quarterMap.set(`${year}-Q${q}`, {
          quarter: q,
          typeAmounts: {},
          total: 0,
        })
      }

      cases.forEach((c) => {
        const date = parseDateInput(c.dateReceived)
        if (!date || date.getFullYear() !== year) return

        const quarter = Math.floor(date.getMonth() / 3) + 1
        const key = `${year}-Q${quarter}`
        const summary = quarterMap.get(key)!

        if (c.amount && c.type) {
          const type = c.type || 'Others'
          const amount = parseAmount(c.amount)
          summary.typeAmounts[type] = (summary.typeAmounts[type] || 0) + amount
          summary.total += amount
        }

        if (c.addOnsBilling && c.addOnsBilling.trim() !== '') {
          const addOnAmount = parseAmount(c.addOnsBilling)
          summary.typeAmounts['Add-ons'] = (summary.typeAmounts['Add-ons'] || 0) + addOnAmount
          summary.total += addOnAmount
        }
      })

      yearsData[year] = Array.from(quarterMap.values()).sort((a, b) => a.quarter - b.quarter)
    })

    return yearsData
  }, [cases, selectedYears, isMultiYearMode, viewMode, analyticsMode])

  // Add-on Analysis
  const addonAnalysis = useMemo(() => {
    const addOnMap = new Map<string, { count: number; revenue: number }>()
    let typeOnlyRevenue = 0
    let addOnOnlyRevenue = 0
    let bundledRevenue = 0
    let typeOnlyCount = 0
    let addOnOnlyCount = 0
    let bundledCount = 0

    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date || date.getFullYear() !== selectedYear) return

      const hasType = c.type && c.type !== ''
      const hasAddOns = c.addOnsBilling && c.addOnsBilling.trim() !== ''
      const isAddOnOnly = c.addOnsOnly?.toLowerCase() === 'yes'
      
      const typeAmount = hasType && !isAddOnOnly ? parseAmount(c.amount) : 0
      const addOnAmount = hasAddOns ? parseAmount(c.addOnsBilling) : 0

      // Categorize cases
      if (isAddOnOnly && hasAddOns) {
        // Add-ons only
        addOnOnlyRevenue += addOnAmount
        addOnOnlyCount++
      } else if (hasType && hasAddOns) {
        // Bundled (Type + Add-ons)
        bundledRevenue += typeAmount + addOnAmount
        bundledCount++
      } else if (hasType && !hasAddOns) {
        // Type only
        typeOnlyRevenue += typeAmount
        typeOnlyCount++
      }

      // Track individual add-ons
      if (hasAddOns && c.addOnIpDelivered) {
        const addOns = c.addOnIpDelivered.split(/[,+]/).map(a => a.trim()).filter(a => a)
        addOns.forEach(addon => {
          const existing = addOnMap.get(addon) || { count: 0, revenue: 0 }
          addOnMap.set(addon, {
            count: existing.count + 1,
            revenue: existing.revenue + (addOnAmount / addOns.length), // Split revenue evenly
          })
        })
      }
    })

    const topAddOns = Array.from(addOnMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)

    const totalRevenue = typeOnlyRevenue + addOnOnlyRevenue + bundledRevenue
    const totalAddOnRevenue = addOnOnlyRevenue + (cases.filter(c => {
      const date = parseDateInput(c.dateReceived)
      if (!date || date.getFullYear() !== selectedYear) return false
      return c.addOnsBilling && c.addOnsBilling.trim() !== ''
    }).reduce((sum, c) => sum + parseAmount(c.addOnsBilling), 0))

    return {
      typeOnlyRevenue,
      addOnOnlyRevenue,
      bundledRevenue,
      typeOnlyCount,
      addOnOnlyCount,
      bundledCount,
      totalRevenue,
      totalAddOnRevenue,
      topAddOns,
      addOnAttachmentRate: bundledCount / (typeOnlyCount + bundledCount) * 100 || 0,
      avgAddOnValue: totalAddOnRevenue / (addOnOnlyCount + bundledCount) || 0,
    }
  }, [cases, selectedYear])

  // Multi-year add-on analysis
  const multiYearAddonAnalysis = useMemo(() => {
    if (!isMultiYearMode || selectedYears.length === 0) return null

    const yearsData: Record<number, {
      typeOnlyRevenue: number
      addOnOnlyRevenue: number
      bundledRevenue: number
      typeOnlyCount: number
      addOnOnlyCount: number
      bundledCount: number
      totalRevenue: number
      totalAddOnRevenue: number
      topAddOns: Array<{ name: string; count: number; revenue: number }>
      addOnAttachmentRate: number
      avgAddOnValue: number
    }> = {}

    selectedYears.forEach(year => {
      const addOnMap = new Map<string, { count: number; revenue: number }>()
      let typeOnlyRevenue = 0
      let addOnOnlyRevenue = 0
      let bundledRevenue = 0
      let typeOnlyCount = 0
      let addOnOnlyCount = 0
      let bundledCount = 0

      cases.forEach((c) => {
        const date = parseDateInput(c.dateReceived)
        if (!date || date.getFullYear() !== year) return

        const hasType = c.type && c.type !== ''
        const hasAddOns = c.addOnsBilling && c.addOnsBilling.trim() !== ''
        const isAddOnOnly = c.addOnsOnly?.toLowerCase() === 'yes'
        
        const typeAmount = hasType && !isAddOnOnly ? parseAmount(c.amount) : 0
        const addOnAmount = hasAddOns ? parseAmount(c.addOnsBilling) : 0

        if (isAddOnOnly && hasAddOns) {
          addOnOnlyRevenue += addOnAmount
          addOnOnlyCount++
        } else if (hasType && hasAddOns) {
          bundledRevenue += typeAmount + addOnAmount
          bundledCount++
        } else if (hasType && !hasAddOns) {
          typeOnlyRevenue += typeAmount
          typeOnlyCount++
        }

        if (hasAddOns && c.addOnIpDelivered) {
          const addOns = c.addOnIpDelivered.split(/[,+]/).map(a => a.trim()).filter(a => a)
          addOns.forEach(addon => {
            const existing = addOnMap.get(addon) || { count: 0, revenue: 0 }
            addOnMap.set(addon, {
              count: existing.count + 1,
              revenue: existing.revenue + (addOnAmount / addOns.length),
            })
          })
        }
      })

      const topAddOns = Array.from(addOnMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)

      const totalRevenue = typeOnlyRevenue + addOnOnlyRevenue + bundledRevenue
      const totalAddOnRevenue = addOnOnlyRevenue + (cases.filter(c => {
        const date = parseDateInput(c.dateReceived)
        if (!date || date.getFullYear() !== year) return false
        return c.addOnsBilling && c.addOnsBilling.trim() !== ''
      }).reduce((sum, c) => sum + parseAmount(c.addOnsBilling), 0))

      yearsData[year] = {
        typeOnlyRevenue,
        addOnOnlyRevenue,
        bundledRevenue,
        typeOnlyCount,
        addOnOnlyCount,
        bundledCount,
        totalRevenue,
        totalAddOnRevenue,
        topAddOns,
        addOnAttachmentRate: bundledCount / (typeOnlyCount + bundledCount) * 100 || 0,
        avgAddOnValue: totalAddOnRevenue / (addOnOnlyCount + bundledCount) || 0,
      }
    })

    return yearsData
  }, [cases, selectedYears, isMultiYearMode])

  // Categorized cases for detail views
  const categorizedCases = useMemo(() => {
    const typeOnly: Case[] = []
    const bundled: Case[] = []
    const addonsOnly: Case[] = []

    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date || date.getFullYear() !== selectedYear) return

      const hasType = c.type && c.type !== ''
      const hasAddOns = c.addOnsBilling && c.addOnsBilling.trim() !== ''
      const isAddOnOnly = c.addOnsOnly?.toLowerCase() === 'yes'

      if (isAddOnOnly && hasAddOns) {
        addonsOnly.push(c)
      } else if (hasType && hasAddOns) {
        bundled.push(c)
      } else if (hasType && !hasAddOns) {
        typeOnly.push(c)
      }
    })

    return { typeOnly, bundled, addonsOnly }
  }, [cases, selectedYear])

  // Filtered cases based on selected category and filters
  const filteredCategorizedCases = useMemo(() => {
    if (!selectedAddonCategory) return []
    
    let casesToFilter = categorizedCases[selectedAddonCategory]
    
    if (addonDetailFilters.client) {
      casesToFilter = casesToFilter.filter(c => 
        c.client?.toLowerCase().includes(addonDetailFilters.client.toLowerCase())
      )
    }
    if (addonDetailFilters.team) {
      casesToFilter = casesToFilter.filter(c => 
        c.team?.toLowerCase().includes(addonDetailFilters.team.toLowerCase())
      )
    }
    if (addonDetailFilters.requestor) {
      casesToFilter = casesToFilter.filter(c => 
        c.requestor?.toLowerCase().includes(addonDetailFilters.requestor.toLowerCase())
      )
    }
    
    return casesToFilter
  }, [selectedAddonCategory, categorizedCases, addonDetailFilters])

  // Unique values for filters
  const uniqueFilterValues = useMemo(() => {
    const casesToAnalyze = selectedAddonCategory ? categorizedCases[selectedAddonCategory] : []
    return {
      clients: Array.from(new Set(casesToAnalyze.map(c => c.client).filter(Boolean))).sort(),
      teams: Array.from(new Set(casesToAnalyze.map(c => c.team).filter(Boolean))).sort(),
      requestors: Array.from(new Set(casesToAnalyze.map(c => c.requestor).filter(Boolean))).sort(),
    }
  }, [selectedAddonCategory, categorizedCases])

  const handleSaveAdjustment = async (formData: Omit<BillingAdjustment, 'id'>) => {
    setIsLoading(true)
    try {
      if (editingAdjustment) {
        await modifyAdjustment(editingAdjustment.id, formData)
      } else {
        await addAdjustment(formData)
      }
      await loadAdjustments()
      setShowAdjustmentForm(false)
      setEditingAdjustment(null)
    } catch (error) {
      alert('Failed to save adjustment')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAdjustment = async (id: string) => {
    if (!confirm('Delete this adjustment?')) return
    setIsLoading(true)
    try {
      await removeAdjustment(id)
      await loadAdjustments()
    } catch (error) {
      alert('Failed to delete adjustment')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMoveAmount = async (moveData: {
    fromMonth: number
    toMonth: number
    type: string
    amount: number
    reason: string
  }) => {
    setIsLoading(true)
    try {
      // Create two adjustments: subtract from source, add to destination
      await addAdjustment({
        month: moveData.fromMonth,
        year: selectedYear,
        type: moveData.type,
        amount: -moveData.amount,
        reason: `${moveData.reason} (Moved to ${MONTHS[moveData.toMonth - 1]})`,
      })
      await addAdjustment({
        month: moveData.toMonth,
        year: selectedYear,
        type: moveData.type,
        amount: moveData.amount,
        reason: `${moveData.reason} (Moved from ${MONTHS[moveData.fromMonth - 1]})`,
      })
      await loadAdjustments()
      setShowMoveForm(false)
    } catch (error) {
      alert('Failed to move amount')
    } finally {
      setIsLoading(false)
    }
  }

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Month', ...BILLING_TYPES, 'Total'],
      ...monthlySummary.map((m) => [
        MONTHS[m.month - 1],
        ...BILLING_TYPES.map((type) => m.typeAmounts[type] || 0),
        m.total,
      ]),
      ['Total', ...BILLING_TYPES.map((type) => typeTotals.totals[type] || 0), typeTotals.grandTotal],
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Adjustments sheet
    if (yearAdjustments.length > 0) {
      const adjData = [
        ['Month', 'Type', 'Amount', 'Reason', 'Created'],
        ...yearAdjustments.map((a) => [
          MONTHS[a.month - 1],
          a.type,
          a.amount,
          a.reason,
          a.created_at || '',
        ]),
      ]
      const adjSheet = XLSX.utils.aoa_to_sheet(adjData)
      XLSX.utils.book_append_sheet(wb, adjSheet, 'Adjustments')
    }

    XLSX.writeFile(wb, `Billing_${selectedYear}.xlsx`)
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
          <h2 className="text-2xl font-bold text-slate-900">💰 Billing Manager</h2>
          <p className="text-sm text-slate-600 mt-1">Track monthly billing, adjustments, and revenue</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Multi-year toggle - only show for views that support it */}
          {!['adjustments', 'analytics'].includes(viewMode) && (
            <button
              onClick={() => {
                setIsMultiYearMode(!isMultiYearMode)
                if (!isMultiYearMode) {
                  setSelectedYears([selectedYear])
                }
              }}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isMultiYearMode
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {isMultiYearMode ? '📊 Multi-Year' : '📅 Single Year'}
            </button>
          )}

          {/* Year selector - single or multi */}
          {isMultiYearMode ? (
            <div className="relative">
              <div 
                className="flex flex-wrap gap-2 items-center px-3 py-2 border border-slate-300 rounded-lg bg-white max-w-xs cursor-pointer hover:border-slate-400"
                onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
              >
                {selectedYears.length === 0 ? (
                  <span className="text-sm text-slate-500">Select years...</span>
                ) : (
                  selectedYears.map(year => (
                    <span key={year} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      {year}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedYears(selectedYears.filter(y => y !== year))
                        }}
                        className="hover:text-blue-900"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
              {isYearDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsYearDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-300 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                    {availableYears.map(year => (
                      <label key={year} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedYears.includes(year)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedYears([...selectedYears, year].sort((a, b) => b - a))
                            } else {
                              setSelectedYears(selectedYears.filter(y => y !== year))
                            }
                          }}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm">{year}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <select
              value={selectedYear}
              onChange={(e) => {
                const year = Number(e.target.value)
                setSelectedYear(year)
                setSelectedYears([year])
              }}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}

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
          📋 Transaction Details
        </button>
        <button
          onClick={() => setViewMode('addons')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'addons'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          🎁 Add-ons Analysis
        </button>
        <button
          onClick={() => setViewMode('adjustments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'adjustments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          ⚖️ Adjustments ({yearAdjustments.length})
        </button>
      </div>

      {/* Adjustments View */}
      {viewMode === 'adjustments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-600">
              Manage billing adjustments (corrections, credits, reallocations)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingAdjustment(null)
                  setShowAdjustmentForm(true)
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Adjustment
              </button>
              <button
                onClick={() => setShowMoveForm(true)}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                🔄 Move Between Months
              </button>
            </div>
          </div>

          {/* Search bar for adjustments */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex-1 max-w-sm relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                value={adjustmentSearchQuery}
                onChange={(e) => setAdjustmentSearchQuery(e.target.value)}
                placeholder="Search adjustments..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {adjustmentSearchQuery && (
              <button
                onClick={() => setAdjustmentSearchQuery('')}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {showMoveForm && (
            <MoveAmountForm
              year={selectedYear}
              onSave={handleMoveAmount}
              onCancel={() => setShowMoveForm(false)}
              isLoading={isLoading}
            />
          )}

          {showAdjustmentForm && (
            <AdjustmentForm
              year={selectedYear}
              adjustment={editingAdjustment}
              onSave={handleSaveAdjustment}
              onCancel={() => {
                setShowAdjustmentForm(false)
                setEditingAdjustment(null)
              }}
              isLoading={isLoading}
            />
          )}

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reason</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {yearAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No adjustments for {selectedYear}
                    </td>
                  </tr>
                ) : (
                  yearAdjustments.map((adj) => (
                    <tr key={adj.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{MONTHS[adj.month - 1]}</td>
                      <td className="px-4 py-3 text-slate-700">{adj.type}</td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          adj.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {adj.amount >= 0 ? '+' : ''}
                        {formatCurrency(adj.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{adj.reason}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setEditingAdjustment(adj)
                            setShowAdjustmentForm(true)
                          }}
                          className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAdjustment(adj.id)}
                          className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded ml-2"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details View */}
      {viewMode === 'details' && (
        <TransactionDetails 
          cases={cases} 
          selectedYear={selectedYear}
          selectedYears={selectedYears}
          isMultiYearMode={isMultiYearMode}
        />
      )}

      {/* Unified Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-4">
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

              {/* Analytics Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Mode:</span>
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
                  <button
                    onClick={() => setAnalyticsMode('trend')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      analyticsMode === 'trend'
                        ? 'bg-green-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📈 Trend
                  </button>
                  <button
                    onClick={() => setAnalyticsMode('compare')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      analyticsMode === 'compare'
                        ? 'bg-green-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🔄 Compare
                  </button>
                </div>
              </div>
            </div>

            {/* Year Selection for Compare Mode */}
            {analyticsMode === 'compare' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Compare Years:</span>
                <div className="relative">
                  <div 
                    className="flex flex-wrap gap-2 items-center px-3 py-2 border border-slate-300 rounded-lg bg-white max-w-xs cursor-pointer hover:border-slate-400"
                    onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                  >
                    {selectedYears.length === 0 ? (
                      <span className="text-sm text-slate-500">Select years...</span>
                    ) : (
                      <>
                        {selectedYears.map(year => (
                          <span key={year} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                            {year}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedYears(selectedYears.filter(y => y !== year))
                              }}
                              className="hover:text-blue-900"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedYears([])
                          }}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 hover:bg-red-50 rounded"
                        >
                          Clear All
                        </button>
                      </>
                    )}
                  </div>
                  {isYearDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsYearDropdownOpen(false)}
                      />
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-300 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                        {availableYears.map(year => (
                          <label key={year} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedYears.includes(year)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedYears([...selectedYears, year].sort((a, b) => b - a))
                                } else {
                                  setSelectedYears(selectedYears.filter(y => y !== year))
                                }
                              }}
                              className="rounded border-slate-300"
                            />
                            <span className="text-sm">{year}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Year Selection for Trend Mode (Monthly/Quarterly only) */}
            {analyticsMode === 'trend' && (timePeriod === 'monthly' || timePeriod === 'quarterly') && (
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

          {/* Data Display */}
          {analyticsMode === 'trend' ? (
            // Trend Mode - Rolling time period view
            timePeriod === 'monthly' ? (
              // Monthly Trend (for selected year)
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Monthly Breakdown - {selectedYear}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
                        {BILLING_TYPES.map((type) => (
                          <th key={type} className="px-4 py-3 text-right font-semibold text-slate-700">{type}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.map((m, idx) => (
                        <tr key={m.month} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{MONTHS[m.month - 1]} {selectedYear}</td>
                          {BILLING_TYPES.map((type) => (
                            <td key={type} className="px-4 py-3 text-right text-slate-700">
                              {m.typeAmounts[type] ? formatCurrency(m.typeAmounts[type]) : '-'}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(m.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : timePeriod === 'quarterly' ? (
              // Quarterly Trend (Current year)
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Quarterly Breakdown - {selectedYear}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Quarter</th>
                        {BILLING_TYPES.map((type) => (
                          <th key={type} className="px-4 py-3 text-right font-semibold text-slate-700">{type}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quarterlySummary.map((q, idx) => (
                        <tr key={q.quarter} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{QUARTERS[q.quarter - 1]} {selectedYear}</td>
                          {BILLING_TYPES.map((type) => (
                            <td key={type} className="px-4 py-3 text-right text-slate-700">
                              {q.typeAmounts[type] ? formatCurrency(q.typeAmounts[type]) : '-'}
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
              // Yearly Trend (All available years)
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Year-over-Year Trend</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Year</th>
                        {BILLING_TYPES.map((type) => (
                          <th key={type} className="px-4 py-3 text-right font-semibold text-slate-700">{type}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableYears.map((year, idx) => {
                        const yearData = cases.filter(c => {
                          const date = parseDateInput(c.dateReceived)
                          return date && date.getFullYear() === year
                        })
                        const yearTotals: Record<string, number> = {}
                        let total = 0
                        yearData.forEach(c => {
                          if (c.amount && c.type) {
                            const amount = parseAmount(c.amount)
                            yearTotals[c.type] = (yearTotals[c.type] || 0) + amount
                            total += amount
                          }
                          if (c.addOnsBilling && c.addOnsBilling.trim() !== '') {
                            const addOnAmount = parseAmount(c.addOnsBilling)
                            yearTotals['Add-ons'] = (yearTotals['Add-ons'] || 0) + addOnAmount
                            total += addOnAmount
                          }
                        })
                        return (
                          <tr key={year} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{year}</td>
                            {BILLING_TYPES.map((type) => (
                              <td key={type} className="px-4 py-3 text-right text-slate-700">
                                {yearTotals[type] ? formatCurrency(yearTotals[type]) : '-'}
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
          ) : (
            // Compare Mode
            selectedYears.length < 2 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
                <p className="text-yellow-800 font-medium">Please select at least 2 years to compare</p>
                <p className="text-yellow-600 text-sm mt-1">Use the year selector above to choose years</p>
              </div>
            ) : timePeriod === 'monthly' && multiYearSummary ? (
              // Monthly Comparison
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Monthly Comparison Across {selectedYears.length} Years</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
                        {BILLING_TYPES.map((type) => (
                          <th key={type} colSpan={selectedYears.length} className="px-4 py-3 text-center font-semibold text-slate-700 border-l border-slate-200">
                            {type}
                          </th>
                        ))}
                        <th colSpan={selectedYears.length} className="px-4 py-3 text-center font-semibold text-slate-900 bg-slate-100 border-l border-slate-300">
                          Total
                        </th>
                      </tr>
                      <tr className="bg-slate-100 text-xs">
                        <th className="px-4 py-2"></th>
                        {BILLING_TYPES.map((type) => (
                          selectedYears.map((year, idx) => (
                            <th key={`${type}-${year}`} className={`px-2 py-2 text-center text-slate-600 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                              {year}
                            </th>
                          ))
                        ))}
                        {selectedYears.map((year, idx) => (
                          <th key={`total-${year}`} className={`px-2 py-2 text-center text-slate-700 font-semibold ${idx === 0 ? 'border-l border-slate-300' : ''}`}>
                            {year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((monthName, monthIdx) => (
                        <tr key={monthName} className={monthIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-3 font-medium text-slate-900">{monthName}</td>
                          {BILLING_TYPES.map((type) => (
                            selectedYears.map((year, idx) => {
                              const monthData = multiYearSummary[year]?.[monthIdx]
                              const amount = monthData?.typeAmounts[type] || 0
                              return (
                                <td key={`${type}-${year}`} className={`px-2 py-3 text-right text-slate-700 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                                  {amount > 0 ? formatCurrency(amount) : '-'}
                                </td>
                              )
                            })
                          ))}
                          {selectedYears.map((year, idx) => {
                            const monthData = multiYearSummary[year]?.[monthIdx]
                            const total = monthData?.total || 0
                            return (
                              <td key={`total-${year}`} className={`px-2 py-3 text-right font-semibold text-slate-900 ${idx === 0 ? 'border-l border-slate-300 bg-slate-100' : 'bg-slate-50'}`}>
                                {total > 0 ? formatCurrency(total) : '-'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : timePeriod === 'quarterly' && multiYearQuarterly ? (
              // Quarterly Comparison
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Quarterly Comparison Across {selectedYears.length} Years</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Quarter</th>
                        {BILLING_TYPES.map((type) => (
                          <th key={type} colSpan={selectedYears.length} className="px-4 py-3 text-center font-semibold text-slate-700 border-l border-slate-200">
                            {type}
                          </th>
                        ))}
                        <th colSpan={selectedYears.length} className="px-4 py-3 text-center font-semibold text-slate-900 bg-slate-100 border-l border-slate-300">
                          Total
                        </th>
                      </tr>
                      <tr className="bg-slate-100 text-xs">
                        <th className="px-4 py-2"></th>
                        {BILLING_TYPES.map((type) => (
                          selectedYears.map((year, idx) => (
                            <th key={`${type}-${year}`} className={`px-2 py-2 text-center text-slate-600 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                              {year}
                            </th>
                          ))
                        ))}
                        {selectedYears.map((year, idx) => (
                          <th key={`total-${year}`} className={`px-2 py-2 text-center text-slate-700 font-semibold ${idx === 0 ? 'border-l border-slate-300' : ''}`}>
                            {year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {QUARTERS.map((quarterName, quarterIdx) => (
                        <tr key={quarterName} className={quarterIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{quarterName}</td>
                          {BILLING_TYPES.map((type) => (
                            selectedYears.map((year, idx) => {
                              const quarterData = multiYearQuarterly[year]?.[quarterIdx]
                              const amount = quarterData?.typeAmounts[type] || 0
                              return (
                                <td key={`${type}-${year}`} className={`px-2 py-3 text-right text-slate-700 ${idx === 0 ? 'border-l border-slate-200' : ''}`}>
                                  {amount > 0 ? formatCurrency(amount) : '-'}
                                </td>
                              )
                            })
                          ))}
                          {selectedYears.map((year, idx) => {
                            const quarterData = multiYearQuarterly[year]?.[quarterIdx]
                            const total = quarterData?.total || 0
                            return (
                              <td key={`total-${year}`} className={`px-2 py-3 text-right font-semibold text-slate-900 ${idx === 0 ? 'border-l border-slate-300 bg-slate-100' : 'bg-slate-50'}`}>
                                {total > 0 ? formatCurrency(total) : '-'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // Yearly Comparison
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Year-over-Year Comparison ({selectedYears.length} Years)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                        {selectedYears.map(year => (
                          <th key={year} className="px-4 py-3 text-right font-semibold text-slate-700 border-l border-slate-200">
                            {year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BILLING_TYPES.map((type, idx) => {
                        const yearData = selectedYears.map(year => {
                          const yearTotal = multiYearSummary?.[year]?.reduce((sum, month) => sum + (month.typeAmounts[type] || 0), 0) || 0
                          return yearTotal
                        })
                        
                        return (
                          <tr key={type} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{type}</td>
                            {selectedYears.map((year, yearIdx) => (
                              <td key={year} className="px-4 py-3 text-right text-slate-700 border-l border-slate-200">
                                {formatCurrency(yearData[yearIdx])}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <td className="px-4 py-3 text-slate-900">Total</td>
                        {selectedYears.map(year => {
                          const grandTotal = multiYearSummary?.[year]?.reduce((sum, month) => sum + month.total, 0) || 0
                          return (
                            <td key={year} className="px-4 py-3 text-right text-slate-900 border-l border-slate-200">
                              {formatCurrency(grandTotal)}
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Add-ons Analysis View */}
      {viewMode === 'addons' && (
        <div className="space-y-6">
          {isMultiYearMode && multiYearAddonAnalysis && selectedYears.length > 0 ? (
            // Multi-year comparison view
            <div className="space-y-4">
              {/* Multi-year KPI Cards */}
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedYears.length}, 1fr)` }}>
                {selectedYears.map(year => {
                  const data = multiYearAddonAnalysis[year]
                  return (
                    <div key={year} className="space-y-3">
                      <h3 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-200">{year}</h3>
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                        <div className="text-xs font-semibold text-blue-700 mb-1">Total Add-on Revenue</div>
                        <div className="text-xl font-bold text-blue-900">{formatCurrency(data.totalAddOnRevenue)}</div>
                        <div className="text-xs text-blue-600 mt-1">
                          {((data.totalAddOnRevenue / data.totalRevenue) * 100).toFixed(1)}% of total
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                        <div className="text-xs font-semibold text-green-700 mb-1">Attachment Rate</div>
                        <div className="text-xl font-bold text-green-900">{data.addOnAttachmentRate.toFixed(1)}%</div>
                        <div className="text-xs text-green-600 mt-1">
                          {data.bundledCount} of {data.typeOnlyCount + data.bundledCount}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                        <div className="text-xs font-semibold text-purple-700 mb-1">Avg Value</div>
                        <div className="text-xl font-bold text-purple-900">{formatCurrency(data.avgAddOnValue)}</div>
                      </div>
                      <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                        <div className="text-xs font-semibold text-amber-700 mb-1">Add-ons Only</div>
                        <div className="text-xl font-bold text-amber-900">{data.addOnOnlyCount}</div>
                        <div className="text-xs text-amber-600 mt-1">
                          {formatCurrency(data.addOnOnlyRevenue)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Multi-year revenue split comparison */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Revenue Split Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-700">Category</th>
                        {selectedYears.map(year => (
                          <th key={year} colSpan={2} className="px-4 py-2 text-center font-semibold text-slate-700 border-l border-slate-200">
                            {year}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-slate-100 text-xs">
                        <th className="px-4 py-2"></th>
                        {selectedYears.map(year => (
                          <>
                            <th key={`${year}-revenue`} className="px-2 py-1 text-right text-slate-600 border-l border-slate-200">Revenue</th>
                            <th key={`${year}-count`} className="px-2 py-1 text-right text-slate-600">Cases</th>
                          </>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">Type Only</td>
                        {selectedYears.map(year => {
                          const data = multiYearAddonAnalysis[year]
                          return (
                            <>
                              <td key={`${year}-type-rev`} className="px-2 py-3 text-right text-slate-700 border-l border-slate-200">
                                {formatCurrency(data.typeOnlyRevenue)}
                              </td>
                              <td key={`${year}-type-count`} className="px-2 py-3 text-right text-slate-600">
                                {data.typeOnlyCount}
                              </td>
                            </>
                          )
                        })}
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">Bundled</td>
                        {selectedYears.map(year => {
                          const data = multiYearAddonAnalysis[year]
                          return (
                            <>
                              <td key={`${year}-bundled-rev`} className="px-2 py-3 text-right text-blue-700 font-semibold border-l border-slate-200">
                                {formatCurrency(data.bundledRevenue)}
                              </td>
                              <td key={`${year}-bundled-count`} className="px-2 py-3 text-right text-slate-600">
                                {data.bundledCount}
                              </td>
                            </>
                          )
                        })}
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">Add-ons Only</td>
                        {selectedYears.map(year => {
                          const data = multiYearAddonAnalysis[year]
                          return (
                            <>
                              <td key={`${year}-addon-rev`} className="px-2 py-3 text-right text-green-700 font-semibold border-l border-slate-200">
                                {formatCurrency(data.addOnOnlyRevenue)}
                              </td>
                              <td key={`${year}-addon-count`} className="px-2 py-3 text-right text-slate-600">
                                {data.addOnOnlyCount}
                              </td>
                            </>
                          )
                        })}
                      </tr>
                      <tr className="bg-slate-100 font-bold">
                        <td className="px-4 py-3 text-slate-900">Total</td>
                        {selectedYears.map(year => {
                          const data = multiYearAddonAnalysis[year]
                          return (
                            <>
                              <td key={`${year}-total-rev`} className="px-2 py-3 text-right text-slate-900 border-l border-slate-200">
                                {formatCurrency(data.totalRevenue)}
                              </td>
                              <td key={`${year}-total-count`} className="px-2 py-3 text-right text-slate-900">
                                {data.typeOnlyCount + data.bundledCount + data.addOnOnlyCount}
                              </td>
                            </>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            // Single year detailed view
            <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="text-xs font-semibold text-blue-700 mb-1">Total Add-on Revenue</div>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(addonAnalysis.totalAddOnRevenue)}</div>
              <div className="text-xs text-blue-600 mt-1">
                {((addonAnalysis.totalAddOnRevenue / addonAnalysis.totalRevenue) * 100).toFixed(1)}% of total
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="text-xs font-semibold text-green-700 mb-1">Add-on Attachment Rate</div>
              <div className="text-2xl font-bold text-green-900">{addonAnalysis.addOnAttachmentRate.toFixed(1)}%</div>
              <div className="text-xs text-green-600 mt-1">
                {addonAnalysis.bundledCount} of {addonAnalysis.typeOnlyCount + addonAnalysis.bundledCount} cases
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="text-xs font-semibold text-purple-700 mb-1">Avg Add-on Value</div>
              <div className="text-2xl font-bold text-purple-900">{formatCurrency(addonAnalysis.avgAddOnValue)}</div>
              <div className="text-xs text-purple-600 mt-1">
                {addonAnalysis.addOnOnlyCount + addonAnalysis.bundledCount} cases with add-ons
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
              <div className="text-xs font-semibold text-amber-700 mb-1">Add-ons Only Cases</div>
              <div className="text-2xl font-bold text-amber-900">{addonAnalysis.addOnOnlyCount}</div>
              <div className="text-xs text-amber-600 mt-1">
                {formatCurrency(addonAnalysis.addOnOnlyRevenue)} revenue
              </div>
            </div>
          </div>

          {/* Revenue Split */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Revenue Split by Case Type
              <span className="text-xs font-normal text-slate-500 ml-2">(Click to view details)</span>
            </h3>
            <div className="space-y-3">
              <div 
                className="cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors"
                onClick={() => setSelectedAddonCategory(selectedAddonCategory === 'typeOnly' ? null : 'typeOnly')}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-700 font-medium">Type Only (No Add-ons)</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(addonAnalysis.typeOnlyRevenue)} ({addonAnalysis.typeOnlyCount} cases)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-slate-600 h-2 rounded-full transition-all"
                    style={{ width: `${(addonAnalysis.typeOnlyRevenue / addonAnalysis.totalRevenue) * 100}%` }}
                  />
                </div>
              </div>
              
              <div 
                className="cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors"
                onClick={() => setSelectedAddonCategory(selectedAddonCategory === 'bundled' ? null : 'bundled')}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-700 font-medium">Bundled (Type + Add-ons)</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(addonAnalysis.bundledRevenue)} ({addonAnalysis.bundledCount} cases)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(addonAnalysis.bundledRevenue / addonAnalysis.totalRevenue) * 100}%` }}
                  />
                </div>
              </div>
              
              <div 
                className="cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors"
                onClick={() => setSelectedAddonCategory(selectedAddonCategory === 'addonsOnly' ? null : 'addonsOnly')}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-700 font-medium">Add-ons Only</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(addonAnalysis.addOnOnlyRevenue)} ({addonAnalysis.addOnOnlyCount} cases)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${(addonAnalysis.addOnOnlyRevenue / addonAnalysis.totalRevenue) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Case Details View */}
          {selectedAddonCategory && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-blue-900">
                    {selectedAddonCategory === 'typeOnly' && 'Type Only Cases'}
                    {selectedAddonCategory === 'bundled' && 'Bundled Cases (Type + Add-ons)'}
                    {selectedAddonCategory === 'addonsOnly' && 'Add-ons Only Cases'}
                    <span className="ml-2 text-xs font-normal text-blue-700">
                      ({filteredCategorizedCases.length} cases)
                    </span>
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedAddonCategory(null)
                      setAddonDetailFilters({ client: '', team: '', requestor: '' })
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    ✕ Close
                  </button>
                </div>
                
                {/* Filters */}
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Filter by Client</label>
                    <select
                      value={addonDetailFilters.client}
                      onChange={(e) => setAddonDetailFilters(prev => ({ ...prev, client: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-blue-200 rounded bg-white"
                    >
                      <option value="">All Clients</option>
                      {uniqueFilterValues.clients.map(client => (
                        <option key={client} value={client}>{client}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Filter by Team</label>
                    <select
                      value={addonDetailFilters.team}
                      onChange={(e) => setAddonDetailFilters(prev => ({ ...prev, team: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-blue-200 rounded bg-white"
                    >
                      <option value="">All Teams</option>
                      {uniqueFilterValues.teams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-blue-700 mb-1">Filter by Requestor</label>
                    <select
                      value={addonDetailFilters.requestor}
                      onChange={(e) => setAddonDetailFilters(prev => ({ ...prev, requestor: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-blue-200 rounded bg-white"
                    >
                      <option value="">All Requestors</option>
                      {uniqueFilterValues.requestors.map(requestor => (
                        <option key={requestor} value={requestor}>{requestor}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Case Code</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Client</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Team</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Requestor</th>
                      {selectedAddonCategory === 'bundled' && (
                        <>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Type</th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">Type Amount</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Add-ons</th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">Add-on Amount</th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">Total</th>
                        </>
                      )}
                      {selectedAddonCategory === 'typeOnly' && (
                        <>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Type</th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount</th>
                        </>
                      )}
                      {selectedAddonCategory === 'addonsOnly' && (
                        <>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Add-ons</th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategorizedCases.map((c, idx) => {
                      const typeAmount = parseAmount(c.amount)
                      const addOnAmount = parseAmount(c.addOnsBilling)
                      return (
                        <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-2 text-slate-700">{c.billingCaseCode}</td>
                          <td className="px-4 py-2 text-slate-700">{c.client}</td>
                          <td className="px-4 py-2 text-slate-700">{c.team}</td>
                          <td className="px-4 py-2 text-slate-700">{c.requestor}</td>
                          {selectedAddonCategory === 'bundled' && (
                            <>
                              <td className="px-4 py-2 text-slate-700">{c.type}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900">
                                {formatCurrency(typeAmount)}
                              </td>
                              <td className="px-4 py-2 text-slate-700">{c.addOnIpDelivered}</td>
                              <td className="px-4 py-2 text-right font-semibold text-blue-900">
                                {formatCurrency(addOnAmount)}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-slate-900">
                                {formatCurrency(typeAmount + addOnAmount)}
                              </td>
                            </>
                          )}
                          {selectedAddonCategory === 'typeOnly' && (
                            <>
                              <td className="px-4 py-2 text-slate-700">{c.type}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900">
                                {formatCurrency(typeAmount)}
                              </td>
                            </>
                          )}
                          {selectedAddonCategory === 'addonsOnly' && (
                            <>
                              <td className="px-4 py-2 text-slate-700">{c.addOnIpDelivered}</td>
                              <td className="px-4 py-2 text-right font-semibold text-green-900">
                                {formatCurrency(addOnAmount)}
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                    {filteredCategorizedCases.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                          No cases match the selected filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Add-ons Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Top Add-ons by Revenue</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">Rank</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">Add-on Name</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Count</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Total Revenue</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">Avg Revenue</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-700">% of Add-on Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {addonAnalysis.topAddOns.map((addon, idx) => (
                    <tr key={addon.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-6 py-3 text-slate-700">#{idx + 1}</td>
                      <td className="px-6 py-3 font-medium text-slate-900">{addon.name}</td>
                      <td className="px-6 py-3 text-right text-slate-700">{addon.count}</td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(addon.revenue)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-700">
                        {formatCurrency(addon.revenue / addon.count)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-700">
                        {((addon.revenue / addonAnalysis.totalAddOnRevenue) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {addonAnalysis.topAddOns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No add-on data available for {selectedYear}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Adjustment Form Component
function AdjustmentForm({
  year,
  adjustment,
  onSave,
  onCancel,
  isLoading,
}: {
  year: number
  adjustment: BillingAdjustment | null
  onSave: (data: Omit<BillingAdjustment, 'id'>) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    month: adjustment?.month || 1,
    year: adjustment?.year || year,
    type: adjustment?.type || 'Full',
    amount: adjustment?.amount || 0,
    reason: adjustment?.reason || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">
        {adjustment ? 'Edit Adjustment' : 'New Adjustment'}
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Month</label>
          <select
            value={formData.month}
            onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            required
          >
            {MONTHS.map((month, idx) => (
              <option key={idx} value={idx + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            required
          >
            {BILLING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Amount</label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            required
          />
          <p className="text-[10px] text-slate-500 mt-1">Use negative for deductions</p>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">Reason</label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            placeholder="e.g., Moved from Feb to Jan"
            required
          />
        </div>
        <div className="col-span-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Move Amount Form Component
function MoveAmountForm({
  year,
  onSave,
  onCancel,
  isLoading,
}: {
  year: number
  onSave: (data: {
    fromMonth: number
    toMonth: number
    type: string
    amount: number
    reason: string
  }) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    fromMonth: 1,
    toMonth: 2,
    type: 'Full',
    amount: 0,
    reason: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.fromMonth === formData.toMonth) {
      alert('From and To months must be different')
      return
    }
    if (formData.amount <= 0) {
      alert('Amount must be greater than 0')
      return
    }
    onSave(formData)
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">
        🔄 Move Amount Between Months
      </h3>
      <p className="text-xs text-slate-600 mb-3">
        This will create two adjustments automatically: subtract from source month and add to destination month
      </p>
      <form onSubmit={handleSubmit} className="grid grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">From Month</label>
          <select
            value={formData.fromMonth}
            onChange={(e) => setFormData({ ...formData, fromMonth: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            required
          >
            {MONTHS.map((month, idx) => (
              <option key={idx} value={idx + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">To Month</label>
          <select
            value={formData.toMonth}
            onChange={(e) => setFormData({ ...formData, toMonth: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            required
          >
            {MONTHS.map((month, idx) => (
              <option key={idx} value={idx + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            required
          >
            {BILLING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Amount</label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            required
            min="0"
          />
          <p className="text-[10px] text-slate-500 mt-1">Amount to move</p>
        </div>
        <div className="col-span-1">
          <label className="block text-xs font-medium text-slate-700 mb-1">Reason</label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            placeholder="e.g., Invoice reallocation"
            required
          />
        </div>
        <div className="col-span-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {isLoading ? 'Moving...' : 'Move Amount'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Transaction Details Component
function TransactionDetails({
  cases,
  selectedYear,
  selectedYears,
  isMultiYearMode,
}: {
  cases: Case[]
  selectedYear: number
  selectedYears?: number[]
  isMultiYearMode?: boolean
}) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedYearFilter, setSelectedYearFilter] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')

  const activeYears = isMultiYearMode && selectedYears ? selectedYears : [selectedYear]

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date) return false
      
      // Filter by selected years
      if (isMultiYearMode && selectedYears) {
        if (selectedYearFilter) {
          if (date.getFullYear() !== selectedYearFilter) return false
        } else {
          if (!selectedYears.includes(date.getFullYear())) return false
        }
      } else {
        if (date.getFullYear() !== selectedYear) return false
      }
      
      if (selectedMonth && date.getMonth() + 1 !== selectedMonth) return false
      if (selectedType && c.type !== selectedType) return false
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
          c.currency || '',
        ].join(' ')
        if (!fuzzyMatch(searchFields, searchQuery)) return false
      }
      
      return true
    })
  }, [cases, selectedYear, selectedYears, isMultiYearMode, selectedMonth, selectedType, selectedYearFilter, searchQuery])

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
        {isMultiYearMode && selectedYears && selectedYears.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Filter by Year</label>
            <select
              value={selectedYearFilter || ''}
              onChange={(e) => setSelectedYearFilter(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
            >
              <option value="">All Selected Years</option>
              {selectedYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Filter by Month</label>
          <select
            value={selectedMonth || ''}
            onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
          >
            <option value="">All Months</option>
            {MONTHS.map((month, idx) => (
              <option key={idx} value={idx + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Filter by Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
          >
            <option value="">All Types</option>
            {BILLING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        {(searchQuery || selectedMonth || selectedType || selectedYearFilter) && (
          <button
            onClick={() => { 
              setSearchQuery(''); 
              setSelectedMonth(null); 
              setSelectedType(''); 
              setSelectedYearFilter(null);
            }}
            className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Case Code</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Client</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Currency</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No transactions found
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
                      <td className="px-4 py-3 text-slate-600">{c.currency || 'USD'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-sm text-slate-600">
        Showing {filteredCases.length} transaction{filteredCases.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
