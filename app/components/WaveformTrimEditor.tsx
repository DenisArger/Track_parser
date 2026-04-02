/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";

export interface WaveformTrimEditorProps {
  audioUrl: string;
  durationFallback?: number;
  startTime: number;
  endTime: number | undefined;
  maxDuration: number;
  useEndTime: boolean;
  onStartChange: (s: number) => void;
  onEndChange: (e: number) => void;
  onMaxDurationChange: (d: number) => void;
  onDurationLoaded?: (d: number) => void;
}

const THRESH = 1e-3;

export default function WaveformTrimEditor({
  audioUrl,
  durationFallback,
  startTime,
  endTime,
  maxDuration,
  useEndTime,
  onStartChange,
  onEndChange,
  onMaxDurationChange,
  onDurationLoaded,
}: WaveformTrimEditorProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{ destroy: () => void } | null>(null);
  const regionsPluginRef = useRef<{ getRegions: () => Array<{ start: number; end: number; setOptions: (o: { start?: number; end?: number }) => void }> } | null>(null);
  const isInternalUpdateRef = useRef(false);
  const useEndTimeRef = useRef(useEndTime);
  const [isWaveformLoading, setIsWaveformLoading] = useState(true);
  const [waveformError, setWaveformError] = useState<string | null>(null);
  useEndTimeRef.current = useEndTime;

  // Init wavesurfer, load audio, create region, enable drag selection
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    let mounted = true;
    let disableDrag: (() => void) | undefined;
    setIsWaveformLoading(true);
    setWaveformError(null);

    (async () => {
      try {
        const [WaveSurferMod, RegionsMod] = await Promise.all([
          import("wavesurfer.js"),
          import("wavesurfer.js/dist/plugins/regions.esm.js"),
        ]);
        const WaveSurfer = WaveSurferMod.default;
        const RegionsPlugin = RegionsMod.default;

        if (!mounted || !el) return;

        const ws = WaveSurfer.create({
          container: el,
          height: 90,
          waveColor: "#94a3b8",
          progressColor: "#3b82f6",
          cursorColor: "#334155",
          barWidth: 1,
          barGap: 1,
          barRadius: 0,
          normalize: true,
        });
        wsRef.current = ws;

        const regionsPlugin = RegionsPlugin.create();
        ws.registerPlugin(regionsPlugin);
        regionsPluginRef.current = regionsPlugin;

        await ws.load(audioUrl);
        if (!mounted) return;
        setIsWaveformLoading(false);

        const loadedDuration = ws.getDuration();
        const dur =
          loadedDuration > 0
            ? loadedDuration
            : durationFallback != null && durationFallback > 0
              ? durationFallback
              : 0;
        if (dur > 0 && onDurationLoaded) onDurationLoaded(dur);

        const start = Math.max(0, Math.min(startTime, dur - 0.01));
        const endVal = useEndTime
          ? Math.min(endTime ?? start + maxDuration, dur)
          : Math.min(start + maxDuration, dur);
        const end = Math.max(start + 0.01, endVal);

        regionsPlugin.clearRegions();
        regionsPlugin.addRegion({
          start,
          end,
          drag: true,
          resize: true,
          color: "rgba(59, 130, 246, 0.35)",
        });

        disableDrag = regionsPlugin.enableDragSelection({
          color: "rgba(59, 130, 246, 0.35)",
          drag: true,
          resize: true,
        });

        regionsPlugin.on("region-created", (region) => {
          if (!mounted) return;
          const s = Math.max(0, region.start);
          const e = Math.min(dur, Math.max(s + 0.01, region.end));
          regionsPlugin.clearRegions();
          isInternalUpdateRef.current = true;
          regionsPlugin.addRegion({
            start: s,
            end: e,
            drag: true,
            resize: true,
            color: "rgba(59, 130, 246, 0.35)",
          });
          onStartChange(s);
          if (useEndTimeRef.current) {
            onEndChange(e);
          } else {
            onMaxDurationChange(e - s);
          }
          isInternalUpdateRef.current = false;
        });

        regionsPlugin.on("region-updated", (region) => {
          if (!mounted || isInternalUpdateRef.current) return;
          const s = Math.max(0, region.start);
          const e = Math.min(dur, Math.max(s + 0.01, region.end));
          onStartChange(s);
          if (useEndTimeRef.current) {
            onEndChange(e);
          } else {
            onMaxDurationChange(e - s);
          }
        });
      } catch (error) {
        console.error("Waveform init failed:", error);
        if (!mounted) return;
        setWaveformError(t("trimmer.waveformLoadError"));
        setIsWaveformLoading(false);
      }
    })();

    return () => {
      mounted = false;
      disableDrag?.();
      if (wsRef.current) {
        wsRef.current.destroy();
        wsRef.current = null;
      }
      regionsPluginRef.current = null;
    };
  }, [audioUrl]);

  // Sync from parent (MM:SS.ms inputs) into the region
  useEffect(() => {
    const rp = regionsPluginRef.current;
    const region = rp?.getRegions?.()?.[0];
    if (!region) return;

    const desiredEnd = useEndTime && endTime != null ? endTime : startTime + maxDuration;
    const desiredStart = startTime;

    if (Math.abs(region.start - desiredStart) < THRESH && Math.abs(region.end - desiredEnd) < THRESH) {
      return;
    }
    isInternalUpdateRef.current = true;
    region.setOptions({ start: desiredStart, end: desiredEnd });
    isInternalUpdateRef.current = false;
  }, [startTime, endTime, maxDuration, useEndTime]);

  return (
    <div className="relative w-full min-h-[90px] rounded-lg overflow-hidden bg-gray-100">
      <div ref={containerRef} className="w-full min-h-[90px]" />
      {isWaveformLoading && (
        <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm text-gray-500 dark:text-gray-300">
          {t("trimmer.waveformLoading")}
        </div>
      )}
      {waveformError && (
        <div className="absolute inset-0 bg-gray-100/95 dark:bg-gray-800/95 flex items-center justify-center text-sm text-amber-700 dark:text-amber-300 text-center px-4">
          {waveformError}
        </div>
      )}
    </div>
  );
}
