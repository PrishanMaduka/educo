# 13 Fees, payments and finance

Prototype: Fees & invoicing and Accounting in `design/admin.html`, and Payments in `design/parent.html`. Money is in integer minor units. The default currency is the school's (LKR for Sri Lanka; MVR, AED, USD and others by country).

All fee maths lives in `packages/domain/fees` and is unit-tested: line totals, discounts, instalments, rounding (round half up to whole rupees on invoice totals), and part payments.

## Fee setup
- **Fee items:** for example "Tuition fee – Term 1" (285,000), "Development levy" (25,000), "Transport (Route 4)" (42,000), "Swimming programme" (12,500), "Lab & materials" (9,500).
- **Fee structures:** per academic year, per term and per stage, as a list of items with amounts. Stages come from the school's curriculum.
- **Discount rules:** each rule has a name the school chooses (shown on the invoice line), a percentage (1 to 100, in steps of 0.5), what it comes off (tuition, or the whole invoice), who gets it (second child in a family, third child and more, children of staff, scholarship holders, families who pay early, or students chosen by hand), and an on/off state. Seeded defaults: Sibling (2nd child) 10%, Sibling (3rd child +) 15%, Staff children 50%, Scholarship 25%, all off tuition. Siblings are detected through shared guardians. When several rules apply to one student, each is applied to the original amount and the total discount is capped at the amount it comes off.

## Fees & invoicing page (tabs)
- **Invoices:**
  - Status chips: All, Paid, Partially paid, Sent, Overdue, Draft (with counts).
  - Table: invoice, student, due date, amount, paid, balance, status. Row click opens the **invoice preview drawer** (school header, lines, totals, payments, actions: send, remind, record payment, void).
  - When drafts exist, a banner offers "{n} draft invoices are ready to check" with **Send {n} to parents**.
  - KPIs: billed this term, collected (and the rate), overdue (with "auto-reminder in N days"), and the share paid in the parent app.
- **Fee structures:** edit the amounts per stage and term.
- **Payments:** received payments with method, gateway reference, receipt and refunds. A payment opens a drawer with **Refund** (full or part, with a reason; needs `fees.approve`).
- **Online payments:**
  - gateway cards to switch on and configure: PayHere (card, eZ Cash, mCash, Genie for LKR), Stripe (international cards, Apple Pay and Google Pay), bank transfer (shows the account details and asks parents to use the invoice number as the reference);
  - each gateway card has **Connect** (credentials, below), the mode (Test or Live) and its status (Not connected, Connected, Failing);
  - settings: who pays card fees (school or parent), instalments allowed, part payments allowed;
  - recent online payments matched to invoices, and **Settlements** (below).
- **Canteen:** the week's menu (date, meal, description, allergens, price) and the wallets by class with balance and daily limit. **Record purchase** (drawer: student, item or amount, note) is the v1 way to spend from a wallet; it is refused over the balance or the daily limit with the reason shown. Each transaction can be refunded to the wallet.

## Who owns the money
- **School fees belong to the school.** Each school uses its own PayHere merchant account and/or its own Stripe account. Money from parents settles straight into the school's bank account; Quad never holds or moves school fees.
- **Credentials:** a school admin with `fees.approve` enters them in Fees → Online payments → **Connect**:
  - PayHere: merchant id, merchant secret, app id and app secret (for the mobile SDK and refunds), and the business name shown at checkout;
  - Stripe: the secret key and publishable key of the school's account (restricted key recommended), and the webhook signing secret;
  - the mode (Test or Live).
  
  **Test connection** makes a harmless API call and marks the account `verified`. Secrets are envelope-encrypted with KMS in `payment_gateway_accounts`, never returned to any client (the form shows only the last 4 characters), and every change is audited. The webhook URLs to paste into the gateway (`https://quad-edu.com/api/v1/webhooks/payhere` and `…/stripe`) are shown with a copy button.
- **Webhooks:** the API verifies the gateway signature (PayHere `md5sig` with the school's merchant secret; Stripe `Stripe-Signature` with the school's webhook secret), finds the school with `tenant_by_gateway_account(provider, account_id)` and processes the event once (idempotent on the gateway event id). See [05](05-auth-tenancy-rbac.md#tenant-less-entry-points).
- **Settlements and reconciliation:** the `reconcile-payments` job checks pending payments and refunds hourly against the gateway. The `reconcile-settlements` job reads each school's payouts daily (Stripe balance transactions; PayHere settlement reports when the API offers them, otherwise a CSV upload) and matches them to payments. The **Settlements** list shows each payout (date, gross, fees, net, payments count) as Matched or Mismatch with the differing payments, so finance can tie it to the bank statement. Gateway fees are posted to Bank charges.

## Billing run (drawer, four steps)
Replaces "Generate invoices".
1. **Term and timing:** term, due date, and "Offer a 3-instalment plan".
2. **Fees:** tuition per stage (from the structure; editable for this run), the development levy, and transport (only for students on a route).
3. **Discounts:** a sentence with the total ("4 discounts will take Rs 6,352,113 off this run"), then one card per rule:
   - top line: on/off switch, **Discount name**, **Percentage** (with a % unit) and a remove button;
   - second line: **Off** (Tuition or Whole invoice), **Who gets it**, and the amount and number of students it affects (or a **Students** count for "Students I choose", picked in the review step);
   - amounts update as you type; **Add a discount** adds a blank rule;
   - validation: every rule needs a name, and the percentage must be between 1 and 100, in steps of 0.5;
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
  1. `POST /family/payments/intent { invoiceId, amountMinor, method }` returns a gateway session on the school's own account (PayHere checkout parameters with a server-generated hash, or a Stripe PaymentIntent client secret).
  2. The app completes the payment with the gateway SDK (details in [09](09-parent-app.md#payments-handshake)).
  3. The gateway webhook (signature verified) marks the payment `succeeded`, updates the invoice (`partially_paid` or `paid`), posts journal lines, issues a receipt number, notifies the guardian and the finance office, and emits realtime `payment.succeeded`.
  4. The app never marks a payment as paid itself. It polls or listens for the event and shows a success state with a receipt.
- **Instalments:** three equal parts, the first due at once, then at +30 and +60 days. Instalments make child invoices or schedule entries on the parent invoice.
- **Part payments** (when allowed): the minimum is 10% of the balance.
- **Bank transfer:** shows the details and the reference. Finance matches the transfer manually (record payment), or through a bank statement CSV import (v2).
- **Refunds:** finance staff with `fees.approve` refund a gateway payment in full or in part (`POST /payments/:id/refunds`, with a reason). The API calls the gateway's refund API on the school's account and creates a `refunds` row (`pending`). The gateway's refund webhook (or the hourly reconcile) marks it `succeeded` or `failed`; on success the payment becomes `refunded` or `partially_refunded`, the invoice balance reopens, reversing journal lines are posted, the guardian is notified and `refund.updated` is emitted. Cash and bank-transfer refunds are recorded by hand with the same approval. Refunds are audited.
- **Card fee:** when parents pay it, show the fee before confirming and add it as a separate line on the receipt.

## Canteen wallet (module `fees`, built in M11)
- Parents top up (minimum 1,000 unless the school sets lower), set a daily limit and see purchases and the menu ([09](09-parent-app.md#payments)).
- **Top-up flow:** the same handshake as an invoice payment, with `walletTopUp` instead of an invoice, through the school's own gateway. The webhook credits the wallet (`wallet_transactions` kind `topup`, linked to the payment) and emits `wallet.updated`. Top-ups are refundable like payments.
- Purchases come from a canteen point-of-sale integration (v2); v1 supports manual purchase entry by staff (Fees → Canteen → **Record purchase**). A purchase also adds the "lunch" dot to the child's day ring.

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
How Quad bills schools for Quad. This is separate from school fees: it uses **Quad's own** PayHere and Stripe accounts and bank transfer, and Quad generates its own invoices (not Stripe Billing).

- **Price:** per student per month by plan (seats = the plan's billed students, at least the active student count), with the plan's annual discount when billed yearly. Prices are in USD; LKR invoices use the rate fixed on the invoice date.
- **Trial:** no charge during the trial. Seven and two days before it ends, the billing contact is asked to add a payment method. At the end the first invoice is issued; with no payment method the school becomes `past_due` and the dunning schedule below starts.
- **Invoices:** the `platform-billing` job issues one invoice per school per period (monthly on the subscription day, or yearly) with lines for seats, proration and SMS usage (passed through from the previous month, see [12](12-moments-messaging.md#delivery-providers)), and credits. Tax comes from `tax_rates` for the school's country (for example VAT or SSCL in Sri Lanka, VAT in the UAE); the invoice shows Quad's registration number and the school's tax id when given. A PDF is rendered and emailed to the billing contact; the console and the school admin can download it.
- **Billing contact:** name, email, address and tax id on the subscription, edited in the console (and by school admins in Settings → General as "Billing contact"). Invoices and dunning emails go there and to the school admins.
- **Payment method:** a card saved with Quad's Stripe (international) or PayHere (LKR) account through a hosted card-update link emailed to the billing contact (the console never sees card numbers), or bank transfer (the invoice shows Quad's bank details; billing staff press **Mark paid** when it arrives).
- **Changes in the period:** adding seats or upgrading charges the prorated difference on the next invoice; downgrades and fewer seats apply from the next period. Plan price changes apply as chosen in the plan editor ([07](07-platform-console.md#plans--billing)).
- **Dunning:** a failed card charge is retried automatically at 3, 7 and 14 days, each with an email to the billing contact and a banner for school admins ("Your Quad payment didn't go through. Update your card."). On the first failure the school becomes `past_due`, shows in the console's Needs you today, and adds the billing factor to school early warning.
- **Suspension:** at **21 days past due** the school is suspended automatically for non-payment (reason "Payment overdue", shown to staff and parents) unless a platform owner has extended it. Paying the invoice reactivates it at once. Data is never deleted for non-payment without the separate deletion process.
