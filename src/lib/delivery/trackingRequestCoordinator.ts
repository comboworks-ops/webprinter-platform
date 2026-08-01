export type TrackingViewToken = Readonly<{
  orderId: string;
  viewGeneration: number;
}>;

export type TrackingRequestToken = TrackingViewToken & Readonly<{
  requestGeneration: number;
}>;

export class TrackingRequestCoordinator {
  private activeOrderId: string | null = null;
  private viewGeneration = 0;
  private requestGeneration = 0;

  open(orderId: string): TrackingViewToken {
    this.requireOrderId(orderId);
    this.activeOrderId = orderId;
    this.viewGeneration += 1;
    this.requestGeneration += 1;
    return this.captureView(orderId);
  }

  close(): void {
    this.activeOrderId = null;
    this.viewGeneration += 1;
    this.requestGeneration += 1;
  }

  captureView(orderId: string): TrackingViewToken {
    this.requireActiveOrder(orderId);
    return Object.freeze({ orderId, viewGeneration: this.viewGeneration });
  }

  beginRequest(orderId: string): TrackingRequestToken {
    this.requireActiveOrder(orderId);
    this.requestGeneration += 1;
    return Object.freeze({
      orderId,
      viewGeneration: this.viewGeneration,
      requestGeneration: this.requestGeneration,
    });
  }

  isCurrentView(token: TrackingViewToken): boolean {
    return this.activeOrderId === token.orderId &&
      this.viewGeneration === token.viewGeneration;
  }

  isCurrentRequest(token: TrackingRequestToken): boolean {
    return this.isCurrentView(token) &&
      this.requestGeneration === token.requestGeneration;
  }

  private requireActiveOrder(orderId: string): void {
    this.requireOrderId(orderId);
    if (this.activeOrderId !== orderId) {
      throw new Error("tracking order is not active");
    }
  }

  private requireOrderId(orderId: string): void {
    if (typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new Error("tracking order ID is required");
    }
  }
}
