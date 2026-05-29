import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ImageIcon } from 'lucide-react'
import api from '@/utils/api'
import type { GalleryCategory, GalleryImage } from '@/types'

export default function GalleryPage() {
  const [tab, setTab] = useState('all')

  const { data: cats } = useQuery<GalleryCategory[]>({
    queryKey: ['gallery-cats'],
    queryFn: () =>
      api.get('/gallery/categories/').then(r => r.data?.results ?? r.data),
  })

  const { data: images, isLoading } = useQuery<GalleryImage[]>({
    queryKey: ['gallery', tab],
    queryFn: () =>
      api.get('/gallery/images/', {
        params: tab !== 'all' ? { 'category__category_type': tab } : {},
      }).then(r => r.data?.results ?? r.data),
  })

  return (
    <div className="bg-enayi-bg min-h-screen">
      {/* Header */}
      <div className="section-sm bg-enayi-surface border-b border-enayi-border text-center">
        <div className="container-site">
          <div className="badge-gold inline-flex mb-4">🖼️ Gallery</div>
          <h1 className="font-display text-5xl text-enayi-text mb-4">Hotel Gallery</h1>
          <div className="gold-line-center" />
        </div>
      </div>

      <div className="container-site section">
        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-xl text-sm transition-all ${
              tab === 'all'
                ? 'bg-enayi-gold text-white shadow-gold'
                : 'card text-enayi-muted hover:text-enayi-text'
            }`}
          >
            All
          </button>
          {(cats ?? []).map(c => (
            <button
              key={c.id}
              onClick={() => setTab(c.category_type)}
              className={`px-4 py-2 rounded-xl text-sm transition-all ${
                tab === c.category_type
                  ? 'bg-enayi-gold text-white shadow-gold'
                  : 'card text-enayi-muted hover:text-enayi-text'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Images Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="skeleton aspect-square rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(images ?? []).map((img, i) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="aspect-square rounded-2xl overflow-hidden bg-enayi-panel group cursor-pointer"
              >
                {img.image_url ? (
                  <img
                    src={img.image_url}
                    alt={img.alt_text || img.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement
                      el.style.display = 'none'
                      const parent = el.parentElement
                      if (parent) parent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-enayi-muted gap-2"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg><span class="text-xs">Image unavailable</span></div>'
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-enayi-muted gap-2">
                    <ImageIcon size={32} className="opacity-40" />
                    <span className="text-xs">No image</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!images || images.length === 0) && (
          <div className="text-center py-20 text-enayi-muted">
            <ImageIcon size={48} className="mx-auto opacity-30 mb-4" />
            <p className="text-lg mb-2">No images yet for this category.</p>
            <p className="text-sm">Hotel staff can upload gallery images from the admin dashboard.</p>
          </div>
        )}
      </div>
    </div>
  )
}
