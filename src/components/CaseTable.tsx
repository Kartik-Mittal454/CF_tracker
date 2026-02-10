'use client'

import { useState, memo } from 'react'
import { Case } from '@/app/page'
import { formatDateSafe, getOverdueBy, isActiveStatus, normalizeStatus, canonicalStatuses, normalizePriority, canonicalPriorities } from '@/lib/caseUtils'
import { getStatusSelectStyle, getPriorityTextStyle, getPriorityBadgeStyle } from '@/lib/styles'

// Helper to convert Date objects to YYYY-MM-DD string format for form inputs
function toInputValue(value: string | Date | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  // value is a Date object
  return value.toISOString().split('T')[0]
}

interface CaseTableProps {
  cases: Case[]
  onRowClick: (caseItem: Case) => void
  onStatusChange: (id: string, status: string) => void
  view?: 'compact' | 'full'
  visibleColumns?: string[]
  columnFilters?: Record<string, string>
  onColumnFilterChange?: (key: string, value: string) => void
  selectable?: boolean
  selectedIds?: string[]
  onToggleSelect?: (id: string) => void
  onToggleSelectAll?: (checked: boolean) => void
  onPriorityChange?: (id: string, priorityLevel: string) => void
  onPromisedDateChange?: (id: string, promisedDateForDelivery: string) => void
  statuses?: string[]
}

function CaseTable({
  cases,
  onRowClick,
  onStatusChange,
  view = 'compact',
  visibleColumns,
  columnFilters = {},
  onColumnFilterChange,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onPriorityChange,
  onPromisedDateChange,
  statuses = canonicalStatuses,
}: CaseTableProps) {
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Overdue calculation (Excel formula: =IF(AND(PromisedDate<TODAY(), Status<>"Closed", Status<>"Delivered"), TODAY()-PromisedDate, 0))
  const compactColumns: Array<{
    key: string
    label: string
    sticky?: boolean
    minWidth?: number
    align?: 'left' | 'center' | 'right'
    filterable?: boolean
    render: (c: Case, idx: number) => React.ReactNode
  }> = [
    {
      key: '__select',
      label: '',
      sticky: true,
      minWidth: 36,
      align: 'center',
      filterable: false,
      render: (c) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(c.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect && onToggleSelect(c.id)}
          className="rounded border-slate-300"
        />
      ),
    },
    {
      key: 'sno',
      label: 'S No.',
      sticky: true,
      minWidth: 60,
      align: 'center',
      filterable: false,
      render: (_c, idx) => idx + 1,
    },
    { key: 'dateReceived', label: 'Date Received', minWidth: 120, align: 'center', filterable: true, render: (c) => formatDateSafe(c.dateReceived) },
    {
      key: 'status',
      label: 'Status',
      minWidth: 130,
      filterable: true,
      render: (c) => (
        <select
          value={c.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange(c.id, e.target.value as Case['status'])}
          disabled={c.status === 'Closed'}
          className={`text-[12px] px-2 py-1 rounded-md border ${getStatusSelectStyle(c.status)} ${c.status === 'Closed' ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      ),
    },
    { key: 'client', label: 'Client', minWidth: 160, filterable: true, render: (c) => c.client || '' },
    { key: 'requestor', label: 'Requestor', minWidth: 140, filterable: true, render: (c) => c.requestor || '' },
    { key: 'team', label: 'Team', minWidth: 120, filterable: true, render: (c) => c.team || '' },
    {
      key: 'priorityLevel',
      label: 'Priority',
      minWidth: 110,
      filterable: true,
      render: (c) =>
        onPriorityChange && c.status !== 'Closed' ? (
          <select
            value={normalizePriority(c.priorityLevel) || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const caseId = c.id
              if (!caseId) return
              onPriorityChange(caseId, e.target.value)
            }}
            className="text-[11px] text-gray-900 px-2 py-0.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={!c.id}
          >
            <option value="">Select</option>
            {canonicalPriorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          <span className={`text-[12px] px-2 py-0.5 rounded-full ${getPriorityBadgeStyle(normalizePriority(c.priorityLevel) || '')}`}>
            {normalizePriority(c.priorityLevel) || ''}
          </span>
        ),
    },
    {
      key: 'promisedDateForDelivery',
      label: 'Promised',
      minWidth: 140,
      align: 'center',
      filterable: true,
      render: (c) =>
        onPromisedDateChange && c.status !== 'Closed' ? (
          <input
            type="date"
            value={toInputValue(c.promisedDateForDelivery)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onPromisedDateChange(c.id, e.target.value)}
            className="text-[11px] text-gray-900 px-2 py-0.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        ) : (
              formatDateSafe(c.promisedDateForDelivery)
        ),
    },
            { key: 'actualDateForDelivery', label: 'Actual', minWidth: 140, align: 'center', filterable: true, render: (c) => formatDateSafe(c.actualDateForDelivery) },
    {
      key: 'overdue',
      label: 'SLA',
      minWidth: 110,
      align: 'center',
      filterable: true,
      render: (c) => {
        if (!isActiveStatus(c.status)) return <span className="text-slate-500">Completed</span>
        const overdueBy = getOverdueBy(c.promisedDateForDelivery || '', c.status)
        if (!c.promisedDateForDelivery) return <span className="text-slate-400">No date</span>
        if (overdueBy > 0) return <span className="text-red-600 font-semibold">Overdue {overdueBy}d</span>
        const promised = new Date(c.promisedDateForDelivery)
        const diff = Math.ceil((promised.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 3) return <span className="text-amber-600 font-semibold">Due {diff}d</span>
        return <span className="text-green-600 font-semibold">On track</span>
      },
    },
    {
      key: 'scopeOfRequest',
      label: 'Scope',
      minWidth: 260,
      filterable: true,
      render: (c) => (
        <span className="block max-w-[260px] truncate" title={c.scopeOfRequest}>
          {c.scopeOfRequest || ''}
        </span>
      ),
    },
  ]

  const fullColumns: Array<{
    key: string
    label: string
    sticky?: boolean
    minWidth?: number
    align?: 'left' | 'center' | 'right'
    filterable?: boolean
    render: (c: Case, idx: number) => React.ReactNode
  }> = [
    {
      key: 'sno',
      label: 'S No.',
      sticky: true,
      minWidth: 60,
      align: 'center',
      filterable: false,
      render: (_c, idx) => idx + 1,
    },
    { key: 'dateReceived', label: 'Date Received', minWidth: 120, align: 'center', filterable: true, render: (c) => formatDateSafe(c.dateReceived) },
    { key: 'team', label: 'Team', minWidth: 120, filterable: true, render: (c) => c.team || '' },
    {
      key: 'status',
      label: 'Status',
      minWidth: 120,
      filterable: true,
      render: (c) => (
        <select
          value={canonicalStatuses.includes((c.status || '').trim())
            ? (c.status || '').trim()
            : normalizeStatus(c.status) || (c.status || '').trim() || 'Not confirmed'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange(c.id, e.target.value as Case['status'])}
          className={`text-[11px] px-2 py-0.5 rounded-md border ${getStatusSelectStyle(c.status)}`}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      ),
    },
    { key: 'requestor', label: 'Requestor', minWidth: 140, filterable: true, render: (c) => c.requestor || '' },
    { key: 'npsFlag', label: 'NPS Flag', minWidth: 90, filterable: true, render: (c) => c.npsFlag || '' },
    { key: 'level', label: 'Level', minWidth: 90, filterable: true, render: (c) => c.level || '' },
    { key: 'office', label: 'Office', minWidth: 120, filterable: true, render: (c) => c.office || '' },
    { key: 'region', label: 'Region', minWidth: 110, filterable: true, render: (c) => c.region || '' },
    { key: 'client', label: 'Client', minWidth: 140, filterable: true, render: (c) => c.client || '' },
    {
      key: 'priorityLevel',
      label: 'Priority Level',
      minWidth: 120,
      filterable: true,
      render: (c) => (
        <span className={`text-[11px] ${getPriorityTextStyle(normalizePriority(c.priorityLevel) || '')}`}>{normalizePriority(c.priorityLevel) || ''}</span>
      ),
    },
    { key: 'industry', label: 'Industry', minWidth: 140, filterable: true, render: (c) => c.industry || '' },
    { key: 'bainIndustryClassification', label: 'Bain Industry Classification', minWidth: 190, filterable: true, render: (c) => c.bainIndustryClassification || '' },
    {
      key: 'scopeOfRequest',
      label: 'Scope of Request',
      minWidth: 260,
      filterable: true,
      render: (c) => (
        <span className="block max-w-[260px] truncate" title={c.scopeOfRequest}>
          {c.scopeOfRequest || ''}
        </span>
      ),
    },
    {
      key: 'deliveredRequest',
      label: 'Delivered Request',
      minWidth: 200,
      filterable: true,
      render: (c) => (
        <span className="block max-w-[200px] truncate" title={c.deliveredRequest}>
          {c.deliveredRequest || ''}
        </span>
      ),
    },
    { key: 'promisedDateForDelivery', label: 'Promised Date for Delivery', minWidth: 170, align: 'center', filterable: true, render: (c) => formatDateSafe(c.promisedDateForDelivery) },
    { key: 'actualDateForDelivery', label: 'Actual Date for Delivery', minWidth: 160, align: 'center', filterable: true, render: (c) => formatDateSafe(c.actualDateForDelivery) },
    { key: 'dateForClientMeeting', label: 'Date for Client Meeting', minWidth: 160, align: 'center', filterable: true, render: (c) => formatDateSafe(c.dateForClientMeeting) },
    { key: 'billingCaseCode', label: 'Billing Case Code', minWidth: 150, filterable: true, render: (c) => c.billingCaseCode || '' },
    { key: 'cdClient', label: 'CD/Client', minWidth: 110, filterable: true, render: (c) => c.cdClient || '' },
    { key: 'currency', label: 'Currency', minWidth: 90, filterable: true, render: (c) => c.currency || '' },
    { key: 'amount', label: 'Amount', minWidth: 100, align: 'right', filterable: true, render: (c) => c.amount || '' },
    { key: 'type', label: 'Type', minWidth: 100, filterable: true, render: (c) => c.type || '' },
    { key: 'addOnIpDelivered', label: 'Add-on IP Delivered', minWidth: 150, filterable: true, render: (c) => c.addOnIpDelivered || '' },
    { key: 'addOnsBilling', label: 'Add-ons Billing', minWidth: 130, filterable: true, render: (c) => c.addOnsBilling || '' },
    { key: 'addOnsOnly', label: 'Add-ons Only', minWidth: 120, filterable: true, render: (c) => c.addOnsOnly || '' },
    { key: 'billing', label: 'Billing', minWidth: 110, filterable: true, render: (c) => c.billing || '' },
    { key: 'additionalRequestor1', label: 'Additional Requestor 1', minWidth: 160, filterable: true, render: (c) => c.additionalRequestor1 || '' },
    { key: 'additionalRequestor1Level', label: 'Additional Requestor 1 Level', minWidth: 180, filterable: true, render: (c) => c.additionalRequestor1Level || '' },
    { key: 'additionalRequestor2', label: 'Additional Requestor 2', minWidth: 160, filterable: true, render: (c) => c.additionalRequestor2 || '' },
    { key: 'additionalRequestor2Level', label: 'Additional Requestor 2 Level', minWidth: 180, filterable: true, render: (c) => c.additionalRequestor2Level || '' },
    { key: 'postDeliveryReachouts', label: 'Post-delivery Reachouts?', minWidth: 170, filterable: true, render: (c) => c.postDeliveryReachouts || '' },
    { key: 'responseReceived', label: 'Response Received?', minWidth: 160, filterable: true, render: (c) => c.responseReceived || '' },
    { key: 'deckMaterialShared', label: 'Deck/Material Shared?', minWidth: 170, filterable: true, render: (c) => c.deckMaterialShared || '' },
    { key: 'nextSteps', label: 'Next Steps?', minWidth: 180, filterable: true, render: (c) => c.nextSteps || '' },
  ]

  const columns = view === 'full' ? fullColumns : compactColumns
  const activeColumns = visibleColumns && visibleColumns.length > 0
    ? columns.filter((col) => visibleColumns.includes(col.key) || (selectable && col.key === '__select'))
    : columns.filter((col) => selectable || col.key !== '__select')
  const isAllSelected = selectable && cases.length > 0 && selectedIds.length === cases.length

  // Track cumulative left offsets for sticky columns to avoid overlap
  const stickyOffsets: Record<string, number> = {}
  let currentLeft = 0
  activeColumns.forEach((col) => {
    if (col.sticky) {
      stickyOffsets[col.key] = currentLeft
      currentLeft += col.minWidth ?? 80
    }
  })

  // Always render the table with headers
  return (
    <div className="bg-white">
      <div className="overflow-auto max-h-[65vh]">
        <table className="w-full min-w-max text-[12px] border-collapse">
          <thead>
            <tr>
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-semibold text-gray-700 whitespace-nowrap border-b border-gray-200 bg-slate-50 sticky top-0 ${
                    col.sticky ? 'z-30 bg-slate-100' : 'z-20'
                  } ${
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                  } relative`}
                  style={{
                    ...(col.minWidth ? { minWidth: col.minWidth } : {}),
                    ...(col.sticky ? { left: stickyOffsets[col.key] } : {}),
                  }}
                >
                  {col.key === '__select' ? (
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => onToggleSelectAll && onToggleSelectAll(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                    </div>
                  ) : (
                    <>
                      <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                        <span>{col.label}</span>
                      </div>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length} className="px-3 py-10 text-center text-gray-500">
                  No requests found matching your filters.
                </td>
              </tr>
            ) : (
              cases.map((c, idx) => {
                const overdueBy = getOverdueBy(c.promisedDateForDelivery || '', c.status)
                const isOverdue = overdueBy > 0

                return (
                  <tr
                    key={c.id}
                    id={`case-row-${c.id}`}
                    onClick={() => onRowClick(c)}
                    className={`cursor-pointer transition-colors ${
                      isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    {activeColumns.map((col) => (
                      <td
                        key={`${c.id}-${col.key}`}
                        className={`px-3 py-2 border-b border-gray-100 align-top ${
                          col.sticky ? 'sticky bg-white z-10' : ''
                        } ${
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                        style={{
                          ...(col.minWidth ? { minWidth: col.minWidth } : {}),
                          ...(col.sticky ? { left: stickyOffsets[col.key] } : {}),
                        }}
                      >
                        {col.render(c, idx)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default memo(CaseTable)
