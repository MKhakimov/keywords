import type { GenerateResult, PuzzleRequest } from '../core/puzzle/generatePuzzle.ts';
import type { Puzzle } from '../core/puzzle/types.ts';
import type { ValidationReport } from '../core/validate/report.ts';

export type WorkerRequest =
  | { readonly type: 'generate'; readonly id: number; readonly request: PuzzleRequest }
  | { readonly type: 'validate'; readonly id: number; readonly puzzle: Puzzle };

export type WorkerResponse =
  | { readonly type: 'result'; readonly id: number; readonly result: GenerateResult }
  | { readonly type: 'validated'; readonly id: number; readonly report: ValidationReport }
  | { readonly type: 'error'; readonly id: number; readonly message: string };
