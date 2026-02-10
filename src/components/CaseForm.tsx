'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Case } from '@/app/page'
import { normalizeStatus, canonicalStatuses } from '@/lib/caseUtils'

// Standard deliverable components (can be extended by users)
const STANDARD_DELIVERABLE_COMPONENTS = [
  'TSR Analysis',
  'Full TSR',
  'Short TSR',
  'TSR Decomposition',
  'BWG (Black-White-Grey)',
  'Balance Sheet X-ray',
  'Investor Commentary',
  'Investor Base Analysis',
  'Analyst Commentary',
  'IPD Fact Pack',
  'SoTP (Sum of the Parts)',
  'Sensitivity Analysis',
  'Valuation Analysis',
  'Word Cloud',
  'ROE Deep Dive',
  'Slide Update',
  '1 Slide',
  '2 Slides',
  '3+ Slides',
  'Ad Hoc Analysis',
  'Peer Analysis',
  'Sector Analysis',
  'Financial Model',
  'Benchmarking',
]

interface CaseFormProps {
  onSubmit: (caseData: Omit<Case, 'id'> | Case) => void
  existingCaseNumbers: string[]
  existingClients: string[]
  existingTeams: string[]
  existingRequestors: string[]
  existingCases: Case[]
  editingCase?: Case | null
  onCancel: () => void
  mode?: 'quick' | 'full'
}

// Auto-generate: BC-YYYY-###
const generateBillingCaseCode = (existing: string[]) => {
  const year = new Date().getFullYear()
  const prefix = `BC-${year}-`
  const existingForYear = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n))
  const next = existingForYear.length > 0 ? Math.max(...existingForYear) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

const officeRegionMap: Record<string, string> = {
  // EMEA (32 offices)
  'Amsterdam': 'EMEA',
  'Athens': 'EMEA',
  'Belgium': 'EMEA',
  'Berlin': 'EMEA',
  'Brussels': 'EMEA',
  'Copenhagen': 'EMEA',
  'Doha': 'EMEA',
  'Dubai': 'EMEA',
  'Dusseldorf': 'EMEA',
  'Frankfurt': 'EMEA',
  'Helsinki': 'EMEA',
  'Istanbul': 'EMEA',
  'Johannesburg': 'EMEA',
  'Lisbon': 'EMEA',
  'London': 'EMEA',
  'Madrid': 'EMEA',
  'Milan': 'EMEA',
  'Moscow': 'EMEA',
  'Munich': 'EMEA',
  'Oslo': 'EMEA',
  'Paris': 'EMEA',
  'Perth': 'EMEA',
  'Riyadh': 'EMEA',
  'Rome': 'EMEA',
  'South Africa - Rand': 'EMEA',
  'Stockholm': 'EMEA',
  'Sweden': 'EMEA',
  'Vienna': 'EMEA',
  'Warsaw': 'EMEA',
  'Zurich': 'EMEA',
  
  // Americas (23 offices)
  'Atlanta': 'Americas',
  'Austin': 'Americas',
  'Bogota': 'Americas',
  'Boston': 'Americas',
  'Buenos Aires': 'Americas',
  'Chicago': 'Americas',
  'Dallas': 'Americas',
  'Denver': 'Americas',
  'Houston': 'Americas',
  'Los Angeles': 'Americas',
  'Mexico City': 'Americas',
  'Monterrey': 'Americas',
  'New York': 'Americas',
  'Rio de Janeiro': 'Americas',
  'San Francisco': 'Americas',
  'Santiago': 'Americas',
  'Sao Paulo': 'Americas',
  'Seattle': 'Americas',
  'Silicon Valley': 'Americas',
  'Toronto': 'Americas',
  'Washington DC': 'Americas',
  
  // APAC (14 offices)
  'Bangkok': 'APAC',
  'Beijing': 'APAC',
  'Bengaluru': 'APAC',
  'Hong Kong': 'APAC',
  'Ho Chi Minh': 'APAC',
  'Jakarta': 'APAC',
  'Kuala Lumpur': 'APAC',
  'Manila': 'APAC',
  'Melbourne': 'APAC',
  'Mumbai': 'APAC',
  'New Delhi': 'APAC',
  'Seoul': 'APAC',
  'Shanghai': 'APAC',
  'Singapore': 'APAC',
  'Sydney': 'APAC',
  'Tokyo': 'APAC',
}

// Requestor to NPS Flag mapping (Yes = NPS eligible, No = not eligible)
const requestorNpsMap: Record<string, 'Yes' | 'No'> = {
  // Add requestors here as they are identified
  // Example: 'John Smith': 'Yes',
  // Example: 'Jane Doe': 'No',
}

const teamSlaDays: Record<string, number> = {
  'CF Ops': 7,
  'CF Research': 10,
  'Analytics': 14,
  'Eng Support': 5,
}

const highPriorityKeywords = [
  'urgent',
  'asap',
  'escalat',
  'board',
  'investor',
  'deadline',
  'due diligence',
]

// Helper to convert Date objects to YYYY-MM-DD string format for form inputs
function toFormString(value: string | Date | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  // value is a Date object
  return value.toISOString().split('T')[0]
}

export default function CaseForm({
  onSubmit,
  existingCaseNumbers,
  existingClients,
  existingTeams,
  existingRequestors,
  existingCases,
  editingCase,
  onCancel,
  mode = 'full',
}: CaseFormProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    requestorGeography: false,
    classification: false,
    delivery: false,
    commercial: false,
    additionalRequestors: false,
    postDelivery: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    billingCaseCode: '',
    dateReceived: new Date().toISOString().split('T')[0],
    client: '',
    cdClient: 'CD',
    team: '',
    requestor: '',
    scopeOfRequest: '',
    status: 'Not confirmed' as Case['status'],
    priorityLevel: 'P2' as Case['priorityLevel'],
    promisedDateForDelivery: '',
    actualDateForDelivery: '',
    // Requestor & Geography
    npsFlag: '',
    level: '',
    office: '',
    region: '',
    // Classification
    industry: '',
    bainIndustryClassification: '',
    // Delivery
    deliveredRequest: '',
    dateForClientMeeting: '',
    // Commercial / Billing
    currency: 'USD',
    amount: '',
    type: '',
    addOnIpDelivered: '',
    addOnsBilling: '',
    addOnsOnly: '',
    billing: '',
    // Additional Requestors
    additionalRequestor1: '',
    additionalRequestor1Level: '',
    additionalRequestor2: '',
    additionalRequestor2Level: '',
    // Post-delivery
    postDeliveryReachouts: '',
    responseReceived: '',
    deckMaterialShared: '',
    nextSteps: '',
  })

  // Cache latest case overall and by client to avoid repeated sorts
  const latestCase = useMemo(() => {
    if (existingCases.length === 0) return null
    return existingCases.reduce<Case | null>((latest, current) => {
      const latestTime = latest?.dateReceived ? new Date(latest.dateReceived).getTime() : -Infinity
      const currentTime = current.dateReceived ? new Date(current.dateReceived).getTime() : -Infinity
      return currentTime > latestTime ? current : latest
    }, null)
  }, [existingCases])

  const latestByClient = useMemo(() => {
    const map: Record<string, Case> = {}
    existingCases.forEach((c) => {
      if (!c.client) return
      const key = c.client
      const existing = map[key]
      const existingTime = existing?.dateReceived ? new Date(existing.dateReceived).getTime() : -Infinity
      const currentTime = c.dateReceived ? new Date(c.dateReceived).getTime() : -Infinity
      if (!existing || currentTime > existingTime) {
        map[key] = c
      }
    })
    return map
  }, [existingCases])

  const submitRef = useRef<(e: React.FormEvent) => void>()
  const onCancelRef = useRef(onCancel)

  // Initialize form
  useEffect(() => {
    if (editingCase) {
      setForm({
        billingCaseCode: editingCase.billingCaseCode || '',
        dateReceived: toFormString(editingCase.dateReceived),
        client: editingCase.client || '',
        cdClient: editingCase.cdClient || 'CD',
        team: editingCase.team || '',
        requestor: editingCase.requestor || '',
        scopeOfRequest: editingCase.scopeOfRequest || '',
        status: normalizeStatus(editingCase.status) || 'Not confirmed',
        priorityLevel: editingCase.priorityLevel || 'P2',
        promisedDateForDelivery: toFormString(editingCase.promisedDateForDelivery),
        actualDateForDelivery: toFormString(editingCase.actualDateForDelivery),
        npsFlag: editingCase.npsFlag || '',
        level: editingCase.level || '',
        office: editingCase.office || '',
        region: editingCase.region || '',
        industry: editingCase.industry || '',
        bainIndustryClassification: editingCase.bainIndustryClassification || '',
        deliveredRequest: editingCase.deliveredRequest || '',
        dateForClientMeeting: toFormString(editingCase.dateForClientMeeting),
        currency: editingCase.currency || 'USD',
        amount: editingCase.amount || '',
        type: editingCase.type || '',
        addOnIpDelivered: editingCase.addOnIpDelivered || '',
        addOnsBilling: editingCase.addOnsBilling || '',
        addOnsOnly: editingCase.addOnsOnly || '',
        billing: editingCase.billing || '',
        additionalRequestor1: editingCase.additionalRequestor1 || '',
        additionalRequestor1Level: editingCase.additionalRequestor1Level || '',
        additionalRequestor2: editingCase.additionalRequestor2 || '',
        additionalRequestor2Level: editingCase.additionalRequestor2Level || '',
        postDeliveryReachouts: editingCase.postDeliveryReachouts || '',
        responseReceived: editingCase.responseReceived || '',
        deckMaterialShared: editingCase.deckMaterialShared || '',
        nextSteps: editingCase.nextSteps || '',
      })
      // Auto-expand sections if they have data
      if (editingCase.level || editingCase.npsFlag || editingCase.office || editingCase.region) {
        setExpandedSections(s => ({ ...s, requestorGeography: true }))
      }
      if (editingCase.industry || editingCase.bainIndustryClassification) {
        setExpandedSections(s => ({ ...s, classification: true }))
      }
      if (editingCase.deliveredRequest) {
        setExpandedSections(s => ({ ...s, delivery: true }))
      }
      if (editingCase.currency || editingCase.amount || editingCase.type) {
        setExpandedSections(s => ({ ...s, commercial: true }))
      }
      if (editingCase.additionalRequestor1 || editingCase.additionalRequestor2) {
        setExpandedSections(s => ({ ...s, additionalRequestors: true }))
      }
      if (editingCase.postDeliveryReachouts) {
        setExpandedSections(s => ({ ...s, postDelivery: true }))
      }
    } else {
      setForm((f) => ({
        ...f,
        billingCaseCode: generateBillingCaseCode(existingCaseNumbers),
      }))
    }
  }, [editingCase, existingCaseNumbers])

  // Auto-fill Promised Date based on Team SLA if empty
  useEffect(() => {
    if (!form.team || form.promisedDateForDelivery) return
    const sla = teamSlaDays[form.team]
    if (!sla) return
    const baseDate = form.dateReceived ? new Date(form.dateReceived) : new Date()
    baseDate.setDate(baseDate.getDate() + sla)
    setForm((f) => ({ ...f, promisedDateForDelivery: baseDate.toISOString().split('T')[0] }))
  }, [form.team, form.promisedDateForDelivery, form.dateReceived])

  // Auto-fill Region from Office if empty
  useEffect(() => {
    if (!form.office || form.region) return
    const region = officeRegionMap[form.office]
    if (region) setForm((f) => ({ ...f, region }))
  }, [form.office, form.region])

  // Auto-fill Actual Date when status Delivered/Closed
  useEffect(() => {
    if ((form.status === 'Delivered' || form.status === 'Closed') && !form.actualDateForDelivery) {
      setForm((f) => ({ ...f, actualDateForDelivery: new Date().toISOString().split('T')[0] }))
    }
  }, [form.status, form.actualDateForDelivery])

  // Auto-suggest fields based on last case for the same client
  useEffect(() => {
    if (!form.client) return
    const lastForClient = latestByClient[form.client]
    if (!lastForClient) return
    setForm((f) => ({
      ...f,
      office: f.office || lastForClient.office || '',
      region: f.region || lastForClient.region || '',
      industry: f.industry || lastForClient.industry || '',
      bainIndustryClassification: f.bainIndustryClassification || lastForClient.bainIndustryClassification || '',
      currency: f.currency || lastForClient.currency || 'USD',
      type: f.type || lastForClient.type || '',
    }))
  }, [form.client, existingCases])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.billingCaseCode.trim()) errs.billingCaseCode = 'Required'
    if (!editingCase && existingCaseNumbers.includes(form.billingCaseCode)) {
      errs.billingCaseCode = 'Already exists'
    }
    if (!form.client.trim()) errs.client = 'Required'
    if (!form.team.trim()) errs.team = 'Required'
    if (!form.requestor.trim()) errs.requestor = 'Required'
    if (!form.scopeOfRequest.trim()) errs.scopeOfRequest = 'Required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (editingCase) {
      onSubmit({ ...form, id: editingCase.id })
    } else {
      onSubmit(form)
    }
  }

  useEffect(() => {
    submitRef.current = handleSubmit
  }, [handleSubmit])

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  // Keyboard shortcuts: Ctrl/Cmd+Enter to save, Esc to cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        submitRef.current?.({ preventDefault: () => {} } as React.FormEvent)
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancelRef.current?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleRequestorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const requestorValue = e.target.value
    
    // Auto-populate NPS flag, level, and office from requestor's most recent case
    let npsValue = requestorNpsMap[requestorValue] || ''
    let levelValue = ''
    let officeValue = ''
    let regionValue = ''
    
    if (requestorValue) {
      // Look up requestor's previous cases
      const requestorCases = existingCases
        .filter(c => c.requestor === requestorValue)
        .sort((a, b) => {
          const dateA = a.dateReceived ? new Date(a.dateReceived).getTime() : 0
          const dateB = b.dateReceived ? new Date(b.dateReceived).getTime() : 0
          return dateB - dateA // Most recent first
        })
      
      if (requestorCases.length > 0) {
        const mostRecent = requestorCases[0]
        
        // Auto-fill NPS flag
        if (!npsValue && mostRecent.npsFlag) {
          if (mostRecent.npsFlag.toLowerCase().includes('yes') || mostRecent.npsFlag.toLowerCase().includes('check')) {
            npsValue = 'Yes'
          } else if (mostRecent.npsFlag.toLowerCase().includes('no')) {
            npsValue = 'No'
          }
        }
        
        // Auto-fill Level
        if (mostRecent.level) {
          levelValue = mostRecent.level
        }
        
        // Auto-fill Office
        if (mostRecent.office) {
          officeValue = mostRecent.office
          regionValue = officeRegionMap[mostRecent.office] || ''
        }
      }
    }
    
    setForm(prev => ({
      ...prev,
      requestor: requestorValue,
      npsFlag: npsValue,
      level: levelValue,
      office: officeValue,
      region: regionValue,
    }))
  }

  const handleClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clientValue = e.target.value
    
    // Auto-populate industry fields from client's most recent case
    let industryValue = ''
    let bainIndustryValue = ''
    
    if (clientValue) {
      const clientCases = existingCases
        .filter(c => c.client === clientValue)
        .sort((a, b) => {
          const dateA = a.dateReceived ? new Date(a.dateReceived).getTime() : 0
          const dateB = b.dateReceived ? new Date(b.dateReceived).getTime() : 0
          return dateB - dateA
        })
      
      if (clientCases.length > 0) {
        const mostRecent = clientCases[0]
        
        if (mostRecent.industry) {
          industryValue = mostRecent.industry
        }
        
        if (mostRecent.bainIndustryClassification) {
          bainIndustryValue = mostRecent.bainIndustryClassification
        }
      }
    }
    
    setForm(prev => ({
      ...prev,
      client: clientValue,
      industry: industryValue,
      bainIndustryClassification: bainIndustryValue,
    }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((f) => {
      const next = { ...f, [name]: value }

      // Auto-populate region based on office selection
      if (name === 'office' && value) {
        next.region = officeRegionMap[value] || ''
      }

      // Auto-prioritize based on scope keywords
      if (name === 'scopeOfRequest') {
        const text = value.toLowerCase()
        if (highPriorityKeywords.some((k) => text.includes(k))) {
          next.priorityLevel = 'P1'
        }
      }

      // Auto-prioritize on status escalation
      if (name === 'status' && value === 'Escalated') {
        next.priorityLevel = 'P1'
      }

      return next
    })
    if (errors[name]) setErrors((e) => ({ ...e, [name]: '' }))
  }

  const toggleSection = (section: string) => {
    setExpandedSections(s => ({ ...s, [section]: !s[section] }))
  }

  const handleCopyLast = () => {
    if (!latestCase) return
    setForm((f) => ({
      ...f,
      client: latestCase.client || '',
      cdClient: latestCase.cdClient || 'CD',
      team: latestCase.team || '',
      requestor: latestCase.requestor || '',
      scopeOfRequest: latestCase.scopeOfRequest || '',
      status: normalizeStatus(latestCase.status) || 'Not confirmed',
      priorityLevel: latestCase.priorityLevel || 'P2',
      promisedDateForDelivery: toFormString(latestCase.promisedDateForDelivery),
      npsFlag: latestCase.npsFlag || '',
      level: latestCase.level || '',
      office: latestCase.office || '',
      region: latestCase.region || '',
      industry: latestCase.industry || '',
      bainIndustryClassification: latestCase.bainIndustryClassification || '',
      currency: latestCase.currency || 'USD',
      type: latestCase.type || '',
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {mode === 'quick' && (
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Quick add: only required fields shown. Use Full mode to add optional details.
        </div>
      )}
      
      {/* Reminder about auto-filled data */}
      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        ℹ️ <strong>Reminder:</strong> Auto-filled data is based on historical records. Please verify that requestor levels, offices, and client industries are still current, as people may have been promoted or transferred.
      </div>

      {/* CORE SECTION */}
      <div className="space-y-3">
        {/* Row 1: Billing Case Code + Date Received */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-600 mb-1">Billing Case Code</label>
            <input
              name="billingCaseCode"
              value={form.billingCaseCode}
              onChange={handleChange}
              readOnly
              className={`w-full px-3 py-1.5 border rounded bg-gray-50 text-gray-600 ${errors.billingCaseCode ? 'border-red-500' : 'border-gray-300'}`}
            />
            <p className="text-[11px] text-gray-400 mt-1">Auto-generated</p>
            {errors.billingCaseCode && <p className="text-red-500 text-xs mt-0.5">{errors.billingCaseCode}</p>}
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Date Received</label>
            <input
              type="date"
              name="dateReceived"
              value={form.dateReceived}
              onChange={handleChange}
              className="w-full px-3 py-1.5 border border-gray-300 rounded"
            />
          </div>
        </div>

        {/* Row 2: Client + Team + CD/Client */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-gray-600 mb-1">Client *</label>
            <input
              name="client"
              list="client-list"
              value={form.client}
              onChange={handleClientChange}
              placeholder="Select or type..."
              className={`w-full px-3 py-1.5 border rounded ${errors.client ? 'border-red-500' : 'border-gray-300'}`}
            />
            <datalist id="client-list">
              {existingClients.map((c) => <option key={c} value={c} />)}
            </datalist>
            {errors.client && <p className="text-red-500 text-xs mt-0.5">{errors.client}</p>}
          </div>
          <div>
            <label className="block text-gray-600 mb-1">CD/Client</label>
            <select
              name="cdClient"
              value={form.cdClient}
              onChange={handleChange}
              className="w-full px-3 py-1.5 border border-gray-300 rounded"
            >
              <option value="CD">CD</option>
              <option value="Client">Client</option>
              <option value="TBD">TBD</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Team *</label>
            <input
              name="team"
              list="team-list"
              value={form.team}
              onChange={handleChange}
              placeholder="Select or type..."
              className={`w-full px-3 py-1.5 border rounded ${errors.team ? 'border-red-500' : 'border-gray-300'}`}
            />
            <datalist id="team-list">
              {existingTeams.map((t) => <option key={t} value={t} />)}
            </datalist>
            {errors.team && <p className="text-red-500 text-xs mt-0.5">{errors.team}</p>}
          </div>
        </div>

        {/* Row 3: Requestor */}
        <div>
          <label className="block text-gray-600 mb-1">Requestor *</label>
          <input
            name="requestor"
            list="requestor-list"
            value={form.requestor}
            onChange={handleRequestorChange}
            placeholder="Select or type..."
            className={`w-full px-3 py-1.5 border rounded ${errors.requestor ? 'border-red-500' : 'border-gray-300'}`}
          />
          <datalist id="requestor-list">
            {existingRequestors.map((r) => <option key={r} value={r} />)}
          </datalist>
          {errors.requestor && <p className="text-red-500 text-xs mt-0.5">{errors.requestor}</p>}
        </div>

        {/* Row 4: Scope of Request */}
        <div>
          <label className="block text-gray-600 mb-1">Scope of Request *</label>
          <textarea
            name="scopeOfRequest"
            value={form.scopeOfRequest}
            onChange={handleChange}
            rows={2}
            placeholder="Describe the request..."
            className={`w-full px-3 py-1.5 border rounded ${errors.scopeOfRequest ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.scopeOfRequest && <p className="text-red-500 text-xs mt-0.5">{errors.scopeOfRequest}</p>}
        </div>

        {/* Row 5: Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-600 mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-1.5 border border-gray-300 rounded"
            >
              {canonicalStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Priority Level</label>
            <select
              name="priorityLevel"
              value={form.priorityLevel}
              onChange={handleChange}
              className="w-full px-3 py-1.5 border border-gray-300 rounded"
            >
              <option value="">Select Priority</option>
              <option value="P1">P1 - Urgent</option>
              <option value="P1A">P1A - Critical</option>
              <option value="P2">P2 - High</option>
              <option value="P3">P3 - Medium</option>
            </select>
          </div>
        </div>

        {/* Row 6: Promised Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-600 mb-1">Promised Date for Delivery (Optional)</label>
            <input
              type="date"
              name="promisedDateForDelivery"
              value={form.promisedDateForDelivery}
              onChange={handleChange}
              className="w-full px-3 py-1.5 border border-gray-300 rounded"
            />
          </div>
          <div className="text-[11px] text-gray-400 flex items-end pb-2">
            Actual Date is auto-filled on Delivered/Closed
          </div>
        </div>
      </div>

      {mode === 'full' && (
        <>
          {/* REQUESTOR & GEOGRAPHY */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => toggleSection('requestorGeography')}
              className="text-blue-600 text-sm hover:underline flex items-center gap-1 font-medium"
            >
              {expandedSections.requestorGeography ? '▼' : '▶'} Requestor & Geography
            </button>
            {expandedSections.requestorGeography && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Level</label>
                    <select name="level" value={form.level} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs">
                      <option value="">Select or type...</option>
                      <option value="Partner">Partner</option>
                      <option value="Consultant">Consultant</option>
                      <option value="Senior Manager">Senior Manager</option>
                      <option value="Associate Partner">Associate Partner</option>
                      <option value="Manager">Manager</option>
                      <option value="Principal">Principal</option>
                      <option value="Associate Consultant">Associate Consultant</option>
                      <option value="Senior Associate Consultant">Senior Associate Consultant</option>
                      <option value="Practice Director">Practice Director</option>
                      <option value="Practice Area Manager">Practice Area Manager</option>
                      <option value="Practice Area Director">Practice Area Director</option>
                      <option value="Practice Senior Manager">Practice Senior Manager</option>
                      <option value="Practice Manager">Practice Manager</option>
                      <option value="Practice Vice President">Practice Vice President</option>
                      <option value="Practice Consultant">Practice Consultant</option>
                      <option value="Practice Principal">Practice Principal</option>
                      <option value="Advisory Partner">Advisory Partner</option>
                      <option value="Commercial Manager">Commercial Manager</option>
                      <option value="Senior Practice Area Consultant">Senior Practice Area Consultant</option>
                      <option value="Expert Partner">Expert Partner</option>
                    </select>
                    {form.level && form.requestor && existingCases.some(c => c.requestor === form.requestor && c.level === form.level) && (
                      <p className="text-xs text-gray-500 mt-1">✓ From requestor history</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">NPS Flag</label>
                    <select name="npsFlag" value={form.npsFlag} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs">
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                    {form.npsFlag && form.requestor && (
                      <p className="text-xs text-gray-500 mt-1">
                        {requestorNpsMap[form.requestor] 
                          ? '✓ From static mapping' 
                          : existingCases.some(c => c.requestor === form.requestor && c.npsFlag)
                            ? '✓ Auto-filled from previous cases'
                            : 'Manually set'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Office</label>
                    <select name="office" value={form.office} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs">
                      <option value="">Select Office...</option>
                      <optgroup label="EMEA">
                        <option value="Amsterdam">Amsterdam</option>
                        <option value="Athens">Athens</option>
                        <option value="Belgium">Belgium</option>
                        <option value="Berlin">Berlin</option>
                        <option value="Brussels">Brussels</option>
                        <option value="Copenhagen">Copenhagen</option>
                        <option value="Doha">Doha</option>
                        <option value="Dubai">Dubai</option>
                        <option value="Dusseldorf">Dusseldorf</option>
                        <option value="Frankfurt">Frankfurt</option>
                        <option value="Helsinki">Helsinki</option>
                        <option value="Istanbul">Istanbul</option>
                        <option value="Johannesburg">Johannesburg</option>
                        <option value="Lisbon">Lisbon</option>
                        <option value="London">London</option>
                        <option value="Madrid">Madrid</option>
                        <option value="Milan">Milan</option>
                        <option value="Moscow">Moscow</option>
                        <option value="Munich">Munich</option>
                        <option value="Oslo">Oslo</option>
                        <option value="Paris">Paris</option>
                        <option value="Perth">Perth</option>
                        <option value="Riyadh">Riyadh</option>
                        <option value="Rome">Rome</option>
                        <option value="South Africa - Rand">South Africa - Rand</option>
                        <option value="Stockholm">Stockholm</option>
                        <option value="Sweden">Sweden</option>
                        <option value="Vienna">Vienna</option>
                        <option value="Warsaw">Warsaw</option>
                        <option value="Zurich">Zurich</option>
                      </optgroup>
                      <optgroup label="Americas">
                        <option value="Atlanta">Atlanta</option>
                        <option value="Austin">Austin</option>
                        <option value="Bogota">Bogota</option>
                        <option value="Boston">Boston</option>
                        <option value="Buenos Aires">Buenos Aires</option>
                        <option value="Chicago">Chicago</option>
                        <option value="Dallas">Dallas</option>
                        <option value="Denver">Denver</option>
                        <option value="Houston">Houston</option>
                        <option value="Los Angeles">Los Angeles</option>
                        <option value="Mexico City">Mexico City</option>
                        <option value="Monterrey">Monterrey</option>
                        <option value="New York">New York</option>
                        <option value="Rio de Janeiro">Rio de Janeiro</option>
                        <option value="San Francisco">San Francisco</option>
                        <option value="Santiago">Santiago</option>
                        <option value="Sao Paulo">Sao Paulo</option>
                        <option value="Seattle">Seattle</option>
                        <option value="Silicon Valley">Silicon Valley</option>
                        <option value="Toronto">Toronto</option>
                        <option value="Washington DC">Washington DC</option>
                      </optgroup>
                      <optgroup label="APAC">
                        <option value="Bangkok">Bangkok</option>
                        <option value="Beijing">Beijing</option>
                        <option value="Bengaluru">Bengaluru</option>
                        <option value="Hong Kong">Hong Kong</option>
                        <option value="Ho Chi Minh">Ho Chi Minh</option>
                        <option value="Jakarta">Jakarta</option>
                        <option value="Kuala Lumpur">Kuala Lumpur</option>
                        <option value="Manila">Manila</option>
                        <option value="Melbourne">Melbourne</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="New Delhi">New Delhi</option>
                        <option value="Seoul">Seoul</option>
                        <option value="Shanghai">Shanghai</option>
                        <option value="Singapore">Singapore</option>
                        <option value="Sydney">Sydney</option>
                        <option value="Tokyo">Tokyo</option>
                      </optgroup>
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Region auto-populates from office</p>
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Region (Auto-filled)</label>
                    <input name="region" value={form.region} readOnly className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-gray-100" placeholder="Auto-filled" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CLASSIFICATION */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => toggleSection('classification')}
              className="text-blue-600 text-sm hover:underline flex items-center gap-1 font-medium"
            >
              {expandedSections.classification ? '▼' : '▶'} Classification
            </button>
            {expandedSections.classification && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded">
                <div>
                  <label className="block text-gray-600 mb-1">Industry</label>
                  <input name="industry" value={form.industry} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs" />
                  {form.industry && form.client && existingCases.some(c => c.client === form.client && c.industry === form.industry) && (
                    <p className="text-xs text-gray-500 mt-1">✓ From client history</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Bain Industry Classification</label>
                  <input name="bainIndustryClassification" value={form.bainIndustryClassification} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs" />
                  {form.bainIndustryClassification && form.client && existingCases.some(c => c.client === form.client && c.bainIndustryClassification === form.bainIndustryClassification) && (
                    <p className="text-xs text-gray-500 mt-1">✓ From client history</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* DELIVERY */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => toggleSection('delivery')}
              className="text-blue-600 text-sm hover:underline flex items-center gap-1 font-medium"
            >
              {expandedSections.delivery ? '▼' : '▶'} Delivery
            </button>
            {expandedSections.delivery && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded">
                <div>
                  <label className="block text-gray-600 mb-1">Delivered Request (Components)</label>
                  <DeliverableTagSelector
                    value={form.deliveredRequest}
                    onChange={(value) => setForm({ ...form, deliveredRequest: value })}
                    existingCases={existingCases}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Date for Client Meeting</label>
                  <input type="date" name="dateForClientMeeting" value={form.dateForClientMeeting} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs" />
                </div>
              </div>
            )}
          </div>

          {/* COMMERCIAL / BILLING */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => toggleSection('commercial')}
              className="text-blue-600 text-sm hover:underline flex items-center gap-1 font-medium"
            >
              {expandedSections.commercial ? '▼' : '▶'} Commercial / Billing
            </button>
            {expandedSections.commercial && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Currency</label>
                    <select name="currency" value={form.currency} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs">
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="JPY">JPY - Japanese Yen</option>
                      <option value="INR">INR - Indian Rupee</option>
                      <option value="SGD">SGD - Singapore Dollar</option>
                      <option value="HKD">HKD - Hong Kong Dollar</option>
                      <option value="CNY">CNY - Chinese Yuan</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="CHF">CHF - Swiss Franc</option>
                      <option value="SEK">SEK - Swedish Krona</option>
                      <option value="NOK">NOK - Norwegian Krone</option>
                      <option value="DKK">DKK - Danish Krone</option>
                      <option value="NZD">NZD - New Zealand Dollar</option>
                      <option value="MXN">MXN - Mexican Peso</option>
                      <option value="BRL">BRL - Brazilian Real</option>
                      <option value="ZAR">ZAR - South African Rand</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Amount</label>
                    <input name="amount" value={form.amount} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Type</label>
                    <select name="type" value={form.type} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs">
                      <option value="">(Blank)</option>
                      <option value="Full">Full</option>
                      <option value="New IP">New IP</option>
                      <option value="Pre-CD">Pre-CD</option>
                      <option value="Short">Short</option>
                      <option value="Standard">Standard</option>
                      <option value="Very Short">Very Short</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Add-on IP Delivered</label>
                    <input name="addOnIpDelivered" value={form.addOnIpDelivered} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Add-ons Billing</label>
                    <input name="addOnsBilling" value={form.addOnsBilling} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Add-ons Only</label>
                    <input name="addOnsOnly" value={form.addOnsOnly} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Billing</label>
                    <input name="billing" value={form.billing} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ADDITIONAL REQUESTORS */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => toggleSection('additionalRequestors')}
              className="text-blue-600 text-sm hover:underline flex items-center gap-1 font-medium"
            >
              {expandedSections.additionalRequestors ? '▼' : '▶'} Additional Requestors
            </button>
            {expandedSections.additionalRequestors && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Additional Requestor 1</label>
                    <input name="additionalRequestor1" value={form.additionalRequestor1} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Additional Requestor 1 Level</label>
                    <input name="additionalRequestor1Level" value={form.additionalRequestor1Level} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Additional Requestor 2</label>
                    <input name="additionalRequestor2" value={form.additionalRequestor2} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Additional Requestor 2 Level</label>
                    <input name="additionalRequestor2Level" value={form.additionalRequestor2Level} onChange={handleChange} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* POST-DELIVERY */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => toggleSection('postDelivery')}
              className="text-blue-600 text-sm hover:underline flex items-center gap-1 font-medium"
            >
              {expandedSections.postDelivery ? '▼' : '▶'} Post-delivery
            </button>
            {expandedSections.postDelivery && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Post-delivery Reachouts?</label>
                    <input name="postDeliveryReachouts" value={form.postDeliveryReachouts} onChange={handleChange} placeholder="Yes/No" className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">Response Received?</label>
                    <input name="responseReceived" value={form.responseReceived} onChange={handleChange} placeholder="Yes/No" className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">Deck/Material Shared?</label>
                    <input name="deckMaterialShared" value={form.deckMaterialShared} onChange={handleChange} placeholder="Yes/No" className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Next Steps?</label>
                  <textarea name="nextSteps" value={form.nextSteps} onChange={handleChange} rows={2} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {editingCase ? 'Save Changes' : 'Add Request'}
        </button>
        <button
          type="button"
          onClick={handleCopyLast}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
        >
          Copy Last
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// DeliverableTagSelector Component
interface DeliverableTagSelectorProps {
  value: string
  onChange: (value: string) => void
  existingCases: Case[]
}

function DeliverableTagSelector({ value, onChange, existingCases }: DeliverableTagSelectorProps) {
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Parse current value into tags (split by "+", "and", and ",")
  const selectedTags = useMemo(() => {
    if (!value) return []
    return value
      .split(/\s*\+\s*|\s+and\s+|,\s*/i)
      .map(t => t.trim())
      .filter(t => t.length > 0)
  }, [value])

  // Extract all unique components from existing cases
  const allExistingComponents = useMemo(() => {
    const components = new Set<string>()
    
    existingCases.forEach(c => {
      if (c.deliveredRequest) {
        const parts = c.deliveredRequest
          .split(/\s*\+\s*|\s+and\s+|,\s*/i)
          .map(p => p.trim())
          .filter(p => p.length > 0)
        parts.forEach(p => components.add(p))
      }
    })
    
    return Array.from(components).sort()
  }, [existingCases])

  // Combine standard + existing components
  const allAvailableComponents = useMemo(() => {
    const combined = new Set([...STANDARD_DELIVERABLE_COMPONENTS, ...allExistingComponents])
    return Array.from(combined).sort()
  }, [allExistingComponents])

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return allAvailableComponents
    const search = inputValue.toLowerCase()
    return allAvailableComponents.filter(c => 
      c.toLowerCase().includes(search) && !selectedTags.includes(c)
    )
  }, [inputValue, allAvailableComponents, selectedTags])

  const addTag = (tag: string) => {
    if (!tag.trim() || selectedTags.includes(tag.trim())) return
    const newTags = [...selectedTags, tag.trim()]
    onChange(newTags.join(' + '))
    setInputValue('')
  }

  const removeTag = (tag: string) => {
    const newTags = selectedTags.filter(t => t !== tag)
    onChange(newTags.join(' + '))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      addTag(inputValue.trim())
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1])
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Tags */}
      <div className="min-h-[80px] border border-gray-300 rounded p-2 bg-white">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedTags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-blue-600 font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder={selectedTags.length === 0 ? "Click to select or type to search..." : "Add another component..."}
          className="w-full px-2 py-1 text-xs outline-none"
        />
      </div>

      {/* Dropdown with Options */}
      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
          {filteredSuggestions.length > 0 ? (
            <>
              {filteredSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    addTag(suggestion)
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
              
              {inputValue.trim() && !filteredSuggestions.includes(inputValue.trim()) && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    addTag(inputValue.trim())
                  }}
                  className="w-full text-left px-3 py-2 text-xs bg-green-50 hover:bg-green-100 font-medium text-green-800 border-t-2 border-green-200 cursor-pointer"
                >
                  + Add "{inputValue.trim()}" as new component
                </button>
              )}
            </>
          ) : (
            <div className="px-3 py-2 text-xs text-gray-500">
              {inputValue ? 'No matching components found' : 'No available components'}
            </div>
          )}
        </div>
      )}
      
      <p className="text-[10px] text-gray-500 mt-1">
        Click to select from list or type to search. Press Enter to add custom component.
      </p>
    </div>
  )
}
