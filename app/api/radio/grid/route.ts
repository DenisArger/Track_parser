import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { createGridEvent, fetchGridEvents } from "@/lib/radio/streamingCenterGridClient";

function getGridEnv() {
  const apiUrl = process.env.STREAMING_CENTER_API_URL || "";
  const apiKey = process.env.STREAMING_CENTER_API_KEY || "";
  const authToken = process.env.STREAMING_CENTER_AUTH_TOKEN || "";
  if (!apiUrl || !apiKey) {
    throw new Error("STREAMING_CENTER_API_URL и STREAMING_CENTER_API_KEY должны быть заданы");
  }
  return { apiUrl, apiKey, authToken };
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

    const { apiUrl, apiKey, authToken } = getGridEnv();
    const events = await fetchGridEvents(apiUrl, apiKey, { server, startTs, endTs, utc }, authToken);
    return NextResponse.json({ results: events });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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
    const { apiUrl, apiKey, authToken } = getGridEnv();
    const event = await createGridEvent(apiUrl, apiKey, body, authToken);
    return NextResponse.json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
