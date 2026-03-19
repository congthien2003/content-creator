"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import type { Platform, PostLength, PostType } from "@/lib/types";

const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
	facebook:
		"Viết cho Facebook. Sử dụng emoji phù hợp, đoạn ngắn, dễ đọc trên di động. Có thể kèm Call-to-Action cuối bài.",
	linkedin:
		"Viết cho LinkedIn. Giọng chuyên nghiệp, chia sẻ insight ngành, có hook mở đầu hấp dẫn. Sử dụng hashtag cuối bài.",
	blog: "Viết bài Blog/SEO. Có tiêu đề chính (H1), các tiêu đề phụ (H2/H3), đoạn mở đầu hấp dẫn, nội dung chi tiết, và kết luận.",
	tiktok: "Viết script/caption cho TikTok. Ngắn gọn, bắt trend, gần gũi giới trẻ. Mở đầu hook mạnh trong 3 giây đầu. Kèm hashtag phù hợp.",
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

interface GenerateResult {
	success: boolean;
	content?: string;
	draftId?: string;
	error?: string;
}

export async function generateContent(
	topic: string,
	platform: Platform,
	postLength: PostLength,
	postType: PostType,
): Promise<GenerateResult> {
	try {
		const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
		if (!apiKey) {
			return {
				success: false,
				error: "Thiếu GOOGLE_GEMINI_API_KEY trong biến môi trường.",
			};
		}

		const supabase = await createClient();

		// Fetch knowledge base (profile)
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
				if (profile.brand_name)
					parts.push(`Tên thương hiệu: ${profile.brand_name}`);
				if (profile.brand_voice)
					parts.push(`Văn phong: ${profile.brand_voice}`);
				if (profile.core_context)
					parts.push(`Ngữ cảnh: ${profile.core_context}`);
				knowledgeContext = parts.join("\n");
			}
		}

		// Build master prompt with SEO/GEO mindset
		const masterPrompt = `Bạn là một chuyên gia viết nội dung Marketing, đồng thời là một chuyên gia SEO (Search Engine Optimization) và GEO (Generative Engine Optimization) hàng đầu.

## Nguyên tắc SEO & GEO (Quan trọng)
- **User-first & E-E-A-T**: Ưu tiên chất lượng cho người dùng thực. Thể hiện Kinh nghiệm (Experience), Chuyên môn (Expertise), Thẩm quyền (Authoritativeness) và Sự tin cậy (Trustworthiness).
- **GEO Optimized**: Cấu trúc nội dung để dễ dàng được các mô hình AI (ChatGPT, Claude, Perplexity) trích dẫn. Sử dụng các định nghĩa rõ ràng, số liệu thống kê logic, và các bước hướng dẫn chi tiết.
- **Cấu trúc chuẩn**: Sử dụng FAQ nếu phù hợp, đảm bảo cấp bậc tiêu đề (H1-H6) chuẩn SEO, và lồng ghép các từ khóa một cách tự nhiên.
- **Dual-target**: Mục tiêu là vừa đứng đầu Google, vừa được AI chọn làm nguồn tham khảo.

${knowledgeContext ? `## Thông tin thương hiệu\n${knowledgeContext}\n` : ""}
## Yêu cầu cụ thể
- Chủ đề: "${topic}"
- ${PLATFORM_INSTRUCTIONS[platform]}
- ${LENGTH_INSTRUCTIONS[postLength]}
- ${TYPE_INSTRUCTIONS[postType]}

## Quy tắc định dạng
- Viết hoàn toàn bằng tiếng Việt tự nhiên, không dịch máy.
- Trả về NỘI DUNG bài viết trực tiếp, KHÔNG giải thích thêm.
- Không bắt đầu bằng "Dưới đây là..." hay "Đây là bài viết...".
- Sử dụng markdown formatting phù hợp (đặc biệt là cho Blog).`;

		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
		const result = await model.generateContent(masterPrompt);
		const content = result.response.text();

		// Save draft to database
		if (user) {
			const { data: draft, error: insertError } = await supabase
				.from("drafts")
				.insert({
					user_id: user.id,
					topic,
					content,
					platform,
					post_length: postLength,
					status: "draft",
				})
				.select("id")
				.single();

			if (insertError) {
				console.error("Insert draft error:", insertError);
				return { success: true, content };
			}

			return { success: true, content, draftId: draft.id };
		}

		return { success: true, content };
	} catch (err) {
		console.error("Generate error:", err);
		return {
			success: false,
			error: "Đã xảy ra lỗi khi tạo nội dung. Vui lòng thử lại.",
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
