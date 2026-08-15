import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import { PageSpinner, EmptyState, Button, Modal, Input, Textarea, Select, Badge } from '@/components/ui'
import { Package, Plus, Pencil, Trash2, LayoutGrid, AlertTriangle, ArrowUpCircle, ArrowDownCircle, ClipboardList, Check, X, UtensilsCrossed, Building2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { InventoryCategory, InventoryItem, StockLocation, StockRequisition, MenuCategory } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

const UNITS = ['bottle','can','crate','carton','bag','kg','litre','piece','pack','roll','bunch','box']

type CategoryForm = { name: string; slug: string; description: string; is_active: boolean }
const emptyCategoryForm: CategoryForm = { name: '', slug: '', description: '', is_active: true }

type ItemForm = { name: string; category: string; unit: string; cost_price: string; sale_price: string; reorder_threshold: string; expiry_tracked: boolean; is_active: boolean }
const emptyItemForm: ItemForm = { name: '', category: '', unit: 'piece', cost_price: '', sale_price: '', reorder_threshold: '5', expiry_tracked: false, is_active: true }

const LOCATION_LABEL: Record<StockLocation, string> = { store: 'Store', bar: 'Bar', kitchen: 'Kitchen' }

export default function AdminInventory() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  // What location this account owns for stock adjustment, if any.
  const ownLocation: StockLocation | null =
    user?.role === 'store_keeper' ? 'store' :
    user?.role === 'bar_staff'    ? 'bar' :
    user?.role === 'kitchen_staff' ? 'kitchen' : null

  const isAdmin = user?.role === 'admin'
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const canManageCatalog = user?.role === 'store_keeper' || isManagerOrAdmin
  const canRequest = user?.role === 'bar_staff' || user?.role === 'kitchen_staff'
  const canFulfill = user?.role === 'store_keeper' || isManagerOrAdmin

  const [tab, setTab] = useState<'stock' | 'categories' | 'requests'>('stock')
  const [locationFilter, setLocationFilter] = useState<StockLocation | 'all'>(ownLocation ?? 'all')
  // Only the Owner operates across every branch — everyone else (including
  // Manager) is scoped server-side to their own account's branch already,
  // so this selector only ever renders for Admin.
  const [hotelFilter, setHotelFilter] = useState<string>('')

  const { data: hotels } = useQuery<any[]>({
    queryKey: ['hotels-for-inventory'],
    queryFn: () => api.get('/hotels/').then(r => unwrapList(r.data)),
    enabled: isAdmin,
  })

  useEffect(() => {
    if (isAdmin && !hotelFilter && hotels && hotels.length > 0) {
      setHotelFilter(hotels[0].id)
    }
  }, [isAdmin, hotelFilter, hotels])

  const { data: categories, isLoading: catsLoading } = useQuery<InventoryCategory[]>({
    queryKey: ['inventory-categories', hotelFilter],
    queryFn: () => api.get('/inventory/categories/', { params: hotelFilter ? { hotel: hotelFilter } : {} }).then(r => unwrapList(r.data)),
  })
  const { data: items, isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory-items', hotelFilter],
    queryFn: () => api.get('/inventory/items/', { params: hotelFilter ? { hotel: hotelFilter } : {} }).then(r => unwrapList(r.data)),
  })
  const { data: requisitions, isLoading: reqLoading } = useQuery<StockRequisition[]>({
    queryKey: ['inventory-requisitions', hotelFilter],
    queryFn: () => api.get('/inventory/requisitions/', { params: hotelFilter ? { hotel: hotelFilter } : {} }).then(r => unwrapList(r.data)),
    enabled: canRequest || canFulfill,
  })
  const { data: menuCategories } = useQuery<MenuCategory[]>({
    queryKey: ['menu-categories-for-listing', hotelFilter, user?.hotel],
    queryFn: () => api.get('/orders/menu/categories/', { params: { hotel: isAdmin ? hotelFilter : user?.hotel } }).then(r => unwrapList(r.data)),
    enabled: canManageCatalog,
  })

  // ── List on Guest Menu ──
  const [listTarget, setListTarget] = useState<InventoryItem | null>(null)
  const [listCategoryMode, setListCategoryMode] = useState<'existing' | 'new'>('existing')
  const [listCategoryId, setListCategoryId] = useState('')
  const [listNewCategoryName, setListNewCategoryName] = useState('')
  const [listNewCategoryType, setListNewCategoryType] = useState('drink')
  const [listPrice, setListPrice] = useState('')
  const [listDescription, setListDescription] = useState('')

  const listOnMenu = useMutation({
    mutationFn: () => api.post(`/inventory/items/${listTarget!.id}/list-on-menu/`, {
      ...(listCategoryMode === 'existing'
        ? { menu_category_id: listCategoryId }
        : { new_category_name: listNewCategoryName, new_category_type: listNewCategoryType }),
      guest_price: parseFloat(listPrice),
      description: listDescription,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['menu-categories-for-listing'] })
      toast.success(res.data?.message || 'Listed on the guest menu.')
      setListTarget(null); setListCategoryId(''); setListNewCategoryName(''); setListPrice(''); setListDescription('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const openListOnMenu = (it: InventoryItem) => {
    setListTarget(it)
    setListCategoryMode('existing')
    setListCategoryId('')
    setListNewCategoryName('')
    setListNewCategoryType('drink')
    setListPrice(it.sale_price !== null ? String(it.sale_price) : '')
    setListDescription(it.name)
  }

  // ── Requisitions: request + fulfill/reject ──
  const [reqModalOpen, setReqModalOpen] = useState(false)
  const [reqItem, setReqItem] = useState('')
  const [reqQty, setReqQty] = useState('')
  const [reqNote, setReqNote] = useState('')

  const createRequisition = useMutation({
    mutationFn: () => api.post('/inventory/requisitions/', { item: reqItem, quantity_requested: parseFloat(reqQty), note_from_requester: reqNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-requisitions'] })
      toast.success('Request sent to the Store Keeper.')
      setReqModalOpen(false); setReqItem(''); setReqQty(''); setReqNote('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const [decideTarget, setDecideTarget] = useState<StockRequisition | null>(null)
  const [decideQty, setDecideQty] = useState('')
  const [decideNote, setDecideNote] = useState('')

  const decideRequisition = useMutation({
    mutationFn: (action: 'fulfill' | 'reject') => api.post(`/inventory/requisitions/${decideTarget!.id}/decide/`, {
      action, quantity_fulfilled: action === 'fulfill' ? parseFloat(decideQty) : undefined, note: decideNote,
    }),
    onSuccess: (_, action) => {
      qc.invalidateQueries({ queryKey: ['inventory-requisitions'] })
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      toast.success(action === 'fulfill' ? 'Marked as fulfilled — stock moved.' : 'Request rejected.')
      setDecideTarget(null); setDecideQty(''); setDecideNote('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Category CRUD ──
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<InventoryCategory | null>(null)
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategoryForm)

  const openNewCat = () => { setEditingCat(null); setCatForm(emptyCategoryForm); setCatModalOpen(true) }
  const openEditCat = (c: InventoryCategory) => { setEditingCat(c); setCatForm({ name: c.name, slug: c.slug, description: c.description, is_active: c.is_active }); setCatModalOpen(true) }

  const saveCat = useMutation({
    mutationFn: () => editingCat
      ? api.patch(`/inventory/categories/${editingCat.slug}/`, catForm)
      : api.post('/inventory/categories/', { ...catForm, slug: catForm.slug || catForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), ...(isAdmin ? { hotel: hotelFilter } : {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-categories'], exact: false }); toast.success(editingCat ? 'Category updated.' : 'Category created.'); setCatModalOpen(false) },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  const deleteCat = useMutation({
    mutationFn: (slug: string) => api.delete(`/inventory/categories/${slug}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-categories'], exact: false }); toast.success('Category deleted.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Item CRUD ──
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm)

  const openNewItem = () => { setEditingItem(null); setItemForm(emptyItemForm); setItemModalOpen(true) }
  const openEditItem = (it: InventoryItem) => {
    setEditingItem(it)
    setItemForm({
      name: it.name, category: it.category, unit: it.unit,
      cost_price: String(it.cost_price), sale_price: it.sale_price !== null ? String(it.sale_price) : '',
      reorder_threshold: String(it.reorder_threshold), expiry_tracked: it.expiry_tracked, is_active: it.is_active,
    })
    setItemModalOpen(true)
  }

  const saveItem = useMutation({
    mutationFn: () => {
      const payload = {
        ...itemForm,
        cost_price: parseFloat(itemForm.cost_price) || 0,
        sale_price: itemForm.sale_price ? parseFloat(itemForm.sale_price) : null,
        reorder_threshold: parseInt(itemForm.reorder_threshold) || 0,
        ...(isAdmin && !editingItem ? { hotel: hotelFilter } : {}),
      }
      return editingItem ? api.patch(`/inventory/items/${editingItem.id}/`, payload) : api.post('/inventory/items/', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-items'] }); toast.success(editingItem ? 'Item updated.' : 'Item added.'); setItemModalOpen(false) },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/items/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-items'] }); toast.success('Item deleted.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // ── Stock adjustment ──
  const [adjustTarget, setAdjustTarget] = useState<{ item: InventoryItem; location: StockLocation } | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const adjustStock = useMutation({
    mutationFn: (delta: number) => api.post('/inventory/balances/adjust/', {
      item: adjustTarget!.item.id, location: adjustTarget!.location, delta, reason: adjustReason,
      ...(isAdmin ? { hotel: hotelFilter } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      toast.success('Stock updated.')
      setAdjustTarget(null); setAdjustAmount(''); setAdjustReason('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  // Admin must pick one branch to work in — showing two branches'
  // numbers folded into the same row would be ambiguous, and every
  // adjustment needs exactly one branch anyway. The useEffect above
  // auto-selects the first branch once the list loads.
  if (catsLoading || itemsLoading || (isAdmin && !hotelFilter)) return <PageSpinner />

  const balanceFor = (item: InventoryItem, loc: StockLocation) =>
    item.balances.find(b => b.location === loc)?.quantity ?? 0
  const isLowAt = (item: InventoryItem, loc: StockLocation) =>
    balanceFor(item, loc) <= item.reorder_threshold

  const visibleLocations: StockLocation[] = ownLocation ? [ownLocation] : (locationFilter === 'all' ? ['store', 'bar', 'kitchen'] : [locationFilter])
  const currentHotelName = hotels?.find(h => h.id === hotelFilter)?.name

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text flex items-center gap-2">
            Inventory
            {!isAdmin && user?.hotel_name && (
              <span className="text-xs font-normal bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20 rounded-full px-2.5 py-1 flex items-center gap-1">
                <Building2 size={11} /> {user.hotel_name}
              </span>
            )}
          </h1>
          <p className="text-enayi-muted text-sm">
            {ownLocation ? `${LOCATION_LABEL[ownLocation]} stock and the shared item catalog.` : isAdmin && currentHotelName ? `Store, Bar, and Kitchen stock at ${currentHotelName}.` : 'Store, Bar, and Kitchen stock across the hotel.'}
          </p>
          {(ownLocation || user?.role === 'manager') && !user?.hotel_name && (
            <p className="text-red-400 text-xs mt-1">No branch assigned to your account yet — ask the Owner to set one in Django admin.</p>
          )}
        </div>
        <div className="flex gap-2">
          {tab === 'categories' && canManageCatalog && (
            <Button variant="gold" onClick={openNewCat}><Plus size={14} /> Add Category</Button>
          )}
          {tab === 'stock' && canManageCatalog && (
            <Button variant="gold" onClick={openNewItem}><Plus size={14} /> Add Item</Button>
          )}
          {tab === 'requests' && canRequest && (
            <Button variant="gold" onClick={() => setReqModalOpen(true)}><Plus size={14} /> Request Items</Button>
          )}
        </div>
      </div>

      {isAdmin && hotels && hotels.length > 0 && (
        <div className="card p-3 flex items-center gap-3 flex-wrap bg-enayi-gold/5 border-enayi-gold/20">
          <Building2 size={16} className="text-enayi-gold flex-shrink-0" />
          <span className="text-enayi-muted text-xs">Viewing branch:</span>
          <Select value={hotelFilter} onChange={e => setHotelFilter(e.target.value)} className="max-w-[240px]">
            {hotels.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </Select>
          <span className="text-enayi-muted text-xs italic">Only the Owner can switch branches — everyone else only ever sees their own.</span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => setTab('stock')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='stock' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <Package size={14} className="inline mr-1.5 -mt-0.5" /> Stock ({items?.length ?? 0})
        </button>
        {canManageCatalog && (
          <button onClick={() => setTab('categories')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='categories' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
            <LayoutGrid size={14} className="inline mr-1.5 -mt-0.5" /> Categories ({categories?.length ?? 0})
          </button>
        )}
        {(canRequest || canFulfill) && (
          <button onClick={() => setTab('requests')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='requests' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
            <ClipboardList size={14} className="inline mr-1.5 -mt-0.5" /> Requests ({(requisitions||[]).filter(r=>r.status==='pending').length} pending)
          </button>
        )}
        {!ownLocation && tab === 'stock' && (
          <Select value={locationFilter} onChange={e => setLocationFilter(e.target.value as any)} className="ml-auto max-w-[180px]">
            <option value="all">All locations</option>
            <option value="store">Store only</option>
            <option value="bar">Bar only</option>
            <option value="kitchen">Kitchen only</option>
          </Select>
        )}
      </div>

      {tab === 'stock' && (
        (items || []).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={Package} title="No items yet" desc={canManageCatalog ? 'Add your first item to get started.' : 'None have been added yet.'} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items!.map(it => (
              <div key={it.id} className="card p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-enayi-text font-medium">{it.name}</div>
                    <div className="text-enayi-muted text-xs">{it.category_name} · {it.sku}</div>
                  </div>
                  {!it.is_active && <Badge variant="gray">Inactive</Badge>}
                </div>
                <div className="flex gap-3 text-xs text-enayi-muted">
                  <span>Cost {formatCurrency(it.cost_price)}</span>
                  {it.sale_price !== null && <span className="text-enayi-gold font-medium">Sells {formatCurrency(it.sale_price)}</span>}
                </div>
                <div className="space-y-1.5 pt-1 border-t border-enayi-border">
                  {visibleLocations.map(loc => {
                    const qty = balanceFor(it, loc)
                    const low = isLowAt(it, loc)
                    const canAdjust = ownLocation === loc || isManagerOrAdmin
                    return (
                      <div key={loc} className="flex items-center justify-between text-sm">
                        <span className="text-enayi-muted flex items-center gap-1.5">
                          {LOCATION_LABEL[loc]}
                          {low && <AlertTriangle size={12} className="text-red-400" />}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={low ? 'text-red-400 font-semibold' : 'text-enayi-text font-medium'}>{qty} {it.unit}{qty === 1 ? '' : 's'}</span>
                          {canAdjust && (
                            <button onClick={() => setAdjustTarget({ item: it, location: loc })} className="text-enayi-gold hover:text-enayi-gold2" title={`Adjust ${LOCATION_LABEL[loc]} stock`}>
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {canManageCatalog && (
                  <div className="flex gap-2 pt-1 flex-wrap items-center">
                    <Button size="sm" variant="outline" onClick={() => openEditItem(it)}><Pencil size={12} /> Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${it.name}"?`)) deleteItem.mutate(it.id) }}><Trash2 size={12} /> Delete</Button>
                    {it.on_guest_menu ? (
                      <span className="text-xs text-green-400 flex items-center gap-1"><UtensilsCrossed size={12} /> On guest menu</span>
                    ) : (
                      <Button size="sm" variant="surface" onClick={() => openListOnMenu(it)}><UtensilsCrossed size={12} /> List on Guest Menu</Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'categories' && canManageCatalog && (
        (categories || []).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={LayoutGrid} title="No categories yet" desc="Add your first one to get started." /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories!.map(c => (
              <div key={c.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-enayi-text font-medium">{c.name}</div>
                  {!c.is_active && <Badge variant="gray">Inactive</Badge>}
                </div>
                <div className="text-enayi-muted text-xs">{c.item_count} item(s)</div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEditCat(c)}><Pencil size={12} /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteCat.mutate(c.slug) }}><Trash2 size={12} /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'requests' && (
        reqLoading ? <PageSpinner /> : (requisitions || []).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={ClipboardList} title="No requests yet" desc={canRequest ? 'Request items from the Store when you need to restock.' : 'Nothing pending from Bar or Kitchen right now.'} /></div>
        ) : (
          <div className="space-y-3">
            {requisitions!.map(r => (
              <div key={r.id} className="card p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-enayi-text font-medium">{r.item_name}</span>
                    <span className="text-enayi-muted text-xs">→ {r.destination_display}</span>
                    <Badge variant={r.status === 'fulfilled' ? 'green' : r.status === 'rejected' ? 'red' : 'gold'}>{r.status_display}</Badge>
                  </div>
                  <div className="text-enayi-muted text-xs">
                    Requested {r.quantity_requested} {r.item_unit}(s) by {r.requested_by_name}
                    {r.status === 'fulfilled' && ` · Fulfilled ${r.quantity_fulfilled} ${r.item_unit}(s) by ${r.decided_by_name}`}
                    {r.status === 'rejected' && ` · Rejected by ${r.decided_by_name}`}
                  </div>
                  {r.note_from_requester && <div className="text-enayi-muted text-xs italic">"{r.note_from_requester}"</div>}
                  {r.note_from_fulfiller && <div className="text-enayi-gold text-xs italic">Store note: "{r.note_from_fulfiller}"</div>}
                  {r.status === 'pending' && <div className="text-enayi-muted text-xs">Store currently has {r.store_available} {r.item_unit}(s)</div>}
                </div>
                {r.status === 'pending' && canFulfill && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setDecideTarget(r); setDecideQty(String(r.quantity_requested)) }}><Check size={12} /> Fulfill</Button>
                    <Button size="sm" variant="danger" onClick={() => { setDecideTarget(r); setDecideQty('') }}><X size={12} /> Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Category modal */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? 'Edit Category' : 'Add Category'} size="sm">
        <div className="space-y-4">
          <Input label="Name" placeholder="e.g. Soft Drinks" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
          <Textarea label="Description (optional)" value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setCatModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={saveCat.isPending} onClick={() => saveCat.mutate()} disabled={!catForm.name}>
              {editingCat ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Item modal */}
      <Modal open={itemModalOpen} onClose={() => setItemModalOpen(false)} title={editingItem ? 'Edit Item' : 'Add Item'} size="md">
        <div className="space-y-4">
          <Input label="Name" placeholder="e.g. Coca-Cola 50cl" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
          <Select label="Category" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>
            <option value="">Select a category</option>
            {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Unit" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}>
            {UNITS.map(u => <option key={u} value={u} className="capitalize">{u}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Cost price (₦)" type="number" value={itemForm.cost_price} onChange={e => setItemForm({ ...itemForm, cost_price: e.target.value })} />
            <Input label="Sale price (₦, optional)" type="number" placeholder="Leave blank if not resold" value={itemForm.sale_price} onChange={e => setItemForm({ ...itemForm, sale_price: e.target.value })} />
          </div>
          <Input label="Low-stock alert threshold" type="number" value={itemForm.reorder_threshold} onChange={e => setItemForm({ ...itemForm, reorder_threshold: e.target.value })} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setItemModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={saveItem.isPending} onClick={() => saveItem.mutate()} disabled={!itemForm.name || !itemForm.category}>
              {editingItem ? 'Save changes' : 'Create item'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Stock adjust modal */}
      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title={`Adjust ${adjustTarget ? LOCATION_LABEL[adjustTarget.location] : ''} Stock`} size="sm">
        {adjustTarget && (
          <div className="space-y-4">
            <div className="text-enayi-text text-sm">
              {adjustTarget.item.name} — currently <span className="font-semibold">{balanceFor(adjustTarget.item, adjustTarget.location)} {adjustTarget.item.unit}(s)</span> at {LOCATION_LABEL[adjustTarget.location]}
            </div>
            <Input label="Amount" type="number" placeholder="e.g. 20" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
            <Textarea label="Reason (optional)" placeholder="e.g. Delivery from supplier, spoilage, correction..." value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" loading={adjustStock.isPending} onClick={() => adjustStock.mutate(-Math.abs(parseFloat(adjustAmount) || 0))} disabled={!adjustAmount}>
                <ArrowDownCircle size={14} /> Remove
              </Button>
              <Button variant="gold" loading={adjustStock.isPending} onClick={() => adjustStock.mutate(Math.abs(parseFloat(adjustAmount) || 0))} disabled={!adjustAmount}>
                <ArrowUpCircle size={14} /> Add
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Request Items modal (Bar/Kitchen) */}
      <Modal open={reqModalOpen} onClose={() => setReqModalOpen(false)} title="Request Items from Store" size="sm">
        <div className="space-y-4">
          <Select label="Item" value={reqItem} onChange={e => setReqItem(e.target.value)}>
            <option value="">Select an item</option>
            {(items || []).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
          <Input label="Quantity needed" type="number" placeholder="e.g. 20" value={reqQty} onChange={e => setReqQty(e.target.value)} />
          <Textarea label="Note (optional)" placeholder="e.g. Need for tonight's event" value={reqNote} onChange={e => setReqNote(e.target.value)} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setReqModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={createRequisition.isPending} onClick={() => createRequisition.mutate()} disabled={!reqItem || !reqQty}>
              Send Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* Fulfill / Reject modal (Store Keeper / Manager / Owner) */}
      <Modal open={!!decideTarget} onClose={() => setDecideTarget(null)} title={decideTarget ? `${decideTarget.item_name} — ${decideTarget.destination_display} Request` : ''} size="sm">
        {decideTarget && (
          <div className="space-y-4">
            <div className="text-enayi-text text-sm">
              {decideTarget.requested_by_name} requested <span className="font-semibold">{decideTarget.quantity_requested} {decideTarget.item_unit}(s)</span>.
              Store currently has <span className="font-semibold">{decideTarget.store_available} {decideTarget.item_unit}(s)</span>.
            </div>
            <Input label="Quantity to hand over" type="number" value={decideQty} onChange={e => setDecideQty(e.target.value)} />
            <Textarea label="Note (optional)" placeholder="e.g. Only had 15 cold ones ready" value={decideNote} onChange={e => setDecideNote(e.target.value)} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="danger" loading={decideRequisition.isPending} onClick={() => decideRequisition.mutate('reject')}>
                <X size={14} /> Reject
              </Button>
              <Button variant="gold" loading={decideRequisition.isPending} onClick={() => decideRequisition.mutate('fulfill')} disabled={!decideQty || parseFloat(decideQty) <= 0}>
                <Check size={14} /> Confirm Fulfilled
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* List on Guest Menu modal (Store Keeper / Manager / Owner) */}
      <Modal open={!!listTarget} onClose={() => setListTarget(null)} title={listTarget ? `List "${listTarget.name}" on the Guest Menu` : ''} size="sm">
        {listTarget && (
          <div className="space-y-4">
            <p className="text-enayi-muted text-xs">
              This creates a real, orderable item on the guest Food & Bar page, linked back to this
              stock item — so a completed order for it automatically moves Bar/Kitchen stock.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setListCategoryMode('existing')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${listCategoryMode==='existing' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'card text-enayi-muted'}`}>Existing category</button>
              <button onClick={() => setListCategoryMode('new')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${listCategoryMode==='new' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'card text-enayi-muted'}`}>New category</button>
            </div>
            {listCategoryMode === 'existing' ? (
              <Select label="Guest menu category" value={listCategoryId} onChange={e => setListCategoryId(e.target.value)}>
                <option value="">Select a category</option>
                {(menuCategories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            ) : (
              <>
                <Input label="New category name" placeholder="e.g. Beer & Spirits" value={listNewCategoryName} onChange={e => setListNewCategoryName(e.target.value)} />
                <Select label="Category type" value={listNewCategoryType} onChange={e => setListNewCategoryType(e.target.value)}>
                  <option value="drink">Drink / Beverage</option>
                  <option value="cocktail">Cocktail & Bar</option>
                  <option value="mocktail">Mocktail</option>
                  <option value="wine">Wine & Spirits</option>
                  <option value="food">Food / Kitchen</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="dessert">Dessert</option>
                  <option value="snack">Snacks & Sides</option>
                </Select>
              </>
            )}
            <Input label="Guest price (₦)" type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} />
            <Textarea label="Description guests will see" value={listDescription} onChange={e => setListDescription(e.target.value)} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setListTarget(null)}>Cancel</Button>
              <Button
                variant="gold"
                loading={listOnMenu.isPending}
                onClick={() => listOnMenu.mutate()}
                disabled={!listPrice || (listCategoryMode === 'existing' ? !listCategoryId : !listNewCategoryName)}
              >
                List on Menu
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
