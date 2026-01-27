# Price Generator - Working Reference (2026-01-14)

This document captures the working state of the price generator logic in `ProductAttributeBuilder.tsx`.
Use this as a reference if the price generator behavior needs to be restored.

---

## Core Concepts

### Blue Checkboxes (isLocked)
- **Purpose**: Define anchor points for interpolation
- **When checked**: The price becomes an anchor point
- **When unchecked**: The price is a manual value that doesn't affect interpolation

### Lock Icon (excludeFromCurve)
- **Purpose**: Mark individual overrides that shouldn't affect interpolation
- **Appears when**: Adjusting the slider on a value BETWEEN two anchors
- **Effect**: The value is locked but excluded from the interpolation curve

### Interpolation
- **Only works** when there are 2+ anchor points (blue checkboxes)
- **Only affects** quantities STRICTLY BETWEEN two anchors
- **Does NOT affect** quantities before first anchor or after last anchor

---

## Key Functions

### 1. getAnchorsForContext (Line ~843)
Returns anchor points for interpolation. Only includes points that are:
- `isLocked: true` (blue checkbox checked)
- `excludeFromCurve: false` (not an individual override)
- `price > 0` (has a valid price)

```typescript
const getAnchorsForContext = (formatId: string, materialId: string) => {
    return selectedOplag
        .filter(qty => {
            const key = getGenPriceKey(formatId, materialId, qty);
            const data = generatorPrices[key];
            return data?.isLocked && !data?.excludeFromCurve && data?.price != null && data?.price > 0;
        })
        .map(qty => {
            const key = getGenPriceKey(formatId, materialId, qty);
            const data = generatorPrices[key] || { price: 0, markup: 0 };
            return {
                quantity: qty,
                price: data.price || 0,
                markup: data.markup || 0
            };
        })
        .sort((a, b) => a.quantity - b.quantity);
};
```

### 2. Interpolation Calculation (Line ~2230)
Only calculates interpolated price when quantity is BETWEEN two anchors:

```typescript
let interpolatedPrice: number | null = null;
let isBetweenAnchors = false;
if (!isLocked) {
    try {
        const anchors = getAnchorsForContext(activeGenFormat, activeGenMaterial);
        if (anchors.length >= 2) {
            // Check if this qty is BETWEEN two anchors (not outside the range)
            const beforeAnchor = anchors.filter(a => a.quantity < qty).pop();
            const afterAnchor = anchors.find(a => a.quantity > qty);
            isBetweenAnchors = !!(beforeAnchor && afterAnchor);
            
            if (isBetweenAnchors) {
                let price = interpolatePrice(qty, anchors);
                rawInterpolatedBase = price;
                price = price * (1 + localMarkup / 100);
                price = price * (1 + prodMarkup / 100);
                const rnd = Number(genRounding) || 1;
                interpolatedPrice = Math.round(price / rnd) * rnd;
            }
        }
    } catch (e) { }
}
```

### 3. Input Value Logic (Line ~2294)
Determines what to show in the price input field:

```typescript
value={
    // If locked (anchor) or excluded (individual override), show manual value
    (isLocked || anchorData.excludeFromCurve) && anchorData.price
        ? Math.round(anchorData.price * (1 + (anchorData.markup || 0) / 100) * (1 + prodMarkup / 100))
        // If there's an interpolated value, show that instead
        : interpolatedPrice
            ? interpolatedPrice
            // Otherwise show manual value if exists, or empty
            : anchorData.price
                ? Math.round(anchorData.price * (1 + (anchorData.markup || 0) / 100) * (1 + prodMarkup / 100))
                : ''
}
```

### 4. Slider Logic (Line ~2318)
How the individual percentage slider behaves:

```typescript
onValueChange={([v]) => {
    const updates: any = { markup: v };
    
    // Check if this point is between two anchors (has interpolated value)
    const anchors = getAnchorsForContext(activeGenFormat, activeGenMaterial);
    const beforeAnchor = anchors.filter(a => a.quantity < qty).pop();
    const afterAnchor = anchors.find(a => a.quantity > qty);
    const isBetweenAnchors = beforeAnchor && afterAnchor;
    
    if (!isLocked && v !== 0 && isBetweenAnchors) {
        // Overriding an interpolated value - lock it and exclude from curve
        updates.isLocked = true;
        updates.excludeFromCurve = true;
        updates.price = rawInterpolatedBase;
    } else if (isLocked && v === 0 && anchorData.excludeFromCurve) {
        // Resetting a locked override back to interpolated
        updates.isLocked = false;
        updates.excludeFromCurve = false;
        updates.price = 0;
    }
    // Otherwise just update the markup without changing lock state
    setAnchorData(qty, updates);
}}
```

### 5. Manual Input onChange (Line ~2308)
When user manually types a price:

```typescript
onChange={(e) => {
    const finalPrice = parseFloat(e.target.value) || 0;
    const localMarkup = anchorData.markup || 0;
    const prodMarkup = productMarkups[`${activeGenFormat}-${activeGenMaterial}`] || 0;
    // Reverse-calculate base price from final price
    const totalMultiplier = (1 + localMarkup / 100) * (1 + prodMarkup / 100);
    const basePrice = totalMultiplier !== 0 ? finalPrice / totalMultiplier : 0;
    setAnchorData(qty, { price: basePrice, markup: localMarkup, excludeFromCurve: false, isLocked: false });
}}
```

---

## CSV Import (handleApplyImportedPrices)
Imported prices are stored as manual values (unlocked):

```typescript
newPrices[key] = {
    price: price,           // Parsed number from CSV
    markup: 0,              // No markup
    isLocked: false,        // Not an anchor (blue button off)
    excludeFromCurve: false // Not excluded
};
```

---

## Behavior Summary

| Scenario | Blue Button | Lock Icon | Value Shown | Affects Interpolation |
|----------|-------------|-----------|-------------|----------------------|
| Empty field | ❌ | ❌ | Placeholder or empty | No |
| Manual value | ❌ | ❌ | Your value | No |
| Anchor point | ✅ | ❌ | Your value | Yes (defines curve) |
| Between anchors | ❌ | ❌ | Interpolated value | N/A (receives interpolation) |
| Individual override | ✅ | ✅ | Your value | No (excluded from curve) |
| Outside anchor range | ❌ | ❌ | Your value | No |

---

*Last updated: 2026-01-14 02:21*
