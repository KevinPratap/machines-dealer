/**
 * ContentManager.js
 * Handles dynamic page switching and rendering of secondary content types:
 * - Blogs
 * - Videos
 * - About Us (Page + Staff)
 */

const ContentManager = {
    viewContainer: null,
    homeView: null,
    dynamicView: null,
    dynamicContentRoot: null,

    // Data stores
    blogs: [],
    videos: [],
    staff: [],
    pages: [],
    reviews: null,
    settings: {},
    isLoaded: false,

    navigateToSection(pageSlug, sectionId) {
        // Switch to the page if not already there
        const targetLink = document.querySelector(`a[data-page="${pageSlug}"]`) || document.querySelector(`a[data-page="about"]`);
        if (targetLink) targetLink.click();

        // Wait for render then scroll
        setTimeout(() => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    },

    async init() {
        this.viewContainer = document.getElementById('view-container');
        this.homeView = document.getElementById('home-view');
        this.dynamicView = document.getElementById('dynamic-view');
        this.dynamicContentRoot = document.getElementById('dynamic-content-root');

        this.bindNavLinks();
        await this.loadInitialData();
        this.applyGlobalSettings();
        this.isLoaded = true;

        // Initialize Mobile Menu
        const mobileToggle = document.getElementById('mobile-toggle');
        const navLinks = document.querySelector('.nav-links');

        if (mobileToggle && navLinks) {
            const backdrop = document.getElementById('nav-backdrop');

            const toggleMenu = () => {
                const isActive = navLinks.classList.toggle('active');
                if (backdrop) backdrop.classList.toggle('active', isActive);
                document.body.classList.toggle('menu-open', isActive);
                document.body.style.overflow = isActive ? 'hidden' : '';
            };

            mobileToggle.addEventListener('click', toggleMenu);
            if (backdrop) backdrop.addEventListener('click', toggleMenu);

            // Close menu when a link is clicked
            navLinks.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    navLinks.classList.remove('active');
                    if (backdrop) backdrop.classList.remove('active');
                    document.body.style.overflow = '';
                });
            });
        }

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.switchToPage(e.state.page, false);
            } else if (window.location.hash) {
                const page = window.location.hash.replace('#', '');
                if (page !== 'machines') {
                    this.switchToPage(page, false);
                }
            } else {
                this.switchToPage('home', false);
            }
        });

        // Check initial hash
        if (window.location.hash) {
            const initialPage = window.location.hash.replace('#', '');
            if (['blogs', 'videos', 'about', 'company-structure'].includes(initialPage)) {
                this.switchToPage(initialPage, false);
            }
        }
    },

    bindNavLinks() {
        document.querySelectorAll('.nav-link-item').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = link.getAttribute('data-page');
                if (page) {
                    e.preventDefault();
                    this.switchToPage(page);
                }
            });
        });

        // Handle Dropdown Links
        document.querySelectorAll('.dropdown-content a').forEach(link => {
            link.addEventListener('click', (e) => {
                const category = link.getAttribute('data-category');
                if (category) {
                    e.preventDefault();
                    // Switch to home if not already there
                    this.switchToPage('home', false);

                    // Scroll to inventory
                    const grid = document.getElementById('recently-added-grid');
                    if (grid) grid.scrollIntoView({ behavior: 'smooth' });

                    // Trigger filter
                    const filterSelect = document.getElementById('category-filter');
                    if (filterSelect) {
                        filterSelect.value = category;
                        filterSelect.dispatchEvent(new Event('change'));
                    }
                }
            });
        });
    },

    async loadInitialData() {
        const t = Date.now();
        const load = async (key, path) => {
            let data = null;
            try {
                const res = await fetch(path + '?t=' + t);
                if (res.ok) data = await res.json();
            } catch (e) {
                console.warn(`[SYNC] Fetch failed for ${key}, checking localStorage fallback.`);
            }
            return window.SyncUtils ? window.SyncUtils.getOverride(key, data) : data;
        };

        try {
            this.blogs = await load('blogs', 'data/blogs.json') || [];
            this.videos = await load('videos', 'data/videos.json') || [];
            this.staff = await load('staff', 'data/our_staff.json') || [];
            this.pages = await load('pages', 'data/pages.json') || [];
            this.settings = await load('settings', 'data/settings.json') || {};
            this.reviews = await load('reviews', 'data/reviews.json') || { rating: 5, review_count: 0, reviews: [] };

            this.renderReviews();
        } catch (error) {
            console.error('Error loading content data:', error);
        }
    },

    renderReviews() {
        if (!this.reviews || !this.reviews.reviews) return;

        const summary = document.getElementById('google-rating-summary');
        if (summary) {
            summary.innerHTML = `
                <div style="display: flex; color: #f59e0b;">
                    ${Array(5).fill(0).map((_, i) => `<span style="opacity: ${i < Math.floor(this.reviews.rating) ? 1 : 0.3}">★</span>`).join('')}
                </div>
                <span style="font-weight: 700; font-size: 1.1rem;">${this.reviews.rating}/5</span>
                <span style="color: var(--text-secondary); font-size: 0.9rem;">(${this.reviews.review_count} Google Reviews)</span>
            `;
        }

        const grid = document.getElementById('reviews-grid');
        if (!grid) return;

        grid.innerHTML = '';
        this.reviews.reviews.forEach((review, index) => {
            const card = document.createElement('div');
            card.className = 'glass review-card fade-up';
            card.style.transitionDelay = `${index * 0.1}s`;

            const initial = review.author.charAt(0).toUpperCase();

            card.innerHTML = `
                <div class="review-author">
                    <div class="review-avatar">${initial}</div>
                    <span>${review.author}</span>
                </div>
                <div class="star-rating">
                    ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                </div>
                <p class="review-text" style="flex: 1;">${review.text}</p>
            `;
            grid.appendChild(card);
        });

        if (window.refreshObserver) window.refreshObserver();
    },

    applyGlobalSettings() {
        if (!this.settings) return;

        const s = this.settings;

        // Site Identity
        if (s.site_identity) {
            document.title = s.site_identity.title;
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.content = s.site_identity.description;

            const logoText = document.getElementById('site-logo-text');
            const logoAccent = document.getElementById('site-logo-accent');
            if (logoText) logoText.textContent = s.site_identity.logo_text;
            if (logoAccent) logoAccent.textContent = s.site_identity.logo_accent;
        }

        // Hero Section (Home View only)
        if (s.hero) {
            const headline = document.getElementById('hero-headline');
            const subheadline = document.getElementById('hero-subheadline');
            const btnPrimary = document.getElementById('hero-btn-primary');
            const btnSecondary = document.getElementById('hero-btn-secondary');

            if (headline) {
                headline.innerHTML = `${s.hero.headline_main} <span class="text-gradient">${s.hero.headline_accent}</span>`;
            }
            if (subheadline) subheadline.textContent = s.hero.subheadline;
            if (btnPrimary) {
                btnPrimary.textContent = s.hero.btn_primary_text;
                btnPrimary.href = s.hero.btn_primary_link;
            }
            if (btnSecondary) {
                btnSecondary.textContent = s.hero.btn_secondary_text;
                btnSecondary.href = s.hero.btn_secondary_link;
            }
        }

        // Stats Section
        if (s.stats && s.stats.length > 0) {
            const statsContainer = document.getElementById('about-stats-container');
            if (statsContainer) {
                // Keep the last item (brands logos)
                const brands = document.getElementById('marquee-specializing');
                statsContainer.innerHTML = '';
                s.stats.forEach(stat => {
                    const statDiv = document.createElement('div');
                    statDiv.className = 'glass';
                    statDiv.style.cssText = 'padding: var(--space-4); text-align: center; border-radius: 8px; display: flex; flex-direction: column; justify-content: center;';
                    statDiv.innerHTML = `
                        <span style="font-size: 2.25rem; font-weight: 700; color: ${stat.color}; line-height: 1;">${stat.value}</span>
                        <span style="color: var(--text-secondary); font-size: 0.8125rem;">${stat.label}</span>
                    `;
                    statsContainer.appendChild(statDiv);
                });
                if (brands) statsContainer.appendChild(brands);
            }
        }

        // Marquee Brands
        if (s.marquee_brands && s.marquee_brands.length > 0) {
            const track = document.getElementById('brand-track');
            if (track) {
                track.innerHTML = '';
                // Duplicate brands for seamless scrolling
                const brands = [...s.marquee_brands, ...s.marquee_brands];
                brands.forEach(brand => {
                    const span = document.createElement('span');
                    span.className = 'brand-item';
                    span.textContent = brand;
                    track.appendChild(span);
                });
            }
        }

        // Social Links in Footer
        if (s.social) {
            const updateSocial = (id, url) => {
                const el = document.getElementById(id);
                if (el) {
                    if (url && url !== '#') {
                        el.href = url;
                        el.style.display = 'flex';
                    } else {
                        el.style.display = 'none';
                    }
                }
            };
            updateSocial('social-facebook', s.social.facebook);
            updateSocial('social-instagram', s.social.instagram);
            updateSocial('social-linkedin', s.social.linkedin);
            updateSocial('social-youtube', s.social.youtube);
        }
    },

    switchToPage(page, pushState = true) {
        if (pushState) {
            history.pushState({ page }, '', `#${page}`);
        }

        // Update active class in nav
        document.querySelectorAll('.nav-link-item').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === page) link.classList.add('active');
        });

        if (page === 'home') {
            this.homeView.style.display = 'block';
            this.dynamicView.style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            this.homeView.style.display = 'none';
            this.dynamicView.style.display = 'block';
            this.renderPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    renderPage(page) {
        this.dynamicContentRoot.innerHTML = '<div style="text-align: center; padding: 50px;"><p>Loading content...</p></div>';

        switch (page) {
            case 'blogs':
                this.renderBlogs();
                break;
            case 'videos':
                this.renderVideos();
                break;
            case 'about':
                this.renderAbout();
                break;
            case 'company-structure':
                this.renderCompanyStructure();
                break;
            case 'contact':
                this.renderContact();
                break;
            default:
                this.dynamicContentRoot.innerHTML = `<h2>Page Not Found</h2><p>The requested page "${page}" does not exist.</p>`;
        }
    },

    renderBlogs() {
        let html = `
            <div class="fade-up mt-5">
                <h1 class="section-title">Industry <span class="text-gradient">Blogs</span></h1>
                <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--space-8);">Deep technical insights and machinery updates.</p>
                <div class="grid grid-cols-3" style="gap: var(--space-6);">
        `;

        this.blogs.forEach(blog => {
            html += `
                <article class="glass blog-card fade-up" style="border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">
                    <img src="uploads/blog/${blog.image}" alt="${blog.title}" style="width: 100%; height: 200px; object-fit: cover; opacity: 0.8;">
                    <div style="padding: var(--space-4); flex-grow: 1; display: flex; flex-direction: column;">
                        <h3 style="font-size: 1.1rem; margin-bottom: 10px; color: var(--text-primary); line-height: 1.4;">${blog.title}</h3>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 20px; line-clamp: 3; -webkit-line-clamp: 3; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">
                            ${blog.meta_description}
                        </p>
                        <button class="btn btn-outline" style="margin-top: auto; width: fit-content;" onclick="ContentManager.showFullBlog(${blog.id})">Read Article</button>
                    </div>
                </article>
            `;
        });

        html += `</div></div>`;
        this.dynamicContentRoot.innerHTML = html;
        if (window.refreshObserver) window.refreshObserver();
    },

    showFullBlog(id) {
        const blog = this.blogs.find(b => b.id === id);
        if (!blog) return;

        this.dynamicContentRoot.innerHTML = `
            <div class="fade-up mt-5" style="max-width: 800px; margin: 0 auto;">
                <button class="btn btn-outline" style="margin-bottom: 20px;" onclick="ContentManager.switchToPage('blogs')">← Back to Blogs</button>
                <img src="uploads/blog/${blog.image}" alt="${blog.title}" style="width: 100%; height: 400px; object-fit: cover; border-radius: 12px; margin-bottom: 30px; opacity: 0.9;">
                <h1 style="font-size: 2.5rem; margin-bottom: 20px; line-height: 1.2;">${blog.heading || blog.title}</h1>
                <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 30px;">
                    Published on ${new Date(blog.created_at).toLocaleDateString()}
                </div>
                <div class="glass blog-body" style="padding: var(--space-6); border-radius: 12px; line-height: 1.8; color: var(--text-secondary);">
                    ${blog.body}
                </div>
            </div>
        `;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderVideos() {
        let html = `
            <div class="fade-up mt-5">
                <h1 class="section-title">Sold Machine <span class="text-gradient">Videos</span></h1>
                <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--space-8);">Witness our installations and machinery in action globally.</p>
                <div class="grid grid-cols-2" style="gap: var(--space-8);">
        `;

        this.videos.forEach(video => {
            // Skip archived, hidden, or incomplete videos
            if (video.status == 0 || video.status === 'archived' || !video.link || !video.title) return;

            // Convert YouTube link to embed link
            let embedUrl = video.link;
            if (embedUrl.includes('watch?v=')) {
                embedUrl = embedUrl.replace('watch?v=', 'embed/');
            } else if (embedUrl.includes('youtu.be/')) {
                embedUrl = embedUrl.replace('youtu.be/', 'youtube.com/embed/');
            }

            const displayTitle = video.title && video.title.trim() ? video.title : 'Machine Demonstration Video';

            html += `
                <div class="glass fade-up" style="padding: var(--space-4); border-radius: 12px;">
                    <div style="aspect-ratio: 16/9; margin-bottom: 15px; border-radius: 8px; overflow: hidden;">
                        <iframe width="100%" height="100%" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
                    </div>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary); text-align: center;">${displayTitle}</h3>
                </div>
            `;
        });

        html += `</div></div>`;
        this.dynamicContentRoot.innerHTML = html;
        if (window.refreshObserver) window.refreshObserver();
    },

    renderAbout() {
        const aboutPage = this.pages.find(p => p.slug === 'about-us');

        // Use a premium image from uploads or fallback to a high-quality slide
        const heroImage = aboutPage && aboutPage.image ? `uploads/pages/${aboutPage.image}` : 'uploads/pages/slide3.jpg';

        let html = `
            <div class="fade-up mt-5">
                <h1 class="section-title" style="margin-bottom: 40px;">About <span class="text-gradient">Machines Dealer</span></h1>
                
                <!-- Main About Content -->
                <div class="fade-up" style="max-width: 900px; margin: 0 auto 80px; text-align: center;">
                     <div style="margin-bottom: 20px; display: flex; justify-content: center;">
                        <span style="background: rgba(59, 130, 246, 0.1); color: var(--accent-primary); padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.5px;">EST. 1988</span>
                    </div>
                    <h2 style="font-size: 2.5rem; margin-bottom: 30px; line-height: 1.2;">Bridging the Gap Between <br><span class="text-gradient">European Quality</span> & Indian Production.</h2>
                    <div class="glass" style="padding: var(--space-8); border-radius: 16px; line-height: 1.8; color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 40px;">
                        ${aboutPage ? aboutPage.body : 'Leading the used printing machinery market for over three decades, we specialize in high-quality Heidelberg, Komori, and Bobst equipment. Our commitment to transparency and technical excellence has made us the preferred partner for 1000+ printing houses globally.'}
                    </div>
                    <div style="display: flex; gap: 30px; justify-content: center;">
                         <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px 20px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.05);">
                            <div style="width: 32px; height: 32px; background: rgba(16, 185, 129, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #10b981;">✓</div>
                            <span style="font-weight: 500; font-size: 0.95rem;">Verified Stock</span>
                         </div>
                         <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 10px 20px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.05);">
                            <div style="width: 32px; height: 32px; background: rgba(245, 158, 11, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #f59e0b;">✈</div>
                            <span style="font-weight: 500; font-size: 0.95rem;">Global Logistics</span>
                         </div>
                    </div>
                </div>

                <!-- Stats / Trust Indicators -->
                <!-- Stats / Trust Indicators -->
                <div class="grid grid-cols-4 fade-up" style="gap: var(--space-4); margin-bottom: 80px; text-align: center;">
                    <div class="glass" style="padding: var(--space-6); border-radius: 16px; transition: transform 0.3s ease;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: var(--accent-primary); margin-bottom: 5px;">35+</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">Years Excellence</div>
                    </div>
                    <div class="glass" style="padding: var(--space-6); border-radius: 16px; transition: transform 0.3s ease;">
                         <div style="font-size: 2.5rem; font-weight: 700; color: var(--accent-secondary); margin-bottom: 5px;">1000+</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">Machines <br>Delivered</div>
                    </div>
                    <div class="glass" style="padding: var(--space-6); border-radius: 16px; transition: transform 0.3s ease;">
                         <div style="font-size: 2.5rem; font-weight: 700; margin-bottom: 5px;">
                            <img src="uploads/logos/trustpilot.svg" alt="Trustpilot" style="height: 30px; filter: grayscale(1) invert(1) brightness(2);">
                         </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">Verified Partner</div>
                    </div>
                     <div class="glass" style="padding: var(--space-6); border-radius: 16px; transition: transform 0.3s ease;">
                        <div style="font-size: 2.5rem; margin-bottom: 5px;">🌍</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">Global Network</div>
                    </div>
                </div>

                <!-- Trusted Partners -->
                <div class="fade-up" style="margin-bottom: 100px; text-align: center;">
                    <h3 style="font-size: 1.2rem; margin-bottom: 30px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 2px;">Specializing In</h3>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 60px; flex-wrap: wrap; opacity: 0.7;">
                        <img src="uploads/logos/heidelberg.svg" alt="Heidelberg" style="height: 40px; filter: grayscale(1) brightness(2);">
                        <img src="uploads/logos/komori.svg" alt="Komori" style="height: 35px; filter: grayscale(1) brightness(2);">
                        <img src="uploads/logos/bobst.svg" alt="Bobst" style="height: 35px; filter: grayscale(1) brightness(2);">
                    </div>
                </div>


                <!-- Leadership Team Section -->
                <div id="team-section" class="fade-up">
                    <div style="text-align: center; margin-bottom: 50px;">
                        <span style="color: var(--accent-primary); font-weight: 600; letter-spacing: 1px; font-size: 0.8rem; text-transform: uppercase;">Leadership</span>
                        <h2 class="section-title" style="margin-top: 10px;">Meet the <span class="text-gradient">Experts</span></h2>
                        <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto;">The visionaries behind India's most trusted used printing machinery supplier.</p>
                    </div>

                    <div class="grid grid-cols-3" style="gap: var(--space-8);">
        `;

        this.staff.forEach((member, index) => {
            html += `
                <div class="glass fade-up" style="padding: 0; border-radius: 16px; overflow: hidden; transition-delay: ${index * 0.1}s; text-align: left;">
                    <div style="height: 280px; overflow: hidden; position: relative;">
                        <img src="uploads/our_staff/${member.image}" alt="${member.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;">
                         <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent 60%);"></div>
                         <div style="position: absolute; bottom: 15px; left: 15px;">
                            <h3 style="font-size: 1.4rem; color: #fff; margin-bottom: 2px; font-weight: 700;">${member.name}</h3>
                            <p style="color: rgba(255,255,255,0.8); font-size: 0.9rem; font-weight: 500;">${member.title}</p>
                         </div>
                    </div>
                    <div style="padding: 20px;">
                        <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            ${member.location || 'New Delhi, India'}
                        </div>
                            <div style="display: flex; gap: 10px;">
                                <a href="https://wa.me/919811795787" target="_blank" class="glass-button" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 8px; text-decoration: none; color: white; font-weight: 500; transition: all 0.3s ease;">
                                    <img src="uploads/logos/whatsapp.svg" style="width: 20px; height: 20px;">
                                    WhatsApp
                                </a>
                                <a href="tel:${member.contact}" class="glass-button" style="width: 44px; display: flex; align-items: center; justify-content: center; border-radius: 8px; text-decoration: none; color: white; transition: all 0.3s ease;">
                                    📞
                                </a>
                            </div>
                    </div>
                </div>
            `;
        });

        html += `</div></div></div>`;
        this.dynamicContentRoot.innerHTML = html;
        if (window.refreshObserver) window.refreshObserver();
    },

    renderCompanyStructure() {
        this.renderAbout();
        setTimeout(() => {
            const teamSection = document.getElementById('team-section');
            if (teamSection) {
                teamSection.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    },

    renderContact() {
        // Just show a nice contact page or scroll back home to contact
        // For premium UX, let's re-render the contact form here in a full-page view
        this.dynamicContentRoot.innerHTML = `
            <div class="fade-up mt-5" style="max-width: 900px; margin: 0 auto;">
                <h1 class="section-title">Connect with <span class="text-gradient">Our Experts</span></h1>
                <div class="grid grid-cols-2" style="gap: var(--space-8);">
                    <div class="glass" style="padding: var(--space-6); border-radius: 12px;">
                        <h3 style="margin-bottom: 20px;">Contact Information</h3>
                        <p style="margin-bottom: 15px;">📞 +91 9811795787 (Consultancy)</p>
                        <p style="margin-bottom: 15px;">📞 +91 9910599566 (Sales)</p>
                        <p style="margin-bottom: 15px;">📧 sales@machinesdealer.com</p>
                        <p style="margin-bottom: 15px;">📍 Plot No. 12, Mundka Industrial Area, Delhi</p>
                    </div>
                    <div class="glass" style="padding: var(--space-6); border-radius: 12px;">
                        <h3 style="margin-bottom: 20px;">Send a Message</h3>
                        <form onsubmit="event.preventDefault(); window.showToast('Inquiry sent! Our team will contact you.', 'success'); this.reset();">
                            <input type="text" class="form-control" placeholder="Name" style="margin-bottom: 15px; width: 100%;">
                            <input type="email" class="form-control" placeholder="Email" style="margin-bottom: 15px; width: 100%;">
                            <textarea class="form-control" placeholder="Message" rows="5" style="margin-bottom: 15px; width: 100%;"></textarea>
                            <button class="btn btn-primary" style="width: 100%;">Submit Request</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        if (window.refreshObserver) window.refreshObserver();
    },

    async subscribe(event) {
        event.preventDefault();
        const form = event.target;
        const emailInput = form.querySelector('input[type="email"]');
        const msgDiv = document.getElementById('subscribe-message');
        const btn = form.querySelector('button');
        const email = emailInput.value;

        try {
            btn.disabled = true;
            btn.textContent = 'Subscribing...';

            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const result = await response.json();

            msgDiv.style.display = 'block';
            msgDiv.style.color = result.status === 'success' ? '#10b981' : '#f43f5e';
            msgDiv.textContent = result.message;

            if (result.status === 'success') {
                emailInput.value = '';
            }
        } catch (error) {
            msgDiv.style.display = 'block';
            msgDiv.style.color = '#f43f5e';
            msgDiv.textContent = 'Oops! Something went wrong.';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Subscribe';
            setTimeout(() => { msgDiv.style.display = 'none'; }, 5000);
        }
    }
};

// Expose to window for inline onclick handlers
window.ContentManager = ContentManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => ContentManager.init());
