import type { NextFunction, Request, Response } from "express";
import { findById } from "../modules/user/user.service";
import type { UserRole } from "../modules/user/user.interface";
import { AppError } from "../utils/AppError";

/** Checks the role against the database, not the JWT, so role changes and removed accounts apply immediately. */
export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    findById(req.user.id)
      .then((user) => {
        if (!user) throw new AppError(401, "UNAUTHORIZED", "Account no longer exists");
        if (user.role !== role) throw new AppError(403, "FORBIDDEN", "You do not have permission to do this");
        req.user.role = user.role;
        next();
      })
      .catch(next);
  };
}
