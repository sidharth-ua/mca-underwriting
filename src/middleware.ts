import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Redirect root to deals page
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/deals', request.url))
  }

  // Redirect login page to deals (no auth needed)
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/deals', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login'],
}
