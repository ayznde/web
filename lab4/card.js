'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const categoryContainers = {
        'soup': document.getElementById('soups-container'),
        'main': document.getElementById('mains-container'),
        'drink': document.getElementById('drinks-container')
    };

    dishes.sort((a, b) => a.name.localeCompare(b.name));

    dishes.forEach(dish => {
        const container = categoryContainers[dish.category];
        if (container) {
            const dishElement = document.createElement('div');
            dishElement.classList.add('dish');
            dishElement.setAttribute('data-dish', dish.keyword);

            dishElement.innerHTML = `
                <img src="${dish.image}" alt="Изображение ${dish.name}">
                <p class="price">${dish.price}₽</p>
                <p class="title">${dish.name}</p>
                <p class="volume">${dish.count}</p>
                <button>Добавить</button>
            `;

            container.appendChild(dishElement);
        }
    });

    const order = {
        soup: null,
        main: null,
        drink: null
    };

    const updateOrderItem = function(category, dish, defaultText) {
        const span = document.getElementById(`order-item-${category}`);
        if (dish) {
            span.textContent = `${dish.name} ${dish.price}₽`;
        } else {
            span.textContent = defaultText;
        }
    };

    const updateOrderUI = function() {
        const hasOrder = order.soup || order.main || order.drink;
        
        const emptyDiv = document.getElementById('order-empty');
        const detailsDiv = document.getElementById('order-details');
        
        if (hasOrder) {
            emptyDiv.style.display = 'none';
            detailsDiv.style.display = 'block';
        } else {
            emptyDiv.style.display = 'block';
            detailsDiv.style.display = 'none';
        }

        updateOrderItem('soup', order.soup, 'Блюдо не выбрано');
        updateOrderItem('main', order.main, 'Блюдо не выбрано');
        updateOrderItem('drink', order.drink, 'Напиток не выбран');

        let total = 0;
        if (order.soup) total += order.soup.price;
        if (order.main) total += order.main.price;
        if (order.drink) total += order.drink.price;

        const totalSpan = document.getElementById('order-item-total');
        totalSpan.textContent = `${total}₽`;
    };

    document.querySelectorAll('.dish button').forEach(button => {
        button.addEventListener('click', (e) => {
            const dishElement = e.target.closest('.dish');
            const keyword = dishElement.getAttribute('data-dish');
            const selectedDish = dishes.find(d => d.keyword === keyword);

            if (selectedDish) {
                const category = selectedDish.category;
                const container = categoryContainers[category];
                const prev = container.querySelector('.dish.selected');
                if (prev) {
                    prev.classList.remove('selected');
                }

                dishElement.classList.add('selected');
                order[category] = selectedDish;
                updateOrderUI();
            }
        });
    });

    const form = document.querySelector('#order form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            if (order.soup) {
                formData.append('soup', order.soup.keyword);
            }
            if (order.main) {
                formData.append('main', order.main.keyword);
            }
            if (order.drink) {
                formData.append('drink', order.drink.keyword);
            }

            fetch(form.action, {
                method: 'POST',
                body: formData
            });
        });
    }
});
