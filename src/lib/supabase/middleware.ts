import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });
  if (!hasSupabase) {
    return supabaseResponse;
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return supabaseResponse;
}
