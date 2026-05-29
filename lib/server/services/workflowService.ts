import { generateText } from '@/lib/ai/client'
import type {
  Platform,
  PostLength,
  PostType,
  WorkflowActionResult,
  WorkflowImageOption,
  WorkflowPersistedStepId,
} from '@/lib/types'
import { getCurrentUser } from '@/lib/server/auth/currentUser'
import { getProfileById } from '@/lib/server/repositories/profileRepository'
import {
  createWorkflow,
  getNextAttemptNumber,
  getWorkflowById,
  recordFailedWorkflowStep,
  recordSuccessfulWorkflowStepWithCharge,
} from '@/lib/server/repositories/workflowRepository'
import { createPayloadHash } from '@/lib/server/security/hash'
import { ensureUserAccount } from '@/lib/server/services/accountService'
import { assertEnoughCreditForStep } from '@/lib/server/services/creditService'

const CONTENT_WRITER_SKILL = `# Content Writer

You write compelling marketing copy. Follow these principles:

## Voice
- Conversational but professional
- Active voice, present tense
- Short sentences, short paragraphs

## Structure
- Lead with the biggest benefit
- Use specific numbers over vague claims
- End with a clear call-to-action

## Rules
- No jargon unless the audience expects it
- No superlatives without proof ("best", "revolutionary")
- Every paragraph must earn its place`

const CONTENT_ENGINE_SKILL = `# Content Engine

## Non-Negotiables
1. Start from source material, not generic post formulas.
2. Adapt the format for the platform, not the persona.
3. One post should carry one actual claim.
4. Specificity beats adjectives.
5. No engagement bait unless explicitly asked.

## Quality Gate
- every draft sounds like the intended author
- every draft contains a real claim, proof point, or concrete observation
- no generic hype language remains
- no fake engagement bait remains`

const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
  facebook:
    'Viết cho Facebook. Sử dụng emoji phù hợp, đoạn ngắn, dễ đọc trên di động. Có thể kèm Call-to-Action cuối bài.',
  linkedin:
    'Viết cho LinkedIn. Giọng chuyên nghiệp, chia sẻ insight ngành, có hook mở đầu hấp dẫn. Sử dụng hashtag cuối bài.',
  blog: 'Viết bài Blog/SEO. Có tiêu đề chính (H1), các tiêu đề phụ (H2/H3), đoạn mở đầu hấp dẫn, nội dung chi tiết, và kết luận.',
  tiktok:
    'Viết script/caption cho TikTok. Ngắn gọn, bắt trend, gần gũi giới trẻ. Mở đầu hook mạnh trong 3 giây đầu. Kèm hashtag phù hợp.',
  instagram:
    'Viết caption Instagram. Hấp dẫn, có storytelling, emoji sáng tạo, và hashtag liên quan ở cuối.',
  twitter:
    'Viết cho Twitter/X. Ngắn gọn, súc tích, có thể dạng thread (đánh số 1/n). Mỗi tweet tối đa 280 ký tự.',
}

const LENGTH_INSTRUCTIONS: Record<PostLength, string> = {
  short: 'Viết ngắn gọn, khoảng 80-120 từ.',
  medium: 'Viết mức độ vừa phải, khoảng 250-350 từ.',
  long: 'Viết bài dài, chi tiết, khoảng 500-700 từ.',
}

const TYPE_INSTRUCTIONS: Record<PostType, string> = {
  promotional:
    'Mục đích quảng cáo/bán hàng. Nhấn mạnh lợi ích sản phẩm, tạo urgency, có CTA rõ ràng.',
  educational:
    'Mục đích chia sẻ kiến thức. Cung cấp giá trị thực, data/stats nếu có, dễ hiểu.',
  storytelling:
    'Mục đích kể chuyện. Có nhân vật, tình huống, cảm xúc, bài học. Tạo kết nối với người đọc.',
  engagement:
    'Mục đích tạo tương tác. Đặt câu hỏi mở, tạo poll, khuyến khích bình luận và chia sẻ.',
  announcement:
    'Mục đích thông báo/sự kiện. Rõ ràng, highlight thông tin quan trọng (ngày, giờ, địa điểm, link).',
}

export interface WorkflowRunInput {
  workflowId?: string | null
  topic: string
  platform: Platform
  postLength: PostLength
  postType: PostType
  useIcons?: boolean
  outline?: string
  imageIdea?: string
}

function buildKnowledgeContext(profile: {
  brand_name?: string | null
  brand_voice?: string | null
  core_context?: string | null
} | null) {
  if (!profile) return ''

  const parts: string[] = []
  if (profile.brand_name) parts.push(`Tên thương hiệu: ${profile.brand_name}`)
  if (profile.brand_voice) parts.push(`Văn phong: ${profile.brand_voice}`)
  if (profile.core_context) parts.push(`Ngữ cảnh: ${profile.core_context}`)
  return parts.join('\n')
}

function buildResolvedWorkflowInput(
  workflow: {
    id: string
    topic: string
    platform: Platform
    post_length: PostLength
    post_type: PostType
    use_icons: boolean
  },
  input: WorkflowRunInput
): WorkflowRunInput {
  return {
    workflowId: workflow.id,
    topic: workflow.topic,
    platform: workflow.platform,
    postLength: workflow.post_length,
    postType: workflow.post_type,
    useIcons: workflow.use_icons,
    outline: input.outline,
    imageIdea: input.imageIdea,
  }
}

async function getOrCreateWorkflow(input: WorkflowRunInput) {
  const { supabase, user, error } = await getCurrentUser()
  if (!user) {
    return { supabase, user: null, workflow: null, resolvedInput: null, error }
  }

  await ensureUserAccount(supabase, user)

  const workflow = input.workflowId
    ? await getWorkflowById(supabase, { userId: user.id, workflowId: input.workflowId })
    : await createWorkflow(supabase, {
        userId: user.id,
        topic: input.topic,
        platform: input.platform,
        postLength: input.postLength,
        postType: input.postType,
        useIcons: input.useIcons ?? true,
      })
  const profile = await getProfileById(supabase, user.id)

  return {
    supabase,
    user,
    workflow,
    resolvedInput: buildResolvedWorkflowInput(workflow, input),
    knowledgeContext: buildKnowledgeContext(profile),
    error: null,
  }
}

async function runChargedTextStep<T>(
  stepKey: WorkflowPersistedStepId,
  input: WorkflowRunInput,
  buildInputSnapshot: (resolvedInput: WorkflowRunInput) => Record<string, unknown>,
  buildPrompt: (resolvedInput: WorkflowRunInput, knowledgeContext: string) => string,
  toOutputSnapshot: (raw: string) => { data: T; outputSnapshot: Record<string, unknown> }
): Promise<WorkflowActionResult<T>> {
  try {
    const context = await getOrCreateWorkflow(input)
    if (!context.user || !context.workflow || !context.resolvedInput) {
      return { success: false, error: context.error ?? 'Bạn cần đăng nhập để tiếp tục.' }
    }

    const resolvedInput = context.resolvedInput
    const credit = await assertEnoughCreditForStep(context.supabase, {
      userId: context.user.id,
      postLength: resolvedInput.postLength,
    })

    if (!credit.ok) {
      return {
        success: false,
        workflowId: context.workflow.id,
        balance: credit.balance,
        error: credit.error ?? 'Không đủ credit.',
      }
    }

    const inputSnapshot = buildInputSnapshot(resolvedInput)
    const attemptNumber = await getNextAttemptNumber(context.supabase, {
      workflowId: context.workflow.id,
      stepKey,
    })

    const inputHash = createPayloadHash({
      userId: context.user.id,
      workflowId: context.workflow.id,
      stepKey,
      attemptNumber,
      payload: inputSnapshot,
    })

    try {
      const raw = await generateText(buildPrompt(resolvedInput, context.knowledgeContext ?? ''))
      const { data, outputSnapshot } = toOutputSnapshot(raw)
      const outputHash = createPayloadHash({
        userId: context.user.id,
        workflowId: context.workflow.id,
        stepKey,
        attemptNumber,
        payload: outputSnapshot,
      })

      const saved = await recordSuccessfulWorkflowStepWithCharge(context.supabase, {
        userId: context.user.id,
        workflowId: context.workflow.id,
        stepKey,
        attemptNumber,
        inputSnapshot,
        outputSnapshot,
        inputHash,
        outputHash,
        creditCost: credit.cost,
        reason: `Workflow step charge: ${stepKey}`,
      })

      return {
        success: true,
        data,
        workflowId: context.workflow.id,
        stepId: saved?.step_id,
        balance: Number(saved?.balance_after ?? credit.balance - credit.cost),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi tạo nội dung.'

      await recordFailedWorkflowStep(context.supabase, {
        userId: context.user.id,
        workflowId: context.workflow.id,
        stepKey,
        attemptNumber,
        inputSnapshot,
        inputHash,
        errorMessage: message,
      })

      return {
        success: false,
        workflowId: context.workflow.id,
        balance: credit.balance,
        error: message,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi workflow.',
    }
  }
}

export async function runOutlineStep(input: WorkflowRunInput) {
  return runChargedTextStep('outline', input, resolvedInput => ({
    topic: resolvedInput.topic,
    platform: resolvedInput.platform,
    postLength: resolvedInput.postLength,
    postType: resolvedInput.postType,
    useIcons: resolvedInput.useIcons ?? true,
  }), resolvedInput => {
    return `Tạo dàn ý nội dung marketing bằng tiếng Việt cho chủ đề: "${resolvedInput.topic}".\n\nYêu cầu:\n- 1 hook mở đầu\n- 3-5 ý chính dạng bullet\n- 1 CTA gợi ý\n- Trả về ngắn gọn, không giải thích.`
  }, raw => ({
    data: raw,
    outputSnapshot: { outline: raw },
  }))
}

export async function runImageIdeaStep(input: WorkflowRunInput) {
  return runChargedTextStep('image_idea', input, resolvedInput => ({
    topic: resolvedInput.topic,
    outline: resolvedInput.outline,
  }), resolvedInput => {
    return `Tạo 1 ý tưởng hình ảnh chủ đạo cho bài viết tiếng Việt.\n\nChủ đề: ${resolvedInput.topic}\nDàn ý: ${resolvedInput.outline}\n\nYêu cầu:\n- 1 concept hình ảnh rõ ràng\n- Mô tả mood/style\n- Mô tả thành phần chính\n- Trả về ngắn gọn.`
  }, raw => ({
    data: raw,
    outputSnapshot: { imageIdea: raw },
  }))
}

export async function runContentStep(input: WorkflowRunInput) {
  return runChargedTextStep('content_generation', input, resolvedInput => ({
    topic: resolvedInput.topic,
    platform: resolvedInput.platform,
    postLength: resolvedInput.postLength,
    postType: resolvedInput.postType,
    outline: resolvedInput.outline,
    imageIdea: resolvedInput.imageIdea,
    useIcons: resolvedInput.useIcons ?? true,
  }), (resolvedInput, knowledgeContext) => {
    return `Bạn là một chuyên gia viết nội dung Marketing, SEO và GEO.

## Injected Skills
${CONTENT_WRITER_SKILL}

${CONTENT_ENGINE_SKILL}

## Nguyên tắc SEO & GEO
- User-first & E-E-A-T
- Cấu trúc nội dung dễ trích dẫn bởi AI
- Có luận điểm rõ ràng, cụ thể

${knowledgeContext ? `## Thông tin thương hiệu\n${knowledgeContext}\n\n` : ''}## Input workflow
- Chủ đề: "${resolvedInput.topic}"
- Dàn ý: ${resolvedInput.outline}
- Ý tưởng hình ảnh: ${resolvedInput.imageIdea}
- ${PLATFORM_INSTRUCTIONS[resolvedInput.platform]}
- ${LENGTH_INSTRUCTIONS[resolvedInput.postLength]}
- ${TYPE_INSTRUCTIONS[resolvedInput.postType]}
- Quy tắc icon/emoji: ${resolvedInput.useIcons ? 'Được phép sử dụng icon/emoji phù hợp ngữ cảnh.' : 'Không sử dụng icon/emoji trong nội dung.'}

## Output
- Viết hoàn toàn bằng tiếng Việt tự nhiên
- Trả về trực tiếp nội dung cuối cùng, không giải thích
- Nếu là blog, dùng markdown heading hợp lý`
  }, raw => ({
    data: raw,
    outputSnapshot: { content: raw },
  }))
}

export async function runImageOptionsStep(input: WorkflowRunInput) {
  return runChargedTextStep<WorkflowImageOption[]>('image_generation', input, resolvedInput => ({
    topic: resolvedInput.topic,
    imageIdea: resolvedInput.imageIdea,
  }), resolvedInput => {
    return `Dựa trên chủ đề và image idea, tạo đúng 3 prompt ảnh khác nhau để đưa vào công cụ text-to-image.\n\nChủ đề: ${resolvedInput.topic}\nImage idea: ${resolvedInput.imageIdea}\n\nĐịnh dạng trả về strict JSON array:\n[{"id":"1","prompt":"..."},{"id":"2","prompt":"..."},{"id":"3","prompt":"..."}]`
  }, raw => {
    const jsonText = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(jsonText) as WorkflowImageOption[]

    if (!Array.isArray(parsed) || parsed.length !== 3) {
      throw new Error('Không parse được 3 image options.')
    }

    return {
      data: parsed,
      outputSnapshot: { imageOptions: parsed },
    }
  })
}
