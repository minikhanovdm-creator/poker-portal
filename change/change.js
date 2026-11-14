const $ = id => document.getElementById(id);

// Номиналы фишек (от большего к меньшему — для жадного алгоритма)
const DENOMINATIONS = [100000, 25000, 5000, 1000, 500];

// Цвета фишек (как в реальном казино)
const CHIP_COLORS = {
    100000: { bg: '#2c2c2c', border: '#FFD700', text: '#FFD700' }, // чёрная с золотом
    25000:  { bg: '#1e8449', border: '#fff', text: '#fff' },       // зелёная
    5000:   { bg: '#d35400', border: '#fff', text: '#fff' },       // оранжевая
    1000:   { bg: '#f4f6f7', border: '#2980b9', text: '#2980b9' }, // белая с синим
    500:    { bg: '#c0392b', border: '#fff', text: '#fff' }        // красная
};

let active = false, waiting = false;
let total = 0, ok = 0, bad = 0;
let cardSec = 10;
let handTimer = null, tickTimer = null, nextTimer = null, endAt = 0;

let currentBet = 0;
let currentChip = 0;
let correctChange = {};  // {100000: 0, 25000: 1, ...}

// ---------- Инициализация полей ввода ----------
function initInputs() {
    const box = $('changeInputs');
    box.innerHTML = '';
    DENOMINATIONS.forEach((d, i) => {
        const c = CHIP_COLORS[d];
        const wrap = document.createElement('div');
        wrap.className = 'chip-input-wrap';
        wrap.innerHTML = `
            <div class="chip mini" style="background:${c.bg};border-color:${c.border};color:${c.text}">
                ${formatNum(d)}
            </div>
            <div class="chip-controls">
                <button class="chip-btn" data-denom="${d}" data-delta="-1">−</button>
                <input type="number" class="chip-count" id="cnt_${d}" value="0" min="0" max="99" data-idx="${i}">
                <button class="chip-btn" data-denom="${d}" data-delta="1">+</button>
            </div>
        `;
        box.appendChild(wrap);
    });

    // Обработчики + / −
    box.querySelectorAll('.chip-btn').forEach(btn => {
        btn.onclick = () => {
            if (!waiting) return;
            const d = parseInt(btn.dataset.denom);
            const delta = parseInt(btn.dataset.delta);
            const inp = $(`cnt_${d}`);
            let v = parseInt(inp.value) || 0;
            v = Math.max(0, v + delta);
            inp.value = v;
        };
    });
}

// ---------- Генерация задачи ----------
function generateTask() {
    // Случайная ставка (кратная 500, от 500 до 200000)
    const maxBet = 200000;
    currentBet = (Math.floor(Math.random() * (maxBet / 500)) + 1) * 500;

    // Фишка игрока — должна быть ≥ ставки
    // Выбираем номинал, который гарантированно покрывает ставку
    const suitable = DENOMINATIONS.filter(d => d >= currentBet);
    // Иногда даём фишку больше, чем нужно (чтобы была сдача)
    currentChip = suitable[Math.floor(Math.random() * suitable.length)];

    // Если фишка = ставке, сдачи нет — перегенерируем
    if (currentChip === currentBet) {
        // Берём следующий больший номинал
        const idx = DENOMINATIONS.indexOf(currentChip);
        if (idx > 0) currentChip = DENOMINATIONS[idx - 1];
        else {
            // Ставка слишком большая, уменьшаем её
            currentBet = currentChip - 500;
        }
    }

    // Считаем оптимальную сдачу (жадный алгоритм)
    let change = currentChip - currentBet;
    correctChange = {};
    DENOMINATIONS.forEach(d => correctChange[d] = 0);
    for (const d of DENOMINATIONS) {
        while (change >= d) {
            correctChange[d]++;
            change -= d;
        }
    }

    // Отображаем
    $('betAmount').textContent = formatNum(currentBet);
    const chipEl = $('playerChip');
    const c = CHIP_COLORS[currentChip];
    chipEl.textContent = formatNum(currentChip);
    chipEl.style.background = c.bg;
    chipEl.style.borderColor = c.border;
    chipEl.style.color = c.text;

    // Сбрасываем поля ввода
    DENOMINATIONS.forEach(d => $(`cnt_${d}`).value = 0);
}

// ---------- Проверка ответа ----------
function checkAnswer() {
    if (!active || !waiting) return;
    waiting = false;
    clearTimeout(handTimer);
    total++;

    const userChange = {};
    DENOMINATIONS.forEach(d => userChange[d] = parseInt($(`cnt_${d}`).value) || 0);

    // Сравниваем с правильным ответом
    const isCorrect = DENOMINATIONS.every(d => userChange[d] === correctChange[d]);

    if (isCorrect) {
        ok++;
        const totalChips = DENOMINATIONS.reduce((s, d) => s + correctChange[d], 0);
        say(`✅ ПРАВИЛЬНО! Сдача ${formatNum(currentChip - currentBet)} — ${totalChips} фишек`, '#7CFC00');
    } else {
        bad++;
        const correctStr = DENOMINATIONS
            .filter(d => correctChange[d] > 0)
            .map(d => `${correctChange[d]}×${formatNum(d)}`)
            .join(' + ') || '0 (сдачи нет)';
        say(`❌ НЕПРАВИЛЬНО!\nПравильная сдача: ${correctStr}`, '#FF6347');
    }
    stats();
    next();
}

function skip() {
    if (!active || !waiting) return;
    waiting = false;
    clearTimeout(handTimer);
    total++; bad++;
    const correctStr = DENOMINATIONS
        .filter(d => correctChange[d] > 0)
        .map(d => `${correctChange[d]}×${formatNum(d)}`)
        .join(' + ') || '0';
    say(`⏭ ПРОПУЩЕНО. Правильный ответ: ${correctStr}`, '#FFA500');
    stats();
    next();
}

function timeout() {
    if (!waiting) return;
    waiting = false;
    total++; bad++;
    const correctStr = DENOMINATIONS
        .filter(d => correctChange[d] > 0)
        .map(d => `${correctChange[d]}×${formatNum(d)}`)
        .join(' + ') || '0';
    say(`⏰ ВРЕМЯ ВЫШЛО!\nПравильная сдача: ${correctStr}`, '#FF6347');
    stats();
    next();
}

function next() {
    clearTimeout(nextTimer);
    nextTimer = setTimeout(() => { if (active) deal(); }, 2500);
}

// ---------- Игровой цикл ----------
function deal() {
    if (!active) return;
    generateTask();
    say(`Считайте сдачу! У вас ${cardSec} сек.`, '#fff');
    waiting = true;
    DENOMINATIONS.forEach(d => $(`cnt_${d}`).disabled = false);
    $('btnCheck').disabled = false;
    $('btnSkip').disabled = false;
    clearTimeout(handTimer);
    handTimer = setTimeout(timeout, cardSec * 1000);
}

function start() {
    cardSec = Math.max(3, parseInt($('cardTime').value) || 10);
    const min = Math.max(1, parseInt($('totalTime').value) || 10);
    localStorage.setItem('ch_settings', JSON.stringify({ cardSec, min }));
    total = ok = bad = 0; stats();
    active = true;
    $('btnStart').disabled = true;
    $('cardTime').disabled = $('totalTime').disabled = true;
    endAt = Date.now() + min * 60000;
    tickTimer = setInterval(tick, 250); tick();
    deal();
}

function tick() {
    const left = endAt - Date.now();
    if (left <= 0) { finish(); return; }
    const s = Math.ceil(left / 1000);
    $('timer').textContent =
        `Осталось: ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function finish() {
    active = waiting = false;
    clearInterval(tickTimer);
    clearTimeout(handTimer);
    clearTimeout(nextTimer);
    $('btnStart').disabled = false;
    $('cardTime').disabled = $('totalTime').disabled = false;
    DENOMINATIONS.forEach(d => $(`cnt_${d}`).disabled = true);
    $('btnCheck').disabled = $('btnSkip').disabled = true;
    $('timer').textContent = 'Осталось: 00:00';
    const pct = total ? (ok / total * 100).toFixed(1) : '0.0';
    alert(`Тренировка завершена!\n\nЗадач: ${total}\nПравильно: ${ok}\nНеправильно: ${bad}\nТочность: ${pct}%`);
    say('Тренировка завершена. Нажмите «Начать» для новой сессии.', '#fff');
}

// ---------- Утилиты ----------
function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function say(t, c) { const r = $('result'); r.textContent = t; r.style.color = c; }
function stats() { $('stTotal').textContent = total; $('stOk').textContent = ok; $('stBad').textContent = bad; }

// ---------- События ----------
$('btnStart').onclick = start;
$('btnCheck').onclick = checkAnswer;
$('btnSkip').onclick = skip;

document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') {
        if (e.key === 'Enter') { e.preventDefault(); checkAnswer(); }
        return;
    }
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'space') { e.preventDefault(); if (!$('btnStart').disabled) start(); }
    else if (k === 'enter') { e.preventDefault(); checkAnswer(); }
    else if (k === 's' || k === 'ы') { e.preventDefault(); skip(); }
    // Цифровые клавиши 1-5 — фокус на соответствующее поле
    else if (['1','2','3','4','5'].includes(k)) {
        // 1 → 100000, 2 → 25000, 3 → 5000, 4 → 1000, 5 → 500
        const map = { '1': 100000, '2': 25000, '3': 5000, '4': 1000, '5': 500 };
        const inp = $(`cnt_${map[k]}`);
        if (inp && !inp.disabled) { inp.focus(); inp.select(); }
    }
});

// Восстановление настроек
(function restore() {
    try {
        const s = JSON.parse(localStorage.getItem('ch_settings'));
        if (s) { $('cardTime').value = s.cardSec; $('totalTime').value = s.min; }
    } catch (_) {}
    initInputs();
    DENOMINATIONS.forEach(d => $(`cnt_${d}`).disabled = true);
    $('btnCheck').disabled = $('btnSkip').disabled = true;
})();
