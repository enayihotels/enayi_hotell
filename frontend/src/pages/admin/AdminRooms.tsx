import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Modal, Input, Textarea, Select, Badge } from '@/components/ui'
import { BedDouble, DoorOpen, Plus, Pencil, Trash2, LayoutGrid, Image as ImageIcon, Upload } from 'lucide-react'
import type { RoomCategory, Room, Amenity } from '@/types'

const BED_TYPES = ['single','double','queen','king','twin','suite']
const VIEW_TYPES = ['garden','city','pool','courtyard']
const ROOM_STATUSES: Room['status'][] = ['available','occupied','maintenance','reserved','cleaning','out_of_order']

const STATUS_BADGE: Record<Room['status'], 'green'|'red'|'gold'|'blue'|'gray'> = {
  available: 'green', occupied: 'blue', maintenance: 'red',
  reserved: 'gold', cleaning: 'gray', out_of_order: 'red',
}

type CategoryForm = {
  name: string; tagline: string; description: string;
  base_price: string; weekend_price: string; holiday_price: string;
  max_adults: string; max_children: string; bed_type: string;
  num_beds: string; room_size_sqm: string; num_bathrooms: string;
  has_living_room: boolean; has_kitchen: boolean; has_balcony: boolean; is_active: boolean;
  amenities: string[];
}
const emptyCategoryForm: CategoryForm = {
  name: '', tagline: '', description: '',
  base_price: '', weekend_price: '', holiday_price: '',
  max_adults: '2', max_children: '1', bed_type: 'king',
  num_beds: '1', room_size_sqm: '30', num_bathrooms: '1',
  has_living_room: false, has_kitchen: false, has_balcony: false, is_active: true,
  amenities: [],
}

type RoomForm = {
  room_number: string; category: string; hotel: string; floor: string;
  status: Room['status']; view_type: string; is_smoking: boolean; has_balcony: boolean;
}
const emptyRoomForm: RoomForm = {
  room_number: '', category: '', hotel: '', floor: '1',
  status: 'available', view_type: 'city', is_smoking: false, has_balcony: false,
}

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

export default function AdminRooms() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'categories' | 'rooms'>('categories')

  const { data: categories, isLoading: catsLoading } = useQuery<RoomCategory[]>({
    queryKey: ['admin-room-categories'], queryFn: () => api.get('/rooms/categories/').then(r => unwrapList(r.data)),
  })
  const { data: rooms, isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['admin-rooms'], queryFn: () => api.get('/rooms/list/').then(r => unwrapList(r.data)),
  })
  const { data: hotels } = useQuery<{ id: string; name: string; branch: string }[]>({
    queryKey: ['hotels'], queryFn: () => api.get('/hotels/').then(r => unwrapList(r.data)),
  })
  const { data: amenities } = useQuery<Amenity[]>({
    queryKey: ['amenities'], queryFn: () => api.get('/rooms/amenities/').then(r => unwrapList(r.data)),
  })

  // ── Category modal state ──
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<RoomCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm)

  // ── Room modal state ──
  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoomForm)

  // ── Photo management modal state ──
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [photoCategory, setPhotoCategory] = useState<RoomCategory | null>(null)
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null)

  const uploadPhotos = useMutation({
    mutationFn: () => {
      const form = new FormData()
      if (photoFiles) Array.from(photoFiles).forEach(f => form.append('images', f))
      return api.post(`/rooms/categories/${photoCategory!.id}/images/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-room-categories'] })
      toast.success(`${res.data?.uploaded ?? 0} photo(s) uploaded.`)
      setPhotoFiles(null)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deletePhoto = useMutation({
    mutationFn: (imageId: string) => api.delete(`/rooms/images/${imageId}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-room-categories'] }); toast.success('Photo deleted.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const saveCategory = useMutation({
    mutationFn: () => {
      const payload = { ...categoryForm }
      return editingCategory
        ? api.patch(`/rooms/categories/${editingCategory.slug}/`, payload)
        : api.post('/rooms/categories/', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-room-categories'] })
      toast.success(editingCategory ? 'Category updated.' : 'Category created.')
      setCategoryModalOpen(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteCategory = useMutation({
    mutationFn: (slug: string) => api.delete(`/rooms/categories/${slug}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-room-categories'] })
      toast.success('Category deleted.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const saveRoom = useMutation({
    mutationFn: () => {
      const payload = { ...roomForm, hotel: roomForm.hotel || null }
      return editingRoom
        ? api.patch(`/rooms/list/${editingRoom.id}/`, payload)
        : api.post('/rooms/list/', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rooms'] })
      toast.success(editingRoom ? 'Room updated.' : 'Room created.')
      setRoomModalOpen(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteRoom = useMutation({
    mutationFn: (id: string) => api.delete(`/rooms/list/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rooms'] })
      toast.success('Room deleted.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const openNewCategory = () => { setEditingCategory(null); setCategoryForm(emptyCategoryForm); setCategoryModalOpen(true) }
  const openEditCategory = (c: RoomCategory) => {
    setEditingCategory(c)
    setCategoryForm({
      name: c.name, tagline: c.tagline, description: c.description,
      base_price: String(c.base_price), weekend_price: String(c.weekend_price), holiday_price: String(c.holiday_price),
      max_adults: String(c.max_adults), max_children: String(c.max_children), bed_type: c.bed_type,
      num_beds: String(c.num_beds), room_size_sqm: String(c.room_size_sqm), num_bathrooms: String(c.num_bathrooms),
      has_living_room: c.has_living_room, has_kitchen: c.has_kitchen, has_balcony: c.has_balcony, is_active: c.is_active,
      amenities: c.amenities.map(a => a.id),
    })
    setCategoryModalOpen(true)
  }
  const openPhotoModal = (c: RoomCategory) => { setPhotoCategory(c); setPhotoFiles(null); setPhotoModalOpen(true) }
  const livePhotoCategory = categories?.find(c => c.id === photoCategory?.id) ?? photoCategory

  const openNewRoom = () => { setEditingRoom(null); setRoomForm(emptyRoomForm); setRoomModalOpen(true) }
  const openEditRoom = (r: Room) => {
    setEditingRoom(r)
    setRoomForm({
      room_number: r.room_number, category: r.category, hotel: r.hotel || '', floor: String(r.floor),
      status: r.status, view_type: r.view_type, is_smoking: r.is_smoking, has_balcony: r.has_balcony,
    })
    setRoomModalOpen(true)
  }

  if (catsLoading || roomsLoading) return <PageSpinner />

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Rooms</h1>
          <p className="text-enayi-muted text-sm">Manage room categories and individual rooms.</p>
        </div>
        <Button variant="gold" onClick={tab === 'categories' ? openNewCategory : openNewRoom}>
          <Plus size={14} /> {tab === 'categories' ? 'Add Category' : 'Add Room'}
        </Button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('categories')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='categories' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <LayoutGrid size={14} className="inline mr-1.5 -mt-0.5" /> Categories ({categories?.length ?? 0})
        </button>
        <button onClick={() => setTab('rooms')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='rooms' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <DoorOpen size={14} className="inline mr-1.5 -mt-0.5" /> Rooms ({rooms?.length ?? 0})
        </button>
      </div>

      {tab === 'categories' && (
        (categories||[]).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={BedDouble} title="No room categories yet" desc="Add your first one to get started." /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories!.map(c => (
              <div key={c.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-enayi-text font-medium">{c.name}</div>
                    <div className="text-enayi-muted text-xs">{c.tagline}</div>
                  </div>
                  {!c.is_active && <Badge variant="gray">Inactive</Badge>}
                </div>
                <div className="text-enayi-gold font-semibold">{formatCurrency(c.base_price)}<span className="text-enayi-muted text-xs font-normal"> / night</span></div>
                <div className="text-enayi-muted text-xs">{c.max_adults} adults · {c.num_beds} bed(s) · {c.num_bathrooms} bath · {c.room_size_sqm}m² · {c.available_rooms} room(s)</div>
                <div className="flex gap-2 pt-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => openEditCategory(c)}><Pencil size={12} /> Edit</Button>
                  <Button size="sm" variant="surface" onClick={() => openPhotoModal(c)}><ImageIcon size={12} /> Photos ({c.images?.length ?? 0})</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteCategory.mutate(c.slug) }}><Trash2 size={12} /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'rooms' && (
        (rooms||[]).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={DoorOpen} title="No rooms yet" desc="Add your first room to get started." /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms!.map(r => (
              <div key={r.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-enayi-text font-medium">Room {r.room_number}</div>
                    <div className="text-enayi-muted text-xs">{r.category_name} · Floor {r.floor}{r.branch_name ? ` · ${r.branch_name}` : ''}</div>
                  </div>
                  <Badge variant={STATUS_BADGE[r.status]}>{r.status.replace('_',' ')}</Badge>
                </div>
                <div className="text-enayi-gold font-semibold text-sm">{formatCurrency(Number(r.current_price))}<span className="text-enayi-muted text-xs font-normal"> / night</span></div>
                <div className="text-enayi-muted text-xs capitalize">{r.view_type} view{r.is_smoking ? ' · Smoking' : ''}{r.has_balcony ? ' · Balcony' : ''}</div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEditRoom(r)}><Pencil size={12} /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete Room ${r.room_number}?`)) deleteRoom.mutate(r.id) }}><Trash2 size={12} /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Category modal ── */}
      <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={editingCategory ? 'Edit Category' : 'Add Category'} size="md">
        <div className="space-y-4">
          <Input label="Name" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} />
          <Input label="Tagline" value={categoryForm.tagline} onChange={e => setCategoryForm({...categoryForm, tagline: e.target.value})} />
          <Textarea label="Description" value={categoryForm.description} onChange={e => setCategoryForm({...categoryForm, description: e.target.value})} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Base price (₦)" type="number" value={categoryForm.base_price} onChange={e => setCategoryForm({...categoryForm, base_price: e.target.value})} />
            <Input label="Weekend price (₦)" type="number" value={categoryForm.weekend_price} onChange={e => setCategoryForm({...categoryForm, weekend_price: e.target.value})} />
            <Input label="Holiday price (₦)" type="number" value={categoryForm.holiday_price} onChange={e => setCategoryForm({...categoryForm, holiday_price: e.target.value})} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Max adults" type="number" value={categoryForm.max_adults} onChange={e => setCategoryForm({...categoryForm, max_adults: e.target.value})} />
            <Input label="Max children" type="number" value={categoryForm.max_children} onChange={e => setCategoryForm({...categoryForm, max_children: e.target.value})} />
            <Select label="Bed type" value={categoryForm.bed_type} onChange={e => setCategoryForm({...categoryForm, bed_type: e.target.value})}>
              {BED_TYPES.map(b => <option key={b} value={b} className="capitalize">{b}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Num beds" type="number" value={categoryForm.num_beds} onChange={e => setCategoryForm({...categoryForm, num_beds: e.target.value})} />
            <Input label="Size (m²)" type="number" value={categoryForm.room_size_sqm} onChange={e => setCategoryForm({...categoryForm, room_size_sqm: e.target.value})} />
            <Input label="Bathrooms" type="number" value={categoryForm.num_bathrooms} onChange={e => setCategoryForm({...categoryForm, num_bathrooms: e.target.value})} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-enayi-text">
            {(['has_living_room','has_kitchen','has_balcony','is_active'] as const).map(field => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={categoryForm[field]} onChange={e => setCategoryForm({...categoryForm, [field]: e.target.checked})} />
                {field === 'has_living_room' ? 'Living room' : field === 'has_kitchen' ? 'Kitchen' : field === 'has_balcony' ? 'Balcony' : 'Active (visible to guests)'}
              </label>
            ))}
          </div>
          {(amenities?.length ?? 0) > 0 && (
            <div>
              <div className="text-enayi-muted text-xs font-semibold uppercase mb-2">Amenities</div>
              <div className="flex flex-wrap gap-3 text-sm text-enayi-text max-h-32 overflow-y-auto">
                {amenities!.map(a => (
                  <label key={a.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoryForm.amenities.includes(a.id)}
                      onChange={e => setCategoryForm({
                        ...categoryForm,
                        amenities: e.target.checked
                          ? [...categoryForm.amenities, a.id]
                          : categoryForm.amenities.filter(id => id !== a.id),
                      })}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={saveCategory.isPending} onClick={() => saveCategory.mutate()} disabled={!categoryForm.name || !categoryForm.base_price}>
              {editingCategory ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Room modal ── */}
      <Modal open={roomModalOpen} onClose={() => setRoomModalOpen(false)} title={editingRoom ? 'Edit Room' : 'Add Room'} size="sm">
        <div className="space-y-4">
          <Input label="Room number" value={roomForm.room_number} onChange={e => setRoomForm({...roomForm, room_number: e.target.value})} />
          <Select label="Category" value={roomForm.category} onChange={e => setRoomForm({...roomForm, category: e.target.value})}>
            <option value="">Select category…</option>
            {(categories||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Branch" value={roomForm.hotel} onChange={e => setRoomForm({...roomForm, hotel: e.target.value})}>
            <option value="">No specific branch</option>
            {(hotels||[]).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Floor" type="number" value={roomForm.floor} onChange={e => setRoomForm({...roomForm, floor: e.target.value})} />
            <Select label="Status" value={roomForm.status} onChange={e => setRoomForm({...roomForm, status: e.target.value as Room['status']})}>
              {ROOM_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.replace('_',' ')}</option>)}
            </Select>
          </div>
          <Select label="View" value={roomForm.view_type} onChange={e => setRoomForm({...roomForm, view_type: e.target.value})}>
            {VIEW_TYPES.map(v => <option key={v} value={v} className="capitalize">{v}</option>)}
          </Select>
          <div className="flex gap-4 text-sm text-enayi-text">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={roomForm.is_smoking} onChange={e => setRoomForm({...roomForm, is_smoking: e.target.checked})} /> Smoking
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={roomForm.has_balcony} onChange={e => setRoomForm({...roomForm, has_balcony: e.target.checked})} /> Balcony
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setRoomModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={saveRoom.isPending} onClick={() => saveRoom.mutate()} disabled={!roomForm.room_number || !roomForm.category}>
              {editingRoom ? 'Save changes' : 'Create room'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Photo management modal ── */}
      <Modal open={photoModalOpen} onClose={() => setPhotoModalOpen(false)} title={`Photos — ${livePhotoCategory?.name ?? ''}`} size="md">
        {livePhotoCategory && (
          <div className="space-y-4">
            {(livePhotoCategory.images?.length ?? 0) === 0 ? (
              <div className="text-enayi-muted text-sm text-center py-6">No photos yet.</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {livePhotoCategory.images!.map(img => (
                  <div key={img.id} className="relative group">
                    <img src={img.image_url} alt={img.caption} className="w-full aspect-square object-cover rounded-lg" />
                    {img.is_primary && <span className="absolute top-1 left-1 badge-gold text-[10px] px-1.5 py-0.5">Primary</span>}
                    <button
                      onClick={() => { if (confirm('Delete this photo?')) deletePhoto.mutate(img.id) }}
                      className="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-enayi-border rounded-lg p-5 cursor-pointer text-center hover:border-enayi-gold/40 transition-colors">
              <Upload size={18} className="text-enayi-muted" />
              <span className="text-xs text-enayi-muted">{photoFiles?.length ? `${photoFiles.length} file(s) selected` : 'Choose one or more photos'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => setPhotoFiles(e.target.files)} />
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setPhotoModalOpen(false)}>Close</Button>
              <Button variant="gold" loading={uploadPhotos.isPending} onClick={() => uploadPhotos.mutate()} disabled={!photoFiles?.length}>
                Upload
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
