import { NextRequest, NextResponse } from "next/server";
import { cleanupTrackStatuses, getTrackStats } from "@/lib/trackUtils";

export async function POST(request: NextRequest) {
  try {
    console.log("Starting track cleanup...");
    
    // Получаем статистику до очистки
    const statsBefore = await getTrackStats();
    console.log("Stats before cleanup:", statsBefore);
    
    // Выполняем очистку
    await cleanupTrackStatuses();
    
    // Получаем статистику после очистки
    const statsAfter = await getTrackStats();
    console.log("Stats after cleanup:", statsAfter);
    
    return NextResponse.json({
      success: true,
      message: "Track statuses cleaned up successfully",
      statsBefore,
      statsAfter
    });
  } catch (error) {
    console.error("Track cleanup error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cleanup failed",
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats = await getTrackStats();
    
    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("Get stats error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get stats",
        success: false,
      },
      { status: 500 }
    );
  }
} 
