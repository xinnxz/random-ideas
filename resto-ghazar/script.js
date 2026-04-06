/* =============================================================
   RESTO GHAZAR — JavaScript Interactivity
   ─────────────────────────────────────────────────────────────
   
   File ini mengelola semua interaksi di website:
   
   1. SCROLL REVEAL — Elemen muncul saat masuk viewport 
      (menggunakan IntersectionObserver API)
   
   2. STICKY HEADER — Header berubah style saat scroll
   
   3. REVIEWS CAROUSEL — Auto-play carousel dengan 
      manual controls (prev/next/dots)
   
   4. HAMBURGER MENU — Mobile navigation toggle
   
   5. SMOOTH SCROLL — Navigasi anchor yang halus
   
   6. PARALLAX EFFECT — Hero image sedikit bergerak saat scroll
   
   PENJELASAN:
   IntersectionObserver adalah Web API moderen yang sangat 
   efisien untuk mendeteksi kapan sebuah elemen masuk/keluar 
   viewport. Lebih baik daripada scroll event listener 
   karena tidak blocking main thread.
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // ─── 1. SCROLL REVEAL ANIMATION ────────────────────────────
    // 
    // Cara kerja:
    // - Semua elemen dengan class .reveal dimulai tersembunyi 
    //   (opacity: 0, translateY: 40px — lihat CSS)
    // - IntersectionObserver mengawasi kapan elemen masuk viewport
    // - Saat masuk, class .revealed ditambahkan → trigger CSS transition
    // - unobserve() dipanggil agar observer berhenti mengawasi
    //   elemen yang sudah terlihat (hemat memory)
    // 
    // threshold: 0.1 artinya trigger saat 10% elemen terlihat
    // ────────────────────────────────────────────────────────────
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Tambah sedikit delay untuk stagger effect
                // Setiap elemen muncul 100ms setelah sebelumnya
                setTimeout(() => {
                    entry.target.classList.add('revealed');
                }, index * 80);
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,    // Trigger saat 10% terlihat
        rootMargin: '0px 0px -50px 0px'  // Trigger sedikit sebelum terlihat penuh
    });

    // Daftarkan semua elemen .reveal ke observer
    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });


    // ─── 2. STICKY HEADER ──────────────────────────────────────
    // 
    // Saat user scroll lebih dari 100px:
    // - Tambah class .scrolled ke header
    // - CSS .scrolled memberikan background gelap + blur
    // 
    // Ini menciptakan efek header yang "muncul" dari transparan
    // menjadi solid saat content di bawah hero section
    // ────────────────────────────────────────────────────────────
    
    const header = document.getElementById('site-header');
    let lastScrollY = 0;

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        
        if (scrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScrollY = scrollY;
    }, { passive: true }); 
    // passive: true → memberi tahu browser bahwa listener ini
    // tidak akan memanggil preventDefault(), sehingga scrolling
    // tetap smooth tanpa jank


    // ─── 3. REVIEWS CAROUSEL ───────────────────────────────────
    // 
    // Carousel sederhana tanpa library external:
    // - Track berisi semua review cards secara horizontal
    // - Transform: translateX digunakan untuk menggeser
    // - Auto-play: setiap 5 detik pindah ke slide berikutnya
    // - Pause saat hover (user mungkin sedang baca)
    // - Dots navigation: klik dot langsung ke slide tertentu
    // ────────────────────────────────────────────────────────────
    
    const track = document.getElementById('reviews-track');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const dotsContainer = document.getElementById('carousel-dots');
    
    if (track && prevBtn && nextBtn && dotsContainer) {
        const cards = track.querySelectorAll('.review-card');
        let currentIndex = 0;
        let autoPlayInterval;
        const totalSlides = cards.length;

        // Buat dots berdasarkan jumlah cards
        cards.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.classList.add('carousel-dot');
            if (i === 0) dot.classList.add('active');
            dot.setAttribute('aria-label', `Go to review ${i + 1}`);
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });

        const dots = dotsContainer.querySelectorAll('.carousel-dot');

        // Fungsi utama: geser carousel ke index tertentu
        function goToSlide(index) {
            currentIndex = index;
            // translateX(-100% × index) menggeser track ke kiri
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
            
            // Update active dot
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        function nextSlide() {
            // Kalau sudah di akhir, kembali ke awal (loop)
            goToSlide((currentIndex + 1) % totalSlides);
        }

        function prevSlide() {
            // Kalau di awal, pindah ke akhir (loop backward)
            goToSlide((currentIndex - 1 + totalSlides) % totalSlides);
        }

        // Event listeners untuk tombol prev/next
        nextBtn.addEventListener('click', () => {
            nextSlide();
            resetAutoPlay();
        });

        prevBtn.addEventListener('click', () => {
            prevSlide();
            resetAutoPlay();
        });

        // Auto-play: otomatis pindah setiap 5 detik
        function startAutoPlay() {
            autoPlayInterval = setInterval(nextSlide, 5000);
        }

        function resetAutoPlay() {
            clearInterval(autoPlayInterval);
            startAutoPlay();
        }

        // Pause saat hover — user mungkin sedang membaca
        const carouselSection = document.getElementById('reviews-carousel');
        carouselSection.addEventListener('mouseenter', () => {
            clearInterval(autoPlayInterval);
        });
        carouselSection.addEventListener('mouseleave', () => {
            startAutoPlay();
        });

        // Touch/swipe support untuk mobile
        let touchStartX = 0;
        let touchEndX = 0;

        track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50; // Minimum swipe distance (pixels)
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    nextSlide(); // Swipe kiri → slide berikutnya
                } else {
                    prevSlide(); // Swipe kanan → slide sebelumnya
                }
                resetAutoPlay();
            }
        }

        startAutoPlay();
    }


    // ─── 4. HAMBURGER MENU (MOBILE) ────────────────────────────
    // 
    // Toggle class .active pada hamburger dan overlay:
    // - Hamburger berubah jadi X (via CSS transforms)
    // - Overlay muncul dengan full-screen nav links
    // - Body scroll disabled saat menu terbuka
    // ────────────────────────────────────────────────────────────
    
    const hamburger = document.getElementById('hamburger');
    const mobileOverlay = document.getElementById('mobile-nav-overlay');
    
    if (hamburger && mobileOverlay) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
            // Disable body scroll saat menu terbuka
            document.body.style.overflow = 
                mobileOverlay.classList.contains('active') ? 'hidden' : '';
        });

        // Close menu saat klik nav link
        mobileOverlay.querySelectorAll('.mobile-nav-link, .btn-reserve-mobile').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                mobileOverlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }


    // ─── 5. SMOOTH SCROLL untuk NAV LINKS ──────────────────────
    // 
    // Override default anchor behavior agar scroll halus.
    // Offset -80px untuk memberikan ruang di bawah sticky header.
    // ────────────────────────────────────────────────────────────
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return; // Skip empty anchors
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                const headerOffset = 80; // Tinggi header
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.scrollY - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });


    // ─── 6. PARALLAX EFFECT pada HERO ──────────────────────────
    // 
    // Hero background image bergerak sedikit lebih lambat dari 
    // scroll speed, menciptakan kedalaman visual (parallax).
    // 
    // requestAnimationFrame memastikan animasi berjalan di 
    // frame berikutnya → smoother dari langsung di scroll event
    // ────────────────────────────────────────────────────────────
    
    const heroImg = document.querySelector('.hero-bg-img');
    
    if (heroImg) {
        window.addEventListener('scroll', () => {
            requestAnimationFrame(() => {
                const scrolled = window.scrollY;
                if (scrolled < window.innerHeight) {
                    // Geser image ke bawah 30% dari scroll speed
                    heroImg.style.transform = `scale(1.05) translateY(${scrolled * 0.3}px)`;
                }
            });
        }, { passive: true });
    }


    // ─── 7. ACTIVE NAV LINK HIGHLIGHT ──────────────────────────
    // 
    // Highlight nav link yang sesuai dengan section yang 
    // sedang terlihat di viewport.
    // 
    // Menggunakan IntersectionObserver yang terpisah dari
    // reveal observer karena behavior-nya berbeda:
    // - Ini perlu terus mengawasi (tidak di-unobserve)
    // - Threshold lebih tinggi (30% visible)
    // ────────────────────────────────────────────────────────────
    
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.toggle(
                        'active',
                        link.getAttribute('href') === `#${sectionId}`
                    );
                });
            }
        });
    }, {
        threshold: 0.3,
        rootMargin: '-80px 0px -50% 0px'
    });

    sections.forEach(section => sectionObserver.observe(section));


    // ─── 8. COUNTER ANIMATION (Bonus) ──────────────────────────
    // 
    // Animasi angka yang incrementing — bisa dipakai kalau
    // nantinya mau tambahin statistik (misal: "500+ Happy Guests")
    // ────────────────────────────────────────────────────────────
    
    function animateCounter(element, target, duration = 2000) {
        let start = 0;
        const increment = target / (duration / 16); // ~60fps
        
        function update() {
            start += increment;
            if (start < target) {
                element.textContent = Math.ceil(start);
                requestAnimationFrame(update);
            } else {
                element.textContent = target;
            }
        }
        
        update();
    }


    // ─── 9. PRELOADER / PAGE TRANSITION ────────────────────────
    // 
    // Fade in seluruh page setelah fonts & images loaded.
    // Ini mencegah FOUT (Flash of Unstyled Text) yang 
    // terjadi saat Google Fonts belum termuat.
    // ────────────────────────────────────────────────────────────
    
    // Pastikan hero reveal dimainkan setelah page loaded
    window.addEventListener('load', () => {
        // Small delay agar fonts render dulu
        setTimeout(() => {
            document.querySelectorAll('.hero .reveal').forEach((el, i) => {
                setTimeout(() => {
                    el.classList.add('revealed');
                }, i * 200); // Stagger: 200ms antar elemen hero
            });
        }, 300);
    });

});
