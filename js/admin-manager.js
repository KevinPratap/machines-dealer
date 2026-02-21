/**
 * AdminManager - Core Logic for MDAdmin Panel
 * Handles inventory, news, blogs, videos, analytics, and settings.
 */
class AdminManager {
    constructor() {
        this.machines = [];
        this.news = [];
        this.blogs = [];
        this.videos = [];
        this.reviews = [];
        this.subscribers = [];
        this.siteSettings = {};
        this.quill = null;
        this.selectedMachines = new Set();
        this.selectedNews = new Set();
        this.selectedBlogs = new Set();
        this.selectedVideos = new Set();
        this.staff = [];
        this.showArchived = false;
        this.hasUnsavedChanges = false;

        this.version = "1.0.7-debug";
        console.log(`AdminManager v${this.version} Initialized`);
        this.init();
    }

    async init() {
        // Check Auth
        if (localStorage.getItem('md_admin_auth') === 'true') {
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.style.display = 'none';
            await this.loadAllData();
        }

        this.initQuill();
        this.setupEventListeners();
    }

    async loadAllData() {
        try {
            console.log('Loading all system data...');

            // Protocol check
            const isLocalFile = window.location.protocol === 'file:';
            if (isLocalFile) {
                console.warn('ADMIN WARNING: Site is running via file:// protocol. Fetch requests will likely fail due to CORS. Please use launch.bat to serve the site.');
            }

            const fetchWithError = async (url, fallback = []) => {
                try {
                    const response = await fetch(url + '?t=' + Date.now());
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return await response.json();
                } catch (e) {
                    console.error(`Failed to load ${url}:`, e);
                    return fallback;
                }
            };

            const [machines, news, blogs, videos, reviews, subscribers, settings, pages, staff] = await Promise.all([
                fetchWithError('data/inventory.json'),
                fetchWithError('data/news.json'),
                fetchWithError('data/blogs.json'),
                fetchWithError('data/videos.json'),
                fetchWithError('data/reviews.json'),
                fetchWithError('data/subscribers.json'),
                fetchWithError('data/settings.json', {}),
                fetchWithError('data/pages.json'),
                fetchWithError('data/our_staff.json')
            ]);

            this.machines = JSON.parse(localStorage.getItem('md_data_inventory')) || machines;
            this.news = JSON.parse(localStorage.getItem('md_data_news')) || news;
            this.blogs = JSON.parse(localStorage.getItem('md_data_blogs')) || blogs;
            this.videos = JSON.parse(localStorage.getItem('md_data_videos')) || videos;
            this.reviews = JSON.parse(localStorage.getItem('md_data_reviews')) || reviews;
            this.subscribers = JSON.parse(localStorage.getItem('md_data_subscribers')) || subscribers;
            this.siteSettings = JSON.parse(localStorage.getItem('md_data_settings')) || settings;
            this.pages = JSON.parse(localStorage.getItem('md_data_pages')) || pages;
            this.staff = JSON.parse(localStorage.getItem('md_data_staff')) || staff;

            if (isLocalFile && this.machines.length === 0) {
                this.showProtocolError();
            }

            this.renderAll();
            console.log('Data loaded successfully. (Using localStorage fallback if available)');
        } catch (e) {
            console.error('Fatal error loading admin data:', e);
        }
    }

    showProtocolError() {
        const containers = ['admin-inventory-list', 'admin-news-list', 'admin-blogs-list', 'admin-videos-list'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--accent-primary);">
                    <div style="font-size: 1.2rem; margin-bottom: 10px;">⚠️ Protocol Restriction Detected</div>
                    <div>To load data and save changes, please run the site through a local server using <strong>launch.bat</strong>.</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">(CORS policy blocks local file access in modern browsers)</div>
                </td></tr>`;
            }
        });
    }

    async persistData(key, data) {
        console.log(`[DEBUG] Persisting [${key}] data... Size: ${data.length} items`);
        try {
            // 1. Update localStorage for immediate session persistence
            localStorage.setItem(`md_data_${key}`, JSON.stringify(data));
        } catch (e) {
            console.error(`[DEBUG] LocalStorage save failed for ${key}:`, e);
            if (e.name === 'QuotaExceededError') {
                this.showToast('Warning: Local browser storage is full. Changes will not persist after refresh until some data is cleared or saved to server.', 'error');
            }
        }

        // 2. Map generic keys to dev-server endpoints
        const endpointMap = {
            'inventory': '/api/save-inventory',
            '/api/inventory': '/api/save-inventory',
            'news': '/api/save-news',
            '/api/news': '/api/save-news',
            'blogs': '/api/save-blogs',
            '/api/blogs': '/api/save-blogs',
            'videos': '/api/save-videos',
            '/api/videos': '/api/save-videos',
            'subscribers': '/api/save-subscribers',
            '/api/subscribers': '/api/save-subscribers',
            'settings': '/api/save-settings',
            '/api/settings': '/api/save-settings',
            'staff': '/api/save-staff',
            '/api/pages': '/api/save-staff'
        };

        const endpoint = endpointMap[key] || key;

        // 3. Try to save to server if running via http
        if (window.location.protocol.startsWith('http')) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Server save success:', result);
                    return true;
                }
            } catch (error) {
                console.error('Server save failed:', error);
            }
        }

        // Fallback or local warning
        console.log(`%c [ACTION REQUIRED] Data was updated in the browser. 
To permanently save this without a server, you must manually overwrite the JSON file in /data/`,
            "color: #3b82f6; font-weight: bold;");

        return true; // Return true to allow UI to update even if server save failed (local session is updated)
    }

    renderAll() {
        const currentView = this.getCurrentView();
        this.renderStats();
        this.switchView(currentView || 'inventory');
    }

    getCurrentView() {
        const activeNav = document.querySelector('.nav-item.active');
        return activeNav ? activeNav.id.replace('nav-', '') : 'inventory';
    }

    async switchView(viewId) {
        console.log('[VIEW] Switching to:', viewId);

        // Hide all views
        document.querySelectorAll('div[id^="view-"]').forEach(v => v.style.display = 'none');
        document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');

        // Show targets
        const target = document.getElementById(`view-${viewId}`) || document.getElementById(viewId);
        if (target) target.style.display = 'block';

        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.id === `nav-${viewId}`) item.classList.add('active');
        });

        // Title update
        const titles = {
            'inventory': 'Inventory Management',
            'news': 'News & Events',
            'blogs': 'Blog Articles',
            'videos': 'Video Gallery',
            'analytics': 'Dashboard Analytics',
            'site-settings': 'Global Site Settings',
            'about-staff': 'About US & Leadership',
            'google-reviews': 'Google Reviews Sync',
            'subscribers': 'Newsletter Subscribers'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = titles[viewId] || 'Dashboard';

        // Specific view renders
        if (viewId === 'inventory' || viewId === 'view-inventory') this.renderTable();
        if (viewId === 'news' || viewId === 'view-news') this.renderNewsTable();
        if (viewId === 'blogs' || viewId === 'view-blogs') this.renderBlogsTable();
        if (viewId === 'videos' || viewId === 'view-videos') this.renderVideosTable();
        if (viewId === 'staff' || viewId === 'view-staff') this.renderStaff();
        if (viewId === 'subscribers') this.renderSubscribers();
        if (viewId === 'reviews') this.renderReviews();
        if (viewId === 'analytics') this.renderAnalytics();
        if (viewId === 'site-settings') this.loadSiteSettings();
        if (viewId === 'about-staff') {
            this.loadAboutContent();
            this.renderStaffTable();
        }
    }

    // --- About Us Management ---
    loadAboutContent() {
        console.log('[DEBUG] loadAboutContent called');
        if (!this.pages) {
            console.warn('[DEBUG] loadAboutContent: this.pages is missing');
            return;
        }
        if (!this.quill) {
            console.warn('[DEBUG] loadAboutContent: this.quill is missing');
            return;
        }

        const aboutPage = this.pages.find(p => p.slug === 'about-us');
        if (aboutPage) {
            console.log('[DEBUG] loadAboutContent: Found about-us page, body length:', aboutPage.body ? aboutPage.body.length : 0);
            this.quill.root.innerHTML = aboutPage.body || '';
        } else {
            console.warn('[DEBUG] loadAboutContent: about-us page NOT FOUND in this.pages');
        }

        // Ensure disabled state on load
        this.quill.enable(false);
    }

    toggleAboutEdit() {
        if (!this.quill) return;

        const isCurrentlyEnabled = this.quill.isEnabled();
        const newState = !isCurrentlyEnabled; // true if we want to enable (edit mode)

        if (!isCurrentlyEnabled) {
            // Enter Edit Mode
            this.quill.enable(true);
            const btn = document.getElementById('edit-about-btn');
            if (btn) {
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Section Content`;
                btn.classList.remove('btn-outline');
            }
            this.quill.focus();
        } else {
            // Save Changes (Exit Edit Mode)
            this.saveAboutContent();
        }
    }

    async saveAboutContent() {
        console.log('[DEBUG] saveAboutContent called');
        if (!this.pages || !this.quill) return;

        const aboutPage = this.pages.find(p => p.slug === 'about-us');
        if (aboutPage) {
            aboutPage.body = this.quill.root.innerHTML;
            aboutPage.updated_at = new Date().toISOString().replace('T', ' ').split('.')[0];

            if (await this.persistData('pages', this.pages)) {
                this.showToast('About Us content updated successfully!', 'success');
                this.quill.enable(false);

                const btn = document.getElementById('edit-about-btn');
                if (btn) {
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg> Edit About Content`;
                    btn.classList.add('btn-outline');
                }
            }
        }
    }

    // --- Site Settings Management ---
    renderStats() {
        const total = this.machines.length;
        const available = this.machines.filter(m => m.status == "1" || m.status == "Available").length;
        const sold = total - available;

        if (document.getElementById('total-machines')) document.getElementById('total-machines').textContent = total;
        if (document.getElementById('available-machines')) document.getElementById('available-machines').textContent = available;
        if (document.getElementById('sold-machines')) document.getElementById('sold-machines').textContent = sold;
    }

    // --- Helper for Unique Placeholders ---
    getUniquePlaceholder(m) {
        const colors = [
            '#1e293b', '#0f172a', '#1e3a8a', '#2563eb',
            '#1d4ed8', '#1e40af', '#172554', '#1e3a8a'
        ];
        const idStr = String(m.id || '0');
        let hash = 0;
        for (let i = 0; i < idStr.length; i++) {
            hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        const color = colors[Math.abs(hash) % colors.length];
        const initials = ((m.manufacturer || 'M')[0] + (m.model || m.type || 'A')[0]).toUpperCase();

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="${color}"/>
            <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="white">${initials}</text>
        </svg>`;

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    // --- Inventory Management ---
    renderTable(filter = '') {
        console.log(`[DEBUG] renderTable called with filter: "${filter}"`);
        const tbody = document.getElementById('admin-inventory-list');
        if (!tbody) {
            console.error('[DEBUG] tbody "admin-inventory-list" NOT FOUND');
            return;
        }

        console.log(`[DEBUG] renderTable: showArchived=${this.showArchived}, machines=${this.machines.length}`);
        const filtered = this.machines.filter(m => {
            const isArchived = m.archived === true || m.archived === 'true' || m.status === 'archived';
            if (this.showArchived) return isArchived;
            return !isArchived;

            const searchStr = `${m.manufacturer} ${m.model || m.type || ''} ${m.year} ${m.location}`.toLowerCase();
            return searchStr.includes(filter.toLowerCase());
        });
        console.log(`[DEBUG] renderTable: filteredCount=${filtered.length}`);

        // Store current filtered IDs for "Select All" logic
        this.currentFilteredIds = filtered.map(m => m.id);

        tbody.innerHTML = filtered.map(m => {
            const isArchived = m.archived === true || m.archived === 'true' || m.status === 'archived';
            const placeholder = this.getUniquePlaceholder(m);
            // Try pictures array first, then multiple picture fields
            const photoFields = [
                ...(m.pictures || []),
                m.picture1, m.picture2, m.picture3, m.picture4, m.picture5,
                m.picture6, m.picture7, m.picture8, m.picture9, m.picture10
            ].filter(p => p && p !== 'img/placeholder.jpg' && typeof p === 'string' && p.trim() !== '');

            const photo = photoFields[0] || placeholder;
            let photoSrc = placeholder;

            if (photo && !photo.startsWith('data:')) {
                if (photo.startsWith('http')) {
                    photoSrc = photo;
                } else {
                    // Normalize: check both common paths
                    if (photo.includes('PHOTOGRAPH') || photo.includes('SORMZ') || photo.length > 20) {
                        photoSrc = `images/machines/${photo}`;
                    } else if (photo.includes('offset_MD') || photo.includes('pre_MD') || photo.includes('post_MD')) {
                        photoSrc = `uploads/machine/${photo}`;
                    } else {
                        photoSrc = `img/inventory/${photo}`; // Traditional path fallback
                    }
                }
            }

            const mfg = (m.manufacturer || '').trim();
            const mod = (m.model || m.type || '').trim();
            const machineName = (mfg || mod) ? `${mfg} ${mod}`.trim() : 'Unnamed Machine';

            const categoryTag = m.category_name || (m.type === m.model ? 'Offset Machine' : m.type) || 'Offset';
            const isAvailable = this.isMachineAvailable(m);

            return `
                <tr id="row-${m.id}" class="${this.selectedMachines.has(m.id) ? 'selected-row' : ''}">
                    <td style="width: 40px; text-align: center;">
                        <input type="checkbox" ${this.selectedMachines.has(m.id) ? 'checked' : ''} 
                            onchange="window.adminManager.toggleSelection('${m.id}')">
                    </td>
                    <td>
                        <img src="${photoSrc}" style="width: 50px; height: 50px; border-radius: var(--radius-sm); border: 1px solid var(--glass-border); object-fit: cover; background: rgba(255,255,255,0.05);" onerror="this.src='${placeholder}'; this.style.opacity='0.8';">
                    </td>
                    <td>
                        <div>
                            <div style="font-weight: 600;">${machineName}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${m.id}</div>
                        </div>
                    </td>
                    <td>${categoryTag}</td>
                    <td>
                        <span class="badge ${isAvailable ? 'badge-available' : 'badge-sold'}">
                            ${isAvailable ? 'Available' : 'Sold'}
                        </span>
                    </td>
                    <td>${m.year_of_mfg || m.year || 'N/A'}</td>
                    <td class="actions-cell">
                        <div class="action-dots" onclick="window.adminManager.toggleActionMenu(event, '${m.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </div>
                        <div class="action-menu" id="menu-${m.id}">
                            <div class="action-item" onclick="window.adminManager.openMachineModal('${m.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg> Edit
                            </div>
                            <div class="action-item" onclick="window.adminManager.toggleArchiveMachine('${m.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg> ${isArchived ? 'Unarchive' : 'Archive'}
                            </div>
                            <div class="action-item danger" onclick="window.adminManager.deleteMachine('${m.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Delete
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.renderStats();
    }

    isMachineAvailable(m) {
        return m.status == "1" || String(m.status).toLowerCase() === 'available';
    }

    async deleteMachine(id) {
        console.log(`[DEBUG] deleteMachine called for ID: ${id}`);
        const confirmed = await this.showConfirm('Are you sure you want to delete this machine?');
        if (!confirmed) {
            console.log('[DEBUG] Machine deletion cancelled by user');
            return;
        }
        const initialCount = this.machines.length;
        this.machines = this.machines.filter(m => String(m.id).trim() !== String(id).trim());
        console.log(`[DEBUG] Filtering machines. Initial: ${initialCount}, Final: ${this.machines.length}`);

        if (await this.persistData('inventory', this.machines)) {
            console.log('[DEBUG] Deletion persisted. Re-rendering table...');
            this.renderTable();
            this.setApplyButtonVisibility(true);
        } else {
            console.error('[DEBUG] PersistData failed for machine deletion');
        }
    }

    async toggleArchiveMachine(id) {
        console.log(`[DEBUG] toggleArchiveMachine called for ID: ${id}`);
        const machine = this.machines.find(m => String(m.id).trim() === String(id).trim());
        if (!machine) {
            console.error('[DEBUG] Machine not found for archiving');
            return;
        }

        machine.archived = !machine.archived;
        const action = machine.archived ? 'archived' : 'unarchived';
        console.log(`[DEBUG] Machine ${id} ${action}`);

        if (await this.persistData('inventory', this.machines)) {
            this.renderTable();
            this.setApplyButtonVisibility(true);
        }
    }

    // --- News Management ---
    renderNewsTable() {
        console.log('[DEBUG] renderNewsTable called');
        const tbody = document.getElementById('admin-news-list');
        if (!tbody) {
            console.error('[DEBUG] tbody "admin-news-list" NOT FOUND');
            return;
        }

        const filtered = this.news.filter(item => {
            const isArchived = item.archived === true || item.archived === 'true';
            return this.showArchived ? isArchived : !isArchived;
        });
        console.log(`[DEBUG] renderNewsTable: showArchived=${this.showArchived}, filteredCount=${filtered.length}`);

        tbody.innerHTML = filtered.map(item => {
            const isArchived = item.archived === true || item.archived === 'true';
            const displayTitle = item.news_detail ? (item.news_detail.length > 80 ? item.news_detail.substring(0, 80) + '...' : item.news_detail) : 'No Content';
            const menuId = `news-${item.id}`;
            const assetLink = item.picture || item.video_url || '-';
            const isSelected = this.selectedNews.has(item.id.toString());

            return `
                <tr id="news-row-${item.id}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="width: 40px; text-align: center;">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                            onchange="window.adminManager.toggleNewsSelection('${item.id}')"
                            style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
                    </td>
                    <td><strong>${item.year || '-'}</strong></td>
                    <td>${item.month || '-'}</td>
                    <td style="max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayTitle}</td>
                    <td>
                        <span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-primary); font-size: 0.7rem;">${assetLink !== '-' ? 'Available' : 'None'}</span>
                    </td>
                <td class="actions-cell">
                    <div class="action-dots" onclick="window.adminManager.toggleActionMenu(event, '${menuId}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </div>
                    <div class="action-menu" id="menu-${menuId}">
                        <div class="action-item" onclick="window.adminManager.openNewsModal('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg> Edit
                        </div>
                        <div class="action-item" onclick="window.adminManager.toggleArchiveNews('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg> ${isArchived ? 'Unarchive' : 'Archive'}
                        </div>
                        <div class="action-item danger" onclick="window.adminManager.deleteNews('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Delete
                        </div>
                    </div>
                </td>
                </tr>
            `;
        }).join('');
        this.updateBulkButtonBar('news');
    }

    async deleteNews(id) {
        console.log(`[DEBUG] deleteNews called for ID: ${id}`);
        const confirmed = await this.showConfirm('Delete this news item?');
        if (!confirmed) return;
        const previousCount = this.news.length;
        this.news = this.news.filter(n => String(n.id).trim() !== String(id).trim());

        console.log(`[DEBUG] Deleting News ID: ${id}. Items before: ${previousCount}, after: ${this.news.length}`);

        if (await this.persistData('news', this.news)) {
            this.selectedNews.delete(id.toString());
            this.renderNewsTable();
            this.setApplyButtonVisibility(true);
        }
    }

    async toggleArchiveNews(id) {
        console.log(`[DEBUG] toggleArchiveNews called for ID: ${id}`);
        const newsItem = this.news.find(n => String(n.id).trim() === String(id).trim());
        if (!newsItem) {
            console.error('[DEBUG] News item not found for archiving');
            return;
        }

        newsItem.archived = !newsItem.archived;
        const action = newsItem.archived ? 'archived' : 'unarchived';
        console.log(`[DEBUG] News ${id} ${action}`);

        if (await this.persistData('news', this.news)) {
            this.renderNewsTable();
            this.setApplyButtonVisibility(true);
        }
    }

    openNewsModal(id = null) {
        const form = document.getElementById('news-form');
        if (!form) return;
        form.reset();
        document.getElementById('news-id').value = '';
        document.getElementById('news-modal-title').textContent = 'Create News Item';

        if (id) {
            const item = this.news.find(n => n.id.toString() === id.toString());
            if (item) {
                document.getElementById('news-id').value = item.id;
                document.getElementById('news-year').value = item.year || '';
                document.getElementById('news-month').value = item.month || '';
                document.getElementById('news-detail').value = item.news_detail || '';
                document.getElementById('news-picture').value = item.picture || '';
                document.getElementById('news-modal-title').textContent = 'Edit News Item';
            }
        }

        document.getElementById('news-modal').style.display = 'flex';
    }

    async saveNews(event) {
        event.preventDefault();
        const id = document.getElementById('news-id').value;
        const data = {
            id: id ? (isNaN(id) ? id : parseInt(id)) : Date.now(),
            year: document.getElementById('news-year').value,
            month: document.getElementById('news-month').value,
            news_detail: document.getElementById('news-detail').value,
            picture: document.getElementById('news-picture').value,
            video_url: null,
            created_at: id ? this.news.find(n => n.id.toString() === id.toString())?.created_at : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (id) {
            this.news = this.news.map(n => n.id.toString() === id.toString() ? data : n);
        } else {
            this.news.unshift(data);
        }

        if (await this.persistData('news', this.news)) {
            document.getElementById('news-modal').style.display = 'none';
            this.renderNewsTable();
            this.setApplyButtonVisibility(true);
        }
    }

    openBlogModal(id = null) {
        const modal = document.getElementById('blogs-modal');
        if (!modal) {
            console.error('[DEBUG] blogs-modal element not found');
            return;
        }
        const form = document.getElementById('blogs-form');
        if (!form) return;
        form.reset();
        document.getElementById('blog-id').value = '';
        document.getElementById('blogs-modal-title').textContent = 'Blog Publishing';

        if (this.blogEditor) {
            this.blogEditor.setContents([]);
        }

        if (id) {
            const item = this.blogs.find(b => b.id.toString() === id.toString());
            if (item) {
                document.getElementById('blog-id').value = item.id;
                document.getElementById('blog-title').value = item.title || '';
                document.getElementById('blog-slug').value = item.slug || '';
                document.getElementById('blog-image').value = item.image || '';
                document.getElementById('blog-heading').value = item.heading || '';
                document.getElementById('blog-status').value = item.status || '1';
                document.getElementById('blog-meta-title').value = item.meta_title || '';
                document.getElementById('blog-meta-desc').value = item.meta_desc || '';

                if (this.blogEditor) {
                    this.blogEditor.root.innerHTML = item.body || '';
                } else {
                    document.getElementById('blog-body').value = item.body || '';
                }
                document.getElementById('blogs-modal-title').textContent = 'Edit Blog Post';
            }
        }

        modal.style.display = 'flex';
    }

    async saveBlog(event) {
        event.preventDefault();
        const id = document.getElementById('blog-id').value;
        const bodyContent = this.blogEditor ? this.blogEditor.root.innerHTML : document.getElementById('blog-body').value;

        const data = {
            id: id ? (isNaN(id) ? id : parseInt(id)) : Date.now(),
            title: document.getElementById('blog-title').value,
            slug: document.getElementById('blog-slug').value,
            image: document.getElementById('blog-image').value,
            heading: document.getElementById('blog-heading').value,
            status: document.getElementById('blog-status').value,
            meta_title: document.getElementById('blog-meta-title').value,
            meta_desc: document.getElementById('blog-meta-desc').value,
            body: bodyContent,
            created_at: id ? this.blogs.find(b => b.id.toString() === id.toString())?.created_at : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (id) {
            this.blogs = this.blogs.map(b => b.id.toString() === id.toString() ? data : b);
        } else {
            this.blogs.unshift(data);
        }

        if (await this.persistData('blogs', this.blogs)) {
            document.getElementById('blogs-modal').style.display = 'none';
            this.renderBlogsTable();
            this.setApplyButtonVisibility(true);
        }
    }

    openVideoModal(id = null) {
        const modal = document.getElementById('videos-modal');
        if (!modal) {
            console.error('[DEBUG] videos-modal element not found');
            return;
        }
        const form = document.getElementById('videos-form');
        if (!form) return;
        form.reset();
        document.getElementById('video-id').value = '';
        document.getElementById('videos-modal-title').textContent = 'Video Link Management';

        if (id) {
            const item = this.videos.find(v => v.id.toString() === id.toString());
            if (item) {
                document.getElementById('video-id').value = item.id;
                document.getElementById('video-title').value = item.title || '';
                document.getElementById('video-link').value = item.link || '';
                document.getElementById('video-status').value = item.status || '1';
                document.getElementById('videos-modal-title').textContent = 'Edit Video';
            }
        }

        modal.style.display = 'flex';
    }

    async saveVideo(event) {
        event.preventDefault();
        const id = document.getElementById('video-id').value;
        const data = {
            id: id ? (isNaN(id) ? id : parseInt(id)) : Date.now(),
            title: document.getElementById('video-title').value,
            link: document.getElementById('video-link').value,
            status: document.getElementById('video-status').value,
            created_at: id ? this.videos.find(v => v.id.toString() === id.toString())?.created_at : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (id) {
            this.videos = this.videos.map(v => v.id.toString() === id.toString() ? data : v);
        } else {
            this.videos.unshift(data);
        }

        if (await this.persistData('videos', this.videos)) {
            document.getElementById('videos-modal').style.display = 'none';
            this.renderVideosTable();
            this.setApplyButtonVisibility(true);
        }
    }


    // --- Blogs Management ---
    renderBlogsTable() {
        console.log('[DEBUG] renderBlogsTable called');
        const tbody = document.getElementById('admin-blogs-list');
        if (!tbody) {
            console.error('[DEBUG] tbody "admin-blogs-list" NOT FOUND');
            return;
        }

        const filtered = this.blogs.filter(item => {
            const isArchived = item.archived === true || item.archived === 'true';
            return this.showArchived ? isArchived : !isArchived;
        });
        console.log(`[DEBUG] renderBlogsTable: showArchived=${this.showArchived}, filteredCount=${filtered.length}`);

        tbody.innerHTML = filtered.map(item => {
            const isArchived = item.archived === true || item.archived === 'true';
            const menuId = `blog-${item.id}`;
            const statusLabel = item.status === 1 ? 'Published' : 'Draft';
            const statusClass = item.status === 1 ? 'background: rgba(16, 185, 129, 0.1); color: #10b981;' : 'background: rgba(148, 163, 184, 0.1); color: var(--text-muted);';
            const isSelected = this.selectedBlogs.has(item.id.toString());

            return `
                <tr id="blog-row-${item.id}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="width: 40px; text-align: center;">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                            onchange="window.adminManager.toggleBlogSelection('${item.id}')"
                            style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
                    </td>
                    <td><strong>${item.title}</strong></td>
                    <td>${item.slug}</td>
                    <td>
                        <span class="badge" style="${statusClass}">${statusLabel}</span>
                    </td>
                <td class="actions-cell">
                    <div class="action-dots" onclick="window.adminManager.toggleActionMenu(event, '${menuId}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </div>
                    <div class="action-menu" id="menu-${menuId}">
                        <div class="action-item" onclick="window.adminManager.openBlogModal('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg> Edit
                        </div>
                        <div class="action-item" onclick="window.adminManager.toggleArchiveBlog('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg> ${isArchived ? 'Unarchive' : 'Archive'}
                        </div>
                        <div class="action-item danger" onclick="window.adminManager.deleteBlog('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Delete
                        </div>
                    </div>
                </td>
                </tr>
            `;
        }).join('');
        this.updateBulkButtonBar('blogs');
    }

    async deleteBlog(id) {
        console.log(`[DEBUG] deleteBlog called for ID: ${id}`);
        const confirmed = await this.showConfirm('Delete this blog post?');
        if (!confirmed) return;
        this.blogs = this.blogs.filter(b => String(b.id).trim() !== String(id).trim());
        if (await this.persistData('blogs', this.blogs)) {
            console.log('[DEBUG] Blog deletion persisted. Re-rendering...');
            this.selectedBlogs.delete(id.toString());
            this.renderBlogsTable();
            this.setApplyButtonVisibility(true);
        }
    }

    async toggleArchiveBlog(id) {
        console.log(`[DEBUG] toggleArchiveBlog called for ID: ${id}`);
        const blog = this.blogs.find(b => String(b.id).trim() === String(id).trim());
        if (!blog) {
            console.error('[DEBUG] Blog not found for archiving');
            return;
        }

        blog.archived = !blog.archived;
        const action = blog.archived ? 'archived' : 'unarchived';
        console.log(`[DEBUG] Blog ${id} ${action}`);

        if (await this.persistData('blogs', this.blogs)) {
            this.renderBlogsTable();
            this.setApplyButtonVisibility(true);
        }
    }

    // --- Videos Management ---
    renderVideosTable() {
        const tbody = document.getElementById('admin-videos-list');
        if (!tbody) return;

        const filtered = this.videos.filter(item => {
            const isArchived = item.archived === true || item.archived === 'true';
            return this.showArchived ? isArchived : !isArchived;
        });
        console.log(`[DEBUG] renderVideosTable: showArchived=${this.showArchived}, filteredCount=${filtered.length}`);

        tbody.innerHTML = filtered.map(item => {
            const isArchived = item.archived === true || item.archived === 'true';
            const menuId = `video-${item.id}`;
            const displayTitle = item.title || 'Untitled Video';
            const isSelected = this.selectedVideos.has(item.id.toString());

            return `
                <tr id="video-row-${item.id}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="width: 40px; text-align: center;">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                            onchange="window.adminManager.toggleVideoSelection('${item.id}')"
                            style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
                    </td>
                    <td><strong>${displayTitle}</strong></td>
                    <td>${item.link ? 'YouTube URL' : '-'}</td>
                    <td>
                        <span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-primary);">Active</span>
                    </td>
                <td class="actions-cell">
                    <div class="action-dots" onclick="window.adminManager.toggleActionMenu(event, '${menuId}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </div>
                    <div class="action-menu" id="menu-${menuId}">
                        <div class="action-item" onclick="window.adminManager.openVideoModal('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg> Edit
                        </div>
                        <div class="action-item" onclick="window.adminManager.toggleArchiveVideo('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg> ${isArchived ? 'Unarchive' : 'Archive'}
                        </div>
                        <div class="action-item danger" onclick="window.adminManager.deleteVideo('${item.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Delete
                        </div>
                    </div>
                </td>
                </tr>
            `;
        }).join('');
        this.updateBulkButtonBar('videos');
    }

    async deleteVideo(id) {
        console.log(`[DEBUG] deleteVideo called for ID: ${id}`);
        const confirmed = await this.showConfirm('Delete this video?');
        if (!confirmed) return;
        this.videos = this.videos.filter(v => String(v.id).trim() !== String(id).trim());
        if (await this.persistData('videos', this.videos)) {
            console.log('[DEBUG] Video deletion persisted. Re-rendering...');
            this.selectedVideos.delete(id.toString());
            this.renderVideosTable();
            this.setApplyButtonVisibility(true);
        }
    }

    async toggleArchiveVideo(id) {
        console.log(`[DEBUG] toggleArchiveVideo called for ID: ${id}`);
        const video = this.videos.find(v => String(v.id).trim() === String(id).trim());
        if (!video) {
            console.error('[DEBUG] Video not found for archiving');
            return;
        }

        video.archived = !video.archived;
        const action = video.archived ? 'archived' : 'unarchived';
        console.log(`[DEBUG] Video ${id} ${action}`);

        if (await this.persistData('videos', this.videos)) {
            this.renderVideosTable();
            this.setApplyButtonVisibility(true);
        }
    }

    // --- Staff Management ---
    renderStaffTable() {
        console.log('[DEBUG] renderStaffTable called');
        const tbody = document.getElementById('admin-staff-list');
        if (!tbody) {
            console.error('[DEBUG] tbody "admin-staff-list" NOT FOUND');
            return;
        }

        tbody.innerHTML = this.staff.map(member => {
            const menuId = `staff-${member.id}`;
            const photo = member.image ? `uploads/our_staff/${member.image}` : 'img/placeholder.jpg';
            return `
                <tr>
                    <td><img src="${photo}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" onerror="this.src='img/placeholder.jpg'"></td>
                    <td><strong>${member.name}</strong></td>
                    <td>${member.title}</td>
                    <td>${member.location || member.phone || '-'}</td>
                    <td class="actions-cell">
                        <div class="action-dots" onclick="window.adminManager.toggleActionMenu(event, '${menuId}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </div>
                        <div class="action-menu" id="menu-${menuId}">
                            <div class="action-item" onclick="window.adminManager.openStaffModal('${member.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg> Edit
                            </div>
                            <div class="action-item danger" onclick="window.adminManager.deleteStaff('${member.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Remove
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async deleteStaff(id) {
        const confirmed = await this.showConfirm('Remove this staff member?');
        if (!confirmed) return;
        this.staff = this.staff.filter(s => String(s.id).trim() !== String(id).trim());
        if (await this.persistData('staff', this.staff)) {
            this.renderStaffTable();
            this.setApplyButtonVisibility(true);
        }
    }

    openStaffModal(memberId = null) {
        const modal = document.getElementById('staff-modal');
        const form = document.getElementById('staff-form');
        const title = document.getElementById('staff-modal-title');

        form.reset();
        document.getElementById('staff-id').value = memberId || '';
        document.getElementById('preview-staff-image').innerHTML = '';

        if (memberId) {
            const member = this.staff.find(s => String(s.id) === String(memberId));
            if (member) {
                title.textContent = 'Edit Executive';
                document.getElementById('staff-name').value = member.name || '';
                document.getElementById('staff-title').value = member.title || '';
                document.getElementById('staff-contact').value = member.contact || member.phone || '';
                document.getElementById('staff-location').value = member.location || '';
                document.getElementById('staff-image').value = member.image || '';
                if (member.image) {
                    document.getElementById('preview-staff-image').innerHTML = `<img src="uploads/our_staff/${member.image}" style="width: 100px; height: 100px; border-radius: 8px; object-fit: cover;">`;
                }
            }
        } else {
            title.textContent = 'Add New Executive';
        }

        modal.style.display = 'flex';
    }

    async saveStaff(event) {
        event.preventDefault();
        const id = document.getElementById('staff-id').value;
        const name = document.getElementById('staff-name').value;
        const title = document.getElementById('staff-title').value;
        const contact = document.getElementById('staff-contact').value;
        const location = document.getElementById('staff-location').value;
        const image = document.getElementById('staff-image').value;

        const staffData = {
            id: id || Date.now(),
            name,
            title,
            contact,
            location,
            image,
            updated_at: new Date().toISOString()
        };

        if (id) {
            const index = this.staff.findIndex(s => String(s.id) === String(id));
            if (index !== -1) this.staff[index] = { ...this.staff[index], ...staffData };
        } else {
            staffData.created_at = new Date().toISOString();
            this.staff.push(staffData);
        }

        if (await this.persistData('staff', this.staff)) {
            this.renderStaffTable();
            document.getElementById('staff-modal').style.display = 'none';
            this.showToast('Staff member saved successfully!', 'success');
            this.setApplyButtonVisibility(true);
        }
    }

    // --- Subscribers Management ---
    renderSubscribersTable() {
        const tbody = document.getElementById('admin-subscribers-list');
        if (!tbody) return;

        tbody.innerHTML = this.subscribers.map(sub => `
            <tr>
                <td><strong>${sub.email}</strong></td>
                <td>${sub.date || 'N/A'}</td>
                <td class="actions-cell">
                    <button class="btn-admin btn-outline" onclick="window.adminManager.deleteSubscriber('${sub.email}')" style="padding: 4px 10px; border-color: rgba(239, 68, 68, 0.2); color: var(--danger); font-size: 0.75rem;">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async deleteSubscriber(email) {
        const confirmed = await this.showConfirm('Delete this subscriber?');
        if (!confirmed) return;
        this.subscribers = this.subscribers.filter(s => String(s.email).trim() !== String(email).trim());
        if (await this.persistData('subscribers', this.subscribers)) {
            this.renderSubscribersTable();
            this.setApplyButtonVisibility(true);
        }
    }

    // --- Reviews Management ---
    renderReviewsTable() {
        const tbody = document.getElementById('admin-reviews-list');
        if (!tbody) return;

        tbody.innerHTML = this.reviews.map(rev => `
            <tr>
                <td><strong>${rev.author_name}</strong></td>
                <td>${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}</td>
                <td><div style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${rev.text}</div></td>
            </tr>
        `).join('');
    }

    async syncGoogleReviews() {
        const btn = document.getElementById('sync-reviews-btn');
        let oldHTML = '';
        if (btn) {
            oldHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Synchronizing...';
        }

        try {
            const response = await fetch('/api/sync-reviews');
            const result = await response.json();
            if (result.status === 'success') {
                this.showToast('Synchronization successful! ' + result.message, 'success');
                await this.loadAllData();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Sync error:', error);
            this.showToast('Sync failed: ' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = oldHTML;
            }
        }
    }

    // --- Analytics Management ---
    // Monochromatic Deep Sea Blue Palette (Latest Requirement)
    renderAnalytics() {
        if (!window.Chart) return;

        // 1. Clean up previous charts
        const charts = ['chart-main', 'chart-status', 'chart-category', 'chart-brands'];
        charts.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas && canvas.chartInstance) {
                canvas.chartInstance.destroy();
                delete canvas.chartInstance;
            }
        });

        // 2. 3-Color Monochromatic Palette
        const colors = {
            vibrant: '#3b82f6',  // Primary / Growth / Available
            deep: '#1d4ed8',     // Secondary / Sold / Density
            soft: '#60a5fa',     // Accents / Muted / Borders
            muted: '#94a3b8',    // Gray for text/axes
            border: 'rgba(255, 255, 255, 0.05)'
        };

        Chart.defaults.color = colors.muted;
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 17, 26, 0.95)';
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.titleFont = { size: 14, weight: 'bold' };

        // 3. Data Preparation
        const statusCounts = { Available: 0, Sold: 0 };
        this.machines.forEach(m => {
            const s = String(m.status).toLowerCase();
            if (s === '1' || s === 'available') statusCounts.Available++;
            else statusCounts.Sold++;
        });

        // 4. Render KPI Stats Cards
        const statsTbody = document.getElementById('analytics-stats');
        if (statsTbody) {
            statsTbody.innerHTML = `
                <div class="stat-card glass">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Active Inventory</div>
                    <div class="stat-number">${statusCounts.Available}</div>
                    <div style="font-size: 0.75rem; color: var(--accent-primary); margin-top: 4px;">Listed & Available</div>
                </div>
                <div class="stat-card glass">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Assets Density</div>
                    <div class="stat-number" style="color: var(--accent-muted);">${this.machines.length}</div>
                    <div style="font-size: 0.75rem; color: var(--accent-muted); margin-top: 4px;">Total Machines</div>
                </div>
            `;
        }

        // 5. Momentum Chart (Line)
        const canvasMain = document.getElementById('chart-main');
        if (canvasMain) {
            const ctxMain = canvasMain.getContext('2d');
            const gradient = ctxMain.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

            canvasMain.chartInstance = new Chart(ctxMain, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Inventory Scale',
                        data: [120, 190, 300, 250, 420, 553],
                        borderColor: colors.vibrant,
                        borderWidth: 2,
                        fill: true,
                        backgroundColor: gradient,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: colors.vibrant,
                        pointBorderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, border: { display: false } },
                        y: { grid: { color: colors.border }, border: { display: false } }
                    }
                }
            });
        }

        // 6. Asset Status (Donut Chart)
        const canvasStatus = document.getElementById('chart-status');
        if (canvasStatus) {
            const ctxStatus = canvasStatus.getContext('2d');
            canvasStatus.chartInstance = new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: ['Available', 'Sold'],
                    datasets: [{
                        data: [statusCounts.Available || 1, statusCounts.Sold || 0],
                        backgroundColor: [colors.vibrant, colors.deep],
                        borderWidth: 0,
                        weight: 0.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, color: colors.muted } }
                    }
                }
            });
        }
    }

    // --- Utility Methods ---
    downloadBackup(type = 'all') {
        let content = '';
        let filename = `md_backup_${type}_${new Date().toISOString().split('T')[0]}.json`;

        if (type === 'inventory') {
            content = JSON.stringify(this.machines, null, 2);
        } else {
            const fullData = {
                inventory: this.machines,
                news: this.news,
                blogs: this.blogs,
                videos: this.videos,
                exported_at: new Date().toISOString()
            };
            content = JSON.stringify(fullData, null, 2);
        }

        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateAccessCode() {
        const newCode = document.getElementById('new-access-code').value;
        if (!newCode || newCode.length < 4) {
            this.showToast('Access code must be at least 4 characters', 'error');
            return;
        }
        localStorage.setItem('md_admin_access_code', newCode);
        this.showToast('Access code updated. Use this for your next login.', 'success');
    }

    toggleActionMenu(event, id) {
        event.stopPropagation();
        document.querySelectorAll('.action-menu').forEach(m => {
            if (m.id !== `menu-${id}`) m.classList.remove('active');
        });
        const menu = document.getElementById(`menu-${id}`);
        if (menu) menu.classList.toggle('active');

        // Close when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.remove('active');
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // --- Selection and Bulk Actions ---
    toggleSelection(id) {
        if (this.selectedMachines.has(id)) {
            this.selectedMachines.delete(id);
            document.getElementById(`row-${id}`)?.classList.remove('selected-row');
        } else {
            this.selectedMachines.add(id);
            document.getElementById(`row-${id}`)?.classList.add('selected-row');
        }

        this.updateBulkActionBar();
    }

    toggleAllSelection(isChecked) {
        if (isChecked) {
            // Select only filtered items
            (this.currentFilteredIds || []).forEach(id => {
                this.selectedMachines.add(id);
                document.getElementById(`row-${id}`)?.classList.add('selected-row');
                const cb = document.querySelector(`#row-${id} input[type="checkbox"]`);
                if (cb) cb.checked = true;
            });
        } else {
            // Deselect all
            this.selectedMachines.clear();
            document.querySelectorAll('.selected-row').forEach(tr => tr.classList.remove('selected-row'));
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        this.updateBulkActionBar();
    }

    updateBulkActionBar() {
        const bar = document.getElementById('bulk-action-bar');
        const count = document.getElementById('selected-count');
        if (bar && count) {
            count.textContent = this.selectedMachines.size;
            bar.style.transform = this.selectedMachines.size > 0 ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100px)';
        }
    }

    clearSelection() {
        this.selectedMachines.clear();
        document.querySelectorAll('.selected-row').forEach(tr => tr.classList.remove('selected-row'));
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        const bar = document.getElementById('bulk-action-bar');
        if (bar) bar.style.transform = 'translateX(-50%) translateY(100px)';
    }

    toggleNewsSelection(id) {
        if (this.selectedNews.has(id.toString())) {
            this.selectedNews.delete(id.toString());
            document.getElementById(`news-row-${id}`)?.classList.remove('selected-row');
        } else {
            this.selectedNews.add(id.toString());
            document.getElementById(`news-row-${id}`)?.classList.add('selected-row');
        }
        this.updateBulkButtonBar('news');
    }

    toggleAllNewsSelection(checked) {
        if (checked) {
            this.news.forEach(n => this.selectedNews.add(n.id.toString()));
        } else {
            this.selectedNews.clear();
        }
        this.renderNewsTable();
        this.setApplyButtonVisibility(true);
    }

    toggleBlogSelection(id) {
        if (this.selectedBlogs.has(id.toString())) {
            this.selectedBlogs.delete(id.toString());
            document.getElementById(`blog-row-${id}`)?.classList.remove('selected-row');
        } else {
            this.selectedBlogs.add(id.toString());
            document.getElementById(`blog-row-${id}`)?.classList.add('selected-row');
        }
        this.updateBulkButtonBar('blogs');
    }

    toggleAllBlogSelection(checked) {
        if (checked) {
            this.blogs.forEach(b => this.selectedBlogs.add(b.id.toString()));
        } else {
            this.selectedBlogs.clear();
        }
        this.renderBlogsTable();
        this.setApplyButtonVisibility(true);
    }

    toggleVideoSelection(id) {
        if (this.selectedVideos.has(id.toString())) {
            this.selectedVideos.delete(id.toString());
            document.getElementById(`video-row-${id}`)?.classList.remove('selected-row');
        } else {
            this.selectedVideos.add(id.toString());
            document.getElementById(`video-row-${id}`)?.classList.add('selected-row');
        }
        this.updateBulkButtonBar('videos');
    }

    toggleAllVideoSelection(checked) {
        if (checked) {
            this.videos.forEach(v => this.selectedVideos.add(v.id.toString()));
        } else {
            this.selectedVideos.clear();
        }
        this.renderVideosTable();
        this.setApplyButtonVisibility(true);
    }

    updateBulkButtonBar(type) {
        const setMap = {
            'news': this.selectedNews,
            'blogs': this.selectedBlogs,
            'videos': this.selectedVideos,
            'machines': this.selectedMachines
        };
        const set = setMap[type];
        if (!set) return;

        const bar = document.getElementById(`${type}-bulk-actions`);
        const countDisplay = document.getElementById(`${type}-selected-count`);

        if (bar && countDisplay) {
            countDisplay.textContent = set.size;
            bar.style.display = set.size > 0 ? 'flex' : 'none';
        }

        // Update Select All checkbox state
        const selectAll = document.getElementById(`select-all-${type}`);
        if (selectAll) {
            const data = this[type];
            selectAll.checked = data.length > 0 && data.every(item => set.has(item.id.toString()));
            selectAll.indeterminate = set.size > 0 && set.size < data.length;
        }
    }

    async handleBulkNewsDelete() {
        if (this.selectedNews.size === 0) return;
        const confirmed = await this.showConfirm(`Are you sure you want to delete ${this.selectedNews.size} news items?`);
        if (!confirmed) return;

        const previousCount = this.news.length;
        const selectedArray = Array.from(this.selectedNews);
        this.news = this.news.filter(n => !this.selectedNews.has(n.id.toString()));

        console.log(`Bulk Delete. Selected: [${selectedArray.join(', ')}]. Items before: ${previousCount}, after: ${this.news.length}`);

        if (await this.persistData('news', this.news)) {
            this.selectedNews.clear();
            this.renderNewsTable();
            this.setApplyButtonVisibility(true);
        }
    }

    // --- News Bulk Edit ---
    openNewsBulkModal() {
        if (this.selectedNews.size === 0) return;
        document.getElementById('news-bulk-selection-count').textContent = `Updating ${this.selectedNews.size} Selected Items`;
        document.getElementById('news-bulk-year').value = '';
        document.getElementById('news-bulk-month').value = '';
        document.getElementById('news-bulk-modal').style.display = 'flex';
    }

    async applyNewsBulkChanges(event) {
        event.preventDefault();
        const year = document.getElementById('news-bulk-year').value;
        const month = document.getElementById('news-bulk-month').value;

        if (!year && !month) {
            this.showToast('Please specify at least one change.', 'error');
            return;
        }

        this.news = this.news.map(n => {
            if (this.selectedNews.has(n.id.toString())) {
                if (year) n.year = year;
                if (month) n.month = month;
                n.updated_at = new Date().toISOString();
            }
            return n;
        });

        if (await this.persistData('news', this.news)) {
            this.selectedNews.clear();
            document.getElementById('news-bulk-modal').style.display = 'none';
            this.renderNewsTable();
            this.setApplyButtonVisibility(true);
        }
    }

    async bulkDeleteMachines() {
        const count = this.selectedMachines.size;
        if (count === 0) return;

        const confirmed = await this.showConfirm(`Are you sure you want to delete ${count} selected machines? This action cannot be undone.`);
        if (!confirmed) return;

        this.machines = this.machines.filter(m => !this.selectedMachines.has(String(m.id)));

        if (await this.persistData('inventory', this.machines)) {
            this.clearSelection();
            this.renderTable();
            this.setApplyButtonVisibility(true);
            this.showToast(`Successfully deleted ${count} machines.`, 'success');
        }
    }

    openBulkModal() {
        if (this.selectedMachines.size === 0) return;
        document.getElementById('bulk-selection-count').textContent = `Updating ${this.selectedMachines.size} Selected Machines`;
        document.getElementById('bulk-modal').style.display = 'flex';
    }

    async applyBulkChanges(event) {
        event.preventDefault();
        const status = document.getElementById('bulk-status').value;
        const category = document.getElementById('bulk-category').value;
        const location = document.getElementById('bulk-location').value;
        const price = document.getElementById('bulk-price').value;

        this.machines = this.machines.map(m => {
            if (this.selectedMachines.has(m.id)) {
                if (status) m.status = status;
                if (category) m.category_name = category;
                if (location) m.location = location;
                if (price) m.price = price;
            }
            return m;
        });

        if (await this.persistData('inventory', this.machines)) {
            this.clearSelection();
            document.getElementById('bulk-modal').style.display = 'none';
            this.renderTable();
            this.setApplyButtonVisibility(true);
        }
    }

    // --- Modal Handlers ---
    openMachineModal(id = null) {
        const form = document.getElementById('machine-form');
        if (!form) return;
        form.reset();

        if (id) {
            const m = this.machines.find(x => String(x.id) === String(id));
            if (m) {
                document.getElementById('machine-id').value = m.id;
                document.getElementById('form-brand').value = m.manufacturer || '';
                document.getElementById('form-model').value = m.model || '';
                document.getElementById('form-year').value = m.year || '';
                document.getElementById('form-location').value = m.location || m.present_where || '';
                document.getElementById('form-price').value = m.price || '';
                document.getElementById('form-status').value = m.status || '1';
                document.getElementById('form-category').value = m.category_name || '';
                document.getElementById('form-color').value = m.color_name || '';

                const preview = document.getElementById('preview-image');
                if (preview) preview.src = m.images?.[0] || (m.picture1 ? 'img/inventory/' + m.picture1 : 'img/placeholder.jpg');

                document.getElementById('modal-title').textContent = 'Edit Machine Details';
            } else {
                console.error(`[DEBUG] Could not find machine with ID: ${id}`);
            }
        } else {
            document.getElementById('machine-id').value = '';
            document.getElementById('modal-title').textContent = 'Register New Machine';
        }

        document.getElementById('admin-modal').style.display = 'flex';
    }

    async saveMachine(event) {
        event.preventDefault();
        const id = document.getElementById('machine-id').value;
        const data = {
            id: id || Date.now().toString(),
            manufacturer: document.getElementById('form-brand').value,
            model: document.getElementById('form-model').value,
            year: document.getElementById('form-year').value,
            location: document.getElementById('form-location').value,
            price: document.getElementById('form-price').value,
            status: document.getElementById('form-status').value,
            category_name: document.getElementById('form-category').value,
            color_name: document.getElementById('form-color').value,
            serial_no: document.getElementById('form-serial').value,
            size: document.getElementById('form-size').value,
            youtube_video_id: document.getElementById('form-video').value,
            is_featured: document.getElementById('form-featured').checked ? 1 : 0,
            description: document.getElementById('form-description').value,
            picture1: document.getElementById('form-pictures').value.split(',')[0].trim(),
            images: document.getElementById('form-pictures').value.split(',').map(s => s.trim()).filter(s => s)
        };

        if (id) {
            this.machines = this.machines.map(m => String(m.id) === String(id) ? data : m);
        } else {
            this.machines.push(data);
        }

        if (await this.persistData('inventory', this.machines)) {
            document.getElementById('admin-modal').style.display = 'none';
            this.renderTable();
            this.setApplyButtonVisibility(true);
        }
    }

    // --- Image Handling System ---
    triggerUpload(folder, previewId) {
        const input = document.getElementById('global-file-input');
        input.onchange = (e) => this.handleFileSelect(e, folder, previewId);
        input.click();
    }

    async handleFileSelect(event, folder, previewId) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        try {
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.status === 'success') {
                const imgEl = document.getElementById(previewId);
                if (imgEl) imgEl.src = result.url;
            }
        } catch (error) {
            console.error('Upload failed:', error);
            this.showToast('Upload failed: ' + error.message, 'error');
        }
    }

    initQuill() {
        if (document.getElementById('set-about-body')) {
            this.quill = new Quill('#set-about-body', {
                theme: 'snow'
            });
        }
        if (document.getElementById('blog-editor')) {
            this.blogEditor = new Quill('#blog-editor', {
                theme: 'snow',
                placeholder: 'Write your masterpiece...'
            });
        }
    }

    setupEventListeners() {
        // Global Modal Closes
        window.onclick = (event) => {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        };
    }

    async deleteSelectedBlogs() {
        if (this.selectedBlogs.size === 0) return;
        const confirmed = await this.showConfirm(`Are you sure you want to delete ${this.selectedBlogs.size} blog posts?`);
        if (!confirmed) return;

        this.blogs = this.blogs.filter(b => !this.selectedBlogs.has(b.id.toString()));
        if (await this.persistData('blogs', this.blogs)) {
            this.selectedBlogs.clear();
            this.renderBlogsTable();
        }
    }

    async deleteSelectedVideos() {
        if (this.selectedVideos.size === 0) return;
        const confirmed = await this.showConfirm(`Are you sure you want to delete ${this.selectedVideos.size} videos?`);
        if (!confirmed) return;

        this.videos = this.videos.filter(v => !this.selectedVideos.has(v.id.toString()));
        if (await this.persistData('videos', this.videos)) {
            this.selectedVideos.clear();
            this.renderVideosTable();
        }
    }
    async applyAllChanges() {
        const btn = document.getElementById('apply-changes-btn');
        if (!btn) return;

        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-sm"></span> Applying...`;
        btn.disabled = true;

        console.log('[DEBUG] Starting global data application...');

        const modules = [
            { key: 'inventory', data: this.machines },
            { key: 'news', data: this.news },
            { key: 'blogs', data: this.blogs },
            { key: 'videos', data: this.videos },
            { key: 'subscribers', data: this.subscribers },
            { key: 'settings', data: this.siteSettings },
            { key: 'staff', data: this.staff || [] }
        ];

        let successCount = 0;
        let failCount = 0;

        for (const mod of modules) {
            try {
                const result = await this.persistData(mod.key, mod.data);
                if (result) successCount++;
                else failCount++;
            } catch (e) {
                console.error(`Failed to apply module ${mod.key}:`, e);
                failCount++;
            }
        }

        // Final Feedback
        if (failCount === 0) {
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"></path></svg> Applied Successfully`;
            btn.style.background = 'var(--success)';
            this.showToast('All changes applied successfully to the website.', 'success');

            // Hide button after success
            setTimeout(() => {
                this.setApplyButtonVisibility(false);
            }, 2500);
        } else {
            btn.innerHTML = `Partial Success (${successCount}/${modules.length})`;
            btn.style.background = 'var(--warning)';
            this.showToast(`Applied with ${failCount} errors. Check console.`, 'error');
        }

        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.background = 'var(--accent-primary)';
            btn.disabled = false;
        }, 3000);
    }

    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 12px;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const colors = {
            success: 'var(--accent-primary)',
            error: '#f43f5e',
            info: 'var(--accent-secondary)'
        };
        const color = colors[type] || colors.info;

        toast.className = 'glass';
        toast.style.cssText = `
            padding: 12px 20px;
            border-radius: 8px;
            border-left: 4px solid ${color};
            color: white;
            font-size: 0.9rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            animation: slideInRight 0.3s ease;
            backdrop-filter: blur(20px);
            background: rgba(15, 23, 42, 0.9);
            min-width: 280px;
            max-width: 400px;
        `;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    showConfirm(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;

            const modal = document.createElement('div');
            modal.className = 'glass';
            modal.style.cssText = `
                width: 400px;
                padding: 30px;
                border-radius: 16px;
                text-align: center;
                background: rgba(15, 23, 42, 0.95);
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            `;

            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <span style="font-size: 48px; color: var(--accent-primary);">⚠️</span>
                </div>
                <h3 style="margin-bottom: 15px; font-size: 1.25rem;">Confirm Action</h3>
                <p style="margin-bottom: 30px; color: rgba(255,255,255,0.7); line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="confirm-cancel" class="btn" style="background: rgba(255,255,255,0.1); flex: 1;">Cancel</button>
                    <button id="confirm-ok" class="btn btn-primary" style="flex: 1;">Confirm</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const cleanup = (value) => {
                modal.style.animation = 'zoomOut 0.2s ease forwards';
                overlay.style.animation = 'fadeOut 0.2s ease forwards';
                setTimeout(() => {
                    overlay.remove();
                    resolve(value);
                }, 200);
            };

            document.getElementById('confirm-ok').onclick = () => cleanup(true);
            document.getElementById('confirm-cancel').onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
        });
    }

    setApplyButtonVisibility(visible) {
        const btn = document.getElementById('apply-changes-btn');
        if (!btn) return;

        if (visible) {
            btn.classList.remove('apply-btn-hidden');
            btn.classList.add('apply-btn-visible');
            this.hasUnsavedChanges = true;
        } else {
            btn.classList.remove('apply-btn-visible');
            btn.classList.add('apply-btn-hidden');
            this.hasUnsavedChanges = false;
        }
    }

    toggleShowArchived() {
        this.showArchived = !this.showArchived;
        console.log(`[DEBUG] toggleShowArchived: new state=${this.showArchived}`);

        const currentView = this.getCurrentView();
        this.switchView(currentView);

        const btn = document.getElementById('archive-toggle-btn');
        if (btn) {
            btn.classList.toggle('active', this.showArchived);
            btn.innerHTML = this.showArchived ? 'Archive View (On)' : 'Archive View (Off)';
        }
    }

    renderAll() {
        const view = document.querySelector('.admin-section:not([style*="display: none"])') ||
            document.querySelector('div[id^="view-"]:not([style*="display: none"])');

        const viewId = view ? view.id : 'view-inventory';

        if (viewId === 'view-inventory') this.renderTable();
        else if (viewId === 'view-news') this.renderNewsTable();
        else if (viewId === 'view-blogs') this.renderBlogsTable();
        else if (viewId === 'view-videos') this.renderVideosTable();
    }

    // --- Site Settings Management ---
    loadSiteSettings() {
        console.log('[DEBUG] loadSiteSettings called');
        const s = this.siteSettings;
        if (!s) return;

        const val = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        // Brand Identity
        const combinedName = s.site_identity?.name || `${s.site_identity?.logo_text || ''} ${s.site_identity?.logo_accent || ''}`.trim();
        val('set-site-name', combinedName);
        val('set-meta-title', s.site_identity?.title);
        val('set-meta-desc', s.site_identity?.description);

        // Contact
        val('set-phone-1', s.contact?.phone_1);
        val('set-phone-2', s.contact?.phone_2);
        val('set-email', s.contact?.email);
        val('set-address', s.contact?.address);

        val('set-hero-main', s.hero?.headline_main);
        val('set-hero-accent', s.hero?.headline_accent);
        val('set-hero-sub', s.hero?.subheadline);

        // Social
        val('set-social-facebook', s.social?.facebook);
        val('set-social-instagram', s.social?.instagram);
        val('set-social-linkedin', s.social?.linkedin);
        val('set-social-youtube', s.social?.youtube);

        // Ensure disabled state on load
        this.setSettingsInputsDisabled(true);
    }

    toggleSettingsEdit() {
        const firstInput = document.getElementById('set-site-name');
        const isCurrentlyDisabled = firstInput ? firstInput.disabled : true;
        const newState = !isCurrentlyDisabled; // true if we want to enable (edit mode)

        if (isCurrentlyDisabled) {
            // Enter Edit Mode
            this.setSettingsInputsDisabled(false);
            const btn = document.getElementById('edit-settings-btn');
            if (btn) {
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Settings`;
                btn.classList.remove('btn-outline');
            }
            if (firstInput) firstInput.focus();
        } else {
            // Save Changes (Exit Edit Mode)
            this.saveSiteSettings();
        }
    }

    setSettingsInputsDisabled(disabled) {
        const inputs = document.querySelectorAll('#view-site-settings .form-input');
        inputs.forEach(input => input.disabled = disabled);
    }

    async saveSiteSettings() {
        console.log('[DEBUG] saveSiteSettings called');

        // Build the structure matching settings.json
        if (!this.siteSettings.site_identity) this.siteSettings.site_identity = {};
        if (!this.siteSettings.contact) this.siteSettings.contact = {};
        if (!this.siteSettings.hero) this.siteSettings.hero = {};

        const getVal = (id) => document.getElementById(id)?.value || '';

        // Brand Identity
        const siteName = getVal('set-site-name');
        this.siteSettings.site_identity.name = siteName;

        // Split name for logo_text and logo_accent
        const parts = siteName.split(' ');
        this.siteSettings.site_identity.logo_text = parts[0] || '';
        this.siteSettings.site_identity.logo_accent = parts.slice(1).join(' ') || '';

        this.siteSettings.site_identity.title = getVal('set-meta-title');
        this.siteSettings.site_identity.description = getVal('set-meta-desc');

        // Contact
        this.siteSettings.contact.phone_1 = getVal('set-phone-1');
        this.siteSettings.contact.phone_2 = getVal('set-phone-2');
        this.siteSettings.contact.email = getVal('set-email');
        this.siteSettings.contact.address = getVal('set-address');

        // Hero
        this.siteSettings.hero.headline_main = getVal('set-hero-main');
        this.siteSettings.hero.headline_accent = getVal('set-hero-accent');
        this.siteSettings.hero.subheadline = getVal('set-hero-sub');

        // Social
        if (!this.siteSettings.social) this.siteSettings.social = {};
        this.siteSettings.social.facebook = getVal('set-social-facebook');
        this.siteSettings.social.instagram = getVal('set-social-instagram');
        this.siteSettings.social.linkedin = getVal('set-social-linkedin');
        this.siteSettings.social.youtube = getVal('set-social-youtube');

        if (await this.persistData('settings', this.siteSettings)) {
            this.showToast('Global settings updated successfully!', 'success');
            this.setSettingsInputsDisabled(true);

            const btn = document.getElementById('edit-settings-btn');
            if (btn) {
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg> Edit Settings`;
                btn.classList.add('btn-outline');
            }
            this.setApplyButtonVisibility(false); // Reset unsaved changes bubble
        }
    }
}

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    window.adminManager = new AdminManager();
});
