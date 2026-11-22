import { useCallback, useEffect, useRef, useState } from 'react';
import type { PuzzleRequest } from '../../core/puzzle/generatePuzzle.ts';
import type { Puzzle } from '../../core/puzzle/types.ts';
import type { ValidationReport } from '../../core/validate/report.ts';
import { GeneratorClient } from '../../worker/client.ts';

export type GeneratorState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly puzzle: Puzzle; readonly elapsedMs: number }
  | { readonly status: 'error'; readonly message: string };

export function usePuzzleGenerator() {
  const clientRef = useRef<GeneratorClient | null>(null);
  const [state, setState] = useState<GeneratorState>({ status: 'idle' });

  useEffect(() => () => clientRef.current?.terminate(), []);

  const generate = useCallback(async (request: PuzzleRequest): Promise<Puzzle | null> => {
    clientRef.current ??= new GeneratorClient();
    setState({ status: 'loading' });
    const started = performance.now();
    try {
      const result = await clientRef.current.generate(request);
      if (result.status === 'ok') {
        setState({ status: 'ready', puzzle: result.puzzle, elapsedMs: performance.now() - started });
        return result.puzzle;
      }
      setState({ status: 'error', message: result.reason });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
    return null;
  }, []);

  const validate = useCallback((puzzle: Puzzle): Promise<ValidationReport> => {
    clientRef.current ??= new GeneratorClient();
    return clientRef.current.validate(puzzle);
  }, []);

  return { state, generate, validate };
}
