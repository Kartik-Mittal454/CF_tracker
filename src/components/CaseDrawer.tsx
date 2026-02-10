'use client'

import { useState } from 'react'
import { Case } from '@/app/page'
import { formatDateSafe, isActiveStatus, parseDateInput, normalizeStatus, canonicalStatuses } from '@/lib/caseUtils'
import { getStatusStyle } from '@/lib/styles'

interface CaseDrawerProps {
  caseItem: Case
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
  onEdit: () => void
  onDelete: (id: string) => void
  onAddComment: (id: string, text: string) => void
  onSendReminder: (item: Case) => void
}

const safeFormatDate = (date: string | number | Date | undefined) => formatDateSafe(date, 'dd-MMM-yyyy') || '-'

export default function CaseDrawer({
  caseItem,
  onClose,
  onStatusChange,
  onEdit,
  onDelete,
  onAddComment,
  onSendReminder,
}: CaseDrawerProps) {
  const [commentText, setCommentText] = useState('')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const promised = parseDateInput(caseItem.promisedDateForDelivery)
  const isOverdue = promised && isActiveStatus(caseItem.status) && promised < today
  const overdueDays = isOverdue ? Math.floor((today.getTime() - promised!.getTime()) / (1000 * 60 * 60 * 24)) : 0

  const rawStatus = (caseItem.status || '').trim()
  const normalizedStatus = normalizeStatus(caseItem.status)
  const selectedStatus = canonicalStatuses.includes(rawStatus)
    ? rawStatus
    : normalizedStatus || rawStatus || 'Not confirmed'

  const received = parseDateInput(caseItem.dateReceived)
  const daysOpen = received ? Math.floor((today.getTime() - received.getTime()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b-4 border-blue-500 px-6 py-4 flex justify-between items-center shadow-xl">
          <div>
            <p className="text-xs font-medium text-blue-200 uppercase tracking-wider">📋 Request Details</p>
            <p className="text-xl font-bold bg-gradient-to-r from-blue-300 to-white bg-clip-text text-transparent">{caseItem.billingCaseCode || 'N/A'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSendReminder(caseItem)}
              className="px-3 py-2 text-sm rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
              title="Send reminder email"
            >
              🔔 Reminder
            </button>
            <button onClick={onEdit} disabled={caseItem.status === 'Closed'} className={`px-3 py-2 text-sm rounded-xl font-medium shadow-lg transition-all duration-200 ${caseItem.status === 'Closed' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-xl'}`}>
              ✏️ Edit
            </button>
            <button onClick={onClose} className="text-white hover:text-blue-200 text-2xl font-bold transition-colors duration-200 ml-2">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Overdue Alert */}
          {isOverdue && (
            <div className="bg-gradient-to-r from-red-50 via-red-100 to-red-50 border-2 border-red-400 rounded-xl p-4 flex items-center gap-3 shadow-lg animate-pulse">
              <span className="text-2xl">⚠️</span>
              <span className="text-red-700 font-bold text-lg">Overdue by {overdueDays} days</span>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">🎯 Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => onStatusChange(caseItem.id, e.target.value as Case['status'])}
              disabled={caseItem.status === 'Closed'}
              className={`w-full px-4 py-3 rounded-xl border-2 font-bold text-base shadow-lg transition-all duration-200 ${getStatusStyle(caseItem.status)} ${caseItem.status === 'Closed' ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl cursor-pointer'}`}
            >
              {canonicalStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* A) CORE */}
          <Section title="⭐ Core Information">
            <Field label="Client" value={caseItem.client || '-'} />
            <Field label="Team" value={caseItem.team || '-'} />
            <Field label="Requestor" value={caseItem.requestor || '-'} />
            <Field label="Date Received" value={safeFormatDate(caseItem.dateReceived)} />
            <Field label="Days Open" value={`${daysOpen} days`} />
            <Field label="Priority Level" value={caseItem.priorityLevel || '-'} highlight={caseItem.priorityLevel === 'High' ? 'red' : undefined} />
          </Section>

          {/* B) REQUESTOR & GEOGRAPHY */}
          {(caseItem.level || caseItem.office || caseItem.region) && (
            <Section title="🌍 Geography">
              {caseItem.level && <Field label="Level" value={caseItem.level} />}
              {caseItem.office && <Field label="Office" value={caseItem.office} />}
              {caseItem.region && <Field label="Region" value={caseItem.region} />}
            </Section>
          )}

          {/* C) CLASSIFICATION */}
          {caseItem.industry && (
            <Section title="🏢 Industry">
              <Field label="Industry" value={caseItem.industry} />
            </Section>
          )}

          {/* D) DELIVERY */}
          <Section title="📦 Delivery">
            <Field label="Scope of Request" value={caseItem.scopeOfRequest || '-'} />
            <Field label="Promised Date" value={safeFormatDate(caseItem.promisedDateForDelivery)} highlight={isOverdue ? 'red' : undefined} />
            {caseItem.actualDateForDelivery && <Field label="Actual Delivery Date" value={safeFormatDate(caseItem.actualDateForDelivery)} />}
          </Section>

          {/* E) COMMERCIAL / BILLING */}
          {(caseItem.currency || caseItem.amount || caseItem.billing) && (
            <Section title="💰 Commercial / Billing">
              {caseItem.currency && <Field label="Currency" value={caseItem.currency} />}
              {caseItem.amount && <Field label="Amount" value={caseItem.amount} />}
              {caseItem.billing && <Field label="Billing Status" value={caseItem.billing} />}
            </Section>
          )}

          {/* F) ADDITIONAL REQUESTORS */}
          {(caseItem.additionalRequestor1 || caseItem.additionalRequestor2) && (
            <Section title="Additional Requestors">
              {caseItem.additionalRequestor1 && <Field label="Additional Requestor 1" value={caseItem.additionalRequestor1} />}
              {caseItem.additionalRequestor1Level && <Field label="Additional Requestor 1 Level" value={caseItem.additionalRequestor1Level} />}
              {caseItem.additionalRequestor2 && <Field label="Additional Requestor 2" value={caseItem.additionalRequestor2} />}
              {caseItem.additionalRequestor2Level && <Field label="Additional Requestor 2 Level" value={caseItem.additionalRequestor2Level} />}
            </Section>
          )}





          {/* COMMENTS */}
          <Section title="💬 Comments">
            <div className="space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                placeholder="Add a comment..."
                className="w-full px-4 py-3 text-sm border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => { onAddComment(caseItem.id, commentText); setCommentText('') }}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-xl font-medium shadow-lg hover:shadow-xl hover:from-slate-800 hover:to-black transition-all duration-200"
                >
                  💬 Add Comment
                </button>
              </div>
              {caseItem.comments && caseItem.comments.length > 0 ? (
                <div className="space-y-2">
                  {caseItem.comments.slice(0, 5).map((c, idx) => (
                    <div key={`${c.date}-${idx}`} className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-3 text-sm text-slate-700 border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-medium mb-1">{safeFormatDate(c.date)}</div>
                      <div>{c.text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No comments yet.</p>
              )}
            </div>
          </Section>

        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t-2 border-slate-200 pt-4 mt-4">
      <p className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: 'red' }) {
  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-3 border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <p className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-bold ${highlight === 'red' ? 'text-red-600' : 'text-slate-800'}`}>
        {value || '-'}
      </p>
    </div>
  )
}
