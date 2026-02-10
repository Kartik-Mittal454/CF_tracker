/**
 * Centralized styling utilities for status and priority badges
 * Used across CaseTable, Filters, and CaseDrawer components
 */

import { Case } from './db'
import { normalizeStatus } from './caseUtils'

// Status Styling Functions

/**
 * Active button style for status filters (used in Filters.tsx)
 */
export function getStatusActiveStyle(status: string): string {
  switch (status) {
    case 'Delivered': return 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200'
    case 'Not confirmed': return 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200'
    case 'Not accommodated': return 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-200'
    case 'GP/TMT capacity': return 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
    case 'In Pipeline': return 'bg-sky-600 text-white border-sky-600 shadow-sm shadow-sky-200'
    case 'Cancelled': return 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-200'
    case 'Not doable': return 'bg-slate-600 text-white border-slate-600 shadow-sm shadow-slate-200'
    case 'Strategy capacity': return 'bg-cyan-600 text-white border-cyan-600 shadow-sm shadow-cyan-200'
    case 'Others': return 'bg-slate-700 text-white border-slate-700 shadow-sm shadow-slate-200'
    default: return 'bg-slate-700 text-white border-slate-700 shadow-sm shadow-slate-200'
  }
}

/**
 * Select/dropdown style for status (used in CaseTable.tsx)
 */
export function getStatusSelectStyle(status: Case['status']): string {
  const normalized = normalizeStatus(status) || (status || '').trim()
  switch (normalized) {
    case 'Not confirmed':
      return 'bg-blue-50 border-blue-200 text-blue-800'
    case 'Open':
    case 'In Progress':
    case 'In Pipeline':
      return 'bg-amber-50 border-amber-200 text-amber-800'
    case 'Delivered':
      return 'bg-emerald-50 border-emerald-200 text-emerald-800'
    case 'Escalated':
      return 'bg-red-50 border-red-200 text-red-800'
    case 'Cancelled':
    case 'Not doable':
    case 'Not accommodated':
      return 'bg-red-50 border-red-200 text-red-800'
    case 'Closed':
      return 'bg-slate-100 border-slate-200 text-slate-700'
    default:
      return 'bg-white border-gray-200 text-gray-700'
  }
}

/**
 * Badge style for status display (used in CaseDrawer.tsx)
 */
export function getStatusStyle(status: string): string {
  switch (status) {
    case 'Not confirmed':
    case 'Open': return 'bg-blue-50 border-blue-300 text-blue-800'
    case 'In Progress':
    case 'In Pipeline': return 'bg-yellow-50 border-yellow-300 text-yellow-800'
    case 'Delivered': return 'bg-green-50 border-green-300 text-green-800'
    case 'Escalated': return 'bg-red-50 border-red-300 text-red-800'
    case 'Cancelled':
    case 'Not accommodated':
    case 'Not doable': return 'bg-red-50 border-red-300 text-red-800'
    case 'GP/TMT capacity':
    case 'Strategy capacity': return 'bg-indigo-50 border-indigo-300 text-indigo-800'
    case 'Closed': return 'bg-gray-100 border-gray-300 text-gray-700'
    default: return 'bg-gray-50 border-gray-300 text-gray-700'
  }
}

// Priority Styling Functions

/**
 * Active button style for priority filters (used in Filters.tsx)
 */
export function getPriorityActiveStyle(priority: string): string {
  switch (priority) {
    case 'P1': return 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-200'
    case 'P1A': return 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-200'
    case 'P2': return 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200'
    case 'P3': return 'bg-lime-600 text-white border-lime-600 shadow-sm shadow-lime-200'
    case 'MCT': return 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200'
    case '10': return 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
    case '9': return 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
    case 'Software': return 'bg-teal-600 text-white border-teal-600 shadow-sm shadow-teal-200'
    case 'Others': return 'bg-slate-700 text-white border-slate-700 shadow-sm shadow-slate-200'
    default: return 'bg-slate-700 text-white border-slate-700 shadow-sm shadow-slate-200'
  }
}

/**
 * Text style for priority in table cells (used in CaseTable.tsx)
 */
export function getPriorityTextStyle(priority: string): string {
  switch (priority) {
    case 'P1':
    case 'P1A':
      return 'text-red-700 font-semibold'
    case 'P2':
      return 'text-orange-700 font-medium'
    case 'P3':
      return 'text-green-700 font-medium'
    default:
      return 'text-gray-700'
  }
}

/**
 * Badge style for priority display (used in CaseTable.tsx)
 */
export function getPriorityBadgeStyle(priority: string): string {
  switch (priority) {
    case 'P1':
    case 'P1A':
      return 'bg-red-100 text-red-700 border border-red-200'
    case 'P2':
      return 'bg-orange-100 text-orange-700 border border-orange-200'
    case 'P3':
      return 'bg-green-100 text-green-700 border border-green-200'
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200'
  }
}
