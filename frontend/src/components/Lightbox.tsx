/**
 * Lightbox — fullscreen image viewer
 *
 * Features:
 *   - Escape key to close (PC)
 *   - Browser back button to close (mobile)
 *   - Arrow keys ← → and on-screen arrows to navigate between images
 *   - Touch swipe left/right to navigate on mobile
 *   - Click dark overlay to close
 *   - Image counter (3 / 20)
 *   - Caption below the image
 *   - Smooth fade + scale animation on open/close
 *   - Prevents body scroll while open
 */
import { useEffect, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'

export interface LightboxImage {
  src: string
  alt?: string
  caption?: string
}

interface LightboxProps {
  images: LightboxImage[]
  initialIndex?: number
  onClose: () => void
}

export function Lightbox({ images, initialIndex = 0, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const image = images[index]
  const total = images.length

  const prev = useCallback(() => setIndex(i => (i - 1 + total) % total), [total])
  const next = useCallback(() => setIndex(i => (i + 1) % total), [total])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, prev, next])

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  useEffect(() => {
    history.pushState({ lightbox: true }, '')
    const handler = (_e: PopStateEvent) => { onClose() }
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('popstate', handler)
      if (history.state?.lightbox) history.back()
    }
  }, [onClose])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) dx < 0 ? next() : prev()
    touchStartX.current = null
    touchStartY.current = null
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.95)' }}
        onClick={onClose}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4 z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <ZoomIn size={15} className="text-[#C9A227]" />
            <span>{String(index + 1).padStart(2,'0')} / {String(total).padStart(2,'0')}</span>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Image */}
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex items-center justify-center w-full px-14"
          style={{ maxHeight: 'calc(100vh - 130px)' }}
          onClick={e => e.stopPropagation()}
        >
          <img
            src={image.src}
            alt={image.alt || ''}
            draggable={false}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            style={{ maxHeight: 'calc(100vh - 130px)', boxShadow: '0 8px 64px rgba(0,0,0,0.8)' }}
          />
        </motion.div>

        {/* Caption */}
        {image.caption && (
          <div className="absolute bottom-14 left-0 right-0 text-center px-8 pointer-events-none">
            <p className="text-white/70 text-sm">{image.caption}</p>
          </div>
        )}

        {/* Arrows */}
        {total > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prev() }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center border border-white/20 text-white/70 hover:text-white hover:border-white/50 hover:bg-white/10 transition-all z-10">
              <ChevronLeft size={22} />
            </button>
            <button onClick={e => { e.stopPropagation(); next() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center border border-white/20 text-white/70 hover:text-white hover:border-white/50 hover:bg-white/10 transition-all z-10">
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {total > 1 && total <= 24 && (
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-1.5 z-10"
            onClick={e => e.stopPropagation()}>
            {images.map((_,i) => (
              <button key={i} onClick={() => setIndex(i)}
                className="rounded-full transition-all duration-300"
                style={{ width: i===index?'20px':'6px', height:'6px', background: i===index?'#C9A227':'rgba(255,255,255,0.3)' }} />
            ))}
          </div>
        )}

        {/* Keyboard hint — desktop only */}
        <div className="absolute bottom-4 right-5 text-white/25 text-[11px] pointer-events-none hidden md:block">
          ← → navigate &nbsp;·&nbsp; Esc to close
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
