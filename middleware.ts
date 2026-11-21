import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 后台鉴权中间件：
 * - 未登录访问 /dashboard 任意子路由（除 /dashboard/login）→ 跳转登录页
 * - 已登录访问 /dashboard/login → 直接进后台
 * - 未登录访问 /library 及其子路径 → 跳转登录页（带 next 回跳）
 * 同时负责刷新 Supabase 会话 cookie，保证 SSR 拿到最新会话。
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          // RequestCookies.set 仅接受 (name, value)；完整 options 写入响应 cookie
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === "/dashboard/login";
  const isLibrary = pathname === "/library" || pathname.startsWith("/library/");

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    // 资料库是私人内容：跳登录并记住原地址，登录后自动回来
    if (isLibrary) {
      url.pathname = "/dashboard/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
    } else {
      url.pathname = "/dashboard/login";
    }
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/library", "/library/:path*"],
};
