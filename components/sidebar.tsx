'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  PenLine,
  ClockArrowUp,
  Settings,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  LogIn,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/', label: 'Tạo bài viết', icon: PenLine },
  { href: '/history', label: 'Lịch sử', icon: ClockArrowUp },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
]

const AUTH_ITEMS = [
  { href: '/auth/login', label: 'Đăng nhập', icon: LogIn },
  { href: '/auth/signup', label: 'Tạo tài khoản', icon: UserPlus },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar-bg text-sidebar-text transition-all duration-300 ease-in-out h-screen sticky top-0',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-20 border-b border-white/5">
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-linear-to-br from-primary to-accent shrink-0 shadow-lg shadow-primary/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-extrabold text-white tracking-tight whitespace-nowrap">
              ContentAI
            </h1>
            <p className="text-[9px] text-white/50 tracking-[0.2em] font-bold uppercase">
              Premium
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2 px-3 py-6">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 group relative overflow-hidden',
                isActive
                  ? 'bg-sidebar-active text-white shadow-xl shadow-primary/20'
                  : 'text-sidebar-text hover:bg-white/5 hover:text-white'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={cn(
                  'w-5 h-5 shrink-0 transition-transform duration-300',
                  isActive ? 'text-white scale-110' : 'text-sidebar-text group-hover:text-white'
                )}
              />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              {isActive && (
                <motion.div 
                  layoutId="sidebar-active"
                  className="absolute left-0 w-1 h-6 bg-white rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-3">
        <div className="mb-2 h-px bg-white/5" />
        <div className="flex flex-col gap-2">
          {AUTH_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-sidebar-text hover:bg-white/5 hover:text-white'
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Collapse toggle */}
      <div className="px-3 pb-6">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-sidebar-text hover:bg-white/5 hover:text-white transition-all w-full"
        >
          {collapsed ? (
            <PanelLeft className="w-5 h-5 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="w-5 h-5 shrink-0" />
              <span>Thu gọn menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
