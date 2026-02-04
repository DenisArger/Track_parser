import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "den.arger@gmail.com";
const DEFAULT_TEMPLATE_NAME = "default";

function getTemplateNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const v = (u.searchParams.get("name") || "").trim();
    return v || DEFAULT_TEMPLATE_NAME;
  } catch {
    return DEFAULT_TEMPLATE_NAME;
  }
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseServerClient();
    const templateName = getTemplateNameFromUrl(req.url);
    const { data, error } = await supabase
      .from("playlist_rotation_templates")
      .select("template, settings")
      .eq("name", templateName)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({
      name: templateName,
      template: data?.template ?? [],
      settings: data?.settings ?? null,
    });
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
    const templateName =
      typeof body?.name === "string" && body.name.trim()
        ? body.name.trim()
        : DEFAULT_TEMPLATE_NAME;
    const template = Array.isArray(body?.template) ? body.template : [];
    const settings =
      body?.settings && typeof body.settings === "object" ? body.settings : null;

    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("playlist_rotation_templates")
      .upsert(
        {
          name: templateName,
          template,
          settings,
        },
        { onConflict: "name" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
