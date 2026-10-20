export interface IUpload {
  _id: string;
  userId: string;
  filename: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  createdAt: Date;
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
