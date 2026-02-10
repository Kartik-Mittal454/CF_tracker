import { executeQuery, executeQuerySingle, executeNonQuery, sql } from './azuresql'

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

// Database row type (snake_case)
interface BillingAdjustmentRow {
  id: string
  month: number
  year: number
  type: string
  amount: number
  reason: string
  created_at?: string
  updated_at?: string
}

// Convert camelCase to snake_case
function toSnakeCase(data: Partial<BillingAdjustment>): Partial<BillingAdjustmentRow> {
  return {
    month: data.month,
    year: data.year,
    type: data.type,
    amount: data.amount,
    reason: data.reason,
  }
}

// Convert snake_case to camelCase
function fromSnakeCase(row: BillingAdjustmentRow): BillingAdjustment {
  return {
    id: row.id,
    month: row.month,
    year: row.year,
    type: row.type,
    amount: row.amount,
    reason: row.reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// Fetch all adjustments
export async function getAllAdjustments(): Promise<BillingAdjustment[]> {
  try {
    const query = `
      SELECT *
      FROM case_manage.billing_adjustments
      ORDER BY year DESC, month DESC
    `
    
    const data = await executeQuery<BillingAdjustmentRow>(query)
    return data.map(fromSnakeCase)
  } catch (error) {
    console.error('❌ Fatal error in getAllAdjustments:', error)
    throw error
  }
}

// Get adjustments by year
export async function getAdjustmentsByYear(year: number): Promise<BillingAdjustment[]> {
  try {
    const query = `
      SELECT *
      FROM case_manage.billing_adjustments
      WHERE year = @year
      ORDER BY month ASC
    `
    
    const data = await executeQuery<BillingAdjustmentRow>(query, { year })
    return data.map(fromSnakeCase)
  } catch (error) {
    console.error('Error in getAdjustmentsByYear:', error)
    return []
  }
}

// Create a new adjustment
export async function createAdjustment(
  adjustment: Omit<BillingAdjustment, 'id'>
): Promise<BillingAdjustment | null> {
  const dbData = toSnakeCase(adjustment)

  try {
    const columns = Object.keys(dbData).filter(k => dbData[k as keyof typeof dbData] !== undefined)
    const paramNames = columns.map(c => `@${c}`)
    
    const query = `
      INSERT INTO case_manage.billing_adjustments (${columns.join(', ')})
      OUTPUT INSERTED.*
      VALUES (${paramNames.join(', ')})
    `
    
    const params: Record<string, any> = {}
    columns.forEach(col => {
      params[col] = dbData[col as keyof typeof dbData]
    })
    
    const result = await executeQuery<BillingAdjustmentRow>(query, params)
    const inserted = result[0]

    if (!inserted) {
      throw new Error('No data returned from insert')
    }

    console.log('✅ Adjustment created successfully')
    return fromSnakeCase(inserted)
  } catch (error) {
    console.error('❌ Failed to create adjustment:', error)
    throw error
  }
}

// Update an adjustment
export async function updateAdjustment(
  id: string,
  adjustment: Partial<BillingAdjustment>
): Promise<BillingAdjustment | null> {
  const dbData = toSnakeCase(adjustment)

  try {
    const columns = Object.keys(dbData).filter(k => dbData[k as keyof typeof dbData] !== undefined)
    const setClauses = columns.map(c => `${c} = @${c}`)
    
    const query = `
      UPDATE case_manage.billing_adjustments
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `
    
    const params: Record<string, any> = { id }
    columns.forEach(col => {
      params[col] = dbData[col as keyof typeof dbData]
    })
    
    const result = await executeQuery<BillingAdjustmentRow>(query, params)
    const updated = result[0]

    if (!updated) {
      throw new Error('No data returned from update')
    }

    console.log('✅ Adjustment updated successfully')
    return fromSnakeCase(updated)
  } catch (error) {
    console.error('❌ Failed to update adjustment:', error)
    throw error
  }
}

// Delete an adjustment
export async function deleteAdjustment(id: string): Promise<boolean> {
  try {
    const query = `
      DELETE FROM case_manage.billing_adjustments
      WHERE id = @id
    `
    
    await executeNonQuery(query, { id })
    console.log('✅ Adjustment deleted successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to delete adjustment:', error)
    return false
  }
}
