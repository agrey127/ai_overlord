import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing.");

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // The existing magic-link redirect points here. Exchange its PKCE code
  // before checking the session, then remove the one-time code from the URL.
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname === "/baseline/assistant") {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    const destination = request.nextUrl.clone();
    destination.searchParams.delete("code");
    if (error) {
      destination.pathname = "/login";
      destination.searchParams.set("error", "link");
    }
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = { matcher: ["/baseline/:path*"] };
