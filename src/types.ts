export type RequestStatus = 'Pending' | 'In Progress' | 'Resolved'

export type Profile = {
  id: string
  full_name: string
  role: 'citizen' | 'admin'
}

export type ServiceRequest = {
  id: string
  user_id: string
  reference_number: string
  category: string
  location: string
  latitude: number | null
  longitude: number | null
  description: string
  image_path: string | null
  status: RequestStatus
  created_at: string
}

export type DashboardPage = 'requests' | 'new-request' | 'admin'
