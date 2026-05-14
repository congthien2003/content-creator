import Link from 'next/link'
import { signUp } from '../actions'

export default function SignupPage() {
  async function signup(formData: FormData) {
    'use server'

    await signUp(formData)
  }

  return (
    <div className="min-h-screen p-6 lg:p-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Tạo tài khoản</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tạo tài khoản để lưu draft và quản lý bài viết.
        </p>

        <form action={signup} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="text-xs font-bold">
              Họ tên
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 w-full rounded-xl border border-border p-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="phone" className="text-xs font-bold">
              Số điện thoại
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              className="mt-1 w-full rounded-xl border border-border p-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="email" className="text-xs font-bold">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-xl border border-border p-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-bold">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-border p-3 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white"
          >
            Tạo tài khoản
          </button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link href="/auth/login" className="font-semibold text-primary hover:opacity-80">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  )
}
