import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/workspace/:path*", "/guest/:path*", "/history/:path*", "/favorites/:path*", "/profile/:path*"],
};
