import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '@/utils/api'
import type { GalleryCategory, GalleryImage } from '@/types'

export default function GalleryPage() {
  const [tab, setTab] = useState('all')

  const { data: cats } = useQuery<GalleryCategory[]>({
    queryKey: ['gallery-cats'],
    queryFn: () =>
      api.get('/gallery/categories/').then(r => r.data?.results ?? r.data), // ← fixed
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
            className={`px-4 py-2 rounded-xl text-sm ${tab === 'all' ? 'bg-enayi-gold text-enayi-bg' : 'card text-enayi-muted'}`}
          >
            All
          </button>
          {(cats ?? []).map(c => (
            <button
              key={c.id}
              onClick={() => setTab(c.category_type)}
              className={`px-4 py-2 rounded-xl text-sm ${tab === c.category_type ? 'bg-enayi-gold text-enayi-bg' : 'card text-enayi-muted'}`}
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
                <img
                  src={img.image_url}
                  alt={img.alt_text || img.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!images || images.length === 0) && (
          <div className="text-center py-20 text-enayi-muted">
            No images yet for this category.
          </div>
        )}

      </div>
    </div>
  )
}