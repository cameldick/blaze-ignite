import { NextResponse } from "next/server";
import { generateAuthUrl } from "@/lib/blaze";
import { setOAuthState } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Kick off the Blaze OAuth flow: get the PKCE auth URL and redirect to it. */
export async function GET() {
  try {
    const { url, state, codeVerifier } = await generateAuthUrl();
    setOAuthState(state, codeVerifier);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("oauth start failed", err);
    return NextResponse.json({ error: "oauth_start_failed" }, { status: 500 });
  }
}
