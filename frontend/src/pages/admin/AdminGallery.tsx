import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '@/utils/api'
import { PageSpinner, EmptyState, Button, Modal, Input, Textarea, Select, Badge, Alert } from '@/components/ui'
import { Image as ImageIcon, LayoutGrid, Plus, Pencil, Trash2, Upload, Star, Expand } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Lightbox } from '@/components/Lightbox'
import type { GalleryCategory, GalleryImage } from '@/types'

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

const CATEGORY_TYPES = ['lobby','rooms','restaurant','bar','events','pool','exterior','spa','amenities','surroundings']

type CategoryForm = { name: string; category_type: string; description: string; is_active: boolean }
const emptyCategoryForm: CategoryForm = { name: '', category_type: 'lobby', description: '', is_active: true }

export default function AdminGallery() {
  const { user } = useAuthStore()
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'
  const qc = useQueryClient()
  const [tab, setTab] = useState<'images' | 'categories'>('images')

  const { data: categories, isLoading: catsLoading } = useQuery<GalleryCategory[]>({
    queryKey: ['admin-gallery-categories'], queryFn: () => api.get('/gallery/categories/').then(r => unwrapList(r.data)),
  })
  const { data: images, isLoading: imagesLoading } = useQuery<GalleryImage[]>({
    queryKey: ['admin-gallery-images'], queryFn: () => api.get('/gallery/images/').then(r => unwrapList(r.data)),
  })

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<GalleryCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')

  const saveCategory = useMutation({
    mutationFn: () => editingCategory
      ? api.patch(`/gallery/categories/${editingCategory.id}/`, categoryForm)
      : api.post('/gallery/categories/', categoryForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gallery-categories'] })
      toast.success(editingCategory ? 'Category updated.' : 'Category created.')
      setCategoryModalOpen(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/gallery/categories/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-gallery-categories'] }); toast.success('Category deleted.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const uploadImages = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('category', uploadCategory)
      if (uploadTitle) form.append('title', uploadTitle)
      if (uploadFiles) Array.from(uploadFiles).forEach(f => form.append('images', f))
      return api.post('/gallery/images/upload/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-gallery-images'] })
      toast.success(`${res.data?.uploaded ?? 0} image(s) uploaded.`)
      setUploadModalOpen(false)
      setUploadFiles(null)
      setUploadTitle('')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteImage = useMutation({
    mutationFn: (id: string) => api.delete(`/gallery/images/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-gallery-images'] }); toast.success('Image deleted.') },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const openNewCategory = () => { setEditingCategory(null); setCategoryForm(emptyCategoryForm); setCategoryModalOpen(true) }
  const openEditCategory = (c: GalleryCategory) => {
    setEditingCategory(c)
    setCategoryForm({ name: c.name, category_type: c.category_type, description: c.description, is_active: c.is_active })
    setCategoryModalOpen(true)
  }
  const openUploadModal = () => {
    setUploadCategory(categories?.[0]?.id || '')
    setUploadFiles(null)
    setUploadTitle('')
    setUploadModalOpen(true)
  }

  if (!isManagerOrAdmin) {
    return (
      <div className="p-4 md:p-6">
        <Alert type="error">This page is restricted to managers and owners.</Alert>
      </div>
    )
  }

  if (catsLoading || imagesLoading) return <PageSpinner />

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-enayi-text">Gallery</h1>
          <p className="text-enayi-muted text-sm">Manage photo categories and images.</p>
        </div>
        {tab === 'images'
          ? <Button variant="gold" onClick={openUploadModal} disabled={!categories?.length}><Upload size={14} /> Upload Images</Button>
          : <Button variant="gold" onClick={openNewCategory}><Plus size={14} /> Add Category</Button>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('images')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='images' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <ImageIcon size={14} className="inline mr-1.5 -mt-0.5" /> Images ({images?.length ?? 0})
        </button>
        <button onClick={() => setTab('categories')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='categories' ? 'bg-enayi-gold/10 text-enayi-gold border border-enayi-gold/20' : 'text-enayi-muted hover:text-enayi-text'}`}>
          <LayoutGrid size={14} className="inline mr-1.5 -mt-0.5" /> Categories ({categories?.length ?? 0})
        </button>
      </div>

      {tab === 'images' && (
        (images||[]).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={ImageIcon} title="No images yet" desc={categories?.length ? 'Upload your first photo.' : 'Add a category first.'} /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images!.map((img, idx) => (
              <div key={img.id} className="card overflow-hidden group relative">
                <div className="relative cursor-zoom-in" onClick={() => setLightboxIndex(idx)}>
                  <img src={img.image_url} alt={img.alt_text || img.title} className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Expand size={18} className="text-white" />
                    </div>
                  </div>
                  {img.is_featured && (
                    <div className="absolute top-2 left-2"><Badge variant="gold"><Star size={10} className="inline -mt-0.5" /> Featured</Badge></div>
                  )}
                </div>
                <div className="p-2.5 space-y-1">
                  <div className="text-enayi-text text-xs font-medium truncate">{img.title || img.category_name}</div>
                  <div className="text-enayi-muted text-[11px]">{img.category_name}</div>
                  <Button size="sm" variant="danger" className="w-full" onClick={() => { if (confirm('Delete this image?')) deleteImage.mutate(img.id) }}>
                    <Trash2 size={11} /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Lightbox — outside ternary so it renders correctly as a portal */}
      {tab === 'images' && lightboxIndex !== null && images && (
        <Lightbox
          images={images.map(img => ({ src: img.image_url, alt: img.alt_text || img.title, caption: img.title || img.category_name }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {tab === 'categories' && (
        (categories||[]).length === 0 ? (
          <div className="card p-12 text-center"><EmptyState icon={LayoutGrid} title="No categories yet" desc="Add your first one." /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories!.map(c => (
              <div key={c.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-enayi-text font-medium">{c.name}</div>
                    <div className="text-enayi-muted text-xs capitalize">{c.category_type.replace('_',' ')}</div>
                  </div>
                  {!c.is_active && <Badge variant="gray">Inactive</Badge>}
                </div>
                <div className="text-enayi-muted text-xs">{c.image_count} image(s)</div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEditCategory(c)}><Pencil size={12} /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteCategory.mutate(c.id) }}><Trash2 size={12} /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={editingCategory ? 'Edit Category' : 'Add Category'} size="sm">
        <div className="space-y-4">
          <Input label="Name" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} />
          <Select label="Type" value={categoryForm.category_type} onChange={e => setCategoryForm({...categoryForm, category_type: e.target.value})}>
            {CATEGORY_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.replace('_',' ')}</option>)}
          </Select>
          <Textarea label="Description" value={categoryForm.description} onChange={e => setCategoryForm({...categoryForm, description: e.target.value})} />
          <label className="flex items-center gap-2 cursor-pointer text-sm text-enayi-text">
            <input type="checkbox" checked={categoryForm.is_active} onChange={e => setCategoryForm({...categoryForm, is_active: e.target.checked})} /> Active (visible to guests)
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={saveCategory.isPending} onClick={() => saveCategory.mutate()} disabled={!categoryForm.name}>
              {editingCategory ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} title="Upload Images" size="sm">
        <div className="space-y-4">
          <Select label="Category" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
            {(categories||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Title (optional, applies to all)" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-enayi-border rounded-lg p-6 cursor-pointer text-center hover:border-enayi-gold/40 transition-colors">
            <Upload size={20} className="text-enayi-muted" />
            <span className="text-xs text-enayi-muted">{uploadFiles?.length ? `${uploadFiles.length} file(s) selected` : 'Choose one or more photos'}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => setUploadFiles(e.target.files)} />
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setUploadModalOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={uploadImages.isPending} onClick={() => uploadImages.mutate()} disabled={!uploadCategory || !uploadFiles?.length}>
              Upload
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
