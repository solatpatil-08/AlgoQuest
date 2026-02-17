const roomCode = window.BATTLE_ROOM_CODE;
const statusEl = document.getElementById("battleStatus");
const p1ScoreEl = document.getElementById("playerOneScore");
const p2ScoreEl = document.getElementById("playerTwoScore");
const sendScoreBtn = document.getElementById("sendScoreBtn");
const endBattleBtn = document.getElementById("endBattleBtn");
const scoreDeltaInput = document.getElementById("scoreDelta");

let socket = null;

function setControlsDisabled(disabled) {
    if (sendScoreBtn) sendScoreBtn.disabled = disabled;
    if (endBattleBtn) endBattleBtn.disabled = disabled;
}

function isSocketOpen() {
    return Boolean(socket) && socket.readyState === WebSocket.OPEN;
}

if (roomCode) {
    setControlsDisabled(true);
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${protocol}://${window.location.host}/ws/battle/${roomCode}/`);

    socket.onopen = () => {
        if (statusEl) {
            statusEl.innerHTML = `<div class="alert alert-info alert-permanent fade-in">
                <i class="bi bi-wifi me-2"></i>Connected to battle socket. Ready to compete!
            </div>`;
        }
        // Enable buttons when connected
        setControlsDisabled(false);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === "score_update") {
            if (p1ScoreEl) {
                p1ScoreEl.textContent = `${data.player_one_username || 'Player One'}: ${data.player_one_score}`;
                p1ScoreEl.classList.add('count-up');
                setTimeout(() => p1ScoreEl.classList.remove('count-up'), 600);
            }
            if (p2ScoreEl) {
                p2ScoreEl.textContent = `${data.player_two_username || 'Player Two'}: ${data.player_two_score}`;
                p2ScoreEl.classList.add('count-up');
                setTimeout(() => p2ScoreEl.classList.remove('count-up'), 600);
            }
        }
        if (data.event === "battle_end" && statusEl) {
            statusEl.innerHTML = `<div class="alert alert-success alert-permanent fade-in">
                <i class="bi bi-trophy-fill me-2"></i>Battle finished! Winner: <strong>${data.winner}</strong>
            </div>`;

            // Disable controls
            setControlsDisabled(true);
        }
    };

    socket.onclose = () => {
        if (statusEl) {
            statusEl.innerHTML = `<div class="alert alert-warning alert-permanent fade-in">
                <i class="bi bi-wifi-off me-2"></i>Connection lost. Please refresh the page.
            </div>`;
        }
        // Disable buttons when disconnected
        setControlsDisabled(true);
    };

    socket.onerror = () => {
        if (statusEl) {
            statusEl.innerHTML = `<div class="alert alert-danger alert-permanent fade-in">
                <i class="bi bi-exclamation-triangle me-2"></i>Connection error. Please check your network.
            </div>`;
        }
        // Disable buttons on error
        setControlsDisabled(true);
    };

    if (sendScoreBtn) {
        sendScoreBtn.addEventListener("click", () => {
            // Check socket state before sending
            if (!isSocketOpen()) {
                if (statusEl) {
                    statusEl.innerHTML = `<div class="alert alert-warning alert-permanent fade-in">
                        <i class="bi bi-wifi-off me-2"></i>Cannot send score: connection not open.
                    </div>`;
                }
                setControlsDisabled(true);
                return;
            }

            const scoreDelta = parseInt(scoreDeltaInput.value || "0", 10);
            if (!Number.isFinite(scoreDelta)) {
                if (statusEl) {
                    statusEl.innerHTML = `<div class="alert alert-warning alert-permanent fade-in">
                        <i class="bi bi-exclamation-circle me-2"></i>Please enter a valid score delta.
                    </div>`;
                }
                return;
            }
            socket.send(JSON.stringify({event: "score_update", score_delta: scoreDelta}));

            // Brief loading state
            sendScoreBtn.disabled = true;
            const originalHTML = sendScoreBtn.innerHTML;
            sendScoreBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Sending...';
            setTimeout(() => {
                sendScoreBtn.disabled = !isSocketOpen();
                sendScoreBtn.innerHTML = originalHTML;
            }, 500);
        });
    }

    if (endBattleBtn) {
        endBattleBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to end this battle?")) {
                // Check socket state before sending
                if (!isSocketOpen()) {
                    if (statusEl) {
                        statusEl.innerHTML = `<div class="alert alert-warning alert-permanent fade-in">
                            <i class="bi bi-wifi-off me-2"></i>Cannot end battle: connection not open.
                        </div>`;
                    }
                    setControlsDisabled(true);
                    return;
                }

                socket.send(JSON.stringify({event: "battle_end"}));
                endBattleBtn.disabled = true;
                endBattleBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Ending...';
            }
        });
    }
}
