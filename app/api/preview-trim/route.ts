import { NextRequest, NextResponse } from "next/server";
import { getTrack } from "@/lib/processTracks";
import fs from "fs-extra";
import path from "path";
import { TrimSettings } from "@/types/track";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      trackId,
      trimSettings,
    }: { trackId: string; trimSettings: TrimSettings } = body;

    console.log("Preview trim request:", { trackId, trimSettings });

    if (!trackId) {
      return NextResponse.json(
        { error: "Track ID is required" },
        { status: 400 }
      );
    }

    const track = await getTrack(trackId);
    if (!track) {
      console.log("Track not found for ID:", trackId);
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    console.log("Track found:", track.filename);
    console.log("Original path:", track.originalPath);

    if (!(await fs.pathExists(track.originalPath))) {
      console.log("File does not exist at path:", track.originalPath);

      // Попробуем найти файл в папке downloads
      const downloadsDir = path.join(process.cwd(), "downloads");
      const files = await fs.readdir(downloadsDir);
      console.log("Available files in downloads:", files);

      // Попробуем найти любой MP3 файл
      const mp3Files = files.filter((file) => file.endsWith(".mp3"));
      if (mp3Files.length > 0) {
        const fallbackPath = path.join(downloadsDir, mp3Files[0]);
        console.log("Using fallback file:", fallbackPath);

        // Обновляем путь к файлу в треке
        track.originalPath = fallbackPath;
      } else {
        return NextResponse.json(
          { error: "Audio file not found" },
          { status: 404 }
        );
      }
    }

    console.log("File exists, proceeding with preview creation");

    // Создаем временный файл для предварительного прослушивания
    const tempDir = path.join(process.cwd(), "temp");
    await fs.ensureDir(tempDir);

    // Очищаем старые предварительные файлы (старше 1 часа)
    try {
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      for (const file of files) {
        if (file.startsWith("preview_") && file.endsWith(".mp3")) {
          const filePath = path.join(tempDir, file);
          const stats = await fs.stat(filePath);
          if (now - stats.mtime.getTime() > 3600000) {
            // 1 час
            await fs.remove(filePath);
          }
        }
      }
    } catch (error) {
      console.log("Error cleaning old preview files:", error);
    }

    const previewId = `preview_${Date.now()}`;
    const previewPath = path.join(tempDir, `${previewId}.mp3`);

    console.log("Creating preview file:", previewPath);

    // Применяем настройки обрезки с помощью FFmpeg
    const ffmpeg = require("fluent-ffmpeg");
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg(track.originalPath);

      // Устанавливаем время начала
      command = command.setStartTime(trimSettings.startTime);

      // Устанавливаем длительность
      if (trimSettings.endTime) {
        const duration = trimSettings.endTime - trimSettings.startTime;
        command = command.duration(duration);
      } else if (trimSettings.maxDuration) {
        command = command.duration(trimSettings.maxDuration);
      } else {
        command = command.duration(360); // 6 минут по умолчанию
      }

      // Применяем затухание
      if (trimSettings.fadeIn > 0) {
        command = command.audioFilters(
          `afade=t=in:st=${trimSettings.startTime}:d=${trimSettings.fadeIn}`
        );
      }

      if (trimSettings.fadeOut > 0) {
        const fadeOutStart = trimSettings.endTime
          ? trimSettings.endTime - trimSettings.fadeOut
          : trimSettings.startTime +
            (trimSettings.maxDuration || 360) -
            trimSettings.fadeOut;
        command = command.audioFilters(
          `afade=t=out:st=${fadeOutStart}:d=${trimSettings.fadeOut}`
        );
      }

      command
        .output(previewPath)
        .on("end", () => {
          console.log("Preview file created successfully");
          resolve();
        })
        .on("error", (error: any) => {
          console.error("FFmpeg preview error:", error);
          reject(error);
        })
        .run();
    });

    // Возвращаем информацию о предварительном файле
    return NextResponse.json({
      success: true,
      previewId,
      message: "Preview file created successfully",
    });
  } catch (error) {
    console.error("Preview trim error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Preview failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
