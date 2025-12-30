import { NextResponse } from "next/server";
// Dynamic import to avoid issues during static generation
// import { loadConfig } from "@/lib/config";

export async function GET() {
  try {
    // Dynamic import to avoid issues during static generation
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


