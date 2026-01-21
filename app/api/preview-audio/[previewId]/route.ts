import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ previewId: string }> }
) {
  try {
    const { previewId } = await params;

    const {
      downloadFileFromStorage,
      STORAGE_BUCKETS,
    } = await import("@/lib/storage/supabaseStorage");

    const fileBuffer = await downloadFileFromStorage(STORAGE_BUCKETS.previews, `${previewId}.mp3`);
    const fileName = `${previewId}.mp3`;
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Preview audio serve error:", error);
    return NextResponse.json(
      { error: "Preview file not found" },
      { status: 404 }
    );
  }
}
