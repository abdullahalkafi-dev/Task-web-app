export interface INote {
  _id: string;
  userId: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
  serverUpdatedAt: Date;
  deletedAt: Date | null;
}

export interface INoteDTO {
  id: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface INoteUpsert {
  id: string;
  title: string;
  descriptionHtml: string;
  descriptionText?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface INoteUpsertResult {
  id: string;
  applied: boolean;
  winner: INoteDTO | null;
  error?: "FORBIDDEN";
}
