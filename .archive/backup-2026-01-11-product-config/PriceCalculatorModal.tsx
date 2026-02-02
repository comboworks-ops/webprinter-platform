import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import midterfalsetImg from "@/assets/iconsprisberegner/midterfalset.png";
import portfalsetImg from "@/assets/iconsprisberegner/portfalset.png";
import rullefalsetImg from "@/assets/iconsprisberegner/rullefalset.png";
import zigzagfalsetImg from "@/assets/iconsprisberegner/zigzagfalset.png";
import { getFlyerPriceFromDB, getFolderPriceFromDB, getVisitkortPriceFromDB } from "@/utils/pricingDatabase";

interface PriceCalculatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  onOrder: (specs: string, price: number) => void;
}

// =======================================================
// PRICING DATA
// =======================================================

const flyerPrices = {
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

const flyerFormatFactor: Record<string, number> = {
  "A6": 1.00, "M65": 1.10, "A5": 1.15, "A4": 1.25, "A3": 1.50
};

// Folder prices are now fetched from database - no hardcoded data needed

const posterRate: Record<string, number> = { "135g": 110, "170g": 125, "250g": 150, "115g": 165 };

const stickerRate: Record<string, number> = { "Vinyl": 0.045, "Plast": 0.040, "Papir": 0.030 };

const visitkortBase: Record<string, Record<number, number>> = {
  "350g": { 100: 295, 250: 395, 500: 525, 1000: 645, 2500: 995, 5000: 1495 },
  "300g": { 100: 275, 250: 355, 500: 485, 1000: 595, 2500: 945, 5000: 1395 }
};

const bannerRate: Record<string, number> = { "PVC": 165, "Mesh": 155, "Tekstil": 180 };

const beachflagBase: Record<string, number> = { "Lille": 895, "Mellem": 1295 };

const signRate: Record<string, number> = { "PVC3": 250, "PVC5": 295, "Bølgeplast": 220, "Dibond": 395 };

// Delivery fee calculation
function deliveryFee(price: number, type: string): number {
  if (!type || type === "") return 0;
  if (type === "Standard") return price < 2000 ? 49 : 129;
  if (type === "Ekspres") return price < 2000 ? 199 : 399;
  if (type === "SuperEkspres") return 499;
  return 0;
}

// Product configurations
type ProductConfig = {
  formats: { id: string; label: string }[];
  materials: { id: string; label: string }[];
  quantities: number[];
  extraOptions?: { id: string; label: string }[];
};

const productConfigs: Record<string, ProductConfig> = {
  flyers: {
    formats: [
      { id: "A6", label: "A6" },
      { id: "M65", label: "M65" },
      { id: "A5", label: "A5" },
      { id: "A4", label: "A4" },
      { id: "A3", label: "A3" },
    ],
    materials: [
      { id: "135g Silk", label: "135g Silk" },
      { id: "170g Silk", label: "170g Silk" },
      { id: "250g Silk", label: "250g Silk" },
    ],
    quantities: [50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 10000, 15000],
  },
  foldere: {
    formats: [
      { id: "A5", label: "A5" },
      { id: "M65", label: "M65" },
      { id: "A4", label: "A4" },
    ],
    materials: [
      { id: "135g", label: "135g" },
      { id: "170g", label: "170g" },
      { id: "250g", label: "250g" },
    ],
    quantities: [50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 15000],
    extraOptions: [
      { id: "Midterfalset", label: "Midterfalset" },
      { id: "Rullefalset", label: "Rullefalset" },
      { id: "Zigzag", label: "Zigzag" },
    ],
  },
  plakater: {
    formats: [
      { id: "A3", label: "A3 (297×420mm)" },
      { id: "A2", label: "A2 (420×594mm)" },
      { id: "A1", label: "A1 (594×841mm)" },
      { id: "A0", label: "A0 (841×1189mm)" },
    ],
    materials: [
      { id: "135g", label: "135g" },
      { id: "170g", label: "170g" },
      { id: "250g", label: "250g" },
      { id: "115g", label: "115g" },
    ],
    quantities: [1, 5, 10, 25, 50, 100],
  },
  klistermærker: {
    formats: [
      { id: "5x5", label: "5×5 cm" },
      { id: "10x10", label: "10×10 cm" },
      { id: "15x15", label: "15×15 cm" },
      { id: "20x20", label: "20×20 cm" },
    ],
    materials: [
      { id: "Vinyl", label: "Vinyl" },
      { id: "Plast", label: "Plast" },
      { id: "Papir", label: "Papir" },
    ],
    quantities: [100, 250, 500, 1000, 2500, 5000],
  },
  hæfter: {
    formats: [
      { id: "A6", label: "A6" },
      { id: "A5", label: "A5" },
      { id: "A4", label: "A4" },
    ],
    materials: [
      { id: "135g", label: "135g" },
      { id: "170g", label: "170g" },
      { id: "250g", label: "250g" },
    ],
    quantities: [100, 250, 500, 1000, 2500, 5000, 10000],
    extraOptions: [
      { id: "8", label: "8 sider" },
      { id: "16", label: "16 sider" },
      { id: "24", label: "24 sider" },
      { id: "32", label: "32 sider" },
    ],
  },
  salgsmapper: {
    formats: [
      { id: "M65", label: "M65" },
      { id: "A5", label: "A5" },
      { id: "A4", label: "A4" },
    ],
    materials: [
      { id: "250g", label: "250g" },
      { id: "350g", label: "350g" },
      { id: "Matsilk", label: "Matsilk" },
    ],
    quantities: [50, 100, 250, 500, 1000],
    extraOptions: [
      { id: "Kun front", label: "Kun front" },
      { id: "Front+Inderside", label: "Front+Inderside" },
    ],
  },
  visitkort: {
    formats: [
      { id: "standard", label: "85×55 mm" },
    ],
    materials: [
      { id: "350g", label: "350g" },
      { id: "300g", label: "300g" },
    ],
    quantities: [100, 250, 500, 1000, 2500, 5000],
  },
  bannere: {
    formats: [
      { id: "custom", label: "Tilpasset størrelse" },
    ],
    materials: [
      { id: "PVC", label: "PVC-banner" },
      { id: "Mesh", label: "Mesh-banner" },
      { id: "Tekstil", label: "Tekstil-banner" },
    ],
    quantities: [1],
    extraOptions: [
      { id: "50cm", label: "Ringe pr. 50 cm" },
      { id: "100cm", label: "Ringe pr. 100 cm" },
      { id: "kant", label: "Kantforstærkning" },
    ],
  },
  beachflag: {
    formats: [
      { id: "Lille", label: "Lille (290 cm)" },
      { id: "Mellem", label: "Mellem (340 cm)" },
    ],
    materials: [
      { id: "Kun flag", label: "Kun flag" },
      { id: "Komplet", label: "Komplet system" },
    ],
    quantities: [1, 2, 5, 10, 20],
    extraOptions: [
      { id: "Grundplade", label: "Grundplade" },
      { id: "Jordbor", label: "Jordbor" },
      { id: "Vanddunk", label: "Vanddunk" },
    ],
  },
  skilte: {
    formats: [
      { id: "A3", label: "A3 (29.7×42cm)" },
      { id: "A2", label: "A2 (42×59.4cm)" },
      { id: "A1", label: "A1 (59.4×84.1cm)" },
      { id: "A0", label: "A0 (84.1×118.9cm)" },
    ],
    materials: [
      { id: "PVC3", label: "PVC 3mm" },
      { id: "PVC5", label: "PVC 5mm" },
      { id: "Bølgeplast", label: "Bølgeplast" },
      { id: "Dibond", label: "Dibond" },
    ],
    quantities: [1, 5, 10, 25, 50],
  },
  folie: {
    formats: [
      { id: "100x100", label: "100×100 cm" },
      { id: "200x100", label: "200×100 cm" },
      { id: "300x100", label: "300×100 cm" },
    ],
    materials: [
      { id: "Mat", label: "Mat folie" },
      { id: "Glans", label: "Glans folie" },
    ],
    quantities: [1, 2, 5, 10, 20],
  },
  messeudstyr: {
    formats: [
      { id: "Rollup", label: "Roll-up 80×210" },
      { id: "Disk", label: "Disk" },
      { id: "Messevæg", label: "Messevæg" },
    ],
    materials: [
      { id: "standard", label: "Standard" },
    ],
    quantities: [1, 2, 5, 10],
  },
  displayplakater: {
    formats: [
      { id: "100x100", label: "100×100 cm" },
      { id: "200x100", label: "200×100 cm" },
      { id: "300x100", label: "300×100 cm" },
    ],
    materials: [
      { id: "Papir", label: "Plakatpapir" },
      { id: "Backlit", label: "Backlit folie" },
      { id: "Tekstil", label: "Tekstilbanner" },
    ],
    quantities: [1, 2, 5, 10, 20],
  },
};

// Price calculation functions - now async to fetch from database
async function calcFlyerPrice(format: string, paper: string, qty: number, delivery: string): Promise<number> {
  const subtotal = await getFlyerPriceFromDB(format, paper, qty);
  if (!subtotal) return 0;

  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}

async function calcFolderPrice(format: string, paper: string, qty: number, delivery: string, fold: string): Promise<number> {
  const subtotal = await getFolderPriceFromDB(format, paper, fold, qty);
  if (!subtotal) return 0;

  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}

async function calcVisitkortPrice(paper: string, qty: number, delivery: string): Promise<number> {
  const subtotal = await getVisitkortPriceFromDB(paper, qty);
  if (!subtotal) return 0;

  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}

function calcPosterPrice(format: string, paper: string, qty: number, delivery: string): number {
  const sizes: Record<string, { width: number; height: number }> = {
    "A3": { width: 29.7, height: 42 },
    "A2": { width: 42, height: 59.4 },
    "A1": { width: 59.4, height: 84.1 },
    "A0": { width: 84.1, height: 118.9 },
  };
  const size = sizes[format];
  const m2 = (size.width * size.height) / 10000;
  const subtotal = Math.round(posterRate[paper] * m2 * qty);
  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}

function calcStickerPrice(format: string, material: string, qty: number, delivery: string): number {
  const sizes: Record<string, number> = { "5x5": 25, "10x10": 100, "15x15": 225, "20x20": 400 };
  const area = sizes[format];
  const subtotal = Math.round(area * stickerRate[material] * qty);
  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}

function calcHaeftePrice(format: string, paper: string, pages: string, qty: number, delivery: string): number {
  const base = flyerPrices["A6"][paper as keyof typeof flyerPrices.A6][qty as keyof typeof flyerPrices.A6["135g"]];
  const factor = flyerFormatFactor[format] * (1 + 0.02 * (parseInt(pages) / 8));
  const subtotal = Math.round(base * factor);
  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}

function calcSalgsmappePrice(format: string, paper: string, sideType: string, qty: number, delivery: string): number {
  let base = 0;
  if (format === "A4") base = 1495;
  if (format === "A5") base = 995;
  if (format === "M65") base = 875;
  const paperFactor = paper === "350g" ? 1.10 : paper === "Matsilk" ? 1.05 : 1.00;
  const sideFactor = sideType === "Front+Inderside" ? 1.25 : 1.00;
  const subtotal = Math.round(base * paperFactor * sideFactor * (qty / 50));
  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}


function calcBannerPrice(lengthCm: number, heightCm: number, material: string, delivery: string): number {
  // Convert cm to m²
  const m2 = (lengthCm * heightCm) / 10000;

  // Calculate price per m² based on area
  let pricePerM2 = 0;
  if (m2 > 0 && m2 <= 5) pricePerM2 = 125;
  else if (m2 <= 10) pricePerM2 = 115;
  else if (m2 <= 20) pricePerM2 = 110;
  else if (m2 <= 50) pricePerM2 = 99;

  const subtotal = Math.round(m2 * pricePerM2);
  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}

function calcBeachflagPrice(size: string, system: string, fod: string, qty: number, delivery: string): number {
  let subtotal = beachflagBase[size] * qty;
  if (system === "Komplet") subtotal *= 1.3;
  if (fod === "Jordbor" || fod === "Vanddunk") subtotal += 75 * qty;
  const deliveryCost = deliveryFee(subtotal, delivery === "SuperEkspres" ? "SuperEkspres" : delivery);
  return Math.round(subtotal + deliveryCost);
}

function calcSkiltePrice(format: string, material: string, qty: number, delivery: string): number {
  const sizes: Record<string, { width: number; height: number }> = {
    "A3": { width: 29.7, height: 42 },
    "A2": { width: 42, height: 59.4 },
    "A1": { width: 59.4, height: 84.1 },
    "A0": { width: 84.1, height: 118.9 },
  };
  const size = sizes[format];
  const m2 = (size.width * size.height) / 10000;
  const subtotal = Math.round(signRate[material] * m2 * qty);
  const deliveryCost = deliveryFee(subtotal, delivery);
  return subtotal + deliveryCost;
}

function calcGenericPrice(qty: number, delivery: string, basePrice: number): number {
  const subtotal = basePrice * qty;
  const deliveryCost = deliveryFee(subtotal, delivery);
  return Math.round(subtotal + deliveryCost);
}

const PriceCalculatorModal = ({ open, onOpenChange, productId, productName, onOrder }: PriceCalculatorModalProps) => {
  const config = productConfigs[productId];
  const [selectedFormat, setSelectedFormat] = useState(config?.formats[0]?.id || "");
  const [selectedMaterial, setSelectedMaterial] = useState(config?.materials[0]?.id || "");
  const [quantity, setQuantity] = useState(config?.quantities[0]?.toString() || "");
  const [delivery, setDelivery] = useState<string>("");
  const [extraOption, setExtraOption] = useState(config?.extraOptions?.[0]?.id || "");
  const [totalPrice, setTotalPrice] = useState(0);
  const [subtotalPrice, setSubtotalPrice] = useState(0);
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);

  // Banner custom dimensions (in cm)
  const [bannerLength, setBannerLength] = useState<number>(200);
  const [bannerHeight, setBannerHeight] = useState<number>(100);

  // Reset quantity if it exceeds 5000 when switching to Rullefalset or Zigzag
  useEffect(() => {
    if (productId === "foldere" && (extraOption === "Rullefalset" || extraOption === "Zigzag")) {
      const currentQty = parseInt(quantity);
      if (currentQty > 5000) {
        setQuantity("5000");
      }
    }
  }, [extraOption, quantity, productId]);

  useEffect(() => {
    if (!config) return;

    const calculateAndSetPrice = async () => {
      const qty = parseInt(quantity) || config.quantities[0];
      let calculatedPrice = 0;

      try {
        switch (productId) {
          case "flyers":
            calculatedPrice = await calcFlyerPrice(selectedFormat, selectedMaterial, qty, delivery);
            break;
          case "foldere":
            calculatedPrice = await calcFolderPrice(selectedFormat, selectedMaterial, qty, delivery, extraOption);
            break;
          case "plakater":
            calculatedPrice = calcPosterPrice(selectedFormat, selectedMaterial, qty, delivery);
            break;
          case "klistermærker":
            calculatedPrice = calcStickerPrice(selectedFormat, selectedMaterial, qty, delivery);
            break;
          case "hæfter":
            calculatedPrice = calcHaeftePrice(selectedFormat, selectedMaterial, extraOption, qty, delivery);
            break;
          case "salgsmapper":
            calculatedPrice = calcSalgsmappePrice(selectedFormat, selectedMaterial, extraOption, qty, delivery);
            break;
          case "visitkort":
            calculatedPrice = await calcVisitkortPrice(selectedMaterial, qty, delivery);
            break;
          case "bannere":
            calculatedPrice = calcBannerPrice(bannerLength, bannerHeight, selectedMaterial, delivery);
            break;
          case "beachflag":
            calculatedPrice = calcBeachflagPrice(selectedFormat, selectedMaterial, extraOption, qty, delivery);
            break;
          case "skilte":
            calculatedPrice = calcSkiltePrice(selectedFormat, selectedMaterial, qty, delivery);
            break;
          case "folie":
            calculatedPrice = calcGenericPrice(qty, delivery, 180);
            break;
          case "messeudstyr":
            calculatedPrice = calcGenericPrice(qty, delivery, 595);
            break;
          case "displayplakater":
            calculatedPrice = calcGenericPrice(qty, delivery, 140);
            break;
          default:
            calculatedPrice = 0;
        }
      } catch (error) {
        calculatedPrice = 0;
      }

      setTotalPrice(calculatedPrice);

      // Calculate subtotal without delivery
      const currentDeliveryFee = deliveryFee(calculatedPrice, delivery);
      setSubtotalPrice(calculatedPrice - currentDeliveryFee);
    };

    calculateAndSetPrice();
  }, [selectedFormat, selectedMaterial, quantity, delivery, extraOption, config, productId, bannerLength, bannerHeight]);

  useEffect(() => {
    if (config) {
      setSelectedFormat(config.formats[0]?.id || "");
      setSelectedMaterial(config.materials[0]?.id || "");

      // Default quantity to 500 if available, otherwise use first option
      const defaultQty = config.quantities.includes(500) ? "500" : (config.quantities[0]?.toString() || "");
      setQuantity(defaultQty);

      setExtraOption(config.extraOptions?.[0]?.id || "");

      // Default delivery to Standard and expanded
      setDelivery("Standard");
      setShowDeliveryOptions(true);

      // Reset banner custom dimensions
      if (productId === "bannere") {
        setBannerLength(200);
        setBannerHeight(100);
      }
    }
  }, [productId, config]);

  if (!config) return null;

  const handleOrder = () => {
    // Validate banner dimensions before ordering
    if (productId === "bannere") {
      if (!bannerLength || bannerLength <= 0 || bannerLength > 5000) {
        alert("Længde skal være mellem 10 og 5000 cm");
        return;
      }
      if (!bannerHeight || bannerHeight <= 0 || bannerHeight > 5000) {
        alert("Højde skal være mellem 10 og 5000 cm");
        return;
      }
      const areaM2 = (bannerLength * bannerHeight) / 10000;
      if (areaM2 > 50) {
        alert("Det samlede areal må ikke overstige 50 m²");
        return;
      }
    }

    const material = config.materials.find((m) => m.id === selectedMaterial);
    const extra = config.extraOptions?.find((e) => e.id === extraOption);

    let specs = "";

    if (productId === "bannere") {
      specs = `${productName} - ${bannerLength}cm × ${bannerHeight}cm - ${material?.label || ""}`;
      if (extra) specs += ` - Efterbehandling: ${extra.label}`;
      specs += ` - ${delivery === "Ekspres" ? "Ekspres levering" : "Standard levering"}`;
    } else {
      const format = config.formats.find((f) => f.id === selectedFormat);
      specs = `${productName} - ${format?.label || ""} - ${material?.label || ""} - ${quantity} stk`;
      if (extra) specs += ` - ${extra.label}`;
      specs += ` - ${delivery === "Ekspres" ? "Ekspres levering" : "Standard levering"}`;
    }

    onOrder(specs, totalPrice);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading">{productName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Banner Custom Dimensions */}
          {productId === "bannere" ? (
            <>
              {/* Custom Dimensions Input */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Bannerstørrelse</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="banner-length" className="text-sm mb-2 block">
                      Længde (cm)
                    </Label>
                    <Input
                      id="banner-length"
                      type="number"
                      min="10"
                      max="5000"
                      step="1"
                      value={bannerLength}
                      onChange={(e) => setBannerLength(parseInt(e.target.value) || 0)}
                      className="text-lg font-semibold"
                    />
                  </div>
                  <div>
                    <Label htmlFor="banner-height" className="text-sm mb-2 block">
                      Højde (cm)
                    </Label>
                    <Input
                      id="banner-height"
                      type="number"
                      min="10"
                      max="5000"
                      step="1"
                      value={bannerHeight}
                      onChange={(e) => setBannerHeight(parseInt(e.target.value) || 0)}
                      className="text-lg font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Material Selection for Banners */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Vælg materiale</Label>
                <div className="grid grid-cols-3 gap-2">
                  {config.materials.map((material) => (
                    <Button
                      key={material.id}
                      variant={selectedMaterial === material.id ? "default" : "outline"}
                      onClick={() => setSelectedMaterial(material.id)}
                      className="h-auto py-3"
                    >
                      {material.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Post-processing for Banners */}
              {config.extraOptions && (
                <div>
                  <Label className="text-base font-semibold mb-3 block">
                    Efterbehandling
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {config.extraOptions.map((option) => (
                      <Button
                        key={option.id}
                        variant={extraOption === option.id ? "default" : "outline"}
                        onClick={() => setExtraOption(option.id)}
                        className="h-auto py-3 text-xs"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Standard Format Selection for Other Products */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Vælg format</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {config.formats.map((format) => (
                    <Button
                      key={format.id}
                      variant={selectedFormat === format.id ? "default" : "outline"}
                      onClick={() => setSelectedFormat(format.id)}
                      className="h-auto py-3"
                    >
                      {format.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Material Selection for Other Products */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Vælg materiale</Label>
                <div className="grid grid-cols-2 gap-2">
                  {config.materials.map((material) => (
                    <Button
                      key={material.id}
                      variant={selectedMaterial === material.id ? "default" : "outline"}
                      onClick={() => setSelectedMaterial(material.id)}
                      className="h-auto py-3"
                    >
                      {material.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Extra Options for Other Products */}
              {config.extraOptions && (
                <div>
                  <Label className="text-base font-semibold mb-3 block">
                    {productId === "foldere" ? "Falsning" : productId === "hæfter" ? "Antal sider" : productId === "salgsmapper" ? "Print type" : "Tilbehør"}
                  </Label>
                  {productId === "foldere" ? (
                    <div className="grid grid-cols-4 gap-3">
                      {config.extraOptions.map((option) => {
                        const imageMap: Record<string, string> = {
                          "Midterfalset": midterfalsetImg,
                          "Rullefalset": rullefalsetImg,
                          "Zigzag": zigzagfalsetImg,
                          "Portfalsning": portfalsetImg,
                        };
                        return (
                          <button
                            key={option.id}
                            onClick={() => setExtraOption(option.id)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${extraOption === option.id
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:border-primary/50"
                              }`}
                          >
                            <img
                              src={imageMap[option.id]}
                              alt={option.label}
                              className="w-16 h-16 object-contain"
                            />
                            <span className="text-xs font-medium text-center">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {config.extraOptions.map((option) => (
                        <Button
                          key={option.id}
                          variant={extraOption === option.id ? "default" : "outline"}
                          onClick={() => setExtraOption(option.id)}
                          className="h-auto py-3"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quantity Selection for Other Products */}
              <div>
                <Label htmlFor="quantity" className="text-base font-semibold mb-3 block">
                  Antal
                </Label>
                <Select value={quantity} onValueChange={setQuantity}>
                  <SelectTrigger id="quantity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.quantities
                      .filter((qty) => {
                        // For foldere with Rullefalset or Zigzag, limit to 5000
                        if (productId === "foldere" && (extraOption === "Rullefalset" || extraOption === "Zigzag")) {
                          return qty <= 5000;
                        }
                        // For all other cases, show all quantities
                        return true;
                      })
                      .map((qty) => (
                        <SelectItem key={qty} value={qty.toString()}>
                          {qty} stk
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Delivery Selection - Always Visible */}
          <div className="mb-6">
            <Label className="text-base font-semibold mb-3 block">Levering</Label>
            <RadioGroup value={delivery} onValueChange={setDelivery} className="space-y-2">
              <div className={`flex items-center space-x-2 p-3 border rounded-md transition-colors ${delivery === "Standard" ? "bg-primary/5 border-primary" : "bg-background"}`}>
                <RadioGroupItem value="Standard" id="standard" />
                <Label htmlFor="standard" className="cursor-pointer flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Standard levering (6-9 dage)</span>
                    <span className="font-semibold text-primary text-sm">
                      {deliveryFee(subtotalPrice, "Standard")},00 kr
                    </span>
                  </div>
                </Label>
              </div>
              <div className={`flex items-center space-x-2 p-3 border rounded-md transition-colors ${delivery === "Ekspres" ? "bg-primary/5 border-primary" : "bg-background"}`}>
                <RadioGroupItem value="Ekspres" id="ekspres" />
                <Label htmlFor="ekspres" className="cursor-pointer flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Ekspres levering (3-5 dage)</span>
                    <span className="font-semibold text-primary text-sm">
                      {deliveryFee(subtotalPrice, "Ekspres")},00 kr
                    </span>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Price Display */}
          <div className="bg-primary/5 p-6 rounded-lg border-2 border-primary/20 space-y-4">
            {/* Order Summary */}
            <div className="text-sm text-muted-foreground pb-4 border-b border-primary/10">
              <p className="font-medium text-foreground mb-1">Din valgte konfiguration:</p>
              <p>
                {productName}
                {productId === "bannere"
                  ? ` • ${bannerLength}x${bannerHeight}cm`
                  : config.formats.find(f => f.id === selectedFormat)?.label ? ` • ${config.formats.find(f => f.id === selectedFormat)?.label}` : ""}
                {config.materials.find(m => m.id === selectedMaterial)?.label ? ` • ${config.materials.find(m => m.id === selectedMaterial)?.label}` : ""}
                {config.extraOptions?.find(e => e.id === extraOption)?.label ? ` • ${config.extraOptions.find(e => e.id === extraOption)?.label}` : ""}
                {` • ${quantity} stk`}
              </p>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Samlet pris ex. moms:</span>
              <span className="text-3xl font-heading font-bold text-primary">{totalPrice},00 kr</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleOrder} size="lg">
            Bestil nu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PriceCalculatorModal;
