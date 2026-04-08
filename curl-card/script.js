class CurlCard {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.darkMode = localStorage.getItem('curlcard-dark') === 'true';
        this.updateTheme();
    }

    initElements() {
        this.urlInput = document.getElementById('url-input');
        this.curlBtn = document.getElementById('curl-btn');
        this.previewCard = document.getElementById('preview-card');
        this.reader = document.getElementById('reader');
        this.status = document.getElementById('status');
        this.toggleDark = document.getElementById('toggle-dark');
        this.backBtn = document.getElementById('back-to-preview');
        this.readerTitle = document.getElementById('reader-title');
        this.readerSite = document.getElementById('reader-site');
        this.readerContent = document.getElementById('reader-content');
    }

    bindEvents() {
        this.curlBtn.addEventListener('click', () => this.curl());
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.curl();
        });
        this.toggleDark.addEventListener('click', () => this.toggleDarkMode());
        this.backBtn.addEventListener('click', () => this.showPreview());
    }

    async curl() {
        const url = this.urlInput.value.trim();
        if (!this.isValidUrl(url)) {
            this.showStatus('Enter a valid URL, netrunner.', 'error');
            return;
        }

        this.showPreview('Fetching full page... 🌀');
        this.curlBtn.disabled = true;
        this.curlBtn.textContent = 'Curling...';

        try {
            const data = await this.fetchPage(url);
            this.displayPreview(data);
            this.currentData = data;
        } catch (error) {
            this.showPreview(`Error: ${error.message}`);
            console.error('Curl failed:', error);
        } finally {
            this.curlBtn.disabled = false;
            this.curlBtn.textContent = 'Curl It';
        }
    }

    isValidUrl(string) {
        try {
            new URL(string.startsWith('http') ? string : 'https://' + string);
            return true;
        } catch {
            return false;
        }
    }

    async fetchPage(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (CurlCard/2.0)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                signal: controller.signal,
                cache: 'no-cache',
                mode: 'cors',
            });

            clearTimeout(timeout);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const html = await response.text();
            return this.extractContent(html, url);
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Request timeout (15s)');
            throw error;
        }
    }

    extractContent(html, url) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const baseUrl = new URL(url).origin;

        // Extract metadata
        const title = this.getMeta(doc, ['og:title', 'twitter:title'], doc.title || 'No title');
        const description = this.getMeta(doc, ['og:description', 'twitter:description', 'description']) || '';
        const image = this.getMeta(doc, ['og:image', 'twitter:image']) || '';

        // Extract full readable content
        let content = this.getReadableContent(doc);
        
        // Fix relative URLs
        content = content.replace(/src=["']\/([^\/])/g, `src="${baseUrl}/$1`);
        content = content.replace(/href=["']\/([^\/])/g, `href="${baseUrl}/$1`);
        content = content.replace(/url\$["']\/([^\/])/g, `url("${baseUrl}/$1`);

        return {
            title,
            description: description.slice(0, 160) + '...',
            image,
            site: new URL(url).hostname,
            url,
            content,
            rawHtml: html.slice(0, 50000) // Limit for preview
        };
    }

    getMeta(doc, properties, fallback = '') {
        for (const prop of properties) {
            const meta = doc.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
            if (meta?.content) return meta.content;
        }
        return fallback;
    }

    getReadableContent(doc) {
        // Try article, main, or content containers first
        const selectors = [
            'article',
            'main',
            '[role="main"]',
            '.content',
            '.post-content',
            '.article-body',
            '.entry-content'
        ];

        let container = null;
        for (const selector of selectors) {
            container = doc.querySelector(selector);
            if (container) break;
        }

        if (!container) container = doc.body;

        // Clean up and extract text + media
        const walker = doc.createTreeWalker(
            container,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER', 'ASIDE'].includes(node.tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let content = '';
        let node;
        while (node = walker.nextNode()) {
            if (node.tagName === 'IMG' && node.src) {
                content += `<img src="${node.src}" alt="${node.alt || ''}" style="max-width:100%;height:auto;">`;
            } else if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE'].includes(node.tagName)) {
                content += node.outerHTML;
            }
        }

        return content || '<p>No readable content found.</p>';
    }

    displayPreview(data) {
        this.previewCard.innerHTML = `
            ${data.image ? `<img src="${data.image}" alt="Preview" class="preview-img" onerror="this.style.display='none'">` : ''}
            <h2>${data.title}</h2>
            <p>${data.description}</p>
            <div class="actions">
                <button id="read-full" class="read-btn">Read Full Article →</button>
            </div>
            <span class="site-label">${data.site}</span>
        `;
        
        document.getElementById('read-full')?.addEventListener('click', () => this.showReader(data));
        this.previewCard.classList.remove('hidden');
        this.reader.classList.add('hidden');
    }

    showReader(data) {
        this.readerTitle.textContent = data.title;
        this.readerSite.textContent = data.site;
        this.readerContent.innerHTML = data.content;
        this.reader.classList.remove('hidden');
        this.previewCard.classList.add('hidden');
    }

    showPreview(content = '') {
        this.reader.classList.add('hidden');
        this.previewCard.classList.remove('hidden');
        this.previewCard.innerHTML = `<div class="loading">${content}</div>`;
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        this.status.classList.remove('hidden');
        setTimeout(() => this.status.classList.add('hidden'), 3000);
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('curlcard-dark', this.darkMode);
        this.updateTheme();
    }

    updateTheme() {
        document.body.classList.toggle('dark', this.darkMode);
        this.toggleDark.textContent = this.darkMode ? '☀️' : '🌗';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => new CurlCard());