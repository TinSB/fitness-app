import {
  parseAppleHealthXmlStreaming,
  type AppleHealthStreamingImportProgress,
} from '../engines/appleHealthStreamingImportEngine';
import type { AppleHealthXmlImportOptions } from '../engines/appleHealthXmlImportEngine';

type WorkerParseMessage = {
  type: 'parse';
  file: File | Blob;
  fileName?: string;
  options?: AppleHealthXmlImportOptions;
};

type WorkerCancelMessage = {
  type: 'cancel';
};

let controller: AbortController | null = null;

const postProgress = (progress: AppleHealthStreamingImportProgress) => {
  self.postMessage({ type: 'progress', progress });
};

self.onmessage = async (event: MessageEvent<WorkerParseMessage | WorkerCancelMessage>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    controller?.abort();
    self.postMessage({ type: 'cancelled' });
    return;
  }

  if (message.type !== 'parse') return;
  controller?.abort();
  controller = new AbortController();

  try {
    const result = await parseAppleHealthXmlStreaming(message.file, message.fileName || 'export.xml', {
      ...(message.options || {}),
      signal: controller.signal,
      onProgress: postProgress,
    });
    self.postMessage({ type: 'done', result });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      self.postMessage({ type: 'cancelled' });
      return;
    }
    self.postMessage({ type: 'error', message: (error as Error)?.message || 'Apple Health XML 解析失败。' });
  } finally {
    controller = null;
  }
};

export {};
