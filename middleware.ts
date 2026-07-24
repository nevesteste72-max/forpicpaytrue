import { rewrite, next } from "@vercel/edge";

// Serve the bovine offer at the ROOT of the saudebovina subdomain.
// Vercel serves the SPA's index.html for "/" before vercel.json rewrites, so a
// plain rewrite can't override it — Edge Middleware runs first and can.
export const config = {
  matcher: "/",
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  if (url.hostname === "saudebovina.tecnhogar.store") {
    return rewrite(new URL("/saudebovina/index.html", request.url));
  }
  return next();
}
