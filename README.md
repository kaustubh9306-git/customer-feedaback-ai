# Customer Review Sentiment Dashboard

A lightweight static dashboard for exploring customer-review sentiment, model confidence, and common review themes. It reads the sample CSV in the browser and does not require a Python server or external charting services.

## Features

- Total reviews, positive/negative sentiment, and average confidence
- Sentiment and confidence filters
- Sentiment and confidence distribution charts
- Common positive and negative review themes
- Review table and filtered CSV export
- Upload your own CSV with `sentiment`, `confidence`, and `review` columns
- Responsive layout for desktop and mobile

## Run locally

Open `index.html` through a local static web server so the sample CSV can be loaded:

```bash
npx serve .
```

Or, with Python installed:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to Vercel

Import this GitHub repository into Vercel. The root `index.html`, `styles.css`, `app.js`, and `analyzed_reviews.csv` are served as static assets; no build command or server function is required. The former Streamlit implementation remains in `review_dashboard.py` for users who want to run it separately.

## Validate

```bash
npm test
```

The test suite uses Node.js built-ins and requires no npm dependencies.
