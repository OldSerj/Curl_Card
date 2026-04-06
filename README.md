# curl-card 🌀

A tiny local web server that fetches rich preview data from URLs — kinda like what Discord or Twitter do, but without them shooting cookies at your face.

## 🔍 What does it do?

Given a URL, it returns:

- `title`: from `<title>` or Open Graph
- `description`: from `<meta name="description">` or OG
- `image`: the thumbnail used in previews
- `site`: the domain (like `nytimes.com`)
- `content`: **actual article text**, when possible (first few paragraphs)

It also serves a small frontend (`index.html`, CSS, JS) so you can paste in a URL and see the preview live.

## 🧠 Why?

Because there should be a safe, local way to preview external URLs without leaking anything to third-party APIs.  
Also, maybe you don’t want to give your cookies to sites that aren't worth it.

## 🚀 Usage

1. **Clone this repo**  
   ```bash
   git clone https://github.com/yourname/curl-card.git
   cd curl-card
   ```
2. **Install dependencies**

You only need this one:

   ```bash
   pip install requests beautifulsoup4
   ```

3. **Run Curl_Card.sh**

It will open your browser at http://localhost:8000

4. **Paste a URL into the field and hit Curl.**

## 🛠 Tech Stack
- http.server
- requests
- BeautifulSoup
- Static files frontend

## 📁 File Structure
   ```pgsql
   Curl_Card/
   ├── curl-card/
   │   ├── index.html
   │   ├── style.css
   │   └── script.js
   ├── server.py
   ├── Curl_Card.sh
   └── README.md
   ```

## ⚠️ Caveats
Some sites dynamically render content with JavaScript. This doesn’t use a headless browser, so... tough luck.

If requests or bs4 isn’t installed, the preview route will throw an error and tell you to go fix your shit.

This server does not sanitize input. It’s local only. If you preview a malicious site that sets weird meta tags, it might do odd things in your frontend (XSS-style weirdness — not dangerous unless you add auth later)

## 🧪 Example Output
  ```json
  {
    "title": "How to Train Your Dragon",
    "description": "A young Viking must capture and train a dragon.",
    "image": "https://example.com/dragon.jpg",
    "site": "dreamworks.com",
    "content": "Hiccup was a small Viking with big ideas..."
  }
```
## 🐧 Name Origin
Inspired by the curl command and the UNIX vibe of quietly getting data without making a fuss (or using Google).
