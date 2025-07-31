import { NextRequest, NextResponse } from "next/server";
import { Client as FtpClient } from "basic-ftp";
import { FtpConfig } from "@/types/track";

export async function POST(request: NextRequest) {
  try {
    const ftpConfig: FtpConfig = await request.json();

    if (!ftpConfig.host || !ftpConfig.user) {
      return NextResponse.json(
        { error: "Host and username are required" },
        { status: 400 }
      );
    }

    const client = new FtpClient();

    try {
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.user,
        password: ftpConfig.password,
        secure: ftpConfig.secure,
      });

      return NextResponse.json({
        success: true,
        message: "FTP connection successful",
      });
    } finally {
      client.close();
    }
  } catch (error) {
    console.error("FTP test error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "FTP connection failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
