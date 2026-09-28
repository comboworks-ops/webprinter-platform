import type { ReactNode } from "react";

export interface ProductCalculatorLayoutSlots {
  design: number;
  intro: ReactNode;
  media?: ReactNode;
  extras?: ReactNode;
  summary: ReactNode;
}

/** Shared presentation only: keep the existing selectors, prices and handlers. */
export function ProductCalculatorLayout({
  design, intro, media, controls, matrix, extras, summary,
}: ProductCalculatorLayoutSlots & { controls: ReactNode; matrix: ReactNode }) {
  return (
    <div className="order-calculator-layout product-calculator-layout" data-calculator-design={design} data-product-gallery={media ? "true" : undefined}>
      <div className="order-calculator-left">
        <div className="order-calculator-product">{media && design === 2 ? media : <>{intro}{media}</>}</div>
        <div className="order-calculator-matrix">{matrix}</div>
      </div>
      <div className="order-calculator-right">
        {media && design === 2 && intro}
        <div className="order-calculator-controls">{controls}</div>
        <div className="order-calculator-extras">{extras}</div>
        <aside className="order-calculator-summary" aria-label="Din bestilling">{summary}</aside>
      </div>
    </div>
  );
}
