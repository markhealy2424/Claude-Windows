# FINAL REQUIREMENTS DESIGN FRAMEWORK (RDF)

## Windows & Doors Quote Automation Platform (Build-Ready for Engineering)

---

## 0. SYSTEM SUMMARY

This application automates the full lifecycle:

1. Receive building plans (PDF)
2. Extract window & door data
3. Generate "Ready for Quote" (RFQ)
4. Receive supplier quote
5. Validate + detect discrepancies
6. Apply pricing + markup
7. Generate branded "Proposal for Client"

The system is **AI-assisted but human-verified**.

---

## 1. CORE SYSTEM ARCHITECTURE

### 1.1 Core Engines

1. **Plan Extraction Engine**
2. **Mark Detection & Counting Engine**
3. **Schedule Matching Engine**
4. **Sketch Generation Engine**
5. **RFQ Generator**
6. **Quote Parsing Engine**
7. **Discrepancy Engine**
8. **Pricing Engine**
9. **Proposal Generator**

---

## 2. PART 1: BUILDING PLANS → READY FOR QUOTE

### 2.1 Plan Upload Module

**Inputs:** PDF (multi-page)

**Capabilities:**
- Page preview
- Zoom + crop
- Tag pages as: Floor Plan, Elevation, Window Schedule, Door Schedule

### 2.2 Mark Detection & Counting Engine (CRITICAL)

Identify all window/door marks and count frequency across plans.

```
Scan plans → detect labels (A, B, C, D1, etc.)
→ group identical marks
→ count occurrences
```

### 2.3 Schedule Matching Engine

Match detected marks with schedule specs. Extract: Width (in + mm), Height (in + mm), Type, Operation, Gridlines, Notes.

Validation: flag if mark exists in plan but not schedule, or if schedule item not used.

### 2.4 Window/Door Data Model

```json
{
  "mark": "string",
  "quantity": "number",
  "type": "string",
  "operation": "string",
  "width_in": "number",
  "height_in": "number",
  "width_mm": "number",
  "height_mm": "number",
  "panels": "number",
  "grid": "boolean",
  "sketch": "image",
  "notes": "string"
}
```

### 2.5 Sketch Generation Engine (HIGH PRIORITY)

**Input:** Width, Height, Panels, Type, Operation

**Rules:**
- Casement → require swing direction, render hinge + arrow
- Sliding → render arrow direction
- Panels > 1 → divide frame evenly
- Mulled → combine frames

**Output:** Clean vector-style image with correct proportions.

### 2.6 Manual Edit Layer

Edit any field, add/remove items, override counts, replace sketches, add notes.

### 2.7 RFQ Generator

**Columns:** Mark, Qty, Sketch, Type, Width, Height, Operation, Notes

**Export:** PDF (primary), Excel (secondary)

---

## 3. PART 2: SUPPLIER QUOTE → PROPOSAL

### 3.1 Supplier Quote Upload

PDF parsing, multi-supplier support.

### 3.2 Quote Parsing Engine

Extract: Mark, Quantity, Type, Dimensions, Cost.

### 3.3 Discrepancy Engine (CRITICAL)

Compare RFQ vs Supplier Quote.

| Check              | Example                    |
| ------------------ | -------------------------- |
| Missing items      | RFQ has A, quote missing A |
| Quantity mismatch  | RFQ=3, Quote=2             |
| Type mismatch      | Casement vs Fixed          |
| Operation mismatch | Left vs Right              |

### 3.4 Supplier Revision Generator

Auto-generate revision request messages.

### 3.5 Pricing Engine

- Default markup: **30%**
- Formula: `client_price = supplier_price * 1.30`
- Options: per-item override, delivery, fees, rounding

### 3.6 Proposal Generator

Branded output with sketches, descriptions, and pricing table (Item, Qty, Description, Size, Price).

---

## 4. PROJECT MANAGEMENT LAYER

Each project: Plans, RFQ, Supplier Quotes, Proposal.

**Status flow:** New → Extracting → RFQ Ready → Quote Received → Review → Proposal → Sent

---

## 5. UI FLOW

- **Dashboard** — list projects
- **Project View** — tabs: Plans, Items, RFQ, Quotes, Proposal
- **Item Editor** — table + edit panel
- **Sketch Generator** — live preview

---

## 6. AI REQUIREMENTS

**AI should:** detect marks, extract schedule, suggest matches, parse quotes.

**AI should NOT:** auto-finalize anything without user confirmation.

---

## 7. MVP BUILD REQUIREMENTS

1. Upload plans
2. Manual item entry
3. Sketch generator
4. RFQ PDF export
5. Upload supplier quote
6. Manual comparison
7. Apply markup
8. Generate proposal PDF

---

## 8. ENGINEERING NOTES

- Frontend: React
- Backend: Node.js / Python
- PDF Parsing: OCR + structured parsing
- Storage: AWS S3
- Database: PostgreSQL
- Image Generation: SVG engine

---

## 9. SUCCESS METRICS

- Reduce quote creation time by 70%
- Reduce errors in specs
- Standardize proposals
