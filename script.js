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
        if (this.curlBtn) this.curlBtn.addEventListener('click', () => this.curl());
        if (this.urlInput) this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.curl();
        });
        if (this.toggleDark) this.toggleDark.addEventListener('click', () => this.toggleDarkMode());
        if (this.backBtn) this.backBtn.addEventListener('click', () => this.showPreview());
    }

    updateTheme() {
        document.body.classList.toggle('dark', this.darkMode);
        if (this.toggleDark) {
            this.toggleDark.textContent = this.darkMode ? '☀️' : '🌗';
        }
    }

    async curl() {
        const url = this.urlInput.value.trim();
        if (!this.isValidUrl(url)) {
            this.showStatus('Enter a valid URL (http:// or https://)', 'error');
            return;
        }

        this.setLoading(true);
        this.showPreview('🔍 Fetching page...');
        this.hideStatus();

        try {
            const data = await this.corsProofFetch(url);
            this.displayPreview(data);
            this.currentData = data;
        } catch (error) {
            console.error('Curl failed:', error);
            this.showPreview(`❌ Failed: ${error.message}`);
            this.showStatus(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    isValidUrl(string) {
        try {
            const testUrl = string.startsWith('http') ? string : `https://${string}`;
            new URL(testUrl);
            return true;
        } catch {
            return false;
        }
    }

    async corsProofFetch(url) {
        console.log('🧪 Trying CORS strategies for:', url);

        // STRATEGY 1: Direct fetch
        try {
            console.log('📡 Strategy 1: Direct');
            return await this.fetchDirect(url);
        } catch (e1) {
            console.log('❌ Direct failed:', e1.message);
        }

        // STRATEGY 2: AllOrigins (MOST RELIABLE)
        try {
            console.log('🔄 Strategy 2: AllOrigins');
            return await this.fetchAllOrigins(url);
        } catch (e2) {
            console.log('❌ AllOrigins failed:', e2.message);
        }

        // STRATEGY 3: CORSProxy
        try {
            console.log('🔄 Strategy 3: CORSProxy');
            return await this.fetchCorsProxy(url);
        } catch (e3) {
            console.log('❌ CORSProxy failed:', e3.message);
        }

        throw new Error('All fetch methods failed. Try a different URL.');
    }

    async fetchDirect(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-cache',
                mode: 'cors',
                referrerPolicy: 'no-referrer-when-downgrade'
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            return this.extractContent(html, url, 'direct');
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Timeout (10s)');
            throw error;
        }
    }

    async fetchAllOrigins(url) {
        // FIXED: Use /get endpoint for JSON response
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
            cache: 'no-cache',
            mode: 'cors'
        });

        if (!response.ok) throw new Error('AllOrigins unavailable');

        const data = await response.json();
        if (!data.contents) throw new Error('No content from proxy');

        return this.extractContent(data.contents, url, 'allorigins');
    }

    async fetchCorsProxy(url) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
            cache: 'no-cache',
            mode: 'cors'
        });

        if (!response.ok) throw new Error('CORSProxy unavailable');

        const html = await response.text();
        return this.extractContent(html, url, 'corsproxy');
    }

    extractContent(html, originalUrl, strategy) {
        console.log(`✅ Extracting with strategy: ${strategy}`);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const baseUrl = new URL(originalUrl).origin;

        // BETTER TITLE
        let title = (doc.querySelector('title')?.textContent || 
                    doc.querySelector('h1')?.textContent || 
                    'No Title Found').trim().slice(0, 120);

        // BETTER DESCRIPTION  
        let description = Array.from(doc.querySelectorAll('meta[property="og:description"], meta[name="description"]'))
            .map(meta => meta.getAttribute('content'))
            .find(Boolean)?.trim().slice(0, 200) || '';

        // ULTRA CLEAN CONTENT EXTRACTION
        const content = this.extractCleanArticle(doc, baseUrl);

        return {
            title,
            description: description || `${title.substring(0, 100)}...`,
            site: new URL(originalUrl).hostname.replace(/^www\./, ''),
            url: originalUrl,
            content,
            strategy,
            wordCount: content.split(/\s+/).filter(Boolean).length
        };
    }

    extractCleanArticle(doc, baseUrl) {
        // Find best container
        const containers = [
            'article', 'main', '[role="main"]',
            '.post-content', '.entry-content', '.article-body', 
            '.content', '.post', '.story', '.prose'
        ];

        let container = null;
        for (const selector of containers) {
            container = doc.querySelector(selector);
            if (container && container.textContent.trim().length > 300) {
                break;
            }
        }

        if (!container) container = doc.body;

        // MASSIVE CLEANUP
        const junkSelectors = [
            'script', 'style', 'noscript', 'nav', 'header', 'footer', 
            'aside', '.ads', '[class*="ad"]', '.sidebar', '.comments',
            '.related', '[class*="prev"]', '[class*="next"]'
        ];

        junkSelectors.forEach(selector => {
            container.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Extract readable content ONLY
        let content = '';
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: node => {
                    const tag = node.tagName;
                    if (['H1','H2','H3','H4','H5','H6','P','UL','OL','LI','BLOCKQUOTE','PRE','TABLE','IMG','FIGURE'].includes(tag)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.tagName === 'IMG') {
                const src = node.src || node.dataset.src;
                if (src) {
                    content += `<img src="${src}" alt="${node.alt || ''}" style="max-width:100%;height:auto;border-radius:12px;margin:2rem auto;display:block;box-shadow:0 10px 30px rgba(0,0,0,0.1);">\n\n`;
                }
            } else {
                // Clean HTML and add spacing
                let cleanHtml = node.outerHTML.replace(/<br[^>]*>/gi, '');
                content += cleanHtml + '\n\n';
            }
        }

        // Final cleanup
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        content = content.replace(/Previous Post|Next Post|Related Posts/gi, '');

        return content.trim() || '<p style="text-align:center;color:#666;font-style:italic;">No readable content found. Site may use heavy JavaScript.</p>';
    }

    displayPreview(data) {
        this.previewCard.innerHTML = `
            <div class="preview-meta">
                <h2 class="preview-title">${this.escapeHtml(data.title)}</h2>
                ${data.description ? `<p class="preview-desc">${this.escapeHtml(data.description)}</p>` : ''}
                <div class="preview-stats">
                    <span>📄 ${data.wordCount} words</span>
                    <span>🌐 ${data.site}</span>
                    <span style="color:#10b981">✅ ${data.strategy}</span>
                </div>
            </div>
            <div class="preview-actions">
                <button id="read-full" class="read-full-btn">📖 Read Full Article</button>
            </div>
        `;

        const readBtn = document.getElementById('read-full');
        if (readBtn) {
            readBtn.onclick = () => this.showReader(data);
        }
        
        this.previewSection.classList.remove('hidden');
    }

    showReader(data) {
        this.readerTitle.textContent = data.title;
        this.readerSite.textContent = data.site;
        this.readerUrl.href = data.url;
        this.readerUrl.textContent = `Open Original (${data.strategy})`;
        this.readerContent.innerHTML = data.content;
        
        this.readerSection.classList.remove('hidden');
        this.previewSection.classList.add('hidden');
        this.readerSection.scrollIntoView({ behavior: 'smooth' });
    }

    showPreview(content = '🔗 Ready to curl any page!') {
        this.readerSection.classList.add('hidden');
        this.previewSection.classList.remove('hidden');
        this.previewCard.innerHTML = `<div class="loading-state">${content}</div>`;
    }

    setLoading(loading) {
        if (this.curlBtn) {
            this.curlBtn.disabled = loading;
            if (this.btnSpinner) this.btnSpinner.classList.toggle('hidden', !loading);
            if (this.btnText) this.btnText.textContent = loading ? 'Loading...' : 'Curl It';
        }
    }

    showStatus(msg, type = 'info') {
        if (this.status) {
            this.status.textContent = msg;
            this.status.className = `status ${type} show`;
            setTimeout(() => this.status.classList.remove('show'), 5000);
        }
    }

    hideStatus() {
        if (this.status) this.status.classList.remove('show');
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('curlcard-dark', this.darkMode);
        this.updateTheme();
    }
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CorsProofCurlCard());
} else {
    new CorsProofCurlCard();
}