import { useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ImageIcon, Expand } from 'lucide-react'
import api from '@/utils/api'
import { Lightbox } from '@/components/Lightbox'
import type { GalleryImage } from '@/types'

type Hotel = { id: string; name: string; branch: string }
type BranchRoomPhoto = { id: string; image_url: string; caption: string }
type BranchRoom = { room_id: string; room_number: string; category_name: string; photos: BranchRoomPhoto[] }
type BranchRoomPhotosResponse = { hotel_id: string; hotel_name: string; rooms: BranchRoom[] }

type DisplayImage = { key: string; src: string; alt: string; caption: string }

const unwrapList = (data: any) => Array.isArray(data) ? data : (data?.results ?? [])

export default function GalleryPage() {
  const [tab, setTab] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const { data: hotels } = useQuery<Hotel[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/hotels/').then(r => unwrapList(r.data)),
  })

  // Gallery-tagged marketing photos — filtered to the selected branch,
  // or every photo when viewing "All".
  const { data: images, isLoading: imagesLoading } = useQuery<GalleryImage[]>({
    queryKey: ['gallery', tab],
    queryFn: () =>
      api.get('/gallery/images/', {
        params: tab !== 'all' ? { hotel: tab } : {},
      }).then(r => unwrapList(r.data)),
  })

  // Each branch's actual rooms (from Admin > Rooms > Photos) — fetched
  // per-branch so "All" can merge every branch's rooms together too.
  const branchesToLoad = tab === 'all' ? (hotels ?? []) : (hotels ?? []).filter(h => h.id === tab)
  const roomPhotoQueries = useQueries({
    queries: branchesToLoad.map(h => ({
      queryKey: ['public-branch-room-photos', h.id],
      queryFn: () => api.get('/rooms/branch-photos/public/', { params: { hotel: h.id } }).then(r => r.data as BranchRoomPhotosResponse),
      enabled: !!hotels,
    })),
  })
  const roomPhotosLoading = roomPhotoQueries.some(q => q.isLoading)

  const isLoading = imagesLoading || (!!hotels?.length && roomPhotosLoading)

  const galleryDisplay: DisplayImage[] = (images ?? [])
    .filter(img => img.image_url)
    .map(img => ({ key: `gal-${img.id}`, src: img.image_url, alt: img.alt_text || img.title, caption: img.title || img.category_name }))

  const roomDisplay: DisplayImage[] = roomPhotoQueries.flatMap(q =>
    (q.data?.rooms ?? []).flatMap(room =>
      room.photos.map(p => ({
        key: `room-${p.id}`,
        src: p.image_url,
        alt: p.caption || `Room ${room.room_number}`,
        caption: `Room ${room.room_number} — ${room.category_name}`,
      }))
    )
  )

  const displayImages = [...galleryDisplay, ...roomDisplay]

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
        {/* Branch Tabs */}
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
          {(hotels ?? []).map(h => (
            <button
              key={h.id}
              onClick={() => setTab(h.id)}
              className={`px-4 py-2 rounded-xl text-sm transition-all ${
                tab === h.id
                  ? 'bg-enayi-gold text-white shadow-gold'
                  : 'card text-enayi-muted hover:text-enayi-text'
              }`}
            >
              {h.name}
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
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-wrap justify-center gap-4"
            >
              {displayImages.map((img, i) => (
                <motion.div
                  key={img.key}
                  initial={{ opacity: 0, scale: 0.9, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 20) * 0.03, duration: 0.35, ease: 'easeOut' }}
                  whileHover={{ y: -4 }}
                  onClick={() => setLightboxIndex(i)}
                  className="aspect-square rounded-2xl overflow-hidden bg-enayi-panel group cursor-zoom-in w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.75rem)] lg:w-[calc(25%-0.75rem)]"
                >
                  <div className="relative w-full h-full">
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement
                        el.style.display = 'none'
                        const parent = el.parentElement
                        if (parent) parent.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-enayi-muted gap-2"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg><span class="text-xs">Image unavailable</span></div>'
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Expand size={18} className="text-white" />
                      </div>
                    </div>
                    {img.caption && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <span className="text-white text-xs">{img.caption}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && displayImages.length > 0 && (
          <Lightbox
            images={displayImages.map(img => ({ src: img.src, alt: img.alt, caption: img.caption }))}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}

        {/* Empty State */}
        {!isLoading && displayImages.length === 0 && (
          <div className="text-center py-20 text-enayi-muted">
            <ImageIcon size={48} className="mx-auto opacity-30 mb-4" />
            <p className="text-lg mb-2">No images yet for this branch.</p>
            <p className="text-sm">Hotel staff can upload gallery images from the admin dashboard.</p>
          </div>
        )}
      </div>
    </div>
  )
}
