'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/toast-provider'
import { getProfile, upsertProfile } from './actions'
import { motion } from 'framer-motion'
import {
  Save,
  Loader2,
  Brain,
  Building2,
  MessageSquareHeart,
  FileText,
  Sparkles,
  User,
  Mail,
  Phone,
} from 'lucide-react'

export default function SettingsPage() {
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [coreContext, setCoreContext] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getProfile()
      if (profile) {
        setName(profile.name || '')
        setEmail(profile.email || '')
        setPhone(profile.phone || '')
        setBrandName(profile.brand_name || '')
        setBrandVoice(profile.brand_voice || '')
        setCoreContext(profile.core_context || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const result = await upsertProfile({
      name,
      email,
      phone,
      brand_name: brandName,
      brand_voice: brandVoice,
      core_context: coreContext,
    })

    if (result.success) {
      addToast('Cài đặt đã được lưu! ✨')
    } else {
      addToast(result.error || 'Lỗi khi lưu', 'error')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto min-h-screen">
        <div className="space-y-6">
          <div className="shimmer h-12 w-48 rounded-2xl" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="shimmer h-32 rounded-3xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto min-h-screen">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Cung cấp ngữ cảnh để AI hiểu sâu về thương hiệu của bạn.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-3xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow group"
        >
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-4 px-1">
            <User className="w-3.5 h-3.5 text-primary" />
            Thông tin tài khoản
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground/80">
                <User className="w-3.5 h-3.5 text-primary" />
                Họ và tên
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn A"
                className="w-full px-4 py-3 rounded-2xl border border-border bg-muted/20 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground/80">
                <Mail className="w-3.5 h-3.5 text-primary" />
                Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                placeholder="you@example.com"
                className="w-full cursor-not-allowed px-4 py-3 rounded-2xl border border-border bg-muted/40 text-foreground/80 text-sm placeholder:text-muted-foreground/60 focus:outline-none transition-all"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Email này được đồng bộ từ tài khoản đăng nhập hiện tại.
              </p>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground/80">
                <Phone className="w-3.5 h-3.5 text-primary" />
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0901234567"
                className="w-full px-4 py-3 rounded-2xl border border-border bg-muted/20 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
              />
            </div>
          </div>
        </motion.div>

        {/* Brand Name */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-3xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow group"
        >
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3 px-1">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            Tên thương hiệu / Công ty
          </label>
          <input
            type="text"
            value={brandName}
            onChange={e => setBrandName(e.target.value)}
            placeholder="Ví dụ: TechViet Solutions"
            className="w-full px-4 py-3 rounded-2xl border border-border bg-muted/20 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
          />
        </motion.div>

        {/* Brand Voice */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-3xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow group"
        >
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3 px-1">
            <MessageSquareHeart className="w-3.5 h-3.5 text-primary" />
            Văn phong thương hiệu
          </label>
          <textarea
            value={brandVoice}
            onChange={e => setBrandVoice(e.target.value)}
            placeholder="Ví dụ: Chuyên nghiệp nhưng gần gũi, giọng văn tự tin và truyền cảm hứng..."
            rows={3}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-muted/20 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none"
          />
        </motion.div>

        {/* Core Context */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-3xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow group"
        >
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3 px-1">
            <FileText className="w-3.5 h-3.5 text-primary" />
            Ngữ cảnh cốt lõi
          </label>
          <textarea
            value={coreContext}
            onChange={e => setCoreContext(e.target.value)}
            placeholder="Ví dụ: Chúng tôi là công ty công nghệ chuyên cung cấp giải pháp phần mềm cho SMEs..."
            rows={6}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-muted/20 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none"
          />
          <div className="flex items-start gap-2 mt-4 px-1">
            <Sparkles className="w-3.5 h-3.5 text-primary/50 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed font-medium italic">
              AI sẽ tự động lồng ghép thông tin về sản phẩm, USP và khách hàng mục tiêu để tạo ra nội dung sát nhất với thực tế của bạn.
            </p>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.45 }}
           className="pt-4"
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-3 w-full px-8 py-5 rounded-3xl text-sm font-bold text-white bg-linear-to-r from-primary to-accent hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-md disabled:opacity-70 disabled:cursor-wait relative overflow-hidden"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Đang lưu cài đặt...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Cập nhật Knowledge Base</span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
