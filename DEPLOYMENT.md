# Deployment guide

Meridian Events has two parts:

- **Frontend:** React + Vite, deployed to GitHub Pages.
- **API:** Express + TypeScript, deployed separately (for example, Render).

GitHub Pages cannot run the Express API. Booking, payment-demo, FX, share-link, and organizer API actions require the API service to be online.

## 1. Deploy the API on Render

1. Push this branch or merge it into the branch you want to deploy.
2. In Render, choose **New → Blueprint** and connect this repository.
3. Render reads `render.yaml` and creates the `meridian-events-api` web service.
4. After deployment, open the service URL and check `/api/health`. It should return JSON with `"ok": true`.
5. In the Render service's Environment settings, set `ALLOWED_ORIGINS` to your exact GitHub Pages origin, for example `https://pari343.github.io` (no trailing slash). If your Pages URL uses a project path, the origin is still just the scheme and host.

The included free Render configuration uses temporary local storage. Demo bookings and event changes can be lost when the free service sleeps or is redeployed. Use a persistent database before relying on it for real bookings.

## 2. Connect GitHub Pages to the API

1. Open the repository on GitHub.
2. Go to **Settings → Secrets and variables → Actions → Variables**.
3. Add a repository variable named `VITE_API_BASE_URL`.
4. Set its value to the full Render service URL, such as `https://meridian-events-api.onrender.com` (no trailing slash).
5. Open **Actions**, run the **Deploy Meridian Events** workflow, or push a new commit to `main`.
6. When the build completes, open the GitHub Pages site and test the event list and booking form.

If `VITE_API_BASE_URL` is empty, the frontend expects the API to be served from the same domain.

## 3. Payment status

The current checkout validates demo card/UPI details and creates simulated transactions. It does **not** charge a real card or UPI account. Before accepting real money, integrate a payment provider (such as Razorpay) on the server, verify signed payment webhooks, and never store raw card numbers or CVC values.

## 4. Before production use

- Move bookings, events, and transactions to a managed database.
- Add organizer/customer authentication and authorization to organizer actions.
- Add real payment-provider checkout and webhook verification.
- Add a transactional email provider for booking confirmations.
- Configure backups, monitoring, rate limiting, and privacy/retention policies.
