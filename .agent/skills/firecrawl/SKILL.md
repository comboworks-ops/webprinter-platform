---
name: firecrawl
description: Scrape web pages and extract structured data using Firecrawl MCP server. Use for supplier pricing pages, product catalogs, or any web content extraction.
---

# Firecrawl Skill

Use Firecrawl MCP tools for web scraping when you need:
- Clean markdown extraction from web pages
- Structured data extraction with LLM
- Site crawling and URL mapping
- JavaScript-rendered content

## Prerequisites

Set your API key in the environment:
```bash
export FIRECRAWL_API_KEY="your-api-key"
```

Or add to `.env.local`:
```
FIRECRAWL_API_KEY=your-api-key
```

## Available MCP Tools

Once configured, these tools become available:

| Tool | Purpose |
|------|---------|
| `firecrawl_scrape` | Scrape a single URL to markdown |
| `firecrawl_crawl` | Crawl a site starting from URL |
| `firecrawl_map` | Map all URLs on a site |
| `firecrawl_extract` | Extract structured data with schema |

## When to Use

- **Firecrawl**: Simple pages, static content, when you need clean markdown
- **Playwright scripts**: Complex dynamic pages, login required, multi-step interactions

## Example Usage

Scrape a supplier pricing page:
```
Use firecrawl_scrape on https://supplier.example.com/products
Extract the pricing table as markdown
```

Extract structured pricing data:
```
Use firecrawl_extract on the supplier URL
Schema: { materials: [], quantities: [], prices: [] }
```

## Integration with Fetch Skills

Firecrawl can complement existing Playwright-based fetch scripts:
1. Use Firecrawl for initial page discovery and URL mapping
2. Use Playwright scripts for complex price extraction workflows
3. Combine both for hybrid approaches

## Notes

- Firecrawl requires an API key (free tier available)
- For WIRmachenDRUCK and Pixart, the existing Playwright scripts are optimized; use those first
- Firecrawl is best for simpler scraping tasks or new supplier integrations
