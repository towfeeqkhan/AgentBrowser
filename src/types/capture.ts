export type CaptureRequest = { type: "CAPTURE_AX_TREE" };

export type CaptureResponse =
  | { ok: true; context: SerializedNode[]; screenshot?: string }
  | { ok: false; error: string };

export type CleanNode = {
  id: string;
  role?: string;
  name?: string;
  kind: "interactive" | "landmark" | "text";
  parentId?: string;
  state?: string;
  value?: string;
  boundingBox?: BoundingBox;
  childIds?: string[];
  children?: CleanNode[];
};

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SerializedNode = {
  id: string;
  role?: string;
  name?: string;
  box: [number, number, number, number];
  center: [number, number];
  state?: string;
  context?: string;
  value?: string;
};
