const roomCode = window.BATTLE_ROOM_CODE;
const battleStatusEl = document.getElementById('battleStatus');
const connectionBadgeEl = document.getElementById('battleConnectionBadge');
const playerOneNameEl = document.getElementById('playerOneName');
const playerTwoNameEl = document.getElementById('playerTwoName');
const playerOneScoreEl = document.getElementById('playerOneScore');
const playerTwoScoreEl = document.getElementById('playerTwoScore');
const endBattleBtn = document.getElementById('endBattleBtn');
const battleEndButtons = Array.from(document.querySelectorAll('[data-battle-end-btn]'));
const botUsedCountEl = document.getElementById('botUsedCount');
const botRemainingCountEl = document.getElementById('botRemainingCount');
const botPoolCountEl = document.getElementById('botPoolCount');
const botCountdownLabelEl = document.getElementById('botCountdownLabel');
const botRoundSummaryLabelEl = document.getElementById('botRoundSummaryLabel');
const botRoundStateLabelEl = document.getElementById('botRoundStateLabel');
const botRoundStateHelpEl = document.getElementById('botRoundStateHelp');
const botStartBtn = document.getElementById('botStartBtn');
const botStopBtn = document.getElementById('botStopBtn');
const botRestartBtn = document.getElementById('botRestartBtn');
const battleAnswerInputEl = document.getElementById('answerInput');
const battleSubmitAnswerBtn = document.getElementById('submitAnswerBtn');
const battleConfirmModalEl = document.getElementById('battleConfirmModal');
const battleConfirmTitleEl = document.getElementById('battleConfirmTitle');
const battleConfirmMessageEl = document.getElementById('battleConfirmMessage');
const battleConfirmNoteEl = document.getElementById('battleConfirmNote');
const battleConfirmAcceptBtn = document.getElementById('battleConfirmAcceptBtn');
const battleInitialState = window.BATTLE_INITIAL_STATE || {};

let socket = null;
let battleFinished = battleInitialState.status === 'finished';
let pendingScoreTokens = [];
const queuedScoreTokenSet = new Set();
let battleStartedAt = battleInitialState.startedAt || '';
let battleEndedAt = battleInitialState.endedAt || '';
let botScoreIntervalSeconds = battleInitialState.botScoreIntervalSeconds || null;
let botRoundStatus = battleInitialState.botRoundStatus || '';
let botNextSolveAt = battleInitialState.botNextSolveAt || '';
let currentChallengeId = battleInitialState.challengeId || null;
let usedChallengeCount = battleInitialState.usedChallengeCount || 0;
let botTotalChallengeCount = battleInitialState.botTotalChallengeCount || 0;
let playerOneScore = battleInitialState.playerOneScore || 0;
let playerTwoScore = battleInitialState.playerTwoScore || 0;
let botProgressTimer = null;
let botCountdownTimer = null;
let botPollingTimer = null;
let challengeReloadScheduled = false;
let battleConfirmModal = null;
let battleConfirmHandler = null;
const isBotBattle = battleInitialState.mode === 'bot';

function renderStatus(message, type = 'info') {
    if (!battleStatusEl) return;
    const alertClassMap = {
        success: 'alert-success',
        warning: 'alert-warning',
        error: 'alert-danger',
        info: 'alert-info',
    };
    const icon = type === 'success'
        ? 'trophy-fill'
        : type === 'error'
            ? 'exclamation-triangle'
            : type === 'warning'
                ? 'wifi-off'
                : 'broadcast';
    const alertClass = alertClassMap[type] || alertClassMap.info;
    battleStatusEl.innerHTML = `
        <div class="alert ${alertClass} mb-0">
            <i class="bi bi-${icon} me-2"></i>${message}
        </div>
    `;
}

function setEndBattleButtonsState(disabled, html) {
    battleEndButtons.forEach((button) => {
        button.disabled = disabled;
        if (html) {
            button.innerHTML = html;
        }
    });
}

function initializeBattleConfirmModal() {
    if (!battleConfirmModalEl || typeof window.bootstrap === 'undefined' || !window.bootstrap.Modal) {
        return null;
    }
    if (!battleConfirmModal) {
        if (battleConfirmModalEl.parentElement !== document.body) {
            document.body.appendChild(battleConfirmModalEl);
        }
        battleConfirmModal = new window.bootstrap.Modal(battleConfirmModalEl);
        if (battleConfirmAcceptBtn) {
            battleConfirmAcceptBtn.addEventListener('click', () => {
                const handler = battleConfirmHandler;
                battleConfirmHandler = null;
                battleConfirmModal.hide();
                if (typeof handler === 'function') {
                    handler();
                }
            });
        }
        battleConfirmModalEl.addEventListener('hidden.bs.modal', () => {
            battleConfirmHandler = null;
        });
    }
    return battleConfirmModal;
}

function openBattleConfirmDialog(config) {
    const modal = initializeBattleConfirmModal();
    if (!modal) {
        return false;
    }
    if (battleConfirmTitleEl) {
        battleConfirmTitleEl.textContent = config.title || 'Confirm Action';
    }
    if (battleConfirmMessageEl) {
        battleConfirmMessageEl.textContent = config.message || 'Please confirm this action.';
    }
    if (battleConfirmNoteEl) {
        battleConfirmNoteEl.textContent = config.note || 'This action will update the current battle room immediately.';
    }
    if (battleConfirmAcceptBtn) {
        battleConfirmAcceptBtn.className = `btn ${config.confirmClass || 'btn-danger'}`;
        battleConfirmAcceptBtn.textContent = config.confirmLabel || 'Confirm';
    }
    battleConfirmHandler = config.onConfirm || null;
    modal.show();
    return true;
}

function setConnectionBadge(text, className) {
    if (!connectionBadgeEl) return;
    connectionBadgeEl.textContent = text;
    connectionBadgeEl.className = `badge ${className}`;
}

function isSocketOpen() {
    return socket && socket.readyState === WebSocket.OPEN;
}

function getCsrfToken() {
    const tokenInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (tokenInput && tokenInput.value) {
        return tokenInput.value;
    }
    const csrfCookie = document.cookie
        .split(';')
        .map((chunk) => chunk.trim())
        .find((chunk) => chunk.startsWith('csrftoken='));
    return csrfCookie ? decodeURIComponent(csrfCookie.split('=').slice(1).join('=')) : '';
}

async function postBattleAction(action, extraPayload = {}) {
    if (!roomCode) {
        throw new Error('Battle room code is missing.');
    }
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };
    const csrfToken = getCsrfToken();
    if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
    }

    const response = await fetch('/api/battle/', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            room_code: roomCode,
            battle_action: action,
            ...extraPayload,
        }),
    });
    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }
    if (!response.ok) {
        throw new Error(data.error || data.detail || 'Battle action failed.');
    }
    renderBattleState(data);
    return data;
}

function updateBotCounters(data = {}) {
    if (!isBotBattle) return;
    if (data.used_challenge_count !== undefined) {
        usedChallengeCount = data.used_challenge_count;
    }
    if (data.bot_total_challenge_count !== undefined) {
        botTotalChallengeCount = data.bot_total_challenge_count;
    }
    if (data.bot_next_solve_at !== undefined) {
        botNextSolveAt = data.bot_next_solve_at;
    }
    if (data.bot_round_status !== undefined) {
        botRoundStatus = data.bot_round_status;
    }

    if (botPoolCountEl && botTotalChallengeCount !== undefined) {
        botPoolCountEl.textContent = String(botTotalChallengeCount);
    }
    if (botUsedCountEl && usedChallengeCount !== undefined) {
        botUsedCountEl.textContent = String(usedChallengeCount);
    }
    if (botRemainingCountEl && botTotalChallengeCount !== undefined && usedChallengeCount !== undefined) {
        const remainingCount = Math.max(0, botTotalChallengeCount - usedChallengeCount);
        botRemainingCountEl.textContent = String(remainingCount);
    }
}

function getBotRoundStartLabel() {
    const hasPlayedAnyRound = usedChallengeCount > 1 || playerOneScore > 0 || playerTwoScore > 0;
    return hasPlayedAnyRound ? 'Resume Next Round' : 'Start Round';
}

function syncBotRoundUi() {
    if (!isBotBattle) return;

    const isReady = botRoundStatus === 'ready';
    const isRunning = botRoundStatus === 'running';
    const controlsAvailable = !battleFinished && !!roomCode;
    const startLabel = getBotRoundStartLabel();

    if (botRoundSummaryLabelEl) {
        botRoundSummaryLabelEl.textContent = isRunning ? 'Running' : battleFinished ? 'Finished' : 'Ready';
    }

    if (botRoundStateLabelEl) {
        botRoundStateLabelEl.textContent = isRunning ? 'Round Running' : battleFinished ? 'Battle Finished' : 'Ready To Start';
        botRoundStateLabelEl.classList.toggle('is-running', isRunning);
        botRoundStateLabelEl.classList.toggle('is-waiting', !isRunning);
    }

    if (botRoundStateHelpEl) {
        if (battleFinished) {
            botRoundStateHelpEl.textContent = 'This marathon has ended.';
        } else if (isRunning) {
            botRoundStateHelpEl.textContent = 'Finish before the timer ends. Stopping now forfeits this round to the computer.';
        } else if (usedChallengeCount > 1 || playerOneScore > 0 || playerTwoScore > 0) {
            botRoundStateHelpEl.textContent = 'The previous round is complete. Start the next round when you are ready.';
        } else {
            botRoundStateHelpEl.textContent = 'Review the challenge first. The computer timer will begin only after you start the round.';
        }
    }

    if (botStartBtn) {
        botStartBtn.disabled = !controlsAvailable || !isReady;
        botStartBtn.innerHTML = `<i class="bi bi-play-fill me-1"></i>${startLabel}`;
    }
    if (botStopBtn) {
        botStopBtn.disabled = !controlsAvailable || !isRunning;
    }
    if (botRestartBtn) {
        botRestartBtn.disabled = !controlsAvailable;
    }
    if (battleSubmitAnswerBtn) {
        battleSubmitAnswerBtn.disabled = battleFinished || !isRunning;
    }
    if (battleAnswerInputEl && !battleFinished) {
        battleAnswerInputEl.placeholder = isRunning
            ? 'Type your final answer here, then press Submit Answer.'
            : 'Review the challenge and draft here if you want. Press Start Round when you are ready to race.';
    }
}

function formatCountdown(totalSeconds) {
    const clamped = Math.max(0, totalSeconds);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function syncBotCountdown() {
    if (!botCountdownLabelEl || !isBotBattle) return;
    if (battleFinished) {
        botCountdownLabelEl.textContent = '--:--';
        return;
    }
    if (botRoundStatus !== 'running') {
        botCountdownLabelEl.textContent = 'Ready';
        return;
    }
    if (!botNextSolveAt) {
        botCountdownLabelEl.textContent = '--:--';
        return;
    }
    const nextSolveMs = Date.parse(botNextSolveAt);
    if (Number.isNaN(nextSolveMs)) {
        botCountdownLabelEl.textContent = '--:--';
        return;
    }
    const remainingSeconds = Math.ceil((nextSolveMs - Date.now()) / 1000);
    botCountdownLabelEl.textContent = formatCountdown(remainingSeconds);
}

function triggerChallengeReload(reason) {
    if (challengeReloadScheduled) return;
    challengeReloadScheduled = true;
    renderStatus(reason, 'info');
    window.setTimeout(() => {
        window.location.reload();
    }, 900);
}

function startBotProgressSync() {
    if (!isBotBattle || botProgressTimer) return;
    botProgressTimer = window.setInterval(() => {
        if (!isSocketOpen() || battleFinished || botRoundStatus !== 'running') {
            return;
        }
        socket.send(JSON.stringify({ event: 'bot_progress' }));
    }, 2000);
}

async function pollBotBattleState() {
    if (!isBotBattle || battleFinished || !roomCode) {
        return;
    }
    try {
        const response = await fetch(`/api/battle/?room_code=${encodeURIComponent(roomCode)}`, {
            method: 'GET',
            headers: {'Accept': 'application/json'},
        });
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        if (data && data.room_code) {
            renderBattleState(data);
        }
    } catch (error) {
        // Fallback polling should stay quiet unless the user is already disconnected.
    }
}

function startBotPollingFallback() {
    if (!isBotBattle || botPollingTimer) return;
    botPollingTimer = window.setInterval(() => {
        pollBotBattleState();
    }, 4000);
}

function startBotCountdown() {
    if (!isBotBattle || botCountdownTimer) return;
    syncBotCountdown();
    botCountdownTimer = window.setInterval(() => {
        syncBotCountdown();
    }, 1000);
}

function queueScoreToken(scoreToken) {
    if (!scoreToken || typeof scoreToken !== 'string') return;
    if (queuedScoreTokenSet.has(scoreToken)) return;
    queuedScoreTokenSet.add(scoreToken);
    pendingScoreTokens.push(scoreToken);
}

function flushPendingScoreTokens() {
    if (!isSocketOpen() || battleFinished || !pendingScoreTokens.length) {
        return;
    }

    const toSend = pendingScoreTokens;
    pendingScoreTokens = [];
    for (const token of toSend) {
        queuedScoreTokenSet.delete(token);
        socket.send(JSON.stringify({ event: 'score_update', score_token: token }));
    }
}

function renderBattleState(data) {
    if (!data) return;

    if (data.started_at) {
        battleStartedAt = data.started_at;
    }
    if (data.ended_at) {
        battleEndedAt = data.ended_at;
    }
    if (data.bot_score_interval_seconds) {
        botScoreIntervalSeconds = data.bot_score_interval_seconds;
    }
    updateBotCounters(data);

    if (playerOneNameEl && data.player_one_username) {
        playerOneNameEl.textContent = data.player_one_username;
    }
    if (playerTwoNameEl && data.player_two_username) {
        playerTwoNameEl.textContent = data.player_two_username;
    }
    if (playerOneScoreEl && data.player_one_score !== undefined) {
        playerOneScore = data.player_one_score;
        playerOneScoreEl.textContent = String(data.player_one_score);
    }
    if (playerTwoScoreEl && data.player_two_score !== undefined) {
        playerTwoScore = data.player_two_score;
        playerTwoScoreEl.textContent = String(data.player_two_score);
    }
    syncBotRoundUi();
    syncBotCountdown();
    if (data.challenge_id !== undefined && data.challenge_id !== null) {
        const challengeChanged = currentChallengeId !== null && data.challenge_id !== currentChallengeId;
        currentChallengeId = data.challenge_id;
        if (challengeChanged || data.challenge_changed) {
            const reloadMessage = isBotBattle
                ? (
                    data.bot_action === 'restart'
                        ? 'Marathon restarted. Loading a fresh random challenge...'
                        : data.last_solver === 'computer'
                            ? 'Computer took the round. Loading the next random challenge...'
                            : 'Point scored. Loading the next random challenge...'
                )
                : 'Point scored. Loading the next battle challenge...';
            triggerChallengeReload(reloadMessage);
            return;
        }
    }

    if (data.status === 'finished') {
        battleFinished = true;
        botRoundStatus = 'ready';
        syncBotCountdown();
        syncBotRoundUi();
        if (endBattleBtn) {
            setEndBattleButtonsState(true, '<i class="bi bi-check-circle me-1"></i>Battle Ended');
        }
        renderStatus(`Battle finished. Winner: <strong>${data.winner || 'Draw'}</strong>`, 'success');
    } else if (data.bot_action === 'start') {
        renderStatus('Round started. The computer timer is now running.', 'info');
    } else if (data.bot_action === 'restart') {
        renderStatus('Computer marathon restarted.', 'info');
    } else if (!battleFinished) {
        renderStatus(`Battle status: <strong>${data.status || 'live'}</strong>`, 'info');
    }
}

function controlBotRound(action) {
    if (!isBotBattle) return false;
    if (battleFinished || !roomCode) {
        renderStatus('This battle is no longer available for control.', 'warning');
        return false;
    }
    if (isSocketOpen()) {
        socket.send(JSON.stringify({ event: 'bot_control', action }));
        return true;
    }
    postBattleAction(action).catch((error) => {
        renderStatus(error.message || 'Could not update this computer battle.', 'warning');
    });
    return true;
}

function sendScoreIncrement(scoreToken) {
    if (!scoreToken || typeof scoreToken !== 'string') return false;
    if (battleFinished) return false;

    if (!isSocketOpen()) {
        postBattleAction('score', { score_token: scoreToken }).catch((error) => {
            queueScoreToken(scoreToken);
            renderStatus(
                (error && error.message)
                    ? `${error.message} Score update queued and will retry on reconnect.`
                    : 'Socket disconnected. Score update queued and will sync on reconnect.',
                'warning'
            );
        });
        return true;
    }

    socket.send(JSON.stringify({ event: 'score_update', score_token: scoreToken }));
    return true;
}

function finalizeBattle() {
    if (battleFinished || !roomCode) return false;
    setEndBattleButtonsState(true, '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Ending...');
    if (isSocketOpen()) {
        socket.send(JSON.stringify({ event: 'battle_end' }));
        return true;
    }
    postBattleAction('finalize').catch((error) => {
        renderStatus(error.message || 'Could not end this battle.', 'warning');
        if (!battleFinished) {
            setEndBattleButtonsState(false, '<i class="bi bi-stop-circle me-1"></i>End Battle');
        }
    });
    return true;
}

window.BattleClient = {
    controlBotRound,
    sendScoreIncrement,
    finalizeBattle,
    triggerChallengeReload,
};

if (roomCode) {
    updateBotCounters();
    syncBotRoundUi();
    startBotCountdown();
    startBotPollingFallback();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${window.location.host}/ws/battle/${roomCode}/`);
    setConnectionBadge('Connecting...', 'badge-accent');

    socket.onopen = () => {
        setConnectionBadge('Connected', 'bg-success');
        syncBotRoundUi();
        flushPendingScoreTokens();
        startBotProgressSync();
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
        if (data.event === 'battle_state' || data.event === 'score_update' || data.event === 'battle_end' || data.event === 'bot_progress' || data.event === 'bot_control') {
            renderBattleState(data);
            return;
        }
        if (data.event === 'error') {
            renderStatus(data.message || 'Battle action was rejected.', 'warning');
        }
    };

    socket.onclose = () => {
        setConnectionBadge('Disconnected', 'bg-secondary');
        syncBotRoundUi();
        if (!battleFinished) {
            renderStatus('Realtime connection lost. Using backup battle controls.', 'warning');
        }
        if (botProgressTimer) {
            window.clearInterval(botProgressTimer);
            botProgressTimer = null;
        }
        if (botPollingTimer) {
            // keep polling alive on disconnect so bot rounds still progress
        }
    };

    socket.onerror = () => {
        setConnectionBadge('Error', 'bg-danger');
        renderStatus('Realtime connection error.', 'error');
    };

    if (botStartBtn) {
        botStartBtn.addEventListener('click', () => {
            controlBotRound('start');
        });
    }

    if (botStopBtn) {
        botStopBtn.addEventListener('click', () => {
            const opened = openBattleConfirmDialog({
                title: 'Forfeit This Round?',
                message: 'Stopping now gives this round to the computer and prepares the next random challenge.',
                note: 'Use this only if you want to give up the current challenge. The computer score will increase by 1.',
                confirmLabel: 'Stop Round',
                confirmClass: 'btn-warning',
                onConfirm: () => controlBotRound('forfeit'),
            });
            if (opened) {
                return;
            }
            controlBotRound('forfeit');
        });
    }

    if (botRestartBtn) {
        botRestartBtn.addEventListener('click', () => {
            const opened = openBattleConfirmDialog({
                title: 'Restart Marathon?',
                message: 'This resets both scores to zero and starts a fresh random challenge order.',
                note: 'Your current marathon progress will be cleared and a new random run will begin from the first ready state.',
                confirmLabel: 'Restart',
                confirmClass: 'btn-danger',
                onConfirm: () => controlBotRound('restart'),
            });
            if (opened) {
                return;
            }
            controlBotRound('restart');
        });
    }

    battleEndButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (battleFinished) return;
            const opened = openBattleConfirmDialog({
                title: 'End Battle?',
                message: 'Ending the battle locks the current result and closes this room.',
                note: 'After ending, this room will not continue scoring or start new rounds.',
                confirmLabel: 'End Battle',
                confirmClass: 'btn-danger',
                onConfirm: () => {
                    if (!finalizeBattle()) {
                        renderStatus('Cannot end battle while disconnected.', 'warning');
                    }
                },
            });
            if (opened) {
                return;
            }
            if (!finalizeBattle()) {
                renderStatus('Cannot end battle while disconnected.', 'warning');
            }
        });
    });
}
