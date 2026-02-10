'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Case } from '@/app/page'
import { parseDateInput } from '@/lib/caseUtils'
import { parseAmount, formatAmount as formatAmountUtil } from '@/lib/formatters'

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const REGION_ORDER = ['Americas', 'APAC', 'EMEA']
const UNKNOWN_REGION = '(Unassigned Region)'
const UNKNOWN_OFFICE = '(Blank Office)'
const UNKNOWN_YEAR = 'NA'

interface CaseMatrixProps {
  cases: Case[]
}

type MatrixMode = 'offices' | 'amounts'
type AmountViewMode = 'yearly' | 'quarterly' | 'monthly'
type OfficeViewMode = 'yearly' | 'quarterly' | 'monthly'

interface OfficeRow {
  office: string
  quarters: number[]
  total: number
}

interface RegionRow {
  region: string
  rows: OfficeRow[]
  quarterTotals: number[]
  total: number
}

interface MatrixData {
  regions: RegionRow[]
  quarterTotals: number[]
  grandTotal: number
  officeCount: number
  caseCount: number
}

interface AmountMatrixRow {
  year: string
  regionTotals: Record<string, number>
  grandTotal: number
}

interface AmountMatrixData {
  rows: AmountMatrixRow[]
  columnTotals: Record<string, number>
  grandTotal: number
  regions: string[]
}

interface QuarterlyAmountRow {
  year: string
  quarter: number
  quarterLabel: string
  regionTotals: Record<string, number>
  grandTotal: number
}

interface MonthlyAmountRow {
  year: string
  month: number
  monthLabel: string
  regionTotals: Record<string, number>
  grandTotal: number
}

const createEmptyQuarterArray = () => [0, 0, 0, 0]

export default function CaseMatrix({ cases }: CaseMatrixProps) {
  const [mode, setMode] = useState<MatrixMode>('offices')
  const [amountViewMode, setAmountViewMode] = useState<AmountViewMode>('yearly')
  const [officeViewMode, setOfficeViewMode] = useState<OfficeViewMode>('quarterly')
  const yearOptions = useMemo(() => {
    const yearSet = new Set<number>()
    cases.forEach((c) => {
      const date = parseDateInput(c.dateReceived)
      if (!date) return
      yearSet.add(date.getFullYear())
    })
    return Array.from(yearSet).sort((a, b) => b - a)
  }, [cases])

  const defaultYear = yearOptions[0] ?? new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear)

  useEffect(() => {
    if (yearOptions.length === 0) return
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0])
    }
  }, [yearOptions, selectedYear])

  useEffect(() => {
    if (mode === 'offices' && yearOptions.length > 0 && !yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0])
    }
  }, [mode, yearOptions, selectedYear])

  const matrix = useMemo<MatrixData>(() => {
    if (officeViewMode === 'yearly') {
      // Yearly view - show all years with quarters aggregated
      const regionMap = new Map<string, Map<string, { quarters: number[]; total: number }>>()
      const yearTotals = [0, 0, 0, 0] // Will represent different years instead of quarters
      let grandTotal = 0
      const officesSet = new Set<string>()
      
      // Get available years and limit to top 4 most recent
      const availableYears = Array.from(new Set(cases.map(c => {
        const date = parseDateInput(c.dateReceived)
        return date ? date.getFullYear() : null
      }).filter(Boolean))).sort((a, b) => b! - a!).slice(0, 4)
      
      cases.forEach((c) => {
        const date = parseDateInput(c.dateReceived)
        if (!date) return
        
        const yearIndex = availableYears.indexOf(date.getFullYear())
        if (yearIndex === -1) return // Skip years not in top 4
        
        const region = (c.region && c.region.trim()) || UNKNOWN_REGION
        const office = (c.office && c.office.trim()) || UNKNOWN_OFFICE
        
        if (!regionMap.has(region)) {
          regionMap.set(region, new Map())
        }
        const officeMap = regionMap.get(region)!
        if (!officeMap.has(office)) {
          officeMap.set(office, { quarters: [0, 0, 0, 0], total: 0 })
        }
        const officeRow = officeMap.get(office)!
        officeRow.quarters[yearIndex] += 1
        officeRow.total += 1
        
        yearTotals[yearIndex] += 1
        grandTotal += 1
        officesSet.add(office)
      })
      
      const regionNames = Array.from(regionMap.keys())
      const orderedRegions = [
        ...REGION_ORDER.filter((region) => regionMap.has(region)),
        ...regionNames.filter((region) => !REGION_ORDER.includes(region)),
      ]
      
      const regions: RegionRow[] = orderedRegions.map((region) => {
        const officeEntries = Array.from(regionMap.get(region)?.entries() || [])
        officeEntries.sort(([a], [b]) => a.localeCompare(b))
        
        const rows: OfficeRow[] = officeEntries.map(([office, data]) => ({
          office,
          quarters: data.quarters,
          total: data.total,
        }))
        
        const totals = [0, 0, 0, 0]
        rows.forEach((row) => {
          row.quarters.forEach((count, idx) => {
            totals[idx] += count
          })
        })
        
        return {
          region,
          rows,
          quarterTotals: totals,
          total: totals.reduce((sum, value) => sum + value, 0),
        }
      })
      
      return {
        regions,
        quarterTotals: yearTotals,
        grandTotal,
        officeCount: officesSet.size,
        caseCount: grandTotal,
        availableYears, // Add this to pass year labels
      } as MatrixData & { availableYears: number[] }
      
    } else if (officeViewMode === 'monthly') {
      // Monthly view for selected year
      const regionMap = new Map<string, Map<string, { quarters: number[]; total: number }>>()
      const monthTotals = Array(12).fill(0)
      let grandTotal = 0
      const officesSet = new Set<string>()
      
      cases.forEach((c) => {
        const date = parseDateInput(c.dateReceived)
        if (!date) return
        if (date.getFullYear() !== selectedYear) return
        
        const region = (c.region && c.region.trim()) || UNKNOWN_REGION
        const office = (c.office && c.office.trim()) || UNKNOWN_OFFICE
        const monthIndex = date.getMonth()
        
        if (!regionMap.has(region)) {
          regionMap.set(region, new Map())
        }
        const officeMap = regionMap.get(region)!
        if (!officeMap.has(office)) {
          officeMap.set(office, { quarters: Array(12).fill(0), total: 0 })
        }
        const officeRow = officeMap.get(office)!
        officeRow.quarters[monthIndex] += 1
        officeRow.total += 1
        
        monthTotals[monthIndex] += 1
        grandTotal += 1
        officesSet.add(office)
      })
      
      const regionNames = Array.from(regionMap.keys())
      const orderedRegions = [
        ...REGION_ORDER.filter((region) => regionMap.has(region)),
        ...regionNames.filter((region) => !REGION_ORDER.includes(region)),
      ]
      
      const regions: RegionRow[] = orderedRegions.map((region) => {
        const officeEntries = Array.from(regionMap.get(region)?.entries() || [])
        officeEntries.sort(([a], [b]) => a.localeCompare(b))
        
        const rows: OfficeRow[] = officeEntries.map(([office, data]) => ({
          office,
          quarters: data.quarters,
          total: data.total,
        }))
        
        const totals = Array(12).fill(0)
        rows.forEach((row) => {
          row.quarters.forEach((count, idx) => {
            totals[idx] += count
          })
        })
        
        return {
          region,
          rows,
          quarterTotals: totals,
          total: totals.reduce((sum, value) => sum + value, 0),
        }
      })
      
      return {
        regions,
        quarterTotals: monthTotals,
        grandTotal,
        officeCount: officesSet.size,
        caseCount: grandTotal,
      }
      
    } else {
      // Quarterly view (existing logic)
      const regionMap = new Map<string, Map<string, { quarters: number[]; total: number }>>()
      const quarterTotals = createEmptyQuarterArray()
      let grandTotal = 0
      const officesSet = new Set<string>()
      
      cases.forEach((c) => {
        const date = parseDateInput(c.dateReceived)
        if (!date) return
        if (date.getFullYear() !== selectedYear) return
        
        const region = (c.region && c.region.trim()) || UNKNOWN_REGION
        const office = (c.office && c.office.trim()) || UNKNOWN_OFFICE
        const quarterIndex = Math.min(Math.floor(date.getMonth() / 3), 3)
        
        if (!regionMap.has(region)) {
          regionMap.set(region, new Map())
        }
        const officeMap = regionMap.get(region)!
        if (!officeMap.has(office)) {
          officeMap.set(office, { quarters: createEmptyQuarterArray(), total: 0 })
        }
        const officeRow = officeMap.get(office)!
        officeRow.quarters[quarterIndex] += 1
        officeRow.total += 1
        
        quarterTotals[quarterIndex] += 1
        grandTotal += 1
        officesSet.add(office)
      })
      
      const regionNames = Array.from(regionMap.keys())
      const orderedRegions = [
        ...REGION_ORDER.filter((region) => regionMap.has(region)),
        ...regionNames.filter((region) => !REGION_ORDER.includes(region)),
      ]
      
      const regions: RegionRow[] = orderedRegions.map((region) => {
        const officeEntries = Array.from(regionMap.get(region)?.entries() || [])
        officeEntries.sort(([a], [b]) => a.localeCompare(b))
        
        const rows: OfficeRow[] = officeEntries.map(([office, data]) => ({
          office,
          quarters: data.quarters,
          total: data.total,
        }))
        
        const totals = createEmptyQuarterArray()
        rows.forEach((row) => {
          row.quarters.forEach((count, idx) => {
            totals[idx] += count
          })
        })
        
        return {
          region,
          rows,
          quarterTotals: totals,
          total: totals.reduce((sum, value) => sum + value, 0),
        }
      })
      
      return {
        regions,
        quarterTotals,
        grandTotal,
        officeCount: officesSet.size,
        caseCount: grandTotal,
      }
    }
  }, [cases, selectedYear, officeViewMode])

  const amountMatrix = useMemo<AmountMatrixData>(() => {
    const yearMap = new Map<string, AmountMatrixRow>()
    const columnTotals: Record<string, number> = {}
    let grandTotal = 0
    const extraRegions = new Set<string>()

    cases.forEach((c) => {
      const amount = parseAmount(c.amount)
      if (!amount) return
      const date = parseDateInput(c.dateReceived)
      const year = date ? String(date.getFullYear()) : UNKNOWN_YEAR
      const region = (c.region && c.region.trim()) || UNKNOWN_REGION
      if (!REGION_ORDER.includes(region)) {
        extraRegions.add(region)
      }

      if (!yearMap.has(year)) {
        yearMap.set(year, {
          year,
          regionTotals: {},
          grandTotal: 0,
        })
      }

      const row = yearMap.get(year)!
      row.regionTotals[region] = (row.regionTotals[region] || 0) + amount
      row.grandTotal += amount

      columnTotals[region] = (columnTotals[region] || 0) + amount
      grandTotal += amount
    })

    const regions = [
      ...REGION_ORDER,
      ...Array.from(extraRegions).filter((region) => !REGION_ORDER.includes(region)).sort(),
    ]

    const rows = Array.from(yearMap.values()).sort((a, b) => {
      if (a.year === UNKNOWN_YEAR) return 1
      if (b.year === UNKNOWN_YEAR) return -1
      return Number(a.year) - Number(b.year)
    })

    return {
      rows,
      columnTotals,
      grandTotal,
      regions,
    }
  }, [cases])

  const quarterlyAmountMatrix = useMemo<{ rows: QuarterlyAmountRow[]; columnTotals: Record<string, number>; grandTotal: number; regions: string[] }>(() => {
    const quarterMap = new Map<string, QuarterlyAmountRow>()
    const columnTotals: Record<string, number> = {}
    let grandTotal = 0
    const extraRegions = new Set<string>()

    cases.forEach((c) => {
      const amount = parseAmount(c.amount)
      if (!amount) return
      const date = parseDateInput(c.dateReceived)
      if (!date) return
      
      const year = date.getFullYear()
      if (year !== selectedYear) return // Filter by selected year
      
      const quarter = Math.floor(date.getMonth() / 3) + 1
      const key = `${year}-Q${quarter}`
      const region = (c.region && c.region.trim()) || UNKNOWN_REGION
      
      if (!REGION_ORDER.includes(region)) {
        extraRegions.add(region)
      }

      if (!quarterMap.has(key)) {
        quarterMap.set(key, {
          year: String(year),
          quarter,
          quarterLabel: `Q${quarter} ${year}`,
          regionTotals: {},
          grandTotal: 0,
        })
      }

      const row = quarterMap.get(key)!
      row.regionTotals[region] = (row.regionTotals[region] || 0) + amount
      row.grandTotal += amount

      columnTotals[region] = (columnTotals[region] || 0) + amount
      grandTotal += amount
    })

    const regions = [
      ...REGION_ORDER,
      ...Array.from(extraRegions).filter((region) => !REGION_ORDER.includes(region)).sort(),
    ]

    const rows = Array.from(quarterMap.values()).sort((a, b) => {
      if (a.year !== b.year) return Number(a.year) - Number(b.year)
      return a.quarter - b.quarter
    })

    return { rows, columnTotals, grandTotal, regions }
  }, [cases, selectedYear])

  const monthlyAmountMatrix = useMemo<{ rows: MonthlyAmountRow[]; columnTotals: Record<string, number>; grandTotal: number; regions: string[] }>(() => {
    const monthMap = new Map<string, MonthlyAmountRow>()
    const columnTotals: Record<string, number> = {}
    let grandTotal = 0
    const extraRegions = new Set<string>()

    cases.forEach((c) => {
      const amount = parseAmount(c.amount)
      if (!amount) return
      const date = parseDateInput(c.dateReceived)
      if (!date) return
      
      const year = date.getFullYear()
      if (year !== selectedYear) return // Filter by selected year
      
      const month = date.getMonth() + 1
      const key = `${year}-${month}`
      const region = (c.region && c.region.trim()) || UNKNOWN_REGION
      
      if (!REGION_ORDER.includes(region)) {
        extraRegions.add(region)
      }

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          year: String(year),
          month,
          monthLabel: `${MONTH_LABELS[month - 1]} ${year}`,
          regionTotals: {},
          grandTotal: 0,
        })
      }

      const row = monthMap.get(key)!
      row.regionTotals[region] = (row.regionTotals[region] || 0) + amount
      row.grandTotal += amount

      columnTotals[region] = (columnTotals[region] || 0) + amount
      grandTotal += amount
    })

    const regions = [
      ...REGION_ORDER,
      ...Array.from(extraRegions).filter((region) => !REGION_ORDER.includes(region)).sort(),
    ]

    const rows = Array.from(monthMap.values()).sort((a, b) => {
      if (a.year !== b.year) return Number(a.year) - Number(b.year)
      return a.month - b.month
    })

    return { rows, columnTotals, grandTotal, regions }
  }, [cases, selectedYear])

  const noData = matrix.caseCount === 0
  const amountNoData = amountMatrix.rows.length === 0
  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }), [])
  const formatAmount = (value: number | undefined) => (value ? numberFormatter.format(Math.round(value)) : '')
  const formatAmountBold = (value: number) => numberFormatter.format(Math.round(value))

  return (
    <div className="px-6 py-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">Regional Case Matrix</p>
          <p className="text-xs text-slate-500">Aggregated counts by region, office, and quarter</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-slate-300 overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setMode('offices')}
              className={`px-3 py-1 transition ${mode === 'offices' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Office View
            </button>
            <button
              onClick={() => setMode('amounts')}
              className={`px-3 py-1 transition ${mode === 'amounts' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Amount View
            </button>
          </div>
          {mode === 'offices' && (
            <>
              <div className="flex rounded-full border border-slate-300 overflow-hidden text-xs font-semibold">
                <button
                  onClick={() => setOfficeViewMode('yearly')}
                  className={`px-3 py-1 transition ${officeViewMode === 'yearly' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
                >
                  Yearly
                </button>
                <button
                  onClick={() => setOfficeViewMode('quarterly')}
                  className={`px-3 py-1 transition ${officeViewMode === 'quarterly' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
                >
                  Quarterly
                </button>
                <button
                  onClick={() => setOfficeViewMode('monthly')}
                  className={`px-3 py-1 transition ${officeViewMode === 'monthly' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
                >
                  Monthly
                </button>
              </div>
              {officeViewMode !== 'yearly' && (
                <>
                  <label className="text-xs font-semibold text-slate-600" htmlFor="matrix-year-select">
                    Year
                  </label>
                  <select
                    id="matrix-year-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1 text-xs border border-slate-300 rounded-lg"
                  >
                    {yearOptions.length === 0 && (
                      <option value={selectedYear}>{selectedYear}</option>
                    )}
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div className="flex gap-3 text-xs text-slate-600">
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                  {matrix.caseCount} cases
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                  {matrix.officeCount} offices
                </span>
              </div>
            </>
          )}
          {mode === 'amounts' && (
            <>
              <div className="flex rounded-full border border-slate-300 overflow-hidden text-xs font-semibold">
                <button
                  onClick={() => setAmountViewMode('yearly')}
                  className={`px-3 py-1 transition ${amountViewMode === 'yearly' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
                >
                  Yearly
                </button>
                <button
                  onClick={() => setAmountViewMode('quarterly')}
                  className={`px-3 py-1 transition ${amountViewMode === 'quarterly' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
                >
                  Quarterly
                </button>
                <button
                  onClick={() => setAmountViewMode('monthly')}
                  className={`px-3 py-1 transition ${amountViewMode === 'monthly' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
                >
                  Monthly
                </button>
              </div>
              {amountViewMode !== 'yearly' && (
                <>
                  <label className="text-xs font-semibold text-slate-600" htmlFor="amount-year-select">
                    Year
                  </label>
                  <select
                    id="amount-year-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1 text-xs border border-slate-300 rounded-lg"
                  >
                    {yearOptions.length === 0 && (
                      <option value={selectedYear}>{selectedYear}</option>
                    )}
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div className="flex gap-3 text-xs text-slate-600">
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                  {amountViewMode === 'yearly' && `${amountMatrix.rows.length} years`}
                  {amountViewMode === 'quarterly' && `${quarterlyAmountMatrix.rows.length} quarters`}
                  {amountViewMode === 'monthly' && `${monthlyAmountMatrix.rows.length} months`}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                  {amountViewMode === 'yearly' && formatAmountBold(amountMatrix.grandTotal)}
                  {amountViewMode === 'quarterly' && formatAmountBold(quarterlyAmountMatrix.grandTotal)}
                  {amountViewMode === 'monthly' && formatAmountBold(monthlyAmountMatrix.grandTotal)}
                  {' total'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {mode === 'offices' ? (
        noData ? (
          <div className="mt-6 p-6 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl">
            No cases found{officeViewMode !== 'yearly' ? ` for ${selectedYear}` : ''}. Adjust filters or pick another year.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left py-2 px-3 font-semibold">Region / Office</th>
                  {officeViewMode === 'yearly' ? (
                    (matrix as any).availableYears?.map((year: number) => (
                      <th key={year} className="py-2 px-3 font-semibold text-center">
                        {year}
                      </th>
                    ))
                  ) : officeViewMode === 'monthly' ? (
                    MONTH_LABELS.map((label) => (
                      <th key={label} className="py-2 px-3 font-semibold text-center">
                        {label}
                      </th>
                    ))
                  ) : (
                    QUARTER_LABELS.map((label) => (
                      <th key={label} className="py-2 px-3 font-semibold text-center">
                        {label}
                      </th>
                    ))
                  )}
                  <th className="py-2 px-3 font-semibold text-center">
                    {officeViewMode === 'yearly' ? 'Total' : `${selectedYear} Total`}
                  </th>
                  <th className="py-2 px-3 font-semibold text-center">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {matrix.regions.length === 0 && (
                  <tr>
                    <td className="py-4 px-3 text-center text-slate-500" colSpan={
                      (officeViewMode === 'yearly' ? (matrix as any).availableYears?.length || 4 :
                       officeViewMode === 'monthly' ? 12 : 4) + 3
                    }>
                      No regional data for this {officeViewMode === 'yearly' ? 'period' : 'year'}
                    </td>
                  </tr>
                )}
                {matrix.regions.map((region) => (
                  <Fragment key={region.region}>
                    <tr className="bg-slate-100 font-semibold text-slate-800">
                      <td className="py-2 px-3">{region.region}</td>
                      {region.quarterTotals.map((count, idx) => (
                        <td key={idx} className="py-2 px-3 text-center">
                          {count || ''}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-center">{region.total || ''}</td>
                      <td className="py-2 px-3 text-center">{region.total || ''}</td>
                    </tr>
                    {region.rows.map((row) => (
                      <tr key={`${region.region}-${row.office}`} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 px-3 pl-6 text-slate-600">{row.office}</td>
                        {row.quarters.map((count, idx) => (
                          <td key={idx} className="py-2 px-3 text-center text-slate-700">
                            {count || ''}
                          </td>
                        ))}
                        <td className="py-2 px-3 text-center font-semibold text-slate-700">{row.total || ''}</td>
                        <td className="py-2 px-3 text-center text-slate-500">{row.total || ''}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white text-xs">
                  <td className="py-2 px-3 font-semibold">Grand Total</td>
                  {matrix.quarterTotals.map((count, idx) => (
                    <td key={idx} className="py-2 px-3 text-center font-semibold">
                      {count || ''}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-center font-bold">{matrix.grandTotal}</td>
                  <td className="py-2 px-3 text-center font-bold">{matrix.grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : amountNoData ? (
        <div className="mt-6 p-6 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl">
          No amount data available. Ensure cases have numeric amounts.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          {amountViewMode === 'yearly' && (
            <table className="min-w-full text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left py-2 px-3 font-semibold">Year</th>
                  {amountMatrix.regions.map((region) => (
                    <th key={region} className="py-2 px-3 font-semibold text-center">
                      {region}
                    </th>
                  ))}
                  <th className="py-2 px-3 font-semibold text-center">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {amountMatrix.rows.map((row) => (
                  <tr key={row.year} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 font-semibold text-slate-700">{row.year}</td>
                    {amountMatrix.regions.map((region) => (
                      <td key={region} className="py-2 px-3 text-center text-slate-600">
                        {formatAmount(row.regionTotals[region])}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-center font-semibold text-slate-700">
                      {formatAmountBold(row.grandTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white text-xs">
                  <td className="py-2 px-3 font-semibold">Grand Total</td>
                  {amountMatrix.regions.map((region) => (
                    <td key={region} className="py-2 px-3 text-center">
                      {formatAmount(amountMatrix.columnTotals[region])}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-center font-bold">
                    {formatAmountBold(amountMatrix.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {amountViewMode === 'quarterly' && (
            <table className="min-w-full text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left py-2 px-3 font-semibold">Quarter</th>
                  {quarterlyAmountMatrix.regions.map((region) => (
                    <th key={region} className="py-2 px-3 font-semibold text-center">
                      {region}
                    </th>
                  ))}
                  <th className="py-2 px-3 font-semibold text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyAmountMatrix.rows.map((row) => (
                  <tr key={row.quarterLabel} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 font-semibold text-slate-700">{row.quarterLabel}</td>
                    {quarterlyAmountMatrix.regions.map((region) => (
                      <td key={region} className="py-2 px-3 text-center text-slate-600">
                        {formatAmount(row.regionTotals[region])}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-center font-semibold text-slate-700">
                      {formatAmountBold(row.grandTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white text-xs">
                  <td className="py-2 px-3 font-semibold">Grand Total</td>
                  {quarterlyAmountMatrix.regions.map((region) => (
                    <td key={region} className="py-2 px-3 text-center">
                      {formatAmount(quarterlyAmountMatrix.columnTotals[region])}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-center font-bold">
                    {formatAmountBold(quarterlyAmountMatrix.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {amountViewMode === 'monthly' && (
            <table className="min-w-full text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left py-2 px-3 font-semibold">Month</th>
                  {monthlyAmountMatrix.regions.map((region) => (
                    <th key={region} className="py-2 px-3 font-semibold text-center">
                      {region}
                    </th>
                  ))}
                  <th className="py-2 px-3 font-semibold text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyAmountMatrix.rows.map((row) => (
                  <tr key={row.monthLabel} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 font-semibold text-slate-700">{row.monthLabel}</td>
                    {monthlyAmountMatrix.regions.map((region) => (
                      <td key={region} className="py-2 px-3 text-center text-slate-600">
                        {formatAmount(row.regionTotals[region])}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-center font-semibold text-slate-700">
                      {formatAmountBold(row.grandTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white text-xs">
                  <td className="py-2 px-3 font-semibold">Grand Total</td>
                  {monthlyAmountMatrix.regions.map((region) => (
                    <td key={region} className="py-2 px-3 text-center">
                      {formatAmount(monthlyAmountMatrix.columnTotals[region])}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-center font-bold">
                    {formatAmountBold(monthlyAmountMatrix.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
