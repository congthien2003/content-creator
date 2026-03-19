'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PLATFORMS, POST_LENGTHS, POST_TYPES } from '@/lib/constants'
import type { Platform, PostLength, PostType } from '@/lib/types'
import { generateContent, markAsPublished } from './actions'
import { useToast } from '@/components/toast-provider'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Copy,
  CheckCircle2,
  Loader2,
  RotateCcw,
  BookmarkCheck,
  ChevronDown,
} from 'lucide-react'

// Helper component for expandable sections
function SelectionUnit({
  label,
  value,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-[1.5rem] border border-border shadow-sm overflow-hidden mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-xl">{icon}</span>}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-none mb-1">
              {label}
            </p>
            <p className="text-sm font-semibold text-foreground">{value}</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-muted-foreground"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="px-6 pb-5 pt-1 border-t border-border/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function GeneratorPage() {
  const { addToast } = useToast()

  const [platform, setPlatform] = useState<Platform>('facebook')
  const [postLength, setPostLength] = useState<PostLength>('medium')
  const [postType, setPostType] = useState<PostType>('promotional')
  const [openSection, setOpenSection] = useState<'platform' | 'type' | 'length' | null>(null)
  
  const [topic, setTopic] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPublished, setIsPublished] = useState(false)

  const handleGenerate = async () => {
    if (!topic.trim()) {
      addToast('Vui lòng nhập chủ đề bài viết!', 'error')
      return
    }

    setIsGenerating(true)
    setGeneratedContent('')
    setDraftId(null)
    setIsPublished(false)
    setOpenSection(null) // Close any open configuration sections

    const result = await generateContent(topic, platform, postLength, postType)

    if (result.success && result.content) {
      setGeneratedContent(result.content)
      setDraftId(result.draftId ?? null)
      addToast('Tạo bài viết thành công! 🎉')
    } else {
      addToast(result.error || 'Có lỗi xảy ra', 'error')
    }

    setIsGenerating(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedContent)
    addToast('Đã sao chép nội dung!', 'info')
  }

  const handleMarkPublished = async () => {
    if (!draftId) return
    const result = await markAsPublished(draftId)
    if (result.success) {
      setIsPublished(true)
      addToast('Đã đánh dấu đã đăng! ✅')
    } else {
      addToast('Lỗi: ' + result.error, 'error')
    }
  }

  const handleReset = () => {
    setTopic('')
    setGeneratedContent('')
    setDraftId(null)
    setIsPublished(false)
  }

  const activePlatform = PLATFORMS.find(p => p.value === platform)
  const activeType = POST_TYPES.find(t => t.value === postType)
  const activeLength = POST_LENGTHS.find(l => l.value === postLength)

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto min-h-screen">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center lg:text-left"
      >
        <h1 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
          Sáng tạo nội dung <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-accent">GenAI</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-base max-w-2xl">
          Tạo bài viết chất lượng cho mọi nền tảng chỉ trong vài giây.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Generator Form */}
        <div className="lg:col-span-5 space-y-2">
          
          <SelectionUnit
            label="Nền tảng đăng bài"
            value={activePlatform?.label || ''}
            icon={activePlatform?.icon}
            isOpen={openSection === 'platform'}
            onToggle={() => setOpenSection(openSection === 'platform' ? null : 'platform')}
          >
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.value}
                  onClick={() => {
                    setPlatform(p.value)
                    setOpenSection(null)
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200',
                    platform === p.value
                      ? 'border-primary bg-primary-light text-primary shadow-sm'
                      : 'border-border bg-white text-foreground hover:bg-muted/50'
                  )}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </SelectionUnit>

          <SelectionUnit
            label="Thể loại bài viết"
            value={activeType?.label || ''}
            icon={activeType?.icon}
            isOpen={openSection === 'type'}
            onToggle={() => setOpenSection(openSection === 'type' ? null : 'type')}
          >
            <div className="space-y-2">
              {POST_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => {
                    setPostType(t.value)
                    setOpenSection(null)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200',
                    postType === t.value
                      ? 'border-primary bg-primary-light text-primary shadow-sm'
                      : 'border-border bg-white text-foreground hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary opacity-0 transition-opacity" style={{ opacity: postType === t.value ? 1 : 0 }} />
                </button>
              ))}
            </div>
          </SelectionUnit>

          <SelectionUnit
            label="Độ dài yêu cầu"
            value={activeLength?.label || ''}
            isOpen={openSection === 'length'}
            onToggle={() => setOpenSection(openSection === 'length' ? null : 'length')}
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              {POST_LENGTHS.map(l => (
                <button
                  key={l.value}
                  onClick={() => {
                    setPostLength(l.value)
                    setOpenSection(null)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-2 py-3 rounded-xl border text-xs font-medium transition-all duration-200',
                    postLength === l.value
                      ? 'border-primary bg-primary-light text-primary shadow-sm'
                      : 'border-border bg-white text-foreground hover:bg-muted/50'
                  )}
                >
                  <span className="font-bold">{l.label}</span>
                  <span className="text-[10px] text-muted-foreground">{l.description}</span>
                </button>
              ))}
            </div>
          </SelectionUnit>

          {/* Topic Input */}
          <div className="bg-card rounded-[1.5rem] border border-border shadow-sm p-6 mb-6">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3 px-1">
              Chủ đề bài viết
            </p>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Bạn muốn viết về điều gì hôm nay?"
              rows={4}
              className="w-full px-4 py-3 rounded-2xl border border-border bg-muted/20 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-3 px-8 py-5 rounded-[1.5rem] text-base font-bold text-white transition-all duration-300 shadow-xl overflow-hidden relative',
              isGenerating
                ? 'bg-primary/70 cursor-wait'
                : !topic.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-linear-to-r from-primary to-accent hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]'
            )}
          >
            {isGenerating && (
              <motion.div 
                className="absolute inset-x-0 bottom-0 h-1 bg-white/20"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 5, ease: 'linear' }}
              />
            )}
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Đang xử lý dữ liệu...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Bắt đầu tạo bài viết</span>
              </>
            )}
          </button>
        </div>

        {/* RIGHT: Result Preview */}
        <div className="lg:col-span-7 lg:sticky lg:top-8">
          <div className="bg-card rounded-[2rem] border border-border shadow-xl overflow-hidden min-h-[500px] flex flex-col bg-linear-to-b from-white to-muted/20">
            {/* Header */}
            <div className="px-8 py-5 border-b border-border/50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <h2 className="text-sm font-bold text-foreground">Bản thảo AI</h2>
              </div>
              
              {generatedContent && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary-light transition-all"
                    title="Sao chép"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {draftId && !isPublished && (
                    <button
                      onClick={handleMarkPublished}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-success hover:bg-success-light transition-all border border-success/20"
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      Lưu bài đăng
                    </button>
                  )}
                  {isPublished && (
                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-success bg-success-light">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã đăng
                    </div>
                  )}
                  <button
                    onClick={handleReset}
                    className="p-2.5 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all"
                    title="Làm mới"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="p-8 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div 
                    key="shimmer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {[95, 88, 92, 70, 85, 90, 60, 80].map((w, i) => (
                      <div
                        key={i}
                        className="shimmer h-4 rounded-full"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </motion.div>
                ) : generatedContent ? (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed font-medium"
                  >
                    {generatedContent}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground"
                  >
                    <div className="w-20 h-20 rounded-[2rem] bg-muted/50 flex items-center justify-center mb-6">
                      <Sparkles className="w-10 h-10 text-primary/30" />
                    </div>
                    <p className="text-base font-bold text-foreground/70">Sẵn sàng sáng tạo?</p>
                    <p className="text-sm mt-1 text-center max-w-[250px]">
                      Nhập chủ đề và nhấn nút để bắt đầu tạo nội dung.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Footer / Meta info */}
            {generatedContent && !isGenerating && (
              <div className="px-8 py-4 bg-muted/30 border-t border-border/50 text-[10px] text-muted-foreground flex justify-between items-center">
                <span>Nội dung được tạo bởi Gemini 2.5 Flash</span>
                <span>{generatedContent.split(/\s+/).length} từ</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
