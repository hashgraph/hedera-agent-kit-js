import { NextRequest, NextResponse } from 'next/server';
import { createPaymentRequirements, verifyPaymentPayload } from '@/lib/x402-server';
import { executeAgentToolAfterSettlement } from '@/lib/agent-kit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'submit_topic_message';
    const paymentPayload = body.paymentPayload || req.headers.get('x-payment');

    if (!paymentPayload) {
      return NextResponse.json(
        {
          success: false,
          error: 'No x402 payment payload provided in request body or X-Payment header',
        },
        { status: 400 },
      );
    }

    const requirements = createPaymentRequirements(action);
    const verification = await verifyPaymentPayload(paymentPayload, requirements);

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || 'The provided x402 payment could not be verified.',
        },
        { status: 402 },
      );
    }

    // Payment verified! Settle and execute Hedera Agent Kit tool
    const userAccountId = body.userAccountId || verification.payer || '0.0.1001';
    const paymentTxId =
      verification.transactionId || `0.0.5001@${Math.floor(Date.now() / 1000)}.000000000`;

    const toolResult = await executeAgentToolAfterSettlement(paymentTxId, {
      action,
      topicId: body.topicId,
      message: body.message,
      tokenId: body.tokenId,
      amount: body.amount,
      userAccountId,
    });

    const resHeaders = new Headers();
    resHeaders.set(
      'x402-payment-response',
      Buffer.from(
        JSON.stringify({
          success: true,
          transaction: paymentTxId,
          network: requirements.network,
          payer: verification.payer,
        }),
      ).toString('base64'),
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Payment verified and settled. Tool executed successfully.',
        payment: {
          transactionId: paymentTxId,
          payer: verification.payer,
          amount: verification.amount,
          asset: requirements.asset,
        },
        toolExecution: toolResult,
      },
      { headers: resHeaders },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
