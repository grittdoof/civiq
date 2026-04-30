import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// ═══════════════════════════════════════════════════════════════
// Middleware — Garde principale du back-office
//
//   • /admin/**       → user connecté requis ; sinon redirect login
//   • /super-admin/** → user connecté ET role=super_admin ; sinon
//                        redirect login (pas connecté) ou /admin
//                        (connecté mais pas super_admin)
//   • /admin/setup    → exception : on laisse passer pour pouvoir
//                        terminer l'onboarding (commune_id manquant)
//   • /auth/login|register quand déjà connecté → /admin/dashboard
// ═══════════════════════════════════════════════════════════════

const PUBLIC_AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/reset-password"];

export async function middleware(request: NextRequest) {
  // Injecter le pathname dans les headers pour qu'il soit lisible par
  // les Server Components via headers() — sans cela, layouts ne peuvent
  // pas connaître l'URL en cours et risquent les boucles de redirect.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // ── 1. Routes admin : auth requis ──
  if (path.startsWith("/admin") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // ── 2. Routes super-admin : auth + role=super_admin ──
  if (path.startsWith("/super-admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }
    // On lit le rôle depuis profiles (via service role pour bypass RLS)
    const role = await getUserRole(user.id);
    if (role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }
  }

  // ── 3. APIs sensibles : 401 propre (pas de redirect) ──
  if (path.startsWith("/api/super-admin") && !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (path.startsWith("/api/admin") && !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // ── 4. Auth pages : redirect si déjà connecté ──
  if (user && PUBLIC_AUTH_ROUTES.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

// Lit le rôle depuis profiles via fetch direct (le service role n'est
// pas dispo en edge runtime, on passe par REST avec l'anon key + RLS)
async function getUserRole(userId: string): Promise<string | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows: { role: string }[] = await res.json();
    return rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/super-admin/:path*",
    "/auth/login",
    "/auth/register",
    "/auth/reset-password",
    "/api/super-admin/:path*",
    "/api/admin/:path*",
  ],
};
