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
    const event = await updateGridEvent(apiUrl, apiKey, eventId, body);
    return NextResponse.json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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
    await deleteGridEvent(apiUrl, apiKey, eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
