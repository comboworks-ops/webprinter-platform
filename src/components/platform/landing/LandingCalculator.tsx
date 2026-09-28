import { useId, useState } from "react";
import { calculateLandingExample, LANDING_SAMPLE_MATERIALS } from "./landingCalculatorExample";
import "./LandingCalculator.css";

const amount = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const area = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 3 });

export function LandingCalculator() {
  const id = useId();
  const [width, setWidth] = useState("100");
  const [height, setHeight] = useState("100");
  const [quantity, setQuantity] = useState("1");
  const [material, setMaterial] = useState("banner");
  const { errors, value } = calculateLandingExample({ width, height, quantity, material });
  const longestSide = value ? Math.max(value.widthCm, value.heightCm) : 1;

  return (
    <div className="wp-calculator" aria-labelledby={`${id}-title`}>
      <div className="wp-calculator-heading">
        <span className="wp-calculator-kicker" id={`${id}-title`}>Storformat · eksempel</span>
        <span className="wp-calculator-category">Prøv selv</span>
      </div>

      <div className="wp-calculator-fields">
        <div className="wp-calculator-field">
          <label htmlFor={`${id}-material`}>Materiale</label>
          <select
            id={`${id}-material`}
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
          >
            {Object.entries(LANDING_SAMPLE_MATERIALS).map(([key, sample]) => (
              <option key={key} value={key}>{sample.name}</option>
            ))}
          </select>
        </div>
        <div className="wp-calculator-field">
          <label htmlFor={`${id}-width`}>Bredde (cm)</label>
          <input
            id={`${id}-width`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
            value={width}
            onChange={(event) => setWidth(event.target.value)}
            aria-invalid={!!errors.width}
            aria-describedby={`${id}-dimensions${errors.width ? ` ${id}-width-error` : ""}`}
          />
          {errors.width && <span className="wp-calculator-error" id={`${id}-width-error`}>{errors.width}</span>}
        </div>
        <div className="wp-calculator-field">
          <label htmlFor={`${id}-height`}>Højde (cm)</label>
          <input
            id={`${id}-height`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
            value={height}
            onChange={(event) => setHeight(event.target.value)}
            aria-invalid={!!errors.height}
            aria-describedby={`${id}-dimensions${errors.height ? ` ${id}-height-error` : ""}`}
          />
          {errors.height && <span className="wp-calculator-error" id={`${id}-height-error`}>{errors.height}</span>}
        </div>
        <div className="wp-calculator-field">
          <label htmlFor={`${id}-quantity`}>Antal</label>
          <select
            id={`${id}-quantity`}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          >
            {[1, 5, 10].map((count) => <option key={count} value={count}>{count} stk.</option>)}
          </select>
        </div>
      </div>
      <p className="wp-calculator-help" id={`${id}-dimensions`}>Mål i cm · op til 500 × 500 cm</p>

      <div className="wp-calculator-result">
        <div className="wp-calculator-total" aria-live="polite" aria-atomic="true">
          <span className="sr-only">Samlet eksempelpris: </span>
          <strong>
            {value ? `${amount.format(value.totalPrice)} kr.` : "—"}
          </strong>
          <p>{value
            ? `${value.quantity} stk. · ${area.format(value.totalAreaM2)} m² i alt`
            : "Udfyld gyldige mål for at se prisen."}</p>
        </div>
        <div className="wp-calculator-preview" aria-hidden="true">
          {value && (
            <div
              className="wp-calculator-sheet"
              style={{
                width: `${(value.widthCm / longestSide) * 100}%`,
                height: `${(value.heightCm / longestSide) * 100}%`,
              }}
            >
              <span>Dit tryk</span>
            </div>
          )}
        </div>
      </div>
      <span className="wp-calculator-tax">Eksempelpriser · ekskl. moms</span>
      <p className="wp-calculator-note">Dine egne priser og materialer sættes op i systemet.</p>
    </div>
  );
}
