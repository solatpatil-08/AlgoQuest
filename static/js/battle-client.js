const roomCode = window.BATTLE_ROOM_CODE;
const battleStatusEl = document.getElementById('battleStatus');
const connectionBadgeEl = document.getElementById('battleConnectionBadge');
const playerOneNameEl = document.getElementById('playerOneName');
const playerTwoNameEl = document.getElementById('playerTwoName');
const playerOneScoreEl = document.getElementById('playerOneScore');
const playerTwoScoreEl = document.getElementById('playerTwoScore');
const endBattleBtn = document.getElementById('endBattleBtn');

let socket = null;
let battleFinished = false;

function renderStatus(message, type = 'info') {
    if (!battleStatusEl) return;
    const icon = type === 'success'
        ? 'trophy-fill'
        : type === 'error'
            ? 'exclamation-triangle'
            : type === 'warning'
                ? 'wifi-off'
                : 'broadcast';
    battleStatusEl.innerHTML = `
        <div class="alert alert-${type} mb-0">
            <i class="bi bi-${icon} me-2"></i>${message}
        </div>
    `;
}

function setConnectionBadge(text, className) {
    if (!connectionBadgeEl) return;
    connectionBadgeEl.textContent = text;
    connectionBadgeEl.className = `badge ${className}`;
}

function isSocketOpen() {
    return socket && socket.readyState === WebSocket.OPEN;
}

function renderBattleState(data) {
    if (!data) return;

    if (playerOneNameEl && data.player_one_username) {
        playerOneNameEl.textContent = data.player_one_username;
    }
    if (playerTwoNameEl && data.player_two_username) {
        playerTwoNameEl.textContent = data.player_two_username;
    }
    if (playerOneScoreEl && data.player_one_score !== undefined) {
        playerOneScoreEl.textContent = String(data.player_one_score);
    }
    if (playerTwoScoreEl && data.player_two_score !== undefined) {
        playerTwoScoreEl.textContent = String(data.player_two_score);
    }

    if (data.status === 'finished') {
        battleFinished = true;
        if (endBattleBtn) {
            endBattleBtn.disabled = true;
            endBattleBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Battle Ended';
        }
        renderStatus(`Battle finished. Winner: <strong>${data.winner || 'Draw'}</strong>`, 'success');
    } else if (!battleFinished) {
        renderStatus(`Battle status: <strong>${data.status || 'live'}</strong>`, 'info');
    }
}

function sendScoreIncrement(scoreToken) {
    if (!isSocketOpen() || battleFinished) return false;
    if (!scoreToken || typeof scoreToken !== 'string') return false;
    socket.send(JSON.stringify({ event: 'score_update', score_token: scoreToken }));
    return true;
}

function finalizeBattle() {
    if (!isSocketOpen() || battleFinished) return false;
    socket.send(JSON.stringify({ event: 'battle_end' }));
    if (endBattleBtn) {
        endBattleBtn.disabled = true;
        endBattleBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Ending...';
    }
    return true;
}

window.BattleClient = {
    sendScoreIncrement,
    finalizeBattle,
};

if (roomCode) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${window.location.host}/ws/battle/${roomCode}/`);
    setConnectionBadge('Connecting...', 'badge-accent');

    socket.onopen = () => {
        setConnectionBadge('Connected', 'bg-success');
        if (!battleFinished) {
            renderStatus('Connected to battle socket.', 'info');
        }
    };

    socket.onmessage = (event) => {
        let data = null;
        try {
            data = JSON.parse(event.data);
        } catch (error) {
            renderStatus('Received invalid realtime payload.', 'error');
            return;
        }

        if (!data || !data.event) return;
        if (data.event === 'battle_state' || data.event === 'score_update' || data.event === 'battle_end') {
            renderBattleState(data);
            return;
        }
        if (data.event === 'error') {
            renderStatus(data.message || 'Battle action was rejected.', 'warning');
        }
    };

    socket.onclose = () => {
        setConnectionBadge('Disconnected', 'bg-secondary');
        if (!battleFinished) {
            renderStatus('Connection lost. Please refresh the page.', 'warning');
        }
        if (endBattleBtn && !battleFinished) {
            endBattleBtn.disabled = true;
        }
    };

    socket.onerror = () => {
        setConnectionBadge('Error', 'bg-danger');
        renderStatus('Realtime connection error.', 'error');
    };

    if (endBattleBtn) {
        endBattleBtn.addEventListener('click', () => {
            if (battleFinished) return;
            if (!confirm('Are you sure you want to end this battle?')) return;
            if (!finalizeBattle()) {
                renderStatus('Cannot end battle while disconnected.', 'warning');
            }
        });
    }
}
