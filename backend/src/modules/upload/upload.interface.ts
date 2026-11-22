export interface IUpload {
  _id: string;
  userId: string;
  filename: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  /** Previous version of this image (kept hidden), when this file is a markup edit. */
  replacesFilename: string | null;
  createdAt: Date;
}

export interface IImageVersion {
  url: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface IUploadResult {
  url: string;
  width: number;
  height: number;
}

export interface IUploadInput {
  buffer: Buffer;
  size: number;
}
