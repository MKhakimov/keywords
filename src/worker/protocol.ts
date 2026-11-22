import type { GenerateResult, PuzzleRequest } from '../core/puzzle/generatePuzzle.ts';

export interface GenerateMessage {
  readonly type: 'generate';
  readonly id: number;
  readonly request: PuzzleRequest;
}

export type WorkerResponse =
  | { readonly type: 'result'; readonly id: number; readonly result: GenerateResult }
  | { readonly type: 'error'; readonly id: number; readonly message: string };
