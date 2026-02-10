'use server'

// Server Actions for Case Management
// These run ONLY on the server and can safely use mssql/Azure SQL

import { getAllCases, getAllCasesLight, getCaseById, createCase, updateCase, deleteCase, bulkInsertCases } from '@/lib/db'
import { getAllAdjustments, createAdjustment, updateAdjustment, deleteAdjustment } from '@/lib/billingDb'
import { Case, BillingAdjustment } from '@/lib/types'
import { revalidatePath } from 'next/cache'

// ===== CASE ACTIONS =====

export async function fetchAllCases(forceRefresh = false): Promise<Case[]> {
  return await getAllCases(forceRefresh)
}

export async function fetchAllCasesLight(forceRefresh = false): Promise<Case[]> {
  return await getAllCasesLight(undefined, undefined, forceRefresh)
}

export async function fetchCaseById(id: string): Promise<Case | null> {
  return await getCaseById(id)
}

export async function addCase(caseData: Omit<Case, 'id'>): Promise<Case | null> {
  const result = await createCase(caseData)
  revalidatePath('/')
  return result
}

export async function modifyCase(id: string, caseData: Partial<Case>): Promise<Case | null> {
  const result = await updateCase(id, caseData)
  revalidatePath('/')
  return result
}

export async function removeCase(id: string): Promise<boolean> {
  const result = await deleteCase(id)
  revalidatePath('/')
  return result
}

export async function importCasesBulk(cases: Omit<Case, 'id'>[]): Promise<Case[]> {
  const result = await bulkInsertCases(cases)
  revalidatePath('/')
  return result
}

// ===== BILLING ACTIONS =====

export async function fetchAllAdjustments(): Promise<BillingAdjustment[]> {
  return await getAllAdjustments()
}

export async function addAdjustment(adjustment: Omit<BillingAdjustment, 'id'>): Promise<BillingAdjustment | null> {
  const result = await createAdjustment(adjustment)
  revalidatePath('/')
  return result
}

export async function modifyAdjustment(id: string, adjustment: Partial<BillingAdjustment>): Promise<BillingAdjustment | null> {
  const result = await updateAdjustment(id, adjustment)
  revalidatePath('/')
  return result
}

export async function removeAdjustment(id: string): Promise<boolean> {
  const result = await deleteAdjustment(id)
  revalidatePath('/')
  return result
}

// Re-export types for client components
export type { Case, BillingAdjustment } from '@/lib/types'
