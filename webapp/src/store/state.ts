import { Invertible } from "./actions";

export type Clef = "g" | "f" | "percussion";
export interface Pitch {
  /// Note value for a white key.
  base: number;
  /// Difference between actual and base.
  modifier: number;
}

export interface Signature {
  ts: [number, number];
  ks: number;
  clef: Clef;
}

export interface Global {
  title: string;
  author: string;
  signatures: [Signature, ...Array<Partial<Signature> | undefined>];
  pickupSkip: [number, number] | undefined;
}

export type TiedNote = Array<{
  noteValue: number;
  dots: number;
  startTime: [number, number];
}>;

export interface Note {
  startTime: [number, number];
  divisions: TiedNote;
  pitch: Pitch;
}

export interface Bar {
  barline: "normal" | "final";
  notes: Array<Note>;
}

export interface Part {
  bars: Array<Bar>;
}

export interface Song {
  v: 2;
  global: Global;
  part: Part;
}

export interface State {
  song: Song;
  numChanges: number;
  cursorBarIdx: number;
  cursorTime: [number, number];
  undoStack: Array<Invertible>;
  redoStack: Array<Invertible>;
}
