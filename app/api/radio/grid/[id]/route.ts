import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { deleteGridEvent, updateGridEvent } from "@/lib/radio/streamingCenterGridClient";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(createSupabaseServerClient(), user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const eventId = Number.parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    const body = await request.json();
    const { apiUrl, apiKey } = getGridEnv();
    console.info("[radio grid] PUT", {
      eventId,
      apiUrl,
      apiKeyPresent: Boolean(apiKey),
      apiKeyHint: maskKey(apiKey),
      bodyKeys: body && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : [],
    });
    const event = await updateGridEvent(apiUrl, apiKey, eventId, body);
    console.info("[radio grid] PUT ok", {
      eventId,
      id: event.id ?? null,
      name: event.name ?? null,
      cast_type: event.cast_type ?? null,
      periodicity: event.periodicity ?? null,
    });
    return NextResponse.json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[radio grid] PUT failed", { message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(createSupabaseServerClient(), user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const eventId = Number.parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    const { apiUrl, apiKey } = getGridEnv();
    console.info("[radio grid] DELETE", {
      eventId,
      apiUrl,
      apiKeyPresent: Boolean(apiKey),
      apiKeyHint: maskKey(apiKey),
    });
    await deleteGridEvent(apiUrl, apiKey, eventId);
    console.info("[radio grid] DELETE ok", { eventId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[radio grid] DELETE failed", { message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
