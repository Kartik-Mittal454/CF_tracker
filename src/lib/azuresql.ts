import 'server-only'
import sql from 'mssql'

// Azure SQL Configuration
// Requires environment variables to be set in .env.local or Vercel environment
if (!process.env.AZURE_SQL_SERVER || !process.env.AZURE_SQL_DATABASE || !process.env.AZURE_SQL_USER || !process.env.AZURE_SQL_PASSWORD) {
  throw new Error('Missing required Azure SQL environment variables. Please set AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, and AZURE_SQL_PASSWORD.')
}

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true, // Required for Azure
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

let pool: sql.ConnectionPool | null = null

/**
 * Get or create Azure SQL connection pool
 * This ensures we reuse connections efficiently
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool
  }

  if (pool && !pool.connected) {
    try {
      await pool.close()
    } catch (e) {
      console.warn('Error closing existing pool:', e)
    }
    pool = null
  }

  try {
    pool = await sql.connect(config)
    console.log('✅ Connected to Azure SQL Database')
    return pool
  } catch (error) {
    console.error('❌ Azure SQL connection error:', error)
    throw new Error(`Failed to connect to Azure SQL: ${error}`)
  }
}

/**
 * Helper function to bind parameters to a request
 * Centralizes parameter type handling logic
 */
function bindParameters(request: sql.Request, params: Record<string, any>): void {
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      request.input(key, sql.NVarChar, null)
    } else if (typeof value === 'string') {
      request.input(key, sql.NVarChar, value)
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        request.input(key, sql.Int, value)
      } else {
        request.input(key, sql.Decimal(18, 2), value)
      }
    } else if (typeof value === 'boolean') {
      request.input(key, sql.Bit, value)
    } else if (value instanceof Date) {
      request.input(key, sql.DateTime2, value) // Use DateTime2 to match schema
    } else if (typeof value === 'object') {
      // JSON objects stored as NVARCHAR
      request.input(key, sql.NVarChar, JSON.stringify(value))
    } else {
      request.input(key, sql.NVarChar, String(value))
    }
  })
}

/**
 * Execute a query with automatic connection management
 */
export async function executeQuery<T = any>(
  queryText: string,
  params?: Record<string, any>
): Promise<T[]> {
  const connection = await getPool()
  const request = connection.request()

  if (params) {
    bindParameters(request, params)
  }

  const result = await request.query(queryText)
  return result.recordset as T[]
}

/**
 * Execute a query that returns a single row
 */
export async function executeQuerySingle<T = any>(
  queryText: string,
  params?: Record<string, any>
): Promise<T | null> {
  const results = await executeQuery<T>(queryText, params)
  return results.length > 0 ? results[0] : null
}

/**
 * Execute an insert/update/delete and return affected rows
 */
export async function executeNonQuery(
  queryText: string,
  params?: Record<string, any>
): Promise<number> {
  const connection = await getPool()
  const request = connection.request()

  if (params) {
    bindParameters(request, params)
  }

  const result = await request.query(queryText)
  return result.rowsAffected[0] || 0
}

/**
 * Close the connection pool (useful for cleanup)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close()
    pool = null
    console.log('🔌 Azure SQL connection pool closed')
  }
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    closePool().catch((err) => console.error('Error closing pool on exit:', err))
  })
}

export { sql }
