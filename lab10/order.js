'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const dishesGrid = document.getElementById('order-dishes-grid');
    const emptyMsg = document.getElementById('empty-order-message');
    const checkoutForm = document.getElementById('checkout-form');
    const submitBtn = document.getElementById('submit-btn');

    const sumEls = {
        soup: document.getElementById('summary-soup'),
        main: document.getElementById('summary-main'),
        salad: document.getElementById('summary-salad'),
        drink: document.getElementById('summary-drink'),
        dessert: document.getElementById('summary-dessert'),
        total: document.getElementById('summary-total')
    };

    const updateBackLinks = function(idsObj) {
        const json = encodeURIComponent(JSON.stringify(idsObj || {}));
        document.querySelectorAll('a[href^="make_order.html"]').forEach(a => {
            a.href = `make_order.html?order=${json}`;
        });
    };

    // ---- localStorage & URL read/write ----
    const readOrder = function() {
        // 1. Try URL parameters first (works with file:/// in Firefox)
        try {
            const params = new URLSearchParams(window.location.search);
            const u = params.get('order') || params.get('selectedDishes');
            if (u) {
                const parsed = JSON.parse(decodeURIComponent(u));
                console.log('[order.js] parsed from URL:', parsed);
                if (parsed && (Array.isArray(parsed)
                    ? parsed.length > 0
                    : Object.keys(parsed).length > 0)) {
                    try {
                        localStorage.setItem(
                            'selectedDishes',
                            JSON.stringify(parsed)
                        );
                    } catch {
                        // ignore
                    }
                    return parsed;
                }
            }
        } catch (e) {
            console.error('[order.js] URL parse error:', e);
        }

        // 2. Try localStorage candidate keys
        const candidateKeys = [
            'selectedDishes',
            'order',
            'cart',
            'lunchOrder'
        ];
        for (const key of candidateKeys) {
            try {
                const raw = localStorage.getItem(key);
                console.log('[order.js] localStorage', key, ':', raw);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (Array.isArray(parsed)
                        ? parsed.length > 0
                        : Object.keys(parsed).length > 0)) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.error('[order.js] parse error:', e);
            }
        }
        return {};
    };

    const writeOrder = function(obj) {
        localStorage.setItem('selectedDishes', JSON.stringify(obj));
        updateBackLinks(obj);
    };

    const clearOrder = function() {
        localStorage.removeItem('selectedDishes');
        localStorage.removeItem('order');
        localStorage.removeItem('cart');
        localStorage.removeItem('lunchOrder');
        try {
            window.history.replaceState({}, '', window.location.pathname);
        } catch {
            // ignore
        }
        updateBackLinks({});
    };

    let savedIds = readOrder();
    console.log('[order.js] savedIds:', savedIds);
    updateBackLinks(savedIds);

    const selected = {
        soup: null,
        main: null,
        salad: null,
        drink: null,
        dessert: null
    };

    // ---- helpers ----
    const showNotification = function(message) {
        const prev = document.querySelector('.notification');
        if (prev) {
            prev.remove();
        }
        const n = document.createElement('div');
        n.classList.add('notification');
        const p = document.createElement('p');
        p.textContent = message;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add('notification-btn');
        btn.textContent = 'Окей 👌';
        btn.addEventListener('click', () => n.remove());
        n.appendChild(p);
        n.appendChild(btn);
        document.body.appendChild(n);
    };

    const findDish = function(list, val) {
        if (val === undefined || val === null) {
            return null;
        }
        const s = typeof val === 'object'
            ? String(val.id || val.keyword || '')
            : String(val);
        return list.find(d =>
            (d.id !== undefined && String(d.id) === s)
            || (d.keyword && d.keyword === s)
        ) || null;
    };

    const updateSummary = function() {
        const labels = {
            soup: 'Не выбран',
            main: 'Не выбрано',
            salad: 'Не выбран',
            drink: 'Не выбран',
            dessert: 'Не выбран'
        };
        let total = 0;
        ['soup', 'main', 'salad', 'drink', 'dessert'].forEach(cat => {
            const d = selected[cat];
            if (sumEls[cat]) {
                sumEls[cat].textContent = d
                    ? `${d.name} ${d.price}₽`
                    : labels[cat];
            }
            if (d) {
                total += d.price;
            }
        });
        if (sumEls.total) {
            sumEls.total.textContent = `${total}₽`;
        }
    };

    const renderCards = function() {
        if (!dishesGrid) {
            return;
        }
        dishesGrid.innerHTML = '';
        const cats = ['soup', 'main', 'salad', 'drink', 'dessert'];
        const active = cats.filter(c => selected[c]);

        if (active.length === 0) {
            emptyMsg.style.display = 'block';
            dishesGrid.style.display = 'none';
            return;
        }

        emptyMsg.style.display = 'none';
        dishesGrid.style.display = 'grid';

        active.forEach(category => {
            const dish = selected[category];
            const card = document.createElement('div');
            card.classList.add('dish');

            card.innerHTML = `
                <img src="${dish.image}" alt="Изображение ${dish.name}">
                <p class="price">${dish.price}₽</p>
                <p class="title">${dish.name}</p>
                <p class="volume">${dish.count}</p>
                <button type="button">Удалить</button>
            `;

            card.querySelector('button').addEventListener('click', () => {
                selected[category] = null;
                delete savedIds[category];
                writeOrder(savedIds);
                card.remove();
                updateSummary();

                const rest = cats.filter(c => selected[c]);
                if (rest.length === 0) {
                    emptyMsg.style.display = 'block';
                    dishesGrid.style.display = 'none';
                }
            });

            dishesGrid.appendChild(card);
        });
    };

    const getOrderError = function() {
        const s = Boolean(selected.soup);
        const m = Boolean(selected.main);
        const sa = Boolean(selected.salad);
        const dr = Boolean(selected.drink);
        const de = Boolean(selected.dessert);

        if (!s && !m && !sa && !dr && !de) {
            return 'Ничего не выбрано. Выберите блюда для заказа';
        }

        const ok = (s && m && sa && dr)
            || (s && m && dr && !sa)
            || (s && sa && dr && !m)
            || (m && sa && dr && !s)
            || (m && dr && !s && !sa);
        if (ok) {
            return null;
        }

        if (s && !m && !sa) {
            return 'Выберите главное блюдо/салат/стартер';
        }
        if (sa && !s && !m) {
            return 'Выберите суп или главное блюдо';
        }
        if (!s && !m && !sa && (dr || de)) {
            return 'Выберите главное блюдо';
        }
        if (!dr) {
            return 'Выберите напиток';
        }
        return 'Выберите главное блюдо';
    };

    // ---- load dishes and match ----
    const allDishes = await loadDishes();
    console.log('[order.js] loaded dishes:', allDishes.length);

    if (Array.isArray(savedIds)) {
        savedIds.forEach(val => {
            const dish = findDish(allDishes, val);
            if (dish && dish.category) {
                selected[dish.category] = dish;
            }
        });
    } else if (savedIds && typeof savedIds === 'object') {
        const catMap = {
            soup: savedIds.soup || savedIds.soup_id,
            main: savedIds.main || savedIds.main_course_id,
            salad: savedIds.salad || savedIds.salad_id,
            drink: savedIds.drink || savedIds.drink_id,
            dessert: savedIds.dessert || savedIds.dessert_id
        };

        ['soup', 'main', 'salad', 'drink', 'dessert'].forEach(cat => {
            const val = catMap[cat];
            if (val !== undefined && val !== null) {
                const dish = findDish(allDishes, val);
                const nm = dish ? dish.name : 'NOT FOUND';
                console.log('[order.js] match', cat, val, '->', nm);
                if (dish) {
                    selected[cat] = dish;
                }
            }
        });
    }

    updateSummary();
    renderCards();

    // ---- delivery time toggle ----
    const dtRadios = document.querySelectorAll(
        'input[name="delivery_type"]'
    );
    const dtInput = document.getElementById('delivery_time');
    dtRadios.forEach(r => {
        r.addEventListener('change', () => {
            dtInput.required = r.value === 'by_time';
        });
    });

    // ---- submit ----
    if (submitBtn) {
        submitBtn.addEventListener('click', e => {
            const err = getOrderError();
            if (err) {
                e.preventDefault();
                showNotification(err);
            }
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async e => {
            e.preventDefault();

            const err = getOrderError();
            if (err) {
                showNotification(err);
                return;
            }

            const fd = new FormData(checkoutForm);
            const dt = fd.get('delivery_type');
            const dTime = fd.get('delivery_time');

            if (dt === 'by_time' && !dTime) {
                showNotification('Укажите время доставки');
                return;
            }

            const gf = function(cat) {
                const d = selected[cat];
                if (!d) {
                    return null;
                }
                return d.id !== undefined ? d.id : d.keyword;
            };

            const payload = {
                full_name: fd.get('full_name'),
                email: fd.get('email'),
                subscribe: fd.get('subscribe') ? 1 : 0,
                phone: fd.get('phone'),
                delivery_address: fd.get('delivery_address'),
                delivery_type: dt,
                delivery_time: dt === 'by_time' ? dTime : null,
                comment: fd.get('comment') || '',
                soup_id: gf('soup'),
                main_course_id: gf('main'),
                salad_id: gf('salad'),
                drink_id: gf('drink'),
                dessert_id: gf('dessert')
            };

            console.log('[order.js] sending payload:', payload);

            const JBIN = 'https://api.jsonbin.io/v3/b';
            let sent = false;
            let binId = null;

            try {
                const r = await fetch(JBIN, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': API_KEY
                    },
                    body: JSON.stringify(payload)
                });
                if (r.ok) {
                    sent = true;
                    const data = await r.json().catch(function() {
                        return null;
                    });
                    if (data && data.metadata && data.metadata.id) {
                        binId = data.metadata.id;
                    }
                }
            } catch (e) {
                console.warn('JSONbin POST failed:', e);
            }

            if (sent) {
                try {
                    const order = Object.assign({}, payload, {
                        id: binId || String(Date.now()),
                        created_at: new Date().toISOString()
                    });
                    const raw = localStorage.getItem('orders_cache');
                    const cached = JSON.parse(raw || '[]');
                    cached.unshift(order);
                    localStorage.setItem(
                        'orders_cache',
                        JSON.stringify(cached)
                    );
                    if (binId) {
                        const rawBins = localStorage.getItem('order_bin_ids');
                        const binsArr = JSON.parse(rawBins || '[]');
                        if (!binsArr.includes(binId)) {
                            binsArr.unshift(binId);
                            localStorage.setItem(
                                'order_bin_ids',
                                JSON.stringify(binsArr)
                            );
                        }
                    }
                } catch (e) {
                    console.error('Failed to update orders_cache:', e);
                }

                clearOrder();
                showNotification('Заказ успешно оформлен!');
                ['soup', 'main', 'salad', 'drink', 'dessert'].forEach(c => {
                    selected[c] = null;
                });
                savedIds = {};
                updateSummary();
                renderCards();
                checkoutForm.reset();
            } else {
                showNotification(
                    'Произошла ошибка при отправке заказа. Попробуйте еще раз.'
                );
            }
        });
    }
});
