import type { GenerateResult, PuzzleRequest } from '../core/puzzle/generatePuzzle.ts';
import type { GenerateMessage, WorkerResponse } from './protocol.ts';

interface Pending {
  resolve: (result: GenerateResult) => void;
  reject: (error: Error) => void;
}

export class GeneratorClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.type === 'result') pending.resolve(message.result);
      else pending.reject(new Error(message.message));
    });
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Ошибка в генераторе');
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      this.terminate();
    });
    this.worker = worker;
    return worker;
  }

  generate(request: PuzzleRequest): Promise<GenerateResult> {
    const id = this.nextId;
    this.nextId += 1;
    const message: GenerateMessage = { type: 'generate', id, request };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ensureWorker().postMessage(message);
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
