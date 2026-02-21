/**
 * Inventory Manager for Machines Dealer
 * Handles high-performance loading and filtering of 553+ machine records.
 */

class InventoryManager {
    constructor(inventoryPath) {
        this.inventoryPath = inventoryPath;
        this.machines = [];
        this.filteredMachines = [];
        this.containerId = 'recently-added-grid';
        this.itemsPerPage = 12;
        this.currentPage = 1;
        this.init();
    }

    async init() {
        try {
            const timestamp = Date.now();
            let data = [];
            try {
                const response = await fetch(this.inventoryPath + '?t=' + timestamp);
                if (response.ok) data = await response.json();
            } catch (e) {
                console.warn('[SYNC] Inventory fetch failed, checking localStorage fallback.');
            }

            this.machines = window.SyncUtils ? window.SyncUtils.getOverride('inventory', data) : data;
            if (!this.machines) this.machines = [];

            // Initial sort by ID descending (newest first based on ID)
            this.machines.sort((a, b) => parseInt(b.id) - parseInt(a.id));

            this.filteredMachines = [...this.machines];
            this.renderCatalog();
            this.setupListeners();
        } catch (error) {
            console.error('Failed to load inventory:', error);
            const container = document.getElementById(this.containerId);
            if (container) {
                const isLocalFile = window.location.protocol === 'file:';
                const errorMsg = isLocalFile
                    ? `Unable to load inventory due to browser security (CORS) on local files. <br> 
                       <span style="font-size: 0.8em; margin-top: 8px; display: block;">Please run <strong>launch.bat</strong> to start the premium local server.</span>`
                    : `Error loading inventory. Please try refreshing.`;

                container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 20px; border: 1px dashed #ef4444; border-radius: 8px;">${errorMsg}</div>`;
            }
        }
    }

    setupListeners() {
        const searchInput = document.getElementById('machine-search');
        const categoryFilter = document.getElementById('category-filter');

        const handleFilter = () => {
            const query = searchInput?.value || '';
            const category = categoryFilter?.value || 'all';
            this.filterMachines(query, category);
        };

        if (searchInput) {
            searchInput.addEventListener('input', handleFilter);
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', handleFilter);
        }
    }

    filterMachines(query = '', category = 'all') {
        const lowerQuery = query.toLowerCase().trim();

        this.filteredMachines = this.machines.filter(m => {
            // Exclude archived items
            if (m.status === 'archived') return false;

            const displayName = `${m.manufacturer || ''} ${m.type || ''}`.toLowerCase();
            const year = String(m.year || '').toLowerCase();
            const id = String(m.id || '').toLowerCase();
            const categoryName = (m.category_name || '').toLowerCase();
            const colorName = (m.color_name || '').toLowerCase();

            const matchesQuery = !lowerQuery ||
                displayName.includes(lowerQuery) ||
                year.includes(lowerQuery) ||
                id.includes(lowerQuery);

            let matchesCategory = true;
            if (category !== 'all') {
                const lowerCat = category.toLowerCase();
                // Check color count filters (e.g. "4 COLOR")
                if (lowerCat.includes('color')) {
                    matchesCategory = colorName === lowerCat;
                } else {
                    // Check main categories
                    matchesCategory = categoryName.includes(lowerCat);
                }
            }

            return matchesQuery && matchesCategory;
        });

        this.currentPage = 1; // Reset to page 1 on filter
        this.renderCatalog();
    }

    renderCatalog() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = '';

        if (this.filteredMachines.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: var(--space-8);">
                    <p style="color: var(--text-secondary); font-size: 1.1rem;">No premium machines found matching your criteria.</p>
                </div>
            `;
            return;
        }

        const displayMachines = this.filteredMachines.slice(0, this.itemsPerPage);

        const fragment = document.createDocumentFragment();
        displayMachines.forEach((machine, index) => {
            const card = this.createMachineCard(machine, index);
            fragment.appendChild(card);
        });

        container.appendChild(fragment);

        if (window.refreshObserver) {
            setTimeout(() => window.refreshObserver(), 50);
        }
    }

    createMachineCard(machine, index) {
        const card = document.createElement('div');
        card.className = 'glass machine-card fade-up';
        card.style.transitionDelay = `${(index % 4) * 0.05}s`;

        const photoName = machine.pictures && machine.pictures.length > 0 ? machine.pictures[0] : null;
        let mainPhoto = 'images/placeholder-machine.jpg';

        if (photoName) {
            if (photoName.startsWith('http') || photoName.startsWith('data:')) {
                mainPhoto = photoName;
            } else {
                // Heuristic: Uploaded files follow specific patterns
                const isUpload = photoName.startsWith('gemini_') || photoName.length > 30;
                if (isUpload) {
                    mainPhoto = `uploads/machine/${photoName}`;
                } else {
                    mainPhoto = `images/machines/${photoName}`;
                }
            }
        }

        const displayName = `${machine.manufacturer || 'Brand'} ${machine.type || ''}`;
        const specs = `${machine.year_of_mfg || machine.year || 'N/A'} • ${machine.size || 'Std'}`;
        const colorBadge = machine.color_name || 'Machine';
        const isSold = (machine.status || '').toLowerCase() === 'sold';

        card.innerHTML = `
            <div class="machine-image-wrapper" style="width: 100%; height: 160px; border-radius: 6px; margin-bottom: var(--space-2); overflow: hidden; background: #1a1a1a; position: relative;">
                <img src="${mainPhoto}" alt="${displayName}" 
                     data-filename="${photoName}"
                     style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;"
                     loading="lazy"
                     onerror="window.inventoryManager.handleImageError(this)">
                ${isSold ? '<div class="sold-overlay" style="position: absolute; top: 8px; right: 8px; background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.65rem; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">SOLD</div>' : ''}
            </div>
            <div class="machine-info">
                <div class="machine-badge" style="display: inline-block; padding: 2px 8px; background: rgba(59, 130, 246, 0.1); color: var(--accent-primary); border-radius: 4px; font-size: 0.65rem; font-weight: 600; margin-bottom: var(--space-1); text-transform: uppercase; letter-spacing: 0.5px;">${colorBadge}</div>
                <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);" title="${displayName}">${displayName}</h3>
                <p class="machine-specs" style="color: var(--text-secondary); font-size: 0.8125rem; font-weight: 500;">${specs}</p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                <span style="color: var(--accent-primary); font-weight: 700; font-size: 0.75rem; opacity: 0.8;">#${machine.id}</span>
                <button onclick="window.inventoryManager.inquireMachine('${machine.id}', '${machine.manufacturer || ''}', '${machine.type || ''}')" 
                        class="btn btn-primary machine-btn" 
                        style="padding: 8px 16px; font-size: 0.75rem;">Contact for Details</button>
            </div>
        `;

        return card;
    }

    inquireMachine(id, manufacturer, type) {
        const contactSection = document.getElementById('contact-inquiry');
        const messageField = document.getElementById('contact-message');

        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth' });
        }

        if (messageField) {
            const brandInfo = manufacturer && type ? `${manufacturer} ${type}` : 'this machine';
            messageField.value = `I am interested in the ${brandInfo} (Ref: #${id}). Please provide more details.`;
            messageField.focus();

            messageField.style.borderColor = 'var(--accent-primary)';
            messageField.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.2)';
            setTimeout(() => {
                messageField.style.borderColor = '';
                messageField.style.boxShadow = '';
            }, 2000);
        }
    }

    handleImageError(img) {
        const photoName = img.getAttribute('data-filename');
        if (!photoName) {
            img.src = 'images/placeholder-machine.jpg';
            img.onerror = null;
            return;
        }

        const currentSrc = img.src;
        console.log('Image failed:', currentSrc);

        // Logic: if it's not already the remote URL, try to rotate between local folders, then go remote.
        if (currentSrc.includes('images/machines/')) {
            console.log('Fallback: Trying local uploads/machine/');
            img.src = `uploads/machine/${photoName}`;
        } else if (currentSrc.includes('uploads/machine/') && !currentSrc.includes('machinesdealer.com')) {
            // It failed in uploads/machine/ folder too.
            // If it hasn't tried images/machines/ yet, we could, but heuristic usually makes it start correctly.
            // Let's go to remote as the last resort before placeholder.
            console.log('Fallback: Trying remote uploads/machine/');
            img.src = `https://www.machinesdealer.com/uploads/machine/${photoName}`;
        } else {
            console.log('Final Fallback: Using placeholder');
            img.src = 'images/placeholder-machine.jpg';
            img.onerror = null;
        }
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InventoryManager('data/inventory.json');
});
