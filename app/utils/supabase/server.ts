import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/**
 * Extracts the raw token from an `Authorization: Bearer <token>` header, if present.
 * Used by non-browser clients (e.g. the mobile app) that can't rely on cookies.
 */
export function getBearerToken(req: NextRequest): string | undefined {
  const header = req.headers.get("authorization");
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || undefined;
}

/**
 * Returns a Supabase server client.
 *
 * - Web (no `req`, or no `Authorization: Bearer` header): unchanged cookie-based
 *   session client via `@supabase/ssr`.
 * - Mobile (`Authorization: Bearer <token>` header present): a token-scoped client
 *   whose REST/Storage/RPC requests carry that token, so RLS (`auth.uid()`) resolves
 *   correctly. Callers must still validate the token via `supabase.auth.getUser(token)`.
 */
export async function createClient(req?: NextRequest) {
  const bearerToken = req ? getBearerToken(req) : undefined;

  if (bearerToken) {
    return createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
      },
    }
  );
}