export type Direction = 'across' | 'down';

export type CellKind = 'void' | 'block' | 'letter';

export interface Coord {
  readonly row: number;
  readonly col: number;
}

export interface Slot {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly dir: Direction;
  readonly length: number;
  readonly cells: readonly number[];
}

export interface GridShape {
  readonly width: number;
  readonly height: number;
}
