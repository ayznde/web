'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const categoryContainers = {
        soup: document.getElementById('soups-container'),
        main: document.getElementById('mains-container'),
        salad: document.getElementById('salads-container'),
        drink: document.getElementById('drinks-container'),
        dessert: document.getElementById('desserts-container')
    };

    const stickyBar = document.getElementById('sticky-order-bar');
    const stickyTotal = document.getElementById('order-bar-total');
    const stickyLink = document.getElementById('order-bar-link');

    const showNotification = function(message) {
        const prev = document.querySelector('.notification');
        if (prev) {
            prev.remove();
        }

        const notification = document.createElement('div');
        notification.classList.add('notification');

        const messageP = document.createElement('p');
        messageP.textContent = message;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add('notification-btn');
        btn.textContent = 'Окей 👌';

        btn.addEventListener('click', () => {
            notification.remove();
        });

        notification.appendChild(messageP);
        notification.appendChild(btn);
        document.body.appendChild(notification);
    };

    const getSavedOrderIds = function() {
        try {
            const params = new URLSearchParams(window.location.search);
            const u = params.get('order') || params.get('selectedDishes');
            if (u) {
                const p = JSON.parse(decodeURIComponent(u));
                if (p && (Array.isArray(p)
                    ? p.length > 0
                    : Object.keys(p).length > 0)) {
                    return p;
                }
            }
        } catch {
            // ignore
        }

        const candidateKeys = [
            'selectedDishes',
            'order',
            'cart',
            'lunchOrder'
        ];
        for (const key of candidateKeys) {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (Array.isArray(parsed)
                        ? parsed.length > 0
                        : Object.keys(parsed).length > 0)) {
                        return parsed;
                    }
                }
            } catch {
                // ignore json error
            }
        }
        return {};
    };

    const saveOrderIds = function(idsObj) {
        localStorage.setItem('selectedDishes', JSON.stringify(idsObj));
    };

    const rawSaved = getSavedOrderIds();
    const orderIds = {};
    const order = {
        soup: null,
        main: null,
        salad: null,
        drink: null,
        dessert: null
    };

    const isMatch = function(dish, savedVal) {
        if (savedVal === undefined || savedVal === null) {
            return false;
        }
        const valStr = typeof savedVal === 'object'
            ? String(savedVal.id || savedVal.keyword || '')
            : String(savedVal);
        const matchId = dish.id !== undefined && String(dish.id) === valStr;
        const matchKw = dish.keyword && String(dish.keyword) === valStr;
        return matchId || matchKw;
    };

    const isValidCombo = function() {
        const hasSoup = Boolean(order.soup);
        const hasMain = Boolean(order.main);
        const hasSalad = Boolean(order.salad);
        const hasDrink = Boolean(order.drink);

        const isCombo1 = hasSoup && hasMain && hasSalad && hasDrink;
        const isCombo2 = hasSoup && hasMain && hasDrink && !hasSalad;
        const isCombo3 = hasSoup && hasSalad && hasDrink && !hasMain;
        const isCombo4 = hasMain && hasSalad && hasDrink && !hasSoup;
        const isCombo5 = hasMain && hasDrink && !hasSoup && !hasSalad;

        return isCombo1 || isCombo2 || isCombo3 || isCombo4 || isCombo5;
    };

    const getOrderError = function() {
        const hasSoup = Boolean(order.soup);
        const hasMain = Boolean(order.main);
        const hasSalad = Boolean(order.salad);
        const hasDrink = Boolean(order.drink);
        const hasDessert = Boolean(order.dessert);

        if (!hasSoup && !hasMain && !hasSalad && !hasDrink && !hasDessert) {
            return 'Ничего не выбрано. Выберите блюда для заказа';
        }

        if (isValidCombo()) {
            return null;
        }

        if (hasSoup && !hasMain && !hasSalad) {
            return 'Выберите главное блюдо/салат/стартер';
        }

        if (hasSalad && !hasSoup && !hasMain) {
            return 'Выберите суп или главное блюдо';
        }

        if (!hasSoup && !hasMain && !hasSalad && (hasDrink || hasDessert)) {
            return 'Выберите главное блюдо';
        }

        if (!hasDrink) {
            return 'Выберите напиток';
        }

        return 'Выберите главное блюдо';
    };

    const updateStickyBar = function() {
        if (!stickyBar) {
            return;
        }

        const hasAnyDish = Boolean(
            order.soup || order.main || order.salad
            || order.drink || order.dessert
        );

        if (!hasAnyDish) {
            stickyBar.classList.add('hidden');
        } else {
            stickyBar.classList.remove('hidden');
        }

        let total = 0;
        ['soup', 'main', 'salad', 'drink', 'dessert'].forEach(cat => {
            if (order[cat]) {
                total += order[cat].price;
            }
        });

        if (stickyTotal) {
            stickyTotal.textContent = `${total}₽`;
        }

        const orderJson = encodeURIComponent(JSON.stringify(orderIds));
        const targetHref = `order.html?order=${orderJson}`;

        if (stickyLink) {
            stickyLink.href = targetHref;
            if (isValidCombo()) {
                stickyLink.classList.remove('disabled');
            } else {
                stickyLink.classList.add('disabled');
            }
        }

        document.querySelectorAll('a[href^="order.html"]').forEach(a => {
            a.href = targetHref;
        });
    };

    if (stickyLink) {
        stickyLink.addEventListener('click', e => {
            const err = getOrderError();
            if (err) {
                e.preventDefault();
                showNotification(err);
            }
        });
    }

    const selectDish = function(dish, dishElement) {
        const category = dish.category;
        const catContainer = categoryContainers[category];
        if (catContainer) {
            const prev = catContainer.querySelector('.dish.selected');
            if (prev) {
                prev.classList.remove('selected');
            }
        }

        dishElement.classList.add('selected');
        order[category] = dish;
        const dishId = dish.id !== undefined ? dish.id : dish.keyword;
        orderIds[category] = dishId;
        saveOrderIds(orderIds);
        updateStickyBar();
    };

    const renderDishes = function(dishesToRender) {
        dishesToRender.forEach(dish => {
            const container = categoryContainers[dish.category];
            if (container) {
                const dishId = dish.id !== undefined
                    ? dish.id : dish.keyword;
                const dishElement = document.createElement('div');
                dishElement.classList.add('dish');
                dishElement.setAttribute('data-dish', dishId);
                dishElement.setAttribute('data-kind', dish.kind);

                let isSaved = false;
                if (Array.isArray(rawSaved)) {
                    isSaved = rawSaved.some(item => isMatch(dish, item));
                } else if (rawSaved && typeof rawSaved === 'object') {
                    const catVal = rawSaved[dish.category]
                        || rawSaved[`${dish.category}_id`];
                    isSaved = isMatch(dish, catVal);
                }

                if (isSaved) {
                    dishElement.classList.add('selected');
                    order[dish.category] = dish;
                    orderIds[dish.category] = dishId;
                }

                dishElement.innerHTML = `
                    <img src="${dish.image}" alt="Изображение ${dish.name}">
                    <p class="price">${dish.price}₽</p>
                    <p class="title">${dish.name}</p>
                    <p class="volume">${dish.count}</p>
                    <button type="button">Добавить</button>
                `;

                const button = dishElement.querySelector('button');
                button.addEventListener('click', e => {
                    e.stopPropagation();
                    selectDish(dish, dishElement);
                });

                dishElement.addEventListener('click', () => {
                    selectDish(dish, dishElement);
                });

                container.appendChild(dishElement);
            }
        });

        if (Object.keys(orderIds).length > 0) {
            saveOrderIds(orderIds);
        }
        updateStickyBar();
    };

    await loadDishes();
    renderDishes(dishes);

    document.querySelectorAll('.filters').forEach(filterBlock => {
        const section = filterBlock.closest('section');
        const container = section.querySelector('.dishes');
        if (!container) {
            return;
        }

        filterBlock.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', () => {
                const isAlreadyActive = button.classList.contains('active');

                filterBlock.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });

                const dishesInContainer = container.querySelectorAll('.dish');

                if (isAlreadyActive) {
                    dishesInContainer.forEach(dishEl => {
                        dishEl.style.display = '';
                    });
                } else {
                    button.classList.add('active');
                    const targetKind = button.getAttribute('data-kind');

                    dishesInContainer.forEach(dishEl => {
                        const kind = dishEl.getAttribute('data-kind');
                        if (kind === targetKind) {
                            dishEl.style.display = '';
                        } else {
                            dishEl.style.display = 'none';
                        }
                    });
                }
            });
        });
    });
});
