"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Track, TrimSettings } from "@/types/track";
import { getUserFacingErrorMessage } from "@/lib/utils/errorMessage";
import { formatTimeMs, parseTimeMs } from "@/lib/utils/timeFormatter";
import WaveformTrimEditor from "./WaveformTrimEditor";
import { useI18n } from "./I18nProvider";

interface TrackTrimmerProps {
  track: Track;
  onCancel: () => void;
}

export default function TrackTrimmer({ track, onCancel }: TrackTrimmerProps) {
  const { t } = useI18n();
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState<number | undefined>(undefined);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [maxDuration, setMaxDuration] = useState(360);
  const [useEndTime, setUseEndTime] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const shouldAutoPlayRef = useRef(false);

  const [startInput, setStartInput] = useState(() => formatTimeMs(0));
  const [endInput, setEndInput] = useState(() => formatTimeMs(360));
  const startFocusedRef = useRef(false);
  const endFocusedRef = useRef(false);

  // Синхронизация полей MM:SS.ms при изменении из волновой формы

  const handleTrim = async () => {
    const trimSettings: TrimSettings = {
      startTime,
      fadeIn,
      fadeOut,
      ...(useEndTime && endTime != null ? { endTime } : { maxDuration }),
    };

    try {
      const { trimTrackAction } = await import("@/lib/actions/trackActions");
      const result = await trimTrackAction(track.id, trimSettings);
      console.warn("Track trimmed successfully:", result);

      // Закрываем окно обрезки
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

  const createPreview = async () => {
    setIsPreviewLoading(true);
    try {
      const trimSettings: TrimSettings = {
        startTime,
        fadeIn,
        fadeOut,
        ...(useEndTime && endTime != null ? { endTime } : { maxDuration }),
      };

      const { createPreviewAction } = await import(
        "@/lib/actions/trackActions"
      );
      const result = await createPreviewAction(track.id, trimSettings);
      setPreviewId(result.previewId);
      shouldAutoPlayRef.current = true;
      console.warn("Preview created:", result.previewId);
    } catch (error) {
      console.error("Error creating preview:", error);
      alert(
        `${t("trimmer.errors.preview")}: ${getUserFacingErrorMessage(
          error,
          t("trimmer.errors.unknown")
        )}`
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePreviewCanPlay = () => {
    if (!shouldAutoPlayRef.current) return;
    shouldAutoPlayRef.current = false;
    previewAudioRef.current?.play().then(() => setIsPreviewPlaying(true)).catch(() => {});
  };

  const handlePreviewPlayPause = async () => {
    if (!previewId) {
      await createPreview();
      return;
    }

    if (previewAudioRef.current) {
      if (isPreviewPlaying) {
        previewAudioRef.current.pause();
      } else {
        await previewAudioRef.current.play();
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  };

  const handlePreviewEnded = () => {
    setIsPreviewPlaying(false);
  };

  const handlePreviewTimeUpdate = () => {
    if (previewAudioRef.current) {
      setPreviewCurrentTime(previewAudioRef.current.currentTime);
    }
  };

  const handlePreviewLoadedMetadata = () => {
    if (previewAudioRef.current) {
      setPreviewDuration(previewAudioRef.current.duration);
    }
  };

  const handlePreviewSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (previewAudioRef.current) {
      previewAudioRef.current.currentTime = time;
      setPreviewCurrentTime(time);
    }
  };

  const handlePreviewRestart = () => {
    if (!previewAudioRef.current) return;
    previewAudioRef.current.currentTime = 0;
    setPreviewCurrentTime(0);
    previewAudioRef.current.play().then(() => setIsPreviewPlaying(true)).catch(() => {});
  };

  // Автоматически обновляем предварительный просмотр при изменении настроек
  const updatePreview = useCallback(async () => {
    if (previewId) {
      const wasPlaying = isPreviewPlaying;
      setIsPreviewLoading(true);
      try {
        const trimSettings: TrimSettings = {
          startTime,
          fadeIn,
          fadeOut,
          ...(useEndTime && endTime != null ? { endTime } : { maxDuration }),
        };

        const { createPreviewAction } = await import(
          "@/lib/actions/trackActions"
        );
        const result = await createPreviewAction(track.id, trimSettings);
        setPreviewId(result.previewId);
        setPreviewCurrentTime(0);
        setIsPreviewPlaying(false);
        if (wasPlaying) shouldAutoPlayRef.current = true;
        console.warn("Preview updated:", result.previewId);
      } catch (error) {
        console.error("Error updating preview:", error);
      } finally {
        setIsPreviewLoading(false);
      }
    }
  }, [
    previewId,
    isPreviewPlaying,
    startTime,
    fadeIn,
    fadeOut,
    useEndTime,
    endTime,
    maxDuration,
    track.id,
  ]);


  useEffect(() => {
    if (!startFocusedRef.current) setStartInput(formatTimeMs(startTime));
  }, [startTime]);
  useEffect(() => {
    if (!endFocusedRef.current) {
      const e = useEndTime && endTime != null ? endTime : startTime + maxDuration;
      setEndInput(formatTimeMs(e));
    }
  }, [endTime, useEndTime, startTime, maxDuration]);

  const handleDurationLoaded = (d: number) => {
    setEndTime((prev) => (prev != null ? prev : Math.min(d, 360)));
  };

  // Автоматически обновляем предварительный просмотр при изменении настроек
  useEffect(() => {
    if (previewId) {
      const timeoutId = setTimeout(() => {
        updatePreview();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [previewId, updatePreview]);

  const totalDuration =
    useEndTime && endTime != null ? endTime - startTime : maxDuration;

  const commitStartInput = () => {
    const sec = parseTimeMs(startInput, startTime);
    setStartTime(sec);
    setStartInput(formatTimeMs(sec));
  };
  const commitEndInput = () => {
    const fallback = useEndTime && endTime != null ? endTime : startTime + maxDuration;
    const sec = parseTimeMs(endInput, fallback);
    if (useEndTime) {
      setEndTime(sec);
      setEndInput(formatTimeMs(sec));
    } else {
      const d = Math.max(1, sec - startTime);
      setMaxDuration(d);
      setEndInput(formatTimeMs(startTime + d));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl dark:shadow-gray-900/50 w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {t("trimmer.title")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{track.metadata.title}</p>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-h-0 flex px-6 py-4 gap-6">
          {/* Left column */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <WaveformTrimEditor
              audioUrl={`/api/audio/${track.id}`}
              durationFallback={track.metadata.duration}
              startTime={startTime}
              endTime={endTime}
              maxDuration={maxDuration}
              useEndTime={useEndTime}
              onStartChange={setStartTime}
              onEndChange={setEndTime}
              onMaxDurationChange={setMaxDuration}
              onDurationLoaded={handleDurationLoaded}
            />

            {/* Row: start | end type | end/max duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t("trimmer.startTime")}
                </label>
                <input
                  type="text"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  onFocus={() => { startFocusedRef.current = true; }}
                  onBlur={() => { startFocusedRef.current = false; commitStartInput(); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { startFocusedRef.current = false; commitStartInput(); (e.target as HTMLInputElement).blur(); } }}
                  placeholder="M:SS.ms"
                  className="input font-mono py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t("trimmer.endType")}
                </label>
                <div className="flex flex-wrap gap-3 pt-1.5">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer dark:text-gray-300">
                    <input type="radio" checked={!useEndTime} onChange={() => setUseEndTime(false)} className="w-3.5 h-3.5" />
                    <span>{t("trimmer.maxDuration")}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer dark:text-gray-300">
                    <input
                      type="radio"
                      checked={useEndTime}
                      onChange={() => { setUseEndTime(true); setEndTime((prev) => (prev != null ? prev : startTime + maxDuration)); }}
                      className="w-3.5 h-3.5"
                    />
                    <span>{t("trimmer.specificTime")}</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {useEndTime ? t("trimmer.endTime") : t("trimmer.maxDurationSeconds")}
                </label>
                {useEndTime ? (
                  <input
                    type="text"
                    value={endInput}
                    onChange={(e) => setEndInput(e.target.value)}
                    onFocus={() => { endFocusedRef.current = true; }}
                    onBlur={() => { endFocusedRef.current = false; commitEndInput(); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { endFocusedRef.current = false; commitEndInput(); (e.target as HTMLInputElement).blur(); } }}
                    placeholder="M:SS.ms"
                    className="input font-mono py-1.5 text-sm"
                  />
                ) : (
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={maxDuration}
                    onChange={(e) => setMaxDuration(parseInt(e.target.value) || 1)}
                    className="input py-1.5 text-sm"
                  />
                )}
              </div>
            </div>

            {/* Fades */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t("trimmer.fadeIn")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={fadeIn}
                  onChange={(e) => setFadeIn(parseFloat(e.target.value) || 0)}
                  className="input py-1.5 text-sm"
                  title={t("trimmer.noFadeTitle")}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t("trimmer.fadeOut")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={fadeOut}
                  onChange={(e) => setFadeOut(parseFloat(e.target.value) || 0)}
                  className="input py-1.5 text-sm"
                  title={t("trimmer.noFadeTitle")}
                />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-3">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex flex-col gap-2 flex-1 min-h-0">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm flex-shrink-0">
                {t("trimmer.previewTitle")}
              </h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 grid grid-cols-2 gap-x-3 gap-y-0.5 flex-shrink-0">
                <span>{t("trimmer.previewStart")}:</span>
                <span className="font-mono">{formatTimeMs(startTime)}</span>
                <span>{t("trimmer.previewEnd")}:</span>
                <span className="font-mono">
                  {formatTimeMs(useEndTime && endTime != null ? endTime : startTime + maxDuration)}
                </span>
                <span>{t("trimmer.previewDuration")}:</span>
                <span className="font-mono">{formatTimeMs(totalDuration)}</span>
                <span>{t("trimmer.previewFadeIn")}:</span><span>{fadeIn}s</span>
                <span>{t("trimmer.previewFadeOut")}:</span><span>{fadeOut}s</span>
              </div>
              <button
                onClick={handlePreviewPlayPause}
                disabled={isPreviewLoading}
                className="btn btn-primary py-2 text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPreviewLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    {t("trimmer.previewCreating")}
                  </span>
                ) : isPreviewPlaying ? t("trimmer.previewStop") : t("trimmer.previewListen")}
              </button>
              {previewId && (
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePreviewPlayPause}
                      className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 flex-shrink-0"
                      aria-label={isPreviewPlaying ? t("trimmer.previewStop") : t("trimmer.previewStart")}
                    >
                      {isPreviewPlaying ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>}
                    </button>
                    <input type="range" min="0" max={previewDuration || 0} step="any" value={previewCurrentTime} onChange={handlePreviewSeek} className="flex-1 h-1.5 accent-primary-600" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums w-14">{formatTimeMs(previewCurrentTime)} / {formatTimeMs(previewDuration)}</span>
                    <button
                      type="button"
                      onClick={handlePreviewRestart}
                      className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0"
                      title={t("trimmer.previewRestart")}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                  </div>
                  <button type="button" onClick={updatePreview} disabled={isPreviewLoading} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50">
                    {isPreviewLoading ? t("trimmer.previewUpdating") : t("trimmer.previewUpdate")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button onClick={handleTrim} className="btn btn-primary flex-1">
            {t("trimmer.trimAction")}
          </button>
          <button onClick={onCancel} className="btn btn-secondary flex-1">
            {t("trimmer.cancel")}
          </button>
        </div>
      </div>

      {previewId && (
        <audio
          ref={previewAudioRef}
          src={`/api/preview-audio/${previewId}`}
          onTimeUpdate={handlePreviewTimeUpdate}
          onLoadedMetadata={handlePreviewLoadedMetadata}
          onCanPlay={handlePreviewCanPlay}
          onEnded={handlePreviewEnded}
          onError={(e) => {
            console.error("Preview audio error:", e);
            alert(t("trimmer.errors.previewPlayback"));
          }}
          className="hidden"
        />
      )}
    </div>
  );
}



