/* ================================================
   FANTA CIRCULAR ROTATING SLIDER
   JavaScript Logic & Interactivity
   ================================================ */

/**
 * DATA PRODUK FANTA
 * Array berisi informasi setiap varian Fanta.
 * Digunakan untuk update konten info panel & tema warna.
 * 
 * - theme: nama class CSS yang diterapkan ke <body>
 * - name: nama produk yang ditampilkan di heading
 * - tag: label kecil di atas nama
 * - desc: deskripsi produk
 */
const PRODUCTS = [
    {
        theme: 'theme-orange',
        name: 'Fanta Orange',
        tag: 'CLASSIC FLAVOR',
        desc: 'The original and iconic Fanta flavor. Bursting with bright, bold orange taste that\'s been refreshing the world since 1940. Feel the fizz, taste the fun!'
    },
    {
        theme: 'theme-grape',
        name: 'Fanta Grape',
        tag: 'FAN FAVORITE',
        desc: 'Dive into the deep, luscious sweetness of Fanta Grape. Rich purple perfection with a fizzy twist that makes every sip a grape escape!'
    },
    {
        theme: 'theme-strawberry',
        name: 'Fanta Strawberry',
        tag: 'BERRY BLAST',
        desc: 'Sweet, juicy, and irresistibly refreshing. Fanta Strawberry brings the vibrant taste of sun-ripened strawberries with every effervescent sip.'
    },
    {
        theme: 'theme-pineapple',
        name: 'Fanta Pineapple',
        tag: 'TROPICAL VIBES',
        desc: 'Escape to paradise with Fanta Pineapple. A golden burst of tropical sweetness that transports you to sun-soaked beaches with every fizzy gulp.'
    },
    {
        theme: 'theme-green-apple',
        name: 'Fanta Green Apple',
        tag: 'FRESH & TANGY',
        desc: 'Crisp, tart, and wonderfully refreshing. Fanta Green Apple delivers a zingy burst of fresh apple flavor with a satisfying fizzy kick.'
    }
];

/**
 * CLASS: CircularSlider
 * 
 * Mengelola seluruh logika slider circular 3D:
 * 1. Rotasi ring (next/prev)
 * 2. Update tema warna halaman
 * 3. Update konten info panel dengan animasi
 * 4. Auto-play (otomatis putar setiap beberapa detik)
 * 5. Dot indicators & flavor badges
 */
class CircularSlider {
    constructor() {
        // ---- State ----
        this.currentIndex = 0;                    // Index produk yang aktif saat ini
        this.totalItems = PRODUCTS.length;        // Total produk (5)
        this.anglePerItem = 360 / this.totalItems; // Sudut per item: 360/5 = 72°
        this.isAnimating = false;                 // Flag untuk mencegah spam klik
        this.autoPlayDelay = 4000;                // Interval auto-play: 4 detik
        this.autoPlayTimer = null;                // Reference ke setInterval

        // ---- DOM Elements ----
        this.body = document.body;
        this.ring = document.getElementById('sliderRing');
        this.items = document.querySelectorAll('.slider-item');
        this.dots = document.querySelectorAll('.dot');
        this.badges = document.querySelectorAll('.flavor-badge');
        this.productName = document.getElementById('productName');
        this.productDesc = document.getElementById('productDesc');
        this.productTag = document.getElementById('productTag');
        this.sliderContainer = document.getElementById('sliderContainer');
        this.navPrev = document.getElementById('navPrev');
        this.navNext = document.getElementById('navNext');

        // ---- Initialize ----
        this.init();
    }

    /**
     * INIT
     * Setup semua event listener dan mulai auto-play.
     */
    init() {
        // Set item pertama sebagai active
        this.updateActiveItem();
        this.updateActiveDot();
        this.updateActiveBadge();

        // Event: tombol navigasi
        this.navPrev.addEventListener('click', () => this.prev());
        this.navNext.addEventListener('click', () => this.next());

        // Event: dot indicators
        this.dots.forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.index);
                this.goTo(index);
            });
        });

        // Event: flavor badges
        this.badges.forEach(badge => {
            badge.addEventListener('click', () => {
                const index = parseInt(badge.dataset.index);
                this.goTo(index);
            });
        });

        // Event: keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        // Event: pause auto-play saat hover
        this.sliderContainer.addEventListener('mouseenter', () => this.pauseAutoPlay());
        this.sliderContainer.addEventListener('mouseleave', () => this.startAutoPlay());

        // Event: touch/swipe support untuk mobile
        this.setupTouchEvents();

        // Mulai auto-play
        this.startAutoPlay();

        // Mulai bubble generator
        this.startBubbles();
    }

    /**
     * NEXT
     * Pindah ke produk berikutnya.
     * currentIndex bertambah 1 (dengan wrapping menggunakan modulo).
     */
    next() {
        if (this.isAnimating) return;
        this.currentIndex = (this.currentIndex + 1) % this.totalItems;
        this.update();
    }

    /**
     * PREV
     * Pindah ke produk sebelumnya.
     * currentIndex berkurang 1 (dengan wrapping).
     */
    prev() {
        if (this.isAnimating) return;
        this.currentIndex = (this.currentIndex - 1 + this.totalItems) % this.totalItems;
        this.update();
    }

    /**
     * GO TO
     * Langsung pindah ke produk tertentu berdasarkan index.
     */
    goTo(index) {
        if (this.isAnimating || index === this.currentIndex) return;
        this.currentIndex = index;
        this.update();
    }

    /**
     * UPDATE
     * Fungsi utama yang dipanggil setiap kali produk berubah.
     * Menjalankan semua update secara berurutan:
     * 1. Lock animasi (cegah spam)
     * 2. Putar ring 3D
     * 3. Update tema warna
     * 4. Animasi konten info panel
     * 5. Update dot & badge aktif
     * 6. Reset auto-play timer
     */
    update() {
        this.isAnimating = true;

        // 1. Rotate the 3D ring
        // Rumus: rotasi = -(currentIndex * derajat per item)
        // Minus karena kita ingin item berputar KE ARAH kamera
        const rotation = -(this.currentIndex * this.anglePerItem);
        this.ring.style.transform = `rotateY(${rotation}deg)`;

        // 2. Update tema warna (class di body)
        this.updateTheme();

        // 3. Update konten info panel dengan animasi fade
        this.updateContent();

        // 4. Update UI indicators
        this.updateActiveItem();
        this.updateActiveDot();
        this.updateActiveBadge();

        // 5. Reset auto-play
        this.resetAutoPlay();

        // 6. Unlock animasi setelah transisi selesai
        setTimeout(() => {
            this.isAnimating = false;
        }, 800); // Sesuaikan dengan --transition-speed di CSS
    }

    /**
     * UPDATE THEME
     * Mengganti class tema di <body>.
     * Ini mengubah CSS custom properties (variabel warna)
     * sehingga seluruh warna halaman berubah sekaligus.
     */
    updateTheme() {
        const product = PRODUCTS[this.currentIndex];
        
        // Hapus semua class tema yang ada
        this.body.classList.remove(
            'theme-orange', 'theme-grape', 'theme-strawberry',
            'theme-pineapple', 'theme-green-apple'
        );
        
        // Tambahkan class tema baru
        this.body.classList.add(product.theme);
    }

    /**
     * UPDATE CONTENT
     * Menganimasi pergantian konten di info panel.
     * 
     * Proses:
     * 1. Fade out konten lama (tambah class 'fade-out')
     * 2. Tunggu 300ms (durasi animasi fade)
     * 3. Ganti teks dengan data produk baru
     * 4. Fade in konten baru (hapus class 'fade-out')
     */
    updateContent() {
        const product = PRODUCTS[this.currentIndex];

        // Step 1: Fade out
        this.productName.classList.add('fade-out');
        this.productDesc.classList.add('fade-out');

        // Step 2 & 3: Setelah fade selesai, ganti konten
        setTimeout(() => {
            this.productName.textContent = product.name;
            this.productDesc.textContent = product.desc;
            this.productTag.textContent = product.tag;

            // Step 4: Fade in
            this.productName.classList.remove('fade-out');
            this.productDesc.classList.remove('fade-out');
        }, 300);
    }

    /**
     * UPDATE ACTIVE ITEM
     * Menandai slider item mana yang sedang aktif
     * (untuk efek visual: lebih terang, scale lebih besar)
     */
    updateActiveItem() {
        this.items.forEach((item, i) => {
            if (i === this.currentIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * UPDATE ACTIVE DOT
     * Menandai dot indicator mana yang aktif
     */
    updateActiveDot() {
        this.dots.forEach((dot, i) => {
            if (i === this.currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    /**
     * UPDATE ACTIVE BADGE
     * Menandai flavor badge mana yang aktif
     */
    updateActiveBadge() {
        this.badges.forEach((badge, i) => {
            if (i === this.currentIndex) {
                badge.classList.add('active');
            } else {
                badge.classList.remove('active');
            }
        });
    }

    /* ================================================
       AUTO-PLAY
       Slider otomatis berputar ke produk berikutnya
       setiap beberapa detik.
       ================================================ */

    /**
     * START AUTO-PLAY
     * Mulai interval timer untuk rotasi otomatis
     */
    startAutoPlay() {
        if (this.autoPlayTimer) return; // Jangan double-start
        this.autoPlayTimer = setInterval(() => {
            this.next();
        }, this.autoPlayDelay);
    }

    /**
     * PAUSE AUTO-PLAY
     * Hentikan interval timer (misalnya saat mouse hover)
     */
    pauseAutoPlay() {
        if (this.autoPlayTimer) {
            clearInterval(this.autoPlayTimer);
            this.autoPlayTimer = null;
        }
    }

    /**
     * RESET AUTO-PLAY
     * Restart timer setelah interaksi manual (klik prev/next/dot)
     * agar countdown dimulai ulang dari 0
     */
    resetAutoPlay() {
        this.pauseAutoPlay();
        this.startAutoPlay();
    }

    /* ================================================
       TOUCH/SWIPE SUPPORT (Mobile)
       Mendeteksi gesture swipe kiri/kanan pada slider
       ================================================ */

    setupTouchEvents() {
        let touchStartX = 0;
        let touchEndX = 0;
        const minSwipeDistance = 50; // Minimum jarak swipe (px)

        this.sliderContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            this.pauseAutoPlay();
        }, { passive: true });

        this.sliderContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;

            // Swipe ke kiri → next product
            if (diff > minSwipeDistance) {
                this.next();
            }
            // Swipe ke kanan → prev product
            else if (diff < -minSwipeDistance) {
                this.prev();
            }

            this.startAutoPlay();
        }, { passive: true });
    }

    /* ================================================
       BUBBLE GENERATOR
       Membuat elemen gelembung secara dinamis
       untuk efek visual "fizzy soda"
       ================================================ */

    startBubbles() {
        const container = document.getElementById('bubblesContainer');
        
        /**
         * createBubble()
         * Membuat satu elemen bubble dengan properti acak:
         * - size: ukuran (10-45px)
         * - left: posisi horizontal (0-100%)
         * - duration: durasi animasi naik (6-14 detik)
         * - delay: delay sebelum mulai (0-4 detik)
         * 
         * Bubble dihapus dari DOM setelah animasi selesai
         * untuk mencegah memory leak.
         */
        const createBubble = () => {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble');

            // Randomize properti
            const size = Math.random() * 35 + 10;       // 10-45px
            const left = Math.random() * 100;            // 0-100%
            const duration = Math.random() * 8 + 6;      // 6-14 detik
            const delay = Math.random() * 4;             // 0-4 detik

            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.left = `${left}%`;
            bubble.style.animationDuration = `${duration}s`;
            bubble.style.animationDelay = `${delay}s`;

            container.appendChild(bubble);

            // Hapus bubble dari DOM setelah animasi selesai
            // Total waktu = delay + duration + sedikit buffer
            setTimeout(() => {
                bubble.remove();
            }, (duration + delay) * 1000 + 500);
        };

        // Buat batch awal bubbles
        for (let i = 0; i < 15; i++) {
            createBubble();
        }

        // Terus buat bubble baru setiap 800ms
        setInterval(() => {
            createBubble();
        }, 800);
    }
}

/* ================================================
   INITIALIZATION
   Jalankan slider setelah DOM siap
   ================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const slider = new CircularSlider();
});
