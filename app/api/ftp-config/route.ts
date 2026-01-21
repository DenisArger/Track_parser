import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { loadConfig } = await import("@/lib/config");
    const config = await loadConfig();
    return NextResponse.json({
      host: config.ftp.host,
      port: config.ftp.port,
      user: config.ftp.user,
      password: config.ftp.password,
      secure: config.ftp.secure,
      remotePath: config.ftp.remotePath || "",
    });
  } catch (error) {
    console.error("Error loading FTP config:", error);
    return NextResponse.json(
      {
        error: "Failed to load FTP configuration",
      },
      { status: 500 }
    );
  }
}


