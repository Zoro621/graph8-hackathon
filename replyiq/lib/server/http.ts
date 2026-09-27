import "server-only";
import { NextResponse } from "next/server";
import type { ApiErrorBody } from "../api-types";
import { toApiError } from "./service";

const NO_STORE = { "Cache-Control": "no-store" };

export const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

export function fail(err: unknown) {
  const e = toApiError(err);
  if (e.status >= 500) console.error(`[replyiq] ${e.code}: ${e.message}`);
  return NextResponse.json<ApiErrorBody>({ error: { code: e.code, message: e.message } }, { status: e.status, headers: NO_STORE });
}

/** Parses a JSON body; an empty body is `{}`. */
export async function body(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return Symbol("invalid json"); // fails schema validation with a 400
  }
}
