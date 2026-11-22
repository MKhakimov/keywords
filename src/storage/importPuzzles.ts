import type { Puzzle } from '../core/puzzle/types.ts';
import type { ValidationReport } from '../core/validate/report.ts';
import type { ExportItem, RejectedItem } from './exchange.ts';
import { parseExport } from './exchange.ts';

export interface ImportDeps {
  readonly alphabetId: string;
  readonly validate: (puzzle: Puzzle) => Promise<ValidationReport>;
  readonly store: (item: ExportItem) => Promise<'added' | 'exists'>;
}

export interface ImportReport {
  readonly added: readonly string[];
  readonly skipped: readonly string[];
  readonly rejected: readonly RejectedItem[];
}

const headingOf = (puzzle: Puzzle) => `«${puzzle.editorial.heading || puzzle.meta.title || puzzle.meta.id}»`;

export async function importPuzzles(text: string, deps: ImportDeps): Promise<ImportReport> {
  const parsed = parseExport(text, deps.alphabetId);
  const added: string[] = [];
  const skipped: string[] = [];
  const rejected: RejectedItem[] = [...parsed.rejected];

  for (const item of parsed.items) {
    const label = headingOf(item.puzzle);
    let report: ValidationReport;
    try {
      report = await deps.validate(item.puzzle);
    } catch (error) {
      rejected.push({ label, reason: `проверка не выполнена: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }
    if (!report.valid) {
      const reasons = report.issues.map((issue) => issue.message);
      const failed = report.checks.filter((c) => c.status !== 'passed').map((c) => c.title);
      rejected.push({ label, reason: `не прошла проверку: ${(reasons.length ? reasons : failed).slice(0, 3).join('; ')}` });
      continue;
    }
    const result = await deps.store({ ...item, puzzle: { ...item.puzzle, validation: report } });
    (result === 'added' ? added : skipped).push(label);
  }

  return { added, skipped, rejected };
}
