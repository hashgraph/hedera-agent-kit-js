import { NextRequest, NextResponse } from 'next/server';
import { create402ChallengeResponse } from '@/lib/x402-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action') || 'submit_topic_message';

  const { body, status, headers } = create402ChallengeResponse(action);
  return NextResponse.json(body, { status, headers });
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const action = data.action || 'submit_topic_message';
    const { body, status, headers } = create402ChallengeResponse(action);
    return NextResponse.json(body, { status, headers });
  } catch {
    const { body, status, headers } = create402ChallengeResponse('submit_topic_message');
    return NextResponse.json(body, { status, headers });
  }
}
