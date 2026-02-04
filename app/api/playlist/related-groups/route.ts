import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "den.arger@gmail.com";

type RelatedGroupInput = {
  id?: string;
  name?: string;
  members?: string[];
};

function cleanGroups(input: unknown): RelatedGroupInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((g) => {
      const obj = g as RelatedGroupInput;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      const members = Array.isArray(obj.members)
        ? obj.members
            .map((m) => (typeof m === "string" ? m.trim() : ""))
            .filter(Boolean)
        : [];
      return {
        id: typeof obj.id === "string" ? obj.id : undefined,
        name,
        members,
      };
    })
    .filter((g) => g.name || g.members.length > 0);
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("playlist_related_groups")
      .select("id, name, members")
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ groups: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const groups = cleanGroups(body?.groups);

    const supabase = createSupabaseServerClient();
    const { error: delError } = await supabase
      .from("playlist_related_groups")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 502 });
    }

    if (groups.length > 0) {
      const { error: insError } = await supabase
        .from("playlist_related_groups")
        .insert(groups);
      if (insError) {
        return NextResponse.json({ error: insError.message }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true, count: groups.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
