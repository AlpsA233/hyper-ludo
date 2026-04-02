import { NextResponse } from "next/server";
import Ably from "ably";

const ABLY_API_KEY = process.env.ABLY_API_KEY!;

export async function GET(request: Request) {
  if (!ABLY_API_KEY) {
    return NextResponse.json(
      { error: "ABLY_API_KEY not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || "anonymous";

  const ably = new Ably.Rest({ key: ABLY_API_KEY });
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId,
    capability: { "game:*": ["subscribe", "publish", "presence"] },
  });

  return NextResponse.json(tokenRequest);
}
