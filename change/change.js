const $ = id => document.getElementById(id);

const DENOMINATIONS = [100000, 25000, 5000, 1000, 500];

const CHIP_COLORS = {
    100000: { bg: '#f4f6f7', border: '#FFD700', text: '#1a1a1a', label: '100к' },
    25000:  { bg: '#1e8449', border: '#fff', text: '#fff', label: '25к' },
    5000:   { bg: '#2c2c2c', border: '#FFD700', text: '#FFD700', label: '5к' },
    1000:   { bg: '#2980b9', border: '#fff', text: '#fff', label: '1к' },
    500:    { bg: '#c0392b', border: '#fff', text: '#fff', label: '500' }
};

const NUM_PLAYERS = 3;

let active = false, waiting = false, awaitingNext = false;
let total = 0, ok = 0, bad = 0;
let cardSec = 15;
let handTimer = null, tickTimer = null, endAt = 0;

let globalBet = 0;
let players = [];

function initPlayersGrid() {
    const grid = $('playersGrid');
    grid.innerHTML = '';
    for (let i = 0; i < NUM_PLAYERS; i++) {
        const col = document.createElement('div');
        col.className = 'player-col';
        col.innerHTML = `
            <div class="player-header">ИГРОК ${i + 1}</div>
            <div class="player-gave">
                <div class="bet-label">ДАЛ</div>
                <div class="player-sum" id="sum_${i}">0</div>
            </div>
            <div class="chips-row" id="chips_${i}"></div>
            <div class="change-inputs" id="inputs_${i}"></div>
        `;
        grid.appendChild(col);
    }

    for (let i = 0; i < NUM_PLAYERS; i++) {
        const inputsBox = $(`inputs_${i}`);
        inputsBox.innerHTML = '';
        DENOMINATIONS.forEach(d => {
            const c = CHIP_COLORS[d];
            const wrap = document.createElement('div');
            wrap.className = 'chip-input-wrap';
            wrap.innerHTML = `
                <div class="chip mini" style="background:${c.bg};border-color:${c.border};color:${c.text}">
                    ${c.label}
                </div>
                <div class="chip-controls">
                    <button class="chip-btn" data-player="${i}" data-denom="${d}" data-delta="-1">−</button>
                    <input type="number" class="chip-count" id="cnt_${i}_${d}" value="0" min="0" max="99">
                    <button class="chip-btn" data-player="${i}" data-denom="${d}" data-delta="1">+</button>
                </div>
            `;
            inputsBox.appendChild(wrap);
        });
    }

    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.onclick = () => {
            if (!waiting) return;
            const p = parseInt(btn.dataset.player);
            const d = parseInt(btn.dataset.denom);
            const delta = parseInt(btn.dataset.delta);
            const inp = $(`cnt_${p}_${d}`);
            let v = parseInt(inp.value) || 0;
            v = Math.max(0, v + delta);
            inp.value = v;
        };
    });
}

function generateTask() {
    globalBet = (Math.floor(Math.random() * 80) + 1) * 500;
    $('globalBet').textContent = formatNum(globalBet);

    players = [];

    for (let i = 0; i < NUM_PLAYERS; i++) {
        let chips = [], sum = 0, attempts = 0;
        while (attempts < 100) {
            chips = []; sum = 0;
            const numChips = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < numChips; j++) {
                const denom = DENOMINATIONS[Math.floor(Math.random() * DENOMINATIONS.length)];
                chips.push(denom);
                sum += denom;
            }
            if (sum >= globalBet && (sum - globalBet) <= 150000) break;
            attempts++;
        }
        if (attempts >= 100) {
            const suitable = DENOMINATIONS.filter(d => d >= globalBet);
            chips = [suitable[0] || 100000];
            sum = chips[0];
        }

        let change = sum - globalBet;
        const correctChange = {};
        DENOMINATIONS.forEach(d => correctChange[d] = 0);
        for (const d of DENOMINATIONS) {
            while (change >= d) { correctChange[d]++; change -= d; }
        }
        players.push({ sum, chips, correctChange });
    }

    for (let i = 0; i < NUM_PLAYERS; i++) {
        const p = players[i];
        $(`sum_${i}`).textContent = formatNum(p.sum);
        const chipsRow = $(`chips_${i}`);
        chipsRow.innerHTML = '';
        p.chips.forEach(d => {
            const c = CHIP_COLORS[d];
            const chip = document.createElement('div');
            chip.className = 'chip medium';
            chip.style.background = c.bg;
            chip.style.borderColor = c.border;
            chip.style.color = c.text;
            chip.textContent = c.label;
            chipsRow.appendChild(chip);
        });
        DENOMINATIONS.forEach(d => $(`cnt_${i}_${d}`).value = 0);
    }
}

function checkAnswer() {
    if (!active || !waiting) return;
    waiting = false;
    clearTimeout(handTimer);
    total++;

    let allCorrect = true;
    const wrongPlayers = [];

    for (let i = 0; i < NUM_PLAYERS; i++) {
        const p = players[i];
        const userChange = {};
        DENOMINATIONS.forEach(d => userChange[d] = parseInt($(`cnt_${i}_${d}`).value) || 0);
        const isCorrect = DENOMINATIONS.every(d => userChange[d] === p.correctChange[d]);
        if (!isCorrect) { allCorrect = false; wrongPlayers.push(i); }
    }

    if (allCorrect) {
        ok++;
        const totalChips = players.reduce((s, p) =>
            s + DENOMINATIONS.reduce((ss, d) => ss + p.correctChange[d], 0), 0);
        say(`✅ ВСЕ ПРАВИЛЬНО! Всего выдано ${totalChips} фишек`, '#7CFC00');
    } else {
        bad++;
        let msg = '❌ ОШИБКА:\n';
        wrongPlayers.forEach(i => {
            const p = players[i];
            const correctStr = DENOMINATIONS
                .filter(d => p.correctChange[d] > 0)
                .map(d => `${p.correctChange[d]}×${CHIP_COLORS[d].label}`)
                .join(' + ') || '0';
            msg += `Игрок ${i + 1} (дал ${formatNum(p.sum)}): ${correctStr}\n`;
        });
        say(msg.trim(), '#FF6347');
    }
    stats();
    showNextButton();
}

function skip() {
    if (!active || !waiting) return;
    waiting = false;
    clearTimeout(handTimer);
    total++; bad++;
    let msg = '⏭ ПРОПУЩЕНО. Правильные ответы:\n';
    players.forEach((p, i) => {
        const correctStr = DENOMINATIONS
            .filter(d => p.correctChange[d] > 0)
            .map(d => `${p.correctChange[d]}×${CHIP_COLORS[d].label}`)
            .join(' + ') || '0';
        msg += `Игрок ${i + 1} (дал ${formatNum(p.sum)}): ${correctStr}\n`;
    });
    say(msg.trim(), '#FFA500');
    stats();
    showNextButton();
}

function timeout() {
    if (!waiting) return;
    waiting = false;
    total++; bad++;
    let msg = '⏰ ВРЕМЯ ВЫШЛО!\n';
    players.forEach((p, i) => {
        const correctStr = DENOMINATIONS
            .filter(d => p.correctChange[d] > 0)
            .map(d => `${p.correctChange[d]}×${CHIP_COLORS[d].label}`)
            .join(' + ') || '0';
        msg += `Игрок ${i + 1} (дал ${formatNum(p.sum)}): ${correctStr}\n`;
    });
    say(msg.trim(), '#FF6347');
    stats();
    showNextButton();
}

function showNextButton() {
    awaitingNext = true;
    document.querySelectorAll('.chip-count').forEach(inp => inp.disabled = true);
    $('btnCheck').disabled = true;
    $('btnSkip').disabled = true;
    $('btnNext').disabled = false;
    $('btnNext').focus();
}

function goNext() {
    if (!active || !awaitingNext) return;
    awaitingNext = false;
    if ((endAt - Date.now()) <= 0) { finish(); return; }
    deal();
}

function deal() {
    if (!active) return;
    generateTask();
    say(`Ставка ${formatNum(globalBet)}. Посчитайте сдачу каждому! У вас ${cardSec} сек.`, '#fff');
    waiting = true;
    document.querySelectorAll('.chip-count').forEach(inp => inp.disabled = false);
    $('btnCheck').disabled = false;
    $('btnSkip').disabled = false;
    $('btnNext').disabled = true;
    clearTimeout(handTimer);
    handTimer = setTimeout(timeout, cardSec * 1000);
}

function start() {
    cardSec = Math.max(5, parseInt($('cardTime').value) || 15);
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
    active = waiting = awaitingNext = false;
    clearInterval(tickTimer);
    clearTimeout(handTimer);
    $('btnStart').disabled = false;
    $('cardTime').disabled = $('totalTime').disabled = false;
    document.querySelectorAll('.chip-count').forEach(inp => inp.disabled = true);
    $('btnCheck').disabled = $('btnSkip').disabled = $('btnNext').disabled = true;
    $('timer').textContent = 'Осталось: 00:00';
    const pct = total ? (ok / total * 100).toFixed(1) : '0.0';
    alert(`Тренировка завершена!\n\nЗадач: ${total}\nПравильно: ${ok}\nНеправильно: ${bad}\nТочность: ${pct}%`);
    say('Тренировка завершена. Нажмите «Начать» для новой сессии.', '#fff');
}

function formatNum(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function say(t, c) { const r = $('result'); r.textContent = t; r.style.color = c; }
function stats() { $('stTotal').textContent = total; $('stOk').textContent = ok; $('stBad').textContent = bad; }

$('btnStart').onclick = start;
$('btnCheck').onclick = checkAnswer;
$('btnSkip').onclick = skip;
$('btnNext').onclick = goNext;

document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (awaitingNext) goNext();
            else checkAnswer();
        }
        return;
    }
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'space') { e.preventDefault(); if (!$('btnStart').disabled) start(); }
    else if (k === 'enter') { e.preventDefault(); if (awaitingNext) goNext(); else checkAnswer(); }
    else if (k === 's' || k === 'ы') { e.preventDefault(); skip(); }
});

(function restore() {
    try {
        const s = JSON.parse(localStorage.getItem('ch_settings'));
        if (s) { $('cardTime').value = s.cardSec; $('totalTime').value = s.min; }
    } catch (_) {}
    initPlayersGrid();
    document.querySelectorAll('.chip-count').forEach(inp => inp.disabled = true);
    $('btnCheck').disabled = $('btnSkip').disabled = $('btnNext').disabled = true;
})();
