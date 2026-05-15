'use client'

import { useMemo, useReducer, useState } from 'react'
import { cn } from '@/lib/utils'
import { PLATFORMS, POST_LENGTHS, POST_TYPES } from '@/lib/constants'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { CreditBalance } from '@/components/credit-balance'
import type {
  Platform,
  PostLength,
  PostType,
  WorkflowImageOption,
  WorkflowStepId,
  WorkflowStepStatus,
} from '@/lib/types'
import {
  generateOutline,
  generateImageIdea,
  generateImages3Options,
  generateContentFromWorkflow,
  saveWorkflowDraft,
  markAsPublished,
} from './actions'
import { useToast } from '@/components/toast-provider'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Sparkles,
  Copy,
  CheckCircle2,
  Loader2,
  RotateCcw,
  BookmarkCheck,
  RefreshCcw,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'

type WizardPage = 1 | 2 | 3
type PreviewPanelMode = 'step' | 'output'
type PreviewStepId = 'outline' | 'image_idea' | 'content_generation' | 'image_generation'

type WorkflowStepState = { status: WorkflowStepStatus; error?: string | null }
type WorkflowState = Record<WorkflowStepId, WorkflowStepState>

type WorkflowAction =
  | { type: 'SET_STEP'; step: WorkflowStepId; status: WorkflowStepStatus; error?: string | null }
  | { type: 'RESET' }
  | { type: 'RESET_DOWNSTREAM'; step: WorkflowStepId }

const INITIAL_WORKFLOW: WorkflowState = {
  outline: { status: 'idle', error: null },
  image_idea: { status: 'idle', error: null },
  content_generation: { status: 'idle', error: null },
  image_generation: { status: 'idle', error: null },
  save: { status: 'idle', error: null },
}

const STEP_ORDER: WorkflowStepId[] = [
  'outline',
  'image_idea',
  'content_generation',
  'image_generation',
  'save',
]

function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  if (action.type === 'RESET') return INITIAL_WORKFLOW

  if (action.type === 'SET_STEP') {
    return {
      ...state,
      [action.step]: { status: action.status, error: action.error ?? null },
    }
  }

  if (action.type === 'RESET_DOWNSTREAM') {
    const index = STEP_ORDER.indexOf(action.step)
    if (index < 0) return state

    const next = { ...state }
    for (let i = index; i < STEP_ORDER.length; i += 1) {
      const step = STEP_ORDER[i]
      next[step] = { status: 'idle', error: null }
    }
    return next
  }

  return state
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-bold tracking-tight mt-5 first:mt-0 mb-3">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold tracking-tight mt-4 first:mt-0 mb-2.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 first:mt-0 mb-2">{children}</h3>,
  p: ({ children }) => <p className="leading-7 mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 space-y-1.5 mb-3">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1.5 mb-3">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded-md bg-muted px-1.5 py-0.5 text-[0.9em] font-mono text-foreground">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl bg-muted p-3 text-xs leading-6">{children}</pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
}

function MarkdownContent({ value, fallback }: { value: string; fallback: string }) {
  const normalized = value.trim()

  if (!normalized) {
    return <p className="text-muted-foreground">{fallback}</p>
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {normalized}
    </ReactMarkdown>
  )
}

function renderWorkflowStepBadge(status: WorkflowStepStatus) {
  if (status === 'loading') return <Loader2 className="w-4 h-4 animate-spin text-primary" />
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  if (status === 'error') return <RefreshCcw className="w-4 h-4 text-red-500" />
  return <div className="w-4 h-4 rounded-full bg-muted" />
}

type WorkflowNodeCardProps = {
  id: PreviewStepId
  title: string
  description: string
  status: WorkflowStepStatus
  error?: string | null
  onRun: () => Promise<void>
  canRun: boolean
  isRunningAll: boolean
  isSelected: boolean
  onSelect: (id: PreviewStepId) => void
}

function WorkflowNodeCard({
  id,
  title,
  description,
  status,
  error,
  onRun,
  canRun,
  isRunningAll,
  isSelected,
  onSelect,
}: WorkflowNodeCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelect(id)}
      className={cn(
        'rounded-2xl border bg-card p-4 shadow-sm cursor-pointer',
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        {renderWorkflowStepBadge(status)}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 text-xs text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={onRun}
        disabled={!canRun || status === 'loading' || isRunningAll}
        className={cn(
          'mt-3 w-full px-3 py-2 rounded-xl text-xs font-semibold transition',
          !canRun || isRunningAll
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary text-white hover:opacity-90 active:scale-[0.99]'
        )}
      >
        {status === 'error' ? 'Retry step' : 'Run step'}
      </button>
    </motion.div>
  )
}

export default function GeneratorPage() {
  const { addToast } = useToast()

  const [page, setPage] = useState<WizardPage>(1)
  const [platform, setPlatform] = useState<Platform>('facebook')
  const [postLength, setPostLength] = useState<PostLength>('medium')
  const [postType, setPostType] = useState<PostType>('promotional')
  const [topic, setTopic] = useState('')
  const [useIcons, setUseIcons] = useState(true)

  const [outline, setOutline] = useState('')
  const [imageIdea, setImageIdea] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [imageOptions, setImageOptions] = useState<WorkflowImageOption[]>([])
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [isPublished, setIsPublished] = useState(false)

  const [workflow, dispatch] = useReducer(workflowReducer, INITIAL_WORKFLOW)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [previewPanelMode, setPreviewPanelMode] = useState<PreviewPanelMode>('output')
  const [selectedPreviewStep, setSelectedPreviewStep] = useState<PreviewStepId>('outline')

  const activePlatform = useMemo(() => PLATFORMS.find(p => p.value === platform), [platform])

  const canRunOutline = !!topic.trim()
  const canRunImageIdea = workflow.outline.status === 'success' && !!outline
  const canRunContent = workflow.image_idea.status === 'success' && !!imageIdea
  const canRunImages = workflow.image_idea.status === 'success' && !!imageIdea
  const canSave = workflow.content_generation.status === 'success' && !!generatedContent

  const canGoPage2 = !!topic.trim()
  const canGoPage3 = workflow.content_generation.status === 'success' && !!generatedContent

  const selectedStepMarkdown = useMemo(() => {
    if (selectedPreviewStep === 'outline') return outline
    if (selectedPreviewStep === 'image_idea') return imageIdea
    if (selectedPreviewStep === 'content_generation') return generatedContent
    if (!imageOptions.length) return ''
    return imageOptions.map(i => `- **Option ${i.id}**: ${i.prompt}`).join('\n')
  }, [selectedPreviewStep, outline, imageIdea, generatedContent, imageOptions])

  const selectedStepFallback = useMemo(() => {
    if (selectedPreviewStep === 'outline') return 'Chưa có Outline.'
    if (selectedPreviewStep === 'image_idea') return 'Chưa có Image Idea.'
    if (selectedPreviewStep === 'content_generation') return 'Chưa có Content.'
    return 'Chưa có Image Options.'
  }, [selectedPreviewStep])

  const setStep = (step: WorkflowStepId, status: WorkflowStepStatus, error?: string | null) => {
    dispatch({ type: 'SET_STEP', step, status, error })
  }

  const syncWorkflowContext = (result: { workflowId?: string; balance?: number }) => {
    if (result.workflowId) setWorkflowId(result.workflowId)
    if (typeof result.balance === 'number') setCreditBalance(result.balance)
  }

  const invalidateSavedDraft = () => {
    setDraftId(null)
    setIsPublished(false)
  }

  const invalidateAfterOutline = () => {
    dispatch({ type: 'RESET_DOWNSTREAM', step: 'image_idea' })
    setImageIdea('')
    setGeneratedContent('')
    setImageOptions([])
    invalidateSavedDraft()
  }

  const invalidateAfterImageIdea = () => {
    dispatch({ type: 'RESET_DOWNSTREAM', step: 'content_generation' })
    setGeneratedContent('')
    setImageOptions([])
    invalidateSavedDraft()
  }

  const invalidateAfterContent = () => {
    dispatch({ type: 'RESET_DOWNSTREAM', step: 'save' })
    invalidateSavedDraft()
  }

  const invalidateAfterImageOptions = () => {
    dispatch({ type: 'RESET_DOWNSTREAM', step: 'save' })
    invalidateSavedDraft()
  }

  const resetFromOutline = () => {
    dispatch({ type: 'RESET_DOWNSTREAM', step: 'outline' })
    setOutline('')
    setImageIdea('')
    setGeneratedContent('')
    setImageOptions([])
    setWorkflowId(null)
    invalidateSavedDraft()
  }

  const runOutline = async () => {
    if (!canRunOutline) return
    invalidateAfterOutline()
    setStep('outline', 'loading')
    const result = await generateOutline({
      workflowId,
      topic,
      platform,
      postLength,
      postType,
      useIcons,
    })
    syncWorkflowContext(result)
    if (result.success && result.data) {
      setOutline(result.data)
      setStep('outline', 'success')
      addToast('Đã tạo outline')
      return
    }
    setStep('outline', 'error', result.error || 'Lỗi outline')
    addToast(result.error || 'Lỗi outline', 'error')
  }

  const runImageIdea = async () => {
    if (!canRunImageIdea) return
    invalidateAfterImageIdea()
    setStep('image_idea', 'loading')
    const result = await generateImageIdea({
      workflowId,
      topic,
      platform,
      postLength,
      postType,
      useIcons,
      outline,
    })
    syncWorkflowContext(result)
    if (result.success && result.data) {
      setImageIdea(result.data)
      setStep('image_idea', 'success')
      addToast('Đã tạo image idea')
      return
    }
    setStep('image_idea', 'error', result.error || 'Lỗi image idea')
    addToast(result.error || 'Lỗi image idea', 'error')
  }

  const runContent = async () => {
    if (!canRunContent) return
    invalidateAfterContent()
    setStep('content_generation', 'loading')
    const result = await generateContentFromWorkflow({
      workflowId,
      topic,
      platform,
      postLength,
      postType,
      outline,
      imageIdea,
      useIcons,
    })
    syncWorkflowContext(result)
    if (result.success && result.data) {
      setGeneratedContent(result.data)
      setStep('content_generation', 'success')
      addToast('Đã tạo content')
      return
    }
    setStep('content_generation', 'error', result.error || 'Lỗi tạo content')
    addToast(result.error || 'Lỗi tạo content', 'error')
  }

  const runImageOptions = async () => {
    if (!canRunImages) return
    invalidateAfterImageOptions()
    setStep('image_generation', 'loading')
    const result = await generateImages3Options({
      workflowId,
      topic,
      platform,
      postLength,
      postType,
      useIcons,
      imageIdea,
    })
    syncWorkflowContext(result)
    if (result.success && result.data) {
      setImageOptions(result.data)
      setStep('image_generation', 'success')
      addToast('Đã tạo 3 image options')
      return
    }
    setStep('image_generation', 'error', result.error || 'Lỗi image options')
    addToast(result.error || 'Lỗi image options', 'error')
  }

  const runSave = async () => {
    if (!canSave) return
    setStep('save', 'loading')
    const result = await saveWorkflowDraft({
      workflowId,
      topic,
      content: generatedContent,
      platform,
      postLength,
      metadata: { outline, imageIdea, imageOptions },
    })
    if (result.success && result.draftId) {
      setDraftId(result.draftId)
      setStep('save', 'success')
      addToast('Đã lưu draft')
      return
    }
    setStep('save', 'error', result.error || 'Lỗi lưu draft')
    addToast(result.error || 'Lỗi lưu draft', 'error')
  }

  const runAll = async () => {
    if (!topic.trim()) {
      addToast('Vui lòng nhập chủ đề trước khi chạy workflow.', 'error')
      return
    }

    setIsRunningAll(true)
    let currentWorkflowId = workflowId
    invalidateAfterOutline()

    setStep('outline', 'loading')
    const outlineResult = await generateOutline({
      workflowId: currentWorkflowId,
      topic,
      platform,
      postLength,
      postType,
      useIcons,
    })
    syncWorkflowContext(outlineResult)
    currentWorkflowId = outlineResult.workflowId ?? currentWorkflowId
    if (!outlineResult.success || !outlineResult.data) {
      setStep('outline', 'error', outlineResult.error || 'Lỗi outline')
      addToast(outlineResult.error || 'Lỗi outline', 'error')
      setIsRunningAll(false)
      return
    }
    const outlineValue = outlineResult.data
    setOutline(outlineValue)
    setStep('outline', 'success')

    setStep('image_idea', 'loading')
    const imageIdeaResult = await generateImageIdea({
      workflowId: currentWorkflowId,
      topic,
      platform,
      postLength,
      postType,
      useIcons,
      outline: outlineValue,
    })
    syncWorkflowContext(imageIdeaResult)
    currentWorkflowId = imageIdeaResult.workflowId ?? currentWorkflowId
    if (!imageIdeaResult.success || !imageIdeaResult.data) {
      setStep('image_idea', 'error', imageIdeaResult.error || 'Lỗi image idea')
      addToast(imageIdeaResult.error || 'Lỗi image idea', 'error')
      setIsRunningAll(false)
      return
    }
    const imageIdeaValue = imageIdeaResult.data
    setImageIdea(imageIdeaValue)
    setStep('image_idea', 'success')

    setStep('content_generation', 'loading')
    const contentResult = await generateContentFromWorkflow({
      workflowId: currentWorkflowId,
      topic,
      platform,
      postLength,
      postType,
      outline: outlineValue,
      imageIdea: imageIdeaValue,
      useIcons,
    })
    syncWorkflowContext(contentResult)
    currentWorkflowId = contentResult.workflowId ?? currentWorkflowId
    if (!contentResult.success || !contentResult.data) {
      setStep('content_generation', 'error', contentResult.error || 'Lỗi tạo content')
      addToast(contentResult.error || 'Lỗi tạo content', 'error')
      setIsRunningAll(false)
      return
    }
    setGeneratedContent(contentResult.data)
    setStep('content_generation', 'success')

    setStep('image_generation', 'loading')
    const imageOptionsResult = await generateImages3Options({
      workflowId: currentWorkflowId,
      topic,
      platform,
      postLength,
      postType,
      useIcons,
      imageIdea: imageIdeaValue,
    })
    syncWorkflowContext(imageOptionsResult)
    if (!imageOptionsResult.success || !imageOptionsResult.data) {
      setStep('image_generation', 'error', imageOptionsResult.error || 'Lỗi image options')
      addToast(imageOptionsResult.error || 'Lỗi image options', 'error')
      setIsRunningAll(false)
      return
    }
    setImageOptions(imageOptionsResult.data)
    setStep('image_generation', 'success')

    addToast('Workflow đã chạy xong. Bạn có thể sang bước 3 để lưu.')
    setIsRunningAll(false)
  }

  const handleCopy = async () => {
    if (!generatedContent) return
    await navigator.clipboard.writeText(generatedContent)
    addToast('Đã sao chép nội dung!')
  }

  const handleMarkPublished = async () => {
    if (!draftId) return
    const result = await markAsPublished(draftId)
    if (result.success) {
      setIsPublished(true)
      addToast('Đã đánh dấu đã đăng!')
      return
    }
    addToast(result.error || 'Lỗi publish', 'error')
  }

  const handleResetAll = () => {
    setPage(1)
    setTopic('')
    setOutline('')
    setImageIdea('')
    setGeneratedContent('')
    setImageOptions([])
    setWorkflowId(null)
    setCreditBalance(null)
    setDraftId(null)
    setIsPublished(false)
    setIsRunningAll(false)
    dispatch({ type: 'RESET' })
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto min-h-screen">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Workflow Content Generator</h1>
          <p className="text-muted-foreground mt-2">Bước 1: Setup • Bước 2: Chạy workflow • Bước 3: Lưu kết quả</p>
        </div>
        <CreditBalance balance={creditBalance} />
      </div>

      <div className="mb-6">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-linear-to-r from-primary to-violet-500"
            animate={{ width: `${(page / 3) * 100}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Bước hiện tại: {page}/3</div>
      </div>

      <AnimatePresence mode="wait">
        {page === 1 && (
          <motion.div key="page-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-border p-5 bg-card space-y-4">
                <h2 className="font-bold">Bước 1 — Nhập thông tin</h2>

                <div>
                  <label className="text-xs font-bold">Platform</label>
                  <select
                    value={platform}
                    onChange={e => {
                      setPlatform(e.target.value as Platform)
                      resetFromOutline()
                    }}
                    className="mt-1 w-full rounded-xl border border-border p-2 text-sm"
                  >
                    {PLATFORMS.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold">Post type</label>
                  <select
                    value={postType}
                    onChange={e => {
                      setPostType(e.target.value as PostType)
                      resetFromOutline()
                    }}
                    className="mt-1 w-full rounded-xl border border-border p-2 text-sm"
                  >
                    {POST_TYPES.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold">Post length</label>
                  <select
                    value={postLength}
                    onChange={e => {
                      setPostLength(e.target.value as PostLength)
                      resetFromOutline()
                    }}
                    className="mt-1 w-full rounded-xl border border-border p-2 text-sm"
                  >
                    {POST_LENGTHS.map(l => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold">Topic</label>
                  <textarea
                    value={topic}
                    onChange={e => {
                      setTopic(e.target.value)
                      resetFromOutline()
                    }}
                    rows={5}
                    placeholder="Nhập chủ đề..."
                    className="mt-1 w-full rounded-xl border border-border p-3 text-sm"
                  />
                </div>

                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-bold">Generate icon/emoji trong bài viết</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUseIcons(true)
                        resetFromOutline()
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-semibold border',
                        useIcons ? 'bg-primary text-white border-primary' : 'bg-white text-foreground border-border'
                      )}
                    >
                      Có
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUseIcons(false)
                        resetFromOutline()
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-semibold border',
                        !useIcons ? 'bg-primary text-white border-primary' : 'bg-white text-foreground border-border'
                      )}
                    >
                      Không
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!canGoPage2) {
                      addToast('Vui lòng nhập chủ đề trước khi tiếp tục.', 'error')
                      return
                    }
                    setPage(2)
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-3 font-semibold"
                >
                  Tiếp tục <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-2xl border border-border p-5 bg-card">
                <h3 className="font-semibold">Tóm tắt cấu hình</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Nền tảng:</span> {activePlatform?.label}</p>
                  <p><span className="text-muted-foreground">Chủ đề:</span> {topic || '—'}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {page === 2 && (
          <motion.div key="page-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-3">
                <button
                  onClick={runAll}
                  disabled={isRunningAll || !topic.trim()}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold',
                    isRunningAll || !topic.trim()
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-white hover:opacity-90'
                  )}
                >
                  {isRunningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run all workflow
                </button>

                <WorkflowNodeCard
                  id="outline"
                  title="1. Outline"
                  description="Tạo dàn ý chính"
                  status={workflow.outline.status}
                  error={workflow.outline.error}
                  onRun={runOutline}
                  canRun={canRunOutline}
                  isRunningAll={isRunningAll}
                  isSelected={previewPanelMode === 'step' && selectedPreviewStep === 'outline'}
                  onSelect={id => {
                    setSelectedPreviewStep(id)
                    setPreviewPanelMode('step')
                  }}
                />
                <WorkflowNodeCard
                  id="image_idea"
                  title="2. Image Idea"
                  description="Ý tưởng ảnh"
                  status={workflow.image_idea.status}
                  error={workflow.image_idea.error}
                  onRun={runImageIdea}
                  canRun={canRunImageIdea}
                  isRunningAll={isRunningAll}
                  isSelected={previewPanelMode === 'step' && selectedPreviewStep === 'image_idea'}
                  onSelect={id => {
                    setSelectedPreviewStep(id)
                    setPreviewPanelMode('step')
                  }}
                />
                <WorkflowNodeCard
                  id="content_generation"
                  title="3. Content"
                  description="Sinh nội dung"
                  status={workflow.content_generation.status}
                  error={workflow.content_generation.error}
                  onRun={runContent}
                  canRun={canRunContent}
                  isRunningAll={isRunningAll}
                  isSelected={previewPanelMode === 'step' && selectedPreviewStep === 'content_generation'}
                  onSelect={id => {
                    setSelectedPreviewStep(id)
                    setPreviewPanelMode('step')
                  }}
                />
                <WorkflowNodeCard
                  id="image_generation"
                  title="4. Image Options"
                  description="3 prompt ảnh"
                  status={workflow.image_generation.status}
                  error={workflow.image_generation.error}
                  onRun={runImageOptions}
                  canRun={canRunImages}
                  isRunningAll={isRunningAll}
                  isSelected={previewPanelMode === 'step' && selectedPreviewStep === 'image_generation'}
                  onSelect={id => {
                    setSelectedPreviewStep(id)
                    setPreviewPanelMode('step')
                  }}
                />
              </div>

              <div className="lg:col-span-8 rounded-2xl border border-border bg-card min-h-[520px]">
                <div className="p-4 border-b border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold">Output Preview</h2>
                    <button
                      onClick={() => setPreviewPanelMode('step')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-semibold border',
                        previewPanelMode === 'step'
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      Preview Step
                    </button>
                    <button
                      onClick={() => setPreviewPanelMode('output')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-semibold border',
                        previewPanelMode === 'output'
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      Output Content
                    </button>
                  </div>
                  <button
                    onClick={handleCopy}
                    disabled={!generatedContent}
                    className="p-2 rounded-lg hover:bg-muted disabled:opacity-40"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 text-sm">
                  {previewPanelMode === 'step' ? (
                    <MarkdownContent value={selectedStepMarkdown} fallback={selectedStepFallback} />
                  ) : (
                    <MarkdownContent value={generatedContent} fallback="Chưa có Output Content." />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setPage(1)} className="px-4 py-2 rounded-xl border border-border flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Quay lại bước 1
              </button>
              <button
                onClick={() => {
                  if (!canGoPage3) {
                    addToast('Hãy tạo content trước khi sang bước 3.', 'error')
                    return
                  }
                  setPage(3)
                }}
                className="px-4 py-2 rounded-xl bg-primary text-white flex items-center gap-2"
              >
                Sang bước 3 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {page === 3 && (
          <motion.div key="page-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 rounded-2xl border border-border bg-card">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold">Bước 3 — Lưu kết quả</h2>
                  <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-muted" disabled={!generatedContent}>
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 text-sm max-h-[460px] overflow-auto">
                  <MarkdownContent value={generatedContent} fallback="Chưa có Content." />
                </div>
              </div>

              <div className="lg:col-span-4 space-y-3">
                <button
                  onClick={runSave}
                  disabled={!canSave || workflow.save.status === 'loading'}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2',
                    !canSave || workflow.save.status === 'loading'
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-white'
                  )}
                >
                  {workflow.save.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkCheck className="w-4 h-4" />} Lưu draft
                </button>

                <button
                  onClick={handleMarkPublished}
                  disabled={!draftId || isPublished}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl text-sm font-semibold',
                    !draftId || isPublished ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-emerald-600 text-white'
                  )}
                >
                  {isPublished ? 'Đã published' : 'Mark as published'}
                </button>

                <button onClick={() => setPage(2)} className="w-full px-4 py-3 rounded-xl border border-border flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Quay lại bước 2
                </button>

                <button onClick={handleResetAll} className="w-full px-4 py-3 rounded-xl border border-border flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Tạo workflow mới
                </button>

                {draftId && <p className="text-xs text-muted-foreground">Draft ID: {draftId}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
