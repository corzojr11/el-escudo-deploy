import { createServerSupabaseClient } from '@/lib/auth/server';
import { postToBackend } from '@/lib/api/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session?.access_token) {
      return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 });
    }

    const body = await request.json();
    const { token, platform } = body as { token?: string; platform?: string };

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token Expo Push requerido' }, { status: 400 });
    }

    const validTokenPrefixes = ['ExponentPushToken[', 'ExpoPushToken['];
    const isValidToken = validTokenPrefixes.some(prefix => token.startsWith(prefix));
    if (!isValidToken) {
      return NextResponse.json({ error: 'Formato de token inválido' }, { status: 400 });
    }

    const validPlatforms = ['android', 'ios'];
    const platformValue = validPlatforms.includes(platform ?? '') ? platform : 'android';

    await postToBackend('/push-tokens', {
      token,
      platform: platformValue,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = message.includes('No hay sesión') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}