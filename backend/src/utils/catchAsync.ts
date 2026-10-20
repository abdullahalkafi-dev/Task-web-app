import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

export function catchAsync<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  Query = ParsedQs,
>(
  fn: (req: Request<P, ResBody, ReqBody, Query>, res: Response<ResBody>, next: NextFunction) => Promise<void>,
): RequestHandler<P, ResBody, ReqBody, Query> {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
