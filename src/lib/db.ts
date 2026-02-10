import { executeQuery, executeQuerySingle, executeNonQuery, sql } from './azuresql'

export interface Case {
  // IDs
  id: string
  billingCaseCode?: string
  cdClient?: string

  // Core
  dateReceived?: string | Date
  team?: string
  status: string  // Allow any status value from Supabase

  // Requestor & Geography
  requestor?: string
  npsFlag?: string
  level?: string
  office?: string
  region?: string

  // Client & Classification
  client?: string
  priorityLevel?: string  // Allow any priority value from Supabase
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

// Database row type (snake_case)
interface CaseRow {
  id: string
  billing_case_code: string | null
  cd_client?: string | null
  date_received: Date | null
  team: string | null
  status: string | null
  requestor: string | null
  nps_flag?: string | null
  level?: string | null
  office?: string | null
  region?: string | null
  client: string | null
  priority_level: string | null
  industry?: string | null
  bain_industry_classification?: string | null
  scope_of_request: string | null
  delivered_request?: string | null
  promised_date_for_delivery?: Date | null
  actual_date_for_delivery?: Date | null
  date_for_client_meeting?: Date | null
  currency?: string | null
  amount?: string | null
  type?: string | null
  add_on_ip_delivered?: string | null
  add_ons_billing?: string | null
  add_ons_only?: string | null
  billing?: string | null
  additional_requestor1?: string | null
  additional_requestor1_level?: string | null
  additional_requestor2?: string | null
  additional_requestor2_level?: string | null
  post_delivery_reachouts?: string | null
  response_received?: string | null
  deck_material_shared?: string | null
  next_steps?: string | null
  comments?: any
  activity_log?: any
  created_at?: Date | null
  updated_at?: Date | null
}

// Convert camelCase to snake_case for database
// Also converts Date objects to strings for Azure SQL
function toSnakeCase(data: Partial<Case>): Partial<CaseRow> {
  const convertDate = (val: any): Date | undefined => {
    if (val instanceof Date) return val
    if (typeof val === 'string' && val) return new Date(val)
    return undefined
  }

  return {
    billing_case_code: data.billingCaseCode,
    cd_client: data.cdClient,
    date_received: data.dateReceived ? convertDate(data.dateReceived) : undefined,
    team: data.team,
    status: data.status,
    requestor: data.requestor,
    nps_flag: data.npsFlag,
    level: data.level,
    office: data.office,
    region: data.region,
    client: data.client,
    priority_level: data.priorityLevel,
    industry: data.industry,
    bain_industry_classification: data.bainIndustryClassification,
    scope_of_request: data.scopeOfRequest,
    delivered_request: data.deliveredRequest,
    promised_date_for_delivery: data.promisedDateForDelivery ? convertDate(data.promisedDateForDelivery) : undefined,
    actual_date_for_delivery: data.actualDateForDelivery ? convertDate(data.actualDateForDelivery) : undefined,
    date_for_client_meeting: data.dateForClientMeeting ? convertDate(data.dateForClientMeeting) : undefined,
    currency: data.currency,
    amount: data.amount,
    type: data.type,
    add_on_ip_delivered: data.addOnIpDelivered,
    add_ons_billing: data.addOnsBilling,
    add_ons_only: data.addOnsOnly,
    billing: data.billing,
    additional_requestor1: data.additionalRequestor1,
    additional_requestor1_level: data.additionalRequestor1Level,
    additional_requestor2: data.additionalRequestor2,
    additional_requestor2_level: data.additionalRequestor2Level,
    post_delivery_reachouts: data.postDeliveryReachouts,
    response_received: data.responseReceived,
    deck_material_shared: data.deckMaterialShared,
    next_steps: data.nextSteps,
    comments: data.comments,
    activity_log: data.activityLog,
  }
}

// Convert snake_case to camelCase from database
function fromSnakeCase(row: CaseRow): Case {
  return {
    id: row.id,
    billingCaseCode: row.billing_case_code || undefined,
    cdClient: row.cd_client || undefined,
    dateReceived: row.date_received || undefined,
    team: row.team || undefined,
    status: row.status as Case['status'],
    requestor: row.requestor || undefined,
    npsFlag: row.nps_flag || undefined,
    level: row.level || undefined,
    office: row.office || undefined,
    region: row.region || undefined,
    client: row.client || undefined,
    priorityLevel: row.priority_level as Case['priorityLevel'],
    industry: row.industry || undefined,
    bainIndustryClassification: row.bain_industry_classification || undefined,
    scopeOfRequest: row.scope_of_request || undefined,
    deliveredRequest: row.delivered_request || undefined,
    promisedDateForDelivery: row.promised_date_for_delivery || undefined,
    actualDateForDelivery: row.actual_date_for_delivery || undefined,
    dateForClientMeeting: row.date_for_client_meeting || undefined,
    currency: row.currency || undefined,
    amount: row.amount || undefined,
    type: row.type || undefined,
    addOnIpDelivered: row.add_on_ip_delivered || undefined,
    addOnsBilling: row.add_ons_billing || undefined,
    addOnsOnly: row.add_ons_only || undefined,
    billing: row.billing || undefined,
    additionalRequestor1: row.additional_requestor1 || undefined,
    additionalRequestor1Level: row.additional_requestor1_level || undefined,
    additionalRequestor2: row.additional_requestor2 || undefined,
    additionalRequestor2Level: row.additional_requestor2_level || undefined,
    postDeliveryReachouts: row.post_delivery_reachouts || undefined,
    responseReceived: row.response_received || undefined,
    deckMaterialShared: row.deck_material_shared || undefined,
    nextSteps: row.next_steps || undefined,
    comments: row.comments || [],
    activityLog: row.activity_log || [],
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  }
}

// Fetch all cases with error handling
// In-memory cache for server-side data
let casesCache: { data: Case[]; timestamp: number } | null = null
let casesCacheLight: { data: Case[]; timestamp: number } | null = null
const CACHE_DURATION = 30000 // 30 seconds

// Column-pruned list selection for faster table loads (exclude heavy fields like comments/activity)
export const LIST_COLUMNS = [
  'id',
  'billing_case_code',
  'cd_client',
  'date_received',
  'team',
  'status',
  'requestor',
  'nps_flag',
  'level',
  'office',
  'region',
  'client',
  'priority_level',
  'industry',
  'bain_industry_classification',
  'scope_of_request',
  'delivered_request',
  'promised_date_for_delivery',
  'actual_date_for_delivery',
  'date_for_client_meeting',
  'currency',
  'amount',
  'type',
  'add_on_ip_delivered',
  'add_ons_billing',
  'add_ons_only',
  'billing',
  'additional_requestor1',
  'additional_requestor1_level',
  'additional_requestor2',
  'additional_requestor2_level',
  'post_delivery_reachouts',
  'response_received',
  'deck_material_shared',
  'next_steps',
  'created_at',
  'updated_at',
]

export async function getCasesPage(limit = 200, offset = 0, columns = LIST_COLUMNS): Promise<{ cases: Case[]; total: number }> {
  try {
    // Get total count
    const countResult = await executeQuerySingle<{ total: number }>(
      'SELECT COUNT(*) as total FROM case_manage.cases'
    )
    const total = countResult?.total || 0

    // Get paginated data
    const columnList = columns.join(', ')
    const query = `
      SELECT ${columnList}
      FROM case_manage.cases
      ORDER BY date_received DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `
    
    const data = await executeQuery<CaseRow>(query, { offset, limit })
    const cases = data.map(fromSnakeCase)
    
    return { cases, total }
  } catch (error) {
    console.error('❌ Fatal error in getCasesPage:', error)
    throw error
  }
}

// Fetch all cases (column-pruned) in chunks to avoid payload limits
export async function getAllCasesLight(columns = LIST_COLUMNS, chunkSize = 1000, forceRefresh = false): Promise<Case[]> {
  try {
    // In-memory cache
    if (!forceRefresh && casesCacheLight && Date.now() - casesCacheLight.timestamp < CACHE_DURATION) {
      return casesCacheLight.data
    }

    // Fetch all at once (Azure SQL can handle it)
    const columnList = columns.join(', ')
    const query = `
      SELECT ${columnList}
      FROM case_manage.cases
      ORDER BY date_received DESC
    `
    
    const data = await executeQuery<CaseRow>(query)
    const all = data.map(fromSnakeCase)

    // Cache results in memory
    casesCacheLight = { data: all, timestamp: Date.now() }

    return all
  } catch (error) {
    console.error('❌ Fatal error in getAllCasesLight:', error)
    throw error
  }
}

// Progressive loading - fetch initial batch quickly
export async function getInitialCases(limit = 500): Promise<Case[]> {
  try {
    const query = `
      SELECT TOP (@limit) *
      FROM case_manage.cases
      ORDER BY date_received DESC
    `
    
    const data = await executeQuery<CaseRow>(query, { limit })
    const cases = data.map(fromSnakeCase)
    console.log(`⚡ Loaded initial ${cases.length} cases from Azure SQL`)
    return cases
  } catch (error) {
    console.error('❌ Fatal error in getInitialCases:', error)
    throw error
  }
}

export async function getAllCases(forceRefresh = false): Promise<Case[]> {
  // Return in-memory cache if available and not expired
  if (!forceRefresh && casesCache && Date.now() - casesCache.timestamp < CACHE_DURATION) {
    console.log(`✅ Returning ${casesCache.data.length} cases from in-memory cache`)
    return casesCache.data
  }

  try {
    const query = `
      SELECT *
      FROM case_manage.cases
      ORDER BY date_received DESC
    `
    
    const data = await executeQuery<CaseRow>(query)
    const cases = data.map(fromSnakeCase)
    
    // Update in-memory cache
    casesCache = {
      data: cases,
      timestamp: Date.now()
    }

    console.log(`✅ Loaded ${cases.length} cases from Azure SQL`)
    return cases
  } catch (error) {
    console.error('❌ Fatal error in getAllCases:', error)
    throw error
  }
}
// Clear the cache (called after create/update/delete operations)
function clearCache() {
  casesCache = null
  casesCacheLight = null
}

// Get a single case by ID
export async function getCaseById(id: string): Promise<Case | null> {
  try {
    const query = `
      SELECT *
      FROM case_manage.cases
      WHERE id = @id
    `
    
    const data = await executeQuerySingle<CaseRow>(query, { id })
    return data ? fromSnakeCase(data) : null
  } catch (error) {
    console.error('Error in getCaseById:', error)
    return null
  }
}

// Create a new case with retry logic
export async function createCase(caseData: Omit<Case, 'id'>, retries = 3): Promise<Case | null> {
  const dbData = toSnakeCase(caseData)
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const columns = Object.keys(dbData).filter(k => dbData[k as keyof typeof dbData] !== undefined)
      const paramNames = columns.map(c => `@${c}`)
      
      const query = `
        INSERT INTO case_manage.cases (${columns.join(', ')})
        OUTPUT INSERTED.*
        VALUES (${paramNames.join(', ')})
      `
      
      const params: Record<string, any> = {}
      columns.forEach(col => {
        params[col] = dbData[col as keyof typeof dbData]
      })
      
      const result = await executeQuery<CaseRow>(query, params)
      const inserted = result[0]

      if (!inserted) {
        throw new Error('No data returned from insert')
      }

      clearCache()
      console.log('✅ Case created successfully')
      return fromSnakeCase(inserted)
    } catch (error) {
      console.error(`Attempt ${attempt}/${retries} failed:`, error)
      if (attempt === retries) {
        console.error('❌ Failed to create case after retries')
        throw error
      }
      // Exponential backoff
      await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
    }
  }
  return null
}

// Update an existing case with retry logic
export async function updateCase(id: string, caseData: Partial<Case>, retries = 3): Promise<Case | null> {
  const dbData = toSnakeCase(caseData)
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const columns = Object.keys(dbData).filter(k => dbData[k as keyof typeof dbData] !== undefined)
      const setClauses = columns.map(c => `${c} = @${c}`)
      
      const query = `
        UPDATE case_manage.cases
        SET ${setClauses.join(', ')}
        OUTPUT INSERTED.*
        WHERE id = @id
      `
      
      const params: Record<string, any> = { id }
      columns.forEach(col => {
        params[col] = dbData[col as keyof typeof dbData]
      })
      
      const result = await executeQuery<CaseRow>(query, params)
      const updated = result[0]

      if (!updated) {
        throw new Error('No data returned from update')
      }

      clearCache()
      console.log('✅ Case updated successfully')
      return fromSnakeCase(updated)
    } catch (error) {
      console.error(`Update attempt ${attempt}/${retries} failed:`, error)
      if (attempt === retries) {
        console.error('❌ Failed to update case after retries')
        throw error
      }
      await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
    }
  }
  return null
}

// Delete a case with retry logic
export async function deleteCase(id: string, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const query = `
        DELETE FROM case_manage.cases
        WHERE id = @id
      `
      
      await executeNonQuery(query, { id })
      clearCache()
      console.log('✅ Case deleted successfully')
      return true
    } catch (error) {
      console.error(`Delete attempt ${attempt}/${retries} failed:`, error)
      if (attempt === retries) {
        console.error('❌ Failed to delete case after retries')
        return false
      }
      await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
    }
  }
  return false
}

// Bulk insert cases (useful for migration)
export async function bulkInsertCases(cases: Omit<Case, 'id'>[]): Promise<Case[]> {
  const inserted: Case[] = []
  
  // Insert in batches to avoid query size limits
  const batchSize = 100
  for (let i = 0; i < cases.length; i += batchSize) {
    const batch = cases.slice(i, i + batchSize)
    
    for (const caseItem of batch) {
      const result = await createCase(caseItem, 1)
      if (result) {
        inserted.push(result)
      }
    }
  }

  return inserted
}
