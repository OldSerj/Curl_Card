class UltimateCurlCard {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.darkMode = localStorage.getItem('curlcard-dark') === 'true';
        this.updateTheme();
        this.currentData = null;
    }

    initElements() {
        this.urlInput = document.getElementById('url-input');
        this.curlBtn = document.getElementById('curl-btn');
        this.btnText = document.querySelector('.btn-text');
        this.btnSpinner = document.querySelector('.btn-spinner');
        this.previewSection = document.getElementById('preview-section');
        this.readerSection = document.getElementById('reader-section');
        this.previewCard = document.getElementById('preview-card');
        this.status = document.getElementById('status');
        this.toggleDark = document.getElementById('toggle-dark');
        this.backBtn = document.getElementById('back-to-preview');
        this.readerTitle = document.getElementById('reader-title');
        this.readerSite = document.getElementById('reader-site');
        this.readerUrl = document.getElementById('reader-url');
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
            this.showStatus('Enter a valid URL', 'error');
            return;
        }

        this.setLoading(true);
        this.showPreview('🔍 Fetching page metadata...');
        this.hideStatus();

        try {
            let data;
            
            // Try client-side first
            try {
                data = await this.fetchPageClient(url);
            } catch (clientError) {
                console.log('Client fetch failed, trying online fallback:', clientError.message);
                data = await this.fetchPageOnline(url);
            }

            this.displayPreview(data);
            this.currentData = data;
        } catch (error) {
            this.showPreview(`❌ Failed to load: ${error.message}`);
            console.error('Ultimate curl failed:', error);
        } finally {
            this.setLoading(false);
        }
    }

    isValidUrl(string) {
        try {
            new URL(string.startsWith('http') ? string : `https://${string}`);
            return true;
        } catch {
            return false;
        }
    }

    async fetchPageClient(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-Dest': 'document',
                },
                signal: controller.signal,
                cache: 'no-cache',
                mode: 'cors',
                referrerPolicy: 'no-referrer-when-downgrade',
            });

            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();
            return this.extractUltimateContent(html, url);
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Timeout (12s)');
            throw error;
        }
    }

    async fetchPageOnline(url) {
        // Online fallback proxy (CORS anywhere or similar)
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Online proxy failed');
        
        const html = await response.text();
        return this.extractUltimateContent(html, url);
    }

    extractUltimateContent(html, url) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const baseUrl = new URL(url).origin;

        // Ultimate metadata extraction
        const title = this.getMeta(doc, [
            'og:title', 'twitter:title', 'title'
        ], doc.title?.trim() || 'Untitled');

        const description = this.getMeta(doc, [
            'og:description', 'twitter:description', 'description'
        ], '').slice(0, 200);

        const image = this.getMeta(doc, [
            'og:image', 'twitter:image:src', 'twitter:image'
        ], '');

        // ULTIMATE content extraction
        let content = this.getUltimateReadableContent(doc, baseUrl);
        
        // Fix ALL relative URLs
        content = this.fixRelativeUrls(content, baseUrl);

        return {
            title: title.replace(/\s+/g, ' ').trim(),
            description: description || 'No description available',
            image,
            site: new URL(url).hostname.replace('www.', ''),
            url,
            content,
            wordCount: content.split(/\s+/).length
        };
    }

    getMeta(doc, properties, fallback = '') {
        for (const prop of properties) {
            const meta = doc.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
            if (meta?.content?.trim()) return meta.content.trim();
        }
        return fallback;
    }

    getUltimateReadableContent(doc, baseUrl) {
        const readers = [
            'article',
            'main', '[role="main"]',
            '.content', '.post-content', '.article-body', '.entry-content',
            '.post', '.story', '.prose', '[data-testid="post"]',
            '.markdown-body', '.md-content'
        ];

        let container = null;
        for (const selector of readers) {
            container = doc.querySelector(selector);
            if (container && container.children.length > 1) break;
        }

        container = container || doc.body;

        // Remove junk
        ['script', 'style', 'nav', 'header', 'footer', 'aside', 'nav'].forEach(tag => {
            container.querySelectorAll(tag).forEach(el => el.remove());
        });

        // Extract clean content
        let content = '';
        const elements = container.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,ol,li,blockquote,figure,img,pre,table');
        
        elements.forEach(el => {
            if (el.tagName === 'IMG' && el.src) {
                content += `<img src="${el.src}" alt="${el.alt || ''}" loading="lazy" style="max-width:100%;height:auto;border-radius:8px;margin:1rem 0;">`;
            } else if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE'].includes(el.tagName)) {
                content += el.outerHTML;
            }
        });

        return content || '<p>🕵️ No readable content detected. Try a different URL!</p>';
    }

    fixRelativeUrls(content, baseUrl) {
        return content
            .replace(/src=(['"])\/([^\/])/g, `src=$1${baseUrl}/$2`)
            .replace(/href=(['"])\/([^\/])/g, `href=$1${baseUrl}/$2`)
            .replace(/url\$['"]\/([^\/])/g, `url('${baseUrl}/$1`)
            .replace(/url\$[""]\/([^\/])/g, `url("${baseUrl}/$1`);
    }

    displayPreview(data) {
        this.previewCard.innerHTML = `
            ${data.image ? `<img src="${data.image}" alt="${data.title}" class="preview-image" onerror="this.style.display='none'">` : ''}
            <div class="preview-meta">
                <h2 class="preview-title">${this.escapeHtml(data.title)}</h2>
                <p class="preview-desc">${this.escapeHtml(data.description)}</p>
                <div class="preview-stats">
                    <span>📖 ${data.wordCount} words</span>
                    <span>🌐 ${data.site}</span>
                </div>
            </div>
            <div class="preview-actions">
                <button id="read-full" class="read-full-btn">📖 Read Full Article</button>
            </div>
        `;

        document.getElementById('read-full').addEventListener('click', () => this.showReader(data));
        this.previewSection.classList.remove('hidden');
        this.readerSection.classList.add('hidden');
    }

    showReader(data) {
        this.readerTitle.textContent = data.title;
        this.readerSite.textContent = data.site;
        this.readerUrl.href = data.url;
        this.readerUrl.textContent = new URL(data.url).hostname;
        this.readerContent.innerHTML = data.content;
        
        this.readerSection.scrollIntoView({ behavior: 'smooth' });
        this.readerSection.classList.remove('hidden');
        this.previewSection.classList.add('hidden');
    }

    showPreview(content = 'Ready to curl...') {
        this.readerSection.classList.add('hidden');
        this.previewSection.classList.remove('hidden');
        this.previewCard.innerHTML = `<div class="loading-state">${content}</div>`;
    }

    setLoading(loading) {
        this.curlBtn.disabled = loading;
        this.btnSpinner.classList.toggle('hidden', !loading);
        this.btnText.textContent = loading ? 'Curling...' : 'Curl It';
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = `status ${type} show`;
        setTimeout(() => this.status.classList.remove('show'), 4000);
    }

    hideStatus() {
        this.status.classList.remove('show');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('curlcard-dark', this.darkMode);
        document.body.classList.toggle('dark', this.darkMode);
        this.toggleDark.textContent = this.darkMode ? '☀️' : '🌗';
    }
}

// 🔥 Initialize Ultimate CurlCard
document.addEventListener('DOMContentLoaded', () => {
    new UltimateCurlCard();
    
    // PWA-like welcome
    if (!localStorage.getItem('curlcard-welcome')) {
        setTimeout(() => {
            const welcome = document.createElement('div');
            welcome.className = 'welcome-toast';
            welcome.innerHTML = '🎉 Welcome to CurlCard! Enter any URL and hit Enter or click Curl It.';
            document.body.appendChild(welcome);
            setTimeout(() => welcome.remove(), 4000);
            localStorage.setItem('curlcard-welcome', 'true');
        }, 500);
    }
});