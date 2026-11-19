'use strict';

document.addEventListener('DOMContentLoaded', async function() {
    const JBIN = 'https://api.jsonbin.io/v3/b';
    const DISHES_BIN = '6aedcbb4ffd5d16053abe958';
    const KNOWN_BINS = [
        '6afda9d6ffd5d16053cb719a',
        '6afda8ecac6210605a91b8d8',
        '6af39eb7ac6210605a7e39ea',
        '6af39799ac6210605a7e2f26'
    ];

    const tableBody = document.getElementById('orders-table-body');
    const noMsg = document.getElementById('no-orders-msg');
    const notifEl = document.getElementById('notification-container');

    const viewModal = document.getElementById('view-order-modal');
    const viewContent = document.getElementById('view-modal-content');
    const viewClose = document.getElementById('view-modal-close-btn');
    const viewOk = document.getElementById('view-modal-ok-btn');

    const editModal = document.getElementById('edit-order-modal');
    const editContent = document.getElementById('edit-modal-content');
    const editClose = document.getElementById('edit-modal-close-btn');
    const editCancel = document.getElementById('edit-modal-cancel-btn');
    const editForm = document.getElementById('edit-order-form');

    const delModal = document.getElementById('delete-order-modal');
    const delClose = document.getElementById('delete-modal-close-btn');
    const delCancel = document.getElementById('delete-modal-cancel-btn');
    const delConfirm = document.getElementById('delete-modal-confirm-btn');

    let orders = [];
    let activeId = null;
    let allDishes = [];

    // Clean up any fake stubs from localStorage
    try {
        const rawCache = localStorage.getItem('orders_cache');
        if (rawCache && rawCache.includes('Иванов Иван Иванович')) {
            localStorage.removeItem('orders_cache');
        }
    } catch (e) {
        console.error('clean error:', e);
    }

    try {
        allDishes = await loadDishes();
    } catch (e) {
        console.error('dishes load error:', e);
    }

    // ---- helpers ----

    function esc(s) {
        if (s === null || s === undefined) {
            return '';
        }
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function findDish(id) {
        if (!id) {
            return null;
        }
        return allDishes.find(function(d) {
            return String(d.id) === String(id) || d.keyword === id;
        }) || null;
    }

    function fmtDate(str) {
        if (!str) {
            return '';
        }
        const d = new Date(str);
        if (isNaN(d.getTime())) {
            return str;
        }
        const p = function(n) {
            return String(n).padStart(2, '0');
        };
        return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' +
            d.getFullYear() + ' ' + p(d.getHours()) + ':' +
            p(d.getMinutes());
    }

    function fmtDelivery(o) {
        if (o.delivery_type === 'by_time' && o.delivery_time) {
            const p = String(o.delivery_time).split(':');
            return p[0].padStart(2, '0') + ':' + p[1].padStart(2, '0');
        }
        return 'Как можно скорее (с 7:00 до 23:00)';
    }

    function dishInfo(o) {
        const cats = [
            { key: 'soup_id', label: 'Суп' },
            { key: 'main_course_id', label: 'Основное блюдо' },
            { key: 'salad_id', label: 'Салат' },
            { key: 'drink_id', label: 'Напиток' },
            { key: 'dessert_id', label: 'Десерт' }
        ];
        const list = [];
        let total = 0;
        cats.forEach(function(c) {
            const d = findDish(o[c.key]);
            if (d) {
                list.push({ label: c.label, name: d.name, price: d.price });
                total += d.price;
            }
        });
        return { list: list, total: total };
    }

    function saveCache() {
        try {
            localStorage.setItem('orders_cache', JSON.stringify(orders));
        } catch (e) {
            console.error('cache save error:', e);
        }
    }

    function loadCache() {
        try {
            const raw = localStorage.getItem('orders_cache');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.filter(function(x) {
                        return x && x.full_name !== 'Иванов Иван Иванович';
                    });
                }
            }
        } catch (e) {
            console.error('cache load error:', e);
        }
        return [];
    }

    function showNotif(msg, isErr) {
        if (!notifEl) {
            return;
        }
        const cls = 'notification-toast' + (isErr ? ' error' : '');
        const t = document.createElement('div');
        t.className = cls;
        t.innerHTML = '<p>' + esc(msg) + '</p>' +
            '<button type="button" class="toast-close">' +
            '&times;</button>';
        const rm = function() {
            t.remove();
        };
        t.querySelector('.toast-close').addEventListener('click', rm);
        notifEl.appendChild(t);
        setTimeout(rm, 5000);
    }

    // ---- modals ----

    function openModal(m) {
        if (m) {
            m.classList.remove('hidden');
        }
    }

    function closeModal(m) {
        if (m) {
            m.classList.add('hidden');
        }
        activeId = null;
    }

    [viewModal, editModal, delModal].forEach(function(m) {
        if (!m) {
            return;
        }
        m.addEventListener('click', function(e) {
            if (e.target === m) {
                closeModal(m);
            }
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal(viewModal);
            closeModal(editModal);
            closeModal(delModal);
        }
    });

    if (viewClose) {
        viewClose.addEventListener('click', function() {
            closeModal(viewModal);
        });
    }
    if (viewOk) {
        viewOk.addEventListener('click', function() {
            closeModal(viewModal);
        });
    }
    if (editClose) {
        editClose.addEventListener('click', function() {
            closeModal(editModal);
        });
    }
    if (editCancel) {
        editCancel.addEventListener('click', function() {
            closeModal(editModal);
        });
    }
    if (delClose) {
        delClose.addEventListener('click', function() {
            closeModal(delModal);
        });
    }
    if (delCancel) {
        delCancel.addEventListener('click', function() {
            closeModal(delModal);
        });
    }

    // ---- render table ----

    function renderTable() {
        if (!tableBody) {
            return;
        }
        tableBody.innerHTML = '';

        orders.sort(function(a, b) {
            return new Date(b.created_at || 0) -
                new Date(a.created_at || 0);
        });

        if (orders.length === 0) {
            if (noMsg) {
                noMsg.classList.remove('hidden');
            }
            return;
        }
        if (noMsg) {
            noMsg.classList.add('hidden');
        }

        const EYE = '<svg width="18" height="18" viewBox="0 0 16 16" ' +
            'fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8' +
            's3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4' +
            '.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0' +
            ' 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 ' +
            '1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.16' +
            '8-2.457A13 13 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0' +
            ' 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 ' +
            '3.5 0 0 1-7 0"/></svg>';

        const PEN = '<svg width="18" height="18" viewBox="0 0 16 16" ' +
            'fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708' +
            ' 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2' +
            'a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5' +
            ' 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4' +
            ' 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h' +
            '.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-' +
            '.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.' +
            '5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.034z"/></svg>';

        const BIN = '<svg width="18" height="18" viewBox="0 0 16 16" ' +
            'fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.' +
            '5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v' +
            '6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0' +
            'v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v' +
            '9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1' +
            ' 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 ' +
            '0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1' +
            '-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>';

        orders.forEach(function(o, i) {
            const info = dishInfo(o);
            const names = info.list.map(function(x) {
                return x.name;
            }).join(', ') || '—';

            const tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="col-num">' + (i + 1) + '</td>' +
                '<td class="col-date">' + esc(fmtDate(o.created_at)) +
                '</td>' +
                '<td class="col-composition">' + esc(names) + '</td>' +
                '<td class="col-price">' + info.total + '&#8381;</td>' +
                '<td class="col-delivery">' +
                esc(fmtDelivery(o)) + '</td>' +
                '<td class="col-actions">' +
                '<button type="button" class="action-btn" ' +
                'title="Подробнее" data-action="view" ' +
                'data-id="' + esc(o.id) + '">' + EYE + '</button>' +
                '<button type="button" class="action-btn" ' +
                'title="Редактирование" data-action="edit" ' +
                'data-id="' + esc(o.id) + '">' + PEN + '</button>' +
                '<button type="button" class="action-btn" ' +
                'title="Удаление" data-action="delete" ' +
                'data-id="' + esc(o.id) + '">' + BIN + '</button>' +
                '</td>';
            tableBody.appendChild(tr);
        });
    }

    // ---- view modal ----

    function openView(o) {
        const info = dishInfo(o);
        const dHtml = info.list.map(function(x) {
            return '<div class="modal-dish-item">' +
                '<span class="dish-cat">' + esc(x.label) + '</span>' +
                '<span class="dish-desc">' + esc(x.name) +
                ' (' + x.price + '&#8381;)</span></div>';
        }).join('') ||
            '<p class="empty-dishes-text">Блюда не выбраны</p>';

        viewContent.innerHTML =
            '<div class="modal-row"><span class="label">' +
            'Дата оформления</span>' +
            '<span class="value">' + esc(fmtDate(o.created_at)) +
            '</span></div>' +
            '<div class="modal-section-title">Доставка</div>' +
            '<div class="modal-row"><span class="label">Имя получателя' +
            '</span><span class="value">' +
            esc(o.full_name || '') + '</span></div>' +
            '<div class="modal-row"><span class="label">Адрес доставки' +
            '</span><span class="value">' +
            esc(o.delivery_address || '') + '</span></div>' +
            '<div class="modal-row"><span class="label">Время доставки' +
            '</span><span class="value">' +
            esc(fmtDelivery(o)) + '</span></div>' +
            '<div class="modal-row"><span class="label">Телефон</span>' +
            '<span class="value">' + esc(o.phone || '') +
            '</span></div>' +
            '<div class="modal-row"><span class="label">Email</span>' +
            '<span class="value">' + esc(o.email || '') +
            '</span></div>' +
            '<div class="modal-section-title">Комментарий</div>' +
            '<div class="comment-text">' +
            esc(o.comment || 'Нет комментариев') + '</div>' +
            '<div class="modal-section-title">Состав заказа</div>' +
            '<div class="modal-dishes">' + dHtml + '</div>' +
            '<div class="modal-total">Стоимость: ' +
            info.total + '&#8381;</div>';
        openModal(viewModal);
    }

    // ---- edit modal ----

    function openEdit(o) {
        activeId = o.id;
        const info = dishInfo(o);
        const dHtml = info.list.map(function(x) {
            return '<div class="modal-dish-item">' +
                '<span class="dish-cat">' + esc(x.label) + '</span>' +
                '<span class="dish-desc">' + esc(x.name) +
                ' (' + x.price + '&#8381;)</span></div>';
        }).join('') ||
            '<p class="empty-dishes-text">Блюда не выбраны</p>';

        const byTime = o.delivery_type === 'by_time';
        let t = o.delivery_time || '';
        if (t.length > 5) {
            t = t.substring(0, 5);
        }

        editContent.innerHTML =
            '<div class="modal-row"><span class="label">' +
            'Дата оформления</span>' +
            '<span class="value">' + esc(fmtDate(o.created_at)) +
            '</span></div>' +
            '<div class="modal-section-title">Доставка</div>' +
            '<div class="form-row">' +
            '<label for="e_name">Имя получателя</label>' +
            '<input type="text" id="e_name" name="full_name" ' +
            'value="' + esc(o.full_name || '') + '" required>' +
            '</div>' +
            '<div class="form-row">' +
            '<label for="e_addr">Адрес доставки</label>' +
            '<input type="text" id="e_addr" name="delivery_address" ' +
            'value="' + esc(o.delivery_address || '') + '" required>' +
            '</div>' +
            '<div class="form-row"><label>Тип доставки</label>' +
            '<div class="radio-options">' +
            '<label class="radio-option">' +
            '<input type="radio" name="delivery_type" value="now" ' +
            (byTime ? '' : 'checked') + '> Как можно скорее</label>' +
            '<label class="radio-option">' +
            '<input type="radio" name="delivery_type" value="by_time" ' +
            (byTime ? 'checked' : '') + '> Ко времени</label>' +
            '</div></div>' +
            '<div class="form-row">' +
            '<label for="e_time">Время доставки</label>' +
            '<input type="time" id="e_time" name="delivery_time" ' +
            'min="07:00" max="23:00" step="300" value="' + esc(t) +
            '" ' + (byTime ? 'required' : '') + '>' +
            '</div>' +
            '<div class="form-row">' +
            '<label for="e_phone">Телефон</label>' +
            '<input type="tel" id="e_phone" name="phone" value="' +
            esc(o.phone || '') + '" required>' +
            '</div>' +
            '<div class="form-row">' +
            '<label for="e_email">Email</label>' +
            '<input type="email" id="e_email" name="email" value="' +
            esc(o.email || '') + '" required>' +
            '</div>' +
            '<div class="modal-section-title">Комментарий</div>' +
            '<div><textarea id="e_comment" name="comment" rows="2">' +
            esc(o.comment || '') + '</textarea></div>' +
            '<div class="modal-section-title">Состав заказа</div>' +
            '<div class="modal-dishes">' + dHtml + '</div>' +
            '<div class="modal-total">Стоимость: ' +
            info.total + '&#8381;</div>';

        const radios = editContent.querySelectorAll(
            'input[name="delivery_type"]'
        );
        const tInp = editContent.querySelector('#e_time');
        radios.forEach(function(r) {
            r.addEventListener('change', function() {
                tInp.required = r.value === 'by_time';
            });
        });

        openModal(editModal);
    }

    // ---- table click handler ----

    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            const btn = e.target.closest('.action-btn');
            if (!btn) {
                return;
            }
            const id = btn.dataset.id;
            const o = orders.find(function(x) {
                return String(x.id) === String(id);
            });
            if (!o) {
                return;
            }
            const act = btn.dataset.action;
            if (act === 'view') {
                openView(o);
            } else if (act === 'edit') {
                openEdit(o);
            } else if (act === 'delete') {
                activeId = o.id;
                openModal(delModal);
            }
        });
    }

    // ---- edit submit ----

    if (editForm) {
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!activeId) {
                return;
            }

            const fd = new FormData(editForm);
            const dt = fd.get('delivery_type');
            const dTime = fd.get('delivery_time');

            if (dt === 'by_time' && !dTime) {
                showNotif('Укажите время доставки', true);
                return;
            }

            const idx = orders.findIndex(function(x) {
                return String(x.id) === String(activeId);
            });
            if (idx === -1) {
                return;
            }

            const updated = Object.assign({}, orders[idx], {
                full_name: fd.get('full_name'),
                email: fd.get('email'),
                phone: fd.get('phone'),
                delivery_address: fd.get('delivery_address'),
                delivery_type: dt,
                delivery_time: dt === 'by_time' ? dTime : null,
                comment: fd.get('comment') || ''
            });

            try {
                const r = await fetch(JBIN + '/' + activeId, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': API_KEY
                    },
                    body: JSON.stringify(updated)
                });
                if (!r.ok) {
                    showNotif('Ошибка при сохранении заказа', true);
                    return;
                }
            } catch (err) {
                showNotif('Ошибка при сохранении заказа', true);
                return;
            }

            orders[idx] = updated;
            saveCache();
            closeModal(editModal);
            showNotif('Заказ успешно изменён');
            renderTable();
        });
    }

    // ---- delete confirm ----

    if (delConfirm) {
        delConfirm.addEventListener('click', async function() {
            if (!activeId) {
                return;
            }

            try {
                const r = await fetch(JBIN + '/' + activeId, {
                    method: 'DELETE',
                    headers: {
                        'X-Master-Key': API_KEY
                    }
                });
                if (!r.ok) {
                    showNotif('Ошибка при удалении заказа', true);
                    return;
                }
            } catch (err) {
                showNotif('Ошибка при удалении заказа', true);
                return;
            }

            orders = orders.filter(function(x) {
                return String(x.id) !== String(activeId);
            });
            saveCache();

            try {
                const rawBins = localStorage.getItem('order_bin_ids');
                const binsArr = JSON.parse(rawBins || '[]');
                const filtered = binsArr.filter(function(b) {
                    return String(b) !== String(activeId);
                });
                localStorage.setItem(
                    'order_bin_ids',
                    JSON.stringify(filtered)
                );
            } catch (e) {
                console.error('bin id remove error:', e);
            }

            closeModal(delModal);
            showNotif('Заказ успешно удалён');
            renderTable();
        });
    }

    // ---- fetch from JSONbin ----

    async function fetchBin(binId) {
        try {
            const r = await fetch(JBIN + '/' + binId + '/latest', {
                headers: {
                    'X-Master-Key': API_KEY
                }
            });
            if (!r.ok) {
                return null;
            }
            const data = await r.json();
            const rec = data.record || {};
            const meta = data.metadata || {};
            if (rec && (rec.full_name || rec.phone || rec.delivery_address)) {
                return Object.assign({}, rec, {
                    id: meta.id || binId,
                    created_at: meta.createdAt || rec.created_at ||
                        new Date().toISOString()
                });
            }
            return null;
        } catch (e) {
            console.error('fetchBin ' + binId + ' failed:', e);
            return null;
        }
    }

    async function getAllBinIds() {
        const binSet = {};
        KNOWN_BINS.forEach(function(b) {
            binSet[b] = true;
        });

        try {
            const raw = localStorage.getItem('order_bin_ids');
            const arr = JSON.parse(raw || '[]');
            if (Array.isArray(arr)) {
                arr.forEach(function(b) {
                    if (b) {
                        binSet[String(b)] = true;
                    }
                });
            }
        } catch (e) {
            console.error('cache binIds error:', e);
        }

        try {
            const uncUrl = 'https://api.jsonbin.io/v3/c/uncategorized/bins';
            const r = await fetch(uncUrl, {
                headers: {
                    'X-Master-Key': API_KEY
                }
            });
            if (r.ok) {
                const list = await r.json();
                if (Array.isArray(list)) {
                    list.forEach(function(it) {
                        const bid = it.record ||
                            (it.metadata && it.metadata.id) || it.id;
                        if (bid && bid !== DISHES_BIN) {
                            binSet[String(bid)] = true;
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('uncategorized bins fetch failed:', e);
        }

        delete binSet[DISHES_BIN];
        return Object.keys(binSet);
    }

    function delay(ms) {
        return new Promise(function(resolve) {
            setTimeout(resolve, ms);
        });
    }

    async function loadOrders() {
        // Render already cached orders first
        orders = loadCache();
        renderTable();

        const ids = await getAllBinIds();

        // Only fetch bins that are not yet in local cache
        const missingIds = ids.filter(function(id) {
            return !orders.some(function(o) {
                return String(o.id) === String(id);
            });
        });

        if (missingIds.length === 0) {
            return;
        }

        // Fetch missing bins sequentially with delay to avoid HTTP 429
        for (let i = 0; i < missingIds.length; i++) {
            const id = missingIds[i];
            const ord = await fetchBin(id);
            if (ord) {
                const exists = orders.some(function(o) {
                    return String(o.id) === String(ord.id);
                });
                if (!exists) {
                    orders.push(ord);
                    saveCache();
                    renderTable();
                }
            }
            if (i < missingIds.length - 1) {
                await delay(150);
            }
        }
    }

    await loadOrders();
});
