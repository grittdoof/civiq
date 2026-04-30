import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// ═══════════════════════════════════════════════════════════════
// Middleware
//
// 1. Crée le client Supabase, refresh les cookies de session
//    (pattern officiel @supabase/ssr — ne PAS modifier la
//     mécanique cookies sans risque de "Invalid Refresh Token")
// 2. Injecte x-pathname dans les headers pour les Server Components
// 3. Garde-fous redirects : /admin/**, /super-admin/**, /api/super-admin/**
//
// Ordre crucial : on instancie d'abord supabase + on appelle
// getUser() (qui peut fire le setAll de cookies) AVANT toute autre
// modification du response.
// ═══════════════════════════════════════════════════════════════

const PUBLIC_AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/reset-password"];

export async function middleware(request: NextRequest) {
  // Headers de requête forwardés aux Server Components — on injecte
  // x-pathname pour que les layouts puissent connaître l'URL en cours
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
          // 1. Mettre à jour les cookies sur la requête (lus par getAll suivants)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // 2. Recréer la response en conservant nos custom headers (x-pathname)
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          // 3. Écrire les cookies sur la response → renvoyés au navigateur
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT : getUser() peut déclencher un refresh + setAll
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Refresh token invalide → on traite comme non connecté (le client
    // se reconnectera ou le user sera redirigé vers /auth/login)
    user = null;
  }

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

// Lit le rôle depuis profiles via fetch REST (service role)
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
