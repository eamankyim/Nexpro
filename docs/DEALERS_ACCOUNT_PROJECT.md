# Dealers Account — Project Proposal

**Prepared for:** JOSFAA ENT · **Product:** African Business Suite (ABS) · **Version:** 1.1 · **Date:** June 2026

---

Dear JOSFAA ENT team,

Thank you for raising the need for **Dealer accounts** in ABS. You explained that dealers are not the same as ordinary customers — they buy in bulk, often on credit, and need all sales and payments kept together on one running account (a ledger). This document describes what we propose to build, how it will work in your daily operations, and how we will roll it out **with JOSFAA ENT as the lead partner**.

---

## 1. Executive Summary

JOSFAA ENT sells to **retail customers** (walk-in buyers who pay per sale) and **dealers** (wholesale partners who buy in bulk, often on credit, with a **running balance** paid down over time).

Today, ABS handles retail well. What you asked for is a **Dealers Account** module: when you sell to a dealer, you **select the dealer account first**, apply wholesale prices, and record the sale on their ledger — with the option to take payment now or charge all or part to their account.

This proposal covers the business need, v1 scope, **pricing (one fee for all JOSFAA ENT branches)**, and implementation with JOSFAA ENT as pilot partner.

---

## 2. Your Business Need

**Dealers are different from customers:**

- Bulk buyers with repeat orders — not one-off retail  
- **Running accounts** — one place for charges, payments, and balance  
- **Ledger-based** — sales add to what they owe; payments reduce it  
- **Dealer-first at POS** — staff must **select the dealer first**, then add products  

**Pain points:** dealers mixed with retail (hard to see who owes what) · retail price charged by mistake · balances in notebooks or WhatsApp · no formal statements · POS built for walk-in sales.

---

## 3. Proposed Solution

ABS will add **Dealers Account**, **separate from Customers**, so your retail list stays clean and your dealer ledger stays accurate.

**What JOSFAA ENT will get:**

1. **Dealer profiles** — Business name, contact, phone, credit terms, credit limit, notes  
2. **Running ledger** — Sales on account, payments, adjustments, live balance in GHS  
3. **Dealer pricing** — Wholesale prices per product or tier, set against each branch’s catalogue  
4. **Account statements** — Printable/shareable for any date range  
5. **POS — dealer first** — Select dealer → products at dealer prices → charge to account and/or pay now  

**Benefits:** correct wholesale pricing every time · one clear POS flow · total outstanding visibility across the organisation · professional statements · **Dealers module at all branches for one fee**

---

## 4. Dealers vs Customers

- **Who:** Retail = walk-in/small buyers. Dealers = companies and bulk buyers.  
- **Pricing:** Retail = standard. Dealers = **wholesale pricing**.  
- **Payment:** Retail = usually pay now. Dealers = often **pay later** on agreed terms.  
- **Records:** Retail = receipt. Dealers = **ledger + statements** with running balance.  
- **At POS:** Retail = products → optional customer → pay. Dealers = **select dealer first** → products → settle.  
- **Credit limit:** Informal for retail; set and checked per dealer.

---

## 5. How You Will Use It

**Set up a dealer** (owner/manager): Add dealer → set credit terms and limit → set dealer prices for each branch → save (opening balance at go-live).

**Sell at POS** (cashier/sales):

1. **POS → Sell to dealer → Select dealer account first** (shows balance and credit limit)  
2. Add products — **dealer prices apply automatically**  
3. Settle: charge to account, pay now (cash/MoMo/bank), or split  
4. Confirm — print receipt; warning if sale exceeds credit limit  

You cannot sell on dealer terms without selecting the dealer account first.

**Payments & statements:** Record payment on dealer account (balance drops immediately) → view ledger → generate statement → print, PDF, or share.

---

## 6. Version 1 — What We Will Deliver

- **Dealer management** — Create, edit, deactivate; credit limit, terms, opening balance  
- **Ledger** — Running balance; sales, payments, adjustments; available credit shown  
- **Dealer pricing** — Per-product or tier, per branch; auto-applied at POS for the active branch  
- **POS (dealer-first)** — Select dealer before products; charge / pay now / split; credit limit check  
- **Payments & statements** — Cash, MoMo, bank; any period; print and PDF  
- **Reporting** — Outstanding balances; total receivables across dealers  
- **Permissions** — e.g. managers only for ledger adjustments and credit overrides  

---

## 7. Future Enhancements (After v1)

*Not in v1; prioritised with JOSFAA ENT after pilot if needed.*

Ageing report · Payment reminders (SMS/WhatsApp) · Dealer groups/price tiers · Bulk import of dealer lists/prices · Multi-branch consolidated reporting · Accounting module integration

---

## 8. Pricing & Investment

JOSFAA ENT is on **Enterprise Pro** (GHS 30,000). **Dealers Account** is a **separate one-time add-on** — not included in Enterprise Pro.

| Item | Amount (GHS) |
|------|--------------|
| Standard module price (one-time) | 10,000 |
| Launch partner discount (50%) | −5,000 |
| **Amount due from JOSFAA ENT** | **5,000** |

*One-time fees in GHS, exclusive of applicable taxes.*

**One fee unlocks Dealers at every branch.** GHS 5,000 covers the **Dealers Account module across all JOSFAA ENT branches** under your enterprise tenant — **no per-branch module fee** (Enterprise Pro, up to **10 branches**). **One dealer list and org-wide balance** shared across branches; ledger entries still show which branch each sale or payment happened at. At GA, other ABS tenants pay **standard GHS 10,000 per tenant** (all their branches included).

### Justification

Dealers Account is a **major module**: dealer registry, running ledger, dealer pricing, dealer-first POS, statements, receivables reporting, credit checks, and permissions. The GHS 10,000 standard price reflects design, engineering, testing, and support — and the value of correct bulk pricing, one source of truth for balances, and professional dealer statements. Separate from your Enterprise Pro license.

**50% launch partner discount for JOSFAA ENT:** You **requested this feature first** and will **pilot v1** — shaping requirements, UAT, production use, and reference partnership. Discount applies **only to JOSFAA ENT**; module access covers all branches with **one shared dealer account per business name**. GA price for others: **GHS 10,000 per tenant**.

### Included · Not included · Payment terms

**Included in GHS 5,000:** All of Section 6 at all branches, plus discovery workshop, dealer setup support, staff training, and pilot support.

**Not included:** Enterprise Pro license · Section 7 enhancements · dealer portal, automated collection, ERP, consignment · custom integrations · branches beyond Enterprise Pro limits (existing subscription terms apply).

**Optional payment terms:**

| Milestone | Amount (GHS) | When due |
|-----------|--------------|----------|
| Scope sign-off | 2,500 | Signed v1 scope; build starts |
| Go-live | 2,500 | Dealers Account live in production |

Full GHS 5,000 upfront also accepted.

---

## 9. Assumptions, Out of Scope & Success Criteria

**Assumptions:**

- Shop workspace at all JOSFAA ENT branches (up to 10) · GHS amounts · manual payments at shop in v1  
- **Dealers are tenant-wide** — one dealer list and org-wide running balance per organisation; any branch can sell to or record payments for the same dealer account  
- **Products and retail prices are managed per branch**, as you do today — dealer wholesale prices are set against each branch’s product catalogue  
- **Ledger entries tag the branch** (`shopId`) where each sale or payment occurred, for statements and audit  
- **Go-live setup uses opening balances only** — we will load your dealer list and each dealer’s current balance as at go-live; past notebook transactions are not imported into v1  
- **v1 focuses on the dealer ledger, statements, and receivables reporting** — a clear running account for day-to-day operations; deeper tie-in with the full accounting module can be considered later if you need it  
- Retail customers stay in the existing Customers module · JOSFAA ENT provides dealer names, opening balances, credit terms, and sample wholesale prices per branch at setup  

**Out of scope for v1:** Dealer portal · Automated collection · ERP integration · Consignment stock · Import of historical transaction history from notebooks · Full accounting-module journal entries for dealer sales

**Success criteria — v1 is done when JOSFAA ENT can:**

1. Create a dealer, set limit/prices, complete a POS sale charged to account  
2. See correct balance; dealer prices auto-apply when dealer selected **first**  
3. Record payment and see balance drop immediately  
4. Generate/share statements; get credit-limit warnings  
5. See total outstanding across dealers **organisation-wide**  
6. Confirm flow matches bulk-buyer workflow; retail POS unchanged  

---

## 10. Implementation Plan

| Phase | What happens | Deliverable |
|-------|--------------|-------------|
| **1 — Discovery** | Workshop; map dealer process; confirm terms, pricing, statements; list dealers and opening balances | Signed scope |
| **2 — Build** | Module, ledger, pricing, POS, statements, reports; UAT with JOSFAA ENT | Ready for pilot |
| **3 — Pilot** | Configure dealers; train staff; go live; support and fixes | Production use at JOSFAA ENT |
| **4 — GA** | Offer to other tenants at GHS 10,000; JOSFAA ENT as **launch partner** | Wider release |

---

## 11. Next Steps for JOSFAA ENT

1. **Review** this document, including **Section 8 (Pricing)**  
2. **Discovery workshop** — your dealers and daily process  
3. **Pilot data** — dealer list, credit terms, wholesale prices per branch, opening balances (current balance as at go-live)  
4. **Sign off** v1 scope and commercial terms (GHS 2,500 on sign-off if using instalments)  
5. **Schedule** build and pilot — Phase 2 starts after sign-off  

---

## Document control

| Field | Value |
|-------|-------|
| **Client** | JOSFAA ENT |
| **Feature** | Dealers Account · ABS |
| **Version** | 1.1 — proposal for client review |
| **Pricing** | GHS 5,000 one-time (50% off GHS 10,000); module at all branches; org-wide dealer accounts |
| **Next step** | Discovery workshop and commercial sign-off |

*Questions: contact your ABS account representative. Thank you for requesting this feature — we look forward to building it with JOSFAA ENT.*
