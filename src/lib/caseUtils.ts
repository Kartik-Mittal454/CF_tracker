import { format } from 'date-fns'
import { Case } from '@/lib/db'

// Excel serial (days since 1899-12-30) to Date
const excelSerialToDate = (serial: number): Date | null => {
  if (!Number.isFinite(serial)) return null
  // Excel epoch offset 25569 days between 1899-12-30 and 1970-01-01
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

// Parse various date inputs from the dataset (numbers, ISO, Date objects, or "NA")
export const parseDateInput = (value?: string | number | Date): Date | null => {
  if (value === undefined || value === null) return null
  
  // Handle Date objects directly (from Azure SQL)
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  
  if (typeof value === 'number') {
    return excelSerialToDate(value)
  }
  
  const trimmed = value.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower === 'na' || lower === 'n/a') return null
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

// Safely format a date value (string/number/Date) with a default pattern
export const formatDateSafe = (date?: string | number | Date, pattern = 'dd-MMM-yy') => {
  const parsed = parseDateInput(date as string | number | Date | undefined)
  if (!parsed) return ''
  try {
    return format(parsed, pattern)
  } catch {
    return ''
  }
}

const statusNormalizeMap: Record<string, string> = {
  'open': 'Not confirmed',
  'open ': 'Not confirmed',
  'in progress': 'In Progress',
  'in pipeline': 'In Pipeline',
  'not accomodated': 'Not accommodated',
  'not accommodated': 'Not accommodated',
  'not doable': 'Not doable',
  'not doable ': 'Not doable',
  'not confirmed': 'Not confirmed',
  'not confirmed ': 'Not confirmed',
  'cancelled': 'Cancelled',
  'canceled': 'Cancelled',
  'cancelled ': 'Cancelled',
  'closed': 'Closed',
}

const priorityNormalizeMap: Record<string, string> = {
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
  'p1a': 'P1A',
  mct: 'MCT',
  '10': '10',
  '9': '9',
  software: 'Software',
  high: 'P1',
  medium: 'P2',
  low: 'P3',
}

export const normalizeStatus = (status?: string | null): string | null => {
  if (!status) return null
  const trimmed = status.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  return statusNormalizeMap[lower] || trimmed
}

export const normalizePriority = (priority?: string | null): string | null => {
  if (!priority) return null
  const trimmed = priority.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  return priorityNormalizeMap[lower] || trimmed
}

export const canonicalStatuses = [
  'Not confirmed',
  'In Progress',
  'In Pipeline',
  'Not accommodated',
  'GP/TMT capacity',
  'Strategy capacity',
  'Cancelled',
  'Not doable',
  'Escalated',
  'Delivered',
  'Closed',
]

export const canonicalPriorities = ['P1', 'P1A', 'P2', 'P3']

const closedStatuses = ['Closed', 'Delivered', 'Cancelled', 'Not accommodated', 'Not doable', 'Not confirmed']
const closedStatusesSet = new Set(closedStatuses.map((s) => s.toLowerCase()))

export const isActiveStatus = (status?: string | null) => {
  const normalized = normalizeStatus(status)
  if (!normalized) return false
  return !closedStatusesSet.has(normalized.toLowerCase())
}

// Calculate overdue days; only counts when promised date exists and status is active
export const getOverdueBy = (promisedDate?: string | number | Date, status?: string) => {
  const promised = parseDateInput(promisedDate)
  if (!promised) return 0
  if (!isActiveStatus(status)) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - promised.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

export const columnLabelMap: Record<string, string> = {
  favorite: 'Favorite',
  pinned: 'Pinned',
  sno: 'S No.',
  dateReceived: 'Date Received',
  team: 'Team',
  status: 'Status',
  requestor: 'Requestor',
  npsFlag: 'NPS Flag',
  level: 'Level',
  office: 'Office',
  region: 'Region',
  client: 'Client',
  priorityLevel: 'Priority Level',
  industry: 'Industry',
  bainIndustryClassification: 'Bain Industry Classification',
  scopeOfRequest: 'Scope of Request',
  deliveredRequest: 'Delivered Request',
  promisedDateForDelivery: 'Promised Date for Delivery',
  actualDateForDelivery: 'Actual Date for Delivery',
  dateForClientMeeting: 'Date for Client Meeting',
  billingCaseCode: 'Billing Case Code',
  cdClient: 'CD/Client',
  currency: 'Currency',
  amount: 'Amount',
  type: 'Type',
  addOnIpDelivered: 'Add-on IP Delivered',
  addOnsBilling: 'Add-ons Billing',
  addOnsOnly: 'Add-ons Only',
  billing: 'Billing',
  additionalRequestor1: 'Additional Requestor 1',
  additionalRequestor1Level: 'Additional Requestor 1 Level',
  additionalRequestor2: 'Additional Requestor 2',
  additionalRequestor2Level: 'Additional Requestor 2 Level',
  postDeliveryReachouts: 'Post-delivery Reachouts?',
  responseReceived: 'Response Received?',
  deckMaterialShared: 'Deck/Material Shared?',
  nextSteps: 'Next Steps?',
  overdue: 'Overdue By',
}

export const fullExportKeys = [
  'sno',
  'dateReceived',
  'team',
  'status',
  'requestor',
  'npsFlag',
  'level',
  'office',
  'region',
  'client',
  'priorityLevel',
  'industry',
  'bainIndustryClassification',
  'scopeOfRequest',
  'deliveredRequest',
  'promisedDateForDelivery',
  'actualDateForDelivery',
  'dateForClientMeeting',
  'billingCaseCode',
  'cdClient',
  'currency',
  'amount',
  'type',
  'addOnIpDelivered',
  'addOnsBilling',
  'addOnsOnly',
  'billing',
  'additionalRequestor1',
  'additionalRequestor1Level',
  'additionalRequestor2',
  'additionalRequestor2Level',
  'postDeliveryReachouts',
  'responseReceived',
  'deckMaterialShared',
  'nextSteps',
]

export const buildExportRow = (c: Case, key: string, idx: number) => {
  switch (key) {
    case 'sno':
      return String(idx + 1)
    case 'overdue':
      return String(getOverdueBy(c.promisedDateForDelivery, c.status) || '')
    case 'dateReceived':
    case 'promisedDateForDelivery':
    case 'actualDateForDelivery':
    case 'dateForClientMeeting':
      return formatDateSafe((c as unknown as Record<string, string | undefined>)[key] as string | undefined)
    default:
      return String((c as unknown as Record<string, string | undefined>)[key] ?? '')
  }
}
