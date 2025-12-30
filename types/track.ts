export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  genre: TrackType;
  rating: number;
  year: number;
  duration?: number;
  bpm?: number;
  isTrimmed?: boolean;
  trimSettings?: TrimSettings;
  sourceUrl?: string; // Original URL used to download the track
  sourceType?: "youtube" | "youtube-music" | "yandex"; // Source type for re-downloading
}

export type TrackType = "Быстрый" | "Средний" | "Медленный";

export interface Track {
  id: string;
  filename: string;
  originalPath: string;
  processedPath?: string;
  metadata: TrackMetadata;
  status: TrackStatus;
  downloadProgress?: number;
  processingProgress?: number;
  uploadProgress?: number;
  error?: string;
}

export type TrackStatus =
  | "downloading"
  | "downloaded"
  | "processing"
  | "processed"
  | "trimmed"
  | "rejected"
  | "uploading"
  | "uploaded"
  | "error";

export interface FtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  remotePath?: string; // Optional remote directory path on FTP server
}

export interface ProcessingConfig {
  maxDuration: number;
  defaultRating: number;
  defaultYear: number;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitrate: string;
}

export interface AppConfig {
  folders: {
    downloads: string;
    processed: string;
    rejected: string;
    server_upload: string;
  };
  rapidapi: {
    key: string;
    host: string;
  };
  ftp: FtpConfig;
  processing: ProcessingConfig;
  audio: AudioConfig;
}

export interface DownloadRequest {
  url: string;
  source?: "youtube" | "youtube-music" | "yandex";
}

export interface ProcessingRequest {
  trackId: string;
  metadata: Partial<TrackMetadata>;
  trimSettings?: TrimSettings;
}

export interface TrimSettings {
  startTime: number; // время начала в секундах
  endTime?: number; // время окончания в секундах (опционально)
  fadeIn: number; // длительность затухания в начале в секундах
  fadeOut: number; // длительность затухания в конце в секундах
  maxDuration?: number; // максимальная длительность (если не указан endTime)
}

export interface UploadRequest {
  trackId: string;
  ftpConfig: FtpConfig;
}
