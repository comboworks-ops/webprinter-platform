export interface ProofingWorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[] | StructuredSerializeOptions): void;
}
