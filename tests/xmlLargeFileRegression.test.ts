import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseAppleHealthXmlStreaming } from '../src/engines/appleHealthStreamingImportEngine';

const makeXml = (body: string) => `<?xml version="1.0"?><HealthData>${body}</HealthData>`;

describe('large Apple Health XML regression', () => {
  it('keeps only the selected recent date range from a large mixed XML', async () => {
    const oldRecords = Array.from({ length: 500 }, (_, index) =>
      `<Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2024-01-${String((index % 28) + 1).padStart(2, '0')} 10:00:00 +0000" endDate="2024-01-${String((index % 28) + 1).padStart(2, '0')} 10:05:00 +0000" value="${1000 + index}"/>`
    ).join('');
    const recentRecords = `
      <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:05:00 +0000" value="3200"/>
      <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-04-21 07:00:00 +0000" endDate="2026-04-21 07:00:00 +0000" value="58"/>
    `;

    const result = await parseAppleHealthXmlStreaming(
      new Blob([makeXml(`${oldRecords}${recentRecords}`)], { type: 'text/xml' }),
      'export.xml',
      {
        fromDate: '2026-04-01T00:00:00.000Z',
        toDate: '2026-04-30T23:59:59.999Z',
        metricTypes: ['steps', 'resting_heart_rate'],
        chunkSize: 512,
      },
    );

    expect(result.summary.detectedRecordCount).toBe(502);
    expect(result.samples).toHaveLength(2);
    expect(result.samples.every((sample) => sample.startDate.startsWith('2026-04'))).toBe(true);
  });

  it('does not use DOMParser or full-file text reads in the streaming engine', async () => {
    const parseFromString = vi.fn();
    class FakeDomParser {
      parseFromString = parseFromString;
    }
    vi.stubGlobal('DOMParser', FakeDomParser);
    const result = await parseAppleHealthXmlStreaming(
      new Blob([makeXml('<Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:05:00 +0000" value="3200"/>')]),
      'export.xml',
      { chunkSize: 32 },
    );
    const source = readFileSync(resolve(process.cwd(), 'src/engines/appleHealthStreamingImportEngine.ts'), 'utf8');

    expect(result.samples).toHaveLength(1);
    expect(parseFromString).not.toHaveBeenCalled();
    expect(source).not.toContain('DOMParser');
    expect(source).not.toContain('parseFromString');
    expect(source).not.toContain('file.text(');
    vi.unstubAllGlobals();
  });

  it('does not preserve complete XML in result objects', async () => {
    const xml = makeXml('<Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-04-20 10:00:00 +0000" endDate="2026-04-20 10:05:00 +0000" value="3200"/>');
    const result = await parseAppleHealthXmlStreaming(new Blob([xml]), 'export.xml', { chunkSize: 40 });

    expect(JSON.stringify(result)).not.toContain(xml);
    expect(JSON.stringify(result.batch)).not.toContain('<HealthData');
  });
});
