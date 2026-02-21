/**
 * News Manager for Machines Dealer
 * Handles loading historical news from JSON and rendering a premium timeline/grid.
 */

class NewsManager {
    constructor(newsPath) {
        this.newsPath = newsPath;
        this.newsItems = [];
        this.init();
    }

    async init() {
        try {
            const timestamp = Date.now();
            let data = [];
            try {
                const response = await fetch(this.newsPath + '?t=' + timestamp);
                if (response.ok) data = await response.json();
            } catch (e) {
                console.warn('[SYNC] News fetch failed, checking localStorage fallback.');
            }

            this.newsItems = window.SyncUtils ? window.SyncUtils.getOverride('news', data) : data;
            if (!this.newsItems) this.newsItems = [];

            // Sort by year and month descending (newest first)
            this.newsItems.sort((a, b) => {
                const yearDiff = parseInt(b.year) - parseInt(a.year);
                if (yearDiff !== 0) return yearDiff;

                const monthA = parseInt(a.month) || 0;
                const monthB = parseInt(b.month) || 0;
                return monthB - monthA;
            });

            this.renderNews();
        } catch (error) {
            console.error('Failed to load news:', error);
        }
    }

    renderNews() {
        const container = document.querySelector('.news-grid');
        if (!container) return;

        container.innerHTML = '';

        // Show top 6 news items for the home page
        const displayNews = this.newsItems.slice(0, 6);

        const fragment = document.createDocumentFragment();
        displayNews.forEach((item, index) => {
            const card = this.createNewsCard(item, index);
            fragment.appendChild(card);
        });

        container.appendChild(fragment);

        // Re-trigger visual entry animations
        if (window.refreshObserver) {
            setTimeout(() => window.refreshObserver(), 100);
        }
    }

    createNewsCard(item, index) {
        const card = document.createElement('div');
        card.className = 'glass news-card fade-up';
        card.style.transitionDelay = `${(index % 3) * 0.15}s`;

        const imageNames = item.picture ? item.picture.split(',') : [];
        const firstName = imageNames.length > 0 ? imageNames[0].trim() : null;

        let imagePath = 'images/placeholder-news.jpg';
        if (firstName) {
            if (firstName.startsWith('http') || firstName.startsWith('data:')) {
                imagePath = firstName;
            } else {
                // Heuristic: Uploaded files follow specific patterns
                const isUpload = firstName.startsWith('gemini_') || firstName.length > 30;
                if (isUpload) {
                    imagePath = `uploads/news/${firstName}`;
                } else {
                    imagePath = `images/news/${firstName}`;
                }
            }
        }

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIndex = parseInt(item.month) - 1;
        const displayMonth = (monthIndex >= 0 && monthIndex < 12) ? monthNames[monthIndex] : (item.month || '');
        const dateString = `${displayMonth} ${item.year}`.toUpperCase();

        card.innerHTML = `
            <div class="news-image-container" style="position: relative; overflow: hidden; height: 200px; border-radius: 12px; margin-bottom: var(--space-3);">
                <img src="${imagePath}" alt="News ${item.year}" 
                     style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease;"
                     onerror="
                        if (this.src.includes('images/news/')) { 
                            this.src = 'uploads/news/${firstName}'; 
                        } else if (this.src.includes('uploads/news/') && !this.src.includes('machinesdealer.com')) { 
                            this.src = 'https://www.machinesdealer.com/uploads/news/${firstName}'; 
                        } else { 
                            this.src = 'images/placeholder-news.jpg';
                            this.onerror = null; 
                        }
                     ">
                <div class="news-year-badge" style="position: absolute; top: 12px; left: 12px; background: var(--accent-primary); color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                    ${item.year}
                </div>
            </div>
            <div class="news-content" style="padding: 0 var(--space-1) var(--space-2); flex: 1; display: flex; flex-direction: column;">
                <span style="color: var(--accent-secondary); font-size: 0.75rem; font-weight: 700; letter-spacing: 1px;">${dateString}</span>
                <h3 style="font-size: 1.1rem; margin: var(--space-1) 0; line-height: 1.4; color: var(--text-primary);">${this.truncateText(item.news_detail, 60)}</h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.6; margin-bottom: var(--space-3);">${this.truncateText(item.news_detail, 120)}</p>
                <button class="btn btn-outline news-btn" style="margin-top: auto; width: fit-content; padding: 6px 12px; font-size: 0.75rem;">Read More</button>
            </div>
        `;

        return card;
    }

    truncateText(text, length) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length).trim() + '...';
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.newsManager = new NewsManager('data/news.json');
});
