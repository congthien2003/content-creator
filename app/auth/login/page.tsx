import Link from 'next/link'
import { signIn } from '../actions'

export default function LoginPage() {
  return (
    <div className="min-h-screen p-6 lg:p-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Đăng nhập</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Đăng nhập để tiếp tục tạo và quản lý nội dung.
        </p>

        <form action={signIn} className="mt-6 space-y-4">
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
            Đăng nhập
          </button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link href="/auth/signup" className="font-semibold text-primary hover:opacity-80">
            Tạo tài khoản
          </Link>
        </p>
      </div>
    </div>
  )
}
