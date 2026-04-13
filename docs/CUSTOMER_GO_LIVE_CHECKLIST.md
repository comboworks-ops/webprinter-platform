# Customer Go-Live Checklist

Use this as the simple final check before letting real customers use the site.

If one important item fails, stop and fix it before continuing.

## 1. Front Page

### What to do

1. Open the homepage on desktop.
2. Scroll from top to bottom slowly.
3. Open the homepage on mobile.
4. Scroll from top to bottom slowly again.
5. Click the main menu links one by one.
6. Go back to the homepage after each check.

### What to look for

- [ ] Logo is correct
- [ ] Header/menu looks clean
- [ ] Hero/banner looks correct
- [ ] USP strip looks correct
- [ ] Product cards look correct
- [ ] Footer looks correct
- [ ] Nothing is overlapping, missing, or broken

## 2. Products

### What to do

1. Pick 5 to 10 important live products.
2. Open each product page one by one.
3. For each product, check the page before clicking anything.
4. Then click through the selectors and options.
5. If the product has different sizes/variants, test a few combinations.
6. Write down any product that looks wrong.

### What to look for

- [ ] Title is correct
- [ ] Image is correct
- [ ] Short text/description is correct
- [ ] Visible live price looks correct
- [ ] Options/selectors work
- [ ] No missing data or strange fallback text
- [ ] No broken layout

## 3. Category Navigation

### What to do

1. Go to the main product section on the homepage or shop page.
2. Click `Alle produkter`.
3. Click the other overview buttons.
4. Click root categories like `Tryksager`, `Plakater`, `Tekstiltryk` if they are visible.
5. Confirm the content changes as expected.
6. Repeat once on mobile if possible.

### What to look for

- [ ] Buttons respond correctly
- [ ] Active state is visible
- [ ] Correct products are shown
- [ ] No category button is visually broken
- [ ] No empty/broken view appears by mistake

## 4. Order Flow

### What to do

1. Pick one real product that represents a normal order.
2. Go through the full configurator or product flow.
3. Add the product to cart or continue to checkout.
4. Test file upload if artwork is required.
5. Fill in customer information like a real customer would.
6. Complete the order flow as far as the system allows.
7. Open admin and check if the order appears.

### What to look for

- [ ] No blocker in configurator
- [ ] File upload works
- [ ] Checkout form works
- [ ] No customer-facing error appears
- [ ] Order reaches admin correctly
- [ ] Notification flow works if expected

## 5. Contact And Trust

### What to do

1. Open `/kontakt`.
2. Read it like a customer would.
3. Check the footer.
4. Check the header if contact info is shown there.
5. Open terms, privacy, and cookie pages.

### What to look for

- [ ] Contact page works
- [ ] Email/phone/contact details are correct
- [ ] Terms page works
- [ ] Privacy page works
- [ ] Cookie page works
- [ ] The site looks trustworthy and complete

## 6. Customer Account

### What to do

1. Log in with a test customer account.
2. Open `Min konto`.
3. Open orders.
4. Open addresses.
5. Open settings.
6. Refresh one of the pages once.

### What to look for

- [ ] Login works
- [ ] Account pages load normally
- [ ] Orders page loads
- [ ] Addresses page loads
- [ ] Settings page loads
- [ ] No blank page or crash appears

## 7. Error Safety

### What to do

1. Refresh the homepage.
2. Refresh one product page.
3. Refresh one account/admin-adjacent page if relevant.
4. Click around normally for a few minutes.
5. Watch for white screens, broken rendering, or raw error output.

### What to look for

- [ ] No white screen on normal use
- [ ] No raw error message shown to customer
- [ ] If something breaks, a safe fallback message appears
- [ ] The site feels stable during normal navigation

## 8. Final Decision

Only say the site is ready when all of these are true:

- [ ] No broken pages found
- [ ] No wrong visible prices found
- [ ] No checkout blocker found
- [ ] No white-screen failure found
- [ ] Contact/legal pages are in place
- [ ] Ready to accept real customers

## Stop Immediately If

- A product page is broken
- A visible live price is wrong
- Checkout does not work
- Contact/legal pages are missing
- Customers can hit a blank white screen

## Notes

- Use this together with [GO_LIVE_READINESS_LOG.md](/Users/cookabelly/Documents/Antigravity%20stuff/printmaker-web-craft-main/docs/GO_LIVE_READINESS_LOG.md) if you want the full tracking version.
- After the current customer go-live steps are complete, do a separate multi-tenant fulfillment-routing review so tenant-owned storefront orders stay white-labeled correctly when fulfillment goes through master or supplier flows.
