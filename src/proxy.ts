import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /welcome must stay public: invitees arrive without a session and establish
// one client-side from the invite link's tokens.
//
// The metadata routes must stay public too. Next generates them from the
// file conventions in src/app (opengraph-image.tsx and friends) at extensionless
// paths, so the matcher below does not exclude them the way it excludes
// _next/static and *.svg. Without these entries a social crawler fetching the
// preview image gets a 307 to /login and the link previews blank — which is
// the exact failure the OG image exists to prevent.
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/welcome",
  "/opengraph-image",
  "/twitter-image",
  "/icon",
  "/apple-icon",
  "/robots.txt",
  "/sitemap.xml",
];

// "/" is the public marketing landing page. It is matched exactly rather than
// added to PUBLIC_PATHS above, since startsWith("/") would make every route
// public. Signed-in visitors still see the landing page; its "Log in" link
// bounces them to /dashboard via the rule below.
const PUBLIC_EXACT_PATHS = ["/"];

export async function proxy(request: NextRequest) {
  // Not configured yet (fresh clone / preview without env) — let pages render.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  const isPublic =
    PUBLIC_EXACT_PATHS.includes(request.nextUrl.pathname) ||
    PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)"],
};
