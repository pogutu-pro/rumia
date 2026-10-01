import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { notificationsApi } from "@/lib/api/notifications";

/** Thin same-origin proxy to FastAPI (auth + persistence live there). */
export async function POST(request: NextRequest) {
  try {
    const { endpoint, p256dh, auth } = await request.json();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Missing endpoint, p256dh, or auth" },
        { status: 400 }
      );
    }

    await notificationsApi.subscribePushServer({ endpoint, p256dh, auth });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Push subscribe error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
