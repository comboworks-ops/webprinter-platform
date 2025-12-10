/**
 * Hæfter Price Scraper for Lasertryk.dk
 * Scrapes prices for booklets in formats: A5, A4, M65
 * Page counts: 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80
 */

// Format values from the website
const formats = [
    { name: 'A5', value: '5' },
    { name: 'A4', value: '4' },
    { name: 'M65', value: '144' }
];

// Standard page counts available on website
const pageCounts = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80];

// Standard quantities to scrape
const quantities = [100, 250, 500, 1000, 2000, 5000, 10000];

// Results array
const results = [];

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setFormat(formatValue) {
    const formatSelect = document.querySelector('select[id*="_Format_field_"]');
    if (formatSelect) {
        formatSelect.value = formatValue;
        formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(500);
    }
}

async function setPageCount(pageCount) {
    const pagesSelect = document.querySelector('select[id*="_Pages_field_"]');
    if (pagesSelect) {
        pagesSelect.value = pageCount.toString();
        pagesSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(500);
    }
}

async function setQuantity(qty) {
    const qtyInput = document.querySelector('input[id*="_Impression_field_"]');
    if (qtyInput) {
        qtyInput.value = qty.toString();
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
        qtyInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        await delay(300);
    }
}

async function calculatePrice() {
    // Find and click the calculate button
    const calcButton = document.querySelector('input[value="Beregn"], button:contains("Beregn"), .btn-primary');
    if (calcButton) {
        calcButton.click();
        await delay(1500); // Wait for price calculation
    }
}

async function getPrice() {
    // Wait a bit more for dynamic content
    await delay(500);

    // Try to find price in various places
    const priceSelectors = [
        '.price span',
        '.item-price',
        '#price',
        '.total-price',
        '[class*="price"]'
    ];

    for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
            const priceText = el.textContent.replace(/[^\d,.]/g, '').replace(',', '.');
            const price = parseFloat(priceText);
            if (!isNaN(price) && price > 0) {
                return price;
            }
        }
    }

    // Alternative: Look for any element with kr text
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
        if (el.textContent.includes('kr') && el.children.length === 0) {
            const priceMatch = el.textContent.match(/(\d+[.,]?\d*)\s*kr/);
            if (priceMatch) {
                return parseFloat(priceMatch[1].replace(',', '.'));
            }
        }
    }

    return null;
}

async function scrapeAllPrices() {
    console.log('Starting price scrape for hæfter...');

    for (const format of formats) {
        console.log(`\nScraping format: ${format.name}`);
        await setFormat(format.value);
        await delay(1000);

        for (const pageCount of pageCounts) {
            console.log(`  Pages: ${pageCount}`);
            await setPageCount(pageCount);
            await delay(800);

            for (const qty of quantities) {
                await setQuantity(qty);
                await calculatePrice();
                const price = await getPrice();

                results.push({
                    format: format.name,
                    pages: pageCount,
                    quantity: qty,
                    price: price || 'N/A'
                });

                console.log(`    Qty ${qty}: ${price || 'N/A'} kr`);
            }
        }
    }

    console.log('\n\nScraping complete!');
    console.log('Total records:', results.length);

    // Convert to CSV
    let csv = 'format,pages,quantity,price\n';
    results.forEach(r => {
        csv += `${r.format},${r.pages},${r.quantity},${r.price}\n`;
    });

    console.log('\n--- CSV OUTPUT ---\n');
    console.log(csv);

    return { results, csv };
}

// Run the scraper
scrapeAllPrices();
