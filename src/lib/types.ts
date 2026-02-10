// Shared types for Case Management System
// These can be safely imported by both client and server code

export interface Case {
  // IDs
  id: string
  billingCaseCode?: string
  cdClient?: string

  // Core
  dateReceived?: string | Date
  team?: string
  status: string

  // Requestor & Geography
  requestor?: string
  npsFlag?: string
  level?: string
  office?: string
  region?: string

  // Client & Classification
  client?: string
  priorityLevel?: string
  industry?: string
  bainIndustryClassification?: string

  // Request Content & Delivery
  scopeOfRequest?: string
  deliveredRequest?: string
  promisedDateForDelivery?: string | Date
  actualDateForDelivery?: string | Date
  dateForClientMeeting?: string | Date

  // Commercial / Billing
  currency?: string
  amount?: string
  type?: string
  addOnIpDelivered?: string
  addOnsBilling?: string
  addOnsOnly?: string
  billing?: string

  // Additional Requestors
  additionalRequestor1?: string
  additionalRequestor1Level?: string
  additionalRequestor2?: string
  additionalRequestor2Level?: string

  // Post-delivery
  postDeliveryReachouts?: string
  responseReceived?: string
  deckMaterialShared?: string
  nextSteps?: string

  // Manager utilities
  comments?: Array<{ date: string; text: string }>
  activityLog?: Array<{ date: string; message: string }>
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface BillingAdjustment {
  id: string
  month: number // 1-12
  year: number
  type: string // Full, Short, Standard, Very Short, Others, New IP, Pre-CD, Add-ons
  amount: number // negative for deductions, positive for additions
  reason: string
  created_at?: string | Date
  updated_at?: string | Date
}
