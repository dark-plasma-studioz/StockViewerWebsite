import type { ExportData, Profile, Holding, Snapshot } from '../types';

const SCHEMA_VERSION = 2;
const SUPPORTED_VERSIONS = [1, 2];

export function buildExportData(
  profiles: Profile[],
  holdings: Holding[],
  snapshots: Snapshot[]
): ExportData {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles,
    holdings,
    snapshots,
  };
}

export function downloadJSON(data: ExportData): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `portfolio-backup-${dateStr}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportFile(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as unknown;
        const data = validateExportData(raw);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function validateExportData(raw: unknown): ExportData {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid backup file: not a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  if (!SUPPORTED_VERSIONS.includes(obj.schemaVersion as number)) {
    throw new Error(
      `Unsupported schema version: ${obj.schemaVersion}. Supported: ${SUPPORTED_VERSIONS.join(', ')}.`
    );
  }
  if (!Array.isArray(obj.profiles)) throw new Error('Invalid backup: missing profiles array');
  if (!Array.isArray(obj.holdings)) throw new Error('Invalid backup: missing holdings array');
  if (!Array.isArray(obj.snapshots)) throw new Error('Invalid backup: missing snapshots array');

  return obj as unknown as ExportData;
}
