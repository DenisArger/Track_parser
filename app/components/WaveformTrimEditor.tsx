/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { formatTimeMs } from "@/lib/utils/timeFormatter";
import Spinner from "./Spinner";

export interface WaveformTrimEditorProps {
  audioUrl: string;
  durationFallback?: number;
  startTime: number;
  endTime: number | undefined;
  maxDuration: number;
  useEndTime: boolean;
  playbackStartTime?: number;
  fadeIn?: number;
  fadeOut?: number;
  onStartChange: (s: number) => void;
  onEndChange: (e: number) => void;
  onMaxDurationChange: (d: number) => void;
  onPlaybackStartChange?: (value: number) => void;
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
  playbackStartTime = 0,
  fadeIn = 0,
  fadeOut = 0,
  onStartChange,
  onEndChange,
  onMaxDurationChange,
  onPlaybackStartChange,
  onDurationLoaded,
}: WaveformTrimEditorProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{
    destroy: () => void;
    setOptions?: (options: {
      renderFunction?: (
        peaks: Array<Float32Array | number[]>,
        ctx: CanvasRenderingContext2D
      ) => void;
    }) => void;
  } | null>(null);
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
  const fadeInPercent = Math.min(100, (Math.max(0, fadeIn) / effectiveDuration) * 100);
  const fadeOutPercent = Math.min(100, (Math.max(0, fadeOut) / effectiveDuration) * 100);
  const fadeInWidth = `${fadeInPercent}%`;
  const fadeOutWidth = `${fadeOutPercent}%`;
  const fadeInEnd = Math.min(effectiveEnd, startTime + fadeIn);
  const fadeOutStart = Math.max(startTime, effectiveEnd - fadeOut);
  const playbackLeft = `${(Math.max(0, Math.min(playbackStartTime, waveformDuration)) / waveformDuration) * 100}%`;

  const createRenderFunction = useCallback(
    (durationHint: number) =>
      (peaks: Array<Float32Array | number[]>, ctx: CanvasRenderingContext2D) => {
        const channel = peaks[0];
        if (!channel || channel.length === 0) return;

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const centerY = height / 2;
        const maxBarHeight = height * 0.42;
        const barWidth = 2;
        const gap = 1;
        const step = barWidth + gap;
        const totalDuration = Math.max(durationHint, effectiveEnd, 0.01);

        ctx.clearRect(0, 0, width, height);

        for (let x = 0; x < width; x += step) {
          const index = Math.min(
            channel.length - 1,
            Math.floor((x / width) * channel.length)
          );
          const rawPeak = Math.abs(Number(channel[index] ?? 0));
          const time = (index / channel.length) * totalDuration;
          const inSelection = time >= startTime && time <= effectiveEnd;

          let amplitudeScale = 1;
          if (inSelection && fadeIn > 0 && time < fadeInEnd) {
            amplitudeScale = Math.min(amplitudeScale, (time - startTime) / Math.max(fadeIn, 0.001));
          }
          if (inSelection && fadeOut > 0 && time > fadeOutStart) {
            amplitudeScale = Math.min(
              amplitudeScale,
              (effectiveEnd - time) / Math.max(fadeOut, 0.001)
            );
          }

          if (!inSelection) {
            amplitudeScale = 1;
          }

          const scaledPeak = rawPeak * Math.max(0.04, Math.min(1, amplitudeScale));
          const barHeight = Math.max(1.5, scaledPeak * maxBarHeight);

          ctx.fillStyle = inSelection ? "#17efc4" : "rgba(23, 239, 196, 0.22)";
          ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
        }
      },
    [effectiveEnd, fadeIn, fadeInEnd, fadeOut, fadeOutStart, startTime]
  );

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
          waveColor: "#17efc4",
          progressColor: "#17efc4",
          cursorColor: "transparent",
          cursorWidth: 0,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
          renderFunction: createRenderFunction(
            durationFallback ?? Math.max(effectiveEnd, 0.01)
          ),
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
          color: "rgba(13, 250, 184, 0.16)",
          content: "",
        });

        disableDrag = regionsPlugin.enableDragSelection({
          color: "rgba(13, 250, 184, 0.16)",
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
            color: "rgba(13, 250, 184, 0.16)",
            content: "",
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
    if (!wsRef.current?.setOptions) return;
    wsRef.current.setOptions({
      renderFunction: createRenderFunction(
        loadedDuration > 0
          ? loadedDuration
          : durationFallback ?? Math.max(effectiveEnd, 0.01)
      ),
    });
  }, [createRenderFunction, durationFallback, effectiveEnd, loadedDuration]);

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

  const updatePlaybackStart = useCallback(
    (clientX: number) => {
      if (!containerRef.current || !onPlaybackStartChange) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onPlaybackStartChange(ratio * waveformDuration);
    },
    [onPlaybackStartChange, waveformDuration]
  );

  useEffect(() => {
    if (!onPlaybackStartChange) return;

    let dragging = false;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      updatePlaybackStart(event.clientX);
    };

    const handlePointerUp = () => {
      dragging = false;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-playback-handle='true']")) return;
      dragging = true;
      updatePlaybackStart(event.clientX);
      event.preventDefault();
    };

    const root = containerRef.current?.parentElement;
    root?.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      root?.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onPlaybackStartChange, updatePlaybackStart]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[24px] border border-cyan-300/10 bg-[#163865] px-4 py-5"
      onDoubleClick={(event) => updatePlaybackStart(event.clientX)}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-white/10 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-white/10 to-transparent" />
      <div ref={containerRef} className="w-full min-h-[170px]" />
      <div
        className="pointer-events-none absolute bottom-6 top-6 overflow-hidden rounded-[18px]"
        style={{ left: selectionLeft, width: selectionWidth }}
      >
        {fadeIn > 0 && (
          <>
            <div
              className="absolute inset-y-0 left-0 border-r-2 border-cyan-100/90"
              style={{ width: fadeInWidth }}
            />
            <div
              className="absolute left-2 top-2 rounded-md border border-cyan-100/35 bg-[#071c39]/80 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-cyan-50 shadow-lg"
              style={{ maxWidth: `min(calc(${fadeInWidth} - 0.5rem), 12rem)` }}
            >
              Нарастание {formatTimeMs(fadeIn)}
            </div>
            <div className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-cyan-50/90" />
          </>
        )}
        {fadeIn > 0 && (
          <div
            className="absolute bottom-3 left-0 rounded-full bg-[#071c39]/75 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-cyan-50"
            style={{ transform: `translateX(calc(${fadeInWidth} - 1.5rem))` }}
          >
            END
          </div>
        )}
        {fadeOut > 0 && (
          <>
            <div
              className="absolute inset-y-0 right-0 border-l-2 border-cyan-100/90"
              style={{ width: fadeOutWidth }}
            />
            <div
              className="absolute right-2 top-2 rounded-md border border-cyan-100/35 bg-[#071c39]/80 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-cyan-50 shadow-lg"
              style={{ maxWidth: `min(calc(${fadeOutWidth} - 0.5rem), 12rem)` }}
            >
              Затухание {formatTimeMs(fadeOut)}
            </div>
            <div className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-cyan-50/90" />
            <div
              className="absolute bottom-3 right-0 rounded-full bg-[#071c39]/75 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-cyan-50"
              style={{ transform: `translateX(calc(-${fadeOutWidth} + 1.5rem))` }}
            >
              START
            </div>
          </>
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

      <div
        className="absolute bottom-6 top-6 z-10 w-4 -translate-x-1/2"
        style={{ left: playbackLeft }}
        data-playback-handle="true"
        role="slider"
        aria-label="Playback start"
        aria-valuemin={0}
        aria-valuemax={waveformDuration}
        aria-valuenow={playbackStartTime}
      >
        <div className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 rounded-full bg-[#22727f]" />
        <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-cyan-200" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-7 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#173f72]">
          {formatTimeMs(playbackStartTime)}
        </div>
      </div>

      {isWaveformLoading && (
        <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-[#163865] text-sm text-cyan-100/70">
          <div className="flex items-center gap-2">
            <Spinner label={t("trimmer.waveformLoading")} />
            <span>{t("trimmer.waveformLoading")}</span>
          </div>
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
