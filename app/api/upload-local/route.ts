import { NextResponse } from "next/server";
import { uploadLocalTrackAction } from "@/lib/actions/trackActions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let buffer: Buffer | null = null;
    let originalName = "upload.mp3";
    let mimeType = "audio/mpeg";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || typeof (file as File).arrayBuffer !== "function") {
        return NextResponse.json({ error: "File is required" }, { status: 400 });
      }

      const uploadedFile = file as File;
      originalName = uploadedFile.name || originalName;
      mimeType = uploadedFile.type || mimeType;
      buffer = Buffer.from(await uploadedFile.arrayBuffer());
    } else {
      const headerNameEncoded = request.headers.get("x-file-name-encoded");
      const headerType = request.headers.get("x-file-type");
      if (headerNameEncoded) {
        try {
          originalName = decodeURIComponent(headerNameEncoded);
        } catch {
          originalName = headerNameEncoded;
        }
      }
      mimeType = headerType || contentType || mimeType;
      buffer = Buffer.from(await request.arrayBuffer());
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const lowerName = originalName.toLowerCase();
    const isMp3Name = lowerName.endsWith(".mp3");
    const isMp3Type = mimeType.includes("audio/mpeg") || mimeType.includes("audio/mp3");

    if (!isMp3Name && !isMp3Type) {
      return NextResponse.json(
        { error: "Only MP3 files are supported" },
        { status: 400 }
      );
    }

    const track = await uploadLocalTrackAction(
      buffer,
      originalName,
      mimeType
    );

    return NextResponse.json({ ok: true, track });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Local upload error:", message);
    return NextResponse.json(
      { error: `Local upload failed: ${message}` },
      { status: 500 }
    );
  }
}
