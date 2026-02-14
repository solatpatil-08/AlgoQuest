const roomCode = window.BATTLE_ROOM_CODE;
const statusEl = document.getElementById("battleStatus");
const p1ScoreEl = document.getElementById("playerOneScore");
const p2ScoreEl = document.getElementById("playerTwoScore");

if (roomCode) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws/battle/${roomCode}/`);

    socket.onopen = () => {
        if (statusEl) {
            statusEl.innerHTML = `<div class="alert alert-info fade-in">
                <i class="bi bi-wifi me-2"></i>Connected to battle socket. Ready to compete!
            </div>`;
        }
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === "score_update") {
            if (p1ScoreEl) {
                p1ScoreEl.textContent = `Player One: ${data.player_one_score}`;
                p1ScoreEl.classList.add('count-up');
                setTimeout(() => p1ScoreEl.classList.remove('count-up'), 600);
            }
            if (p2ScoreEl) {
                p2ScoreEl.textContent = `Player Two: ${data.player_two_score}`;
                p2ScoreEl.classList.add('count-up');
                setTimeout(() => p2ScoreEl.classList.remove('count-up'), 600);
            }
        }
        if (data.event === "battle_end" && statusEl) {
            statusEl.innerHTML = `<div class="alert alert-success fade-in">
                <i class="bi bi-trophy-fill me-2"></i>Battle finished! Winner: <strong>${data.winner}</strong>
            </div>`;

            // Disable controls
            const sendBtn = document.getElementById("sendScoreBtn");
            const endBtn = document.getElementById("endBattleBtn");
            if (sendBtn) sendBtn.disabled = true;
            if (endBtn) endBtn.disabled = true;
        }
    };

    socket.onclose = () => {
        if (statusEl) {
            statusEl.innerHTML = `<div class="alert alert-warning fade-in">
                <i class="bi bi-wifi-off me-2"></i>Connection lost. Please refresh the page.
            </div>`;
        }
    };

    socket.onerror = () => {
        if (statusEl) {
            statusEl.innerHTML = `<div class="alert alert-danger fade-in">
                <i class="bi bi-exclamation-triangle me-2"></i>Connection error. Please check your network.
            </div>`;
        }
    };

    const sendScoreBtn = document.getElementById("sendScoreBtn");
    const endBattleBtn = document.getElementById("endBattleBtn");
    const scoreDeltaInput = document.getElementById("scoreDelta");

    if (sendScoreBtn) {
        sendScoreBtn.addEventListener("click", () => {
            const scoreDelta = parseInt(scoreDeltaInput.value || "0", 10);
            socket.send(JSON.stringify({event: "score_update", score_delta: scoreDelta}));

            // Brief loading state
            sendScoreBtn.disabled = true;
            const originalHTML = sendScoreBtn.innerHTML;
            sendScoreBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Sending...';
            setTimeout(() => {
                sendScoreBtn.disabled = false;
                sendScoreBtn.innerHTML = originalHTML;
            }, 500);
        });
    }

    if (endBattleBtn) {
        endBattleBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to end this battle?")) {
                socket.send(JSON.stringify({event: "battle_end"}));
                endBattleBtn.disabled = true;
                endBattleBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Ending...';
            }
        });
    }
}
