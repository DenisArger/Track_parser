export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  genre: TrackType;
  rating: number;
  year: number;
  duration?: number;
  bpm?: number;
  sourceUrl?: string; // Original URL used to download the track
  sourceType?: "youtube" | "youtube-music"; // Source type for re-downloading
}

export type TrackType = "Быстрый" | "Средний" | "Медленный" | "Модерн";

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
  | "reviewed_approved"
  | "reviewed_rejected"
  | "ready_for_upload"
  | "uploading"
  | "uploaded_ftp"
  | "uploaded_radio"
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
  source?: "youtube" | "youtube-music";
}

export interface ProcessingRequest {
  trackId: string;
  metadata: Partial<TrackMetadata>;
}

export interface UploadRequest {
  trackId: string;
  ftpConfig: FtpConfig;
}
