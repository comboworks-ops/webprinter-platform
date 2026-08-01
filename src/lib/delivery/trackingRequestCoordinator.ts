import { canonicalizePostNordTrackingNumber } from "./trackingEvents.ts";

export type TrackingViewToken = Readonly<{
  orderId: string;
  trackingIdentity: string | null;
  viewGeneration: number;
}>;

export type TrackingRequestToken = TrackingViewToken & Readonly<{
  requestGeneration: number;
}>;

export class TrackingRequestCoordinator {
  private activeOrderId: string | null = null;
  private activeTrackingIdentity: string | null = null;
  private viewGeneration = 0;
  private requestGeneration = 0;

  open(orderId: string, trackingNumber: string | null): TrackingViewToken {
    this.requireOrderId(orderId);
    const trackingIdentity = canonicalizePostNordTrackingNumber(trackingNumber);
    this.activeOrderId = orderId;
    this.activeTrackingIdentity = trackingIdentity;
    this.viewGeneration += 1;
    this.requestGeneration += 1;
    return this.captureView(orderId, trackingIdentity);
  }

  close(): void {
    this.activeOrderId = null;
    this.activeTrackingIdentity = null;
    this.viewGeneration += 1;
    this.requestGeneration += 1;
  }

  captureView(
    orderId: string,
    trackingNumber: string | null,
  ): TrackingViewToken {
    const trackingIdentity = this.requireActiveScope(orderId, trackingNumber);
    return Object.freeze({
      orderId,
      trackingIdentity,
      viewGeneration: this.viewGeneration,
    });
  }

  beginRequest(
    orderId: string,
    trackingNumber: string | null,
  ): TrackingRequestToken {
    const trackingIdentity = this.requireActiveScope(orderId, trackingNumber);
    this.requestGeneration += 1;
    return Object.freeze({
      orderId,
      trackingIdentity,
      viewGeneration: this.viewGeneration,
      requestGeneration: this.requestGeneration,
    });
  }

  isCurrentView(token: TrackingViewToken): boolean {
    return this.activeOrderId === token.orderId &&
      this.activeTrackingIdentity === token.trackingIdentity &&
      this.viewGeneration === token.viewGeneration;
  }

  isCurrentRequest(token: TrackingRequestToken): boolean {
    return this.isCurrentView(token) &&
      this.requestGeneration === token.requestGeneration;
  }

  private requireActiveScope(
    orderId: string,
    trackingNumber: string | null,
  ): string | null {
    this.requireOrderId(orderId);
    const trackingIdentity = canonicalizePostNordTrackingNumber(trackingNumber);
    if (
      this.activeOrderId !== orderId ||
      this.activeTrackingIdentity !== trackingIdentity
    ) {
      throw new Error("tracking order scope is not active");
    }
    return trackingIdentity;
  }

  private requireOrderId(orderId: string): void {
    if (typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new Error("tracking order ID is required");
    }
  }
}
