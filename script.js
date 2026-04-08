class CorsProofCurlCard {
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
        this.urlInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.curl());
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
        this.showPreview('🔍 Analyzing CORS strategy...');
        this.hideStatus();

        try {
            const data = await this.corsProofFetch(url);
            this.displayPreview(data);
            this.currentData = data;
        } catch (error) {
            this.showPreview(`❌ ${error.message}`);
            console.error('Curl failed:', error);
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

    async corsProofFetch(url) {
        // STRATEGY 1: Direct fetch (works ~60% of sites)
        try {
            return await this.fetchDirect(url);
        } catch (e1) {
            console.log('Direct failed:', e1.message);
        }

        // STRATEGY 2: CORS proxy #1 (allorigins.win - most reliable)
        try {
            return await this.fetchProxy1(url);
        } catch (e2) {
            console.log('Proxy1 failed:', e2.message);
        }

        // STRATEGY 3: CORS proxy #2 (corsproxy.io)
        try {
            return await this.fetchProxy2(url);
        } catch (e3) {
            console.log('Proxy2 failed:', e3.message);
        }

        // STRATEGY 4: Archive fallback
        try {
            return await this.fetchArchive(url);
        } catch (e4) {
            throw new Error('All strategies failed 😢 Try a different URL');
        }
    }

    async fetchDirect(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-cache',
            mode: 'cors',
            referrerPolicy: 'no-referrer'
        });

        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        return this.extractContent(html, url);
    }

    async fetchProxy1(url) {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Proxy unavailable');
        const html = await response.text();
        return this.extractContent(html, url);
    }

    async fetchProxy2(url) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Proxy unavailable');
        const html = await response.text();
        return this.extractContent(html, url);
    }

    async fetchArchive(url) {
        const cleanUrl = url.replace(/https?:\/\//, '').replace(/\/.*/, '');
        const archiveUrl = `https://web.archive.org/cdx/search/cdx?url=${cleanUrl}/*&limit=1&output=json`;
        const response = await fetch(archiveUrl);
        const data = await response.json();
        if (data.length > 1) {
            const archived = `https://web.archive.org${data[1].slice(1).join('/')}`;
            const archiveResponse = await fetch(archived);
            const html = await archiveResponse.text();
            return this.extractContent(html, archived);
        }
        throw new Error('No archive found');
    }

    extractContent(html, url) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const title = doc.title?.trim() || 
                     doc.querySelector('h1')?.textContent?.trim() || 
                     'Untitled Page';

        const description = Array.from(doc.querySelectorAll('meta[property="og:description"], meta[name="description"]'))
            .map(meta => meta.content)
            .find(Boolean) || '';

        const image = Array.from(doc.querySelectorAll('meta[property="og:image"], meta[property="twitter:image"]'))
            .map(meta => meta.content)
            .find(Boolean) || '';

        // Extract MAIN content
        const main = doc.querySelector('main, article, [role="main"], .content, .post, .article') || doc.body;
        
        // Clean content
        ['script', 'style', 'nav', 'header', 'footer'].forEach(tag => {
            main.querySelectorAll(tag).forEach(el => el.remove());
        });

        const content = main.innerHTML
            .replace(/<img([^>]+)>/g, (match) => {
                const src = match.match(/src=["']([^"']+)["']/)[1];
                return `<img src="${src}" style="max-width:100%;height:auto;border-radius:12px;margin:1rem 0;" loading="lazy">`;
            })
            .slice(0, 50000); // Limit size

        return {
            title: title.slice(0, 100),
            description: description.slice(0, 160),
            image,
            site: new URL(url).hostname.replace('www.', ''),
            url,
            content,
            strategy: 'success'
        };
    }

    displayPreview(data) {
        this.previewCard.innerHTML = `
            <div class="preview-meta">
                <h2 class="preview-title">${this.escapeHtml(data.title)}</h2>
                <p class="preview-desc">${this.escapeHtml(data.description)}</p>
                <div class="preview-stats">
                    <span>🌐 ${data.site}</span>
                </div>
            </div>
            <div class="preview-actions">
                <button id="read-full" class="read-full-btn">📖 Read Full Page</button>
            </div>
        `;

        document.getElementById('read-full').onclick = () => this.showReader(data);
        this.previewSection.classList.remove('hidden');
    }

    showReader(data) {
        this.readerTitle.textContent = data.title;
        this.readerSite.textContent = data.site;
        this.readerUrl.href = data.url;
        this.readerContent.innerHTML = data.content;
        this.readerSection.classList.remove('hidden');
        this.previewSection.classList.add('hidden');
        this.readerSection.scrollIntoView({ behavior: 'smooth' });
    }

    showPreview(content = 'Ready!') {
        this.readerSection.classList.add('hidden');
        this.previewSection.classList.remove('hidden');
        this.previewCard.innerHTML = `<div class="loading-state">${content}</div>`;
    }

    setLoading(loading) {
        this.curlBtn.disabled = loading;
        this.btnSpinner.classList.toggle('hidden', !loading);
        this.btnText.textContent = loading ? 'Loading...' : 'Curl It';
    }

    showStatus(msg, type = 'info') {
        this.status.textContent = msg;
        this.status.className = `status ${type} show`;
        setTimeout(() => this.status.classList.remove('show'), 5000);
    }

    hideStatus() {
        this.status.classList.remove('show');
    }

    escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('curlcard-dark', this.darkMode);
        document.body.classList.toggle('dark', this.darkMode);
        this.toggleDark.textContent = this.darkMode ? '☀️' : '🌗';
    }
}

document.addEventListener('DOMContentLoaded', () => new CorsProofCurlCard());