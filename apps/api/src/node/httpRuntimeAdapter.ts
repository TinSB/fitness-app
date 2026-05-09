import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createServerAdapter, ServerAdapterRequest, ServerAdapterResponse } from './serverAdapter';

type ServerAdapter = ReturnType<typeof createServerAdapter>;

export type CreateHttpRequestListenerOptions = {
  serverAdapter: ServerAdapter;
  maxBodyBytes?: number;
  jsonContentType?: string;
};

export type HttpRuntimeErrorCode =
  | 'invalid_json'
  | 'request_body_too_large'
  | 'unsupported_media_type'
  | 'request_read_failed';

const DEFAULT_MAX_BODY_BYTES = 1_048_576;
const DEFAULT_JSON_CONTENT_TYPE = 'application/json';

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

const writeJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, jsonHeaders);
  response.end(JSON.stringify(body));
};

const errorBody = (code: string, message: string) => ({
  error: { code, message },
});

const adapterBody = (adapterResponse: ServerAdapterResponse) => {
  if (adapterResponse.error) return errorBody(adapterResponse.error.code, adapterResponse.error.message);
  return {
    result: adapterResponse.result,
    ...(adapterResponse.snapshot ? { snapshot: adapterResponse.snapshot } : {}),
  };
};

const parseQuery = (url: URL): Record<string, string> => {
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
};

const hasSupportedJsonContentType = (header: string | undefined, jsonContentType: string) =>
  !header || header.split(';', 1)[0].trim().toLowerCase() === jsonContentType.toLowerCase();

const readRequestBody = (
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; status: number; code: HttpRuntimeErrorCode; message: string }> =>
  new Promise((resolve) => {
    let size = 0;
    let text = '';
    let settled = false;

    const finish = (result: { ok: true; text: string } | { ok: false; status: number; code: HttpRuntimeErrorCode; message: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      if (settled) return;
      size += Buffer.byteLength(chunk, 'utf8');
      if (size > maxBodyBytes) {
        finish({
          ok: false,
          status: 413,
          code: 'request_body_too_large',
          message: 'Request body is too large.',
        });
        return;
      }
      text += chunk;
    });
    request.on('end', () => finish({ ok: true, text }));
    request.on('error', () =>
      finish({
        ok: false,
        status: 400,
        code: 'request_read_failed',
        message: 'Request body could not be read.',
      }),
    );
  });

const parseBody = (
  text: string,
  contentType: string | undefined,
  jsonContentType: string,
): { ok: true; body?: unknown } | { ok: false; status: number; code: HttpRuntimeErrorCode; message: string } => {
  if (!text.length) return { ok: true, body: undefined };
  if (!hasSupportedJsonContentType(contentType, jsonContentType)) {
    return {
      ok: false,
      status: 415,
      code: 'unsupported_media_type',
      message: 'Only application/json request bodies are supported.',
    };
  }
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'invalid_json',
      message: 'Request body is not valid JSON.',
    };
  }
};

export const createHttpRequestListener = ({
  serverAdapter,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  jsonContentType = DEFAULT_JSON_CONTENT_TYPE,
}: CreateHttpRequestListenerOptions) => {
  const listener = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const method = request.method || 'GET';
    let body: unknown;

    if (method === 'POST') {
      const bodyResult = await readRequestBody(request, maxBodyBytes);
      if (!bodyResult.ok) {
        writeJson(response, bodyResult.status, errorBody(bodyResult.code, bodyResult.message));
        return;
      }
      const parsed = parseBody(bodyResult.text, request.headers['content-type'], jsonContentType);
      if (!parsed.ok) {
        writeJson(response, parsed.status, errorBody(parsed.code, parsed.message));
        return;
      }
      body = parsed.body;
    }

    const adapterRequest: ServerAdapterRequest = {
      method,
      path: url.pathname,
      query: parseQuery(url),
      ...(body !== undefined ? { body } : {}),
    };
    const adapterResponse = serverAdapter.handleRequest(adapterRequest);
    writeJson(response, adapterResponse.status, adapterBody(adapterResponse));
  };

  return listener;
};
