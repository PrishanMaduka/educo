# 13 Fees, payments and finance

Prototype: Fees & invoicing and Accounting in `design/admin.html`, and Payments in `design/parent.html`. Money is in integer minor units. The default currency is the school's (LKR for Sri Lanka; MVR, AED, USD and others by country).

All fee maths lives in `packages/domain/fees` and is unit-tested: line totals, discounts, instalments, rounding (round half up to whole rupees on invoice totals), and part payments.

## Fee setup
- **Fee items:** for example "Tuition fee – Term 1" (285,000), "Development levy" (25,000), "Transport (Route 4)" (42,000), "Swimming programme" (12,500), "Lab & materials" (9,500).
- **Fee structures:** per academic year, per term and per stage, as a list of items with amounts. Stages come from the school's curriculum.
- **Discount rules:** each rule has a name the school chooses (shown on the invoice line), a percentage (0.5 to 100, in steps of 0.5), what it comes off (tuition, or the whole invoice), who gets it (second child in a family, third child and more, children of staff, scholarship holders, families who pay early, or students chosen by hand), and an on/off state. Seeded defaults: Sibling (2nd child) 10%, Sibling (3rd child +) 15%, Staff children 50%, Scholarship 25%, all off tuition. Siblings are detected through shared guardians. When several rules apply to one student, each is applied to the original amount and the total discount is capped at the amount it comes off.

## Fees & invoicing page (tabs)
- **Invoices:**
  - Status chips: All, Paid, Partially paid, Sent, Overdue, Draft (with counts).
  - Table: invoice, student, due date, amount, paid, balance, status. Row click opens the **invoice preview drawer** (school header, lines, totals, payments, actions: send, remind, record payment, void).
  - When drafts exist, a banner offers "{n} draft invoices are ready to check" with **Send {n} to parents**.
  - KPIs: billed this term, collected (and the rate), overdue (with "auto-reminder in N days"), and the share paid in the parent app.
- **Fee structures:** edit the amounts per stage and term.
- **Payments:** received payments with method, gateway reference, and receipt.
- **Online payments:**
  - gateway cards to switch on and configure: PayHere (card, eZ Cash, mCash, Genie for LKR), Stripe (international cards), bank transfer (shows the account details and asks parents to use the invoice number as the reference);
  - settings: who pays card fees (school or parent), instalments allowed, part payments allowed;
  - recent online payments matched to invoices.

## Billing run (drawer, four steps)
Replaces "Generate invoices".
1. **Term and timing:** term, due date, and "Offer a 3-instalment plan".
2. **Fees:** tuition per stage (from the structure; editable for this run), the development levy, and transport (only for students on a route).
3. **Discounts:** a sentence with the total ("4 discounts will take Rs 6,352,113 off this run"), then one card per rule:
   - top line: on/off switch, **Discount name**, **Percentage** (with a % unit) and a remove button;
   - second line: **Off** (Tuition or Whole invoice), **Who gets it**, and the amount and number of students it affects (or a **Students** count for "Students I choose", picked in the review step);
   - amounts update as you type; **Add a discount** adds a blank rule;
   - validation: every rule needs a name, and the percentage must be between 1 and 100;
   - **Save these discounts for future billing runs** (on by default) writes the rules back to `discount_rules`; otherwise the edits apply to this run only (stored on the billing run). Fee structures shows the saved rules in its footnote.
4. **Review:**
   - totals: number of invoices, gross, discounts, net, and the totals by stage;
   - exceptions: students with no guardian set as fee payer, and students on leave (excluded).
   
   **Create draft invoices** creates the drafts as one idempotent job.

Afterwards the drafts are checked on the Invoices tab and sent together. Sending notifies fee-payer guardians by push and email.

## Reminders
Automatic reminders go 3 days before the due date, then at 7 and 14 days overdue (the school can change these). Each invoice also has a manual "Remind" button. The wording is friendly. Each reminder is recorded on the invoice.

## Parent payments
- Pay sheet: see [09](09-parent-app.md#payments). The methods shown follow `payment_settings`.
- Flow:
  1. `POST /family/payments/intent { invoiceId, amountMinor, method }` returns a gateway session (PayHere checkout parameters with a server-generated hash, or a Stripe PaymentIntent client secret).
  2. The app completes the payment with the gateway SDK or web checkout.
  3. The gateway webhook (signature verified) marks the payment `succeeded`, updates the invoice (`partially_paid` or `paid`), posts journal lines, issues a receipt number, notifies the guardian and the finance office, and emits realtime `payment.succeeded`.
  4. The app never marks a payment as paid itself. It polls or listens for the event and shows a success state with a receipt.
- **Instalments:** three equal parts, the first due at once, then at +30 and +60 days. Instalments make child invoices or schedule entries on the parent invoice.
- **Part payments** (when allowed): the minimum is 10% of the balance.
- **Bank transfer:** shows the details and the reference. Finance matches the transfer manually (record payment), or through a bank statement CSV import (v2).
- **Refunds:** finance staff with `fees.approve` can refund through the gateway and post reversing journal lines.
- **Card fee:** when parents pay it, show the fee before confirming and add it as a separate line on the receipt.

## Canteen wallet (module `fees`)
Parents top up (minimum 1,000), set a daily limit and see purchases. Purchases come from a canteen point-of-sale integration (v2); v1 supports manual purchase entry by staff.

## Trips and forms with fees
A form with an amount creates an invoice line when the parent answers yes (see [08](08-staff-portal.md#evenings--forms)).

## Accounting
- Chart of accounts (assets, liabilities, equity, income, expenses) with a default set for schools.
- **Journal entries:** manual entries with debit/credit lines. Posting is blocked unless the totals balance (show the difference live).
- **Automatic postings:**
  - an invoice sent: debit Fees receivable, credit Fee income (by fee item account);
  - a payment: debit Bank or gateway clearing, credit Fees receivable;
  - a gateway fee: debit Bank charges.
- **Dashboard:** income vs expenditure by month, spend by category, bank balances, and budget vs actual.
- **Budgets:** per account per academic year.
- **Exports:** CSV for the accountant. Full general-ledger integration (QuickBooks, Xero) is v2.

## Platform billing (console)
- Schools pay Quad per student per month by plan, with the annual discount when billed yearly.
- Stripe Billing (or PayHere for LKR) charges the school's card.
- A failed charge sets the school to `past_due` after 3 retries, shows in Needs you today, and adds an early-warning factor. Schools are not suspended automatically.
