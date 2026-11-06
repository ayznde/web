'use strict';

let dishes = [];

const API_URL = 'https://api.jsonbin.io/v3/b/6aedcbb4ffd5d16053abe958';
const API_KEY = '$2a$10$A4wgfUCg8vWJA4g/arktCu.oClqNS3eN2gjC2uWssGrcNDt46ZpTq';

async function loadDishes() {
    try {
        const response = await fetch(API_URL, {
            headers: {
                'X-Master-Key': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка загрузки данных: ${response.status}`);
        }

        const data = await response.json();
        dishes = Array.isArray(data) ? data : (data.record || []);
        dishes.sort((a, b) => a.name.localeCompare(b.name));
        return dishes;
    } catch (error) {
        console.error('Ошибка при получении блюд:', error);
        return [];
    }
}
