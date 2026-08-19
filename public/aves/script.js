// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', () => {
    
    /* ==========================================================================
       FAQ ACCORDION INTERACTIVITY
       ========================================================================== */
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const currentItem = question.parentElement;
            
            // Check if current item is already active
            const isActive = currentItem.classList.contains('active');
            
            // Close all other FAQ items
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Toggle active state for clicked item
            if (!isActive) {
                currentItem.classList.add('active');
            }
        });
    });

    /* ==========================================================================
       UPSELL POPUP LOGIC
       ========================================================================== */
    const btnComprarBasico = document.getElementById('btn-comprar-basico');
    const btnComprarCompleto = document.getElementById('btn-comprar-completo');
    
    const upsellModal = document.getElementById('upsell-modal');
    const btnCloseUpsell = document.getElementById('btn-close-upsell');
    const btnUpsellAccept = document.getElementById('btn-upsell-accept');
    const btnUpsellDecline = document.getElementById('btn-upsell-decline');

    // Open Upsell Modal on click of Basic Plan button
    if (btnComprarBasico) {
        btnComprarBasico.addEventListener('click', (e) => {
            e.preventDefault();
            upsellModal.classList.add('open');
            document.body.style.overflow = 'hidden'; // Stop background scrolling
        });
    }

    // Helper function to safely get item from localStorage
    function safeGetStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch(e) {
            return null;
        }
    }

    // Helper function to safely set item in localStorage
    function safeSetStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch(e) {}
    }

    // Helper function to append UTM parameters to checkout URLs
    function getCheckoutUrlWithUtms(baseUrl) {
        try {
            let queryString = window.location.search;
            
            // Fallback to localStorage if no parameters in URL
            if (!queryString || !queryString.includes('utm_')) {
                const utms = [];
                const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'];
                keys.forEach(key => {
                    const val = safeGetStorage(key) || safeGetStorage(`utmify_${key}`);
                    if (val) {
                        utms.push(`${key}=${encodeURIComponent(val)}`);
                    }
                });
                if (utms.length > 0) {
                    queryString = '?' + utms.join('&');
                }
            }
            
            if (!queryString) return baseUrl;
            const separator = baseUrl.includes('?') ? '&' : '?';
            const cleanParams = queryString.startsWith('?') ? queryString.substring(1) : queryString;
            return `${baseUrl}${separator}${cleanParams}`;
        } catch(err) {
            return baseUrl;
        }
    }

    function redirectToCheckout(url) {
        try {
            window.location.href = getCheckoutUrlWithUtms(url);
        } catch(e) {
            window.location.href = url;
        }
    }

    // Redirect to Complete Plan directly
    if (btnComprarCompleto) {
        btnComprarCompleto.addEventListener('click', (e) => {
            e.preventDefault();
            redirectToCheckout('https://www.tecnhogar.store/pay/47653c39-2e44-4b90-ab0f-b457df6a12a5');
        });
    }

    // Modal Action: Close
    const closeUpsell = () => {
        if (upsellModal) {
            upsellModal.classList.remove('open');
        }
        document.body.style.overflow = ''; // Restore background scrolling
    };

    if (btnCloseUpsell) btnCloseUpsell.addEventListener('click', closeUpsell);
    if (btnUpsellDecline) btnUpsellDecline.addEventListener('click', (e) => {
        e.preventDefault();
        closeUpsell();
        redirectToCheckout('https://www.tecnhogar.store/pay/2d2aa3ba-92d2-4790-9388-85bf5e42badb');
    });

    // Modal Action: Accept Upsell
    if (btnUpsellAccept) {
        btnUpsellAccept.addEventListener('click', (e) => {
            e.preventDefault();
            closeUpsell();
            redirectToCheckout('https://www.tecnhogar.store/pay/16877070-2ad6-4cee-a0ef-a01029f35e5d');
        });
    }

    // Close Modal on clicking outside the modal content
    window.addEventListener('click', (e) => {
        if (e.target === upsellModal) {
            closeUpsell();
        }
    });

    /* ==========================================================================
       LIGHTBOX / CASE DETAILS MODAL
       ========================================================================== */
    const lightboxModal = document.getElementById('lightbox-modal');
    const btnCloseLightbox = document.getElementById('btn-close-lightbox');

    // Global function to be called from inline onclick events
    window.openLightbox = (imgUrl) => {
        const fullImg = document.getElementById('lightbox-full-img');
        if (fullImg) {
            fullImg.src = imgUrl;
        }
        if (lightboxModal) {
            lightboxModal.classList.add('open');
        }
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        if (lightboxModal) {
            lightboxModal.classList.remove('open');
        }
        document.body.style.overflow = '';
    };

    if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closeLightbox);
    
    window.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
            closeLightbox();
        }
    });

    function simulateCheckout(planName, price) {
        // Log to console for debugging/verification
        console.log(`[Checkout Triggered] Plano: ${planName} | Preço: € ${price.toFixed(2)}`);

        // Show interactive notice to user
        const message = `✨ [Simulação de Checkout]\n\nEscolheste o "${planName}" por € ${price.toFixed(2)}.\n\nEm ambiente de produção, aqui o utilizador seria redirecionado para a plataforma de pagamento.`;
        alert(message);
    }

    /* ==========================================================================
       DYNAMIC COUNTDOWN TIMER (EVERGREEN & PERSISTENT)
       ========================================================================== */
    const hoursVal = document.getElementById('hours');
    const minutesVal = document.getElementById('minutes');
    const secondsVal = document.getElementById('seconds');

    const sHoursVal = document.getElementById('scarcity-hours');
    const sMinutesVal = document.getElementById('scarcity-minutes');
    const sSecondsVal = document.getElementById('scarcity-seconds');

    if ((hoursVal && minutesVal && secondsVal) || (sHoursVal && sMinutesVal && sSecondsVal)) {
        const timerDurationSeconds = (76 * 60) + 2; // 1h 16m 02s = 4562s
        
        let deadline = safeGetStorage('pricing_countdown_deadline');
        
        // If deadline is not set or is corrupted, set a new one
        if (!deadline || isNaN(parseInt(deadline))) {
            const newDeadline = new Date().getTime() + (timerDurationSeconds * 1000);
            safeSetStorage('pricing_countdown_deadline', newDeadline.toString());
            deadline = newDeadline;
        } else {
            deadline = parseInt(deadline);
        }

        function updateTimer() {
            try {
                const now = new Date().getTime();
                let remaining = deadline - now;

                // Reset deadline if it has expired
                if (remaining <= 0) {
                    const newDeadline = now + (timerDurationSeconds * 1000);
                    safeSetStorage('pricing_countdown_deadline', newDeadline.toString());
                    deadline = newDeadline;
                    remaining = timerDurationSeconds * 1000;
                }

                const totalSeconds = Math.floor(remaining / 1000);
                const hrs = Math.floor(totalSeconds / 3600);
                const mins = Math.floor((totalSeconds % 3600) / 60);
                const secs = totalSeconds % 60;

                const padHrs = hrs.toString().padStart(2, '0');
                const padMins = mins.toString().padStart(2, '0');
                const padSecs = secs.toString().padStart(2, '0');

                // Update main timer
                if (hoursVal) hoursVal.innerText = padHrs;
                if (minutesVal) minutesVal.innerText = padMins;
                if (secondsVal) secondsVal.innerText = padSecs;

                // Update sticky scarcity timer
                if (sHoursVal) sHoursVal.innerText = padHrs;
                if (sMinutesVal) sMinutesVal.innerText = padMins;
                if (sSecondsVal) sSecondsVal.innerText = padSecs;
            } catch(e) {}
        }

        // Run immediately once
        updateTimer();
        
        // Update timer every second
        setInterval(updateTimer, 1000);
    }

    /* ==========================================================================
       BACK REDIRECT & EXIT INTENT LOGIC
       ========================================================================== */
    const backRedirectUrl = '/aves/back/';

    function setupBackRedirect() {
        // Envia estado para o histórico para capturar ação de voltar
        history.pushState(null, document.title, location.href);
        
        window.addEventListener('popstate', () => {
            if (location.hash !== '') return;
            window.location.replace(backRedirectUrl + window.location.search);
        });
    }

    setTimeout(setupBackRedirect, 500);

    // Exit Intent no Desktop
    let exitTriggered = false;
    document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0 && !exitTriggered) {
            exitTriggered = true;
            window.location.href = backRedirectUrl + window.location.search;
        }
    });

    /* ==========================================================================
       PROTEÇÕES E SEGURANÇA DA PÁGINA (ANTI-CLONAGEM / ANTI-CÓPIA)
       ========================================================================== */
    
    // 1. Bloqueia Clique com Botão Direito
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // 2. Bloqueia atalhos de Inspecionar Elemento (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S)
    document.addEventListener('keydown', (e) => {
        // F12
        if (e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I ou Ctrl+Shift+J ou Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U (Ver código-fonte)
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            return false;
        }
        // Ctrl+S (Salvar página)
        if (e.ctrlKey && e.keyCode === 83) {
            e.preventDefault();
            return false;
        }
        // Ctrl+C / Ctrl+X (Impedir cópias por atalho se houver falhas no user-select)
        if (e.ctrlKey && (e.keyCode === 67 || e.keyCode === 88)) {
            e.preventDefault();
            return false;
        }
    });

    // 3. Proteção contra Print Screen (Escurecimento de Tela)
    const printShield = document.getElementById('print-shield-overlay');

    // Ao pressionar PrintScreen ou atalho de captura do Windows (Win+Shift+S)
    // Nota: O evento keyup pode capturar a tecla 'PrintScreen' (código 44)
    document.addEventListener('keyup', (e) => {
        if (e.keyCode === 44 || e.key === 'PrintScreen') {
            triggerScreenBlackout();
        }
    });

    // Função para escurecer a tela temporariamente
    function triggerScreenBlackout() {
        if (printShield) {
            printShield.style.display = 'block';
            // Tenta copiar aviso para a área de transferência (guardado: navigator.clipboard
            // não existe em alguns browsers in-app e rebentava aqui um erro de script).
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText("Aviso: Capturas de tela são bloqueadas nesta página.").catch(() => {});
            }
            
            setTimeout(() => {
                printShield.style.display = 'none';
            }, 2500);
        }
    }

    // NOTA: removido o blackout no evento 'blur'. No telemóvel (83% do tráfego, quase
    // tudo no browser interno do Facebook/Instagram) o foco perde-se constantemente
    // (vídeo, notificações, troca de app) e a página ficava PRETA — as pessoas pensavam
    // que estava partida e saíam. A proteção de PrintScreen (desktop) mantém-se abaixo.

    // 4. Medida anti-HTTrack / Clonadores offline
    // Se o site for aberto de um protocolo "file://" ou localhost com porta estranha que indique emulação offline, redireciona
    if (window.location.protocol === 'file:') {
        window.location.replace("https://youtu.be/McV2ZagvA_g?si=NTPdJHHGmj7UL9J8");
    }

    /* ==========================================================================
       CORREÇÃO DE ÂNCORAS (#planos etc.)
       As imagens de depoimentos usam loading="lazy" sem altura reservada; ao
       saltar para #planos o layout ainda cresce por cima e o utilizador acaba
       nos depoimentos. Rolamos e reajustamos depois de o layout assentar.
       ========================================================================== */
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
        const id = a.getAttribute('href').slice(1);
        if (!id) return;
        a.addEventListener('click', (e) => {
            const el = document.getElementById(id);
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Reajustes após imagens lazy acima do alvo carregarem e deslocarem o layout
            [250, 600, 1000].forEach((t) =>
                setTimeout(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }), t)
            );
        });
    });
});
