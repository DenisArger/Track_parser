export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  genre: TrackType;
  rating: number;
  year: number;
  duration?: number;
  bpm?: number;
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
  source: "youtube" | "yandex";
}

export interface ProcessingRequest {
  trackId: string;
  metadata: Partial<TrackMetadata>;
}

export interface UploadRequest {
  trackId: string;
  ftpConfig: FtpConfig;
}
