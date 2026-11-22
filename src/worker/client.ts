import type { GenerateResult, PuzzleRequest } from '../core/puzzle/generatePuzzle.ts';
import type { Puzzle } from '../core/puzzle/types.ts';
import type { ValidationReport } from '../core/validate/report.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

type Settled = Exclude<WorkerResponse, { type: 'error' }>;

interface Pending {
  resolve: (response: Settled) => void;
  reject: (error: Error) => void;
}

type RequestBody = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never;

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
      if (message.type === 'error') pending.reject(new Error(message.message));
      else pending.resolve(message);
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

  private send(body: RequestBody): Promise<Settled> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ensureWorker().postMessage({ ...body, id } as WorkerRequest);
    });
  }

  async generate(request: PuzzleRequest): Promise<GenerateResult> {
    const response = await this.send({ type: 'generate', request });
    if (response.type !== 'result') throw new Error('Неожиданный ответ генератора');
    return response.result;
  }

  async validate(puzzle: Puzzle): Promise<ValidationReport> {
    const response = await this.send({ type: 'validate', puzzle });
    if (response.type !== 'validated') throw new Error('Неожиданный ответ генератора');
    return response.report;
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
