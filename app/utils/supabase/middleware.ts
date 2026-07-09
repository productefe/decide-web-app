import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAnonymousUser, isPermanentUser } from "@/lib/auth-user";

const SHELL_ROUTES = ["/workspace", "/history", "/favorites", "/profile"];

export async function updateSession(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  const isHome = pathname === "/";
  const isShell = SHELL_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const isGuestRoute = pathname === "/guest" || pathname.startsWith("/guest/");

  if (isHome && isPermanentUser(user)) {
    const url = req.nextUrl.clone();
    url.pathname = "/workspace";
    return NextResponse.redirect(url);
  }

  if (isShell) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (isAnonymousUser(user)) {
      const url = req.nextUrl.clone();
      url.pathname = "/guest";
      return NextResponse.redirect(url);
    }
  }

  if (isGuestRoute && user && !isAnonymousUser(user)) {
    const url = req.nextUrl.clone();
    url.pathname = "/workspace";
    return NextResponse.redirect(url);
  }

  return res;
}
