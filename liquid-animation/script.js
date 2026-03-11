/* ============================================================
   LIQUID FLOW — WebGL Liquid Animation + UI Interactions
   ============================================================
   
   PENJELASAN LENGKAP:
   
   File ini terdiri dari 3 bagian utama:
   
   1. WebGL LIQUID ANIMATION (Metaball Shader)
      - Menggunakan WebGL untuk menggambar animasi liquid di canvas
      - Fragment shader menghitung "metaball" — teknik dimana beberapa 
        lingkaran (blob) bisa menyatu seperti cairan
      - Setiap blob punya posisi & radius, bergerak secara sinusoidal
      - Mouse position juga jadi salah satu blob (interaktif!)
   
   2. SCROLL ANIMATIONS (Intersection Observer)
      - Elemen dengan class "animate-on-scroll" akan muncul dengan 
        efek fade-in + slide-up saat user scroll ke area tersebut
      - Menggunakan IntersectionObserver API (performant, no scroll event spam)
   
   3. COUNTER ANIMATION
      - Angka statistik di hero section akan menghitung naik dari 0
        ke target value saat pertama kali terlihat
   
   ============================================================ */

// ============================================================
// BAGIAN 1: WebGL LIQUID / METABALL ANIMATION
// ============================================================

(function () {
    'use strict';

    // Ambil referensi canvas element dari HTML
    const canvas = document.getElementById('liquid-canvas');
    
    // Dapatkan WebGL context — ini yang memungkinkan kita render grafik 3D/2D di canvas
    // 'webgl' = WebGL 1.0, paling banyak didukung browser
    const gl = canvas.getContext('webgl', {
        alpha: true,           // Izinkan transparansi
        premultipliedAlpha: false,
        antialias: false,      // Matikan antialiasing untuk performa
        preserveDrawingBuffer: false
    });

    // Jika browser tidak support WebGL, tampilkan pesan error
    if (!gl) {
        console.warn('WebGL not supported. Liquid animation disabled.');
        return;
    }

    // -----------------------------------------------------------
    // SHADER SOURCE CODE
    // -----------------------------------------------------------
    // Shader adalah program kecil yang berjalan di GPU (kartu grafis)
    // Ada 2 jenis shader:
    //   1. Vertex Shader   → menentukan POSISI setiap titik (vertex)
    //   2. Fragment Shader  → menentukan WARNA setiap pixel
    
    // VERTEX SHADER
    // Sangat sederhana: hanya menggambar segiempat fullscreen
    // attribute vec2 a_position → menerima koordinat sudut (-1 sampai 1)
    const vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    // FRAGMENT SHADER
    // Ini inti dari animasi liquid!
    // Untuk SETIAP pixel di layar, shader ini menghitung warnanya
    //
    // Konsep Metaball:
    // - Ada beberapa "blob" (lingkaran tak terlihat) 
    // - Untuk setiap pixel, hitung jarak ke semua blob
    // - Gunakan rumus: influence = radius² / jarak²
    // - Jumlahkan semua influence
    // - Jika total > threshold → pixel masuk area liquid
    // - Semakin dekat ke blob → influence semakin besar → cairan
    //   terlihat "menyatu" ketika blob berdekatan
    
    const NUM_BLOBS = 8; // Jumlah blob dalam animasi

    const fragmentShaderSource = `
        precision mediump float;
        
        // uniform = variabel yang dikirim dari JavaScript ke shader
        uniform vec2 u_resolution;    // Ukuran canvas (width, height)
        uniform float u_time;         // Waktu animasi (berubah setiap frame)
        uniform vec2 u_mouse;         // Posisi mouse (0.0 - 1.0)
        uniform vec2 u_blobs[${NUM_BLOBS}];     // Posisi setiap blob
        uniform float u_radii[${NUM_BLOBS}];    // Radius setiap blob
        
        // ---- HSL to RGB Color Conversion ----
        // Kita pakai HSL karena lebih mudah membuat gradient warna pelangi
        // H (Hue) = warna (0-360°), S (Saturation), L (Lightness)
        
        // Helper function untuk konversi HUE → RGB
        float hue2rgb(float p, float q, float t) {
            if (t < 0.0) t += 1.0;
            if (t > 1.0) t -= 1.0;
            if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
            if (t < 1.0/2.0) return q;
            if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
            return p;
        }
        
        // Konversi HSL (0-1) → RGB (0-1)
        vec3 hsl2rgb(float h, float s, float l) {
            float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
            float p = 2.0 * l - q;
            return vec3(
                hue2rgb(p, q, h + 1.0/3.0),
                hue2rgb(p, q, h),
                hue2rgb(p, q, h - 1.0/3.0)
            );
        }
        
        void main() {
            // Normalisasi koordinat pixel ke range 0.0 - 1.0
            // dan sesuaikan aspect ratio agar blob tetap bulat
            vec2 uv = gl_FragCoord.xy / u_resolution;
            float aspect = u_resolution.x / u_resolution.y;
            uv.x *= aspect;
            
            // ---- Hitung total influence dari semua blob ----
            float totalInfluence = 0.0;
            float colorMix = 0.0;  // Untuk menentukan warna berdasarkan blob mana yang dominan
            
            for (int i = 0; i < ${NUM_BLOBS}; i++) {
                // Sesuaikan posisi blob dengan aspect ratio
                vec2 blobPos = u_blobs[i];
                blobPos.x *= aspect;
                
                // Hitung jarak pixel ke blob
                float dist = distance(uv, blobPos);
                
                // RUMUS METABALL: influence = radius² / jarak²
                // Ini membuat influence sangat kuat di dekat blob
                // dan cepat melemah saat menjauh
                float influence = (u_radii[i] * u_radii[i]) / (dist * dist + 0.0001);
                
                totalInfluence += influence;
                
                // colorMix mengakumulasi index blob berdasarkan influence-nya
                // Ini digunakan nanti untuk menentukan warna
                colorMix += influence * float(i);
            }
            
            // ---- Tentukan warna pixel ----
            
            // Normalize colorMix berdasarkan total influence
            colorMix = colorMix / (totalInfluence + 0.001) / float(${NUM_BLOBS});
            
            // Buat warna menggunakan HSL:
            // - Hue berputar berdasarkan posisi blob + waktu (animasi warna)
            // - Saturation tinggi (0.7) untuk warna vibrant
            // - Lightness tergantung seberapa "dalam" di area liquid
            float hue = fract(colorMix + u_time * 0.05);
            float saturation = 0.7;
            float lightness = 0.5;
            
            vec3 color = hsl2rgb(hue, saturation, lightness);
            
            // ---- Apply metaball threshold ----
            // smoothstep membuat transisi halus di edge liquid
            // - Jika totalInfluence < 0.8  → di luar liquid (transparan penuh)
            // - Jika totalInfluence > 1.2  → di dalam liquid (opacity penuh)
            // - Di antara 0.8-1.2          → edge liquid (semi-transparan)
            float alpha = smoothstep(0.8, 1.2, totalInfluence);
            
            // Tambahkan glow effect di sekitar edge liquid
            // Edge glow membuat tampilan lebih premium
            float glow = smoothstep(0.4, 0.9, totalInfluence) * 0.15;
            
            // Buat warna lebih terang di area high-influence (pusat blob)
            vec3 brightColor = color * (1.0 + totalInfluence * 0.3);
            
            // Campurkan: glow (lemah) + liquid body (kuat)
            vec3 finalColor = mix(color * 0.5, brightColor, alpha);
            float finalAlpha = max(alpha * 0.6, glow);
            
            gl_FragColor = vec4(finalColor, finalAlpha);
        }
    `;

    // -----------------------------------------------------------
    // COMPILE & LINK SHADERS
    // -----------------------------------------------------------
    // Shader perlu di-compile (seperti program C) lalu di-link menjadi "program"
    
    /**
     * createShader: Compile satu shader (vertex atau fragment)
     * @param {number} type - gl.VERTEX_SHADER atau gl.FRAGMENT_SHADER
     * @param {string} source - GLSL source code
     * @returns {WebGLShader} - Compiled shader object
     */
    function createShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);  // Masukkan source code
        gl.compileShader(shader);          // Compile!
        
        // Cek apakah compile berhasil
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    /**
     * createProgram: Link vertex + fragment shader menjadi satu program
     * Program inilah yang dijalankan GPU untuk setiap pixel
     */
    function createProgram(vertSrc, fragSrc) {
        const vertShader = createShader(gl.VERTEX_SHADER, vertSrc);
        const fragShader = createShader(gl.FRAGMENT_SHADER, fragSrc);
        
        if (!vertShader || !fragShader) return null;
        
        const program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    // Compile dan link shader program
    const program = createProgram(vertexShaderSource, fragmentShaderSource);
    if (!program) return;

    // Aktifkan program ini untuk rendering
    gl.useProgram(program);

    // -----------------------------------------------------------
    // SETUP GEOMETRY (Fullscreen Quad)
    // -----------------------------------------------------------
    // Kita menggambar 2 segitiga yang membentuk persegi penuh layar
    // Koordinat -1 sampai 1 dalam "clip space" (sistem koordinat WebGL)
    //
    //  (-1, 1)-----(1, 1)
    //    |  \        |
    //    |    \      |
    //    |      \    |
    //    |        \  |
    //  (-1,-1)-----(1,-1)

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,   // Sudut kiri bawah
         1, -1,   // Sudut kanan bawah
        -1,  1,   // Sudut kiri atas
         1,  1    // Sudut kanan atas
    ]), gl.STATIC_DRAW);

    // Hubungkan buffer ke attribute "a_position" di vertex shader
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // -----------------------------------------------------------
    // GET UNIFORM LOCATIONS
    // -----------------------------------------------------------
    // Uniform = variabel yang kita kirim dari JS ke shader setiap frame
    
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    
    // Ambil lokasi array uniform untuk blob positions & radii
    const uBlobs = [];
    const uRadii = [];
    for (let i = 0; i < NUM_BLOBS; i++) {
        uBlobs.push(gl.getUniformLocation(program, `u_blobs[${i}]`));
        uRadii.push(gl.getUniformLocation(program, `u_radii[${i}]`));
    }

    // -----------------------------------------------------------
    // BLOB DATA
    // -----------------------------------------------------------
    // Setiap blob punya:
    // - x, y: posisi awal (0.0 - 1.0)
    // - radius: ukuran pengaruh
    // - speedX/Y: kecepatan gerak
    // - phaseX/Y: offset fase sinusoidal (agar tidak sinkron)
    
    const blobs = [];
    for (let i = 0; i < NUM_BLOBS; i++) {
        blobs.push({
            x: Math.random(),
            y: Math.random(),
            radius: 0.08 + Math.random() * 0.1,       // Radius antara 0.08 - 0.18
            speedX: 0.2 + Math.random() * 0.4,          // Kecepatan X
            speedY: 0.15 + Math.random() * 0.35,        // Kecepatan Y
            phaseX: Math.random() * Math.PI * 2,         // Random starting phase
            phaseY: Math.random() * Math.PI * 2
        });
    }

    // -----------------------------------------------------------
    // MOUSE TRACKING
    // -----------------------------------------------------------
    // Posisi mouse disimpan dalam normalized coordinates (0.0 - 1.0)
    // smoothMouse = posisi yang di-interpolasi agar gerakan halus
    
    let mouseX = 0.5, mouseY = 0.5;         // Posisi actual mouse
    let smoothMouseX = 0.5, smoothMouseY = 0.5; // Posisi yang smoothed

    document.addEventListener('mousemove', (e) => {
        // Normalisasi posisi mouse ke 0.0 - 1.0
        mouseX = e.clientX / window.innerWidth;
        mouseY = 1.0 - (e.clientY / window.innerHeight); // Flip Y karena WebGL Y=0 di bawah
    });

    // Untuk touch devices (mobile)
    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        mouseX = touch.clientX / window.innerWidth;
        mouseY = 1.0 - (touch.clientY / window.innerHeight);
    }, { passive: true });

    // -----------------------------------------------------------
    // CANVAS RESIZE
    // -----------------------------------------------------------
    // Canvas harus selalu seukuran window
    // devicePixelRatio menangani layar retina/high-DPI
    
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x untuk performa
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('resize', resize);
    resize();

    // -----------------------------------------------------------
    // ENABLE BLENDING (Transparansi)
    // -----------------------------------------------------------
    // Agar warna liquid bisa semi-transparan di atas background
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // -----------------------------------------------------------
    // ANIMATION LOOP
    // -----------------------------------------------------------
    // requestAnimationFrame → dipanggil ~60x per detik oleh browser
    // Ini adalah "game loop" yang update posisi blob & render setiap frame
    
    let startTime = Date.now();

    function render() {
        // Hitung waktu yang sudah berlalu (dalam detik)
        const time = (Date.now() - startTime) * 0.001;

        // Clear canvas (transparan penuh)
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Kirim ukuran canvas ke shader
        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, time);

        // ---- Smooth Mouse Interpolation ----
        // Lerp (Linear Interpolation) membuat gerakan mouse lebih halus
        // Factor 0.05 = hanya 5% jarak ke target per frame → gerakan lembut
        smoothMouseX += (mouseX - smoothMouseX) * 0.05;
        smoothMouseY += (mouseY - smoothMouseY) * 0.05;
        gl.uniform2f(uMouse, smoothMouseX, smoothMouseY);

        // ---- Update Posisi Setiap Blob ----
        for (let i = 0; i < NUM_BLOBS; i++) {
            const blob = blobs[i];
            
            // Gerakan sinusoidal membuat blob bergerak bolak-balik
            // sin(time * speed + phase) menghasilkan nilai -1 sampai 1
            // Kita map ke range 0.1 - 0.9 (agar tidak keluar layar)
            let bx = 0.5 + 0.4 * Math.sin(time * blob.speedX + blob.phaseX);
            let by = 0.5 + 0.4 * Math.cos(time * blob.speedY + blob.phaseY);

            // Blob pertama (index 0) = "mouse blob"
            // Blob ini tertarik ke posisi mouse (blend 40% mouse, 60% natural movement)
            if (i === 0) {
                bx = bx * 0.6 + smoothMouseX * 0.4;
                by = by * 0.6 + smoothMouseY * 0.4;
            }

            // Kirim posisi & radius blob ke shader
            gl.uniform2f(uBlobs[i], bx, by);
            gl.uniform1f(uRadii[i], blob.radius);
        }

        // ---- DRAW! ----
        // gl.TRIANGLE_STRIP + 4 vertices = persegi penuh layar
        // Fragment shader berjalan untuk setiap pixel di persegi ini
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Loop! Panggil render() lagi di frame berikutnya
        requestAnimationFrame(render);
    }

    // Mulai animasi!
    render();

})(); // IIFE: Immediately Invoked Function Expression — isolasi scope


// ============================================================
// BAGIAN 2: SCROLL ANIMATIONS (Intersection Observer)
// ============================================================
// 
// IntersectionObserver adalah API browser yang efisien untuk
// mendeteksi kapan sebuah elemen masuk/keluar viewport.
// Jauh lebih performant daripada mendengarkan scroll event!
//
// Cara kerja:
// 1. Buat observer dengan threshold 0.1 (trigger saat 10% elemen terlihat)
// 2. Observe semua elemen dengan class "animate-on-scroll"
// 3. Saat elemen masuk viewport → tambahkan class "visible"
// 4. CSS transition menghandle animasi fade-in + slide-up

(function () {
    'use strict';

    const observerOptions = {
        root: null,           // null = viewport
        rootMargin: '0px',    // Tidak ada margin tambahan
        threshold: 0.1        // Trigger saat 10% elemen terlihat
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                // Elemen masuk viewport → tambah class "visible" → trigger CSS animation
                entry.target.classList.add('visible');
                // Berhenti observe elemen ini (animasi hanya sekali)
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe semua elemen yang punya class "animate-on-scroll"
    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
        observer.observe(el);
    });
})();


// ============================================================
// BAGIAN 3: NAVBAR SCROLL EFFECT
// ============================================================
// Saat user scroll ke bawah, navbar mendapat background blur
// Ini menggunakan scroll event sederhana dengan threshold

(function () {
    'use strict';

    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }, { passive: true }); // passive: true untuk performa scroll yang lebih baik
})();


// ============================================================
// BAGIAN 4: COUNTER ANIMATION (Angka Menghitung Naik)
// ============================================================
// Angka statistik di hero section menghitung dari 0 ke target value
// Menggunakan easing function untuk efek "melambat di akhir"
//
// Cara kerja:
// 1. Ambil target value dari attribute data-count
// 2. Saat elemen muncul (visible), mulai animasi
// 3. Setiap frame, hitung progress dengan easing
// 4. Update text content dengan angka bulat

(function () {
    'use strict';

    /**
     * animateCounter: Menghitung angka dari 0 ke target
     * @param {HTMLElement} el - Element yang berisi angka
     * @param {number} target - Angka tujuan
     * @param {number} duration - Durasi animasi dalam ms
     */
    function animateCounter(el, target, duration) {
        const start = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - start;
            // progress: 0.0 → 1.0 selama durasi
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing: ease-out cubic — cepat di awal, melambat di akhir
            // Rumus: 1 - (1 - progress)³
            const eased = 1 - Math.pow(1 - progress, 3);
            
            // Update angka yang ditampilkan
            el.textContent = Math.round(eased * target);
            
            // Lanjut animasi jika belum selesai
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
    }

    // Observer untuk mendeteksi kapan stat-number masuk viewport
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-count'), 10);
                if (!isNaN(target)) {
                    animateCounter(entry.target, target, 2000); // 2 detik animasi
                }
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    // Observe semua elemen dengan class "stat-number"
    document.querySelectorAll('.stat-number').forEach((el) => {
        counterObserver.observe(el);
    });
})();


// ============================================================
// BAGIAN 5: SMOOTH SCROLL for NAV LINKS
// ============================================================
// Klik pada nav link → scroll halus ke section yang dituju
// Juga update class "active" pada nav link

(function () {
    'use strict';

    document.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
                
                // Update active state
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

    // Update active link berdasarkan scroll position
    const sections = document.querySelectorAll('section[id]');
    
    window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY + 150;
        
        sections.forEach((section) => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            
            if (scrollPos >= top && scrollPos < top + height) {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
                if (activeLink) activeLink.classList.add('active');
            }
        });
    }, { passive: true });
})();
