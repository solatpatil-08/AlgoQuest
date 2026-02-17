const visualData = {
    bfs: [
        "> Start at node A",
        "  -> Visit neighbors: B, C",
        "  -> Visit D, E from B",
        "  -> Visit F from C",
        "[OK] Traversal complete: A -> B -> C -> D -> E -> F"
    ],
    dfs: [
        "> Start at node A",
        "  -> Go deep: A -> B -> D",
        "  <- Backtrack to B, visit E",
        "  <- Backtrack to A, visit C -> F",
        "[OK] Traversal complete: A -> B -> D -> E -> C -> F"
    ],
    astar: [
        "> Initialize open set with Start",
        "  -> Select node with lowest f(n)",
        "  -> Expand neighbors and update costs",
        "  -> Prioritize heuristically closest path",
        "[OK] Goal reached with shortest estimated path"
    ],
    minimax: [
        "> Generate game tree depth 2",
        "  -> Evaluate terminal scores",
        "  -> Min layer chooses minimum scores",
        "  -> Max layer chooses maximum score",
        "[OK] Best move selected by root max player"
    ]
};

function runVisualization(algorithm) {
    const output = document.getElementById("visualizationOutput");
    const btn = document.getElementById("runVisualizationBtn");
    if (!output) return;

    const steps = visualData[algorithm] || ["No visualization data available for this challenge."];
    output.textContent = "";

    // Disable button during animation
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Running...';
    }

    let index = 0;
    const interval = setInterval(() => {
        output.textContent += `${steps[index]}\n`;
        index += 1;
        if (index >= steps.length) {
            clearInterval(interval);
            // Re-enable button
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Run Again';
            }
        }
    }, 700);
}

const button = document.getElementById("runVisualizationBtn");
if (button) {
    button.addEventListener("click", () => {
        runVisualization(button.dataset.algorithm);
    });
}
