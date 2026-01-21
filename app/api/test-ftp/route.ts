import { NextRequest, NextResponse } from "next/server";
import { testFtpConnectionAction } from "@/lib/actions/trackActions";
import { FtpConfig } from "@/types/track";
import { getAuthUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ftpConfig = (await request.json()) as FtpConfig;

    if (!ftpConfig.host || !ftpConfig.user) {
      return NextResponse.json(
        { error: "Host and username are required" },
        { status: 400 }
      );
    }

    await testFtpConnectionAction(ftpConfig);

    return NextResponse.json({ success: true, message: "Connection successful" });
  } catch (error) {
    console.error("FTP test connection error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to test FTP connection",
      },
      { status: 500 }
    );
  }
}


