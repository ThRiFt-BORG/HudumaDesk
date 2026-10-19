import type { RequestStatus } from '../types'

export const SERVICE_CATEGORIES = [
  'Roads & Transport',
  'Water & Sewage',
  'Waste Collection',
  'Public Health',
  'Street Lighting',
  'Drainage',
  'Other',
] as const

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function statusClass(status: RequestStatus) {
  return status.toLowerCase().replaceAll(' ', '-')
}

export function readableError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message)
  }
  return 'Something went wrong. Please try again.'
}
