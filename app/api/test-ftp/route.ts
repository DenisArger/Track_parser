import { NextRequest } from "next/server";
import { Client as FtpClient } from "basic-ftp";
import { FtpConfig } from "@/types/track";
import { handleApiError, handleValidationError } from "@/lib/api/errorHandler";
import { createSuccessResponse } from "@/lib/api/responseHelpers";

export async function POST(request: NextRequest) {
  try {
    const ftpConfig: FtpConfig = await request.json();

    if (!ftpConfig.host || !ftpConfig.user) {
      return handleValidationError("Host and username are required");
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

      return createSuccessResponse(undefined, "FTP connection successful");
    } finally {
      client.close();
    }
  } catch (error) {
    return handleApiError(error, "FTP connection failed");
  }
}
