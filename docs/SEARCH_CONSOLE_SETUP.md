# Google Search Console Integration Setup Guide

This guide will walk you through setting up Google Search Console integration for the Webprinter Platform.

## Prerequisites

- A Google account with access to Google Search Console
- Your site (webprinter.dk) must be verified in Search Console
- Access to Supabase project dashboard

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with the same Google account that has Search Console access
3. Click **"Select a project"** dropdown at the top
4. Click **"New Project"**
5. Enter project name: `Webprinter Platform` (or your preference)
6. Click **Create** and wait for the project to be created
7. Make sure the new project is selected in the dropdown

---

## Step 2: Enable Search Console API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
   (Menu ≡ → APIs & Services → Library)
2. In the search box, type `Google Search Console API`
3. Click on the result and click **Enable**

---

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (for public access) or **Internal** (if using Google Workspace)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: `Webprinter SEO Analytics`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **Save and Continue**
6. On the **Scopes** page, click **Save and Continue** (we'll use minimal scopes)
7. On the **Test users** page:
   - Click **Add users**
   - Add the email addresses that will use this feature
   - Click **Save and Continue**
8. Review and click **Back to Dashboard**

---

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. For **Application type**, select **Web application**
4. Enter a name: `Webprinter Platform Web`
5. Add **Authorized JavaScript origins**:
   - `http://localhost:8084` (for local development)
   - `https://webprinter.dk` (for production)
6. Add **Authorized redirect URIs**:
   - `http://localhost:8084/admin/platform-seo/callback`
   - `https://webprinter.dk/admin/platform-seo/callback`
7. Click **Create**
8. **IMPORTANT**: Copy the **Client ID** and **Client Secret** that appear

---

## Step 5: Configure Supabase Secrets

1. Go to your [Supabase Dashboard](https://app.supabase.io)
2. Select your project
3. Go to **Edge Functions** → **Settings** (or Project Settings → Edge Functions)
4. Add the following secrets:

| Secret Name | Value |
|------------|-------|
| `GOOGLE_CLIENT_ID` | Your Client ID from Step 4 (ends in .apps.googleusercontent.com) |
| `GOOGLE_CLIENT_SECRET` | Your Client Secret from Step 4 (starts with GOCSPX-) |

---

## Step 6: Deploy the Edge Function

Run the following command to deploy the Search Console edge function:

```bash
supabase functions deploy search-console
```

---

## Step 7: Test the Integration

1. Go to your admin panel: `/admin/platform-seo`
2. Click on the **Analytics** tab
3. In the Search Console section, click **"Forbind til Search Console"**
4. You'll be redirected to Google to sign in and approve access
5. After approval, you'll be redirected back and see your Search Console data

---

## Troubleshooting

### "OAuth client not found"
- Double-check that you've added the correct redirect URI in Google Cloud Console
- Make sure you're using the right Client ID and Secret

### "Access denied"
- Ensure your email is added as a test user in the OAuth consent screen
- Verify your site is registered in Google Search Console

### "Function not found"
- Deploy the edge function: `supabase functions deploy search-console`

### "Token expired"
- Click "Afbryd" (Disconnect) and reconnect to refresh the authorization

---

## What Data Will You See?

Once connected, you'll see:

| Metric | Description |
|--------|-------------|
| **Klik** | Number of clicks from Google Search to your site |
| **Visninger** | How often your site appeared in search results |
| **CTR** | Click-through rate (clicks ÷ impressions) |
| **Position** | Average ranking position in search results |
| **Top Søgeord** | What search terms bring people to your site |
| **Top Sider** | Which of your pages perform best in search |

---

## Security Notes

- We only request **read-only** access to Search Console
- OAuth tokens are stored securely in your Supabase database
- Tokens can be revoked at any time via Google Account settings
- No data is shared with third parties

---

## Next Steps After Setup

1. Monitor your search performance weekly
2. Use the SEO optimization tools in the Platform SEO Center to improve rankings
3. Run PageSpeed tests to ensure good technical performance
4. Update meta descriptions for pages with low CTR
