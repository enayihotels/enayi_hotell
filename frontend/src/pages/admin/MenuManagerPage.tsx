import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Badge } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { Camera, UtensilsCrossed, Wine, Loader2 } from 'lucide-react'
import type { MenuCategory, MenuItem } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

// Mirrors DRINK_TYPES / FOOD_TYPES in apps/orders/views.py — kept as a
// simple duplicate here rather than fetched from the API, since it's
// only used to decide which items THIS staff member's role owns, and
// the backend's _can_manage_menu_item() is the real source of truth
// that actually enforces it (a 403 there is the real guard, this is
// just so the page doesn't show items a role can't touch anyway).
const DRINK_TYPES = new Set(['drink', 'cocktail', 'mocktail', 'wine'])
const FOOD_TYPES = new Set(['food', 'breakfast', 'dessert', 'snack'])

export default function MenuManagerPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const isBar = user?.role === 'bar_staff'
  const isKitchen = user?.role === 'kitchen_staff'
  // Manager/Admin can see everything at their branch; Bar/Kitchen Staff
  // only their own department's items — matches _can_manage_menu_item()
  // on the backend, which is what actually enforces this on save.
  const ownedTypes = isBar ? DRINK_TYPES : isKitchen ? FOOD_TYPES : null

  const { data: cats, isLoading: catsLoading } = useQuery<MenuCategory[]>({
    queryKey: ['menu-categories'],
    queryFn: () => api.get('/orders/menu/categories/').then(r => unwrapList(r.data)),
  })

  const { data: items, isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: ['menu-items-manage'],
    queryFn: () => api.get('/orders/menu/items/').then(r => unwrapList(r.data)),
  })

  const toggleAvailable = useMutation({
    mutationFn: ({ id, is_available }: { id: string; is_available: boolean }) => {
      const form = new FormData()
      form.append('is_available', String(is_available))
      return api.patch(`/orders/menu/items/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items-manage'] })
      toast.success('Availability updated.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const uploadPhoto = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData()
      form.append('image', file)
      return api.patch(`/orders/menu/items/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onMutate: ({ id }) => setUploadingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items-manage'] })
      toast.success('Photo updated.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
    onSettled: () => setUploadingId(null),
  })

  const handleFileChange = (item: MenuItem, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file next time
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB.'); return }
    uploadPhoto.mutate({ id: item.id, file })
  }

  if (catsLoading || itemsLoading) return <PageSpinner />

  const categoryById = new Map((cats || []).map(c => [c.id, c]))
  const visibleItems = (items || []).filter(item => {
    if (!ownedTypes) return true // manager/admin see everything
    const cat = categoryById.get(item.category)
    return cat ? ownedTypes.has(cat.type) : false
  })

  // Group by category so the page reads the same way the guest menu does
  const grouped = new Map<string, MenuItem[]>()
  for (const item of visibleItems) {
    const list = grouped.get(item.category) || []
    list.push(item)
    grouped.set(item.category, list)
  }
  const orderedCategoryIds = (cats || [])
    .filter(c => grouped.has(c.id))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => c.id)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Menu Manager</h1>
        <p className="text-enayi-muted text-sm">
          Toggle availability and update photos for {isBar ? 'drinks' : isKitchen ? 'food' : 'menu'} items — changes appear on the guest menu immediately.
        </p>
      </div>

      {visibleItems.length === 0 ? (
        <div className="card p-8 text-center">
          <EmptyState
            icon={isBar ? Wine : UtensilsCrossed}
            title="No items to manage"
            desc="Nothing is assigned to your department at this branch yet."
          />
        </div>
      ) : (
        orderedCategoryIds.map(catId => {
          const cat = categoryById.get(catId)!
          const catItems = (grouped.get(catId) || []).slice().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
          return (
            <div key={catId}>
              <h2 className="font-heading text-lg text-enayi-text mb-3 capitalize">
                {cat.name} <span className="text-enayi-muted text-sm font-normal">({catItems.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catItems.map(item => (
                  <div key={item.id} className={`card p-4 ${!item.is_available ? 'opacity-70' : ''}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => fileInputRefs.current[item.id]?.click()}
                        disabled={uploadPhoto.isPending && uploadingId === item.id}
                        className="relative w-16 h-16 rounded-xl bg-enayi-panel border border-enayi-border flex-shrink-0 overflow-hidden group"
                        title="Change photo"
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-enayi-muted">
                            <Camera size={18} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {uploadPhoto.isPending && uploadingId === item.id
                            ? <Loader2 size={16} className="text-white animate-spin" />
                            : <Camera size={16} className="text-white" />}
                        </div>
                      </button>
                      <input
                        ref={el => { fileInputRefs.current[item.id] = el }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(item, e)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-enayi-text text-sm truncate">{item.name}</div>
                        <div className="text-enayi-gold text-sm">{formatCurrency(item.price)}</div>
                        <div className="mt-1.5">
                          {item.is_available
                            ? <Badge variant="green">Available</Badge>
                            : <Badge variant="red">Unavailable</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={item.is_available ? 'outline' : 'gold'}
                      className="w-full mt-3"
                      loading={toggleAvailable.isPending}
                      onClick={() => toggleAvailable.mutate({ id: item.id, is_available: !item.is_available })}
                    >
                      Mark {item.is_available ? 'Unavailable' : 'Available'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
