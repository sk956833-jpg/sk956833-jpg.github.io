// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}));

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar background change on scroll
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Form submission handling
const contactForm = document.querySelector('.contact-form form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        const name = this.querySelector('input[type="text"]').value;
        const email = this.querySelector('input[type="email"]').value;
        const company = this.querySelectorAll('input[type="text"]')[1].value;
        const revenue = this.querySelector('select').value;
        const challenge = this.querySelector('textarea').value;
        
        // Basic validation
        if (!name || !email || !company || !revenue) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Create WhatsApp message
        const message = `Hi Flowgenics! I'm interested in your AI automation services.

Name: ${name}
Email: ${email}
Company: ${company}
Monthly Revenue: ${revenue}
Challenge: ${challenge}

Please contact me to discuss how you can help grow my business.`;
        
        // Open WhatsApp with pre-filled message
        const whatsappUrl = `https://wa.me/15551234567?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        // Reset form
        this.reset();
        
        // Show success message
        alert('Thank you! We\'ll contact you soon via WhatsApp.');
    });
}

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.service-card, .testimonial-card, .metric-card');
    
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Counter animation for stats
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    
    function updateCounter() {
        start += increment;
        if (start < target) {
            element.textContent = Math.floor(start) + (target.toString().includes('%') ? '%' : '');
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target;
        }
    }
    
    updateCounter();
}

// Animate counters when they come into view
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counters = entry.target.querySelectorAll('.stat-number, .metric-number');
            counters.forEach(counter => {
                const text = counter.textContent;
                const number = parseInt(text.replace(/\D/g, ''));
                if (number) {
                    animateCounter(counter, text);
                }
            });
            counterObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

// Observe hero stats and metrics
document.addEventListener('DOMContentLoaded', () => {
    const heroStats = document.querySelector('.hero-stats');
    const resultsVisual = document.querySelector('.results-visual');
    
    if (heroStats) counterObserver.observe(heroStats);
    if (resultsVisual) counterObserver.observe(resultsVisual);
});

// Spline viewer loading
document.addEventListener('DOMContentLoaded', () => {
    const splineViewer = document.querySelector('spline-viewer');
    if (splineViewer) {
        splineViewer.addEventListener('load', () => {
            console.log('Spline 3D scene loaded successfully');
            // Hide Spline UI elements
            const style = document.createElement('style');
            style.textContent = `
                spline-viewer::part(ui) {
                    display: none !important;
                }
                spline-viewer::part(loading) {
                    display: none !important;
                }
                .spline-ui {
                    display: none !important;
                }
                [data-spline-ui] {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        });
        
        splineViewer.addEventListener('error', (e) => {
            console.error('Error loading Spline scene:', e);
            // Fallback to a simple graphic if Spline fails to load
            const heroSpline = document.querySelector('.hero-spline');
            if (heroSpline) {
                heroSpline.innerHTML = `
                    <div class="hero-graphic">
                        <div class="chart-container">
                            <div class="chart-bar" style="height: 60%;"></div>
                            <div class="chart-bar" style="height: 80%;"></div>
                            <div class="chart-bar" style="height: 100%;"></div>
                            <div class="chart-bar" style="height: 120%;"></div>
                        </div>
                        <div class="growth-arrow">
                            <i class="fas fa-arrow-up"></i>
                        </div>
                    </div>
                `;
            }
        });
    }
});

// Add loading animation
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});

// Set initial body opacity for loading effect
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';
