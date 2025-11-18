import axios from 'axios'

// Determine API base URL - use environment variable or default to proxy
const API_BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_BASE,
})

export async function getFunnel(start, end) {
  const { data } = await api.get('/api/funnel', { params: { start, end } })
  return data
}

export async function getEventSummary(start, end) {
  const { data } = await api.get('/api/event-summary', { params: { start, end } })
  return data
}

export async function getActiveUsers(start, end) {
  const { data } = await api.get('/api/active-users', { params: { start, end } })
  return data
}

export async function getRetention(start, end) {
  const { data } = await api.get('/api/retention', { params: { start, end } })
  return data
}

export async function getEngagementReport(start, end) {
  const { data } = await api.get('/api/engagement-report', { params: { start, end } })
  return data
}


