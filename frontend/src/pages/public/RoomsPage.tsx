import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, Users, Maximize2, BedDouble, MapPin, ImageIcon } from 'lucide-react'
import api from '@/utils/api'
import { formatCurrency } from '@/utils/helpers'
import { PageSpinner } from '@/components/ui'
import type { RoomCategory } from '@/types'

// ── Branch type (kept local) ─────────────────────────────────
interface BranchPrice {
  hotel: string
  branch: string
  branch_name: string
  base_price: string
  weekend_price: string
  holiday_price: string
  breakfast_price: string
  current_price: string
  current_price_with_breakfast: string
}

interface Hotel {
  id: string
  name: string
  branch: string
  slug: string
  tagline?: string
  city?: string
  state?: string
  is_active?: boolean
}

// Extend RoomCategory with branch_prices (it's in the API response)
interface RoomCategoryExt extends RoomCategory {
  branch_prices?: BranchPrice[]
}

export default function RoomsPage() {
  // 'all' shows base prices; otherwise we filter by branch id
  const [selectedBranch, setSelectedBranch] = useState<string>('all')

  const { data: hotels } = useQuery<Hotel[]>({
    queryKey: ['hotels'],
    queryFn: () =>
      api.get('/hotels/').then(r =>
        Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
      ),
  })

  const { data: rooms, isLoading } = useQuery<RoomCategoryExt[]>({
    queryKey: ['rooms'],
    queryFn: () =>
      api.get('/rooms/categories/').then(r => r.data.results ?? r.data),
  })

  // Build branch list with "All branches" first
  const branches = useMemo(() => {
    return [
      { id: 'all', name: 'All Branches', branch: 'all' as const },
      ...(hotels ?? []),
    ]
  }, [hotels])

  // Filter & price-resolve rooms for the selected branch
  const visibleRooms = useMemo(() => {
    if (!rooms) return []
    if (selectedBranch === 'all') {
      return rooms.map(r => ({
        room: r,
        priceLabel: Number(r.current_price ?? r.base_price ?? 0),
        branchName: null,
      }))
    }
    return rooms
      .map(r => {
        const bp = r.branch_prices?.find(p => p.hotel === selectedBranch)
        if (!bp) return null
        return {
          room: r,
          priceLabel: Number(bp.current_price),
          branchName: bp.branch_name,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [rooms, selectedBranch])

  if (isLoading) return <PageSpinner />

  const selectedBranchObj = hotels?.find(h => h.id === selectedBranch)

  return (
    <div className="bg-enayi-bg min-h-screen">
      {/* Header */}
      <div className="section-sm bg-enayi-surface border-b border-enayi-border text-center">
        <div className="container-site">
          <div className="badge-gold inline-flex mb-4">🛏️ Rooms & Suites</div>
          <h1 className="font-display text-5xl text-enayi-text mb-4">Our Rooms</h1>
          <div className="gold-line-center mb-4" />
          <p className="text-enayi-muted text-lg max-w-lg mx-auto">
            Choose a branch to explore its rooms and branch-specific pricing.
          </p>
        </div>
      </div>

      <div className="container-site section">
        {/* Branch Tabs */}
        <div className="flex flex-wrap gap-3 mb-10 justify-center">
          {branches.map(b => {
            const isActive = selectedBranch === b.id
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b.id)}
                className={`px-6 py-3 rounded-xl font-body font-semibold text-sm transition-all duration-300 border ${
                  isActive
                    ? 'bg-enayi-gold text-white border-enayi-gold shadow-gold scale-105'
                    : 'card text-enayi-text border-enayi-border hover:border-enayi-gold/40'
                }`}
              >
                {b.id === 'all' ? (
                  '✦ All Branches'
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <MapPin size={14} />
                    {b.name.replace('Enayi Hotels & Suites — ', '')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Selected Branch Banner */}
        {selectedBranchObj && (
          <div className="card p-5 mb-8 text-center">
            <h2 className="font-heading text-2xl text-enayi-text mb-1">
              {selectedBranchObj.name}
            </h2>
            {selectedBranchObj.tagline && (
              <p className="text-enayi-muted text-sm">{selectedBranchObj.tagline}</p>
            )}
            <p className="text-enayi-gold text-xs mt-2">
              Prices shown are for this branch
            </p>
          </div>
        )}

        {/* Rooms grid */}
        {visibleRooms.length === 0 ? (
          <div className="text-center py-20 text-enayi-muted">
            <p className="text-lg mb-2">No rooms configured for this branch yet.</p>
            <p className="text-sm">
              An admin can add branch-specific room pricing in the dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleRooms.map(({ room: r, priceLabel, branchName }, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={`/rooms/${r.slug}${selectedBranch !== 'all' ? `?branch=${selectedBranch}` : ''}`}
                  className="card-hover block overflow-hidden group h-full"
                >
                  <div className="aspect-[4/3] bg-enayi-panel overflow-hidden flex items-center justify-center relative">
                    {r.images?.[0]?.image_url ? (
                      <img
                        src={r.images[0].image_url}
                        alt={r.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-enayi-muted">
                        <ImageIcon size={48} className="opacity-40" />
                        <span className="text-xs">No image yet</span>
                      </div>
                    )}
                    {r.available_rooms > 0 ? (
                      <div className="absolute top-3 right-3 badge-green text-xs">Available</div>
                    ) : (
                      <div className="absolute top-3 right-3 badge-red text-xs">Sold Out</div>
                    )}
                    {branchName && (
                      <div className="absolute top-3 left-3 badge-gold text-xs">
                        {branchName.replace('Enayi Hotels & Suites — ', '')}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {r.tagline && <div className="badge-gold text-xs mb-2">{r.tagline}</div>}
                    <div className="flex justify-between mb-2">
                      <h3 className="font-heading text-xl text-enayi-text">{r.name}</h3>
                      {r.avg_rating && (
                        <span className="text-xs text-enayi-gold flex items-center gap-1">
                          <Star size={11} fill="currentColor" />
                          {r.avg_rating}
                        </span>
                      )}
                    </div>
                    <p className="text-enayi-muted text-sm mb-4 line-clamp-2">{r.description}</p>
                    <div className="flex items-center gap-4 text-xs text-enayi-muted mb-4">
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {r.max_adults}
                      </span>
                      <span className="flex items-center gap-1">
                        <BedDouble size={11} />
                        {r.bed_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Maximize2 size={11} />
                        {r.room_size_sqm}m²
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-enayi-gold font-display text-2xl">
                        {formatCurrency(priceLabel)}
                        <span className="text-enayi-muted text-xs ml-1">/night</span>
                      </span>
                      <span className="btn-outline text-sm px-4 py-2">Book</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
