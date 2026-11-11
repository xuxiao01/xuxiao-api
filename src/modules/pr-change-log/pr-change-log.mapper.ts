import type { PrChangeLog, PrChangeLogFile } from '../../generated/client';

export const listSelect = {
  id: true, repository: true, prNumber: true, title: true, author: true, url: true,
  prCreatedAt: true, headSha: true, fileCount: true, filesComplete: true,
  changeType: true, changeSummary: true, analysisStatus: true, analysisPartial: true, updatedAt: true,
} as const;

type ListRecord = Pick<PrChangeLog, keyof typeof listSelect>;

export function recordDto(record: ListRecord) {
  return {
    id: record.id, repository: record.repository, number: record.prNumber,
    title: record.title, author: record.author, url: record.url,
    createdAt: record.prCreatedAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    sha: record.headSha, headSha: record.headSha, fileCount: record.fileCount,
    filesComplete: record.filesComplete, changeType: record.changeType,
    changeSummary: record.changeSummary, analysisStatus: record.analysisStatus,
    analysisCoverage: record.analysisStatus === 'succeeded' ? (record.analysisPartial ? 'partial' : 'full') : null,
  };
}

export function fileDto(file: PrChangeLogFile) {
  return {
    path: file.path, previousPath: file.previousPath, status: file.status,
    additions: file.additions, deletions: file.deletions, patch: file.patch,
    patchStatus: file.patchStatus, patchTruncated: file.patchStatus === 'truncated',
    binary: file.patchStatus === 'binary', url: file.url,
  };
}
