import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import type { ZodType } from "zod";

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  Query = ParsedQs,
>(schemas: Schemas): RequestHandler<P, ResBody, ReqBody, Query> {
  return (req: Request<P, ResBody, ReqBody, Query>, _res: Response<ResBody>, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body) as ReqBody;
      if (schemas.query) req.query = schemas.query.parse(req.query) as Query;
      if (schemas.params) req.params = schemas.params.parse(req.params) as P;
      next();
    } catch (err) {
      next(err);
    }
  };
}
