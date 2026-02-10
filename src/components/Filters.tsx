'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { getStatusActiveStyle, getPriorityActiveStyle } from '@/lib/styles'

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'All',
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, query])

  const displayLabel = value || placeholder

  return (
    <div ref={containerRef} className="relative text-[11px]">
      <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide block mb-1">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-2 py-1 border border-gray-300 rounded-md bg-white text-gray-900 text-left text-[11px] hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {displayLabel}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search"
            className="w-full px-2 py-1 mb-2 text-[11px] text-gray-900 placeholder-gray-400 border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="max-h-52 overflow-auto divide-y divide-slate-100">
            <div
              className="px-2 py-1 hover:bg-slate-100 cursor-pointer text-[11px] text-gray-900"
              onClick={() => {
                onChange('')
                setOpen(false)
                setQuery('')
              }}
            >
              {placeholder}
            </div>
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-slate-400">No matches</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt}
                  className={`px-2 py-1 hover:bg-slate-100 cursor-pointer text-[11px] text-gray-900 ${
                    value === opt ? 'bg-slate-50 font-semibold' : ''
                  }`}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  {opt}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface FiltersProps {
  filters: {
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
  onFilterChange: (filters: FiltersProps['filters']) => void
  teams: string[]
  clients: string[]
  requestors: string[]
  offices?: string[]
  regions?: string[]
  industries?: string[]
  types?: string[]
  statuses?: string[]
  priorities?: string[]
  extraStatuses?: string[]
  extraPriorities?: string[]
}

export default function Filters({
  filters,
  onFilterChange,
  teams,
  clients,
  requestors,
  offices = [],
  regions = [],
  industries = [],
  types = [],
  statuses = [],
  priorities = [],
  extraStatuses = [],
  extraPriorities = [],
}: FiltersProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [showStatusOverflow, setShowStatusOverflow] = useState(false)
  const [showPriorityOverflow, setShowPriorityOverflow] = useState(false)
  const dueBuckets = [
    { value: '', label: 'All' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'this-week', label: 'Due This Week' },
    { value: 'next-week', label: 'Due Next Week' },
    { value: 'no-due-date', label: 'No Due Date' },
  ]

  // Always show all filter fields
  const visible = new Set(['dateReceivedFrom', 'dateReceivedTo', 'dueBucket', 'team', 'requestor', 'client', 'office', 'region', 'industry', 'type'])
  const hasAny = (...keys: string[]) => keys.some((k) => visible.has(k))

  const toggleStatus = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status]
    onFilterChange({ ...filters, status: newStatuses })
  }

  const togglePriority = (priority: string) => {
    const newPriorities = filters.priority.includes(priority)
      ? filters.priority.filter((p) => p !== priority)
      : [...filters.priority, priority]
    onFilterChange({ ...filters, priority: newPriorities })
  }

  const clearFilters = () => {
    onFilterChange({
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
    })
    setShowMoreFilters(false)
    setShowStatusOverflow(false)
    setShowPriorityOverflow(false)
  }

  useEffect(() => {
    if (extraStatuses.length === 0 && showStatusOverflow) {
      setShowStatusOverflow(false)
    }
  }, [extraStatuses.length, showStatusOverflow])

  useEffect(() => {
    if (extraPriorities.length === 0 && showPriorityOverflow) {
      setShowPriorityOverflow(false)
    }
  }, [extraPriorities.length, showPriorityOverflow])

  const statusOverflowActive = filters.status.includes('Others') || filters.status.some((s) => extraStatuses.includes(s))
  const priorityOverflowActive = filters.priority.includes('Others') || filters.priority.some((p) => extraPriorities.includes(p))

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.team ||
    filters.client ||
    filters.requestor ||
    filters.office ||
    filters.region ||
    filters.industry ||
    filters.type ||
    filters.dueBucket ||
    filters.dateReceivedFrom ||
    filters.dateReceivedTo

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Filters</span>
        <button
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          className={`px-2 py-1 text-[11px] border rounded-full transition-colors ${
            hasActiveFilters
              ? 'text-gray-600 border-gray-300 hover:bg-gray-50'
              : 'text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed'
          }`}
        >
          Clear all
        </button>
      </div>

      {/* Status & Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Status</span>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${
                  filters.status.includes(s)
                    ? getStatusActiveStyle(s)
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
            {extraStatuses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowStatusOverflow((prev) => !prev)}
                className={`px-2 py-1 rounded-full text-[11px] border transition-colors flex items-center gap-1 ${
                  statusOverflowActive || showStatusOverflow
                    ? 'bg-slate-700 text-white border-slate-700 shadow-sm shadow-slate-200'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Others
                <span className="text-[10px] bg-slate-900/40 text-white/80 px-1.5 py-0.5 rounded-full">{extraStatuses.length}</span>
                <span className={`text-[9px] transition-transform ${showStatusOverflow ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>
            )}
          </div>
          {showStatusOverflow && extraStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-gray-200 mt-1">
              {extraStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${
                    filters.status.includes(status)
                      ? getStatusActiveStyle(status)
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Priority</span>
          <div className="flex flex-wrap gap-2">
            {priorities.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePriority(p)}
                className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${
                  filters.priority.includes(p)
                    ? getPriorityActiveStyle(p)
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
            {extraPriorities.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPriorityOverflow((prev) => !prev)}
                className={`px-2 py-1 rounded-full text-[11px] border transition-colors flex items-center gap-1 ${
                  priorityOverflowActive || showPriorityOverflow
                    ? 'bg-slate-700 text-white border-slate-700 shadow-sm shadow-slate-200'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Others
                <span className="text-[10px] bg-slate-900/40 text-white/80 px-1.5 py-0.5 rounded-full">{extraPriorities.length}</span>
                <span className={`text-[9px] transition-transform ${showPriorityOverflow ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>
            )}
          </div>
          {showPriorityOverflow && extraPriorities.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-gray-200 mt-1">
              {extraPriorities.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => togglePriority(priority)}
                  className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${
                    filters.priority.includes(priority)
                      ? getPriorityActiveStyle(priority)
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dates & Due */}
      {hasAny('dateReceivedFrom', 'dateReceivedTo', 'dueBucket') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {hasAny('dateReceivedFrom', 'dateReceivedTo') && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Received</span>
              <div className="flex flex-wrap items-center gap-2">
                {visible.has('dateReceivedFrom') && (
                  <input
                    type="date"
                    value={filters.dateReceivedFrom}
                    onChange={(e) => onFilterChange({ ...filters, dateReceivedFrom: e.target.value })}
                    className="px-2 py-1 text-[11px] text-gray-900 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
                {visible.has('dateReceivedFrom') && visible.has('dateReceivedTo') && (
                  <span className="text-[11px] text-gray-400">to</span>
                )}
                {visible.has('dateReceivedTo') && (
                  <input
                    type="date"
                    value={filters.dateReceivedTo}
                    onChange={(e) => onFilterChange({ ...filters, dateReceivedTo: e.target.value })}
                    className="px-2 py-1 text-[11px] text-gray-900 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            </div>
          )}

          {visible.has('dueBucket') && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Due</span>
              <select
                value={filters.dueBucket}
                onChange={(e) => onFilterChange({ ...filters, dueBucket: e.target.value })}
                className="px-2 py-1 text-[11px] text-gray-900 border border-gray-300 rounded-md bg-white w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {dueBuckets.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* People & Client */}
      {hasAny('team', 'requestor', 'client') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {visible.has('team') && (
            <SearchableSelect
              label="Team"
              value={filters.team}
              options={teams}
              onChange={(val) => onFilterChange({ ...filters, team: val })}
            />
          )}
          {visible.has('requestor') && (
            <SearchableSelect
              label="Requestor"
              value={filters.requestor}
              options={requestors}
              onChange={(val) => onFilterChange({ ...filters, requestor: val })}
            />
          )}
          {visible.has('client') && (
            <SearchableSelect
              label="Client"
              value={filters.client}
              options={clients}
              onChange={(val) => onFilterChange({ ...filters, client: val })}
            />
          )}
        </div>
      )}

      {/* Location & Industry */}
      {hasAny('office', 'region', 'industry', 'type') && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {visible.has('office') && (
            <SearchableSelect
              label="Office"
              value={filters.office}
              options={offices}
              onChange={(val) => onFilterChange({ ...filters, office: val })}
            />
          )}
          {visible.has('region') && (
            <SearchableSelect
              label="Region"
              value={filters.region}
              options={regions}
              onChange={(val) => onFilterChange({ ...filters, region: val })}
            />
          )}
          {visible.has('industry') && (
            <SearchableSelect
              label="Industry"
              value={filters.industry}
              options={industries}
              onChange={(val) => onFilterChange({ ...filters, industry: val })}
            />
          )}
          {visible.has('type') && (
            <SearchableSelect
              label="Type"
              value={filters.type}
              options={types}
              onChange={(val) => onFilterChange({ ...filters, type: val })}
            />
          )}
        </div>
      )}
    </div>
  )
}
