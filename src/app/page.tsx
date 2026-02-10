'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { formatDateSafe, getOverdueBy, columnLabelMap, fullExportKeys, buildExportRow, isActiveStatus, parseDateInput, normalizeStatus, canonicalStatuses, normalizePriority, canonicalPriorities } from '@/lib/caseUtils'
import * as XLSX from 'xlsx'
import CaseForm from '@/components/CaseForm'
import CaseTable from '@/components/CaseTable'
import CaseDrawer from '@/components/CaseDrawer'
import DashboardStrip from '@/components/DashboardStrip'
import Filters from '@/components/Filters'
import CaseMatrix from '@/components/CaseMatrix'
import BillingManager from '@/components/BillingManager'
import TeamManager from '@/components/TeamManager'
import { Case, fetchAllCases, addCase, modifyCase, removeCase, importCasesBulk } from '@/app/actions'

// Re-export Case type for components
export type { Case } from '@/app/actions'

const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index])
const primaryStatusFilters = ['Not confirmed', 'In Progress', 'In Pipeline', 'Delivered', 'Cancelled', 'Closed']
const isNpsCase = (caseItem: Case) => Boolean((caseItem.npsFlag || '').trim())

export default function Home() {
  type FiltersState = {
    status: string[]
    priority: string[]
    team: string
    client: string
    requestor: string
    office: string
    region: string
    industry: string
    type: string
    dueBucket: string
    dateReceivedFrom: string
    dateReceivedTo: string
  }

  const [cases, setCases] = useState<Case[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingCase, setEditingCase] = useState<Case | null>(null)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [formMode, setFormMode] = useState<'quick' | 'full'>('full')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tableView, setTableView] = useState<'compact' | 'full'>('compact')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [isFiltering, setIsFiltering] = useState(false)
  const [viewPreset, setViewPreset] = useState<'manager' | 'allData' | 'delivery' | 'nps' | 'custom' | 'region' | 'billing' | 'teams'>('manager')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [myTeam, setMyTeam] = useState('')
  const [savedViews, setSavedViews] = useState<
    Array<{ name: string; filters: FiltersState; search: string; viewPreset: typeof viewPreset; managerColumns: string[] }>
  >([])
  const [customColumns, setCustomColumns] = useState<string[]>([])
  const [viewName, setViewName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; caseCode: string } | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [displayLimit, setDisplayLimit] = useState(100)
  const [showFloatingSearch, setShowFloatingSearch] = useState(false)
  // Data load states
  const searchRef = useRef<HTMLInputElement>(null)
  const floatingSearchRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const realtimeRefreshTimer = useRef<number | null>(null)
  const skeletonRows = useMemo(() => Array.from({ length: 10 }), [])
  const managerDefaultColumns = [

    'sno',
    'dateReceived',
    'status',
    'client',
    'requestor',
    'team',
    'priorityLevel',
    'promisedDateForDelivery',
    'actualDateForDelivery',
    'overdue',
  ]
  const [managerColumns, setManagerColumns] = useState<string[]>(managerDefaultColumns)
  const emptyFilters: FiltersState = {
    status: [],
    priority: [],
    team: '',
    client: '',
    requestor: '',
    office: '',
    region: '',
    industry: '',
    type: '',
    dueBucket: '',
    dateReceivedFrom: '',
    dateReceivedTo: '',
  }

  const [filters, setFilters] = useState<FiltersState>(emptyFilters)
  useEffect(() => {
    const loadAll = async () => {
      let usedCache = false
      let cacheFresh = false

      // 1) Try local cache (no spinner)
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('cases_light_cache')
          if (stored) {
            const parsed = JSON.parse(stored)
            const fresh = Date.now() - parsed.timestamp < 300000
            if (fresh && Array.isArray(parsed.data)) {
              setCases(parsed.data)
              setError(null)
              usedCache = true
              cacheFresh = true
              setLastRefreshed(new Date(parsed.timestamp))
            } else {
              localStorage.removeItem('cases_light_cache')
            }
          }
        } catch (e) {
          console.warn('Failed to read cached cases:', e)
        }
      }

      // 2) Background refresh; skip if cache is fresh
      if (!cacheFresh) {
        if (!usedCache) setIsLoading(true)
        try {
          const all = await fetchAllCases(true)
          setCases(all)
          setError(null)
          setLastRefreshed(new Date())
        } catch (error) {
          console.error('❌ Error loading cases from Azure SQL:', error)
          setError('Failed to load data from Azure SQL. Please try again.')
        } finally {
          if (!usedCache) setIsLoading(false)
        }
      }
    }

    loadAll()
  }, [])

  // Background refresh to pick up other users' changes
  useEffect(() => {
    let timer: number | undefined
    let stopped = false

    const refresh = async () => {
      try {
        const latest = await fetchAllCases(true)
        if (stopped) return
        setCases(latest)
        setLastRefreshed(new Date())
      } catch (e) {
        // Silent failure; avoid interrupting UI
        console.warn('Background refresh failed', e)
      }
    }

    // Refresh when tab becomes visible
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Refresh periodically (every 3 minutes) in the background
    timer = window.setInterval(refresh, 180000) // every 3 minutes

    return () => {
      stopped = true
      if (timer) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Note: Azure SQL doesn't have realtime subscriptions like Supabase
  // Periodic refresh (every 3 minutes) handles updates instead
  // Real-time updates can be added later with SignalR or polling if needed

  // Track online/offline status for UI hints
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('savedViews')
    if (saved) {
      try {
        setSavedViews(JSON.parse(saved))
      } catch {
        setSavedViews([])
      }
    }

    const custom = localStorage.getItem('customColumns')
    if (custom) {
      try {
        setCustomColumns(JSON.parse(custom))
      } catch {
        setCustomColumns([])
      }
    }

    // Restore view from share link if present
    try {
      const params = new URLSearchParams(window.location.search)
      const encoded = params.get('v')
      if (encoded) {
        const decoded = JSON.parse(atob(encoded)) as {
          filters: FiltersState
          search: string
          viewPreset: typeof viewPreset
          managerColumns: string[]
          customColumns: string[]
        }
        setFilters(decoded.filters)
        setSearch(decoded.search)
        setViewPreset(decoded.viewPreset)
        setTableView(decoded.viewPreset === 'allData' ? 'full' : 'compact')
        setManagerColumns(decoded.managerColumns.includes('sno') ? decoded.managerColumns : ['sno', ...decoded.managerColumns])
        setCustomColumns(decoded.customColumns || [])
      }
    } catch {
      // Ignore malformed share links
    }
  }, [])

  // Debounce search to improve performance
  useEffect(() => {
    setIsFiltering(true)
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setIsFiltering(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Scroll detection for floating search bar
  useEffect(() => {
    const handleScroll = () => {
      // Show floating search when scrolled past 300px
      const scrollY = window.scrollY
      setShowFloatingSearch(scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-dismiss success and error messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000)
      return () => clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    localStorage.setItem('customColumns', JSON.stringify(customColumns))
  }, [customColumns])

  // Optimized handlers
  const handleColumnFilterChange = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleRowClick = useCallback((caseItem: Case) => {
    setSelectedCase(caseItem)
  }, [])

  // Unique values for filters (derived from data like Excel)
  const teams = useMemo(() => [...new Set(cases.map((c) => c.team).filter(Boolean))].sort() as string[], [cases])
  const clients = useMemo(() => [...new Set(cases.map((c) => c.client).filter(Boolean))].sort() as string[], [cases])
  const requestors = useMemo(() => [...new Set(cases.map((c) => c.requestor).filter(Boolean))].sort() as string[], [cases])
  const offices = useMemo(() => [...new Set(cases.map((c) => c.office).filter((o): o is string => Boolean(o)))].sort(), [cases])
  const regions = useMemo(() => [...new Set(cases.map((c) => c.region).filter((r): r is string => Boolean(r)))].sort(), [cases])
  const industries = useMemo(() => [...new Set(cases.map((c) => c.industry).filter((i): i is string => Boolean(i)))].sort(), [cases])
  const types = useMemo(() => [...new Set(cases.map((c) => c.type).filter((t): t is string => Boolean(t)))].sort(), [cases])
  const { base: statusFilterOptions, overflow: statusOverflowOptions } = useMemo(() => {
    const primarySet = new Set(primaryStatusFilters.map((s) => s.toLowerCase()))
    const overflowSet = new Set<string>()

    cases.forEach((c) => {
      const normalized = normalizeStatus(c.status)
      if (!normalized) return
      const trimmed = normalized.trim()
      if (!trimmed) return
      const lower = trimmed.toLowerCase()
      if (!primarySet.has(lower)) {
        overflowSet.add(trimmed)
      }
    })

    return { base: primaryStatusFilters, overflow: Array.from(overflowSet).sort() }
  }, [cases])

  const { base: priorityFilterOptions, overflow: priorityOverflowOptions } = useMemo(() => {
    const allowed = new Set(canonicalPriorities.map((p) => p.toLowerCase()))
    const overflowSet = new Set<string>()

    cases.forEach((c) => {
      const normalized = normalizePriority(c.priorityLevel)
      if (!normalized) return
      const trimmed = normalized.trim()
      if (!trimmed) return
      const lower = trimmed.toLowerCase()
      if (!allowed.has(lower)) {
        overflowSet.add(trimmed)
      }
    })

    return { base: canonicalPriorities, overflow: Array.from(overflowSet).sort() }
  }, [cases])

  const statusSelectOptions = useMemo(
    () => [...new Set([...statusFilterOptions, ...statusOverflowOptions])],
    [statusFilterOptions, statusOverflowOptions]
  )

  useEffect(() => {
    setFilters((prev) => {
      if (!prev.status.includes('Others')) return prev
      const sanitized = prev.status.filter((s) => s !== 'Others')
      const merged = Array.from(new Set([...sanitized, ...statusOverflowOptions]))
      if (arraysEqual(merged, prev.status)) return prev
      return { ...prev, status: merged }
    })
  }, [statusOverflowOptions])

  useEffect(() => {
    setFilters((prev) => {
      if (!prev.priority.includes('Others')) return prev
      const sanitized = prev.priority.filter((p) => p !== 'Others')
      const merged = Array.from(new Set([...sanitized, ...priorityOverflowOptions]))
      if (arraysEqual(merged, prev.priority)) return prev
      return { ...prev, priority: merged }
    })
  }, [priorityOverflowOptions])
  const caseNumbers = useMemo(() => cases.map((c) => c.billingCaseCode).filter(Boolean) as string[], [cases])

  // Apply filters + search (Excel-style filtering)
  const filteredCases = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const searchLower = debouncedSearch.trim().toLowerCase()

    const getColumnValue = (c: Case, key: string) => {
      switch (key) {
        case 'dateReceived':
          return `${c.dateReceived || ''} ${formatDateSafe(c.dateReceived)}`
        case 'status':
          return c.status || ''
        case 'client':
          return c.client || ''
        case 'requestor':
          return c.requestor || ''
        case 'team':
          return c.team || ''
        case 'priorityLevel':
          return c.priorityLevel || ''
        case 'promisedDateForDelivery':
          return `${c.promisedDateForDelivery || ''} ${formatDateSafe(c.promisedDateForDelivery)}`
        case 'actualDateForDelivery':
          return `${c.actualDateForDelivery || ''} ${formatDateSafe(c.actualDateForDelivery)}`
        case 'overdue': {
          const overdueBy = getOverdueBy(c.promisedDateForDelivery, c.status)
          return overdueBy > 0 ? `overdue ${overdueBy}` : '0'
        }
        case 'scopeOfRequest':
          return c.scopeOfRequest || ''
        case 'npsFlag':
          return c.npsFlag || ''
        case 'level':
          return c.level || ''
        case 'office':
          return c.office || ''
        case 'region':
          return c.region || ''
        case 'industry':
          return c.industry || ''
        case 'bainIndustryClassification':
          return c.bainIndustryClassification || ''
        case 'deliveredRequest':
          return c.deliveredRequest || ''
        case 'dateForClientMeeting':
          return `${c.dateForClientMeeting || ''} ${formatDateSafe(c.dateForClientMeeting)}`
        case 'billingCaseCode':
          return c.billingCaseCode || ''
        case 'cdClient':
          return c.cdClient || ''
        case 'currency':
          return c.currency || ''
        case 'amount':
          return c.amount || ''
        case 'type':
          return c.type || ''
        case 'addOnIpDelivered':
          return c.addOnIpDelivered || ''
        case 'addOnsBilling':
          return c.addOnsBilling || ''
        case 'addOnsOnly':
          return c.addOnsOnly || ''
        case 'billing':
          return c.billing || ''
        case 'additionalRequestor1':
          return c.additionalRequestor1 || ''
        case 'additionalRequestor1Level':
          return c.additionalRequestor1Level || ''
        case 'additionalRequestor2':
          return c.additionalRequestor2 || ''
        case 'additionalRequestor2Level':
          return c.additionalRequestor2Level || ''
        case 'postDeliveryReachouts':
          return c.postDeliveryReachouts || ''
        case 'responseReceived':
          return c.responseReceived || ''
        case 'deckMaterialShared':
          return c.deckMaterialShared || ''
        case 'nextSteps':
          return c.nextSteps || ''
        default:
          return ''
      }
    }

    const results = cases.filter((c) => {
      const normalizedStatus = normalizeStatus(c.status)
      if (filters.status.length > 0) {
        const allowed = new Set(canonicalStatuses.map((s) => s.toLowerCase()))
        const matchesDirect = normalizedStatus ? filters.status.includes(normalizedStatus) : false
        if (!matchesDirect) {
          const wantsOthers = filters.status.includes('Others')
          const isCanonical = normalizedStatus ? allowed.has(normalizedStatus.toLowerCase()) : false
          if (!(wantsOthers && !isCanonical)) return false
        }
      }
      const normalizedPriority = normalizePriority(c.priorityLevel)
      if (filters.priority.length > 0) {
        const allowedPriorities = new Set(canonicalPriorities.map((p) => p.toLowerCase()))
        const matchesDirectPriority = normalizedPriority ? filters.priority.includes(normalizedPriority) : false
        if (!matchesDirectPriority) {
          const wantsOthersPriority = filters.priority.includes('Others')
          const isCanonicalPriority = normalizedPriority ? allowedPriorities.has(normalizedPriority.toLowerCase()) : false
          if (!(wantsOthersPriority && !isCanonicalPriority)) return false
        }
      }
      if (filters.team && c.team !== filters.team) return false
      if (filters.client && c.client !== filters.client) return false
      if (filters.requestor && c.requestor !== filters.requestor) return false
      if (filters.office && c.office !== filters.office) return false
      if (filters.region && c.region !== filters.region) return false
      if (filters.industry && c.industry !== filters.industry) return false
      if (filters.type && c.type !== filters.type) return false

      if (filters.dateReceivedFrom || filters.dateReceivedTo) {
        const received = parseDateInput(c.dateReceived)
        if (filters.dateReceivedFrom) {
          const from = parseDateInput(filters.dateReceivedFrom)
          if (from && (!received || received < from)) return false
        }
        if (filters.dateReceivedTo) {
          const to = parseDateInput(filters.dateReceivedTo)
          if (to && (!received || received > to)) return false
        }
      }

      if (filters.dueBucket) {
        if (filters.dueBucket === 'no-due-date') {
          if (c.promisedDateForDelivery) return false
        } else {
          // Show items with due dates (regardless of status for date-based filters)
          if (!c.promisedDateForDelivery) return false
          const promised = parseDateInput(c.promisedDateForDelivery)
          if (!promised) return false
          const twoDaysFromNow = new Date(today)
          twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)
          const weekFromNow = new Date(today)
          weekFromNow.setDate(weekFromNow.getDate() + 7)
          const twoWeeksFromNow = new Date(today)
          twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14)

          switch (filters.dueBucket) {
            case 'overdue':
              if (!isActiveStatus(c.status)) return false
              if (promised >= today) return false
              break
            case 'due-soon':
              if (!isActiveStatus(c.status)) return false
              if (promised < today || promised > twoDaysFromNow) return false
              break
            case 'this-week':
              if (!isActiveStatus(c.status)) return false
              if (promised < today || promised > weekFromNow) return false
              break
            case 'next-week':
              if (!isActiveStatus(c.status)) return false
              if (promised <= weekFromNow || promised > twoWeeksFromNow) return false
              break
          }
        }
      }

      if (searchLower) {
        const haystack = [
          c.billingCaseCode,
          c.client,
          c.requestor,
          c.team,
          c.scopeOfRequest,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(searchLower)) return false
      }

      const activeColumnFilters = Object.entries(columnFilters).filter(([, v]) => v.trim())
      if (activeColumnFilters.length > 0) {
        for (const [key, value] of activeColumnFilters) {
          const hay = getColumnValue(c, key).toLowerCase()
          if (!hay.includes(value.toLowerCase())) return false
        }
      }

      return true
    })

    // Sort by date received in descending order (latest first)
    results.sort((a, b) => {
      const dateA = parseDateInput(a.dateReceived)?.getTime() || 0
      const dateB = parseDateInput(b.dateReceived)?.getTime() || 0
      return dateB - dateA // Descending order
    })

    return results
  }, [cases, filters, debouncedSearch, columnFilters])

  const alerts = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const twoDaysFromNow = new Date(today)
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)

    const dueSoon = filteredCases.filter((c) => {
      if (!c.promisedDateForDelivery) return false
      if (!isActiveStatus(c.status)) return false
      const due = parseDateInput(c.promisedDateForDelivery)
      if (!due) return false
      return due >= today && due <= twoDaysFromNow
    })

    const overdue = filteredCases.filter((c) => {
      if (!c.promisedDateForDelivery) return false
      if (!isActiveStatus(c.status)) return false
      const due = parseDateInput(c.promisedDateForDelivery)
      if (!due) return false
      return due < today
    })

    return {
      dueSoon,
      overdue,
    }
  }, [filteredCases])

  const scopedCases = useMemo(() => {
    if (viewPreset !== 'nps') return filteredCases
    return filteredCases.filter(isNpsCase)
  }, [filteredCases, viewPreset])

  // Display capped records to keep UI smooth; can load more on demand
  const displayedCases = useMemo(() => scopedCases.slice(0, displayLimit), [scopedCases, displayLimit])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setFormMode('quick')
        setShowForm(true)
        setEditingCase(null)
      }
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportCurrentView()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filteredCases])

  const applyPreset = (preset: 'overdue' | 'high' | 'due-soon' | 'this-week' | 'next-week' | 'no-due') => {
    switch (preset) {
      case 'overdue':
        setFilters((f) => ({ ...f, dueBucket: f.dueBucket === 'overdue' ? '' : 'overdue' }))
        break
      case 'high':
        setFilters((f) => ({
          ...f,
          priority: f.priority.includes('P1') ? f.priority.filter((p) => p !== 'P1') : [...f.priority, 'P1'],
        }))
        break
      case 'due-soon':
        setFilters((f) => ({ ...f, dueBucket: f.dueBucket === 'due-soon' ? '' : 'due-soon' }))
        break
      case 'this-week':
        setFilters((f) => ({ ...f, dueBucket: f.dueBucket === 'this-week' ? '' : 'this-week' }))
        break
      case 'next-week':
        setFilters((f) => ({ ...f, dueBucket: f.dueBucket === 'next-week' ? '' : 'next-week' }))
        break
      case 'no-due':
        setFilters((f) => ({ ...f, dueBucket: f.dueBucket === 'no-due-date' ? '' : 'no-due-date' }))
        break
    }
  }

  const toggleManagerColumn = (key: string) => {
    if (key === 'sno') return
    setManagerColumns((cols) =>
      cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key]
    )
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? scopedCases.map((c) => c.id) : [])
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const managerColumnOptions = [
    { key: 'dateReceived', label: 'Date Received' },
    { key: 'status', label: 'Status' },
    { key: 'client', label: 'Client' },
    { key: 'requestor', label: 'Requestor' },
    { key: 'team', label: 'Team' },
    { key: 'priorityLevel', label: 'Priority Level' },
    { key: 'promisedDateForDelivery', label: 'Promised Date' },
    { key: 'actualDateForDelivery', label: 'Actual Date' },
    { key: 'overdue', label: 'SLA / Overdue' },
  ]

  const allColumnOptions = useMemo(
    () => Object.entries(columnLabelMap)
      .filter(([key]) => key !== 'sno')
      .map(([key, label]) => ({ key, label })),
    []
  )

  // Determine if a column has any data across the current filtered set
  const columnHasValue = (c: Case, key: string) => {
    switch (key) {
      case 'sno':
        return true
      case 'overdue':
        return Boolean(c.promisedDateForDelivery)
      case 'dateReceived':
        return Boolean(c.dateReceived)
      case 'status':
        return Boolean(c.status)
      case 'client':
        return Boolean(c.client)
      case 'requestor':
        return Boolean(c.requestor)
      case 'team':
        return Boolean(c.team)
      case 'priorityLevel':
        return Boolean(c.priorityLevel)
      case 'promisedDateForDelivery':
        return Boolean(c.promisedDateForDelivery)
      case 'actualDateForDelivery':
        return Boolean(c.actualDateForDelivery)
      case 'scopeOfRequest':
        return Boolean(c.scopeOfRequest)
      case 'deliveredRequest':
        return Boolean(c.deliveredRequest)
      case 'dateForClientMeeting':
        return Boolean(c.dateForClientMeeting)
      case 'level':
        return Boolean(c.level)
      case 'office':
        return Boolean(c.office)
      case 'region':
        return Boolean(c.region)
      case 'industry':
        return Boolean(c.industry)
      case 'bainIndustryClassification':
        return Boolean(c.bainIndustryClassification)
      case 'billingCaseCode':
        return Boolean(c.billingCaseCode)
      case 'cdClient':
        return Boolean(c.cdClient)
      case 'currency':
        return Boolean(c.currency)
      case 'amount':
        return Boolean(c.amount)
      case 'type':
        return Boolean(c.type)
      case 'addOnIpDelivered':
        return Boolean(c.addOnIpDelivered)
      case 'addOnsBilling':
        return Boolean(c.addOnsBilling)
      case 'addOnsOnly':
        return Boolean(c.addOnsOnly)
      case 'billing':
        return Boolean(c.billing)
      case 'additionalRequestor1':
        return Boolean(c.additionalRequestor1)
      case 'additionalRequestor1Level':
        return Boolean(c.additionalRequestor1Level)
      case 'additionalRequestor2':
        return Boolean(c.additionalRequestor2)
      case 'additionalRequestor2Level':
        return Boolean(c.additionalRequestor2Level)
      case 'postDeliveryReachouts':
        return Boolean(c.postDeliveryReachouts)
      case 'responseReceived':
        return Boolean(c.responseReceived)
      case 'deckMaterialShared':
        return Boolean(c.deckMaterialShared)
      case 'nextSteps':
        return Boolean(c.nextSteps)
      case 'npsFlag':
        return Boolean(c.npsFlag)
      default:
        return false
    }
  }

  const presetColumns: Record<typeof viewPreset, string[] | null> = {
    manager: managerColumns,
    allData: null,
    delivery: [
      'sno',
      'dateReceived',
      'client',
      'scopeOfRequest',
      'deliveredRequest',
      'promisedDateForDelivery',
      'actualDateForDelivery',
      'dateForClientMeeting',
      'status',
      'priorityLevel',
    ],
    nps: [
      'sno',
      'dateReceived',
      'requestor',
      'client',
      'npsFlag',
      'status',
      'priorityLevel',
      'team',
    ],
    region: [
      'sno',
      'dateReceived',
      'client',
      'office',
      'region',
      'team',
      'status',
      'priorityLevel',
      'promisedDateForDelivery',
    ],
    billing: null,
    teams: null,
    custom: customColumns,
  }

  // Hide entirely empty columns for non-allData views
  const columnHasDataMap = useMemo(() => {
    const keys = new Set<string>()
    managerColumns.forEach((k) => keys.add(k))
    presetColumns.delivery?.forEach((k) => keys.add(k))
    presetColumns.nps?.forEach((k) => keys.add(k))
    presetColumns.region?.forEach((k) => keys.add(k))
    if (viewPreset === 'custom') customColumns.forEach((k) => keys.add(k))

    const map: Record<string, boolean> = {}
    const dataSource = displayedCases
    keys.forEach((k) => {
      map[k] = dataSource.some((c) => columnHasValue(c, k))
    })
    return map
  }, [viewPreset, displayedCases, managerColumns, presetColumns.delivery, presetColumns.nps, presetColumns.region, customColumns])

  const visibleColumnsForView = useMemo(() => {
    if (viewPreset === 'allData') return undefined
    if (viewPreset === 'custom') {
      const base = ['sno', ...customColumns]
      const pruned = base.filter((k) => columnHasDataMap[k])
      return pruned.length > 1 ? pruned : base
    }
    const base = presetColumns[viewPreset] || managerColumns
    if (!base) return undefined
    const pruned = base.filter((k) => columnHasDataMap[k])
    return pruned.length > 0 ? pruned : base
  }, [viewPreset, presetColumns, managerColumns, columnHasDataMap, customColumns])

  const addActivity = (item: Case, message: string): Case => {
    const entry = { date: new Date().toISOString(), message }
    return {
      ...item,
      activityLog: [entry, ...(item.activityLog || [])].slice(0, 50),
    }
  }

  const applySavedView = (viewName: string) => {
    const view = savedViews.find((v) => v.name === viewName)
    if (!view) return
    setFilters(view.filters)
    setSearch(view.search)
    setViewPreset(view.viewPreset)
    setTableView(view.viewPreset === 'allData' ? 'full' : 'compact')
    setManagerColumns(view.managerColumns.includes('sno') ? view.managerColumns : ['sno', ...view.managerColumns])
  }

  const saveCurrentView = (name: string) => {
    if (!name.trim()) return
    const next = savedViews.filter((v) => v.name !== name).concat({
      name,
      filters,
      search,
      viewPreset,
      managerColumns,
    })
    setSavedViews(next)
    localStorage.setItem('savedViews', JSON.stringify(next))
  }

  const handlePriorityChange = useCallback(async (id: string, priorityLevel: Case['priorityLevel']) => {
    try {
      const result = await modifyCase(id, { priorityLevel })
      if (result) {
        setCases(prev => prev.map((c) => (c.id === id ? result : c)))
        setSelectedCase(prev => prev?.id === id ? result : prev)
      }
    } catch (error) {
      console.error('Error updating priority:', error)
      setError('Failed to update priority')
    }
  }, [])

  const handlePromisedDateChange = useCallback(async (id: string, promisedDateForDelivery: string) => {
    try {
      const result = await modifyCase(id, { promisedDateForDelivery })
      if (result) {
        setCases(prev => prev.map((c) => (c.id === id ? result : c)))
        setSelectedCase(prev => prev?.id === id ? result : prev)
      }
    } catch (error) {
      console.error('Error updating promised date:', error)
      setError('Failed to update promised date')
    }
  }, [])

  const handleAddComment = useCallback(async (id: string, text: string) => {
    if (!text.trim()) return
    setCases(prev => {
      const caseToUpdate = prev.find((c) => c.id === id)
      if (!caseToUpdate) return prev

      const comment = { date: new Date().toISOString(), text: text.trim() }
      const updatedComments = [comment, ...(caseToUpdate.comments || [])]

      modifyCase(id, { comments: updatedComments }).then(result => {
        if (result) {
          setCases(p => p.map((c) => (c.id === id ? result : c)))
          setSelectedCase(s => s?.id === id ? result : s)
        }
      }).catch(error => {
        console.error('Error adding comment:', error)
        setError('Failed to add comment')
      })
      
      return prev
    })
  }, [])

  const handleBulkUpdate = async (updates: Partial<Pick<Case, 'status' | 'team' | 'priorityLevel'>>) => {
    if (selectedIds.length === 0) return
    
    try {
      // Update all selected cases
      const updatePromises = selectedIds.map(async (id) => {
        const caseToUpdate = cases.find((c) => c.id === id)
        if (!caseToUpdate) return null

        const caseUpdates: Partial<Case> = { ...updates }
        
        // Auto-fill Actual Date when Delivered/Closed
        if (updates.status && (updates.status === 'Delivered' || updates.status === 'Closed') && !caseToUpdate.actualDateForDelivery) {
          caseUpdates.actualDateForDelivery = new Date().toISOString().split('T')[0]
        }

        return modifyCase(id, caseUpdates)
      })

      const results = await Promise.all(updatePromises)
      const successfulUpdates = results.filter((r): r is Case => r !== null)

      // Update local state with successful updates
      setCases(cases.map((c) => {
        const updated = successfulUpdates.find((u) => u.id === c.id)
        return updated || c
      }))

      setSelectedIds([])
    } catch (error) {
      console.error('Error bulk updating cases:', error)
      alert('Failed to update some cases')
    }
  }

  // Add case
  const handleAddCase = async (newCase: Omit<Case, 'id'>) => {
    setIsLoading(true)
    setError(null)
    try {
      const created = await addCase(newCase)
      if (created) {
        setCases([...cases, created])
        setShowForm(false)
        setSuccessMessage('Case created successfully')
      } else {
        setError('Failed to create case. Please try again.')
      }
    } catch (error) {
      console.error('Error creating case:', error)
      setError('Failed to create case. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Edit case
  const handleEditCase = useCallback(async (updated: Case) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await modifyCase(updated.id, updated)
      if (result) {
        setCases(prev => prev.map((c) => (c.id === updated.id ? result : c)))
        setSelectedCase(result)
        setEditingCase(null)
        setShowForm(false)
        setSuccessMessage('Case updated successfully')
      } else {
        setError('Failed to update case. Please try again.')
      }
    } catch (error) {
      console.error('Error updating case:', error)
      setError('Failed to update case. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Delete (with confirmation)
  const handleDeleteCase = useCallback((id: string) => {
    setCases(prev => {
      const caseToDelete = prev.find(c => c.id === id)
      if (!caseToDelete) return prev
      
      // Show confirmation dialog
      setDeleteConfirm({ 
        id, 
        caseCode: caseToDelete.billingCaseCode || caseToDelete.client || 'this case'
      })
      return prev
    })
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return
    
    setIsLoading(true)
    setError(null)
    try {
      const success = await removeCase(deleteConfirm.id)
      if (success) {
        setCases(prev => prev.filter((c) => c.id !== deleteConfirm.id))
        setSelectedCase(prev => prev?.id === deleteConfirm.id ? null : prev)
        setDeleteConfirm(null)
        setSuccessMessage('Case deleted successfully')
      } else {
        setError('Failed to delete case. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting case:', error)
      setError('Failed to delete case. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [deleteConfirm])

  // Inline status change
  const handleStatusChange = useCallback(async (id: string, status: Case['status']) => {
    setCases(prev => {
      const caseToUpdate = prev.find((c) => c.id === id)
      if (!caseToUpdate) return prev

      const updates: Partial<Case> = { status }
      
      // Auto-fill Actual Date when Delivered/Closed
      if ((status === 'Delivered' || status === 'Closed') && !caseToUpdate.actualDateForDelivery) {
        updates.actualDateForDelivery = new Date().toISOString().split('T')[0]
      }

      setIsLoading(true)
      setError(null)
      
      modifyCase(id, updates).then(result => {
        if (result) {
          setCases(p => p.map((c) => (c.id === id ? result : c)))
          setSelectedCase(s => s?.id === id ? result : s)
        } else {
          setError('Failed to update status. Please try again.')
        }
      }).catch(error => {
        console.error('Error updating case status:', error)
        setError('Failed to update status. Please check your connection and try again.')
      }).finally(() => {
        setIsLoading(false)
      })
      
      return prev
    })
  }, [])

  const getColumnValue = (c: Case, key: string, idx: number) => {
    return buildExportRow(c, key, idx)
  }

  const handleExportCurrentView = () => {
    const keys = viewPreset === 'allData'
      ? fullExportKeys
      : viewPreset === 'custom'
        ? ['sno', ...customColumns]
        : presetColumns[viewPreset] || managerColumns

    if (viewPreset === 'custom' && customColumns.length === 0) {
      alert('Select at least one column in Custom view before exporting.')
      return
    }

    const headers = keys.map((k) => columnLabelMap[k] || k)
    // Export all scoped cases (view-aware), not just displayed 100
    const data = scopedCases.map((c, idx) =>
      keys.reduce((row, k) => {
        row[columnLabelMap[k] || k] = getColumnValue(c, k, idx)
        return row
      }, {} as Record<string, string>)
    )

    const ws = XLSX.utils.json_to_sheet(data, { header: headers })
    
    // Set column widths
    const colWidths = headers.map(() => ({ wch: 20 }))
    ws['!cols'] = colWidths
    
    // Style header row
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1'
      if (!ws[address]) continue
      ws[address].s = {
        font: { bold: true, sz: 12 },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${viewPreset} View`)
    XLSX.writeFile(wb, `request_tracker_${viewPreset}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleShareView = () => {
    try {
      const payload = {
        filters,
        search,
        viewPreset,
        managerColumns,
        customColumns,
      }
      const encoded = btoa(JSON.stringify(payload))
      const url = `${window.location.origin}${window.location.pathname}?v=${encodeURIComponent(encoded)}`
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(url)
        alert('Link copied: share to load this exact view')
      } else {
        alert(url)
      }
    } catch (err) {
      console.error('Share view failed', err)
      alert('Could not create share link')
    }
  }

  const handleExportSummary = () => {
    // Export summary for ALL filtered cases
    const total = filteredCases.length
    const statusCounts = filteredCases.reduce<Record<string, number>>((acc, c) => {
      const status = c.status || 'Unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})
    const teamCounts = filteredCases.reduce<Record<string, number>>((acc, c) => {
      const team = c.team || 'Unknown'
      acc[team] = (acc[team] || 0) + 1
      return acc
    }, {})

    const wb = XLSX.utils.book_new()

    // Overview sheet
    const overviewData = [
      { Metric: 'Total Cases', Value: total },
      { Metric: 'Due Soon', Value: alerts.dueSoon.length },
    ]
    const overviewWs = XLSX.utils.json_to_sheet(overviewData)
    overviewWs['!cols'] = [{ wch: 20 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview')

    // Status breakdown sheet
    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      Status: status,
      Count: count,
      Percentage: `${((count / total) * 100).toFixed(1)}%`
    }))
    const statusWs = XLSX.utils.json_to_sheet(statusData)
    statusWs['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, statusWs, 'Status Breakdown')

    // Team breakdown sheet
    const teamData = Object.entries(teamCounts).map(([team, count]) => ({
      Team: team,
      Count: count,
      Percentage: `${((count / total) * 100).toFixed(1)}%`
    }))
    const teamWs = XLSX.utils.json_to_sheet(teamData)
    teamWs['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, teamWs, 'Team Breakdown')

    XLSX.writeFile(wb, `request_tracker_summary_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleSendReminder = (item: Case) => {
    const promised = item.promisedDateForDelivery || 'N/A'
    const text = `Reminder: ${item.client} | ${item.scopeOfRequest}\nStatus: ${item.status}\nPromised: ${promised}\nCase: ${item.billingCaseCode}`
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
      alert('Reminder copied to clipboard')
    } else {
      alert(text)
    }
  }

  // Export Full Excel Requests (all headers in exact Excel order)
  const handleExportFullRequests = () => {
    const data = cases.map((c, idx) => ({
      'S No.': idx + 1,
      'Date Received': formatDateSafe(c.dateReceived),
      'Team': c.team || '',
      'Status': c.status || '',
      'Requestor': c.requestor || '',
      'NPS Flag': c.npsFlag || '',
      'Level': c.level || '',
      'Office': c.office || '',
      'Region': c.region || '',
      'Client': c.client || '',
      'Priority Level': c.priorityLevel || '',
      'Industry': c.industry || '',
      'Bain Industry Classification': c.bainIndustryClassification || '',
      'Scope of Request': c.scopeOfRequest || '',
      'Delivered Request': c.deliveredRequest || '',
      'Promised Date for Delivery': formatDateSafe(c.promisedDateForDelivery),
      'Actual Date for Delivery': formatDateSafe(c.actualDateForDelivery),
      'Date for Client Meeting': formatDateSafe(c.dateForClientMeeting),
      'Billing Case Code': c.billingCaseCode || '',
      'CD/Client': c.cdClient || '',
      'Currency': c.currency || '',
      'Amount': c.amount || '',
      'Type': c.type || '',
      'Add-on IP Delivered': c.addOnIpDelivered || '',
      'Add-ons Billing': c.addOnsBilling || '',
      'Add-ons Only': c.addOnsOnly || '',
      'Billing': c.billing || '',
      'Additional Requestor 1': c.additionalRequestor1 || '',
      'Additional Requestor 1 Level': c.additionalRequestor1Level || '',
      'Additional Requestor 2': c.additionalRequestor2 || '',
      'Additional Requestor 2 Level': c.additionalRequestor2Level || '',
      'Post-delivery Reachouts?': c.postDeliveryReachouts || '',
      'Response Received?': c.responseReceived || '',
      'Deck/Material Shared?': c.deckMaterialShared || '',
      'Next Steps?': c.nextSteps || '',
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map((key) => {
      const maxLength = Math.max(
        key.length,
        ...data.map(row => String(row[key as keyof typeof row] || '').length)
      )
      return { wch: Math.min(maxLength + 2, 50) }
    })
    ws['!cols'] = colWidths
    
    // Apply freeze panes (freeze first row)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'All Requests')
    XLSX.writeFile(wb, `request_tracker_full_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Import cases from Excel file
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = event.target?.result
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)

          // Map Excel columns to Case fields
          const importedCases: Omit<Case, 'id'>[] = jsonData.map((row: any) => ({
            billingCaseCode: row['S.No'] || row['S No.'] || row['Billing Case Code'] || '',
            dateReceived: row['Date Received'] ? parseDateInput(row['Date Received']) || undefined : undefined,
            client: row['Client'] || '',
            cdClient: row['CD/Client'] || 'CD',
            team: row['Team'] || '',
            requestor: row['Requestor'] || '',
            scopeOfRequest: row['Scope of Request'] || '',
            status: normalizeStatus(row['Status']) || 'Not confirmed',
            priorityLevel: normalizePriority(row['Priority Level']) || 'P2',
            promisedDateForDelivery: row['Promised Date for Delivery'] ? parseDateInput(row['Promised Date for Delivery']) || undefined : undefined,
            actualDateForDelivery: row['Actual Date for Delivery'] ? parseDateInput(row['Actual Date for Delivery']) || undefined : undefined,
            npsFlag: row['NPS Flag'] || '',
            level: row['Level'] || '',
            office: row['Office'] || '',
            region: row['Region'] || '',
            industry: row['Industry'] || '',
            bainIndustryClassification: row['Bain Industry Classification'] || '',
            deliveredRequest: row['Delivered Request'] || '',
            dateForClientMeeting: row['Date for Client Meeting'] ? parseDateInput(row['Date for Client Meeting']) || undefined : undefined,
            currency: row['Currency'] || 'USD',
            amount: row['Amount'] || '',
            type: row['Type'] || '',
            addOnIpDelivered: row['Add-on IP Delivered'] || '',
            addOnsBilling: row['Add-ons Billing'] || '',
            addOnsOnly: row['Add-ons Only'] || '',
            billing: row['Billing'] || '',
            additionalRequestor1: row['Additional Requestor 1'] || '',
            additionalRequestor1Level: row['Additional Requestor 1 Level'] || '',
            additionalRequestor2: row['Additional Requestor 2'] || '',
            additionalRequestor2Level: row['Additional Requestor 2 Level'] || '',
            postDeliveryReachouts: row['Post-delivery Reachouts?'] || '',
            responseReceived: row['Response Received?'] || '',
            deckMaterialShared: row['Deck/Material Shared?'] || '',
            nextSteps: row['Next Steps?'] || '',
          }))

          // Bulk import
          const created = await importCasesBulk(importedCases)
          if (created && created.length > 0) {
            setCases([...cases, ...created])
            setSuccessMessage(`Successfully imported ${created.length} cases`)
            // Reset file input
            e.target.value = ''
          } else {
            setError('Failed to import cases. Please check your file format.')
          }
        } catch (err) {
          console.error('Error parsing file:', err)
          setError('Failed to parse file. Please ensure it\'s a valid Excel file with the correct format.')
        } finally {
          setIsLoading(false)
        }
      }
      reader.readAsBinaryString(file)
    } catch (err) {
      console.error('Error reading file:', err)
      setError('Failed to read file. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-6 py-4 rounded-lg shadow-2xl animate-in slide-in-from-top duration-300 flex items-center gap-3 max-w-md">
          <span className="text-2xl">✓</span>
          <span className="flex-1 font-medium">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-white/80 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-4 rounded-lg shadow-2xl animate-in slide-in-from-top duration-300 flex items-center gap-3 max-w-md">
          <span className="text-2xl">⚠</span>
          <span className="flex-1 font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-white/80 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-2xl">🗑️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Case?</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Are you sure you want to delete <strong>{deleteConfirm.caseCode}</strong>?
                  <br />
                  This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Search Bar - appears when scrolled */}
      {showFloatingSearch && viewPreset !== 'region' && viewPreset !== 'billing' && viewPreset !== 'teams' && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-lg animate-in slide-in-from-top duration-200">
          <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-4">
            <div className="flex-1 max-w-md relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                ref={floatingSearchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quick search..."
                className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-blue-700">{displayedCases.length}</span> / {scopedCases.length} shown
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              ↑ Back to Top
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 border-2 border-slate-200">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900">Loading data from Azure SQL...</p>
              <p className="text-sm text-slate-600 mt-1">Please wait while we fetch your cases</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
            ⚠️ {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {/* Header */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-8 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 bg-clip-text text-transparent mb-2">Request Tracker</h1>
              <p className="text-sm text-slate-600 font-medium">Enterprise case management system with advanced analytics</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportSummary}
                title="Export summary statistics (totals, status breakdown, team breakdown)"
                className="px-4 py-2.5 bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-300 text-sm font-medium text-slate-700 rounded-xl hover:from-slate-200 hover:to-slate-100 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                📈 Export Summary
              </button>
              <button
                onClick={handleExportFullRequests}
                title="Export all requests with all fields (full database export)"
                className="px-4 py-2.5 bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-300 text-sm font-medium text-slate-700 rounded-xl hover:from-slate-200 hover:to-slate-100 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                💾 Export All Data
              </button>
              <button
                onClick={() => document.getElementById('import-file-input')?.click()}
                title="Import cases from Excel file"
                disabled={isLoading}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-100 to-emerald-50 border border-emerald-300 text-sm font-medium text-emerald-700 rounded-xl hover:from-emerald-200 hover:to-emerald-100 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📥 Import Excel
              </button>
              <input
                id="import-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                onClick={() => { setFormMode('quick'); setShowForm(true); setEditingCase(null) }}
                className="px-4 py-2.5 bg-white border-2 border-blue-200 text-sm font-semibold text-blue-700 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                ⚡ Quick Add
              </button>
              <button
                onClick={() => { setFormMode('full'); setShowForm(true); setEditingCase(null) }}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300"
              >
                ✨ Add Request
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[280px]">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Search</label>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by case code, client, requestor, team, or scope..."
                className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
              />
            </div>
            <div className="text-sm text-slate-600 font-medium bg-slate-100 px-4 py-2 rounded-xl flex items-center gap-3">
              <span className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {lastRefreshed && (
                <span className="text-[11px] text-slate-500">Last refreshed {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              )}
              {isFiltering ? (
                <span className="text-slate-500">🔄 Filtering...</span>
              ) : (
                <>
                  Showing <span className="font-bold text-blue-700">{displayedCases.length}</span> of {scopedCases.length} filtered
                  <span className="text-slate-500">({cases.length} total)</span>
                  {scopedCases.length > displayedCases.length && (
                    <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Capped for speed – load more below</span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Quick Filters</span>
            <button
              onClick={() => applyPreset('due-soon')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border-2 transition-all duration-200 ${
                filters.dueBucket === 'due-soon'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-700 shadow-lg'
                  : 'border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 shadow-sm'
              }`}
            >
              ⚠️ Due Soon (2 days)
            </button>
            <button
              onClick={() => applyPreset('this-week')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border-2 transition-all duration-200 ${
                filters.dueBucket === 'this-week'
                  ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white border-slate-900 shadow-lg'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm'
              }`}
            >
              📅 Due This Week
            </button>
            <button
              onClick={() => applyPreset('next-week')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border-2 transition-all duration-200 ${
                filters.dueBucket === 'next-week'
                  ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white border-slate-900 shadow-lg'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm'
              }`}
            >
              📆 Due Next Week
            </button>
            <button
              onClick={() => applyPreset('no-due')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border-2 transition-all duration-200 ${
                filters.dueBucket === 'no-due-date'
                  ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white border-slate-900 shadow-lg'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm'
              }`}
            >
              ⏳ No Due Date
            </button>
            <button
              onClick={() => {
                setFilters(emptyFilters)
                setColumnFilters({})
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-sm"
            >
              🗑️ Clear All
            </button>
          </div>
        </div>

        {/* KPI Dashboard */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((k) => (
              <div key={k} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="h-4 w-24 bg-slate-200 rounded mb-3"></div>
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <DashboardStrip cases={filteredCases} />
        )}

        {/* Alerts */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-base font-bold text-slate-900">🔔 Alerts & Notifications</p>
              <p className="text-xs text-slate-600 mt-1">Based on current filters and view</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border-2 border-red-200 font-semibold shadow-sm">⏰ Overdue: {alerts.overdue.length}</span>
              <span className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-2 border-amber-200 font-semibold shadow-sm">⚠️ Due Soon: {alerts.dueSoon.length}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <AlertList
              title="Overdue"
              items={alerts.overdue}
              onSelect={(c) => {
                setSelectedCase(c)
                const row = document.getElementById(`case-row-${c.id}`)
                if (row) {
                  row.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  row.classList.add('ring-2', 'ring-blue-400', 'shadow-lg')
                  setTimeout(() => row.classList.remove('ring-2', 'ring-blue-400', 'shadow-lg'), 1500)
                } else {
                  tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            />
            <AlertList
              title="Due Soon"
              items={alerts.dueSoon}
              onSelect={(c) => {
                setSelectedCase(c)
                const row = document.getElementById(`case-row-${c.id}`)
                if (row) {
                  row.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  row.classList.add('ring-2', 'ring-blue-400', 'shadow-lg')
                  setTimeout(() => row.classList.remove('ring-2', 'ring-blue-400', 'shadow-lg'), 1500)
                } else {
                  tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            />
          </div>
        </div>

        {/* Filters */}
        <Filters
          filters={filters}
          onFilterChange={setFilters}
          teams={teams}
          clients={clients}
          requestors={requestors}
          offices={offices}
          regions={regions}
          industries={industries}
          types={types}
          statuses={statusFilterOptions}
          extraStatuses={statusOverflowOptions}
          priorities={priorityFilterOptions}
          extraPriorities={priorityOverflowOptions}
        />

        {/* Table View (primary interaction) */}
        <div ref={tableRef} className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/50">
          <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-900">📋 Requests</p>
              <p className="text-xs text-slate-600 mt-1">Click a row to view full details</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Views</span>
              <div className="flex rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
                <button
                  onClick={() => { setViewPreset('manager'); setTableView('compact') }}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${viewPreset === 'manager' ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Manager
                </button>
                <button
                  onClick={() => { setViewPreset('allData'); setTableView('full') }}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${viewPreset === 'allData' ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  All Data
                </button>
                <button
                  onClick={() => { setViewPreset('delivery'); setTableView('full') }}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${viewPreset === 'delivery' ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Delivery
                </button>
                <button
                  onClick={() => { setViewPreset('nps'); setTableView('full') }}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${viewPreset === 'nps' ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  NPS
                </button>
                <button
                  onClick={() => { setViewPreset('region'); setTableView('full') }}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${viewPreset === 'region' ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Region
                </button>
                <button
                  onClick={() => { setViewPreset('billing'); setTableView('full') }}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${viewPreset === 'billing' ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  💰 Billing
                </button>
                <button
                  onClick={() => { setViewPreset('teams'); setTableView('full') }}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${viewPreset === 'teams' ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  👥 Teams
                </button>
                <button
                  onClick={() => { setViewPreset('custom'); setTableView('full') }}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${viewPreset === 'custom' ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Custom
                </button>
              </div>

              <button
                onClick={handleExportCurrentView}
                title="Export currently filtered/viewed data with selected columns"
                className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-green-200 hover:shadow-xl"
              >
                📊 Export View
              </button>
              <button
                onClick={handleShareView}
                title="Copy a link that restores this view (filters, columns, preset)"
                className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-xl hover:from-slate-800 hover:to-black transition-all duration-200 shadow-lg shadow-slate-200 hover:shadow-xl"
              >
                🔗 Share View
              </button>

              {viewPreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => {
                      const val = e.target.value
                      if (!val) return
                      if (!customColumns.includes(val)) setCustomColumns([...customColumns, val])
                      e.currentTarget.value = ''
                    }}
                    defaultValue=""
                    className="px-3 py-1 text-[11px] border border-slate-300 rounded-lg text-slate-600 bg-white"
                  >
                    <option value="">Add column…</option>
                    {allColumnOptions
                      .filter((opt) => !customColumns.includes(opt.key))
                      .map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                  </select>
                  {customColumns.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-w-[320px]">
                      {customColumns.map((k) => {
                        const label = allColumnOptions.find((o) => o.key === k)?.label || k
                        return (
                          <span key={k} className="px-2 py-1 text-[11px] bg-slate-100 border border-slate-200 rounded-full flex items-center gap-1">
                            {label}
                            <button
                              onClick={() => setCustomColumns(customColumns.filter((x) => x !== k))}
                              className="text-slate-500 hover:text-slate-700"
                              aria-label={`Remove ${label}`}
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {viewPreset === 'manager' && (
                <div className="relative">
                  <button
                    onClick={() => setShowColumnPicker((v) => !v)}
                    className="px-3 py-1 text-[11px] border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                  >
                    Columns
                  </button>
                  {showColumnPicker && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-30">
                      <p className="text-[11px] text-slate-500 mb-2">Show columns</p>
                      <div className="grid grid-cols-2 gap-2">
                        {managerColumnOptions.map((col) => (
                          <label key={col.key} className="flex items-center gap-2 text-[11px] text-slate-700">
                            <input
                              type="checkbox"
                              checked={managerColumns.includes(col.key)}
                              onChange={() => toggleManagerColumn(col.key)}
                              className="rounded border-slate-300"
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setManagerColumns(managerDefaultColumns)}
                          className="px-2 py-1 text-[11px] border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => setShowColumnPicker(false)}
                          className="px-2 py-1 text-[11px] bg-slate-900 text-white rounded-lg"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {scopedCases.length > displayedCases.length && (
            <div className="px-6 pb-3 text-[12px] text-slate-600 flex items-center gap-3">
              <span>Rendering first {displayedCases.length} of {scopedCases.length} for smoother scrolling.</span>
              <button
                onClick={() => setDisplayLimit((n) => Math.min(n + 300, scopedCases.length))}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
              >
                Load 300 more
              </button>
              {displayLimit < scopedCases.length && (
                <button
                  onClick={() => setDisplayLimit(scopedCases.length)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-200 transition"
                >
                  Show all (may be slower)
                </button>
              )}
            </div>
          )}
          {viewPreset === 'region' ? (
            <CaseMatrix cases={filteredCases} />
          ) : viewPreset === 'billing' ? (
            <BillingManager cases={cases} />
          ) : viewPreset === 'teams' ? (
            <TeamManager cases={cases} />
          ) : viewPreset === 'custom' && customColumns.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">
              No columns selected for Custom view. Use "Add column…" above to build your sheet.
            </div>
          ) : isLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 animate-pulse">
              <div className="flex justify-between items-center mb-4">
                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                <div className="h-8 w-24 bg-slate-200 rounded"></div>
              </div>
              <div className="overflow-hidden border border-slate-100 rounded-xl">
                <div className="grid grid-cols-8 gap-2 px-4 py-3 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded"></div>
                </div>
                {skeletonRows.map((_, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-8 gap-2 px-4 py-3 border-t border-slate-100 text-xs text-slate-500"
                  >
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <CaseTable
              cases={displayedCases}
              onRowClick={handleRowClick}
              onStatusChange={handleStatusChange}
              view={tableView}
              visibleColumns={viewPreset === 'custom' ? ['sno', ...customColumns] : visibleColumnsForView}
              columnFilters={columnFilters}
              onColumnFilterChange={handleColumnFilterChange}
              onPromisedDateChange={handlePromisedDateChange}
              statuses={statusSelectOptions}
            />
          )}
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-40 flex items-start justify-center pt-8 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl my-4">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
              <h2 className="font-bold text-gray-800">
                {isLoading && '⏳ '}{editingCase ? 'Edit Request' : 'Add New Request'}
              </h2>
              <button 
                onClick={() => { setShowForm(false); setEditingCase(null) }} 
                className="text-gray-400 hover:text-gray-600 text-xl"
                disabled={isLoading}
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <CaseForm
                onSubmit={(data) => {
                  if ('id' in data) {
                    handleEditCase(data as Case)
                  } else {
                    handleAddCase(data)
                  }
                }}
                existingCaseNumbers={caseNumbers}
                existingClients={clients}
                existingTeams={teams}
                existingRequestors={requestors}
                existingCases={cases}
                editingCase={editingCase}
                mode={formMode}
                onCancel={() => { setShowForm(false); setEditingCase(null) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Side Drawer (row click) */}
      {selectedCase && !showForm && (
        <CaseDrawer
          caseItem={selectedCase}
          onClose={() => setSelectedCase(null)}
          onStatusChange={handleStatusChange}
          onEdit={() => { setFormMode('full'); setEditingCase(selectedCase); setShowForm(true) }}
          onDelete={handleDeleteCase}
          onAddComment={handleAddComment}
          onSendReminder={handleSendReminder}
        />
      )}
    </main>
  )
}

function AlertList({ title, items, onSelect }: { title: string; items: Case[]; onSelect?: (c: Case) => void }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
      <p className="text-[11px] font-semibold text-slate-700 mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-400">No items</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 5).map((c) => (
            <li
              key={c.id}
              className="text-[11px] text-slate-600 cursor-pointer hover:text-blue-700 hover:underline"
              onClick={() => onSelect?.(c)}
            >
              <span className="font-medium text-slate-800">{c.client}</span> — {c.scopeOfRequest || c.billingCaseCode}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

