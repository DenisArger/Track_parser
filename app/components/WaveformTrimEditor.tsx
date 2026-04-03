/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { formatTimeMs } from "@/lib/utils/timeFormatter";

export interface WaveformTrimEditorProps {
  audioUrl: string;
  durationFallback?: number;
  startTime: number;
  endTime: number | undefined;
  maxDuration: number;
  useEndTime: boolean;
  fadeIn?: number;
  fadeOut?: number;
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
  fadeIn = 0,
  fadeOut = 0,
  onStartChange,
  onEndChange,
  onMaxDurationChange,
  onDurationLoaded,
}: WaveformTrimEditorProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{ destroy: () => void } | null>(null);
  const regionsPluginRef = useRef<{
    getRegions: () => Array<{
      start: number;
      end: number;
      setOptions: (o: { start?: number; end?: number }) => void;
    }>;
  } | null>(null);
  const isInternalUpdateRef = useRef(false);
  const useEndTimeRef = useRef(useEndTime);
  const [isWaveformLoading, setIsWaveformLoading] = useState(true);
  const [waveformError, setWaveformError] = useState<string | null>(null);
  const [loadedDuration, setLoadedDuration] = useState(durationFallback ?? 0);
  useEndTimeRef.current = useEndTime;

  const effectiveEnd = useEndTime && endTime != null ? endTime : startTime + maxDuration;
  const effectiveDuration = Math.max(0.01, effectiveEnd - startTime);
  const waveformDuration = loadedDuration > 0 ? loadedDuration : Math.max(effectiveEnd, durationFallback ?? 0, 0.01);
  const selectionLeft = `${(Math.max(0, startTime) / waveformDuration) * 100}%`;
  const selectionWidth = `${(effectiveDuration / waveformDuration) * 100}%`;
  const fadeInWidth = `${Math.min(100, (Math.max(0, fadeIn) / effectiveDuration) * 100)}%`;
  const fadeOutWidth = `${Math.min(100, (Math.max(0, fadeOut) / effectiveDuration) * 100)}%`;

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
          height: 170,
          waveColor: "#1C5876",
          progressColor: "#1C5876",
          cursorColor: "#22d3ee",
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
        });
        wsRef.current = ws;

        const regionsPlugin = RegionsPlugin.create();
        ws.registerPlugin(regionsPlugin);
        regionsPluginRef.current = regionsPlugin;

        await ws.load(audioUrl);
        if (!mounted) return;
        setIsWaveformLoading(false);

        const wsDuration = ws.getDuration();
        const dur =
          wsDuration > 0
            ? wsDuration
            : durationFallback != null && durationFallback > 0
              ? durationFallback
              : 0;
        setLoadedDuration(dur);
        if (dur > 0 && onDurationLoaded) onDurationLoaded(dur);

        const start = Math.max(0, Math.min(startTime, dur - 0.01));
        const endValue = useEndTime
          ? Math.min(endTime ?? start + maxDuration, dur)
          : Math.min(start + maxDuration, dur);
        const end = Math.max(start + 0.01, endValue);

        regionsPlugin.clearRegions();
        regionsPlugin.addRegion({
          start,
          end,
          drag: true,
          resize: true,
          color: "rgba(13, 250, 184, 0.26)",
        });

        disableDrag = regionsPlugin.enableDragSelection({
          color: "rgba(13, 250, 184, 0.26)",
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
            color: "rgba(13, 250, 184, 0.26)",
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

  useEffect(() => {
    const rp = regionsPluginRef.current;
    const region = rp?.getRegions?.()?.[0];
    if (!region) return;

    const desiredEnd = useEndTime && endTime != null ? endTime : startTime + maxDuration;
    const desiredStart = startTime;

    if (
      Math.abs(region.start - desiredStart) < THRESH &&
      Math.abs(region.end - desiredEnd) < THRESH
    ) {
      return;
    }

    isInternalUpdateRef.current = true;
    region.setOptions({ start: desiredStart, end: desiredEnd });
    isInternalUpdateRef.current = false;
  }, [endTime, maxDuration, startTime, useEndTime]);

  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-cyan-300/10 bg-[#163865] px-4 py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-white/10 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-white/10 to-transparent" />
      <div ref={containerRef} className="w-full min-h-[170px]" />
      <div
        className="pointer-events-none absolute bottom-6 top-6 overflow-hidden rounded-[18px]"
        style={{ left: selectionLeft, width: selectionWidth }}
      >
        {fadeIn > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#163865] via-[#163865]/65 to-transparent"
            style={{ width: fadeInWidth }}
          />
        )}
        {fadeOut > 0 && (
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#163865] via-[#163865]/65 to-transparent"
            style={{ width: fadeOutWidth }}
          />
        )}
      </div>

      <div className="pointer-events-none absolute left-4 right-4 top-4 flex justify-between text-[11px] font-medium text-cyan-100/65">
        <span>{formatTimeMs(startTime)}</span>
        <span>
          {loadedDuration > 0 ? formatTimeMs(loadedDuration) : formatTimeMs(effectiveEnd)}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center text-sm font-medium text-cyan-200/75">
        {formatTimeMs(Math.max(0, effectiveEnd - startTime))}
      </div>

      <div className="pointer-events-none absolute bottom-0 left-4 right-4 flex justify-between text-sm font-medium text-cyan-300">
        <span>{formatTimeMs(startTime)}</span>
        <span>{formatTimeMs(effectiveEnd)}</span>
      </div>

      {isWaveformLoading && (
        <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-[#163865] text-sm text-cyan-100/70">
          {t("trimmer.waveformLoading")}
        </div>
      )}

      {waveformError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#163865]/95 px-4 text-center text-sm text-amber-300">
          {waveformError}
        </div>
      )}
    </div>
  );
}
