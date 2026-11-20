import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  /**
   * Khi vào trang web lần đầu, browser chưa có session đăng nhập.
   * => Middleware nhầm request WebSocket dev /_next/webpack-hmr là trang private
   * trả về mã 307 Redirect sang /auth. Kết nối WebSocket không thể bắt tay 
   * (handshake) qua 307 Redirect nên đứt ngay lập tức, sinh ra 1 lỗi đỏ (x) 1 trên Console.
   * Phía client Next.js thấy mất kết nối HMR liền thử reconnect liên tục, 
   * mỗi lần reconnect lại kích hoạt [Fast Refresh] done in 122ms, tạo thành vòng lặp vô tận.
   */
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next (static files, image optimization, HMR websocket/chunks)
     * - favicon.ico (favicon file)
     *
     * `woff2`/`woff` are here because `updateSession` sends every anonymous
     * visitor to /auth — a redirect the browser follows while loading a font,
     * so the request comes back as HTML, the font is rejected, and every
     * Vietnamese glyph silently falls back to a system font. The list also
     * loses half its value the moment it is copied: any asset type added
     * later (a font, a manifest, a .txt) is swallowed by default. Prefer
     * excluding by directory — `static|fonts|assets` — over growing this list.
     */
    '/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2|woff)$).*)',
  ],
}