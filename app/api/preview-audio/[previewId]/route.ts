import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ previewId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
