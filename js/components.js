document.addEventListener('DOMContentLoaded', () => {
    // Inject Nav Scroll Effect
    const navbar = document.querySelector('.glass-nav');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('nav-scrolled');
            } else {
                navbar.classList.remove('nav-scrolled');
            }
        });
    }

    // Initialize Scroll Animations
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

    // Rotating Gears Scroll Effect
    const gearLeft = document.querySelector('.gear-top-left');
    const gearRight = document.querySelector('.gear-bottom-right');

    if (gearLeft || gearRight) {
        window.addEventListener('scroll', () => {
            const rotation = window.scrollY * 0.2;
            if (gearLeft) gearLeft.style.transform = `rotate(${rotation}deg)`;
            if (gearRight) gearRight.style.transform = `rotate(-${rotation * 0.5}deg)`;
        });
    }
});

// Component Template Creator (Simple Helper)
const createComponent = (tag, className, content) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.innerHTML = content;
    return el;
};
