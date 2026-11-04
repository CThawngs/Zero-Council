import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const language = body.language;

    if (language !== 'vi' && language !== 'en') {
      return NextResponse.json(
        { error: 'Invalid language' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set('zc-lang', language, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}