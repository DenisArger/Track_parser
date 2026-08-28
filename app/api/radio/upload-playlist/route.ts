import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import {
  uploadPlaylistToStreamingCenter,
  StreamingCenterTrack,
} from "@/lib/radio/uploadPlaylistToStreamingCenter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdminUser(createSupabaseServerClient(), user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      name?: string;
      serverId?: number;
      isRandom?: boolean;
      basePath?: string;
      useWindows1251?: boolean;
      tracks?: StreamingCenterTrack[];
    };

    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Название плейлиста обязательно" },
        { status: 400 }
      );
    }

    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "Нет треков для загрузки" },
        { status: 400 }
      );
    }

    const result = await uploadPlaylistToStreamingCenter({
      name,
      serverId: body.serverId,
      isRandom: body.isRandom,
      basePath: body.basePath,
      useWindows1251: body.useWindows1251,
      tracks,
    });
    return NextResponse.json(result.json, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
