'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/toast-provider'
import { getDrafts } from './actions'
import { markAsPublished, markAsDraft, deleteDraft } from '../actions'
import type { Draft, DraftStatus } from '@/lib/types'
import { PLATFORMS } from '@/lib/constants'
import { formatDate, truncate, cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy,
  Trash2,
  BookmarkCheck,
  Undo2,
  Filter,
  FileText,
  Eye,
  X,
} from 'lucide-react'

export default function HistoryPage() {
  const { addToast } = useToast()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | DraftStatus>('all')
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)

  const loadDrafts = async (f?: string) => {
    setLoading(true)
    const data = await getDrafts(f ?? filter)
    setDrafts(data)
    setLoading(false)
  }

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getDrafts(filter).then(data => {
      if (!ignore) {
        setDrafts(data)
        setLoading(false)
      }
    })
    return () => { ignore = true }
  }, [filter])

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content)
    addToast('Đã sao chép nội dung!', 'info')
  }

  const handleToggleStatus = async (draft: Draft) => {
    const action = draft.status === 'draft' ? markAsPublished : markAsDraft
    const result = await action(draft.id)
    if (result.success) {
      addToast(
        draft.status === 'draft' ? 'Đã đánh dấu đã đăng ✅' : 'Đã chuyển về bản nháp'
      )
      loadDrafts()
    } else {
      addToast('Lỗi: ' + result.error, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteDraft(id)
    if (result.success) {
      addToast('Đã xoá bản nháp')
      if (selectedDraft?.id === id) setSelectedDraft(null)
      loadDrafts()
    } else {
      addToast('Lỗi: ' + result.error, 'error')
    }
  }

  const getPlatformLabel = (value: string) => {
    return PLATFORMS.find(p => p.value === value)
  }

  const filters: { value: 'all' | DraftStatus; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'draft', label: 'Bản nháp' },
    { value: 'published', label: 'Đã đăng' },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">Lịch sử bài viết</h1>
          <p className="text-muted-foreground mt-2 text-base">
            Quản lý và xem lại các nội dung AI đã tạo.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 bg-muted/50 backdrop-blur-sm rounded-3xl p-1.5 border border-border/50 shadow-sm">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all relative z-10',
                filter === f.value
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <AnimatePresence>
                {filter === f.value && (
                  <motion.div 
                    layoutId="filter-active"
                    className="absolute inset-0 bg-white rounded-2xl shadow-sm -z-10"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </AnimatePresence>
              <Filter className="w-3 h-3" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shimmer h-24 rounded-3xl" />
            ))}
          </motion.div>
        ) : drafts.length === 0 ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-card rounded-[2rem] border border-dashed border-border/60"
          >
            <div className="w-20 h-20 rounded-4xl bg-muted/50 flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <p className="text-lg font-bold text-foreground/70">Chưa có bài viết nào</p>
            <p className="text-sm mt-1">Nội dung bạn tạo sẽ xuất hiện tại đây.</p>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-4"
          >
            {drafts.map((draft, idx) => {
              const platform = getPlatformLabel(draft.platform)
              return (
                <motion.div
                  key={draft.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-card rounded-3xl border border-border p-6 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-6 relative z-10">
                    {/* Left: Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {platform && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-light text-primary text-[10px] font-bold uppercase tracking-wider">
                            {platform.icon} {platform.label}
                          </span>
                        )}
                        <span
                          className={cn(
                            'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                            draft.status === 'published'
                              ? 'bg-success-light text-success'
                              : 'bg-warning-light text-warning'
                          )}
                        >
                          {draft.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {formatDate(draft.created_at)}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                        {draft.topic}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {truncate(draft.content, 180)}
                      </p>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 shrink-0 bg-muted/30 p-1 rounded-2xl border border-border/50">
                      <button
                        onClick={() => setSelectedDraft(draft)}
                        className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-white transition-all shadow-none hover:shadow-sm"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCopy(draft.content)}
                        className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-white transition-all shadow-none hover:shadow-sm"
                        title="Sao chép"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(draft)}
                        className={cn(
                          'p-2.5 rounded-xl transition-all shadow-none hover:shadow-sm',
                          draft.status === 'draft'
                            ? 'text-success hover:bg-white'
                            : 'text-muted-foreground hover:bg-white hover:text-foreground'
                        )}
                        title={
                          draft.status === 'draft' ? 'Đánh dấu đã đăng' : 'Chuyển về nháp'
                        }
                      >
                        {draft.status === 'draft' ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Undo2 className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="p-2.5 rounded-xl text-muted-foreground hover:text-danger hover:bg-white transition-all shadow-none hover:shadow-sm"
                        title="Xoá"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Subtle hover background decoration */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-bl from-primary/5 to-transparent rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDraft(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-10 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-white/50 backdrop-blur-sm">
                <div className="min-w-0 pr-4">
                  <h2 className="text-xl font-extrabold text-foreground truncate">
                    {selectedDraft.topic}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      {getPlatformLabel(selectedDraft.platform)?.label}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      {formatDate(selectedDraft.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(selectedDraft.content)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-primary hover:bg-primary-light transition-all border border-primary/10"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                  <button
                    onClick={() => setSelectedDraft(null)}
                    className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Modal Body */}
              <div className="p-8 overflow-y-auto flex-1">
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed font-medium">
                  {selectedDraft.content}
                </div>
              </div>
              {/* Modal Footer */}
              <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>{selectedDraft.content.split(/\s+/).length} từ</span>
                <span>ID: {selectedDraft.id.slice(0, 8)}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
