import type { Platform, PostLength, PostType } from './types'

export const PLATFORMS: { value: Platform; label: string; icon: string }[] = [
  { value: 'facebook', label: 'Facebook', icon: '📘' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'blog', label: 'Blog / SEO', icon: '📝' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'twitter', label: 'Twitter / X', icon: '🐦' },
]

export const POST_LENGTHS: { value: PostLength; label: string; description: string }[] = [
  { value: 'short', label: 'Ngắn', description: '~100 từ' },
  { value: 'medium', label: 'Vừa', description: '~300 từ' },
  { value: 'long', label: 'Dài', description: '~600 từ' },
]

export const POST_TYPES: { value: PostType; label: string; icon: string }[] = [
  { value: 'promotional', label: 'Quảng cáo / Bán hàng', icon: '🛒' },
  { value: 'educational', label: 'Chia sẻ kiến thức', icon: '📚' },
  { value: 'storytelling', label: 'Kể chuyện', icon: '📖' },
  { value: 'engagement', label: 'Tương tác / Hỏi đáp', icon: '💬' },
  { value: 'announcement', label: 'Thông báo / Sự kiện', icon: '📢' },
]
