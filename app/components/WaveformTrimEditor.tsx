/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useRef } from "react";

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
  startTime,
  endTime,
  maxDuration,
  useEndTime,
  onStartChange,
  onEndChange,
  onMaxDurationChange,
  onDurationLoaded,
}: WaveformTrimEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{ destroy: () => void } | null>(null);
  const regionsPluginRef = useRef<{ getRegions: () => Array<{ start: number; end: number; setOptions: (o: { start?: number; end?: number }) => void }> } | null>(null);
  const isInternalUpdateRef = useRef(false);
  const useEndTimeRef = useRef(useEndTime);
  useEndTimeRef.current = useEndTime;

  // Init wavesurfer, load audio, create region, enable drag selection
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    let mounted = true;
    let disableDrag: (() => void) | undefined;

    (async () => {
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

      const dur = ws.getDuration();
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

  return <div ref={containerRef} className="w-full min-h-[90px] rounded-lg overflow-hidden bg-gray-100" />;
}
