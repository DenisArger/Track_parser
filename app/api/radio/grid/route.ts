import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { createGridEvent, fetchGridEvents } from "@/lib/radio/streamingCenterGridClient";

function getGridEnv() {
  const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
  const apiKey = process.env.STREAMING_CENTER_API_KEY || "";
  if (!apiUrl || !apiKey) {
    throw new Error("STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы");
  }
  return { apiUrl, apiKey };
}

function maskKey(key: string): string {
  if (!key) return "<empty>";
  if (key.length <= 4) return "***";
  return `${key.slice(0, 2)}***${key.slice(-2)}`;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(createSupabaseServerClient(), user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const server = Number.parseInt(searchParams.get("server") || "0", 10);
    const startTs = Number.parseInt(searchParams.get("start_ts") || "0", 10);
    const endTs = Number.parseInt(searchParams.get("end_ts") || "0", 10);
    const utc = searchParams.get("utc") === "0" ? 0 : 1;
    if (!server || !startTs || !endTs) {
      return NextResponse.json(
        { error: "server, start_ts and end_ts are required" },
        { status: 400 }
      );
    }

    const { apiUrl, apiKey } = getGridEnv();
    console.info("[radio grid] GET", {
      server,
      startTs,
      endTs,
      utc,
      apiUrl,
      apiKeyPresent: Boolean(apiKey),
      apiKeyHint: maskKey(apiKey),
    });
    const events = await fetchGridEvents(apiUrl, apiKey, { server, startTs, endTs, utc });
    console.info("[radio grid] GET ok", { count: events.length });
    return NextResponse.json({ results: events });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[radio grid] GET failed", { message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(createSupabaseServerClient(), user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { apiUrl, apiKey } = getGridEnv();
    const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    console.info("[radio grid] POST", {
      apiUrl,
      apiKeyPresent: Boolean(apiKey),
      apiKeyHint: maskKey(apiKey),
      bodyKeys: bodyObj ? Object.keys(bodyObj) : [],
      summary: bodyObj
        ? {
            server: bodyObj.server ?? null,
            name: bodyObj.name ?? null,
            periodicity: bodyObj.periodicity ?? null,
            cast_type: bodyObj.cast_type ?? null,
            start_date: bodyObj.start_date ?? null,
            start_time: bodyObj.start_time ?? null,
            finish_date: bodyObj.finish_date ?? null,
            finish_time: bodyObj.finish_time ?? null,
            playlist: bodyObj.playlist ?? null,
            playlist_after_radioshow: bodyObj.playlist_after_radioshow ?? null,
            rotation_after_radioshow: bodyObj.rotation_after_radioshow ?? null,
            dj: bodyObj.dj ?? null,
            rotation: bodyObj.rotation ?? null,
            timezone: bodyObj.timezone ?? null,
            color: bodyObj.color ?? null,
            color2: bodyObj.color2 ?? null,
            break_track: bodyObj.break_track ?? null,
            start_playlist_from_beginning: bodyObj.start_playlist_from_beginning ?? null,
          }
        : null,
    });
    const event = await createGridEvent(apiUrl, apiKey, body as Parameters<typeof createGridEvent>[2]);
    console.info("[radio grid] POST ok", {
      id: event.id ?? null,
      name: event.name ?? null,
      cast_type: event.cast_type ?? null,
      periodicity: event.periodicity ?? null,
    });
    return NextResponse.json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[radio grid] POST failed", { message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
