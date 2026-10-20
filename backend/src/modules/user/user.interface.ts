export type UserRole = "superadmin" | "user";

export interface IUser {
  _id: string;
  email: string;
  googleId: string;
  name?: string;
  role: UserRole;
  lastLoginAt: Date;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserPublic {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
}

/** Numbers only, never content. */
export interface IUserStatsRow {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
  loginCount: number;
  tasks: number;
  notes: number;
  images: number;
  storageBytes: number;
}

export interface IUserStats {
  totals: {
    users: number;
    activeLast7d: number;
    tasks: number;
    notes: number;
    images: number;
    storageBytes: number;
  };
  users: IUserStatsRow[];
}
