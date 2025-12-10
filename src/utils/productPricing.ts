// Product pricing data and calculation utilities

export const flyerPrices = {
  "A6": {
    "135g": { 50: 150, 100: 160, 250: 189, 500: 234, 1000: 317, 1500: 364, 2000: 439, 2500: 404, 3000: 463, 4000: 688, 5000: 786, 10000: 986, 15000: 1644 },
    "170g": { 50: 151, 100: 161, 250: 193, 500: 238, 1000: 323, 1500: 372, 2000: 451, 2500: 415, 3000: 476, 4000: 709, 5000: 812, 10000: 1561, 15000: 1763 },
    "250g": { 50: 153, 100: 164, 250: 198, 500: 245, 1000: 338, 1500: 391, 2000: 474, 2500: 437, 3000: 627, 4000: 750, 5000: 862, 10000: 1726, 15000: 2001 }
  },
  "M65": {
    "135g": { 50: 153, 100: 166, 250: 207, 500: 263, 1000: 374, 1500: 442, 2000: 426, 2500: 625, 3000: 692, 4000: 509, 5000: 914, 10000: 1593, 15000: 1816 },
    "170g": { 50: 154, 100: 168, 250: 210, 500: 267, 1000: 384, 1500: 454, 2000: 438, 2500: 644, 3000: 713, 4000: 851, 5000: 953, 10000: 1701, 15000: 1973 },
    "250g": { 50: 157, 100: 173, 250: 216, 500: 277, 1000: 402, 1500: 477, 2000: 462, 2500: 679, 3000: 755, 4000: 906, 5000: 1545, 10000: 1917, 15000: 2288 }
  },
  "A5": {
    "135g": { 50: 160, 100: 179, 250: 234, 500: 317, 1000: 483, 1500: 579, 2000: 688, 2500: 786, 3000: 884, 4000: 942, 5000: 986, 10000: 1810, 15000: 2140 },
    "170g": { 50: 161, 100: 182, 250: 238, 500: 323, 1000: 496, 1500: 476, 2000: 709, 2500: 812, 3000: 914, 4000: 987, 5000: 1561, 10000: 1965, 15000: 2369 },
    "250g": { 50: 164, 100: 186, 250: 245, 500: 338, 1000: 521, 1500: 627, 2000: 750, 2500: 862, 3000: 975, 4000: 1616, 5000: 1726, 10000: 2277, 15000: 3017 }
  },
  "A4": {
    "135g": { 50: 179, 100: 217, 250: 317, 500: 483, 1000: 757, 1500: 884, 2000: 942, 2500: 986, 3000: 1545, 4000: 1677, 5000: 1810, 10000: 2471, 15000: 3342 },
    "170g": { 50: 182, 100: 220, 250: 323, 500: 496, 1000: 780, 1500: 914, 2000: 987, 2500: 1561, 3000: 1642, 4000: 1804, 5000: 1965, 10000: 2959, 15000: 3822 },
    "250g": { 50: 186, 100: 228, 250: 338, 500: 521, 1000: 825, 1500: 975, 2000: 1616, 2500: 1726, 3000: 1836, 4000: 2057, 5000: 2277, 10000: 3605, 15000: 4781 }
  },
  "A3": {
    "135g": { 50: 217, 100: 284, 250: 483, 500: 757, 1000: 1036, 1500: 1030, 2000: 1118, 2500: 1207, 3000: 1942, 4000: 2207, 5000: 2471, 10000: 4048, 15000: 5460 },
    "170g": { 50: 220, 100: 289, 250: 496, 500: 780, 1000: 1086, 1500: 1642, 2000: 1804, 2500: 1965, 3000: 2127, 4000: 2450, 5000: 2959, 10000: 4684, 15000: 6382 },
    "250g": { 50: 228, 100: 301, 250: 521, 500: 825, 1000: 1616, 1500: 1836, 2000: 2057, 2500: 2277, 3000: 2664, 4000: 3134, 5000: 3605, 10000: 5931, 15000: 8223 }
  }
};

export const folderPrices: Record<string, Record<string, Record<string, Record<number, number>>>> = {
  "A5": {
    "135g": {
      "Midterfalset": { 50: 216, 100: 304, 250: 570, 500: 552, 1000: 1513, 1500: 1459, 2000: 1670, 2500: 1770, 3000: 1194, 4000: 1156, 5000: 1353, 6000: 1473, 7000: 1591, 8000: 1223, 9000: 1309, 10000: 1394, 15000: 1020 },
      "Rullefalset": { 50: 293, 100: 459, 250: 718, 500: 933, 1000: 1501, 1500: 1889, 2000: 2206, 2500: 2383, 3000: 1634, 4000: 1328, 5000: 1489, 6000: 1650, 7000: 1811, 8000: 1793, 9000: 1494, 10000: 1606, 15000: 1578 },
      "Zigzag": { 50: 293, 100: 459, 250: 718, 500: 933, 1000: 1501, 1500: 1889, 2000: 2206, 2500: 2383, 3000: 1634, 4000: 1328, 5000: 1489, 6000: 1650, 7000: 1811, 8000: 1793, 9000: 1494, 10000: 1606, 15000: 1578 }
    },
    "170g": {
      "Midterfalset": { 50: 217, 100: 308, 250: 578, 500: 702, 1000: 1545, 1500: 1505, 2000: 1730, 2500: 1847, 3000: 1249, 4000: 1300, 5000: 1435, 6000: 1571, 7000: 1706, 8000: 1314, 9000: 1423, 10000: 1507, 15000: 1113 },
      "Rullefalset": { 50: 298, 100: 467, 250: 732, 500: 952, 1000: 1541, 1500: 1962, 2000: 2313, 2500: 2507, 3000: 1726, 4000: 1414, 5000: 1597, 6000: 1777, 7000: 1959, 8000: 1945, 9000: 1625, 10000: 1751, 15000: 1732 },
      "Zigzag": { 50: 298, 100: 467, 250: 732, 500: 952, 1000: 1541, 1500: 1962, 2000: 2313, 2500: 2507, 3000: 1726, 4000: 1414, 5000: 1597, 6000: 1777, 7000: 1959, 8000: 1945, 9000: 1625, 10000: 1751, 15000: 1732 }
    },
    "250g": {
      "Midterfalset": { 50: 355, 100: 458, 250: 763, 500: 791, 1000: 1148, 1500: 1636, 2000: 2082, 2500: 2275, 3000: 1573, 4000: 1300, 5000: 1475, 6000: 1650, 7000: 1827, 8000: 1820, 9000: 1526, 10000: 1648, 15000: 1645 },
      "Rullefalset": { 50: 439, 100: 622, 250: 1108, 500: 935, 1000: 1686, 1500: 2371, 2000: 2857, 2500: 2876, 3000: 2014, 4000: 1693, 5000: 1947, 6000: 2200, 7000: 2455, 8000: 2710, 9000: 2077, 10000: 2249, 15000: 2501 },
      "Zigzag": { 50: 439, 100: 622, 250: 1108, 500: 935, 1000: 1686, 1500: 2371, 2000: 2857, 2500: 2876, 3000: 2014, 4000: 1693, 5000: 1947, 6000: 2200, 7000: 2455, 8000: 2710, 9000: 2077, 10000: 2249, 15000: 2501 }
    }
  },
  "M65": {
    "135g": {
      "Midterfalset": { 50: 194, 100: 274, 250: 513, 500: 497, 1000: 1361, 1500: 1314, 2000: 1504, 2500: 1593, 3000: 1074, 4000: 1040, 5000: 1218, 6000: 1325, 7000: 1433, 8000: 1100, 9000: 1178, 10000: 1254, 15000: 918 },
      "Rullefalset": { 50: 263, 100: 413, 250: 647, 500: 839, 1000: 1350, 1500: 1701, 2000: 1988, 2500: 2146, 3000: 1470, 4000: 1195, 5000: 1340, 6000: 1485, 7000: 1630, 8000: 1614, 9000: 1344, 10000: 1445, 15000: 1420 },
      "Zigzag": { 50: 263, 100: 413, 250: 647, 500: 839, 1000: 1350, 1500: 1701, 2000: 1988, 2500: 2146, 3000: 1470, 4000: 1195, 5000: 1340, 6000: 1485, 7000: 1630, 8000: 1614, 9000: 1344, 10000: 1445, 15000: 1420 }
    },
    "170g": {
      "Midterfalset": { 50: 196, 100: 277, 250: 520, 500: 632, 1000: 1391, 1500: 1355, 2000: 1558, 2500: 1662, 3000: 1124, 4000: 1170, 5000: 1291, 6000: 1413, 7000: 1534, 8000: 1183, 9000: 1270, 10000: 1357, 15000: 1002 },
      "Rullefalset": { 50: 269, 100: 420, 250: 659, 500: 858, 1000: 1386, 1500: 1764, 2000: 2082, 2500: 2255, 3000: 1553, 4000: 1273, 5000: 1436, 6000: 1599, 7000: 1764, 8000: 1751, 9000: 1463, 10000: 1577, 15000: 1559 },
      "Zigzag": { 50: 269, 100: 420, 250: 659, 500: 858, 1000: 1386, 1500: 1764, 2000: 2082, 2500: 2255, 3000: 1553, 4000: 1273, 5000: 1436, 6000: 1599, 7000: 1764, 8000: 1751, 9000: 1463, 10000: 1577, 15000: 1559 },
    },
    "250g": {
      "Midterfalset": { 50: 320, 100: 412, 250: 687, 500: 712, 1000: 1314, 1500: 1474, 2000: 1873, 2500: 2048, 3000: 1415, 4000: 1170, 5000: 1328, 6000: 1485, 7000: 1644, 8000: 1639, 9000: 1372, 10000: 1483, 15000: 1480 },
      "Rullefalset": { 50: 396, 100: 560, 250: 998, 500: 841, 1000: 1518, 1500: 2134, 2000: 2572, 2500: 2848, 3000: 1991, 4000: 1525, 5000: 1753, 6000: 1980, 7000: 2209, 8000: 2438, 9000: 1865, 10000: 2024, 15000: 2251 },
      "Zigzag": { 50: 396, 100: 560, 250: 998, 500: 841, 1000: 1518, 1500: 2134, 2000: 2572, 2500: 2848, 3000: 1991, 4000: 1525, 5000: 1753, 6000: 1980, 7000: 2209, 8000: 2438, 9000: 1865, 10000: 2024, 15000: 2251 }
    }
  },
  "A4": {
    "135g": {
      "Midterfalset": { 50: 304, 100: 482, 250: 745, 500: 968, 1000: 1570, 1500: 1917, 2000: 2250, 2500: 2439, 3000: 1675, 4000: 1368, 5000: 1538, 6000: 1709, 7000: 1879, 8000: 1864, 9000: 1555, 10000: 1675, 15000: 1653 },
      "Rullefalset": { 50: 493, 100: 666, 250: 1331, 500: 898, 1000: 2131, 1500: 2811, 2000: 3377, 2500: 3723, 3000: 2597, 4000: 2174, 5000: 2494 },
      "Zigzag": { 50: 493, 100: 666, 250: 1331, 500: 898, 1000: 2131, 1500: 2811, 2000: 3377, 2500: 3723, 3000: 2597, 4000: 2174, 5000: 2494 }
    },
    "170g": {
      "Midterfalset": { 50: 308, 100: 487, 250: 948, 500: 989, 1000: 1613, 1500: 1994, 2000: 2356, 2500: 2568, 3000: 1772, 4000: 1459, 5000: 1651, 6000: 1845, 7000: 2036, 8000: 2025, 9000: 1694, 10000: 1829, 15000: 1817 },
      "Rullefalset": { 50: 500, 100: 676, 250: 1361, 500: 922, 1000: 2218, 1500: 2951, 2000: 3573, 2500: 3963, 3000: 2779, 4000: 2344, 5000: 2704 },
      "Zigzag": { 50: 500, 100: 676, 250: 1361, 500: 922, 1000: 2218, 1500: 2951, 2000: 3573, 2500: 3963, 3000: 2779, 4000: 2344, 5000: 2704 }
    },
    "250g": {
      "Midterfalset": { 50: 448, 100: 644, 250: 1145, 500: 935, 1000: 1756, 1500: 2411, 2000: 2915, 2500: 2944, 3000: 2065, 4000: 1741, 5000: 2010, 6000: 2279, 7000: 2544, 8000: 2808, 9000: 2152, 10000: 2333, 15000: 2603 },
      "Rullefalset": { 50: 566, 100: 883, 250: 2269, 500: 2896, 1000: 7285, 1500: 9933, 2000: 12225, 2500: 13765, 3000: 9761, 4000: 11722, 5000: 13658 },
      "Zigzag": { 50: 566, 100: 883, 250: 2269, 500: 2896, 1000: 7285, 1500: 9933, 2000: 12225, 2500: 13765, 3000: 9761, 4000: 11722, 5000: 13658 }
    }
  }
};

export const visitkortPrices: Record<string, Record<number, number>> = {
  "350g": { 100: 295, 250: 395, 500: 525, 1000: 645, 2500: 995, 5000: 1495 },
  "300g": { 100: 275, 250: 355, 500: 485, 1000: 595, 2500: 945, 5000: 1395 }
};

// Additional pricing data for other products
export const posterRate: Record<string, number> = { 
  "135g": 110, "170g": 125, "250g": 150, "115g": 165 
};

export const stickerRate: Record<string, number> = { 
  "Vinyl": 0.045, "Plast": 0.040, "Papir": 0.030 
};

export const bannerRate: Record<string, number> = { 
  "PVC": 165, "Mesh": 155, "Tekstil": 180 
};

export const beachflagBase: Record<string, number> = { 
  "Lille": 895, "Mellem": 1295 
};

export const signRate: Record<string, number> = { 
  "PVC3": 250, "PVC5": 295, "Bølgeplast": 220, "Dibond": 395 
};

export const flyerFormatFactor: Record<string, number> = {
  "A6": 1.00, "M65": 1.10, "A5": 1.15, "A4": 1.25, "A3": 1.50
};

// Delivery fee calculation
export function deliveryFee(price: number, type: string): number {
  if (!type || type === "") return 0;
  const lowerType = type.toLowerCase();
  if (lowerType === "standard") return price < 2000 ? 49 : 129;
  if (lowerType === "express" || lowerType === "ekspres") return price < 2000 ? 199 : 399;
  if (lowerType === "superekspres") return 499;
  return 0;
}

export type MatrixCell = {
  row: string;
  column: number;
  price: number;
};

export type MatrixData = {
  rows: string[];
  columns: number[];
  cells: Record<string, Record<number, number>>;
};

// Get matrix data for flyers
export function getFlyerMatrixData(format: string): MatrixData {
  const data = flyerPrices[format as keyof typeof flyerPrices];
  if (!data) {
    return { rows: [], columns: [], cells: {} };
  }

  const rows = Object.keys(data).map(weight => `${weight} Silk`);
  const columns = Object.keys(data["135g"]).map(Number).sort((a, b) => a - b);
  const cells: Record<string, Record<number, number>> = {};

  Object.entries(data).forEach(([weight, prices]) => {
    const rowKey = `${weight} Silk`;
    cells[rowKey] = prices;
  });

  return { rows, columns, cells };
}

// Get matrix data for foldere
export function getFolderMatrixData(format: string, foldType: string): MatrixData {
  const formatData = folderPrices[format];
  if (!formatData) {
    return { rows: [], columns: [], cells: {} };
  }

  const rows = Object.keys(formatData).map(weight => `${weight} Silk`);
  const firstWeight = Object.keys(formatData)[0];
  const foldData = formatData[firstWeight][foldType];
  
  const columns = Object.keys(foldData).map(Number).sort((a, b) => a - b);

  const cells: Record<string, Record<number, number>> = {};

  Object.entries(formatData).forEach(([weight, folds]) => {
    const rowKey = `${weight} Silk`;
    cells[rowKey] = folds[foldType];
  });

  return { rows, columns, cells };
}

// Get matrix data for visitkort
export function getVisitkortMatrixData(): MatrixData {
  const rows = Object.keys(visitkortPrices).map(weight => `${weight} Silk`);
  const columns = Object.keys(visitkortPrices["350g"]).map(Number).sort((a, b) => a - b);
  const cells: Record<string, Record<number, number>> = {};

  Object.entries(visitkortPrices).forEach(([weight, prices]) => {
    const rowKey = `${weight} Silk`;
    cells[rowKey] = prices;
  });

  return { rows, columns, cells };
}

// Calculation functions for different product types
export function calcPosterPrice(format: string, paper: string, qty: number): number {
  const sizes: Record<string, { width: number; height: number }> = {
    "A3": { width: 29.7, height: 42 },
    "A2": { width: 42, height: 59.4 },
    "A1": { width: 59.4, height: 84.1 },
    "A0": { width: 84.1, height: 118.9 },
  };
  const size = sizes[format];
  if (!size) return 0;
  const m2 = (size.width * size.height) / 10000;
  return Math.round(posterRate[paper] * m2 * qty);
}

export function calcStickerPrice(format: string, material: string, qty: number): number {
  const sizes: Record<string, number> = { 
    "5x5": 25, "10x10": 100, "15x15": 225, "20x20": 400 
  };
  const area = sizes[format];
  if (!area) return 0;
  return Math.round(area * stickerRate[material] * qty);
}

export function calcHaeftePrice(format: string, paper: string, pages: string, qty: number): number {
  const base = flyerPrices["A6"][paper as keyof typeof flyerPrices.A6]?.[qty as keyof typeof flyerPrices.A6["135g"]];
  if (!base) return 0;
  const factor = flyerFormatFactor[format] * (1 + 0.02 * (parseInt(pages) / 8));
  return Math.round(base * factor);
}

export function calcSalgsmappePrice(format: string, paper: string, sideType: string, qty: number): number {
  let base = 0;
  if (format === "A4") base = 1495;
  if (format === "A5") base = 995;
  if (format === "M65") base = 875;
  const paperFactor = paper === "350g" ? 1.10 : paper === "Matsilk" ? 1.05 : 1.00;
  const sideFactor = sideType === "Front+Inderside" ? 1.25 : 1.00;
  return Math.round(base * paperFactor * sideFactor * (qty / 50));
}

export function calcBannerPrice(lengthCm: number, heightCm: number, material: string): number {
  const m2 = (lengthCm * heightCm) / 10000;
  let pricePerM2 = 0;
  if (m2 > 0 && m2 <= 5) pricePerM2 = 125;
  else if (m2 <= 10) pricePerM2 = 115;
  else if (m2 <= 20) pricePerM2 = 110;
  else if (m2 <= 50) pricePerM2 = 99;
  return Math.round(m2 * pricePerM2);
}

export function calcBeachflagPrice(size: string, system: string, accessories: string[], qty: number): number {
  let subtotal = beachflagBase[size] * qty;
  if (system === "Komplet") subtotal *= 1.3;
  accessories.forEach(acc => {
    if (acc === "Grundplade" || acc === "Jordbor" || acc === "Vanddunk") {
      subtotal += 75 * qty;
    }
  });
  return Math.round(subtotal);
}

export function calcSkiltePrice(format: string, material: string, qty: number): number {
  const sizes: Record<string, { width: number; height: number }> = {
    "A3": { width: 29.7, height: 42 },
    "A2": { width: 42, height: 59.4 },
    "A1": { width: 59.4, height: 84.1 },
    "A0": { width: 84.1, height: 118.9 },
  };
  const size = sizes[format];
  if (!size) return 0;
  const m2 = (size.width * size.height) / 10000;
  return Math.round(signRate[material] * m2 * qty);
}

export function calcGenericPrice(qty: number, basePrice: number): number {
  return Math.round(basePrice * qty);
}

// Get price for selection
export function getPriceForSelection(
  productId: string,
  format: string,
  material: string,
  quantity: number,
  extraOption?: string
): number {
  try {
    switch (productId) {
      case "flyers": {
        const data = flyerPrices[format as keyof typeof flyerPrices]?.[material as keyof typeof flyerPrices.A6];
        return data?.[quantity as keyof typeof data] || 0;
      }
      case "foldere": {
        if (!extraOption) return 0;
        const data = folderPrices[format]?.[material]?.[extraOption];
        return data?.[quantity as keyof typeof data] || 0;
      }
      case "visitkort": {
        const data = visitkortPrices[material];
        return data?.[quantity as keyof typeof data] || 0;
      }
      default:
        return 0;
    }
  } catch {
    return 0;
  }
}
