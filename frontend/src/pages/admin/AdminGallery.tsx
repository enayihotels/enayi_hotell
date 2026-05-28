import { PageSpinner } from '@/components/ui'
import { useQuery } from '@tanstack/react-query'
import api from '@/utils/api'
export default function AdminPage() {
  const { isLoading } = useQuery({ queryKey: ['admin-data'], queryFn: () => api.get('/rooms/categories/').then(r=>r.data).catch(()=>[]) })
  if (isLoading) return <PageSpinner />
  return <div className="p-6"><h1 className="font-display text-3xl text-enayi-text">Admin Management</h1><p className="text-enayi-muted text-sm mt-2">Full CRUD management coming soon.</p></div>
}
