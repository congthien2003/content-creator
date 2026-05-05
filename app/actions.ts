"use server";

import { createClient } from "@/utils/supabase/server";
import { generateText } from "@/lib/ai/client";
import type {
  Platform,
  PostLength,
  PostType,
  WorkflowImageOption,
  WorkflowMetadata,
} from "@/lib/types";

const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
  facebook:
    "Viết cho Facebook. Sử dụng emoji phù hợp, đoạn ngắn, dễ đọc trên di động. Có thể kèm Call-to-Action cuối bài.",
  linkedin:
    "Viết cho LinkedIn. Giọng chuyên nghiệp, chia sẻ insight ngành, có hook mở đầu hấp dẫn. Sử dụng hashtag cuối bài.",
  blog: "Viết bài Blog/SEO. Có tiêu đề chính (H1), các tiêu đề phụ (H2/H3), đoạn mở đầu hấp dẫn, nội dung chi tiết, và kết luận.",
  tiktok:
    "Viết script/caption cho TikTok. Ngắn gọn, bắt trend, gần gũi giới trẻ. Mở đầu hook mạnh trong 3 giây đầu. Kèm hashtag phù hợp.",
  instagram:
    "Viết caption Instagram. Hấp dẫn, có storytelling, emoji sáng tạo, và hashtag liên quan ở cuối.",
  twitter:
    "Viết cho Twitter/X. Ngắn gọn, súc tích, có thể dạng thread (đánh số 1/n). Mỗi tweet tối đa 280 ký tự.",
};

const LENGTH_INSTRUCTIONS: Record<PostLength, string> = {
  short: "Viết ngắn gọn, khoảng 80-120 từ.",
  medium: "Viết mức độ vừa phải, khoảng 250-350 từ.",
  long: "Viết bài dài, chi tiết, khoảng 500-700 từ.",
};

const TYPE_INSTRUCTIONS: Record<PostType, string> = {
  promotional:
    "Mục đích quảng cáo/bán hàng. Nhấn mạnh lợi ích sản phẩm, tạo urgency, có CTA rõ ràng.",
  educational:
    "Mục đích chia sẻ kiến thức. Cung cấp giá trị thực, data/stats nếu có, dễ hiểu.",
  storytelling:
    "Mục đích kể chuyện. Có nhân vật, tình huống, cảm xúc, bài học. Tạo kết nối với người đọc.",
  engagement:
    "Mục đích tạo tương tác. Đặt câu hỏi mở, tạo poll, khuyến khích bình luận và chia sẻ.",
  announcement:
    "Mục đích thông báo/sự kiện. Rõ ràng, highlight thông tin quan trọng (ngày, giờ, địa điểm, link).",
};

const CONTENT_WRITER_SKILL = `# Content Writer\n\nYou write compelling marketing copy. Follow these principles:\n\n## Voice\n- Conversational but professional\n- Active voice, present tense\n- Short sentences, short paragraphs\n\n## Structure\n- Lead with the biggest benefit\n- Use specific numbers over vague claims\n- End with a clear call-to-action\n\n## Rules\n- No jargon unless the audience expects it\n- No superlatives without proof ("best", "revolutionary")\n- Every paragraph must earn its place`;

const CONTENT_ENGINE_SKILL = `# Content Engine\n\n## Non-Negotiables\n1. Start from source material, not generic post formulas.\n2. Adapt the format for the platform, not the persona.\n3. One post should carry one actual claim.\n4. Specificity beats adjectives.\n5. No engagement bait unless explicitly asked.\n\n## Quality Gate\n- every draft sounds like the intended author\n- every draft contains a real claim, proof point, or concrete observation\n- no generic hype language remains\n- no fake engagement bait remains`;

const SKILL_VERSION = "content-writer@1.0 + content-engine@1.0";

async function getKnowledgeContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let knowledgeContext = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("brand_name, brand_voice, core_context")
      .eq("id", user.id)
      .single();

    if (profile) {
      const parts: string[] = [];
      if (profile.brand_name) parts.push(`Tên thương hiệu: ${profile.brand_name}`);
      if (profile.brand_voice) parts.push(`Văn phong: ${profile.brand_voice}`);
      if (profile.core_context) parts.push(`Ngữ cảnh: ${profile.core_context}`);
      knowledgeContext = parts.join("\n");
    }
  }

  return { supabase, user, knowledgeContext };
}

export async function generateOutline(topic: string) {
  try {
    const prompt = `Tạo dàn ý nội dung marketing bằng tiếng Việt cho chủ đề: "${topic}".\n\nYêu cầu:\n- 1 hook mở đầu\n- 3-5 ý chính dạng bullet\n- 1 CTA gợi ý\n- Trả về ngắn gọn, không giải thích.`;

    const content = await generateText(prompt);
    return { success: true, data: content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi tạo outline.",
    };
  }
}

export async function generateImageIdea(topic: string, outline: string) {
  try {
    const prompt = `Tạo 1 ý tưởng hình ảnh chủ đạo cho bài viết tiếng Việt.\n\nChủ đề: ${topic}\nDàn ý: ${outline}\n\nYêu cầu:\n- 1 concept hình ảnh rõ ràng\n- Mô tả mood/style\n- Mô tả thành phần chính\n- Trả về ngắn gọn.`;

    const content = await generateText(prompt);
    return { success: true, data: content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi tạo image idea.",
    };
  }
}

export async function generateImages3Options(topic: string, imageIdea: string) {
  try {
    const prompt = `Dựa trên chủ đề và image idea, tạo đúng 3 prompt ảnh khác nhau để đưa vào công cụ text-to-image.\n\nChủ đề: ${topic}\nImage idea: ${imageIdea}\n\nĐịnh dạng trả về strict JSON array:\n[{"id":"1","prompt":"..."},{"id":"2","prompt":"..."},{"id":"3","prompt":"..."}]`;

    const raw = (await generateText(prompt)).trim();
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText) as WorkflowImageOption[];
    if (!Array.isArray(parsed) || parsed.length !== 3) {
      return { success: false, error: "Không parse được 3 image options." };
    }
    return { success: true, data: parsed };
  } catch {
    return {
      success: false,
      error: "Lỗi tạo 3 image options. Hãy thử lại.",
    };
  }
}

export async function generateContentFromWorkflow(input: {
  topic: string;
  platform: Platform;
  postLength: PostLength;
  postType: PostType;
  outline: string;
  imageIdea: string;
  useIcons?: boolean;
}) {
  try {
    const { knowledgeContext } = await getKnowledgeContext();

    const masterPrompt = `Bạn là một chuyên gia viết nội dung Marketing, SEO và GEO.\n\n## Injected Skills\n${CONTENT_WRITER_SKILL}\n\n${CONTENT_ENGINE_SKILL}\n\n## Nguyên tắc SEO & GEO\n- User-first & E-E-A-T\n- Cấu trúc nội dung dễ trích dẫn bởi AI\n- Có luận điểm rõ ràng, cụ thể\n\n${knowledgeContext ? `## Thông tin thương hiệu\n${knowledgeContext}\n` : ""}## Input workflow\n- Chủ đề: "${input.topic}"\n- Dàn ý: ${input.outline}\n- Ý tưởng hình ảnh: ${input.imageIdea}\n- ${PLATFORM_INSTRUCTIONS[input.platform]}\n- ${LENGTH_INSTRUCTIONS[input.postLength]}\n- ${TYPE_INSTRUCTIONS[input.postType]}\n- Quy tắc icon/emoji: ${input.useIcons ? 'Được phép sử dụng icon/emoji phù hợp ngữ cảnh.' : 'Không sử dụng icon/emoji trong nội dung.'}\n\n## Output\n- Viết hoàn toàn bằng tiếng Việt tự nhiên\n- Trả về trực tiếp nội dung cuối cùng, không giải thích\n- Nếu là blog, dùng markdown heading hợp lý`;

    const content = await generateText(masterPrompt);
    return { success: true, data: content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi tạo content.",
    };
  }
}

export async function saveWorkflowDraft(input: {
  topic: string;
  content: string;
  platform: Platform;
  postLength: PostLength;
  metadata: WorkflowMetadata;
}) {
  try {
    const { supabase, user } = await getKnowledgeContext();
    if (!user) return { success: false, error: "Bạn cần đăng nhập để lưu draft." };

    const { data: draft, error } = await supabase
      .from("drafts")
      .insert({
        user_id: user.id,
        topic: input.topic,
        content: input.content,
        platform: input.platform,
        post_length: input.postLength,
        status: "draft",
        metadata: { ...input.metadata, skillVersion: SKILL_VERSION },
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, draftId: draft.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi lưu draft.",
    };
  }
}

export async function markAsPublished(draftId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("drafts")
    .update({ status: "published" })
    .eq("id", draftId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function markAsDraft(draftId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("drafts")
    .update({ status: "draft" })
    .eq("id", draftId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deleteDraft(draftId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("drafts").delete().eq("id", draftId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
