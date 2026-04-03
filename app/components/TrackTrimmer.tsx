"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Track, TrimSettings } from "@/types/track";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import { formatTimeMs, parseTimeMs } from "@/lib/utils/timeFormatter";
import WaveformTrimEditor from "./WaveformTrimEditor";
import { useI18n } from "./I18nProvider";

interface TrackTrimmerProps {
  track: Track;
  onCancel: () => void;
}

const PLAYBACK_EPSILON = 0.02;

export default function TrackTrimmer({ track, onCancel }: TrackTrimmerProps) {
  const { t } = useI18n();
  const initialMaxDuration =
    track.metadata.duration && track.metadata.duration > 0
      ? Math.min(track.metadata.duration, 360)
      : 360;

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState<number | undefined>(undefined);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [maxDuration, setMaxDuration] = useState(initialMaxDuration);
  const [useEndTime, setUseEndTime] = useState(false);
  const [duration, setDuration] = useState(track.metadata.duration ?? initialMaxDuration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackStartTime, setPlaybackStartTime] = useState(0);

  const [startInput, setStartInput] = useState(() => formatTimeMs(0));
  const [endInput, setEndInput] = useState(() => formatTimeMs(initialMaxDuration));
  const startFocusedRef = useRef(false);
  const endFocusedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getResolvedTrimValues = useCallback(() => {
    const resolvedStartTime = startFocusedRef.current
      ? parseTimeMs(startInput, startTime)
      : startTime;

    if (useEndTime) {
      const fallbackEnd = endTime ?? resolvedStartTime + maxDuration;
      const resolvedEndTime = endFocusedRef.current
        ? parseTimeMs(endInput, fallbackEnd)
        : fallbackEnd;

      return {
        startTime: resolvedStartTime,
        endTime: resolvedEndTime,
        maxDuration: Math.max(1, resolvedEndTime - resolvedStartTime),
      };
    }

    const fallbackDurationEnd = resolvedStartTime + maxDuration;
    const resolvedEndPoint = endFocusedRef.current
      ? parseTimeMs(endInput, fallbackDurationEnd)
      : fallbackDurationEnd;
    const resolvedMaxDuration = Math.max(1, resolvedEndPoint - resolvedStartTime);

    return {
      startTime: resolvedStartTime,
      endTime: undefined,
      maxDuration: resolvedMaxDuration,
    };
  }, [endInput, endTime, maxDuration, startInput, startTime, useEndTime]);

  const resolvedTrimValues = getResolvedTrimValues();

  const effectiveEnd = useMemo(() => {
    if (useEndTime && resolvedTrimValues.endTime != null) {
      return resolvedTrimValues.endTime;
    }
    return resolvedTrimValues.startTime + resolvedTrimValues.maxDuration;
  }, [resolvedTrimValues.endTime, resolvedTrimValues.maxDuration, resolvedTrimValues.startTime, useEndTime]);

  const totalDuration = Math.max(0.01, effectiveEnd - resolvedTrimValues.startTime);

  const buildTrimSettings = useCallback(
    (): TrimSettings => ({
      startTime: resolvedTrimValues.startTime,
      fadeIn,
      fadeOut,
      ...(useEndTime && resolvedTrimValues.endTime != null
        ? { endTime: resolvedTrimValues.endTime }
        : { maxDuration: resolvedTrimValues.maxDuration }),
    }),
    [fadeIn, fadeOut, resolvedTrimValues.endTime, resolvedTrimValues.maxDuration, resolvedTrimValues.startTime, useEndTime]
  );

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.volume = 1;
    setIsPlaying(false);
  }, []);

  const syncPlaybackToRange = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.currentTime < 0 || audio.currentTime > duration) {
      audio.currentTime = playbackStartTime;
    }
  }, [duration, playbackStartTime]);

  const handleDurationLoaded = useCallback(
    (loadedDuration: number) => {
      setDuration(loadedDuration);
      setMaxDuration((prev) =>
        prev === 360 ? Math.min(loadedDuration, 360) : Math.min(prev, loadedDuration)
      );
      setEndTime((prev) => (prev != null ? prev : Math.min(loadedDuration, 360)));
    },
    []
  );

  useEffect(() => {
    if (!startFocusedRef.current) {
      setStartInput(formatTimeMs(startTime));
    }
  }, [startTime]);

  useEffect(() => {
    if (!endFocusedRef.current) {
      const endValue = useEndTime && endTime != null ? endTime : startTime + maxDuration;
      setEndInput(formatTimeMs(endValue));
    }
  }, [endTime, maxDuration, startTime, useEndTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const elapsed = Math.max(0, audio.currentTime - resolvedTrimValues.startTime);
      const remaining = Math.max(0, effectiveEnd - audio.currentTime);
      let volume = 1;

      if (fadeIn > 0 && elapsed < fadeIn) {
        volume = Math.min(volume, elapsed / fadeIn);
      }
      if (fadeOut > 0 && remaining < fadeOut) {
        volume = Math.min(volume, remaining / fadeOut);
      }
      audio.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;

      if (audio.currentTime >= duration - PLAYBACK_EPSILON) {
        audio.pause();
        audio.currentTime = playbackStartTime;
        audio.volume = 1;
        setIsPlaying(false);
      }
    };

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handleEnded = () => {
      audio.currentTime = playbackStartTime;
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [duration, effectiveEnd, fadeIn, fadeOut, playbackStartTime, resolvedTrimValues.startTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (audio.currentTime < 0 || audio.currentTime > duration - PLAYBACK_EPSILON) {
        stopPlayback();
        audio.currentTime = playbackStartTime;
      }
      return;
    }

    syncPlaybackToRange();
  }, [duration, isPlaying, playbackStartTime, syncPlaybackToRange, stopPlayback]);

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    audio.currentTime = playbackStartTime;

    try {
      audio.volume = fadeIn > 0 ? 0 : 1;
      await audio.play();
    } catch (error) {
      console.error("Trim playback error:", error);
      alert(t("trimmer.errors.previewPlayback"));
    }
  };

  const resetTrimRange = () => {
    stopPlayback();
    const resetMaxDuration = duration && duration > 0 ? Math.min(duration, 360) : 360;
    setStartTime(0);
    setUseEndTime(false);
    setEndTime(undefined);
    setMaxDuration(resetMaxDuration);
    setFadeIn(0);
    setFadeOut(0);
    setPlaybackStartTime(0);
    setStartInput(formatTimeMs(0));
    setEndInput(formatTimeMs(resetMaxDuration));
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleTrim = async () => {
    const trimSettings = buildTrimSettings();

    try {
      const { trimTrackAction } = await import("@/lib/actions/trackActions");
      await trimTrackAction(track.id, trimSettings);
      onCancel();
    } catch (error) {
      console.error("Error trimming track:", error);
      alert(
        `${t("trimmer.errors.trim")}: ${getUserFacingErrorMessage(
          error,
          t("trimmer.errors.unknown")
        )}`
      );
    }
  };

  const commitStartInput = () => {
    const nextStart = parseTimeMs(startInput, startTime);
    setStartTime(nextStart);
    setStartInput(formatTimeMs(nextStart));
  };

  const commitEndInput = () => {
    const fallback = useEndTime && endTime != null ? endTime : startTime + maxDuration;
    const nextValue = parseTimeMs(endInput, fallback);

    if (useEndTime) {
      setEndTime(nextValue);
      setEndInput(formatTimeMs(nextValue));
      return;
    }

    const nextDuration = Math.max(1, nextValue - startTime);
    setMaxDuration(nextDuration);
    setEndInput(formatTimeMs(startTime + nextDuration));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="mx-auto flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-cyan-400/10 bg-[#173f72] text-white shadow-2xl">
        <audio
          ref={audioRef}
          src={`/api/audio/${track.id}`}
          preload="metadata"
          className="hidden"
          data-testid="trim-preview-audio"
          onLoadedMetadata={(event) => {
            const loadedDuration = event.currentTarget.duration;
            if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
              setDuration(loadedDuration);
            }
            syncPlaybackToRange();
          }}
          onError={(event) => {
            console.error("Trim audio error:", event);
            alert(t("player.audioError"));
          }}
        />

        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="min-w-0">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/75">
              {t("trimmer.trimMode")}
            </div>
            <h3 className="truncate text-2xl font-semibold">{t("trimmer.title")}</h3>
            <p className="truncate text-sm text-cyan-100/70">{track.metadata.title}</p>
          </div>
          <button
            type="button"
            onClick={resetTrimRange}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-white/10"
          >
            {t("trimmer.reset")}
          </button>
        </div>

        <div className="overflow-auto px-6 py-4">
          <div className="rounded-[24px] border border-white/8 bg-[#102f5b] p-4 shadow-inner shadow-black/20">
            <WaveformTrimEditor
              audioUrl={`/api/audio/${track.id}`}
              durationFallback={track.metadata.duration}
              startTime={startTime}
              endTime={endTime}
              maxDuration={maxDuration}
              useEndTime={useEndTime}
              playbackStartTime={playbackStartTime}
              fadeIn={fadeIn}
              fadeOut={fadeOut}
              onStartChange={setStartTime}
              onEndChange={setEndTime}
              onMaxDurationChange={setMaxDuration}
              onPlaybackStartChange={setPlaybackStartTime}
              onDurationLoaded={handleDurationLoaded}
            />

            <div className="mt-3 grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-end">
              <button
                type="button"
                onClick={handlePlayPause}
                className="flex h-14 w-24 items-center justify-center rounded-2xl bg-[#13294f] text-white transition hover:bg-[#163564]"
                aria-label={isPlaying ? t("trimmer.pause") : t("trimmer.play")}
              >
                {isPlaying ? (
                  <span className="flex gap-1.5">
                    <span className="h-5 w-1.5 rounded bg-white" />
                    <span className="h-5 w-1.5 rounded bg-white" />
                  </span>
                ) : (
                  <span className="ml-1 border-y-[10px] border-y-transparent border-l-[16px] border-l-white" />
                )}
              </button>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-[#13294f] p-3">
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                    {t("trimmer.startTime")}
                  </label>
                  <input
                    type="text"
                    value={startInput}
                    onChange={(event) => setStartInput(event.target.value)}
                    onFocus={() => {
                      startFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      startFocusedRef.current = false;
                      commitStartInput();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        startFocusedRef.current = false;
                        commitStartInput();
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="M:SS.ms"
                    className="w-full border-none bg-transparent p-0 font-mono text-lg font-semibold text-white outline-none placeholder:text-cyan-100/35"
                  />
                </div>

                <div className="rounded-2xl bg-[#13294f] p-3">
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                    {useEndTime ? t("trimmer.endTime") : t("trimmer.maxDuration")}
                  </label>
                  {useEndTime ? (
                    <input
                      type="text"
                      value={endInput}
                      onChange={(event) => setEndInput(event.target.value)}
                      onFocus={() => {
                        endFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        endFocusedRef.current = false;
                        commitEndInput();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          endFocusedRef.current = false;
                          commitEndInput();
                          (event.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="M:SS.ms"
                      className="w-full border-none bg-transparent p-0 font-mono text-lg font-semibold text-white outline-none placeholder:text-cyan-100/35"
                    />
                  ) : (
                    <input
                      type="number"
                      min="1"
                      max="600"
                      value={Math.round(maxDuration * 100) / 100}
                      onChange={(event) => setMaxDuration(parseFloat(event.target.value) || 1)}
                      className="w-full border-none bg-transparent p-0 font-mono text-lg font-semibold text-white outline-none"
                    />
                  )}
                </div>

                <div className="rounded-2xl bg-[#13294f] p-3">
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                    {t("trimmer.endType")}
                  </label>
                  <div className="flex flex-col gap-2 text-sm text-cyan-50">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!useEndTime}
                        onChange={() => setUseEndTime(false)}
                        className="h-4 w-4 accent-cyan-400"
                      />
                      <span>{t("trimmer.maxDuration")}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={useEndTime}
                        onChange={() => {
                          setUseEndTime(true);
                          setEndTime((prev) => (prev != null ? prev : startTime + maxDuration));
                        }}
                        className="h-4 w-4 accent-cyan-400"
                      />
                      <span>{t("trimmer.specificTime")}</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#13294f] p-3">
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                    {t("trimmer.previewDuration")}
                  </label>
                  <div className="font-mono text-lg font-semibold text-white">
                    {formatTimeMs(totalDuration)}
                  </div>
                  <div className="mt-2 text-xs text-cyan-100/65">
                    {formatTimeMs(resolvedTrimValues.startTime)} - {formatTimeMs(effectiveEnd)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#13294f] p-3">
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                    {t("trimmer.fadeIn")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={fadeIn}
                    onChange={(event) => setFadeIn(parseFloat(event.target.value) || 0)}
                    title={t("trimmer.noFadeTitle")}
                    className="w-full border-none bg-transparent p-0 font-mono text-lg font-semibold text-white outline-none"
                  />
                </div>
                <div className="rounded-2xl bg-[#13294f] p-3">
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                    {t("trimmer.fadeOut")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={fadeOut}
                    onChange={(event) => setFadeOut(parseFloat(event.target.value) || 0)}
                    title={t("trimmer.noFadeTitle")}
                    className="w-full border-none bg-transparent p-0 font-mono text-lg font-semibold text-white outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid flex-shrink-0 gap-3 border-t border-white/10 px-6 py-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleTrim}
            className="rounded-2xl bg-white px-6 py-4 text-base font-semibold text-[#173f72] transition hover:bg-cyan-50"
          >
            {t("trimmer.trimAction")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl bg-white/8 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/12"
          >
            {t("trimmer.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
