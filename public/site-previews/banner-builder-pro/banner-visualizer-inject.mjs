(function () {
  const MODULE_ID = "wp-banner-visualizer-module";
  const RING_SPACING_100_BUTTON_ID = "wp-ring-option-100-button";
  const LEGACY_RING_SPACING_BUTTON_ID = "wp-ring-spacing-100-button";
  const LEGACY_RING_SPACING_BUTTON_CONTAINER_ID = "wp-ring-spacing-button-container";
  const UPLOAD_ACTION_CONTAINER_ID = "wp-upload-action-container";
  const UPLOAD_ACTION_BUTTON_ID = "wp-upload-action-button";
  const PRODUCT_BUTTON_ACTIVE_ATTR = "data-wp-variant-anchor";
  const PRODUCT_BUTTON_HOVER_ATTR = "data-wp-variant-hover";
  const PRODUCT_INFO_CARD_ID = "wp-product-variant-info-card";
  const BACKEND_PRICING_BREAKDOWN_ID = "wp-backend-pricing-breakdown";
  const UPLOAD_ACTION_TEXT = "Upload fil nu og se pa banner. Eller upload senere.";
  const UPLOAD_ACTION_BUTTON_LABEL = "Upload fil";
  const HEMMING_LABEL = "Kantforstærkning";
  const HEMMING_DESCRIPTION = "Svejset Kant hele vejen rundt.";
  const ANGIV_MAL_OVERLAY_DESKTOP_PX = 98;
  const ANGIV_MAL_OVERLAY_MOBILE_PX = 58;
  const MAX_VISUAL_WIDTH_PX = 560;
  const MAX_VISUAL_HEIGHT_PX = 240;
  const DEFAULT_WIDTH_CM = 200;
  const DEFAULT_HEIGHT_CM = 100;
  const DEFAULT_RING_SPACING_CM = 50;
  const LARGE_SIZE_REFERENCE_CM = 200;
  const BASE_RING_DIAMETER_PX = 10;
  const MIN_RING_DIAMETER_PX = 2;
  const MAX_RING_DIAMETER_PX = 13;
  const BASE_FINISH_EDGE_PX = 11;
  const MIN_FINISH_EDGE_PX = 3;
  const MAX_FINISH_EDGE_PX = 12;
  const BASE_KEDER_LINE_PX = 3;
  const MIN_KEDER_LINE_PX = 2;
  const MAX_KEDER_LINE_PX = 5;
  const TARGET_DPI_SMALL_AREA = 200;
  const TARGET_DPI_MEDIUM_AREA = 150;
  const TARGET_DPI_LARGE_AREA = 100;
  const MEDIUM_AREA_MIN_M2 = 1;
  const MEDIUM_AREA_MAX_M2 = 3;
  const UI_ANIMATION_MS = 1200;
  const PRODUCT_INFO_ANIMATION_MS = 320;
  const SITE_CHECKOUT_SESSION_KEY = "wp_site_checkout_session";
  const PREVIEW_SESSION_KEY = "wp_preview_shop_session";
  const MIN_DESIGN_WIDTH_PX = 20;
  const MIN_VISIBLE_DESIGN_PX = 24;
  const MAX_DESIGN_SCALE_FACTOR = 4;
  const CUT_LETTERS_FONT_STYLESHEET_ID = "wp-cut-letters-fonts";
  const CUT_LETTERS_DEFAULT_TEXT = "Folietekst";
  const CUT_LETTERS_DEFAULT_SCALE = 100;
  const CUT_LETTERS_MIN_SCALE = 40;
  const CUT_LETTERS_MAX_SCALE = 220;
  const CUT_LETTERS_FONTS = [
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "Poppins",
    "Oswald",
    "Raleway",
    "Nunito",
    "Merriweather",
    "Playfair Display",
    "Source Sans 3",
    "Ubuntu",
    "PT Sans",
    "Noto Sans",
    "Noto Serif",
    "Fira Sans",
    "Work Sans",
    "DM Sans",
    "Rubik",
    "Barlow",
    "Cabin",
    "Quicksand",
    "Karla",
    "Inconsolata",
    "Bebas Neue",
    "Anton",
    "Abril Fatface",
    "Josefin Sans",
    "Archivo",
    "Manrope",
    "Mulish",
    "Exo 2",
    "Arimo",
    "Libre Baskerville",
    "Crimson Text",
    "Teko",
    "Fjalla One",
    "Heebo",
    "Hind",
    "Jost",
    "Titillium Web",
    "Varela Round",
    "Sora",
    "Prompt",
    "Urbanist",
    "Plus Jakarta Sans",
    "Outfit",
    "IBM Plex Sans",
    "Asap",
  ];
  const CHECKOUT_PRODUCT_BY_VARIANT = {
    pvc: {
      slug: "bannere",
      name: "PVC Banner",
    },
    mesh: {
      slug: "bannere",
      name: "Mesh Banner",
    },
    textile: {
      slug: "bannere",
      name: "Tekstil Banner",
    },
    foil: {
      slug: "folie",
      name: "Vinduesfolie",
    },
    "cut-letters": {
      slug: "folie",
      name: "Folietekst",
    },
    default: {
      slug: "bannere",
      name: "Banner",
    },
  };
  const DEFAULT_DELIVERY_METHODS = [
    {
      id: "standard",
      name: "Standard levering",
      description: "2-4 hverdage",
      leadTimeDays: 4,
      cutoffTime: "12:00",
      cutoffLabel: "deadline",
      price: 49,
    },
    {
      id: "express",
      name: "Express levering",
      description: "1-2 hverdage",
      leadTimeDays: 2,
      cutoffTime: "12:00",
      cutoffLabel: "deadline",
      price: 199,
    },
  ];

  let uploadedDesign = null;
  let designPlacement = null;
  let designInteraction = null;
  let cutLettersInteraction = null;
  let refs = null;
  let syncTimer = null;
  let hasAppliedDefaultDimensions = false;
  let hasAppliedDefaultFinishingState = false;
  let suppressBaseRingModeSync = false;
  let ringSpacingMode = "50";
  let hasUserSelectedProductVariant = false;
  let lastAnimatedProductVariant = "default";
  let lastAnimatedProductInfoKey = "";
  let productInfoAnimationNonce = 0;
  let lastAnimatedProductInfoNonce = -1;
  let uploadInfoPromptShownForNoSelection = false;
  let nextCutLettersFoilId = 2;
  let runtimeSiteConfig = null;
  let runtimeProducts = [];
  let runtimeProductsSignature = "";
  let lastBackendPricingResult = null;
  let selectedDeliveryByProductKey = {};
  let cutLettersState = {
    foils: [
      {
        id: 1,
        text: CUT_LETTERS_DEFAULT_TEXT,
        fontName: CUT_LETTERS_FONTS[0],
        scale: CUT_LETTERS_DEFAULT_SCALE,
        fontWeight: 700,
        letterSpacingPx: 0.6,
        curve: 0,
        xRatio: 0.5,
        yRatio: 0.5,
      },
    ],
    activeFoilId: 1,
  };

  function normalizeText(value) {
    return (value || "")
      .toLowerCase()
      .replace(/\u00e6/g, "ae")
      .replace(/\u00f8/g, "o")
      .replace(/\u00e5/g, "a")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseNumber(value, fallback) {
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function createCutLettersFoil(overrides) {
    return {
      id: nextCutLettersFoilId++,
      text: CUT_LETTERS_DEFAULT_TEXT,
      fontName: CUT_LETTERS_FONTS[0],
      scale: CUT_LETTERS_DEFAULT_SCALE,
      fontWeight: 700,
      letterSpacingPx: 0.6,
      curve: 0,
      xRatio: 0.5,
      yRatio: 0.5,
      ...(overrides || {}),
    };
  }

  function ensureCutLettersStateConsistency() {
    if (!Array.isArray(cutLettersState.foils)) {
      cutLettersState.foils = [];
    }
    if (cutLettersState.foils.length === 0) {
      cutLettersState.activeFoilId = null;
      nextCutLettersFoilId = Math.max(nextCutLettersFoilId, 1);
      return;
    }
    const maxId = cutLettersState.foils.reduce(function (maxValue, foil) {
      const idValue = parseNumber(foil && foil.id, 0);
      return Math.max(maxValue, idValue);
    }, 0);
    nextCutLettersFoilId = Math.max(nextCutLettersFoilId, maxId + 1);
    const activeExists = cutLettersState.foils.some(function (foil) {
      return foil && foil.id === cutLettersState.activeFoilId;
    });
    if (!activeExists) {
      cutLettersState.activeFoilId = cutLettersState.foils[0].id;
    }
  }

  function getActiveCutLettersFoil() {
    ensureCutLettersStateConsistency();
    if (cutLettersState.foils.length === 0) return null;
    return (
      cutLettersState.foils.find(function (foil) {
        return foil.id === cutLettersState.activeFoilId;
      }) || cutLettersState.foils[0] || null
    );
  }

  function fontFamilyForCutLetters(fontName) {
    if (!fontName) return "Inter, sans-serif";
    return "'" + String(fontName).replace(/'/g, "\\'") + "', sans-serif";
  }

  function ensureCutLettersFontsLoaded() {
    if (document.getElementById(CUT_LETTERS_FONT_STYLESHEET_ID)) return;
    const fontFamilies = CUT_LETTERS_FONTS.map(function (name) {
      return name.split(/\s+/).join("+") + ":wght@400;700";
    }).join("&family=");
    const link = document.createElement("link");
    link.id = CUT_LETTERS_FONT_STYLESHEET_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=" +
      fontFamilies +
      "&display=swap";
    document.head.appendChild(link);
  }

  function computeStops(lengthCm, spacingCm) {
    const safeLength = Math.max(1, lengthCm);
    const safeSpacing = Math.max(10, spacingCm);
    const stopCount = Math.max(2, Math.floor(safeLength / safeSpacing) + 1);

    if (stopCount === 2) return [0, 1];
    return Array.from({ length: stopCount }, function (_, index) {
      return index / (stopCount - 1);
    });
  }

  function createElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof textContent === "string") element.textContent = textContent;
    return element;
  }

  function setSimpleNodeText(node, nextText) {
    if (!node) return false;
    const normalizedText = String(nextText == null ? "" : nextText);

    if (!node.firstChild) {
      node.appendChild(document.createTextNode(normalizedText));
      return true;
    }

    if (node.childNodes.length !== 1 || node.firstChild.nodeType !== Node.TEXT_NODE) {
      return false;
    }

    if (node.firstChild.nodeValue !== normalizedText) {
      node.firstChild.nodeValue = normalizedText;
    }
    return true;
  }

  function setNodeLeadingPriceText(node, formattedAmount) {
    if (!node) return false;
    const amountText = String(formattedAmount == null ? "" : formattedAmount) + " ";
    const textNode = Array.from(node.childNodes).find(function (child) {
      return child && child.nodeType === Node.TEXT_NODE;
    });
    if (textNode) {
      if (textNode.nodeValue !== amountText) {
        textNode.nodeValue = amountText;
      }
      return true;
    }
    if (node.firstChild) {
      node.insertBefore(document.createTextNode(amountText), node.firstChild);
      return true;
    }
    node.appendChild(document.createTextNode(amountText + "DKK"));
    return true;
  }

  function findBlockByHeading(keyword) {
    const headingNodes = Array.from(
      document.querySelectorAll("#prisberegner h3")
    );

    const heading = headingNodes.find(function (node) {
      return normalizeText(node.textContent).includes(keyword);
    });

    return heading ? heading.closest(".mb-8") : null;
  }

  function findPriceSummaryHost() {
    const priceSection = document.getElementById("prisberegner");
    if (!priceSection) return null;

    const orderButton = Array.from(priceSection.querySelectorAll("button")).find(
      function (button) {
        return normalizeText(button.textContent).includes("bestil nu");
      }
    );
    if (!orderButton || !orderButton.parentElement) return null;

    return {
      orderButton,
      host: orderButton.parentElement,
    };
  }

  function readRuntimeSiteConfigFromSession() {
    const params = new URLSearchParams(window.location.search || "");
    const explicitStorageKey = params.get("wpPreviewConfigKey");
    const siteId =
      params.get("wpSiteId") ||
      params.get("siteId") ||
      params.get("site_id") ||
      "banner-builder-pro";
    const tenantId = params.get("tenantId") || params.get("tenant_id");

    const candidateKeys = [];
    if (explicitStorageKey) {
      candidateKeys.push(explicitStorageKey);
    }
    if (siteId && tenantId) {
      candidateKeys.push("wp_site_preview_runtime:" + siteId + ":" + tenantId);
    }

    const addKeysByPrefix = function (storageLike, prefix) {
      if (!storageLike || !prefix) return;
      try {
        for (var index = 0; index < storageLike.length; index += 1) {
          var key = storageLike.key(index);
          if (typeof key === "string" && key.indexOf(prefix) === 0) {
            candidateKeys.push(key);
          }
        }
      } catch (_error) {
        // Ignore storage access errors.
      }
    };

    if (siteId) {
      var sitePrefix = "wp_site_preview_runtime:" + siteId + ":";
      addKeysByPrefix(sessionStorage, sitePrefix);
      try {
        if (window.top && window.top.sessionStorage) {
          addKeysByPrefix(window.top.sessionStorage, sitePrefix);
        }
      } catch (_error) {
        // Ignore cross-context storage errors.
      }
    }

    const seenKeys = new Set();
    const uniqueKeys = candidateKeys.filter(function (key) {
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    const parseRuntimeConfig = function (raw) {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        if (!Array.isArray(parsed.products)) return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    };

    for (var keyIndex = 0; keyIndex < uniqueKeys.length; keyIndex += 1) {
      var key = uniqueKeys[keyIndex];
      var raw = null;

      try {
        raw = sessionStorage.getItem(key);
      } catch (_error) {
        raw = null;
      }
      var parsedFromCurrent = parseRuntimeConfig(raw);
      if (parsedFromCurrent) return parsedFromCurrent;

      try {
        if (window.top && window.top.sessionStorage) {
          raw = window.top.sessionStorage.getItem(key);
        } else {
          raw = null;
        }
      } catch (_error) {
        raw = null;
      }
      var parsedFromTop = parseRuntimeConfig(raw);
      if (parsedFromTop) return parsedFromTop;
    }

    return null;
  }

  function asRuntimeObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value;
  }

  function asRuntimeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeRuntimeStorformat(rawStorformat) {
    const raw = asRuntimeObject(rawStorformat);
    if (!raw) return null;

    const configRaw = asRuntimeObject(raw.config);
    const quantities = configRaw && Array.isArray(configRaw.quantities)
      ? configRaw.quantities
          .map(function (value) {
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
          })
          .filter(function (value) {
            return value !== null;
          })
      : [1];

    const config = configRaw
      ? {
          roundingStep: Number(configRaw.roundingStep) || 1,
          globalMarkupPct: Number(configRaw.globalMarkupPct) || 0,
          quantities: quantities.length ? quantities : [1],
        }
      : null;

    const materials = asRuntimeArray(raw.materials)
      .map(function (entry) {
        const row = asRuntimeObject(entry);
        if (!row) return null;
        const id = typeof row.id === "string" ? row.id : "";
        const name = typeof row.name === "string" ? row.name : "";
        if (!id || !name) return null;
        return {
          id: id,
          name: name,
          interpolationEnabled: !!row.interpolationEnabled,
          markupPct: Number(row.markupPct) || 0,
          minPrice: Number(row.minPrice) || 0,
          maxWidthMm:
            row.maxWidthMm === null || row.maxWidthMm === undefined
              ? null
              : Number(row.maxWidthMm) || null,
          maxHeightMm:
            row.maxHeightMm === null || row.maxHeightMm === undefined
              ? null
              : Number(row.maxHeightMm) || null,
          allowSplit: row.allowSplit !== false,
          sortOrder: Number(row.sortOrder) || 0,
        };
      })
      .filter(Boolean);

    const m2Prices = asRuntimeArray(raw.m2Prices)
      .map(function (entry) {
        const row = asRuntimeObject(entry);
        if (!row) return null;
        const materialId =
          typeof row.materialId === "string" ? row.materialId : "";
        const fromM2 = Number(row.fromM2);
        const pricePerM2 = Number(row.pricePerM2);
        if (!materialId || !Number.isFinite(fromM2) || !Number.isFinite(pricePerM2)) {
          return null;
        }
        const toM2 =
          row.toM2 === null || row.toM2 === undefined ? null : Number(row.toM2);
        return {
          materialId: materialId,
          fromM2: fromM2,
          toM2: Number.isFinite(toM2) ? toM2 : null,
          pricePerM2: pricePerM2,
          isAnchor: !!row.isAnchor,
        };
      })
      .filter(Boolean);

    const finishes = asRuntimeArray(raw.finishes)
      .map(function (entry) {
        const row = asRuntimeObject(entry);
        if (!row) return null;
        const id = typeof row.id === "string" ? row.id : "";
        const name = typeof row.name === "string" ? row.name : "";
        if (!id || !name) return null;
        const pricingMode =
          String(row.pricingMode || "fixed").toLowerCase() === "per_m2"
            ? "per_m2"
            : "fixed";
        const tags = Array.isArray(row.tags)
          ? row.tags
              .filter(function (value) {
                return typeof value === "string" && value.trim();
              })
              .map(function (value) {
                return String(value).trim();
              })
          : [];
        return {
          id: id,
          name: name,
          tags: tags,
          pricingMode: pricingMode,
          fixedPricePerUnit: Number(row.fixedPricePerUnit) || 0,
          interpolationEnabled: !!row.interpolationEnabled,
          markupPct: Number(row.markupPct) || 0,
          sortOrder: Number(row.sortOrder) || 0,
        };
      })
      .filter(Boolean);

    const finishPrices = asRuntimeArray(raw.finishPrices)
      .map(function (entry) {
        const row = asRuntimeObject(entry);
        if (!row) return null;
        const finishId = typeof row.finishId === "string" ? row.finishId : "";
        if (!finishId) return null;
        const pricingMode =
          String(row.pricingMode || "fixed").toLowerCase() === "per_m2"
            ? "per_m2"
            : "fixed";
        return {
          finishId: finishId,
          pricingMode: pricingMode,
          fixedPrice: Number(row.fixedPrice) || 0,
          pricePerM2: Number(row.pricePerM2) || 0,
        };
      })
      .filter(Boolean);

    const productItems = asRuntimeArray(raw.productItems)
      .map(function (entry) {
        const row = asRuntimeObject(entry);
        if (!row) return null;
        const id = typeof row.id === "string" ? row.id : "";
        const name = typeof row.name === "string" ? row.name : "";
        if (!id || !name) return null;
        const pricingType = String(row.pricingType || "fixed").toLowerCase();
        return {
          id: id,
          name: name,
          pricingType:
            pricingType === "per_item" ||
            pricingType === "percentage" ||
            pricingType === "m2"
              ? pricingType
              : "fixed",
          pricingMode: String(row.pricingMode || "fixed"),
          initialPrice: Number(row.initialPrice) || 0,
          percentageMarkup: Number(row.percentageMarkup) || 0,
          minPrice: Number(row.minPrice) || 0,
          interpolationEnabled: !!row.interpolationEnabled,
          markupPct: Number(row.markupPct) || 0,
          sortOrder: Number(row.sortOrder) || 0,
        };
      })
      .filter(Boolean);

    const productFixedPrices = asRuntimeArray(raw.productFixedPrices)
      .map(function (entry) {
        const row = asRuntimeObject(entry);
        if (!row) return null;
        const productItemId =
          typeof row.productItemId === "string" ? row.productItemId : "";
        const quantity = Number(row.quantity);
        const price = Number(row.price);
        if (!productItemId || !Number.isFinite(quantity) || !Number.isFinite(price)) {
          return null;
        }
        return {
          productItemId: productItemId,
          quantity: quantity,
          price: price,
        };
      })
      .filter(Boolean);

    const productPriceTiers = asRuntimeArray(raw.productPriceTiers)
      .map(function (entry) {
        const row = asRuntimeObject(entry);
        if (!row) return null;
        const productItemId =
          typeof row.productItemId === "string" ? row.productItemId : "";
        const fromM2 = Number(row.fromM2);
        const pricePerM2 = Number(row.pricePerM2);
        if (!productItemId || !Number.isFinite(fromM2) || !Number.isFinite(pricePerM2)) {
          return null;
        }
        const toM2 =
          row.toM2 === null || row.toM2 === undefined ? null : Number(row.toM2);
        return {
          productItemId: productItemId,
          fromM2: fromM2,
          toM2: Number.isFinite(toM2) ? toM2 : null,
          pricePerM2: pricePerM2,
          isAnchor: !!row.isAnchor,
        };
      })
      .filter(Boolean);

    return {
      config: config,
      materials: materials,
      m2Prices: m2Prices,
      finishes: finishes,
      finishPrices: finishPrices,
      productItems: productItems,
      productFixedPrices: productFixedPrices,
      productPriceTiers: productPriceTiers,
    };
  }

  function normalizeRuntimeDeliveryMethods(rawMethods) {
    const fallbackById = DEFAULT_DELIVERY_METHODS.reduce(function (map, method) {
      map[String(method.id || "").toLowerCase()] = method;
      return map;
    }, {});
    const methods = asRuntimeArray(rawMethods)
      .map(function (entry, index) {
        const row = asRuntimeObject(entry);
        if (!row) return null;
        const name = typeof row.name === "string" ? row.name.trim() : "";
        if (!name) return null;
        const id =
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim()
            : "delivery-" + String(index + 1);
        const fallback = fallbackById[String(id).toLowerCase()] || null;
        const leadTimeDaysRaw =
          row.leadTimeDays === null || row.leadTimeDays === undefined
            ? row.lead_time_days === null || row.lead_time_days === undefined
              ? null
              : Number(row.lead_time_days)
            : Number(row.leadTimeDays);
        const parsedPrice = Number(row.price);
        return {
          id: id,
          name: name,
          description:
            typeof row.description === "string" && row.description.trim()
              ? row.description.trim()
              : fallback
                ? fallback.description || ""
                : "",
          leadTimeDays: Number.isFinite(leadTimeDaysRaw)
            ? leadTimeDaysRaw
            : fallback
              ? Number(fallback.leadTimeDays) || null
              : null,
          cutoffTime:
            typeof row.cutoffTime === "string" && row.cutoffTime.trim()
              ? row.cutoffTime.trim()
              : typeof row.cutoff_time === "string" && row.cutoff_time.trim()
                ? row.cutoff_time.trim()
                : fallback
                  ? String(fallback.cutoffTime || "")
                  : "",
          cutoffLabel:
            typeof row.cutoffLabel === "string" && row.cutoffLabel.trim()
              ? row.cutoffLabel.trim()
              : typeof row.cutoff_label === "string" && row.cutoff_label.trim()
                ? row.cutoff_label.trim()
                : fallback
                  ? String(fallback.cutoffLabel || "")
                  : "",
          submission:
            typeof row.submission === "string" && row.submission.trim()
              ? row.submission.trim()
              : "",
          deliveryDate:
            typeof row.deliveryDate === "string" && row.deliveryDate.trim()
              ? row.deliveryDate.trim()
              : typeof row.delivery_date === "string" && row.delivery_date.trim()
                ? row.delivery_date.trim()
                : "",
          price: Number.isFinite(parsedPrice)
            ? parsedPrice
            : fallback
              ? Number(fallback.price) || 0
              : 0,
        };
      })
      .filter(Boolean);
    if (methods.length) return methods;
    return DEFAULT_DELIVERY_METHODS.slice();
  }

  function normalizeRuntimeProduct(rawProduct) {
    if (!rawProduct || typeof rawProduct !== "object") return null;

    const id = typeof rawProduct.id === "string" ? rawProduct.id : "";
    const slug = typeof rawProduct.slug === "string" ? rawProduct.slug : "";
    const name = typeof rawProduct.name === "string" ? rawProduct.name : "";
    const description =
      typeof rawProduct.description === "string" ? rawProduct.description : "";
    const iconText =
      typeof rawProduct.iconText === "string" ? rawProduct.iconText : "";
    const imageUrl =
      typeof rawProduct.imageUrl === "string" ? rawProduct.imageUrl : "";
    const buttonKey =
      typeof rawProduct.buttonKey === "string" ? rawProduct.buttonKey : "";
    const buttonOrder = Number(rawProduct.buttonOrder);
    const buttonLabel =
      typeof rawProduct.buttonLabel === "string" ? rawProduct.buttonLabel : "";
    const buttonDescription =
      typeof rawProduct.buttonDescription === "string"
        ? rawProduct.buttonDescription
        : "";
    const buttonImageUrl =
      typeof rawProduct.buttonImageUrl === "string"
        ? rawProduct.buttonImageUrl
        : "";
    const pricingType =
      typeof rawProduct.pricingType === "string" ? rawProduct.pricingType : "";
    const activeFinishIds = asRuntimeArray(rawProduct.activeFinishIds)
      .filter(function (entry) {
        return typeof entry === "string" && entry.trim();
      })
      .map(function (entry) {
        return String(entry).trim();
      });
    const activeProductItemIds = asRuntimeArray(rawProduct.activeProductItemIds)
      .filter(function (entry) {
        return typeof entry === "string" && entry.trim();
      })
      .map(function (entry) {
        return String(entry).trim();
      });
    const deliveryMethods = normalizeRuntimeDeliveryMethods(rawProduct.deliveryMethods);
    const storformat = normalizeRuntimeStorformat(rawProduct.storformat);

    if (!slug && !name && !id) return null;

    return {
      id: id,
      slug: slug,
      name: name,
      description: description,
      iconText: iconText,
      imageUrl: imageUrl,
      buttonKey: buttonKey,
      buttonOrder: Number.isFinite(buttonOrder) ? buttonOrder : null,
      buttonLabel: buttonLabel,
      buttonDescription: buttonDescription,
      buttonImageUrl: buttonImageUrl,
      pricingType: pricingType,
      activeFinishIds: activeFinishIds,
      activeProductItemIds: activeProductItemIds,
      deliveryMethods: deliveryMethods,
      storformat: storformat,
    };
  }

  function ensureRuntimeSiteConfig() {
    const config = readRuntimeSiteConfigFromSession();
    if (!config) {
      runtimeSiteConfig = null;
      runtimeProducts = [];
      runtimeProductsSignature = "";
      return;
    }

    const normalizedProducts = (config.products || [])
      .map(normalizeRuntimeProduct)
      .filter(Boolean);
    const nextSignature = JSON.stringify(
      normalizedProducts.map(function (product) {
        return [
          product.id || "",
          product.slug || "",
          product.name || "",
          product.description || "",
          product.iconText || "",
          product.imageUrl || "",
          product.buttonKey || "",
          product.buttonOrder === null || product.buttonOrder === undefined
            ? ""
            : String(product.buttonOrder),
          product.buttonLabel || "",
          product.buttonDescription || "",
          product.buttonImageUrl || "",
          product.pricingType || "",
          Array.isArray(product.activeFinishIds)
            ? product.activeFinishIds.join(",")
            : "",
          Array.isArray(product.activeProductItemIds)
            ? product.activeProductItemIds.join(",")
            : "",
          Array.isArray(product.deliveryMethods)
            ? JSON.stringify(product.deliveryMethods)
            : "",
          product.storformat ? JSON.stringify(product.storformat) : "",
        ].join("|");
      })
    );

    runtimeSiteConfig = config;
    runtimeProducts = normalizedProducts;
    runtimeProductsSignature = nextSignature;
  }

  function getProductButtons() {
    const productBlock = findBlockByHeading("vaelg produkt");
    if (!productBlock) return [];
    return Array.from(productBlock.querySelectorAll("button"));
  }

  function readSelectedProductButton() {
    const productButtons = getProductButtons();
    if (!productButtons.length) return null;

    return (
      productButtons.find(function (button) {
        return button.getAttribute(PRODUCT_BUTTON_ACTIVE_ATTR) === "1";
      }) ||
      productButtons.find(function (button) {
        return isFinishingButtonSelected(button);
      }) ||
      null
    );
  }

  function runtimeProductForButton(button) {
    if (!button || !runtimeProducts.length) return null;

    const runtimeId = button.getAttribute("data-wp-runtime-product-id");
    if (runtimeId) {
      const byId = runtimeProducts.find(function (product) {
        return product.id && product.id === runtimeId;
      });
      if (byId) return byId;
    }

    const runtimeSlug = button.getAttribute("data-wp-runtime-product-slug");
    if (runtimeSlug) {
      const bySlug = runtimeProducts.find(function (product) {
        return product.slug && product.slug === runtimeSlug;
      });
      if (bySlug) return bySlug;
    }

    return null;
  }

  function inferVariantFromButton(button) {
    if (!button) return "default";
    const labelNode = button.querySelector("span") || button;
    const label = normalizeText(labelNode ? labelNode.textContent : button.textContent);

    if (
      label.includes("udska") &&
      (label.includes("bogstav") || label.includes("bokstav") || label.includes("letter"))
    ) {
      return "cut-letters";
    }
    if (label.includes("mesh")) return "mesh";
    if (label.includes("tekstil")) return "textile";
    if (label.includes("vinduesfolie") || label.includes("folie")) return "foil";
    if (label.includes("pvc")) return "pvc";
    return "default";
  }

  function runtimeProductByVariantOrOrder(variant, fallbackIndex) {
    if (!runtimeProducts.length) return null;

    const byKey = runtimeProducts.find(function (product) {
      return normalizeText(product.buttonKey || "") === normalizeText(variant || "");
    });
    if (byKey) return byKey;

    const ordered = runtimeProducts
      .filter(function (product) {
        return typeof product.buttonOrder === "number";
      })
      .sort(function (a, b) {
        return (a.buttonOrder || 0) - (b.buttonOrder || 0);
      });
    if (ordered.length) {
      return ordered[fallbackIndex] || ordered[0] || null;
    }

    return null;
  }

  function runtimeVariantKeywords(variant) {
    if (variant === "pvc") return ["pvc", "banner"];
    if (variant === "mesh") return ["mesh", "banner"];
    if (variant === "textile") return ["tekstil", "textile", "stof", "banner"];
    if (variant === "foil") return ["folie", "foil", "vinduesfolie", "vinyl"];
    if (variant === "cut-letters") return ["bogstav", "bokstav", "letter", "tekst", "text", "folie"];
    return ["banner", "storformat", "print"];
  }

  function runtimeProductByVariantHint(variant) {
    if (!runtimeProducts.length) return null;
    const keywords = runtimeVariantKeywords(variant);
    let bestProduct = runtimeProducts[0];
    let bestScore = -1;

    runtimeProducts.forEach(function (product) {
      const tokens = [
        normalizeText(product.name || ""),
        normalizeText(product.slug || ""),
        normalizeText(product.iconText || ""),
        normalizeText(product.buttonKey || ""),
      ];
      let score = 0;
      keywords.forEach(function (keyword) {
        tokens.forEach(function (token) {
          if (token.includes(keyword)) score += 1;
        });
      });
      if (score > bestScore) {
        bestProduct = product;
        bestScore = score;
      }
    });

    return bestProduct || null;
  }

  function runtimeProductForVariantSelection(variant, button, fallbackIndex) {
    const byButton = runtimeProductForButton(button);
    if (byButton) return byButton;

    const byConfiguredOrder = runtimeProductByVariantOrOrder(variant, fallbackIndex);
    if (byConfiguredOrder) return byConfiguredOrder;

    return runtimeProductByVariantHint(variant);
  }

  function normalizeRuntimeImageUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";

    try {
      const parsed = new URL(raw, window.location.origin);
      const pathname = String(parsed.pathname || "");
      if (pathname.includes("/storage/v1/render/image/public/")) {
        parsed.pathname = pathname.replace(
          "/storage/v1/render/image/public/",
          "/storage/v1/object/public/"
        );
      }

      [
        "width",
        "height",
        "quality",
        "resize",
        "format",
      ].forEach(function (paramName) {
        parsed.searchParams.delete(paramName);
      });

      const normalized = parsed.toString();
      if (/^https?:\/\//i.test(raw)) {
        return normalized;
      }
      if (normalized.startsWith(window.location.origin)) {
        return normalized.slice(window.location.origin.length);
      }
      return normalized;
    } catch (_error) {
      return raw;
    }
  }

  function runtimeImageResolutionScore(url) {
    const text = String(url || "").toLowerCase();
    if (!text) return -999;
    var score = 0;
    if (text.includes("thumbnail") || text.includes("thumb")) score -= 4;
    if (text.includes("preview")) score -= 3;
    if (text.includes("small")) score -= 2;
    if (text.includes("/render/image/")) score -= 2;
    if (
      text.includes("width=") ||
      text.includes("height=") ||
      text.includes("quality=") ||
      text.includes("resize=")
    ) {
      score -= 2;
    }
    if (text.includes("original") || text.includes("full")) score += 2;
    return score;
  }

  function resolveRuntimeButtonImageUrl(runtimeProduct) {
    const candidates = [
      String(runtimeProduct && runtimeProduct.buttonImageUrl ? runtimeProduct.buttonImageUrl : "").trim(),
      String(runtimeProduct && runtimeProduct.imageUrl ? runtimeProduct.imageUrl : "").trim(),
    ].filter(Boolean);
    if (!candidates.length) return "";

    var bestRaw = candidates[0];
    var bestScore = runtimeImageResolutionScore(candidates[0]);

    candidates.slice(1).forEach(function (candidate) {
      const score = runtimeImageResolutionScore(candidate);
      if (score > bestScore) {
        bestScore = score;
        bestRaw = candidate;
      }
    });

    return normalizeRuntimeImageUrl(bestRaw) || bestRaw;
  }

  function applyRuntimeProductButtons() {
    if (!runtimeProducts.length) return;

    const productButtons = getProductButtons();
    if (!productButtons.length) return;

    const resetRuntimeProductButtonVisual = function (button) {
      if (!button) return;

      button.removeAttribute("data-wp-runtime-image-mode");
      [
        "all",
        "background",
        "background-image",
        "background-size",
        "background-position",
        "background-repeat",
        "border",
        "box-shadow",
        "padding",
        "border-radius",
        "display",
        "flex-direction",
        "align-items",
        "justify-content",
        "gap",
        "position",
        "overflow",
        "color",
        "min-height",
        "height",
        "width",
        "margin",
        "cursor",
        "outline",
        "outline-offset",
        "appearance",
        "-webkit-appearance",
      ].forEach(function (propertyName) {
        button.style.removeProperty(propertyName);
      });

      const existingRuntimeImage = button.querySelector(
        "img[data-wp-runtime-product-image='1']"
      );
      if (existingRuntimeImage && existingRuntimeImage.parentElement) {
        existingRuntimeImage.parentElement.removeChild(existingRuntimeImage);
      }

      Array.from(button.children).forEach(function (childNode) {
        childNode.style.display = "";
        childNode.style.opacity = "";
        childNode.style.visibility = "";
        childNode.style.pointerEvents = "";
        childNode.style.marginTop = "";
        childNode.style.width = "";
        childNode.style.textAlign = "";
        childNode.style.color = "";
      });

      Array.from(button.querySelectorAll("svg")).forEach(function (iconNode) {
        iconNode.style.display = "";
        iconNode.style.opacity = "";
        iconNode.style.visibility = "";
      });
    };

    productButtons.forEach(function (button, index) {
      resetRuntimeProductButtonVisual(button);
      button.removeAttribute("data-wp-runtime-title");
      button.removeAttribute("data-wp-runtime-description");

      const variant = inferVariantFromButton(button);
      const runtimeProduct = runtimeProductForVariantSelection(
        variant,
        button,
        index
      );
      if (!runtimeProduct) {
        button.removeAttribute("data-wp-runtime-product-id");
        button.removeAttribute("data-wp-runtime-product-slug");
        button.removeAttribute("data-wp-runtime-title");
        button.removeAttribute("data-wp-runtime-description");
        return;
      }

      if (runtimeProduct.id) {
        button.setAttribute("data-wp-runtime-product-id", runtimeProduct.id);
      }
      if (runtimeProduct.slug) {
        button.setAttribute("data-wp-runtime-product-slug", runtimeProduct.slug);
      }
      const runtimeTitle =
        String(runtimeProduct.buttonLabel || "").trim() ||
        String(runtimeProduct.name || "").trim() ||
        String(runtimeProduct.iconText || "").trim();
      if (runtimeTitle) {
        button.setAttribute("data-wp-runtime-title", runtimeTitle);
      }
      const runtimeDescription =
        String(runtimeProduct.buttonDescription || "").trim() ||
        String(runtimeProduct.description || "").trim();
      if (runtimeDescription) {
        button.setAttribute("data-wp-runtime-description", runtimeDescription);
      }

      const titleNode =
        button.querySelector("span.text-xs, span.text-sm, span.font-medium, span") || null;
      if (titleNode && runtimeTitle) {
        setSimpleNodeText(titleNode, runtimeTitle);
      }

      const runtimeImageUrl = resolveRuntimeButtonImageUrl(runtimeProduct);

      if (runtimeImageUrl) {
        button.setAttribute("data-wp-runtime-image-mode", "1");
        button.style.setProperty("all", "unset", "important");
        button.style.setProperty("background", "transparent", "important");
        button.style.setProperty("border", "0", "important");
        button.style.setProperty("box-shadow", "none", "important");
        button.style.setProperty("padding", "0", "important");
        button.style.setProperty("border-radius", "0", "important");
        button.style.setProperty("display", "flex", "important");
        button.style.setProperty("flex-direction", "column", "important");
        button.style.setProperty("align-items", "stretch", "important");
        button.style.setProperty("justify-content", "flex-start", "important");
        button.style.setProperty("gap", "0", "important");
        button.style.setProperty("overflow", "visible", "important");
        button.style.setProperty("min-height", "0", "important");
        button.style.setProperty("height", "auto", "important");
        button.style.setProperty("width", "100%", "important");
        button.style.setProperty("margin", "0", "important");
        button.style.setProperty("cursor", "pointer", "important");
        button.style.setProperty("outline", "none", "important");
        button.style.setProperty("outline-offset", "0", "important");
        button.style.setProperty("appearance", "none", "important");
        button.style.setProperty("-webkit-appearance", "none", "important");

        const imageNode = document.createElement("img");
        imageNode.setAttribute("data-wp-runtime-product-image", "1");
        imageNode.alt = runtimeTitle || "Produkt";
        imageNode.src = runtimeImageUrl;
        imageNode.style.display = "block";
        imageNode.style.width = "100%";
        imageNode.style.height = "auto";
        imageNode.style.aspectRatio = "auto";
        imageNode.style.objectFit = "contain";
        imageNode.style.borderRadius = "0px";
        imageNode.style.boxShadow = "none";
        imageNode.style.margin = "0";
        imageNode.style.imageRendering = "auto";
        imageNode.style.pointerEvents = "none";
        button.insertBefore(imageNode, button.firstChild || null);

        Array.from(button.querySelectorAll("svg")).forEach(function (iconNode) {
          iconNode.style.display = "none";
          iconNode.style.opacity = "0";
          iconNode.style.visibility = "hidden";
        });

        Array.from(button.children).forEach(function (childNode) {
          if (childNode === imageNode) return;
          if (titleNode && (childNode === titleNode || childNode.contains(titleNode))) return;
          childNode.style.display = "none";
          childNode.style.opacity = "0";
          childNode.style.visibility = "hidden";
          childNode.style.pointerEvents = "none";
        });

        if (titleNode) {
          titleNode.style.display = "block";
          titleNode.style.opacity = "1";
          titleNode.style.visibility = "visible";
          titleNode.style.pointerEvents = "none";
          titleNode.style.marginTop = "0.3rem";
          titleNode.style.width = "100%";
          titleNode.style.textAlign = "center";
          titleNode.style.color = "hsl(var(--foreground))";
        }
      }
    });
  }

  function applyMarkup(value, markupPct) {
    const pct = Number(markupPct) || 0;
    return value * (1 + pct / 100);
  }

  function formatDkkAmount(value) {
    const rounded = Math.max(0, Math.round(Number(value) || 0));
    return new Intl.NumberFormat("da-DK").format(rounded);
  }

  function fallbackDeliveryCost(methodId) {
    const id = String(methodId || "").toLowerCase();
    if (id === "standard") return 49;
    if (id === "express" || id === "ekspres") return 199;
    return 0;
  }

  function resolveDeliveryMethodCost(method) {
    if (!method) return 0;
    const explicitPrice = Number(method.price);
    if (Number.isFinite(explicitPrice)) {
      return Math.max(0, Math.round(explicitPrice));
    }
    return fallbackDeliveryCost(method.id);
  }

  function deliveryMethodDaysLabel(method) {
    if (!method) return "";
    const description = String(method.description || "").trim();
    if (description) return description;
    const leadDays = Number(method.leadTimeDays);
    if (Number.isFinite(leadDays) && leadDays > 0) {
      return "ca. " + String(Math.round(leadDays)) + " hverdage";
    }
    return "";
  }

  function parseDateValue(value) {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function parseCutoffTimeValue(value) {
    if (!value) return null;
    const parts = String(value)
      .split(":")
      .map(function (segment) {
        return Number(segment);
      });
    if (parts.length < 2) return null;
    const hours = parts[0];
    const minutes = parts[1];
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours: hours, minutes: minutes };
  }

  function getNextCutoffDate(method) {
    const parsedTime = parseCutoffTimeValue(method && method.cutoffTime);
    if (!parsedTime) return null;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
    if (cutoff.getTime() <= now.getTime()) {
      cutoff.setDate(cutoff.getDate() + 1);
    }
    return cutoff;
  }

  function formatCountdownLabel(targetDate) {
    if (!targetDate) return "";
    const diffMs = targetDate.getTime() - Date.now();
    if (diffMs <= 0) return "0m";
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return String(days) + "d " + String(hours) + "t";
    if (hours > 0) return String(hours) + "t " + String(minutes) + "m";
    return String(minutes) + "m";
  }

  function formatDaDeadline(value) {
    const parsed = parseDateValue(value);
    if (!parsed) return null;
    return new Intl.DateTimeFormat("da-DK", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }

  function calculateM2RateCost(areaM2, quantity, prices, interpolate) {
    const totalArea = Math.max(0, areaM2) * Math.max(1, quantity);
    const list = Array.isArray(prices) ? prices : [];
    if (!list.length || totalArea <= 0) return 0;

    const sorted = list
      .filter(function (row) {
        return Number.isFinite(Number(row.fromM2)) && Number.isFinite(Number(row.pricePerM2));
      })
      .slice()
      .sort(function (a, b) {
        return Number(a.fromM2) - Number(b.fromM2);
      });

    if (!sorted.length) return 0;

    const matchingTier =
      sorted.find(function (tier) {
        const toM2 =
          tier.toM2 === null || tier.toM2 === undefined
            ? Number.POSITIVE_INFINITY
            : Number(tier.toM2);
        return totalArea >= Number(tier.fromM2) && totalArea <= toM2;
      }) || sorted[sorted.length - 1];

    if (!interpolate) {
      return Number(matchingTier.pricePerM2) * totalArea;
    }

    const anchors = sorted.filter(function (tier) {
      return !!tier.isAnchor;
    });
    if (anchors.length < 2) {
      return Number(matchingTier.pricePerM2) * totalArea;
    }

    let lower = anchors[0];
    let upper = anchors[anchors.length - 1];
    for (let index = 0; index < anchors.length - 1; index += 1) {
      if (
        totalArea >= Number(anchors[index].fromM2) &&
        totalArea <= Number(anchors[index + 1].fromM2)
      ) {
        lower = anchors[index];
        upper = anchors[index + 1];
        break;
      }
    }

    const lowerFrom = Number(lower.fromM2) || 0;
    const upperFrom = Number(upper.fromM2) || lowerFrom;
    const lowerRate = Number(lower.pricePerM2) || 0;
    const upperRate = Number(upper.pricePerM2) || lowerRate;

    if (totalArea <= lowerFrom) return lowerRate * totalArea;
    if (totalArea >= upperFrom || upperFrom <= lowerFrom) return upperRate * totalArea;

    const t = (totalArea - lowerFrom) / (upperFrom - lowerFrom);
    const interpolatedRate = lowerRate + t * (upperRate - lowerRate);
    return interpolatedRate * totalArea;
  }

  function pickMaterialForVariant(storformat, variant, runtimeProduct) {
    const materials = (storformat && storformat.materials) || [];
    if (!materials.length) return null;

    const variantKeywords = {
      pvc: ["pvc"],
      mesh: ["mesh"],
      textile: ["tekstil", "textile", "stof"],
      foil: ["folie", "foil", "vinyl"],
      "cut-letters": ["folie", "foil", "vinyl"],
    };
    const keywords = variantKeywords[variant] || [];
    const runtimeName = normalizeText(runtimeProduct ? runtimeProduct.name : "");

    const sorted = materials.slice().sort(function (a, b) {
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    });
    let best = sorted[0];
    let bestScore = -1;

    sorted.forEach(function (material) {
      const name = normalizeText(material.name || "");
      let score = 0;
      keywords.forEach(function (keyword) {
        if (name.includes(keyword)) score += 3;
      });
      if (runtimeName && name.includes(runtimeName)) score += 2;
      if (score > bestScore) {
        best = material;
        bestScore = score;
      }
    });

    return best || null;
  }

  function pickProductItemForVariant(storformat, variant, runtimeProduct) {
    const rawProductItems = (storformat && storformat.productItems) || [];
    const activeProductItemIds =
      runtimeProduct && Array.isArray(runtimeProduct.activeProductItemIds)
        ? runtimeProduct.activeProductItemIds
        : [];
    const productItems = activeProductItemIds.length
      ? rawProductItems.filter(function (item) {
          return activeProductItemIds.includes(item.id);
        })
      : rawProductItems;
    if (!productItems.length) return null;

    const variantKeywords = {
      pvc: ["pvc"],
      mesh: ["mesh"],
      textile: ["tekstil", "textile"],
      foil: ["folie", "foil", "vinyl"],
      "cut-letters": ["bogstav", "bokstav", "letter", "tekst", "text", "folie"],
    };
    const keywords = variantKeywords[variant] || [];
    const runtimeName = normalizeText(runtimeProduct ? runtimeProduct.name : "");

    const sorted = productItems.slice().sort(function (a, b) {
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    });
    let best = sorted[0];
    let bestScore = -1;

    sorted.forEach(function (productItem) {
      const name = normalizeText(productItem.name || "");
      let score = 0;
      keywords.forEach(function (keyword) {
        if (name.includes(keyword)) score += 3;
      });
      if (runtimeName && name.includes(runtimeName)) score += 2;
      if (score > bestScore) {
        best = productItem;
        bestScore = score;
      }
    });

    return best || null;
  }

  function findFinishByKeywords(finishes, keywords, exactKeyword) {
    if (!Array.isArray(finishes) || !finishes.length) return null;
    const sorted = finishes.slice().sort(function (a, b) {
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    });
    return (
      sorted.find(function (finish) {
        const name = normalizeText(finish.name || "");
        const tags = Array.isArray(finish.tags)
          ? finish.tags.map(function (tag) {
              return normalizeText(tag);
            })
          : [];
        const haystack = [name].concat(tags).join(" ");
        if (exactKeyword && !haystack.includes(exactKeyword)) return false;
        return keywords.some(function (keyword) {
          return haystack.includes(keyword);
        });
      }) || null
    );
  }

  function resolveSelectedFinishEntries(storformat, finishState, runtimeProduct) {
    const entries = [];
    const allFinishes = (storformat && storformat.finishes) || [];
    const activeFinishIds =
      runtimeProduct && Array.isArray(runtimeProduct.activeFinishIds)
        ? runtimeProduct.activeFinishIds
        : [];
    const finishes = activeFinishIds.length
      ? allFinishes.filter(function (finish) {
          return activeFinishIds.includes(finish.id);
        })
      : allFinishes;
    if (!finishes.length || !finishState) return entries;

    if (finishState.rings) {
      const ringKeywords = ["ring", "ringe", "oje", "oeje", "oskner", "grommet", "eyelet"];
      const ringBase = findFinishByKeywords(finishes, ringKeywords, null);
      const ring100 = findFinishByKeywords(finishes, ringKeywords, "100");
      if (ringBase) {
        if (Number(finishState.ringSpacingCm) === 100 && ring100) {
          entries.push({
            label: "Ringe hver 100 cm",
            finish: ring100,
            multiplier: 1,
          });
        } else {
          entries.push({
            label:
              "Ringe hver " + String(Number(finishState.ringSpacingCm) === 100 ? 100 : 50) + " cm",
            finish: ringBase,
            multiplier: Number(finishState.ringSpacingCm) === 100 ? 0.5 : 1,
          });
        }
      }
    }

    if (finishState.hemming) {
      const match = findFinishByKeywords(
        finishes,
        ["kantforst", "kantforseg", "svejset", "som", "hem", "forstark"],
        null
      );
      if (match) entries.push({ label: "Kantforstærkning", finish: match, multiplier: 1 });
    }

    if (finishState.pockets) {
      const match = findFinishByKeywords(finishes, ["lomme", "tunnel", "pocket"], null);
      if (match) entries.push({ label: "Tunnel", finish: match, multiplier: 1 });
    }

    if (finishState.keder) {
      const match = findFinishByKeywords(finishes, ["keder"], null);
      if (match) entries.push({ label: "Keder", finish: match, multiplier: 1 });
    }

    if (finishState.doubleSided) {
      const match = findFinishByKeywords(
        finishes,
        ["dobbelt", "double", "4+4", "begge", "both"],
        null
      );
      if (match) entries.push({ label: "4+4 print", finish: match, multiplier: 1 });
    }

    if (finishState.uvLaminate) {
      const match = findFinishByKeywords(finishes, ["uv", "lamin"], null);
      if (match) entries.push({ label: "UV-laminering", finish: match, multiplier: 1 });
    }

    return entries;
  }

  function runtimeProductPricingKey(runtimeProduct) {
    if (!runtimeProduct) return "default";
    return (
      (runtimeProduct.id && String(runtimeProduct.id)) ||
      (runtimeProduct.slug && String(runtimeProduct.slug)) ||
      (runtimeProduct.name && String(runtimeProduct.name)) ||
      "default"
    );
  }

  function getDeliveryMethodsForRuntimeProduct(runtimeProduct) {
    if (
      runtimeProduct &&
      Array.isArray(runtimeProduct.deliveryMethods) &&
      runtimeProduct.deliveryMethods.length
    ) {
      return runtimeProduct.deliveryMethods;
    }
    return DEFAULT_DELIVERY_METHODS.slice();
  }

  function getSelectedDeliveryMethod(runtimeProduct) {
    const methods = getDeliveryMethodsForRuntimeProduct(runtimeProduct);
    if (!methods.length) return null;
    const key = runtimeProductPricingKey(runtimeProduct);
    const selectedId = selectedDeliveryByProductKey[key] || selectedDeliveryByProductKey.default;
    const match = methods.find(function (method) {
      return method.id === selectedId;
    });
    if (match) return match;
    return methods[0] || null;
  }

  function setSelectedDeliveryMethod(runtimeProduct, methodId) {
    const key = runtimeProductPricingKey(runtimeProduct);
    selectedDeliveryByProductKey[key] = methodId || "";
    selectedDeliveryByProductKey.default = methodId || selectedDeliveryByProductKey.default || "";
  }

  function ensureDeliverySelectorUi(
    targetHost,
    runtimeProduct,
    widthCm,
    heightCm,
    variant,
    finishState,
    productOnlyPrice
  ) {
    if (!targetHost) return;
    const methods = getDeliveryMethodsForRuntimeProduct(runtimeProduct);
    let container = targetHost.querySelector("#wp-delivery-selector");

    if (!methods.length) {
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }
      return;
    }

    if (!container) {
      container = document.createElement("div");
      container.id = "wp-delivery-selector";
      container.style.display = "grid";
      container.style.gap = "0.375rem";
      container.style.marginTop = "0.5rem";
      container.style.marginBottom = "0.5rem";
      container.style.position = "relative";
      container.style.zIndex = "6";
      container.style.pointerEvents = "auto";

      const hostFirstChild = targetHost.firstChild;
      if (hostFirstChild) {
        targetHost.insertBefore(container, hostFirstChild);
      } else {
        targetHost.appendChild(container);
      }
    }

    const selected = getSelectedDeliveryMethod(runtimeProduct);
    container.innerHTML = "";

    const title = document.createElement("p");
    title.textContent = "Levering";
    title.style.fontSize = "0.75rem";
    title.style.fontWeight = "600";
    title.style.opacity = "0.8";
    container.appendChild(title);

    const optionsRow = document.createElement("div");
    optionsRow.style.display = "flex";
    optionsRow.style.flexWrap = "wrap";
    optionsRow.style.gap = "0.375rem";
    optionsRow.style.pointerEvents = "auto";
    container.appendChild(optionsRow);

    methods.forEach(function (method) {
      const button = document.createElement("button");
      button.type = "button";
      const isSelected = selected && selected.id === method.id;
      const methodCost = resolveDeliveryMethodCost(method);
      const methodDays = deliveryMethodDaysLabel(method);
      button.textContent =
        (method.name || "Levering") +
        (methodDays ? " · " + methodDays : "") +
        " (" + formatDkkAmount(methodCost) + " kr)";
      button.style.border = isSelected
        ? "1px solid hsl(var(--primary))"
        : "1px solid rgba(148, 163, 184, 0.35)";
      button.style.background = isSelected ? "hsl(var(--primary) / 0.12)" : "rgba(255,255,255,0.72)";
      button.style.color = isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))";
      button.style.borderRadius = "999px";
      button.style.padding = "0.2rem 0.65rem";
      button.style.fontSize = "0.72rem";
      button.style.cursor = "pointer";
      button.style.pointerEvents = "auto";
      const selectDeliveryMethod = function (event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        setSelectedDeliveryMethod(runtimeProduct, method.id);
        applyBackendPricingBridge(widthCm, heightCm, variant, finishState);
        scheduleSync();
      };
      button.addEventListener("pointerdown", selectDeliveryMethod);
      button.addEventListener("keydown", function (event) {
        if (!event) return;
        if (event.key === "Enter" || event.key === " ") {
          selectDeliveryMethod(event);
        }
      });
      optionsRow.appendChild(button);
    });

    const selectedMethod = selected || methods[0] || null;
    if (selectedMethod) {
      const metaLine = document.createElement("p");
      metaLine.style.fontSize = "0.68rem";
      metaLine.style.lineHeight = "1.35";
      metaLine.style.opacity = "0.78";
      metaLine.style.margin = "0";

      const deadlineParts = [];
      const cutoffDate = getNextCutoffDate(selectedMethod);
      if (selectedMethod.cutoffTime) {
        const cutoffPrefix =
          String(selectedMethod.cutoffLabel || "").toLowerCase() === "latest"
            ? "Senest bestilling"
            : "Deadline";
        if (cutoffDate) {
          deadlineParts.push(
            cutoffPrefix +
              " kl. " +
              String(selectedMethod.cutoffTime) +
              " (" +
              formatCountdownLabel(cutoffDate) +
              ")"
          );
        } else {
          deadlineParts.push(cutoffPrefix + " kl. " + String(selectedMethod.cutoffTime));
        }
      }
      const submissionLabel = formatDaDeadline(selectedMethod.submission);
      if (submissionLabel) {
        deadlineParts.push("Bestil senest: " + submissionLabel);
      }
      if (!deadlineParts.length) {
        const leadTimeDays = Number(selectedMethod.leadTimeDays);
        if (Number.isFinite(leadTimeDays) && leadTimeDays > 0) {
          deadlineParts.push("Leveringstid: ca. " + String(Math.round(leadTimeDays)) + " dage");
        }
      }
      if (!deadlineParts.length && selectedMethod.deliveryDate) {
        const deliveryLabel = formatDaDeadline(selectedMethod.deliveryDate);
        if (deliveryLabel) {
          deadlineParts.push("Forventet levering: " + deliveryLabel);
        }
      }
      if (deadlineParts.length) {
        metaLine.textContent = deadlineParts.join(" · ");
        container.appendChild(metaLine);
      }
    }
  }

  function calculateBackendPricingForCurrentState(widthCm, heightCm, variant, finishState) {
    const selectedButton = readSelectedProductButton();
    const runtimeProduct = runtimeProductForVariantSelection(
      variant,
      selectedButton,
      0
    );
    const storformat =
      runtimeProduct && runtimeProduct.storformat
        ? runtimeProduct.storformat
        : (runtimeProducts.find(function (product) {
            return !!product.storformat;
          }) || {}).storformat || null;
    if (!storformat) return null;
    const materials = storformat.materials || [];
    const materialPrices = storformat.m2Prices || [];
    if (!materials.length || !materialPrices.length) return null;

    const config = storformat.config || { roundingStep: 1, globalMarkupPct: 0, quantities: [1] };
    const quantity =
      Array.isArray(config.quantities) && config.quantities.length
        ? Math.max(1, Number(config.quantities[0]) || 1)
        : 1;
    const areaM2 = Math.max(0.0001, (Math.max(1, widthCm) * Math.max(1, heightCm)) / 10000);

    const material = pickMaterialForVariant(storformat, variant, runtimeProduct || null);
    if (!material) return null;
    const materialTierRows = materialPrices.filter(function (row) {
      return row.materialId === material.id;
    });
    if (!materialTierRows.length) return null;

    const materialBase = calculateM2RateCost(
      areaM2,
      quantity,
      materialTierRows,
      material.interpolationEnabled !== false
    );
    const materialCost = applyMarkup(materialBase, material.markupPct || 0);

    const productItem = pickProductItemForVariant(storformat, variant, runtimeProduct || null);
    const productFixedPrices = storformat.productFixedPrices || [];
    const productPriceTiers = storformat.productPriceTiers || [];
    let productBase = 0;
    let productCost = 0;
    if (productItem) {
      const pricingType = String(productItem.pricingType || "fixed").toLowerCase();
      if (pricingType === "fixed") {
        const fixedMatch = productFixedPrices.find(function (row) {
          return row.productItemId === productItem.id && Number(row.quantity) === quantity;
        });
        productBase = (Number(productItem.initialPrice) || 0) + (fixedMatch ? Number(fixedMatch.price) || 0 : 0);
      } else if (pricingType === "per_item") {
        const fixedMatch = productFixedPrices.find(function (row) {
          return row.productItemId === productItem.id && Number(row.quantity) === quantity;
        });
        productBase = fixedMatch ? Number(fixedMatch.price) || 0 : 0;
      } else if (pricingType === "percentage") {
        productBase = materialCost * ((Number(productItem.percentageMarkup) || 0) / 100);
      } else if (pricingType === "m2") {
        const tiers = productPriceTiers.filter(function (row) {
          return row.productItemId === productItem.id;
        });
        productBase = calculateM2RateCost(
          areaM2,
          quantity,
          tiers,
          productItem.interpolationEnabled !== false
        );
      }
      productCost = applyMarkup(productBase, productItem.markupPct || 0);
    }

    const selectedFinishEntries = resolveSelectedFinishEntries(
      storformat,
      finishState,
      runtimeProduct || null
    );
    const finishPriceRows = storformat.finishPrices || [];
    let finishCost = 0;
    const finishBreakdown = selectedFinishEntries
      .map(function (entry) {
        if (!entry || !entry.finish) return null;
        const finishMeta = entry.finish;
        const finishPrice = finishPriceRows.find(function (row) {
          return row.finishId === finishMeta.id;
        });
        const pricingMode = finishPrice
          ? finishPrice.pricingMode
          : finishMeta.pricingMode || "fixed";
        let base =
          pricingMode === "per_m2"
            ? (finishPrice ? Number(finishPrice.pricePerM2) || 0 : 0) *
              areaM2 *
              quantity
            : (finishPrice
                ? Number(finishPrice.fixedPrice) || 0
                : Number(finishMeta.fixedPricePerUnit) || 0) * quantity;
        base = base * (Number(entry.multiplier) || 1);
        const cost = applyMarkup(base, finishMeta.markupPct || 0);
        finishCost += cost;
        return {
          label: entry.label,
          cost: cost,
        };
      })
      .filter(Boolean);

    const subtotal = materialCost + productCost + finishCost;
    const globalMarkupPct = Number(config.globalMarkupPct) || 0;
    const roundingStep = Math.max(1, Number(config.roundingStep) || 1);
    const totalBeforeRounding = subtotal * (1 + globalMarkupPct / 100);
    let totalPrice = Math.round(totalBeforeRounding / roundingStep) * roundingStep;

    const minPrice = material.minPrice || (productItem ? Number(productItem.minPrice) || 0 : 0);
    if (minPrice > 0 && totalPrice < minPrice) {
      totalPrice = minPrice;
    }

    const deliveryMethod = getSelectedDeliveryMethod(runtimeProduct || null);
    const shippingCost = resolveDeliveryMethodCost(deliveryMethod);
    const totalWithShipping = Math.max(0, totalPrice + shippingCost);

    const displayFactor = 1 + globalMarkupPct / 100;
    return {
      totalPrice: totalWithShipping,
      productOnlyPrice: totalPrice,
      basePrice: (materialCost + productCost) * displayFactor,
      finishBreakdown: finishBreakdown.map(function (row) {
        return {
          label: row.label,
          cost: row.cost * displayFactor,
        };
      }),
      shippingCost: shippingCost,
      shippingMethodId: deliveryMethod ? deliveryMethod.id : null,
      shippingMethodName: deliveryMethod ? deliveryMethod.name : null,
      selectedProductName:
        runtimeProduct
          ? (runtimeProduct.name || "").trim() ||
            (runtimeProduct.iconText || "").trim() ||
            "Produkt"
          : "Produkt",
      quantity: quantity,
      runtimeProduct: runtimeProduct || null,
    };
  }

  function updateBackendPriceSummaryDisplay(pricingResult, widthCm, heightCm, selectedTitle) {
    const target = findPriceSummaryHost();
    if (!target || !target.orderButton) return;

    const summaryCard =
      target.orderButton.closest("div.rounded-xl") ||
      target.orderButton.closest("div");
    if (!summaryCard) return;

    const headingNode = summaryCard.querySelector("h3");
    const leftColumn = headingNode && headingNode.parentElement ? headingNode.parentElement : null;
    const title = (selectedTitle || pricingResult.selectedProductName || "Produkt").trim();
    const sizeLabel = String(Math.round(widthCm)) + " × " + String(Math.round(heightCm)) + " cm";
    const finishLabels = Array.isArray(pricingResult.finishBreakdown)
      ? pricingResult.finishBreakdown
          .map(function (line) {
            return String((line && line.label) || "").trim();
          })
          .filter(Boolean)
      : [];
    const finishLabel = finishLabels.length ? finishLabels.join(", ") : "Ingen";
    const deliveryLabel = String(pricingResult.shippingMethodName || "Standard levering").trim();

    if (leftColumn) {
      if (headingNode) {
        setSimpleNodeText(headingNode, title + " — " + sizeLabel);
      }

      Array.from(leftColumn.querySelectorAll("div"))
        .filter(function (node) {
          return node.id !== BACKEND_PRICING_BREAKDOWN_ID;
        })
        .forEach(function (node) {
          node.style.display = "none";
          node.style.maxHeight = "0";
          node.style.overflow = "hidden";
          node.style.margin = "0";
          node.style.padding = "0";
        });
      Array.from(leftColumn.querySelectorAll("p")).forEach(function (node) {
        if (node.closest("#" + BACKEND_PRICING_BREAKDOWN_ID)) return;
        const text = normalizeText(node.textContent);
        if (!text) return;
        node.style.display = "none";
        node.style.maxHeight = "0";
        node.style.overflow = "hidden";
        node.style.margin = "0";
        node.style.padding = "0";
      });

      let breakdownContainer = leftColumn.querySelector("#" + BACKEND_PRICING_BREAKDOWN_ID);
      if (!breakdownContainer) {
        breakdownContainer = document.createElement("div");
        breakdownContainer.id = BACKEND_PRICING_BREAKDOWN_ID;
        breakdownContainer.style.display = "grid";
        breakdownContainer.style.gap = "0.125rem";
        breakdownContainer.style.fontSize = "0.78rem";
        breakdownContainer.style.color = "hsl(var(--muted-foreground))";
        breakdownContainer.style.marginTop = "0.2rem";
        leftColumn.appendChild(breakdownContainer);
      }
      breakdownContainer.replaceChildren();

      const finishLine = document.createElement("p");
      finishLine.textContent = "Efterbehandling: " + finishLabel;
      breakdownContainer.appendChild(finishLine);

      const deliveryLine = document.createElement("p");
      deliveryLine.textContent = "Levering: " + deliveryLabel;
      breakdownContainer.appendChild(deliveryLine);
    }

    const totalHost = target.orderButton.parentElement || target.host;
    const totalNode =
      (totalHost &&
        (totalHost.querySelector("p.font-pricing") ||
          totalHost.querySelector("p[class*='font-pricing']"))) ||
      Array.from((totalHost || target.host).querySelectorAll("p")).find(function (node) {
        return normalizeText(node.textContent).includes("dkk");
      }) || null;
    if (totalNode) {
      if (!setSimpleNodeText(totalNode, formatDkkAmount(pricingResult.totalPrice) + " DKK")) {
        setNodeLeadingPriceText(totalNode, formatDkkAmount(pricingResult.totalPrice));
      }
    }
  }

  function applyBackendPricingBridge(widthCm, heightCm, variant, finishState) {
    const selectedButton = readSelectedProductButton();
    const selectedMeta = selectedButton
      ? readProductButtonMeta(selectedButton, variant)
      : null;
    const pricingResult = calculateBackendPricingForCurrentState(
      widthCm,
      heightCm,
      variant,
      finishState
    );
    if (!pricingResult) {
      lastBackendPricingResult = null;
      return null;
    }

    lastBackendPricingResult = pricingResult;
    updateBackendPriceSummaryDisplay(
      pricingResult,
      widthCm,
      heightCm,
      selectedMeta ? selectedMeta.title : ""
    );
    const deliveryHost = findPriceSummaryHost();
    ensureDeliverySelectorUi(
      deliveryHost ? deliveryHost.host : null,
      pricingResult.runtimeProduct || null,
      widthCm,
      heightCm,
      variant,
      finishState,
      pricingResult.productOnlyPrice
    );
    return pricingResult;
  }

  function parsePriceFromText(text) {
    if (!text) return null;
    const normalized = String(text).replace(/\s+/g, " ").trim();
    const match = normalized.match(/(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?)\s*kr/i);
    if (!match) return null;

    const numeric = match[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function readCheckoutPriceValue() {
    const priceSection = document.getElementById("prisberegner");
    if (!priceSection) return 0;

    const nodes = Array.from(priceSection.querySelectorAll("p, span, div, strong, h2, h3"));
    let totalCandidate = null;
    let fallbackCandidate = 0;

    nodes.forEach(function (node) {
      const text = (node.textContent || "").trim();
      if (!text) return;

      const price = parsePriceFromText(text);
      if (price === null) return;
      fallbackCandidate = Math.max(fallbackCandidate, price);

      const normalized = normalizeText(text);
      if (normalized.includes("total") || normalized.includes("i alt")) {
        totalCandidate = Math.max(totalCandidate || 0, price);
      }
    });

    return totalCandidate || fallbackCandidate || 0;
  }

  function readCheckoutTenantId() {
    const directParams = new URLSearchParams(window.location.search);
    const fromCurrent = directParams.get("tenantId") || directParams.get("tenant_id");
    if (fromCurrent) return fromCurrent;

    try {
      if (window.top && window.top !== window && window.top.location) {
        const topParams = new URLSearchParams(window.top.location.search);
        const fromTop = topParams.get("tenantId") || topParams.get("tenant_id");
        if (fromTop) return fromTop;
      }
    } catch (_error) {
      // Ignore cross-context access errors.
    }

    try {
      const raw = sessionStorage.getItem(PREVIEW_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.tenantId === "string" && parsed.tenantId.trim()) {
        return parsed.tenantId;
      }
    } catch (_error) {
      // Ignore malformed session payload.
    }

    return null;
  }

  function collectSelectedFinishes(finishState) {
    const selected = [];
    if (!finishState) return selected;
    if (finishState.rings) selected.push("Ringe hver " + (finishState.ringSpacingCm || 50) + " cm");
    if (finishState.hemming) selected.push("Kantforstærkning");
    if (finishState.pockets) selected.push("Tunnel");
    if (finishState.keder) selected.push("Keder");
    if (finishState.doubleSided) selected.push("4+4 print");
    if (finishState.uvLaminate) selected.push("UV-laminering");
    return selected;
  }

  function buildSiteUploadPreviewDataUrl() {
    if (!uploadedDesign || !refs || !refs.designImage) return null;

    const sourceImage = refs.designImage;
    const sourceWidth = sourceImage.naturalWidth || uploadedDesign.widthPx || 0;
    const sourceHeight = sourceImage.naturalHeight || uploadedDesign.heightPx || 0;
    if (sourceWidth <= 0 || sourceHeight <= 0) return null;

    const maxSidePx = 1200;
    const scale = Math.min(1, maxSidePx / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    try {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);
      return canvas.toDataURL("image/jpeg", 0.9);
    } catch (_error) {
      return null;
    }
  }

  function writeCheckoutSessionPayload(payload) {
    try {
      if (window.top && window.top.sessionStorage) {
        window.top.sessionStorage.setItem(
          SITE_CHECKOUT_SESSION_KEY,
          JSON.stringify(payload)
        );
        return true;
      }
    } catch (_error) {
      // Ignore and fall through.
    }

    try {
      sessionStorage.setItem(SITE_CHECKOUT_SESSION_KEY, JSON.stringify(payload));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function resolveCheckoutSelectedProduct(variant) {
    const selectedButton = readSelectedProductButton();
    const selectedButtonTitle = selectedButton
      ? readProductButtonMeta(selectedButton, variant).title
      : "";
    const runtimeProduct = runtimeProductForVariantSelection(
      variant,
      selectedButton,
      0
    );

    if (runtimeProduct) {
      const resolvedSlug = (runtimeProduct.slug || "").trim();
      if (resolvedSlug) {
        return {
          id: runtimeProduct.id || null,
          slug: resolvedSlug,
          name:
            selectedButtonTitle ||
            (runtimeProduct.name || "").trim() ||
            (runtimeProduct.iconText || "").trim() ||
            "Produkt",
        };
      }
    }

    const fallbackConfig =
      CHECKOUT_PRODUCT_BY_VARIANT[variant] || CHECKOUT_PRODUCT_BY_VARIANT.default;
    const fallbackTitle = selectedButtonTitle;

    return {
      id: null,
      slug: fallbackConfig.slug,
      name: fallbackTitle || fallbackConfig.name,
    };
  }

  function handleCheckoutOrderClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const dimensions = readDimensions();
    const widthCm = clamp(dimensions.widthCm, 1, 5000);
    const heightCm = clamp(dimensions.heightCm, 1, 5000);
    const finish = readFinishSelection();
    const variant = readProductVariant();
    const backendPricing =
      applyBackendPricingBridge(widthCm, heightCm, variant, finish) ||
      lastBackendPricingResult;
    const selectedCheckoutProduct = resolveCheckoutSelectedProduct(variant);
    const selectedFinishes = collectSelectedFinishes(finish);
    const productOnlyPrice = backendPricing
      ? Math.round(
          Number(
            backendPricing.productOnlyPrice !== undefined
              ? backendPricing.productOnlyPrice
              : backendPricing.totalPrice
          ) || 0
        )
      : readCheckoutPriceValue();
    const shippingCost = backendPricing
      ? Math.max(0, Math.round(Number(backendPricing.shippingCost) || 0))
      : 0;
    const totalPrice = Math.max(0, productOnlyPrice + shippingCost);
    const shippingSelected =
      backendPricing && backendPricing.shippingMethodId
        ? String(backendPricing.shippingMethodId)
        : null;
    const uploadMetrics = computeCurrentUploadMetrics(widthCm, heightCm);
    const uploadPreviewDataUrl = buildSiteUploadPreviewDataUrl();
    const tenantId = readCheckoutTenantId();
    const sizeText = Math.round(widthCm) + "x" + Math.round(heightCm) + " cm";
    const selectedSummary = [
      selectedCheckoutProduct.name,
      sizeText,
      selectedFinishes.length ? selectedFinishes.join(", ") : "Ingen finish",
    ].join(" • ");

    const checkoutPayload = {
      productId: selectedCheckoutProduct.id || null,
      productSlug: selectedCheckoutProduct.slug,
      productName: selectedCheckoutProduct.name,
      quantity: 1,
      productPrice: productOnlyPrice,
      extraPrice: 0,
      totalPrice: totalPrice,
      shippingCost: shippingCost,
      shippingSelected: shippingSelected,
      selectedFormat: sizeText,
      summary: selectedSummary,
      designWidthMm: Math.round(widthCm * 10),
      designHeightMm: Math.round(heightCm * 10),
      designBleedMm: 3,
      sourceSiteId: "banner-builder-pro",
      optionSelections: selectedFinishes.reduce(function (acc, label, index) {
        acc["finish_" + String(index + 1)] = {
          name: label,
          optionId: normalizeText(label).replace(/\s+/g, "-"),
          extraPrice: 0,
          priceMode: "fixed",
        };
        return acc;
      }, {}),
      siteUpload: uploadedDesign
        ? {
            name: uploadedDesign.name || "banner-upload",
            mimeType: uploadedDesign.type || "image/jpeg",
            widthPx: uploadedDesign.widthPx || null,
            heightPx: uploadedDesign.heightPx || null,
            estimatedDpi: uploadMetrics ? Math.round(uploadMetrics.effectiveDpi) : null,
            previewDataUrl: uploadPreviewDataUrl,
          }
        : null,
      createdAt: new Date().toISOString(),
    };

    writeCheckoutSessionPayload(checkoutPayload);

    const params = new URLSearchParams();
    params.set("siteCheckout", "1");
    params.set("siteId", "banner-builder-pro");
    if (tenantId) {
      params.set("tenantId", tenantId);
    }

    const checkoutPath = "/checkout/konfigurer?" + params.toString();
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = checkoutPath;
      } else {
        window.location.href = checkoutPath;
      }
    } catch (_error) {
      window.location.href = checkoutPath;
    }
  }

  function ensureCheckoutOrderBridge() {
    const target = findPriceSummaryHost();
    if (!target || !target.orderButton) return;

    const orderButton = target.orderButton;
    if (orderButton.dataset.wpCheckoutBound === "1") return;
    orderButton.dataset.wpCheckoutBound = "1";
    orderButton.addEventListener("click", handleCheckoutOrderClick);
  }

  function ensureUploadActionInPriceField() {
    if (!refs || !refs.fileInput || !refs.uploadInfoBox) return;

    const legacyContainer = document.getElementById(UPLOAD_ACTION_CONTAINER_ID);
    if (legacyContainer && legacyContainer.parentElement) {
      legacyContainer.parentElement.removeChild(legacyContainer);
    }

    let button = refs.uploadInfoBox.querySelector("#" + UPLOAD_ACTION_BUTTON_ID);
    if (!button) {
      button = createElement("button");
      button.id = UPLOAD_ACTION_BUTTON_ID;
      button.type = "button";
      button.textContent = UPLOAD_ACTION_BUTTON_LABEL;
      button.style.alignSelf = "flex-end";
      button.style.marginTop = "0.35rem";
      button.style.pointerEvents = "auto";
      button.addEventListener("click", function () {
        refs.fileInput.click();
      });
      refs.uploadInfoBox.appendChild(button);
    }

    const target = findPriceSummaryHost();
    if (target && target.orderButton) {
      button.className = target.orderButton.className || "";
    }

    refs.uploadInfoBox.style.pointerEvents = "auto";
  }

  function applyAngivMalOverlayPosition() {
    const angivMalBlock = findBlockByHeading("angiv mal");
    if (!angivMalBlock) return;

    const overlayOffset =
      window.innerWidth <= 768
        ? ANGIV_MAL_OVERLAY_MOBILE_PX
        : ANGIV_MAL_OVERLAY_DESKTOP_PX;

    angivMalBlock.style.position = "relative";
    angivMalBlock.style.zIndex = "8";
    angivMalBlock.style.marginTop = "-" + overlayOffset + "px";
  }

  function readDimensions() {
    const angivMalBlock = findBlockByHeading("angiv mal");
    if (!angivMalBlock) return { widthCm: DEFAULT_WIDTH_CM, heightCm: DEFAULT_HEIGHT_CM };

    const inputs = Array.from(
      angivMalBlock.querySelectorAll("input[type='number']")
    );
    const widthInput = inputs[0];
    const heightInput = inputs[1];

    const widthCm = clamp(
      parseNumber(widthInput ? widthInput.value : DEFAULT_WIDTH_CM, DEFAULT_WIDTH_CM),
      1,
      5000
    );
    const heightCm = clamp(
      parseNumber(heightInput ? heightInput.value : DEFAULT_HEIGHT_CM, DEFAULT_HEIGHT_CM),
      1,
      5000
    );

    return { widthCm, heightCm };
  }

  function readFinishSelection() {
    const result = {
      rings: false,
      ringSpacingCm: DEFAULT_RING_SPACING_CM,
      hemming: false,
      pockets: false,
      keder: false,
      uvLaminate: false,
      doubleSided: false,
    };

    const finishingBlock = findBlockByHeading("finishing");
    if (!finishingBlock) return result;
    const ring100Button = finishingBlock.querySelector(
      "#" + RING_SPACING_100_BUTTON_ID
    );
    const ring100Selected = isFinishingButtonSelected(ring100Button);

    const buttons = Array.from(finishingBlock.querySelectorAll("button"));
    buttons.forEach(function (button) {
      if (
        button.id === RING_SPACING_100_BUTTON_ID ||
        button.id === LEGACY_RING_SPACING_BUTTON_ID
      ) {
        return;
      }

      const isSelected =
        button.classList.contains("border-primary") ||
        button.classList.contains("bg-primary/5");

      if (!isSelected) return;

      const labelNode =
        button.querySelector("span.text-sm") || button.querySelector("span");
      const label = normalizeText(labelNode ? labelNode.textContent : button.textContent);
      const buttonText = normalizeText(button.textContent);
      const spacingMatch = buttonText.match(/(\d+)\s*cm/);

      if (label.includes("ringe") || label.includes("oje")) {
        result.rings = true;
        result.ringSpacingCm = spacingMatch ? clamp(parseNumber(spacingMatch[1], DEFAULT_RING_SPACING_CM), 10, 500) : DEFAULT_RING_SPACING_CM;
      }
      if (
        label.includes("kantforsegling") ||
        label.includes("kantforstaerkning") ||
        label.includes("som")
      ) {
        result.hemming = true;
      }
      if (label.includes("lommer")) result.pockets = true;
      if (label.includes("keder")) result.keder = true;
      if (label.includes("uv-laminering")) result.uvLaminate = true;
      if (label.includes("dobbeltsidet")) result.doubleSided = true;
    });

    if (ring100Selected) {
      result.rings = true;
      result.ringSpacingCm = 100;
      return result;
    }

    if (result.rings && ringSpacingMode === "100") {
      result.ringSpacingCm = 100;
    }

    return result;
  }

  function readProductVariant() {
    const productBlock = findBlockByHeading("vaelg produkt");
    if (!productBlock) return "default";

    const selectedButton = Array.from(productBlock.querySelectorAll("button")).find(
      function (button) {
        return isFinishingButtonSelected(button);
      }
    );
    if (!selectedButton) return "default";

    const labelNode = selectedButton.querySelector("span") || selectedButton;
    const label = normalizeText(labelNode ? labelNode.textContent : selectedButton.textContent);

    if (
      label.includes("udska") &&
      (label.includes("bogstav") || label.includes("bokstav") || label.includes("letter"))
    ) {
      return "cut-letters";
    }
    if (label.includes("mesh")) return "mesh";
    if (label.includes("tekstil")) return "textile";
    if (label.includes("vinduesfolie") || label.includes("folie")) return "foil";
    if (label.includes("pvc")) return "pvc";
    return "default";
  }

  function productVariantInfoText(variant) {
    if (variant === "pvc") {
      return "Klassisk PVC-banner med klar farve og solid overflade uden gennemsigtighed.";
    }
    if (variant === "mesh") {
      return "Mesh-banner med fine perforeringer, let gennemsigtighed og luftgennemgang.";
    }
    if (variant === "textile") {
      return "Tekstilbanner med fin vaevet struktur, blodt udtryk og meget let transparens.";
    }
    if (variant === "foil") {
      return "Folie med glat overflade og ekstra shine i lyset.";
    }
    if (variant === "cut-letters") {
      return "Udskårende bogstaver sat op som folie-tekst pa et vinduesfelt.";
    }
    return "";
  }

  function readProductButtonMeta(button, variant) {
    const runtimeTitle = (button.getAttribute("data-wp-runtime-title") || "").trim();
    const runtimeDescription = (
      button.getAttribute("data-wp-runtime-description") || ""
    ).trim();

    const titleNode =
      button.querySelector("span.text-sm, span.font-medium, span") || button;
    const fallbackTitle = (
      titleNode ? titleNode.textContent : button.textContent || ""
    ).trim();
    const title = runtimeTitle || fallbackTitle;

    const descriptionNode = Array.from(
      button.querySelectorAll(
        "p, small, span.text-xs, div.text-xs, [class*='text-muted-foreground']"
      )
    ).find(function (node) {
      const text = (node.textContent || "").trim();
      return text && text !== title;
    });

    const description = descriptionNode
      ? (descriptionNode.textContent || "").trim()
      : runtimeDescription || productVariantInfoText(variant);

    return {
      title,
      description: runtimeDescription || description,
    };
  }

  function ensureProductVariantSelectionTracking() {
    const productBlock = findBlockByHeading("vaelg produkt");
    if (!productBlock) return;
    if (productBlock.dataset.wpVariantSelectionBound === "1") return;

    productBlock.dataset.wpVariantSelectionBound = "1";
    productBlock.addEventListener("click", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      const button = target ? target.closest("button") : null;
      if (!button || !productBlock.contains(button)) return;
      Array.from(productBlock.querySelectorAll("button[" + PRODUCT_BUTTON_ACTIVE_ATTR + "]")).forEach(
        function (node) {
          node.removeAttribute(PRODUCT_BUTTON_ACTIVE_ATTR);
        }
      );
      Array.from(productBlock.querySelectorAll("button[" + PRODUCT_BUTTON_HOVER_ATTR + "]")).forEach(
        function (node) {
          node.removeAttribute(PRODUCT_BUTTON_HOVER_ATTR);
        }
      );
      button.setAttribute(PRODUCT_BUTTON_ACTIVE_ATTR, "1");
      hasUserSelectedProductVariant = true;
      productInfoAnimationNonce += 1;
      window.setTimeout(scheduleSync, 0);
    });
  }

  function ensureProductVariantHoverTracking() {
    const productBlock = findBlockByHeading("vaelg produkt");
    if (!productBlock) return;

    const clearHover = function () {
      Array.from(productBlock.querySelectorAll("button[" + PRODUCT_BUTTON_HOVER_ATTR + "]")).forEach(
        function (node) {
          node.removeAttribute(PRODUCT_BUTTON_HOVER_ATTR);
        }
      );
    };

    Array.from(productBlock.querySelectorAll("button")).forEach(function (button) {
      if (button.dataset.wpVariantHoverBound === "1") return;
      button.dataset.wpVariantHoverBound = "1";

      button.addEventListener("mouseenter", function () {
        clearHover();
        button.setAttribute(PRODUCT_BUTTON_HOVER_ATTR, "1");
        productInfoAnimationNonce += 1;
        window.setTimeout(scheduleSync, 0);
      });

      button.addEventListener("mouseleave", function () {
        if (button.getAttribute(PRODUCT_BUTTON_HOVER_ATTR) === "1") {
          button.removeAttribute(PRODUCT_BUTTON_HOVER_ATTR);
          productInfoAnimationNonce += 1;
          window.setTimeout(scheduleSync, 0);
        }
      });
    });

    if (productBlock.dataset.wpVariantHoverContainerBound !== "1") {
      productBlock.dataset.wpVariantHoverContainerBound = "1";
      productBlock.addEventListener("mouseleave", function () {
        clearHover();
        productInfoAnimationNonce += 1;
        window.setTimeout(scheduleSync, 0);
      });
    }
  }

  function ensureProductButtonDescriptionsHidden() {
    const productBlock = findBlockByHeading("vaelg produkt");
    if (!productBlock) return;

    Array.from(productBlock.querySelectorAll("button")).forEach(function (button) {
      const titleNode =
        button.querySelector("span.text-sm, span.font-medium, span") || null;
      Array.from(
        button.querySelectorAll(
          "p, small, span, div, [class*='text-muted-foreground']"
        )
      ).forEach(function (node) {
        if (titleNode && (node === titleNode || node.contains(titleNode))) return;
        const text = (node.textContent || "").trim();
        if (!text) return;
        node.style.display = "none";
        node.style.margin = "0";
        node.style.maxHeight = "0";
        node.style.overflow = "hidden";
      });
    });

    Array.from(
      productBlock.querySelectorAll(
        "p, small, span.text-xs, div.text-xs, .text-sm.text-muted-foreground, [class*='text-muted-foreground']"
      )
    ).forEach(function (node) {
      if (node.closest("#" + PRODUCT_INFO_CARD_ID)) return;
      if (node.closest("h3")) return;
      if (node.closest("button")) return;
      const text = (node.textContent || "").trim();
      if (!text) return;
      node.style.display = "none";
      node.style.maxHeight = "0";
      node.style.overflow = "hidden";
      node.style.margin = "0";
      node.style.padding = "0";
    });
  }

  function ensureProductVariantInfoCard(variant) {
    const productBlock = findBlockByHeading("vaelg produkt");
    if (!productBlock) return;

    let card = document.getElementById(PRODUCT_INFO_CARD_ID);
    if (!card) {
      card = createElement("div");
      card.id = PRODUCT_INFO_CARD_ID;
      card.style.position = "absolute";
      card.style.left = "50%";
      card.style.top = "0";
      card.style.width = "260px";
      card.style.maxWidth = "calc(100% - 12px)";
      card.style.borderRadius = "10px";
      card.style.background = "hsl(var(--card) / 0.96)";
      card.style.border = "1px solid hsl(var(--border) / 0.8)";
      card.style.boxShadow = "0 8px 18px rgba(2,6,23,0.08)";
      card.style.transition =
        "opacity " +
        PRODUCT_INFO_ANIMATION_MS +
        "ms cubic-bezier(0.2, 0.65, 0.2, 1), transform " +
        PRODUCT_INFO_ANIMATION_MS +
        "ms cubic-bezier(0.2, 0.65, 0.2, 1), max-height " +
        PRODUCT_INFO_ANIMATION_MS +
        "ms cubic-bezier(0.2, 0.65, 0.2, 1), padding " +
        PRODUCT_INFO_ANIMATION_MS +
        "ms cubic-bezier(0.2, 0.65, 0.2, 1)";
      card.style.opacity = "0";
      card.style.transform = "translate(-50%, -8px)";
      card.style.maxHeight = "0";
      card.style.overflow = "hidden";
      card.style.padding = "0 0.65rem";
      card.style.pointerEvents = "none";
      card.style.zIndex = "9";

      const title = createElement("div", "text-xs font-medium");
      title.setAttribute("data-product-info-title", "1");
      title.style.fontSize = "0.66rem";
      title.style.lineHeight = "1.2";
      title.style.marginBottom = "0.15rem";
      card.appendChild(title);

      const body = createElement("p", "text-xs text-muted-foreground");
      body.setAttribute("data-product-info-body", "1");
      body.style.fontSize = "0.62rem";
      body.style.margin = "0";
      body.style.lineHeight = "1.28";
      card.appendChild(body);

      productBlock.appendChild(card);
    }

    productBlock.style.position = "relative";
    const hoveredButton =
      productBlock.querySelector("button[" + PRODUCT_BUTTON_HOVER_ATTR + "='1']");
    const selectedButton =
      hoveredButton ||
      productBlock.querySelector("button[" + PRODUCT_BUTTON_ACTIVE_ATTR + "='1']") ||
      Array.from(productBlock.querySelectorAll("button")).find(function (button) {
        return isFinishingButtonSelected(button);
      });

    const infoText = productVariantInfoText(variant);
    const meta = selectedButton ? readProductButtonMeta(selectedButton, variant) : null;
    const resolvedDescription = meta ? (meta.description || infoText || "").trim() : "";
    const shouldShow =
      !!selectedButton && (hasUserSelectedProductVariant || !!hoveredButton);
    if (!shouldShow) {
      card.style.opacity = "0";
      card.style.transform = "translate(-50%, -8px)";
      card.style.maxHeight = "0";
      card.style.padding = "0 0.65rem";
      card.style.pointerEvents = "none";
      productBlock.style.paddingBottom = "0";
      lastAnimatedProductVariant = "default";
      lastAnimatedProductInfoKey = "";
      lastAnimatedProductInfoNonce = -1;
      return;
    }

    const titleNode = card.querySelector("[data-product-info-title='1']");
    const bodyNode = card.querySelector("[data-product-info-body='1']");
    if (titleNode) titleNode.textContent = meta ? meta.title : "";
    if (bodyNode) {
      bodyNode.textContent = resolvedDescription || "Valgt produkt.";
    }
    const buttonIndex = Array.from(productBlock.querySelectorAll("button")).indexOf(
      selectedButton
    );
    const selectedInfoKey =
      variant +
      "|" +
      String(buttonIndex) +
      "|" +
      String(meta.title || "").trim() +
      "|" +
      (hoveredButton ? "hover" : "selected");

    const blockRect = productBlock.getBoundingClientRect();
    const buttonRect = selectedButton.getBoundingClientRect();
    const rawCenterX = buttonRect.left - blockRect.left + buttonRect.width / 2;
    const cardWidth = clamp(
      Math.round(Math.min(220, Math.max(148, buttonRect.width + 18))),
      148,
      220
    );
    const half = cardWidth / 2;
    const centerX = clamp(
      rawCenterX,
      half + 6,
      Math.max(half + 6, blockRect.width - half - 6)
    );
    const top = buttonRect.bottom - blockRect.top + 8;

    card.style.width = cardWidth + "px";
    card.style.left = centerX.toFixed(2) + "px";
    card.style.top = top.toFixed(2) + "px";
    const selectionChanged =
      selectedInfoKey !== lastAnimatedProductInfoKey ||
      productInfoAnimationNonce !== lastAnimatedProductInfoNonce;
    if (selectionChanged) {
      card.style.opacity = "0";
      card.style.transform = "translate(-50%, -10px)";
      card.style.maxHeight = "0";
      card.style.padding = "0 0.65rem";
      card.style.pointerEvents = "none";
      void card.offsetHeight;
      window.requestAnimationFrame(function () {
        card.style.opacity = "1";
        card.style.transform = "translate(-50%, 0)";
        card.style.maxHeight = "124px";
        card.style.padding = "0.55rem 0.65rem";
        card.style.pointerEvents = "auto";
      });
      lastAnimatedProductVariant = variant;
      lastAnimatedProductInfoKey = selectedInfoKey;
      lastAnimatedProductInfoNonce = productInfoAnimationNonce;
    } else {
      card.style.opacity = "1";
      card.style.transform = "translate(-50%, 0)";
      card.style.maxHeight = "124px";
      card.style.padding = "0.55rem 0.65rem";
      card.style.pointerEvents = "auto";
    }
    productBlock.style.paddingBottom = "0";
  }

  function updateUploadPromptState(variant) {
    if (!refs || !refs.uploadInfoBox || !refs.uploadMiniPrompt) return;
    if (variant === "cut-letters") {
      refs.uploadMiniPrompt.style.opacity = "0";
      refs.uploadMiniPrompt.style.transform = "translateY(-6px)";
      refs.uploadMiniPrompt.style.pointerEvents = "none";
      refs.uploadInfoBox.style.opacity = "0";
      refs.uploadInfoBox.style.transform = "translateY(-8px)";
      refs.uploadInfoBox.style.pointerEvents = "none";
      return;
    }
    const shouldShowInfoBox = !!uploadedDesign;
    const shouldShowMiniPrompt = !uploadedDesign;

    if (shouldShowInfoBox) {
      refs.uploadMiniPrompt.style.opacity = "0";
      refs.uploadMiniPrompt.style.transform = "translateY(-6px)";
      refs.uploadMiniPrompt.style.pointerEvents = "none";
      refs.uploadInfoBox.style.opacity = "1";
      refs.uploadInfoBox.style.transform = "translateY(0)";
      refs.uploadInfoBox.style.pointerEvents = "auto";
      return;
    }

    refs.uploadMiniPrompt.style.opacity = shouldShowMiniPrompt ? "1" : "0";
    refs.uploadMiniPrompt.style.transform = shouldShowMiniPrompt
      ? "translateY(0)"
      : "translateY(-6px)";
    refs.uploadMiniPrompt.style.pointerEvents = shouldShowMiniPrompt
      ? "auto"
      : "none";
    refs.uploadInfoBox.style.opacity = "0";
    refs.uploadInfoBox.style.transform = "translateY(-8px)";
    refs.uploadInfoBox.style.pointerEvents = "none";
  }

  function measureCutLettersFoilLayout(foil, frameWidthPx, frameHeightPx) {
    const safeFrameWidth = Math.max(1, frameWidthPx);
    const safeFrameHeight = Math.max(1, frameHeightPx);
    const textValue = (foil && foil.text ? String(foil.text) : "").trim() || CUT_LETTERS_DEFAULT_TEXT;
    const fontName = CUT_LETTERS_FONTS.includes(foil && foil.fontName)
      ? foil.fontName
      : CUT_LETTERS_FONTS[0];
    const scale = clamp(
      parseNumber(foil && foil.scale, CUT_LETTERS_DEFAULT_SCALE),
      CUT_LETTERS_MIN_SCALE,
      CUT_LETTERS_MAX_SCALE
    );
    const fontWeight = clamp(
      Math.round(parseNumber(foil && foil.fontWeight, 700)),
      300,
      900
    );
    const letterSpacingPx = clamp(
      parseNumber(foil && foil.letterSpacingPx, 0.6),
      -2,
      24
    );
    const curve = clamp(parseNumber(foil && foil.curve, 0), -100, 100);
    const baseFontSize = Math.max(24, safeFrameHeight * 0.26);
    let fontSize = clamp(baseFontSize * (scale / 100), 18, safeFrameWidth * 0.52);

    function measureText(fontSizePx) {
      if (refs && refs.windowMeasureText) {
        refs.windowMeasureText.textContent = textValue;
        refs.windowMeasureText.style.fontFamily = fontFamilyForCutLetters(fontName);
        refs.windowMeasureText.style.fontSize = fontSizePx.toFixed(1) + "px";
        refs.windowMeasureText.style.fontWeight = String(fontWeight);
        refs.windowMeasureText.style.letterSpacing = letterSpacingPx.toFixed(2) + "px";
        refs.windowMeasureText.style.whiteSpace = "nowrap";
        refs.windowMeasureText.style.display = "inline-block";
        const curveLiftPx = (Math.abs(curve) / 100) * fontSizePx * 0.9;
        return {
          width: Math.max(1, refs.windowMeasureText.offsetWidth),
          height: Math.max(1, refs.windowMeasureText.offsetHeight + curveLiftPx),
        };
      }
      const curveLiftPx = (Math.abs(curve) / 100) * fontSizePx * 0.9;
      return {
        width: Math.max(
          1,
          textValue.length * fontSizePx * 0.58 +
            Math.max(0, textValue.length - 1) * letterSpacingPx
        ),
        height: Math.max(1, fontSizePx + curveLiftPx),
      };
    }

    let textSize = measureText(fontSize);
    const boxPadding = clamp(Math.round(fontSize * 0.24), 8, 18);
    let boxWidth = textSize.width + boxPadding * 2;
    let boxHeight = textSize.height + boxPadding * 2;
    const maxBoxWidth = Math.max(84, safeFrameWidth - 10);
    const maxBoxHeight = Math.max(52, safeFrameHeight - 10);

    if (boxWidth > maxBoxWidth || boxHeight > maxBoxHeight) {
      const shrinkRatio = Math.min(maxBoxWidth / boxWidth, maxBoxHeight / boxHeight);
      fontSize = Math.max(14, fontSize * shrinkRatio);
      textSize = measureText(fontSize);
      boxWidth = textSize.width + boxPadding * 2;
      boxHeight = textSize.height + boxPadding * 2;
    }

    boxWidth = Math.min(maxBoxWidth, boxWidth);
    boxHeight = Math.min(maxBoxHeight, boxHeight);

    const rawCenterX = clamp(parseNumber(foil && foil.xRatio, 0.5), 0, 1) * safeFrameWidth;
    const rawCenterY = clamp(parseNumber(foil && foil.yRatio, 0.5), 0, 1) * safeFrameHeight;
    const halfWidth = boxWidth / 2;
    const halfHeight = boxHeight / 2;
    const minCenterX = halfWidth + 4;
    const maxCenterX = Math.max(minCenterX, safeFrameWidth - halfWidth - 4);
    const minCenterY = halfHeight + 4;
    const maxCenterY = Math.max(minCenterY, safeFrameHeight - halfHeight - 4);
    const centerX = clamp(rawCenterX, minCenterX, maxCenterX);
    const centerY = clamp(rawCenterY, minCenterY, maxCenterY);

    return {
      textValue,
      fontName,
      scale,
      fontWeight,
      letterSpacingPx,
      curve,
      fontSize,
      boxWidth,
      boxHeight,
      centerX,
      centerY,
      xRatio: centerX / safeFrameWidth,
      yRatio: centerY / safeFrameHeight,
      widthRatio: boxWidth / safeFrameWidth,
      heightRatio: boxHeight / safeFrameHeight,
    };
  }

  function applyFoilTextVisual(targetNode, layout) {
    if (!targetNode || !layout) return;
    while (targetNode.firstChild) {
      targetNode.removeChild(targetNode.firstChild);
    }

    targetNode.style.fontFamily = fontFamilyForCutLetters(layout.fontName);
    targetNode.style.fontWeight = String(layout.fontWeight);
    targetNode.style.fontSize = layout.fontSize.toFixed(1) + "px";
    targetNode.style.lineHeight = "1";
    targetNode.style.whiteSpace = "nowrap";

    const curveStrength = clamp(parseNumber(layout.curve, 0), -100, 100);
    if (Math.abs(curveStrength) < 1 || layout.textValue.length <= 1) {
      targetNode.style.display = "inline-block";
      targetNode.style.letterSpacing = layout.letterSpacingPx.toFixed(2) + "px";
      targetNode.textContent = layout.textValue;
      return;
    }

    targetNode.style.display = "inline-flex";
    targetNode.style.alignItems = "flex-end";
    targetNode.style.letterSpacing = "0";

    const chars = Array.from(layout.textValue);
    const midpoint = (chars.length - 1) / 2;
    const curveLiftPx = (Math.abs(curveStrength) / 100) * layout.fontSize * 0.9;

    chars.forEach(function (char, index) {
      const glyph = createElement("span");
      glyph.textContent = char === " " ? "\u00a0" : char;
      glyph.style.display = "inline-block";
      glyph.style.whiteSpace = "pre";
      glyph.style.lineHeight = "1";
      if (index < chars.length - 1) {
        glyph.style.marginRight = layout.letterSpacingPx.toFixed(2) + "px";
      }

      const normalized = midpoint === 0 ? 0 : (index - midpoint) / midpoint;
      const parabola = 1 - normalized * normalized;
      const offsetY = -Math.sign(curveStrength) * curveLiftPx * parabola;
      const angle = -normalized * curveStrength * 0.14;
      glyph.style.transform =
        "translateY(" + offsetY.toFixed(2) + "px) rotate(" + angle.toFixed(2) + "deg)";

      targetNode.appendChild(glyph);
    });
  }

  function renderCutLettersFoilList(foilLayoutsById, widthCm, heightCm) {
    if (!refs || !refs.cutLettersFoilList) return;
    refs.cutLettersFoilList.innerHTML = "";

    cutLettersState.foils.forEach(function (foil, index) {
      const layout = foilLayoutsById[String(foil.id)];
      const item = createElement("div");
      item.style.width = "100%";
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.gap = "0.45rem";
      item.style.fontSize = "0.67rem";

      const selectButton = createElement("button");
      selectButton.type = "button";
      selectButton.style.flex = "1";
      selectButton.style.minWidth = "0";
      selectButton.style.display = "flex";
      selectButton.style.alignItems = "center";
      selectButton.style.justifyContent = "space-between";
      selectButton.style.gap = "0.45rem";
      selectButton.style.padding = "0.38rem 0.48rem";
      selectButton.style.borderRadius = "8px";
      selectButton.style.border = "1px solid hsl(var(--border) / 0.85)";
      selectButton.style.background = "hsl(var(--background) / 0.9)";
      selectButton.style.fontSize = "0.67rem";
      selectButton.style.cursor = "pointer";

      const active = foil.id === cutLettersState.activeFoilId;
      if (active) {
        selectButton.style.borderColor = "hsl(var(--primary) / 0.95)";
        selectButton.style.background = "hsl(var(--primary) / 0.09)";
      }

      const info = createElement("span");
      info.style.display = "flex";
      info.style.flexDirection = "column";
      info.style.alignItems = "flex-start";
      info.style.minWidth = "0";

      const title = createElement("span", "text-xs font-medium");
      title.style.fontSize = "0.67rem";
      title.style.lineHeight = "1.1";
      title.textContent = "Folie " + (index + 1);
      info.appendChild(title);

      const size = createElement("span", "text-xs text-muted-foreground");
      size.style.fontSize = "0.62rem";
      size.style.lineHeight = "1.1";
      if (layout) {
        const foilWidthCm = Math.max(0.1, widthCm * layout.widthRatio);
        const foilHeightCm = Math.max(0.1, heightCm * layout.heightRatio);
        size.textContent =
          foilWidthCm.toFixed(1) + " x " + foilHeightCm.toFixed(1) + " cm";
      } else {
        size.textContent = "Størrelse beregnes";
      }
      info.appendChild(size);
      selectButton.appendChild(info);
      selectButton.addEventListener("click", function () {
        cutLettersState.activeFoilId = foil.id;
        renderModule();
      });
      item.appendChild(selectButton);

      const removeButton = createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Slet";
      removeButton.style.padding = "0.3rem 0.44rem";
      removeButton.style.borderRadius = "7px";
      removeButton.style.border = "1px solid hsl(var(--border) / 0.82)";
      removeButton.style.background = "hsl(var(--background) / 0.86)";
      removeButton.style.fontSize = "0.62rem";
      removeButton.style.lineHeight = "1";
      removeButton.style.cursor = "pointer";
      removeButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        cutLettersState.foils = cutLettersState.foils.filter(function (entry) {
          return entry.id !== foil.id;
        });
        ensureCutLettersStateConsistency();
        renderModule();
      });
      item.appendChild(removeButton);

      refs.cutLettersFoilList.appendChild(item);
    });
  }

  function renderCutLettersMode(variant, visualWidthPx, visualHeightPx, widthCm, heightCm) {
    if (
      !refs ||
      !refs.banner ||
      !refs.windowFrame ||
      !refs.windowFoilsLayer ||
      !refs.windowText ||
      !refs.windowTextTransform ||
      !refs.cutLettersPanel
    ) {
      return;
    }

    const enabled = variant === "cut-letters";
    if (!enabled) {
      refs.banner.style.display = "block";
      refs.windowFrame.style.display = "none";
      refs.windowTextTransform.style.display = "none";
      refs.windowFoilsLayer.innerHTML = "";
      refs.cutLettersPanel.style.display = "none";
      stopCutLettersInteraction();
      return;
    }

    ensureCutLettersStateConsistency();
    ensureCutLettersFontsLoaded();
    refs.banner.style.display = "none";
    refs.windowFrame.style.display = "flex";
    refs.cutLettersPanel.style.display = "flex";

    if (window.innerWidth <= 900) {
      refs.cutLettersPanel.style.left = "10px";
      refs.cutLettersPanel.style.top = "10px";
      refs.cutLettersPanel.style.transform = "none";
      refs.cutLettersPanel.style.width = "min(220px, calc(100% - 20px))";
    } else {
      refs.cutLettersPanel.style.left = "10px";
      refs.cutLettersPanel.style.top = "50%";
      refs.cutLettersPanel.style.transform = "translateY(-50%)";
      refs.cutLettersPanel.style.width = "220px";
    }

    const sceneWidth = Math.max(300, refs.previewScene ? refs.previewScene.offsetWidth : 300);
    const sceneHeight = Math.max(180, refs.previewScene ? refs.previewScene.offsetHeight : 180);
    const frameWidth = clamp(visualWidthPx * 1.06, 240, Math.max(260, sceneWidth - 56));
    const frameHeight = clamp(visualHeightPx * 1.14, 130, Math.max(150, sceneHeight - 56));

    refs.windowFrame.style.width = frameWidth.toFixed(1) + "px";
    refs.windowFrame.style.height = frameHeight.toFixed(1) + "px";
    refs.windowFoilsLayer.innerHTML = "";

    const foilLayoutsById = {};
    cutLettersState.foils.forEach(function (foil) {
      const layout = measureCutLettersFoilLayout(foil, frameWidth, frameHeight);
      foilLayoutsById[String(foil.id)] = layout;
      foil.scale = layout.scale;
      foil.xRatio = layout.xRatio;
      foil.yRatio = layout.yRatio;
    });

    renderCutLettersFoilList(foilLayoutsById, widthCm, heightCm);

    const activeFoil = getActiveCutLettersFoil();
    const activeLayout = activeFoil ? foilLayoutsById[String(activeFoil.id)] : null;

    cutLettersState.foils.forEach(function (foil) {
      if (!activeFoil) return;
      if (foil.id === activeFoil.id) return;
      const layout = foilLayoutsById[String(foil.id)];
      if (!layout) return;
      const textNode = createElement("div", "font-heading");
      textNode.style.position = "absolute";
      textNode.style.left = layout.centerX.toFixed(1) + "px";
      textNode.style.top = layout.centerY.toFixed(1) + "px";
      textNode.style.transform = "translate(-50%, -50%)";
      textNode.style.color = "rgba(30,41,59,0.86)";
      textNode.style.textShadow =
        "0 0.5px 0 rgba(255,255,255,0.72), 0 1px 3px rgba(15,23,42,0.08)";
      textNode.style.pointerEvents = "none";
      textNode.style.zIndex = "1";
      applyFoilTextVisual(textNode, layout);
      refs.windowFoilsLayer.appendChild(textNode);
    });

    if (activeFoil && activeLayout) {
      if (refs.cutLettersTextInput) refs.cutLettersTextInput.disabled = false;
      if (refs.cutLettersFontSelect) refs.cutLettersFontSelect.disabled = false;
      if (refs.cutLettersWeightSelect) refs.cutLettersWeightSelect.disabled = false;
      if (refs.cutLettersSpacingInput) refs.cutLettersSpacingInput.disabled = false;
      if (refs.cutLettersCurveInput) refs.cutLettersCurveInput.disabled = false;
      applyFoilTextVisual(refs.windowText, activeLayout);
      refs.windowText.style.pointerEvents = "none";

      refs.windowTextTransform.style.display = "flex";
      refs.windowTextTransform.style.alignItems = "center";
      refs.windowTextTransform.style.justifyContent = "center";
      refs.windowTextTransform.style.width = activeLayout.boxWidth.toFixed(1) + "px";
      refs.windowTextTransform.style.height = activeLayout.boxHeight.toFixed(1) + "px";
      refs.windowTextTransform.style.left = activeLayout.centerX.toFixed(1) + "px";
      refs.windowTextTransform.style.top = activeLayout.centerY.toFixed(1) + "px";
      refs.windowTextTransform.style.transform = "translate(-50%, -50%)";

      if (
        refs.cutLettersTextInput &&
        document.activeElement !== refs.cutLettersTextInput
      ) {
        refs.cutLettersTextInput.value = activeLayout.textValue;
      }
      if (refs.cutLettersFontSelect) {
        refs.cutLettersFontSelect.value = activeLayout.fontName;
      }
      if (refs.cutLettersWeightSelect) {
        refs.cutLettersWeightSelect.value = String(activeLayout.fontWeight);
      }
      if (refs.cutLettersSpacingInput) {
        refs.cutLettersSpacingInput.value = activeLayout.letterSpacingPx.toFixed(1);
      }
      if (refs.cutLettersSpacingValue) {
        refs.cutLettersSpacingValue.textContent =
          activeLayout.letterSpacingPx.toFixed(1) + " px";
      }
      if (refs.cutLettersCurveInput) {
        refs.cutLettersCurveInput.value = String(Math.round(activeLayout.curve));
      }
      if (refs.cutLettersCurveValue) {
        refs.cutLettersCurveValue.textContent = String(Math.round(activeLayout.curve));
      }
      if (refs.cutLettersTransformHint) {
        const foilWidthCm = Math.max(0.1, widthCm * activeLayout.widthRatio);
        const foilHeightCm = Math.max(0.1, heightCm * activeLayout.heightRatio);
        refs.cutLettersTransformHint.textContent =
          "Aktiv folie: " +
          foilWidthCm.toFixed(1) +
          " x " +
          foilHeightCm.toFixed(1) +
          " cm. Træk for at flytte, brug hjørner for at skalere.";
      }
    } else {
      refs.windowTextTransform.style.display = "none";
      refs.windowText.textContent = "";
      if (refs.cutLettersTextInput) refs.cutLettersTextInput.disabled = true;
      if (refs.cutLettersFontSelect) refs.cutLettersFontSelect.disabled = true;
      if (refs.cutLettersWeightSelect) refs.cutLettersWeightSelect.disabled = true;
      if (refs.cutLettersSpacingInput) refs.cutLettersSpacingInput.disabled = true;
      if (refs.cutLettersCurveInput) refs.cutLettersCurveInput.disabled = true;
      if (
        refs.cutLettersTextInput &&
        document.activeElement !== refs.cutLettersTextInput
      ) {
        refs.cutLettersTextInput.value = "";
      }
      if (refs.cutLettersWeightSelect) {
        refs.cutLettersWeightSelect.value = "700";
      }
      if (refs.cutLettersSpacingInput) {
        refs.cutLettersSpacingInput.value = "0.6";
      }
      if (refs.cutLettersSpacingValue) {
        refs.cutLettersSpacingValue.textContent = "0.0 px";
      }
      if (refs.cutLettersCurveInput) {
        refs.cutLettersCurveInput.value = "0";
      }
      if (refs.cutLettersCurveValue) {
        refs.cutLettersCurveValue.textContent = "0";
      }
      if (refs.cutLettersTransformHint) {
        refs.cutLettersTransformHint.textContent =
          "Ingen folie endnu. Klik + Ny folie for at starte.";
      }
    }
  }

  function applyProductMaterialVisual(variant) {
    if (!refs || !refs.banner || !refs.materialTexture || !refs.materialShine) return;

    let baseGradient =
      "linear-gradient(132deg, hsl(var(--primary)) 0%, rgb(14,165,233) 62%, rgb(186,230,253) 100%)";
    let textureImage = "none";
    let textureSize = "auto";
    let textureOpacity = 0;
    let textureRepeat = "no-repeat";
    let shineImage =
      "linear-gradient(112deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 24%, rgba(255,255,255,0.22) 38%, rgba(255,255,255,0.08) 53%, rgba(255,255,255,0) 72%)";
    let shineOpacity = 0.2;

    if (variant === "mesh") {
      baseGradient =
        "linear-gradient(132deg, hsl(var(--primary) / 0.9) 0%, rgba(14,165,233,0.84) 62%, rgba(186,230,253,0.78) 100%)";
      textureImage =
        "radial-gradient(circle at 1px 1px, rgba(2,6,23,0.36) 0 0.44px, rgba(0,0,0,0) 0.52px)";
      textureSize = "2.2px 2.2px";
      textureOpacity = 0.28;
      textureRepeat = "repeat";
      shineOpacity = 0.14;
    } else if (variant === "textile") {
      baseGradient =
        "linear-gradient(132deg, rgba(14,116,144,0.98) 0%, rgba(56,189,248,0.95) 60%, rgba(186,230,253,0.9) 100%)";
      textureImage =
        "repeating-linear-gradient(0deg, rgba(2,6,23,0.07) 0 0.32px, rgba(0,0,0,0) 0.32px 2px), repeating-linear-gradient(90deg, rgba(2,6,23,0.06) 0 0.32px, rgba(0,0,0,0) 0.32px 2px)";
      textureSize = "2px 2px, 2px 2px";
      textureOpacity = 0.07;
      textureRepeat = "repeat";
      shineOpacity = 0.11;
    } else if (variant === "pvc") {
      baseGradient =
        "linear-gradient(132deg, hsl(var(--primary)) 0%, rgb(14,165,233) 62%, rgb(186,230,253) 100%)";
      textureImage = "none";
      textureOpacity = 0;
      textureRepeat = "no-repeat";
      shineOpacity = 0.2;
    } else if (variant === "foil") {
      baseGradient =
        "linear-gradient(128deg, rgba(3,105,161,0.98) 0%, rgba(14,165,233,0.96) 46%, rgba(224,242,254,0.95) 100%)";
      textureImage = "none";
      textureOpacity = 0;
      shineImage =
        "linear-gradient(108deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 17%, rgba(255,255,255,0.62) 31%, rgba(255,255,255,0.24) 44%, rgba(255,255,255,0) 61%), linear-gradient(138deg, rgba(2,132,199,0.14) 0%, rgba(255,255,255,0) 64%)";
      shineOpacity = 0.28;
    }

    refs.banner.style.background = baseGradient;
    refs.materialTexture.style.backgroundImage = textureImage;
    refs.materialTexture.style.backgroundSize = textureSize;
    refs.materialTexture.style.backgroundRepeat = textureRepeat;
    refs.materialTexture.style.opacity = String(textureOpacity);
    refs.materialTexture.style.display = textureOpacity > 0 ? "block" : "none";
    refs.materialShine.style.backgroundImage = shineImage;
    refs.materialShine.style.opacity = String(shineOpacity);
  }

  function isFinishingButtonSelected(button) {
    if (!button) return false;
    return (
      button.classList.contains("border-primary") ||
      button.classList.contains("bg-primary/5")
    );
  }

  function setClassTokenState(node, selected, selectedTokens, unselectedTokens) {
    if (!node || !node.classList) return;
    selectedTokens.forEach(function (token) {
      if (selected) {
        node.classList.add(token);
      } else {
        node.classList.remove(token);
      }
    });
    unselectedTokens.forEach(function (token) {
      if (selected) {
        node.classList.remove(token);
      } else {
        node.classList.add(token);
      }
    });
  }

  function setFinishingButtonVisualState(button, selected, templateButton) {
    if (!button) return;

    setClassTokenState(
      button,
      selected,
      ["border-primary", "bg-primary/5"],
      ["border-border", "bg-card", "hover:border-primary/40"]
    );

    const iconNode =
      button.querySelector("div.h-8.w-8") || button.querySelector("div.flex");
    setClassTokenState(
      iconNode,
      selected,
      ["bg-primary", "text-primary-foreground"],
      ["bg-secondary", "text-muted-foreground"]
    );

    const indicatorNode = button.querySelector("div.ml-auto");
    setClassTokenState(
      indicatorNode,
      selected,
      ["border-primary", "bg-primary"],
      ["border-border"]
    );

    if (!indicatorNode) return;
    let indicatorCheck = indicatorNode.firstElementChild;
    if (!indicatorCheck && templateButton) {
      const templateIndicator = templateButton.querySelector("div.ml-auto");
      const templateCheck = templateIndicator
        ? templateIndicator.firstElementChild
        : null;
      if (templateCheck) {
        indicatorCheck = templateCheck.cloneNode(true);
        indicatorNode.appendChild(indicatorCheck);
      }
    }
    if (indicatorCheck) {
      indicatorCheck.style.opacity = selected ? "" : "0";
    }
  }

  function setRing50VisualProxyState(button, selected) {
    if (!button) return;

    const iconNode =
      button.querySelector("div.h-8.w-8") || button.querySelector("div.flex");
    const indicatorNode = button.querySelector("div.ml-auto");
    const indicatorCheck = indicatorNode ? indicatorNode.firstElementChild : null;
    setClassTokenState(
      button,
      selected,
      ["border-primary", "bg-primary/5"],
      ["border-border", "bg-card", "hover:border-primary/40"]
    );
    setClassTokenState(
      iconNode,
      selected,
      ["bg-primary", "text-primary-foreground"],
      ["bg-secondary", "text-muted-foreground"]
    );
    setClassTokenState(
      indicatorNode,
      selected,
      ["border-primary", "bg-primary"],
      ["border-border"]
    );
    if (indicatorCheck) {
      indicatorCheck.style.opacity = selected ? "" : "0";
    }
  }

  function findRing50Button(finishingBlock) {
    const buttons = Array.from(finishingBlock.querySelectorAll("button"));
    const exact = buttons.find(function (button) {
      if (
        button.id === RING_SPACING_100_BUTTON_ID ||
        button.id === LEGACY_RING_SPACING_BUTTON_ID
      ) {
        return false;
      }
      const text = normalizeText(button.textContent);
      return text.includes("ringe") && text.includes("50 cm");
    });
    if (exact) return exact;

    return buttons.find(function (button) {
      if (
        button.id === RING_SPACING_100_BUTTON_ID ||
        button.id === LEGACY_RING_SPACING_BUTTON_ID
      ) {
        return false;
      }
      const text = normalizeText(button.textContent);
      return text.includes("ringe") || text.includes("oje");
    });
  }

  function findHemmingButton(finishingBlock) {
    const buttons = Array.from(finishingBlock.querySelectorAll("button"));
    return buttons.find(function (button) {
      if (
        button.id === RING_SPACING_100_BUTTON_ID ||
        button.id === LEGACY_RING_SPACING_BUTTON_ID
      ) {
        return false;
      }
      const text = normalizeText(button.textContent);
      return (
        text.includes("kantforsegling") ||
        text.includes("kantforstaerkning") ||
        text.includes("som")
      );
    });
  }

  function setRingSpacingButtonCopy(button, titleText, descriptionText) {
    if (!button) return;
    const titleNode =
      button.querySelector("span.text-sm") || button.querySelector("span");
    if (titleNode) {
      setSimpleNodeText(titleNode, titleText);
    }

    const descriptionNode =
      button.querySelector("p.text-xs") || button.querySelector("p");
    if (descriptionNode) {
      setSimpleNodeText(descriptionNode, descriptionText);
    }
  }

  function ensureFinishingButtonCopy() {
    const finishingBlock = findBlockByHeading("finishing");
    if (!finishingBlock) return;
    const hemmingButton = findHemmingButton(finishingBlock);
    if (!hemmingButton) return;

    setRingSpacingButtonCopy(hemmingButton, HEMMING_LABEL, HEMMING_DESCRIPTION);
  }

  function ensureRingSpacingVariantButton() {
    const finishingBlock = findBlockByHeading("finishing");
    if (!finishingBlock) return;

    const legacyContainer = finishingBlock.querySelector(
      "#" + LEGACY_RING_SPACING_BUTTON_CONTAINER_ID
    );
    if (legacyContainer) {
      legacyContainer.style.display = "none";
      legacyContainer.style.pointerEvents = "none";
      legacyContainer.setAttribute("aria-hidden", "true");
    }

    const legacyButton = finishingBlock.querySelector(
      "#" + LEGACY_RING_SPACING_BUTTON_ID
    );
    if (legacyButton) {
      legacyButton.style.display = "none";
      legacyButton.style.pointerEvents = "none";
      legacyButton.setAttribute("aria-hidden", "true");
      if (legacyButton instanceof HTMLButtonElement) {
        legacyButton.disabled = true;
      }
    }

    const ring50Button = findRing50Button(finishingBlock);
    if (!ring50Button || !ring50Button.parentElement) return;
    setRingSpacingButtonCopy(ring50Button, "Ringe / Øskner", "Hver 50 cm");

    if (ring50Button.dataset.wpRingSpacingBaseBound !== "1") {
      ring50Button.dataset.wpRingSpacingBaseBound = "1";
      ring50Button.addEventListener("click", function (event) {
        const ring100Button = finishingBlock.querySelector(
          "#" + RING_SPACING_100_BUTTON_ID
        );
        const isRing100Active = isFinishingButtonSelected(ring100Button);
        if (suppressBaseRingModeSync) {
          suppressBaseRingModeSync = false;
          return;
        }
        if (ringSpacingMode === "100" && isRing100Active) {
          event.preventDefault();
          event.stopPropagation();
        }
        ringSpacingMode = "50";
        window.setTimeout(scheduleSync, 0);
      });
    }

    let button = finishingBlock.querySelector("#" + RING_SPACING_100_BUTTON_ID);
    if (!button) {
      button = ring50Button.cloneNode(true);
      button.id = RING_SPACING_100_BUTTON_ID;
      button.setAttribute("type", "button");
      button.dataset.wpRingSpacingClone = "100";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        const currentFinishingBlock = findBlockByHeading("finishing");
        const currentRing50Button = currentFinishingBlock
          ? findRing50Button(currentFinishingBlock)
          : null;

        ringSpacingMode = "100";
        if (
          currentRing50Button &&
          !isFinishingButtonSelected(currentRing50Button)
        ) {
          suppressBaseRingModeSync = true;
          currentRing50Button.click();
        }
        scheduleSync();
      });
    }

    setRingSpacingButtonCopy(button, "Ringe / Øskner", "Hver 100 cm");

    if (ring50Button.nextElementSibling !== button) {
      ring50Button.insertAdjacentElement("afterend", button);
    }

    const ring50StateSelected = isFinishingButtonSelected(ring50Button);
    const ring100StateSelected = isFinishingButtonSelected(button);
    const ringAnySelected = ring50StateSelected || ring100StateSelected;
    const ring100Selected = ringAnySelected && ringSpacingMode === "100";
    const ring50Selected = ringAnySelected && ringSpacingMode !== "100";
    setRing50VisualProxyState(ring50Button, ring50Selected);
    setFinishingButtonVisualState(button, ring100Selected, ring50Button);
  }

  function updateInputValue(input, nextValue) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    );
    if (nativeSetter && typeof nativeSetter.set === "function") {
      nativeSetter.set.call(input, String(nextValue));
    } else {
      input.value = String(nextValue);
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function ensureDefaultDimensions() {
    if (hasAppliedDefaultDimensions) return;

    const angivMalBlock = findBlockByHeading("angiv mal");
    if (!angivMalBlock) return;

    const inputs = Array.from(angivMalBlock.querySelectorAll("input[type='number']"));
    if (inputs.length < 2) return;

    updateInputValue(inputs[0], DEFAULT_WIDTH_CM);
    updateInputValue(inputs[1], DEFAULT_HEIGHT_CM);
    hasAppliedDefaultDimensions = true;
  }

  function ensureDefaultFinishingState() {
    if (hasAppliedDefaultFinishingState) return false;

    const finishingBlock = findBlockByHeading("finishing");
    if (!finishingBlock) return false;

    ringSpacingMode = "50";

    const finishingButtons = Array.from(finishingBlock.querySelectorAll("button")).filter(
      function (button) {
        return (
          button.id !== RING_SPACING_100_BUTTON_ID &&
          button.id !== LEGACY_RING_SPACING_BUTTON_ID
        );
      }
    );

    const selectedButtons = finishingButtons.filter(isFinishingButtonSelected);
    if (selectedButtons.length === 0) {
      hasAppliedDefaultFinishingState = true;
      return false;
    }

    selectedButtons.forEach(function (button) {
      button.click();
    });
    hasAppliedDefaultFinishingState = true;
    return true;
  }

  function areaM2FromCm(widthCm, heightCm) {
    return (Math.max(0, widthCm) * Math.max(0, heightCm)) / 10000;
  }

  function recommendedDpiForArea(areaM2) {
    if (areaM2 > MEDIUM_AREA_MAX_M2) return TARGET_DPI_LARGE_AREA;
    if (areaM2 >= MEDIUM_AREA_MIN_M2) return TARGET_DPI_MEDIUM_AREA;
    return TARGET_DPI_SMALL_AREA;
  }

  function designQualityFromDpi(actualDpi, targetDpi) {
    if (actualDpi >= targetDpi) {
      return { label: "SMUK", color: "#86efac" };
    }
    if (actualDpi >= targetDpi * 0.8) {
      return { label: "God", color: "#bbf7d0" };
    }
    if (actualDpi >= targetDpi * 0.6) {
      return { label: "Lav", color: "#fcd34d" };
    }
    return { label: "For lav", color: "#fda4af" };
  }

  function getDesignRectPixels(bannerWidthPx, bannerHeightPx) {
    if (!designPlacement) return null;
    if (bannerWidthPx <= 0 || bannerHeightPx <= 0) return null;

    return {
      x: designPlacement.xRatio * bannerWidthPx,
      y: designPlacement.yRatio * bannerHeightPx,
      width: designPlacement.widthRatio * bannerWidthPx,
      height: designPlacement.heightRatio * bannerHeightPx,
    };
  }

  function clampDesignRectToBanner(rectPx, bannerWidthPx, bannerHeightPx) {
    if (!rectPx) return null;
    if (bannerWidthPx <= 0 || bannerHeightPx <= 0) return null;

    const maxWidth = Math.max(1, bannerWidthPx * MAX_DESIGN_SCALE_FACTOR);
    const maxHeight = Math.max(1, bannerHeightPx * MAX_DESIGN_SCALE_FACTOR);
    const width = clamp(Math.max(1, rectPx.width), 1, maxWidth);
    const height = clamp(Math.max(1, rectPx.height), 1, maxHeight);
    const minVisibleX = Math.min(width, MIN_VISIBLE_DESIGN_PX);
    const minVisibleY = Math.min(height, MIN_VISIBLE_DESIGN_PX);
    const minX = minVisibleX - width;
    const maxX = bannerWidthPx - minVisibleX;
    const minY = minVisibleY - height;
    const maxY = bannerHeightPx - minVisibleY;

    return {
      x: clamp(rectPx.x, minX, maxX),
      y: clamp(rectPx.y, minY, maxY),
      width,
      height,
    };
  }

  function setDesignPlacementFromPixels(rectPx, bannerWidthPx, bannerHeightPx) {
    if (bannerWidthPx <= 0 || bannerHeightPx <= 0) return;
    if (!rectPx) return;

    const clampedRect = clampDesignRectToBanner(
      rectPx,
      bannerWidthPx,
      bannerHeightPx
    );
    if (!clampedRect) return;

    designPlacement = {
      xRatio: clampedRect.x / bannerWidthPx,
      yRatio: clampedRect.y / bannerHeightPx,
      widthRatio: clampedRect.width / bannerWidthPx,
      heightRatio: clampedRect.height / bannerHeightPx,
    };
  }

  function initializeDesignPlacement(widthCm, heightCm, targetDpi) {
    if (!uploadedDesign) return;
    if (widthCm <= 0 || heightCm <= 0) return;

    let designWidthRatio =
      ((uploadedDesign.widthPx / Math.max(1, targetDpi)) * 2.54) / widthCm;
    let designHeightRatio =
      ((uploadedDesign.heightPx / Math.max(1, targetDpi)) * 2.54) / heightCm;

    if (!Number.isFinite(designWidthRatio) || designWidthRatio <= 0) {
      designWidthRatio = 0.5;
    }
    if (!Number.isFinite(designHeightRatio) || designHeightRatio <= 0) {
      designHeightRatio = 0.5;
    }

    designPlacement = {
      xRatio: (1 - designWidthRatio) / 2,
      yRatio: (1 - designHeightRatio) / 2,
      widthRatio: designWidthRatio,
      heightRatio: designHeightRatio,
    };
  }

  function applyDesignPlacementToDom() {
    if (!refs || !refs.banner || !refs.designElement || !refs.designImage) return;

    if (!uploadedDesign || !designPlacement) {
      refs.designElement.style.display = "none";
      refs.designImage.src = "";
      return;
    }

    const bannerWidthPx = refs.banner.offsetWidth;
    const bannerHeightPx = refs.banner.offsetHeight;
    const rectPx = getDesignRectPixels(bannerWidthPx, bannerHeightPx);
    if (!rectPx) {
      refs.designElement.style.display = "none";
      return;
    }

    const clampedRect = clampDesignRectToBanner(
      rectPx,
      bannerWidthPx,
      bannerHeightPx
    );
    if (!clampedRect) {
      refs.designElement.style.display = "none";
      return;
    }
    setDesignPlacementFromPixels(clampedRect, bannerWidthPx, bannerHeightPx);

    refs.designImage.src = uploadedDesign.url;
    refs.designElement.style.display = "block";
    refs.designElement.style.left = clampedRect.x.toFixed(2) + "px";
    refs.designElement.style.top = clampedRect.y.toFixed(2) + "px";
    refs.designElement.style.width = Math.max(1, clampedRect.width).toFixed(2) + "px";
    refs.designElement.style.height = Math.max(1, clampedRect.height).toFixed(2) + "px";
  }

  function computeCurrentUploadMetrics(widthCm, heightCm) {
    if (!uploadedDesign || !designPlacement) return null;

    const designWidthCm = Math.abs(widthCm * designPlacement.widthRatio);
    const designHeightCm = Math.abs(heightCm * designPlacement.heightRatio);
    const designWidthInches = Math.max(0.01, designWidthCm / 2.54);
    const designHeightInches = Math.max(0.01, designHeightCm / 2.54);
    const dpiX = uploadedDesign.widthPx / designWidthInches;
    const dpiY = uploadedDesign.heightPx / designHeightInches;
    const effectiveDpi = Math.min(dpiX, dpiY);
    const areaM2 = areaM2FromCm(widthCm, heightCm);
    const targetDpi = recommendedDpiForArea(areaM2);

    return {
      areaM2,
      targetDpi,
      dpiX,
      dpiY,
      effectiveDpi,
      designWidthCm,
      designHeightCm,
    };
  }

  function clearUploadedDesign() {
    if (uploadedDesign && uploadedDesign.url) {
      URL.revokeObjectURL(uploadedDesign.url);
    }
    uploadedDesign = null;
    designPlacement = null;
    stopDesignInteraction();
    if (refs && refs.fileInput) {
      refs.fileInput.value = "";
    }
  }

  function updateUploadStatus(widthCm, heightCm) {
    if (!refs || !refs.fileInfo || !refs.dpiMessage) return;
    if (refs.clearUploadButton) {
      refs.clearUploadButton.style.display = uploadedDesign ? "inline-flex" : "none";
    }

    if (!uploadedDesign) {
      refs.fileInfo.textContent = "Ingen fil uploadet endnu.";
      refs.dpiMessage.textContent =
        "Upload en fil for DPI-check. Træk motivet for at flytte, brug hjørner for at skalere.";
      refs.dpiMessage.style.color = "hsl(var(--muted-foreground))";
      return;
    }

    const metrics = computeCurrentUploadMetrics(widthCm, heightCm);
    if (!metrics) {
      refs.fileInfo.textContent =
        uploadedDesign.name +
        " (" +
        uploadedDesign.widthPx +
        " x " +
        uploadedDesign.heightPx +
        "px)";
      refs.dpiMessage.textContent = "Klar til placering.";
      refs.dpiMessage.style.color = "hsl(var(--muted-foreground))";
      return;
    }

    const quality = designQualityFromDpi(metrics.effectiveDpi, metrics.targetDpi);
    refs.fileInfo.textContent =
      uploadedDesign.name +
      " (" +
      uploadedDesign.widthPx +
      " x " +
      uploadedDesign.heightPx +
      "px) | vist ca. " +
      (metrics.designWidthCm / 100).toFixed(2) +
      "m x " +
      (metrics.designHeightCm / 100).toFixed(2) +
      "m.";

    refs.dpiMessage.textContent =
      "Anbefalet ved " +
      metrics.areaM2.toFixed(2) +
      " m2: " +
      metrics.targetDpi +
      " DPI. Aktuel: " +
      Math.round(metrics.effectiveDpi) +
      " DPI (" +
      quality.label +
      "). Træk motivet frit i rammen og skaler med hjørnerne.";
    refs.dpiMessage.style.color = quality.color;
  }

  function beginCutLettersInteraction(event, mode, handle) {
    if (!refs || !refs.windowFrame || !refs.windowTextTransform) return;
    if (event.button !== 0) return;
    const activeFoil = getActiveCutLettersFoil();
    if (!activeFoil) return;

    const frameRect = refs.windowFrame.getBoundingClientRect();
    if (frameRect.width <= 0 || frameRect.height <= 0) return;

    cutLettersInteraction = {
      foilId: activeFoil.id,
      pointerId: event.pointerId,
      mode,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScale: clamp(
        parseNumber(activeFoil.scale, CUT_LETTERS_DEFAULT_SCALE),
        CUT_LETTERS_MIN_SCALE,
        CUT_LETTERS_MAX_SCALE
      ),
      startXRatio: clamp(parseNumber(activeFoil.xRatio, 0.5), 0, 1),
      startYRatio: clamp(parseNumber(activeFoil.yRatio, 0.5), 0, 1),
      frameWidthPx: frameRect.width,
      frameHeightPx: frameRect.height,
    };

    event.preventDefault();
    event.stopPropagation();
  }

  function onCutLettersPointerDown(event) {
    if (!(event.target instanceof HTMLElement)) return;
    const handle = event.target.getAttribute("data-cut-handle");
    beginCutLettersInteraction(event, handle ? "resize" : "drag", handle);
  }

  function onCutLettersPointerMove(event) {
    if (!cutLettersInteraction) return;
    if (event.pointerId !== cutLettersInteraction.pointerId) return;
    const activeFoil = cutLettersState.foils.find(function (foil) {
      return foil.id === cutLettersInteraction.foilId;
    });
    if (!activeFoil) return;

    const dx = event.clientX - cutLettersInteraction.startClientX;
    const dy = event.clientY - cutLettersInteraction.startClientY;

    if (cutLettersInteraction.mode === "drag") {
      activeFoil.xRatio = clamp(
        cutLettersInteraction.startXRatio + dx / Math.max(1, cutLettersInteraction.frameWidthPx),
        0,
        1
      );
      activeFoil.yRatio = clamp(
        cutLettersInteraction.startYRatio + dy / Math.max(1, cutLettersInteraction.frameHeightPx),
        0,
        1
      );
    } else {
      const handle = cutLettersInteraction.handle || "se";
      const horizontalDelta = handle.includes("w") ? -dx : dx;
      const verticalDelta = handle.includes("n") ? -dy : dy;
      const dominantDelta =
        Math.abs(horizontalDelta) >= Math.abs(verticalDelta)
          ? horizontalDelta
          : verticalDelta;

      activeFoil.scale = clamp(
        cutLettersInteraction.startScale + dominantDelta * 0.5,
        CUT_LETTERS_MIN_SCALE,
        CUT_LETTERS_MAX_SCALE
      );
    }

    renderModule();
  }

  function stopCutLettersInteraction(event) {
    if (!cutLettersInteraction) return;
    if (event && event.pointerId !== cutLettersInteraction.pointerId) return;
    cutLettersInteraction = null;
  }

  function beginDesignInteraction(event, mode, handle) {
    if (!refs || !refs.banner || !uploadedDesign || !designPlacement) return;
    if (event.button !== 0) return;

    const bannerRect = refs.banner.getBoundingClientRect();
    const startRect = getDesignRectPixels(bannerRect.width, bannerRect.height);
    if (!startRect) return;

    designInteraction = {
      pointerId: event.pointerId,
      mode,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect,
      bannerWidthPx: bannerRect.width,
      bannerHeightPx: bannerRect.height,
      aspectRatio: startRect.width / Math.max(1, startRect.height),
    };

    event.preventDefault();
    event.stopPropagation();
  }

  function onDesignPointerDown(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const handle = target ? target.getAttribute("data-handle") : null;
    beginDesignInteraction(event, handle ? "resize" : "drag", handle);
  }

  function onDesignPointerMove(event) {
    if (!designInteraction || !refs || !refs.banner) return;
    if (event.pointerId !== designInteraction.pointerId) return;

    const dx = event.clientX - designInteraction.startClientX;
    const dy = event.clientY - designInteraction.startClientY;
    const startRect = designInteraction.startRect;
    let nextRect = {
      x: startRect.x,
      y: startRect.y,
      width: startRect.width,
      height: startRect.height,
    };

    if (designInteraction.mode === "drag") {
      nextRect.x = startRect.x + dx;
      nextRect.y = startRect.y + dy;
    } else {
      const aspectRatio = Math.max(0.01, designInteraction.aspectRatio);
      const handle = designInteraction.handle || "se";
      const horizontalDelta = handle.includes("w") ? -dx : dx;
      const verticalDelta = handle.includes("n") ? -dy : dy;
      const widthFromDx = startRect.width + horizontalDelta;
      const widthFromDy = startRect.width + verticalDelta * aspectRatio;
      let nextWidth =
        Math.abs(horizontalDelta) >= Math.abs(verticalDelta * aspectRatio)
          ? widthFromDx
          : widthFromDy;

      nextWidth = Math.max(MIN_DESIGN_WIDTH_PX, nextWidth);
      const nextHeight = Math.max(MIN_DESIGN_WIDTH_PX / aspectRatio, nextWidth / aspectRatio);
      nextRect.width = nextWidth;
      nextRect.height = nextHeight;

      if (handle.includes("w")) {
        nextRect.x = startRect.x + (startRect.width - nextWidth);
      }
      if (handle.includes("n")) {
        nextRect.y = startRect.y + (startRect.height - nextHeight);
      }
    }

    setDesignPlacementFromPixels(
      nextRect,
      designInteraction.bannerWidthPx,
      designInteraction.bannerHeightPx
    );
    applyDesignPlacementToDom();

    const currentDimensions = readDimensions();
    updateUploadStatus(currentDimensions.widthCm, currentDimensions.heightCm);
  }

  function stopDesignInteraction(event) {
    if (!designInteraction) return;
    if (event && event.pointerId !== designInteraction.pointerId) return;
    designInteraction = null;
  }

  document.addEventListener("pointermove", onDesignPointerMove);
  document.addEventListener("pointermove", onCutLettersPointerMove);
  document.addEventListener("pointerup", stopDesignInteraction);
  document.addEventListener("pointerup", stopCutLettersInteraction);
  document.addEventListener("pointercancel", stopDesignInteraction);
  document.addEventListener("pointercancel", stopCutLettersInteraction);

  function buildModule() {
    const wrapper = createElement("div", "mb-8");
    wrapper.id = MODULE_ID;

    const heading = createElement(
      "h3",
      "mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground",
      "Visual preview af banner"
    );
    wrapper.appendChild(heading);

    const stage = createElement("div");
    stage.style.display = "flex";
    stage.style.flexDirection = "column";
    stage.style.alignItems = "center";
    stage.style.gap = "0.75rem";
    wrapper.appendChild(stage);

    const previewInner = createElement("div");
    previewInner.style.width = "100%";
    previewInner.style.minWidth = "280px";
    previewInner.style.display = "flex";
    previewInner.style.justifyContent = "center";
    previewInner.style.alignItems = "center";
    previewInner.style.padding = "0.25rem 0";
    previewInner.style.overflow = "visible";
    stage.appendChild(previewInner);

    const previewScene = createElement("div");
    previewScene.style.position = "relative";
    previewScene.style.display = "flex";
    previewScene.style.alignItems = "center";
    previewScene.style.justifyContent = "center";
    previewScene.style.width = "640px";
    previewScene.style.height = "360px";
    previewScene.style.maxWidth = "100%";
    previewScene.style.overflow = "visible";
    previewInner.appendChild(previewScene);

    const cutLettersPanel = createElement("div");
    cutLettersPanel.style.position = "absolute";
    cutLettersPanel.style.left = "10px";
    cutLettersPanel.style.top = "50%";
    cutLettersPanel.style.transform = "translateY(-50%)";
    cutLettersPanel.style.width = "220px";
    cutLettersPanel.style.padding = "0.65rem";
    cutLettersPanel.style.borderRadius = "12px";
    cutLettersPanel.style.background = "hsl(var(--card) / 0.94)";
    cutLettersPanel.style.border = "1px solid hsl(var(--border) / 0.86)";
    cutLettersPanel.style.boxShadow = "0 10px 24px rgba(2,6,23,0.14)";
    cutLettersPanel.style.backdropFilter = "blur(2px)";
    cutLettersPanel.style.display = "none";
    cutLettersPanel.style.flexDirection = "column";
    cutLettersPanel.style.gap = "0.46rem";
    cutLettersPanel.style.zIndex = "8";
    previewScene.appendChild(cutLettersPanel);

    const cutLettersPanelTitle = createElement(
      "div",
      "text-xs font-semibold text-foreground",
      "Tekst editor"
    );
    cutLettersPanel.appendChild(cutLettersPanelTitle);
    ensureCutLettersStateConsistency();
    const initialActiveFoil = getActiveCutLettersFoil();

    const cutLettersToolbar = createElement("div");
    cutLettersToolbar.style.display = "flex";
    cutLettersToolbar.style.alignItems = "center";
    cutLettersToolbar.style.justifyContent = "space-between";
    cutLettersToolbar.style.gap = "0.45rem";
    cutLettersPanel.appendChild(cutLettersToolbar);

    const cutLettersFoilLabel = createElement(
      "span",
      "text-xs text-muted-foreground",
      "Folier"
    );
    cutLettersFoilLabel.style.fontSize = "0.66rem";
    cutLettersToolbar.appendChild(cutLettersFoilLabel);

    const cutLettersAddFoilButton = createElement("button");
    cutLettersAddFoilButton.type = "button";
    cutLettersAddFoilButton.textContent = "+ Ny folie";
    cutLettersAddFoilButton.style.padding = "0.22rem 0.42rem";
    cutLettersAddFoilButton.style.borderRadius = "999px";
    cutLettersAddFoilButton.style.border = "1px solid hsl(var(--border))";
    cutLettersAddFoilButton.style.background = "hsl(var(--background) / 0.92)";
    cutLettersAddFoilButton.style.fontSize = "0.62rem";
    cutLettersAddFoilButton.style.cursor = "pointer";
    cutLettersToolbar.appendChild(cutLettersAddFoilButton);

    const cutLettersFoilList = createElement("div");
    cutLettersFoilList.style.display = "flex";
    cutLettersFoilList.style.flexDirection = "column";
    cutLettersFoilList.style.gap = "0.33rem";
    cutLettersFoilList.style.maxHeight = "116px";
    cutLettersFoilList.style.overflowY = "auto";
    cutLettersPanel.appendChild(cutLettersFoilList);

    const cutLettersTextInput = createElement("input");
    cutLettersTextInput.type = "text";
    cutLettersTextInput.value = initialActiveFoil ? initialActiveFoil.text : "";
    cutLettersTextInput.maxLength = 40;
    cutLettersTextInput.placeholder = "Skriv tekst";
    cutLettersTextInput.style.width = "100%";
    cutLettersTextInput.style.padding = "0.38rem 0.48rem";
    cutLettersTextInput.style.borderRadius = "8px";
    cutLettersTextInput.style.border = "1px solid hsl(var(--border))";
    cutLettersTextInput.style.background = "hsl(var(--background) / 0.92)";
    cutLettersTextInput.style.fontSize = "0.72rem";
    cutLettersPanel.appendChild(cutLettersTextInput);

    const cutLettersFontSelect = createElement("select");
    cutLettersFontSelect.style.width = "100%";
    cutLettersFontSelect.style.padding = "0.38rem 0.48rem";
    cutLettersFontSelect.style.borderRadius = "8px";
    cutLettersFontSelect.style.border = "1px solid hsl(var(--border))";
    cutLettersFontSelect.style.background = "hsl(var(--background) / 0.92)";
    cutLettersFontSelect.style.fontSize = "0.72rem";
    CUT_LETTERS_FONTS.forEach(function (fontName) {
      const option = document.createElement("option");
      option.value = fontName;
      option.textContent = fontName;
      cutLettersFontSelect.appendChild(option);
    });
    cutLettersFontSelect.value = initialActiveFoil
      ? initialActiveFoil.fontName
      : CUT_LETTERS_FONTS[0];
    cutLettersPanel.appendChild(cutLettersFontSelect);

    const cutLettersWeightSelect = createElement("select");
    cutLettersWeightSelect.style.width = "100%";
    cutLettersWeightSelect.style.padding = "0.38rem 0.48rem";
    cutLettersWeightSelect.style.borderRadius = "8px";
    cutLettersWeightSelect.style.border = "1px solid hsl(var(--border))";
    cutLettersWeightSelect.style.background = "hsl(var(--background) / 0.92)";
    cutLettersWeightSelect.style.fontSize = "0.72rem";
    [
      { value: 300, label: "Tynd (300)" },
      { value: 400, label: "Normal (400)" },
      { value: 500, label: "Medium (500)" },
      { value: 600, label: "Halvfed (600)" },
      { value: 700, label: "Fed (700)" },
      { value: 800, label: "Ekstra fed (800)" },
      { value: 900, label: "Kraftig (900)" },
    ].forEach(function (weightOption) {
      const option = document.createElement("option");
      option.value = String(weightOption.value);
      option.textContent = weightOption.label;
      cutLettersWeightSelect.appendChild(option);
    });
    cutLettersWeightSelect.value = String(
      initialActiveFoil ? clamp(parseNumber(initialActiveFoil.fontWeight, 700), 300, 900) : 700
    );
    cutLettersPanel.appendChild(cutLettersWeightSelect);

    const cutLettersSpacingWrap = createElement("div");
    cutLettersSpacingWrap.style.display = "flex";
    cutLettersSpacingWrap.style.flexDirection = "column";
    cutLettersSpacingWrap.style.gap = "0.2rem";
    cutLettersPanel.appendChild(cutLettersSpacingWrap);

    const cutLettersSpacingHeader = createElement("div");
    cutLettersSpacingHeader.style.display = "flex";
    cutLettersSpacingHeader.style.alignItems = "center";
    cutLettersSpacingHeader.style.justifyContent = "space-between";
    cutLettersSpacingHeader.style.gap = "0.4rem";
    cutLettersSpacingWrap.appendChild(cutLettersSpacingHeader);

    const cutLettersSpacingLabel = createElement(
      "span",
      "text-xs text-muted-foreground",
      "Bogstavafstand"
    );
    cutLettersSpacingLabel.style.fontSize = "0.66rem";
    cutLettersSpacingHeader.appendChild(cutLettersSpacingLabel);

    const cutLettersSpacingValue = createElement(
      "span",
      "text-xs text-muted-foreground",
      (initialActiveFoil ? parseNumber(initialActiveFoil.letterSpacingPx, 0.6) : 0.6).toFixed(1) +
        " px"
    );
    cutLettersSpacingValue.style.fontSize = "0.66rem";
    cutLettersSpacingHeader.appendChild(cutLettersSpacingValue);

    const cutLettersSpacingInput = createElement("input");
    cutLettersSpacingInput.type = "range";
    cutLettersSpacingInput.min = "-2";
    cutLettersSpacingInput.max = "24";
    cutLettersSpacingInput.step = "0.1";
    cutLettersSpacingInput.value = (
      initialActiveFoil ? parseNumber(initialActiveFoil.letterSpacingPx, 0.6) : 0.6
    ).toFixed(1);
    cutLettersSpacingInput.style.width = "100%";
    cutLettersSpacingWrap.appendChild(cutLettersSpacingInput);

    const cutLettersCurveWrap = createElement("div");
    cutLettersCurveWrap.style.display = "flex";
    cutLettersCurveWrap.style.flexDirection = "column";
    cutLettersCurveWrap.style.gap = "0.2rem";
    cutLettersPanel.appendChild(cutLettersCurveWrap);

    const cutLettersCurveHeader = createElement("div");
    cutLettersCurveHeader.style.display = "flex";
    cutLettersCurveHeader.style.alignItems = "center";
    cutLettersCurveHeader.style.justifyContent = "space-between";
    cutLettersCurveHeader.style.gap = "0.4rem";
    cutLettersCurveWrap.appendChild(cutLettersCurveHeader);

    const cutLettersCurveLabel = createElement(
      "span",
      "text-xs text-muted-foreground",
      "Kurve"
    );
    cutLettersCurveLabel.style.fontSize = "0.66rem";
    cutLettersCurveHeader.appendChild(cutLettersCurveLabel);

    const cutLettersCurveValue = createElement(
      "span",
      "text-xs text-muted-foreground",
      String(Math.round(initialActiveFoil ? parseNumber(initialActiveFoil.curve, 0) : 0))
    );
    cutLettersCurveValue.style.fontSize = "0.66rem";
    cutLettersCurveHeader.appendChild(cutLettersCurveValue);

    const cutLettersCurveInput = createElement("input");
    cutLettersCurveInput.type = "range";
    cutLettersCurveInput.min = "-100";
    cutLettersCurveInput.max = "100";
    cutLettersCurveInput.step = "1";
    cutLettersCurveInput.value = String(
      Math.round(initialActiveFoil ? parseNumber(initialActiveFoil.curve, 0) : 0)
    );
    cutLettersCurveInput.style.width = "100%";
    cutLettersCurveWrap.appendChild(cutLettersCurveInput);

    const cutLettersTransformHint = createElement(
      "p",
      "text-xs text-muted-foreground",
      "Træk teksten for at flytte. Brug hjørnerne for proportionel skalering."
    );
    cutLettersTransformHint.style.margin = "0";
    cutLettersTransformHint.style.fontSize = "0.66rem";
    cutLettersTransformHint.style.lineHeight = "1.3";
    cutLettersPanel.appendChild(cutLettersTransformHint);

    const wallBackdrop = createElement("div");
    wallBackdrop.style.position = "absolute";
    wallBackdrop.style.left = "50%";
    wallBackdrop.style.top = "50%";
    wallBackdrop.style.transform = "translate(-50%, -50%)";
    wallBackdrop.style.width = "100%";
    wallBackdrop.style.height = "100%";
    wallBackdrop.style.pointerEvents = "none";
    wallBackdrop.style.zIndex = "0";
    wallBackdrop.style.opacity = "0.86";
    wallBackdrop.style.backgroundImage =
      "radial-gradient(ellipse 88% 92% at 50% 50%, rgba(148,163,184,0.34) 0%, rgba(148,163,184,0.22) 30%, rgba(148,163,184,0.1) 46%, rgba(148,163,184,0.03) 58%, rgba(148,163,184,0) 72%)";
    wallBackdrop.style.maskImage =
      "radial-gradient(ellipse 78% 94% at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 14%, rgba(0,0,0,0.66) 30%, rgba(0,0,0,0.32) 44%, rgba(0,0,0,0.12) 54%, rgba(0,0,0,0.02) 62%, rgba(0,0,0,0) 70%)";
    wallBackdrop.style.webkitMaskImage = wallBackdrop.style.maskImage;

    const wallHorizontal = createElement("div");
    wallHorizontal.style.position = "absolute";
    wallHorizontal.style.inset = "0";
    wallHorizontal.style.pointerEvents = "none";
    wallHorizontal.style.opacity = "0.9";
    wallHorizontal.style.backgroundImage =
      "repeating-linear-gradient(to bottom, rgba(15,23,42,0.19) 0 1.5px, rgba(0,0,0,0) 1.5px 21px)";
    wallBackdrop.appendChild(wallHorizontal);

    const wallJointsA = createElement("div");
    wallJointsA.style.position = "absolute";
    wallJointsA.style.inset = "0";
    wallJointsA.style.pointerEvents = "none";
    wallJointsA.style.opacity = "0.8";
    wallJointsA.style.backgroundImage =
      "repeating-linear-gradient(to right, rgba(15,23,42,0.16) 0 1.2px, rgba(0,0,0,0) 1.2px 76px)";
    wallJointsA.style.maskImage =
      "repeating-linear-gradient(to bottom, rgba(0,0,0,1) 0 21px, rgba(0,0,0,0) 21px 42px)";
    wallJointsA.style.webkitMaskImage = wallJointsA.style.maskImage;
    wallBackdrop.appendChild(wallJointsA);

    const wallJointsB = createElement("div");
    wallJointsB.style.position = "absolute";
    wallJointsB.style.inset = "0";
    wallJointsB.style.pointerEvents = "none";
    wallJointsB.style.opacity = "0.8";
    wallJointsB.style.backgroundImage =
      "repeating-linear-gradient(to right, rgba(15,23,42,0.16) 0 1.2px, rgba(0,0,0,0) 1.2px 76px)";
    wallJointsB.style.backgroundPosition = "38px 0";
    wallJointsB.style.maskImage =
      "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 21px, rgba(0,0,0,1) 21px 42px)";
    wallJointsB.style.webkitMaskImage = wallJointsB.style.maskImage;
    wallBackdrop.appendChild(wallJointsB);

    previewScene.appendChild(wallBackdrop);

    const windowFrame = createElement("div");
    windowFrame.style.position = "absolute";
    windowFrame.style.left = "50%";
    windowFrame.style.top = "50%";
    windowFrame.style.transform = "translate(-50%, -50%)";
    windowFrame.style.display = "none";
    windowFrame.style.alignItems = "center";
    windowFrame.style.justifyContent = "center";
    windowFrame.style.borderRadius = "0";
    windowFrame.style.border = "2px solid rgba(203,213,225,0.9)";
    windowFrame.style.background =
      "linear-gradient(158deg, rgb(255,255,255) 0%, rgb(252,253,255) 58%, rgb(246,249,252) 100%)";
    windowFrame.style.boxShadow =
      "inset 0 0 0 1px rgba(255,255,255,0.92), 0 3px 9px rgba(15,23,42,0.08)";
    windowFrame.style.overflow = "hidden";
    windowFrame.style.zIndex = "2";
    previewScene.appendChild(windowFrame);

    const windowFoilsLayer = createElement("div");
    windowFoilsLayer.style.position = "absolute";
    windowFoilsLayer.style.inset = "0";
    windowFoilsLayer.style.pointerEvents = "none";
    windowFoilsLayer.style.zIndex = "1";
    windowFrame.appendChild(windowFoilsLayer);

    const windowTextTransform = createElement("div");
    windowTextTransform.style.position = "absolute";
    windowTextTransform.style.left = "50%";
    windowTextTransform.style.top = "50%";
    windowTextTransform.style.transform = "translate(-50%, -50%)";
    windowTextTransform.style.display = "none";
    windowTextTransform.style.alignItems = "center";
    windowTextTransform.style.justifyContent = "center";
    windowTextTransform.style.border = "1px dashed rgba(100,116,139,0.45)";
    windowTextTransform.style.borderRadius = "4px";
    windowTextTransform.style.cursor = "move";
    windowTextTransform.style.touchAction = "none";
    windowTextTransform.style.userSelect = "none";
    windowTextTransform.style.zIndex = "2";
    windowFrame.appendChild(windowTextTransform);

    const windowText = createElement("div", "font-heading");
    windowText.textContent = CUT_LETTERS_DEFAULT_TEXT;
    windowText.style.position = "relative";
    windowText.style.zIndex = "1";
    windowText.style.color = "rgba(30,41,59,0.86)";
    windowText.style.fontWeight = "700";
    windowText.style.letterSpacing = "0.015em";
    windowText.style.textShadow =
      "0 0.5px 0 rgba(255,255,255,0.72), 0 1px 3px rgba(15,23,42,0.08)";
    windowTextTransform.appendChild(windowText);

    function createCutLettersResizeHandle(handle) {
      const handleNode = createElement("span");
      handleNode.setAttribute("data-cut-handle", handle);
      handleNode.style.position = "absolute";
      handleNode.style.width = "10px";
      handleNode.style.height = "10px";
      handleNode.style.borderRadius = "999px";
      handleNode.style.border = "1px solid rgba(71,85,105,0.75)";
      handleNode.style.background = "rgba(255,255,255,0.98)";
      handleNode.style.boxShadow = "0 1px 2px rgba(2,6,23,0.18)";
      handleNode.style.pointerEvents = "auto";
      handleNode.style.zIndex = "3";

      if (handle === "nw") {
        handleNode.style.left = "0";
        handleNode.style.top = "0";
        handleNode.style.transform = "translate(-50%, -50%)";
        handleNode.style.cursor = "nwse-resize";
      } else if (handle === "ne") {
        handleNode.style.right = "0";
        handleNode.style.top = "0";
        handleNode.style.transform = "translate(50%, -50%)";
        handleNode.style.cursor = "nesw-resize";
      } else if (handle === "sw") {
        handleNode.style.left = "0";
        handleNode.style.bottom = "0";
        handleNode.style.transform = "translate(-50%, 50%)";
        handleNode.style.cursor = "nesw-resize";
      } else {
        handleNode.style.right = "0";
        handleNode.style.bottom = "0";
        handleNode.style.transform = "translate(50%, 50%)";
        handleNode.style.cursor = "nwse-resize";
      }

      return handleNode;
    }

    windowTextTransform.appendChild(createCutLettersResizeHandle("nw"));
    windowTextTransform.appendChild(createCutLettersResizeHandle("ne"));
    windowTextTransform.appendChild(createCutLettersResizeHandle("sw"));
    windowTextTransform.appendChild(createCutLettersResizeHandle("se"));
    windowTextTransform.addEventListener("pointerdown", onCutLettersPointerDown);

    const windowMeasureText = createElement("div", "font-heading");
    windowMeasureText.style.position = "absolute";
    windowMeasureText.style.left = "-9999px";
    windowMeasureText.style.top = "-9999px";
    windowMeasureText.style.visibility = "hidden";
    windowMeasureText.style.pointerEvents = "none";
    windowMeasureText.style.whiteSpace = "nowrap";
    windowMeasureText.style.zIndex = "-1";
    windowFrame.appendChild(windowMeasureText);

    const banner = createElement("div");
    banner.style.position = "relative";
    banner.style.borderRadius = "0";
    banner.style.overflow = "visible";
    banner.style.border = "none";
    banner.style.boxShadow =
      "3px 4px 8px rgba(15, 23, 42, 0.11), 8px 12px 18px rgba(15, 23, 42, 0.08)";
    banner.style.background =
      "linear-gradient(132deg, hsl(var(--primary)) 0%, rgba(14,165,233,0.62) 62%, rgba(186,230,253,0.52) 100%)";
    banner.style.zIndex = "1";
    previewScene.appendChild(banner);

    const materialTexture = createElement("div");
    materialTexture.style.position = "absolute";
    materialTexture.style.inset = "0";
    materialTexture.style.pointerEvents = "none";
    materialTexture.style.zIndex = "0";
    materialTexture.style.mixBlendMode = "multiply";
    materialTexture.style.opacity = "0";
    materialTexture.style.display = "none";
    banner.appendChild(materialTexture);

    const materialShine = createElement("div");
    materialShine.style.position = "absolute";
    materialShine.style.inset = "0";
    materialShine.style.pointerEvents = "none";
    materialShine.style.zIndex = "0";
    materialShine.style.opacity = "0.2";
    materialShine.style.backgroundImage =
      "linear-gradient(112deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 24%, rgba(255,255,255,0.22) 38%, rgba(255,255,255,0.08) 53%, rgba(255,255,255,0) 72%)";
    banner.appendChild(materialShine);

    const designLayer = createElement("div");
    designLayer.style.position = "absolute";
    designLayer.style.inset = "0";
    designLayer.style.pointerEvents = "none";
    designLayer.style.overflow = "hidden";
    designLayer.style.zIndex = "1";
    banner.appendChild(designLayer);

    const designElement = createElement("div");
    designElement.style.position = "absolute";
    designElement.style.left = "0";
    designElement.style.top = "0";
    designElement.style.width = "0";
    designElement.style.height = "0";
    designElement.style.display = "none";
    designElement.style.cursor = "move";
    designElement.style.pointerEvents = "auto";
    designElement.style.touchAction = "none";
    designElement.style.outline = "1px dashed rgba(15, 23, 42, 0.6)";
    designElement.style.outlineOffset = "0";
    designElement.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.35)";
    designLayer.appendChild(designElement);

    const designImage = document.createElement("img");
    designImage.draggable = false;
    designImage.alt = "Upload preview";
    designImage.style.width = "100%";
    designImage.style.height = "100%";
    designImage.style.objectFit = "fill";
    designImage.style.pointerEvents = "none";
    designImage.style.userSelect = "none";
    designImage.style.display = "block";
    designElement.appendChild(designImage);

    function createResizeHandle(handle) {
      const handleNode = createElement("span");
      handleNode.setAttribute("data-handle", handle);
      handleNode.style.position = "absolute";
      handleNode.style.width = "12px";
      handleNode.style.height = "12px";
      handleNode.style.borderRadius = "999px";
      handleNode.style.border = "1px solid rgba(15,23,42,0.72)";
      handleNode.style.background = "rgba(255,255,255,0.94)";
      handleNode.style.boxShadow = "0 1px 2px rgba(2,6,23,0.35)";
      handleNode.style.pointerEvents = "auto";
      handleNode.style.cursor = "nwse-resize";
      handleNode.style.zIndex = "2";

      if (handle === "nw") {
        handleNode.style.left = "0";
        handleNode.style.top = "0";
        handleNode.style.transform = "translate(-50%, -50%)";
        handleNode.style.cursor = "nwse-resize";
      } else if (handle === "ne") {
        handleNode.style.right = "0";
        handleNode.style.top = "0";
        handleNode.style.transform = "translate(50%, -50%)";
        handleNode.style.cursor = "nesw-resize";
      } else if (handle === "sw") {
        handleNode.style.left = "0";
        handleNode.style.bottom = "0";
        handleNode.style.transform = "translate(-50%, 50%)";
        handleNode.style.cursor = "nesw-resize";
      } else {
        handleNode.style.right = "0";
        handleNode.style.bottom = "0";
        handleNode.style.transform = "translate(50%, 50%)";
        handleNode.style.cursor = "nwse-resize";
      }

      return handleNode;
    }

    designElement.appendChild(createResizeHandle("nw"));
    designElement.appendChild(createResizeHandle("ne"));
    designElement.appendChild(createResizeHandle("sw"));
    designElement.appendChild(createResizeHandle("se"));
    designElement.addEventListener("pointerdown", onDesignPointerDown);

    const seamOverlay = createElement("div");
    seamOverlay.style.position = "absolute";
    seamOverlay.style.inset = "0";
    seamOverlay.style.display = "none";
    seamOverlay.style.pointerEvents = "none";
    seamOverlay.style.zIndex = "2";
    seamOverlay.style.border = "11px solid rgba(14, 84, 120, 0.32)";
    seamOverlay.style.borderRadius = "0";
    seamOverlay.style.boxSizing = "border-box";
    banner.appendChild(seamOverlay);

    const tunnelTop = createElement("div");
    tunnelTop.style.position = "absolute";
    tunnelTop.style.left = "0";
    tunnelTop.style.right = "0";
    tunnelTop.style.top = "0";
    tunnelTop.style.height = "11px";
    tunnelTop.style.display = "none";
    tunnelTop.style.pointerEvents = "none";
    tunnelTop.style.zIndex = "2";
    tunnelTop.style.background =
      "linear-gradient(to bottom, rgba(15,23,42,0.30) 0%, rgba(255,255,255,0.16) 45%, rgba(15,23,42,0.18) 100%)";
    tunnelTop.style.boxShadow =
      "inset 0 -1px 0 rgba(255,255,255,0.28), inset 0 1px 0 rgba(15,23,42,0.4)";
    banner.appendChild(tunnelTop);

    const tunnelBottom = createElement("div");
    tunnelBottom.style.position = "absolute";
    tunnelBottom.style.left = "0";
    tunnelBottom.style.right = "0";
    tunnelBottom.style.bottom = "0";
    tunnelBottom.style.height = "11px";
    tunnelBottom.style.display = "none";
    tunnelBottom.style.pointerEvents = "none";
    tunnelBottom.style.zIndex = "2";
    tunnelBottom.style.background =
      "linear-gradient(to top, rgba(15,23,42,0.30) 0%, rgba(255,255,255,0.16) 45%, rgba(15,23,42,0.18) 100%)";
    tunnelBottom.style.boxShadow =
      "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(15,23,42,0.4)";
    banner.appendChild(tunnelBottom);

    const kederTopLine = createElement("div");
    kederTopLine.style.position = "absolute";
    kederTopLine.style.left = "0";
    kederTopLine.style.right = "0";
    kederTopLine.style.top = "0";
    kederTopLine.style.height = "2px";
    kederTopLine.style.display = "none";
    kederTopLine.style.pointerEvents = "none";
    kederTopLine.style.zIndex = "3";
    kederTopLine.style.background = "rgba(14, 116, 144, 0.98)";
    kederTopLine.style.boxShadow = "0 0 0 1px rgba(15, 23, 42, 0.3)";
    banner.appendChild(kederTopLine);

    const kederBottomLine = createElement("div");
    kederBottomLine.style.position = "absolute";
    kederBottomLine.style.left = "0";
    kederBottomLine.style.right = "0";
    kederBottomLine.style.bottom = "0";
    kederBottomLine.style.height = "2px";
    kederBottomLine.style.display = "none";
    kederBottomLine.style.pointerEvents = "none";
    kederBottomLine.style.zIndex = "3";
    kederBottomLine.style.background = "rgba(14, 116, 144, 0.98)";
    kederBottomLine.style.boxShadow = "0 0 0 1px rgba(15, 23, 42, 0.3)";
    banner.appendChild(kederBottomLine);

    const ringLayer = createElement("div");
    ringLayer.style.position = "absolute";
    ringLayer.style.inset = "0";
    ringLayer.style.pointerEvents = "none";
    ringLayer.style.zIndex = "4";
    banner.appendChild(ringLayer);

    const doubleSidedBadge = createElement("div", "text-xs text-muted-foreground");
    doubleSidedBadge.textContent = "4+4 print";
    doubleSidedBadge.style.position = "absolute";
    doubleSidedBadge.style.top = "50%";
    doubleSidedBadge.style.right = "-64px";
    doubleSidedBadge.style.transform = "translateY(-50%)";
    doubleSidedBadge.style.display = "none";
    doubleSidedBadge.style.padding = "4px 7px";
    doubleSidedBadge.style.borderRadius = "999px";
    doubleSidedBadge.style.background = "rgba(15, 23, 42, 0.72)";
    doubleSidedBadge.style.color = "rgba(241, 245, 249, 0.95)";
    doubleSidedBadge.style.border = "1px solid rgba(148, 163, 184, 0.4)";
    doubleSidedBadge.style.pointerEvents = "none";
    doubleSidedBadge.style.zIndex = "5";
    banner.appendChild(doubleSidedBadge);

    const uploadInfoBox = createElement("div");
    uploadInfoBox.style.position = "absolute";
    uploadInfoBox.style.top = "8px";
    uploadInfoBox.style.right = "8px";
    uploadInfoBox.style.maxWidth = "270px";
    uploadInfoBox.style.padding = "8px 10px";
    uploadInfoBox.style.borderRadius = "10px";
    uploadInfoBox.style.background = "hsl(var(--card) / 0.9)";
    uploadInfoBox.style.border = "1px solid hsl(var(--border) / 0.7)";
    uploadInfoBox.style.boxShadow = "0 1px 4px rgba(2, 6, 23, 0.1)";
    uploadInfoBox.style.backdropFilter = "blur(2px)";
    uploadInfoBox.style.pointerEvents = "none";
    uploadInfoBox.style.zIndex = "6";
    uploadInfoBox.style.display = "flex";
    uploadInfoBox.style.flexDirection = "column";
    uploadInfoBox.style.gap = "0.24rem";
    uploadInfoBox.style.opacity = "0";
    uploadInfoBox.style.transform = "translateY(-8px)";
    uploadInfoBox.style.transition =
      "opacity " + UI_ANIMATION_MS + "ms ease, transform " + UI_ANIMATION_MS + "ms ease";
    previewScene.appendChild(uploadInfoBox);

    const uploadMiniPrompt = createElement("button");
    uploadMiniPrompt.type = "button";
    uploadMiniPrompt.textContent = "Upload file";
    uploadMiniPrompt.style.position = "absolute";
    uploadMiniPrompt.style.top = "8px";
    uploadMiniPrompt.style.right = "8px";
    uploadMiniPrompt.style.padding = "0.28rem 0.58rem";
    uploadMiniPrompt.style.borderRadius = "999px";
    uploadMiniPrompt.style.fontSize = "0.74rem";
    uploadMiniPrompt.style.fontWeight = "600";
    uploadMiniPrompt.style.background = "hsl(var(--primary))";
    uploadMiniPrompt.style.color = "hsl(var(--primary-foreground))";
    uploadMiniPrompt.style.border = "1px solid hsl(var(--primary) / 0.92)";
    uploadMiniPrompt.style.boxShadow = "0 2px 7px rgba(2,6,23,0.16)";
    uploadMiniPrompt.style.cursor = "pointer";
    uploadMiniPrompt.style.opacity = "1";
    uploadMiniPrompt.style.transform = "translateY(0)";
    uploadMiniPrompt.style.transition =
      "opacity " + UI_ANIMATION_MS + "ms ease, transform " + UI_ANIMATION_MS + "ms ease";
    uploadMiniPrompt.style.pointerEvents = "auto";
    uploadMiniPrompt.style.zIndex = "7";
    uploadMiniPrompt.addEventListener("click", function () {
      uploadInfoPromptShownForNoSelection = true;
      if (refs && refs.fileInput) {
        refs.fileInput.click();
      }
    });
    previewScene.appendChild(uploadMiniPrompt);

    cutLettersTextInput.addEventListener("input", function (event) {
      const nextValue = event && event.target ? event.target.value : "";
      const activeFoil = getActiveCutLettersFoil();
      if (!activeFoil) return;
      activeFoil.text = String(nextValue || "").slice(0, 40);
      renderModule();
    });

    cutLettersFontSelect.addEventListener("change", function (event) {
      const nextFont = event && event.target ? event.target.value : CUT_LETTERS_FONTS[0];
      const activeFoil = getActiveCutLettersFoil();
      if (!activeFoil) return;
      activeFoil.fontName = CUT_LETTERS_FONTS.includes(nextFont)
        ? nextFont
        : CUT_LETTERS_FONTS[0];
      renderModule();
    });

    cutLettersWeightSelect.addEventListener("change", function (event) {
      const nextWeight = clamp(
        Math.round(parseNumber(event && event.target ? event.target.value : 700, 700)),
        300,
        900
      );
      const activeFoil = getActiveCutLettersFoil();
      if (!activeFoil) return;
      activeFoil.fontWeight = nextWeight;
      renderModule();
    });

    cutLettersSpacingInput.addEventListener("input", function (event) {
      const nextSpacing = clamp(
        parseNumber(event && event.target ? event.target.value : 0.6, 0.6),
        -2,
        24
      );
      const activeFoil = getActiveCutLettersFoil();
      if (!activeFoil) return;
      activeFoil.letterSpacingPx = nextSpacing;
      renderModule();
    });

    cutLettersCurveInput.addEventListener("input", function (event) {
      const nextCurve = clamp(
        parseNumber(event && event.target ? event.target.value : 0, 0),
        -100,
        100
      );
      const activeFoil = getActiveCutLettersFoil();
      if (!activeFoil) return;
      activeFoil.curve = nextCurve;
      renderModule();
    });

    cutLettersAddFoilButton.addEventListener("click", function () {
      ensureCutLettersStateConsistency();
      const count = cutLettersState.foils.length;
      const currentActiveFoil = getActiveCutLettersFoil();
      const nextFoil = createCutLettersFoil({
        text: CUT_LETTERS_DEFAULT_TEXT,
        fontName: currentActiveFoil ? currentActiveFoil.fontName : CUT_LETTERS_FONTS[0],
        scale: CUT_LETTERS_DEFAULT_SCALE,
        fontWeight: currentActiveFoil
          ? clamp(parseNumber(currentActiveFoil.fontWeight, 700), 300, 900)
          : 700,
        letterSpacingPx: currentActiveFoil
          ? clamp(parseNumber(currentActiveFoil.letterSpacingPx, 0.6), -2, 24)
          : 0.6,
        curve: currentActiveFoil
          ? clamp(parseNumber(currentActiveFoil.curve, 0), -100, 100)
          : 0,
        xRatio: clamp(0.26 + (count % 3) * 0.24, 0.16, 0.84),
        yRatio: clamp(0.34 + (Math.floor(count / 3) % 2) * 0.3, 0.2, 0.8),
      });
      cutLettersState.foils.push(nextFoil);
      cutLettersState.activeFoilId = nextFoil.id;
      renderModule();
    });

    const fileInput = createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
    fileInput.style.display = "none";
    wrapper.appendChild(fileInput);

    const fileInfo = createElement("p", "text-xs text-muted-foreground");
    fileInfo.style.margin = "0";
    fileInfo.style.lineHeight = "1.3";
    fileInfo.style.wordBreak = "break-word";
    uploadInfoBox.appendChild(fileInfo);

    const dpiMessage = createElement("div", "text-xs text-muted-foreground");
    dpiMessage.style.margin = "0";
    dpiMessage.style.lineHeight = "1.35";
    dpiMessage.style.textAlign = "left";
    dpiMessage.style.wordBreak = "break-word";
    uploadInfoBox.appendChild(dpiMessage);

    const clearUploadButton = createElement("button");
    clearUploadButton.type = "button";
    clearUploadButton.textContent = "Fjern upload";
    clearUploadButton.style.alignSelf = "flex-end";
    clearUploadButton.style.marginTop = "0.2rem";
    clearUploadButton.style.padding = "0.26rem 0.5rem";
    clearUploadButton.style.borderRadius = "7px";
    clearUploadButton.style.border = "1px solid hsl(var(--border) / 0.8)";
    clearUploadButton.style.background = "hsl(var(--background) / 0.9)";
    clearUploadButton.style.fontSize = "0.66rem";
    clearUploadButton.style.cursor = "pointer";
    clearUploadButton.style.display = "none";
    clearUploadButton.addEventListener("click", function () {
      clearUploadedDesign();
      renderModule();
    });
    uploadInfoBox.appendChild(clearUploadButton);

    refs = {
      wrapper,
      banner,
      previewInner,
      previewScene,
      wallBackdrop,
      cutLettersPanel,
      cutLettersAddFoilButton,
      cutLettersFoilList,
      cutLettersTextInput,
      cutLettersFontSelect,
      cutLettersWeightSelect,
      cutLettersSpacingInput,
      cutLettersSpacingValue,
      cutLettersCurveInput,
      cutLettersCurveValue,
      cutLettersTransformHint,
      windowFrame,
      windowFoilsLayer,
      windowTextTransform,
      windowText,
      windowMeasureText,
      materialTexture,
      materialShine,
      designLayer,
      designElement,
      designImage,
      seamOverlay,
      tunnelTop,
      tunnelBottom,
      kederTopLine,
      kederBottomLine,
      ringLayer,
      doubleSidedBadge,
      uploadInfoBox,
      uploadMiniPrompt,
      fileInput,
      fileInfo,
      dpiMessage,
      clearUploadButton,
    };

    fileInput.addEventListener("change", function (event) {
      const nextFile = event.target && event.target.files ? event.target.files[0] : null;
      if (!nextFile) {
        clearUploadedDesign();
        renderModule();
        return;
      }

      const objectUrl = URL.createObjectURL(nextFile);
      const image = new Image();

      image.onload = function () {
        if (uploadedDesign && uploadedDesign.url && uploadedDesign.url !== objectUrl) {
          URL.revokeObjectURL(uploadedDesign.url);
        }

        uploadedDesign = {
          name: nextFile.name,
          type: nextFile.type || "unknown",
          url: objectUrl,
          widthPx: image.naturalWidth,
          heightPx: image.naturalHeight,
        };
        designPlacement = null;

        renderModule();
      };

      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
      };

      image.src = objectUrl;
    });

    return wrapper;
  }

  function ringDiameterForSize(widthCm, heightCm) {
    const maxSideCm = Math.max(1, widthCm, heightCm);
    const scaleExponent = 0.46;
    const scaled =
      BASE_RING_DIAMETER_PX *
      Math.pow(LARGE_SIZE_REFERENCE_CM / maxSideCm, scaleExponent);
    return clamp(Math.round(scaled), MIN_RING_DIAMETER_PX, MAX_RING_DIAMETER_PX);
  }

  function finishScaleForSize(widthCm, heightCm) {
    const maxSideCm = Math.max(1, widthCm, heightCm);
    const scaled = Math.pow(LARGE_SIZE_REFERENCE_CM / maxSideCm, 0.42);
    return clamp(scaled, 0.34, 1.36);
  }

  function finishEdgeThicknessForSize(widthCm, heightCm) {
    const scaled = BASE_FINISH_EDGE_PX * finishScaleForSize(widthCm, heightCm);
    return clamp(Math.round(scaled), MIN_FINISH_EDGE_PX, MAX_FINISH_EDGE_PX);
  }

  function kederThicknessForSize(widthCm, heightCm) {
    const scaled = BASE_KEDER_LINE_PX * finishScaleForSize(widthCm, heightCm);
    return clamp(Math.round(scaled), MIN_KEDER_LINE_PX, MAX_KEDER_LINE_PX);
  }

  function ringStrokeForDiameter(diameterPx) {
    return clamp(Math.round(diameterPx * 0.16), 1, 2);
  }

  function drawRing(layer, leftPx, topPx, diameterPx, markerOffsetX, markerOffsetY) {
    const ring = document.createElement("span");
    const strokeWidth = ringStrokeForDiameter(diameterPx);
    const markerSize = clamp(Math.round(diameterPx * 0.16), 1, 2);
    ring.style.position = "absolute";
    ring.style.left = leftPx + "px";
    ring.style.top = topPx + "px";
    ring.style.width = diameterPx + "px";
    ring.style.height = diameterPx + "px";
    ring.style.borderRadius = "999px";
    ring.style.transform = "translate(-50%, -50%)";
    ring.style.boxSizing = "border-box";
    ring.style.background = "transparent";
    ring.style.border = strokeWidth + "px solid rgba(226, 232, 240, 0.9)";
    ring.style.boxShadow = "0 0 0 1px rgba(2, 6, 23, 0.1)";

    const ringHole = document.createElement("span");
    ringHole.style.position = "absolute";
    ringHole.style.inset = strokeWidth + "px";
    ringHole.style.borderRadius = "999px";
    ringHole.style.background = "hsl(var(--background))";
    ringHole.style.pointerEvents = "none";
    ring.appendChild(ringHole);

    const marker = document.createElement("span");
    marker.style.position = "absolute";
    marker.style.left = "50%";
    marker.style.top = "50%";
    marker.style.width = markerSize + "px";
    marker.style.height = markerSize + "px";
    marker.style.borderRadius = "999px";
    marker.style.pointerEvents = "none";
    marker.style.background = "rgba(2, 6, 23, 0.26)";
    marker.style.transform =
      "translate(calc(-50% + " +
      (markerOffsetX || 0).toFixed(2) +
      "px), calc(-50% + " +
      (markerOffsetY || 0).toFixed(2) +
      "px))";
    ring.appendChild(marker);

    layer.appendChild(ring);
  }

  function renderRings(widthCm, heightCm, ringsEnabled, spacingCm, finishEdgeThicknessPx) {
    if (!refs) return;
    refs.ringLayer.innerHTML = "";
    if (!ringsEnabled) return;

    const seamBandPx = Math.max(2, finishEdgeThicknessPx || finishEdgeThicknessForSize(widthCm, heightCm));
    const maxDiameterForSeam = Math.max(MIN_RING_DIAMETER_PX, seamBandPx * 2 - 2);
    const ringDiameter = clamp(
      ringDiameterForSize(widthCm, heightCm),
      MIN_RING_DIAMETER_PX,
      Math.max(MIN_RING_DIAMETER_PX, Math.round(maxDiameterForSeam))
    );
    const ringRadius = ringDiameter / 2;
    const bannerWidth = refs.banner.offsetWidth;
    const bannerHeight = refs.banner.offsetHeight;
    const seamTargetInset = seamBandPx * 0.62;
    const inset = clamp(
      Math.ceil(Math.max(ringRadius + 1.2, seamTargetInset)),
      5,
      20
    );
    const markerInset = ringRadius + 1.1;
    const usableWidth = Math.max(2, bannerWidth - inset * 2);
    const usableHeight = Math.max(2, bannerHeight - inset * 2);
    const horizontalStops = computeStops(widthCm, spacingCm);
    const verticalStops = computeStops(heightCm, spacingCm).slice(1, -1);

    horizontalStops.forEach(function (stop) {
      const x = inset + stop * usableWidth;
      drawRing(refs.ringLayer, x, inset, ringDiameter, 0, markerInset);
      drawRing(refs.ringLayer, x, bannerHeight - inset, ringDiameter, 0, -markerInset);
    });

    verticalStops.forEach(function (stop) {
      const y = inset + stop * usableHeight;
      drawRing(refs.ringLayer, inset, y, ringDiameter, markerInset, 0);
      drawRing(refs.ringLayer, bannerWidth - inset, y, ringDiameter, -markerInset, 0);
    });
  }

  function ensureModulePlacement() {
    const angivMalBlock = findBlockByHeading("angiv mal");
    if (!angivMalBlock || !angivMalBlock.parentElement) return false;

    let moduleNode = document.getElementById(MODULE_ID);
    if (!moduleNode) {
      moduleNode = buildModule();
    }

    if (moduleNode.parentElement !== angivMalBlock.parentElement || moduleNode.nextElementSibling !== angivMalBlock) {
      angivMalBlock.parentElement.insertBefore(moduleNode, angivMalBlock);
    }

    return true;
  }

  function renderModule() {
    if (!refs) return;

    const dimensions = readDimensions();
    const finish = readFinishSelection();

    const widthCm = clamp(dimensions.widthCm, 1, 5000);
    const heightCm = clamp(dimensions.heightCm, 1, 5000);
    const aspectRatio = Math.max(0.1, widthCm / heightCm);

    const availableWidth = refs.previewInner
      ? Math.max(260, refs.previewInner.clientWidth - 2)
      : MAX_VISUAL_WIDTH_PX * 2;
    let visualWidth = Math.min(
      MAX_VISUAL_WIDTH_PX,
      Math.max(180, availableWidth * 0.46)
    );
    let visualHeight = visualWidth / aspectRatio;
    if (visualHeight > MAX_VISUAL_HEIGHT_PX) {
      visualHeight = MAX_VISUAL_HEIGHT_PX;
      visualWidth = visualHeight * aspectRatio;
    }

    refs.banner.style.width = visualWidth.toFixed(1) + "px";
    refs.banner.style.height = visualHeight.toFixed(1) + "px";
    const wallWidth = Math.max(visualWidth + 110, availableWidth);
    const wallHeight = Math.max(visualHeight * 2.12, visualHeight + 140);
    const backdropWidth = wallWidth;
    const backdropHeight = Math.max(wallHeight, visualHeight + 160);
    refs.previewScene.style.width = wallWidth.toFixed(1) + "px";
    refs.previewScene.style.height = wallHeight.toFixed(1) + "px";
    refs.wallBackdrop.style.width = backdropWidth.toFixed(1) + "px";
    refs.wallBackdrop.style.height = backdropHeight.toFixed(1) + "px";

    const productVariant = readProductVariant();
    applyProductMaterialVisual(productVariant);
    ensureProductVariantInfoCard(productVariant);
    updateUploadPromptState(productVariant);
    renderCutLettersMode(productVariant, visualWidth, visualHeight, widthCm, heightCm);
    applyBackendPricingBridge(widthCm, heightCm, productVariant, finish);

    if (productVariant === "cut-letters") {
      refs.designElement.style.display = "none";
      refs.ringLayer.innerHTML = "";
      refs.seamOverlay.style.display = "none";
      refs.tunnelTop.style.display = "none";
      refs.tunnelBottom.style.display = "none";
      refs.kederTopLine.style.display = "none";
      refs.kederBottomLine.style.display = "none";
      refs.doubleSidedBadge.style.display = "none";
      stopDesignInteraction();
      updateUploadStatus(widthCm, heightCm);
      return;
    }

    if (uploadedDesign) {
      const areaM2 = areaM2FromCm(widthCm, heightCm);
      const targetDpi = recommendedDpiForArea(areaM2);
      if (!designPlacement) {
        initializeDesignPlacement(widthCm, heightCm, targetDpi);
      }
    } else {
      designPlacement = null;
      stopDesignInteraction();
    }
    applyDesignPlacementToDom();

    const finishEdgeThicknessPx = finishEdgeThicknessForSize(widthCm, heightCm);
    const kederThicknessPx = kederThicknessForSize(widthCm, heightCm);
    refs.seamOverlay.style.borderWidth = finishEdgeThicknessPx + "px";
    refs.tunnelTop.style.height = finishEdgeThicknessPx + "px";
    refs.tunnelBottom.style.height = finishEdgeThicknessPx + "px";
    refs.kederTopLine.style.height = kederThicknessPx + "px";
    refs.kederBottomLine.style.height = kederThicknessPx + "px";

    refs.seamOverlay.style.display = finish.hemming ? "block" : "none";
    refs.tunnelTop.style.display = finish.pockets ? "block" : "none";
    refs.tunnelBottom.style.display = finish.pockets ? "block" : "none";
    refs.kederTopLine.style.display = finish.keder ? "block" : "none";
    refs.kederBottomLine.style.display = finish.keder ? "block" : "none";
    refs.doubleSidedBadge.style.display = finish.doubleSided ? "block" : "none";
    renderRings(
      widthCm,
      heightCm,
      finish.rings,
      finish.ringSpacingCm || DEFAULT_RING_SPACING_CM,
      finishEdgeThicknessPx
    );
    updateUploadStatus(widthCm, heightCm);
  }

  function syncModule() {
    ensureRuntimeSiteConfig();
    ensureProductVariantSelectionTracking();
    ensureProductVariantHoverTracking();
    applyRuntimeProductButtons();
    ensureProductButtonDescriptionsHidden();
    ensureRingSpacingVariantButton();
    ensureFinishingButtonCopy();
    ensureCheckoutOrderBridge();
    if (!ensureModulePlacement()) return;
    applyAngivMalOverlayPosition();
    ensureUploadActionInPriceField();
    ensureDefaultDimensions();
    if (ensureDefaultFinishingState()) {
      scheduleSync();
      return;
    }
    renderModule();
  }

  function scheduleSync() {
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncModule, 40);
  }

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "value"],
  });

  window.addEventListener("load", scheduleSync);
  window.addEventListener("resize", scheduleSync);
  document.addEventListener("DOMContentLoaded", scheduleSync);
  window.setInterval(syncModule, 900);

  scheduleSync();
})();
