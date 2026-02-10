// Sample data generator for testing all functionalities
// ~200 realistic case records with varied statuses, teams, clients, and fields

import { Case } from '@/app/actions'

const teams = ['Strategy', 'Operations', 'Digital', 'Finance', 'Supply Chain', 'HR', 'Marketing', 'Technology']
const clients = ['Acme Corp', 'TechFlow Inc', 'RetailCo', 'FinanceHub', 'MediCare Ltd', 'EcoEnergy', 'CloudBase', 'GlobalTrade', 'MegaRetail', 'InnovateTech', 'SustainHQ', 'DataSoft', 'SecureNet', 'BioLabs', 'EduConnect']
const offices = ['New York', 'London', 'San Francisco', 'Chicago', 'Toronto', 'Mumbai', 'Singapore', 'Sydney', 'Dubai', 'Tokyo']
const regions = ['North America', 'Europe', 'APAC', 'Middle East', 'South America']
const requestors = ['John Smith', 'Sarah Johnson', 'Michael Chen', 'Emma Williams', 'David Brown', 'Lisa Anderson', 'James Martin', 'Patricia Taylor', 'Robert Garcia', 'Jennifer Lee', 'Mark Wilson', 'Rachel Martinez']
const levels = ['C-Suite', 'VP', 'Director', 'Manager', 'Senior Manager']
const industries = ['Technology', 'Retail', 'Financial Services', 'Healthcare', 'Manufacturing', 'Energy', 'Consumer Goods', 'Telecom', 'Media', 'Pharma']
const statuses = ['Not confirmed', 'In Progress', 'In Pipeline', 'Delivered', 'Cancelled', 'Closed', 'On Hold', 'Pending Review']
const priorities = ['P1', 'P2', 'P3', 'P4', 'Low', 'Medium', 'High', 'Critical']
const types = ['Strategy Study', 'Implementation', 'Diagnostic', 'Training', 'New IP', 'Bench Learning', 'Ongoing']

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getRandomDate(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  return date.toISOString().split('T')[0]
}

function getRandomFutureDate(daysAhead: number): string {
  const date = new Date()
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead))
  return date.toISOString().split('T')[0]
}

function generateSampleCases(count: number = 200): Case[] {
  const cases: Case[] = []

  for (let i = 1; i <= count; i++) {
    const status = getRandomElement(statuses)
    const dateReceived = getRandomDate(120)
    const hasDeliveryDate = Math.random() > 0.2 // 80% have promised dates
    const promisedDate = hasDeliveryDate ? getRandomFutureDate(60) : undefined
    const isDelivered = status === 'Delivered' || status === 'Closed'
    const actualDate = isDelivered && promisedDate ? getRandomFutureDate(10) : undefined

    const scopeOptions = [
      'Market analysis and competitive landscape',
      'Digital transformation roadmap',
      'Supply chain optimization',
      'Customer experience improvement',
      'Operational efficiency review',
      'Pricing strategy analysis',
      'Technology infrastructure assessment',
      'Organizational restructuring',
      'M&A integration planning',
      'Revenue growth strategy',
      'Cost reduction initiative',
      'Process improvement program',
    ]

    const deliveredOptions = [
      'Executive presentation with recommendations',
      'Detailed implementation plan',
      'Technical assessment report',
      'Strategic roadmap document',
      'Training materials and workshops',
      'Process redesign documentation',
      'Market analysis report',
      'Financial model and projections',
    ]

    cases.push({
      id: `case-${String(i).padStart(4, '0')}`,
      billingCaseCode: `CASE-${String(i).padStart(5, '0')}`,
      cdClient: `CD-${getRandomElement(clients).substring(0, 3)}-${String(i).padStart(3, '0')}`,
      dateReceived,
      team: getRandomElement(teams),
      status,
      requestor: getRandomElement(requestors),
      npsFlag: Math.random() > 0.8 ? 'Yes' : '',
      level: getRandomElement(levels),
      office: getRandomElement(offices),
      region: getRandomElement(regions),
      client: getRandomElement(clients),
      priorityLevel: getRandomElement(priorities),
      industry: getRandomElement(industries),
      bainIndustryClassification: getRandomElement(industries),
      scopeOfRequest: getRandomElement(scopeOptions),
      deliveredRequest: isDelivered ? getRandomElement(deliveredOptions) : '',
      promisedDateForDelivery: promisedDate,
      actualDateForDelivery: actualDate,
      dateForClientMeeting: Math.random() > 0.7 ? getRandomFutureDate(30) : undefined,
      currency: 'USD',
      amount: String(Math.floor(Math.random() * 500000) + 50000),
      type: getRandomElement(types),
      addOnIpDelivered: Math.random() > 0.7 ? 'New IP' : '',
      addOnsBilling: Math.random() > 0.8 ? 'Add-ons' : '',
      addOnsOnly: '',
      billing: Math.random() > 0.6 ? 'Billed' : 'Pending',
      additionalRequestor1: Math.random() > 0.6 ? getRandomElement(requestors) : '',
      additionalRequestor1Level: Math.random() > 0.6 ? getRandomElement(levels) : '',
      additionalRequestor2: Math.random() > 0.8 ? getRandomElement(requestors) : '',
      additionalRequestor2Level: Math.random() > 0.8 ? getRandomElement(levels) : '',
      postDeliveryReachouts: Math.random() > 0.7 ? 'Email follow-up sent' : '',
      responseReceived: Math.random() > 0.8 ? 'Yes' : 'No',
      deckMaterialShared: Math.random() > 0.7 ? 'Yes' : 'No',
      nextSteps: Math.random() > 0.6 ? 'Awaiting client feedback on recommendations' : '',
      createdAt: dateReceived,
      updatedAt: new Date().toISOString(),
      comments: [],
      activityLog: [],
    })
  }

  return cases
}

export const SAMPLE_CASES = generateSampleCases(200)
