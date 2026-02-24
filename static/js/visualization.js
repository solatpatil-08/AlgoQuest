/* ============================================
   VISUALIZATION.JS - AlgoQuest Interactive Algorithm Visualizer v2.1
   Complete visual animation system with responsive canvas
   ============================================ */

// Global state management
const VisualizationState = {
    isRunning: false,
    isPaused: false,
    speed: 500,
    currentStep: 0,
    animationId: null,
    canvas: null,
    ctx: null
};

const ChallengeVisualizationContext = {
    payload: {}
};

function setChallengeContext(payload) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        ChallengeVisualizationContext.payload = payload;
        return;
    }
    ChallengeVisualizationContext.payload = {};
}

function getChallengePayload() {
    return ChallengeVisualizationContext.payload || {};
}

function payloadArray(key, fallback) {
    const payload = getChallengePayload();
    const candidate = payload[key];
    if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate.slice();
    }
    return fallback.slice();
}

function payloadNumber(key, fallback) {
    const payload = getChallengePayload();
    const value = Number(payload[key]);
    return Number.isFinite(value) ? value : fallback;
}

function buildNodeLayout(nodeIds) {
    const canvas = VisualizationState.canvas;
    const count = nodeIds.length || 1;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.max(120, Math.min(canvas.width, canvas.height) / 2 - 70);
    return nodeIds.map((id, idx) => {
        const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
        return {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
            label: String(id),
            id: id
        };
    });
}

function graphConfigFromPayload(defaultConfig) {
    const payload = getChallengePayload();
    const rawEdges = Array.isArray(payload.edges) ? payload.edges : [];
    if (!rawEdges.length) {
        return defaultConfig;
    }
    const discovered = new Set();
    rawEdges.forEach((edge) => {
        if (Array.isArray(edge) && edge.length >= 2) {
            discovered.add(edge[0]);
            discovered.add(edge[1]);
        }
    });
    const rawNodes = Array.isArray(payload.nodes) && payload.nodes.length ? payload.nodes : Array.from(discovered.values());
    const nodeIds = rawNodes.slice().sort((a, b) => Number(a) - Number(b));
    const idToIndex = new Map(nodeIds.map((id, idx) => [id, idx]));
    const edges = [];
    rawEdges.forEach((edge) => {
        if (!Array.isArray(edge) || edge.length < 2) {
            return;
        }
        const from = idToIndex.get(edge[0]);
        const to = idToIndex.get(edge[1]);
        if (from !== undefined && to !== undefined) {
            edges.push([from, to]);
        }
    });
    if (!edges.length || !nodeIds.length) {
        return defaultConfig;
    }
    const start = idToIndex.has(payload.start) ? idToIndex.get(payload.start) : 0;
    return {
        nodes: buildNodeLayout(nodeIds),
        edges: edges,
        start: start
    };
}

function weightedGraphConfigFromPayload(defaultConfig) {
    const payload = getChallengePayload();
    const weightedEdges = Array.isArray(payload.weighted_edges) ? payload.weighted_edges : [];
    if (!weightedEdges.length) {
        return defaultConfig;
    }
    const nodeSet = new Set();
    weightedEdges.forEach((edge) => {
        if (Array.isArray(edge) && edge.length >= 3) {
            nodeSet.add(edge[0]);
            nodeSet.add(edge[1]);
        }
    });
    const nodeIds = Array.from(nodeSet.values()).sort((a, b) => Number(a) - Number(b));
    const idToIndex = new Map(nodeIds.map((id, idx) => [id, idx]));
    const edges = [];
    weightedEdges.forEach((edge) => {
        if (!Array.isArray(edge) || edge.length < 3) {
            return;
        }
        const from = idToIndex.get(edge[0]);
        const to = idToIndex.get(edge[1]);
        if (from === undefined || to === undefined) {
            return;
        }
        edges.push({
            from: from,
            to: to,
            weight: Number(edge[2])
        });
    });
    if (!edges.length || !nodeIds.length) {
        return defaultConfig;
    }
    const source = idToIndex.has(payload.source) ? idToIndex.get(payload.source) : 0;
    const target = idToIndex.has(payload.target) ? idToIndex.get(payload.target) : nodeIds.length - 1;
    return {
        nodes: buildNodeLayout(nodeIds),
        edges: edges,
        source: source,
        target: target
    };
}

// Utility: Delay function for animations
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: Check if animation should continue
function shouldContinue() {
    return VisualizationState.isRunning;
}

// Utility: Wait for unpause
async function waitForUnpause() {
    while (VisualizationState.isPaused && VisualizationState.isRunning) {
        await delay(100);
    }
}

let visualizationResizeBound = false;
let visualizationResizeTimeout = null;

function applyResponsiveCanvasSize(container, canvas) {
    if (!canvas || !container) return;
    const containerWidth = container.clientWidth || 1000;
    const width = Math.max(280, Math.min(containerWidth - 24, 1000));
    const height = window.innerWidth < 768 ? 360 : 500;
    canvas.width = width;
    canvas.height = height;
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
}

function applyOverlayResponsiveStyles(panel) {
    if (!panel) return;
    const desktopMaxWidth = panel.dataset.desktopMaxWidth || "300px";
    const isMobile = window.innerWidth < 768;
    panel.style.cssText = isMobile
        ? "position:absolute;bottom:10px;left:10px;right:10px;background:var(--aq-viz-box-bg);padding:12px;border:2px solid var(--aq-primary);border-radius:8px;max-width:calc(100% - 20px);"
        : "position:absolute;top:10px;right:10px;background:var(--aq-viz-box-bg);padding:15px;border:2px solid var(--aq-primary);border-radius:8px;max-width:" + desktopMaxWidth + ";";
}

function handleCanvasResize() {
    const canvas = VisualizationState.canvas;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    applyResponsiveCanvasSize(container, canvas);
    container.querySelectorAll('[data-viz-overlay=\"true\"]').forEach((panel) => {
        applyOverlayResponsiveStyles(panel);
    });
    clearCanvas();
}

function bindCanvasResizeHandlers() {
    if (visualizationResizeBound) return;
    visualizationResizeBound = true;
    const debouncedResize = () => {
        clearTimeout(visualizationResizeTimeout);
        visualizationResizeTimeout = setTimeout(handleCanvasResize, 250);
    };
    window.addEventListener("resize", debouncedResize, { passive: true });
    window.addEventListener("orientationchange", debouncedResize, { passive: true });
}

// Initialize canvas with responsive sizing
function initCanvas(containerId = 'visualizationOutput') {
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-viz-canvas', '2d');
    applyResponsiveCanvasSize(container, canvas);
    
    canvas.style.border = '2px solid var(--aq-border)';
    canvas.style.borderRadius = 'var(--aq-radius-md)';
    canvas.style.background = 'var(--aq-viz-box-bg)';
    container.appendChild(canvas);
    
    VisualizationState.canvas = canvas;
    VisualizationState.ctx = canvas.getContext('2d');
    bindCanvasResizeHandlers();
    
    return canvas;
}

// Clear canvas
function clearCanvas() {
    if (VisualizationState.ctx && VisualizationState.canvas) {
        VisualizationState.ctx.clearRect(0, 0, VisualizationState.canvas.width, VisualizationState.canvas.height);
    }
}

function clearVisualizationOverlays() {
    const container = document.getElementById('visualizationOutput');
    if (!container) return;
    container.querySelectorAll('[data-viz-overlay="true"]').forEach((node) => node.remove());
}

// Draw array as horizontal boxes
function drawArray(arr, highlightIndices = [], compareIndices = [], x = 50, y = 200) {
    const ctx = VisualizationState.ctx;
    const canvas = VisualizationState.canvas;
    const boxWidth = Math.min(60, (canvas.width - 100) / arr.length - 10);
    const boxHeight = 60;
    const spacing = 10;
    
    arr.forEach((value, index) => {
        const posX = x + index * (boxWidth + spacing);
        
        // Determine color
        let fillColor = '#E0E7FF';
        if (highlightIndices.includes(index)) fillColor = '#10B981';
        if (compareIndices.includes(index)) fillColor = '#F59E0B';
        
        // Draw box
        ctx.fillStyle = fillColor;
        ctx.fillRect(posX, y, boxWidth, boxHeight);
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.strokeRect(posX, y, boxWidth, boxHeight);
        
        // Draw value
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 20px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, posX + boxWidth / 2, y + boxHeight / 2);
        
        // Draw index
        ctx.font = '14px Inter';
        ctx.fillStyle = '#64748B';
        ctx.fillText(index, posX + boxWidth / 2, y + boxHeight + 20);
    });
}

// Draw bars for sorting visualization
function drawBars(arr, highlightIndices = [], compareIndices = []) {
    const ctx = VisualizationState.ctx;
    const canvas = VisualizationState.canvas;
    clearCanvas();
    
    const maxVal = Math.max(...arr);
    const barWidth = (canvas.width - 100) / arr.length;
    const maxHeight = canvas.height - 100;
    
    arr.forEach((value, index) => {
        const barHeight = (value / maxVal) * maxHeight;
        const x = 50 + index * barWidth;
        const y = canvas.height - 50 - barHeight;
        
        // Determine color
        let fillColor = '#3B82F6';
        if (highlightIndices.includes(index)) fillColor = '#10B981';
        if (compareIndices.includes(index)) fillColor = '#F59E0B';
        
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, barWidth - 2, barHeight);
        
        // Draw value
        ctx.fillStyle = '#0F172A';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(value, x + barWidth / 2, y - 5);
    });
}

// Draw graph nodes and edges
function drawGraph(nodes, edges, visitedNodes = [], currentNode = null) {
    const ctx = VisualizationState.ctx;
    const canvas = VisualizationState.canvas;
    clearCanvas();
    
    const nodeRadius = 30;
    
    // Draw edges first
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    edges.forEach(([from, to]) => {
        const fromNode = nodes[from];
        const toNode = nodes[to];
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();
    });
    
    // Draw nodes
    nodes.forEach((node, index) => {
        let fillColor = '#E0E7FF';
        if (visitedNodes.includes(index)) fillColor = '#10B981';
        if (currentNode === index) fillColor = '#F59E0B';
        
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw label
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label || index, node.x, node.y);
    });
}

// Draw stack (vertical LIFO structure)
function drawStack(stack, highlightTop = false) {
    const ctx = VisualizationState.ctx;
    const canvas = VisualizationState.canvas;
    
    const boxWidth = 100;
    const boxHeight = 50;
    const startX = canvas.width / 2 - boxWidth / 2;
    const startY = canvas.height - 80;
    
    // Draw stack elements from bottom to top
    stack.forEach((value, index) => {
        const y = startY - index * (boxHeight + 5);
        
        let fillColor = '#E0E7FF';
        if (highlightTop && index === stack.length - 1) fillColor = '#F59E0B';
        
        ctx.fillStyle = fillColor;
        ctx.fillRect(startX, y, boxWidth, boxHeight);
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, y, boxWidth, boxHeight);
        
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, startX + boxWidth / 2, y + boxHeight / 2);
    });
    
    // Draw TOP pointer
    if (stack.length > 0) {
        const topY = startY - (stack.length - 1) * (boxHeight + 5);
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('<- TOP', startX + boxWidth + 10, topY + boxHeight / 2);
    }
    
    // Draw stack label
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`Stack (Size: ${stack.length})`, startX + boxWidth / 2, startY + boxHeight + 30);
}

// Draw queue (horizontal FIFO structure)
function drawQueue(queue, highlightFront = false, highlightRear = false) {
    const ctx = VisualizationState.ctx;
    const canvas = VisualizationState.canvas;
    
    const boxWidth = 80;
    const boxHeight = 60;
    const startX = 100;
    const startY = canvas.height / 2 - boxHeight / 2;
    
    // Draw queue elements from front to rear
    queue.forEach((value, index) => {
        const x = startX + index * (boxWidth + 5);
        
        let fillColor = '#E0E7FF';
        if (highlightFront && index === 0) fillColor = '#10B981';
        if (highlightRear && index === queue.length - 1) fillColor = '#F59E0B';
        
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, startY, boxWidth, boxHeight);
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, startY, boxWidth, boxHeight);
        
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, x + boxWidth / 2, startY + boxHeight / 2);
    });
    
    // Draw FRONT pointer
    if (queue.length > 0) {
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('FRONT v', startX + boxWidth / 2, startY - 20);
    }
    
    // Draw REAR pointer
    if (queue.length > 0) {
        const rearX = startX + (queue.length - 1) * (boxWidth + 5);
        ctx.fillStyle = '#F59E0B';
        ctx.textAlign = 'center';
        ctx.fillText('REAR v', rearX + boxWidth / 2, startY - 20);
    }
    
    // Draw queue label
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`Queue (Size: ${queue.length})`, canvas.width / 2, startY + boxHeight + 30);
}

// Draw binary tree
function drawBinaryTree(root, highlightNode = null) {
    const ctx = VisualizationState.ctx;
    const canvas = VisualizationState.canvas;
    clearCanvas();
    
    const nodeRadius = 25;
    const levelHeight = 80;
    
    function drawNode(node, x, y, level, offset) {
        if (!node) return;
        
        // Draw edges to children
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        
        if (node.left) {
            const childX = x - offset;
            const childY = y + levelHeight;
            ctx.beginPath();
            ctx.moveTo(x, y + nodeRadius);
            ctx.lineTo(childX, childY - nodeRadius);
            ctx.stroke();
            drawNode(node.left, childX, childY, level + 1, offset / 2);
        }
        
        if (node.right) {
            const childX = x + offset;
            const childY = y + levelHeight;
            ctx.beginPath();
            ctx.moveTo(x, y + nodeRadius);
            ctx.lineTo(childX, childY - nodeRadius);
            ctx.stroke();
            drawNode(node.right, childX, childY, level + 1, offset / 2);
        }
        
        // Draw node
        let fillColor = '#E0E7FF';
        if (highlightNode === node.value) fillColor = '#F59E0B';
        
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw value
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.value, x, y);
    }
    
    if (root) {
        drawNode(root, canvas.width / 2, 50, 0, canvas.width / 4);
    }
}

// ============================================
// SORTING ALGORITHMS
// ============================================

async function runBubbleSort() {
    initCanvas();
    const arr = payloadArray('data', [64, 34, 25, 12, 22, 11, 90, 88, 45, 50]);
    
    VisualizationState.isRunning = true;
    
    for (let i = 0; i < arr.length - 1; i++) {
        for (let j = 0; j < arr.length - i - 1; j++) {
            if (!shouldContinue()) return;
            await waitForUnpause();
            
            drawBars(arr, [], [j, j + 1]);
            await delay(VisualizationState.speed);
            
            if (arr[j] > arr[j + 1]) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                drawBars(arr, [j, j + 1], []);
                await delay(VisualizationState.speed);
            }
        }
        drawBars(arr, [arr.length - i - 1], []);
        await delay(VisualizationState.speed / 2);
    }
    
    drawBars(arr, Array.from({length: arr.length}, (_, i) => i), []);
    VisualizationState.isRunning = false;
}

async function runSelectionSort() {
    initCanvas();
    const arr = payloadArray('data', [64, 25, 12, 22, 11, 90, 45, 50, 34, 88]);
    
    VisualizationState.isRunning = true;
    
    for (let i = 0; i < arr.length - 1; i++) {
        let minIdx = i;
        
        for (let j = i + 1; j < arr.length; j++) {
            if (!shouldContinue()) return;
            await waitForUnpause();
            
            drawBars(arr, [minIdx], [j]);
            await delay(VisualizationState.speed);
            
            if (arr[j] < arr[minIdx]) {
                minIdx = j;
            }
        }
        
        if (minIdx !== i) {
            [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
            drawBars(arr, [i, minIdx], []);
            await delay(VisualizationState.speed);
        }
    }
    
    drawBars(arr, Array.from({length: arr.length}, (_, i) => i), []);
    VisualizationState.isRunning = false;
}

async function runInsertionSort() {
    initCanvas();
    const arr = payloadArray('data', [12, 11, 13, 5, 6, 7, 45, 23, 34, 67]);
    
    VisualizationState.isRunning = true;
    
    for (let i = 1; i < arr.length; i++) {
        const key = arr[i];
        let j = i - 1;
        
        while (j >= 0 && arr[j] > key) {
            if (!shouldContinue()) return;
            await waitForUnpause();
            
            drawBars(arr, [j + 1], [j]);
            await delay(VisualizationState.speed);
            
            arr[j + 1] = arr[j];
            j--;
        }
        
        arr[j + 1] = key;
        drawBars(arr, [j + 1], []);
        await delay(VisualizationState.speed);
    }
    
    drawBars(arr, Array.from({length: arr.length}, (_, i) => i), []);
    VisualizationState.isRunning = false;
}

async function runMergeSort() {
    initCanvas();
    const arr = payloadArray('data', [38, 27, 43, 3, 9, 82, 10, 45, 23, 67]);
    
    VisualizationState.isRunning = true;
    
    async function merge(arr, left, mid, right) {
        const leftArr = arr.slice(left, mid + 1);
        const rightArr = arr.slice(mid + 1, right + 1);
        
        let i = 0, j = 0, k = left;
        
        while (i < leftArr.length && j < rightArr.length) {
            if (!shouldContinue()) return;
            await waitForUnpause();
            
            drawBars(arr, [k], [left + i, mid + 1 + j]);
            await delay(VisualizationState.speed);
            
            if (leftArr[i] <= rightArr[j]) {
                arr[k] = leftArr[i];
                i++;
            } else {
                arr[k] = rightArr[j];
                j++;
            }
            k++;
        }
        
        while (i < leftArr.length) {
            arr[k] = leftArr[i];
            i++;
            k++;
        }
        
        while (j < rightArr.length) {
            arr[k] = rightArr[j];
            j++;
            k++;
        }
    }
    
    async function mergeSortHelper(arr, left, right) {
        if (left < right) {
            const mid = Math.floor((left + right) / 2);
            await mergeSortHelper(arr, left, mid);
            await mergeSortHelper(arr, mid + 1, right);
            await merge(arr, left, mid, right);
        }
    }
    
    await mergeSortHelper(arr, 0, arr.length - 1);
    drawBars(arr, Array.from({length: arr.length}, (_, i) => i), []);
    VisualizationState.isRunning = false;
}

async function runQuickSort() {
    initCanvas();
    const arr = payloadArray('data', [10, 80, 30, 90, 40, 50, 70, 20, 60, 15]);
    
    VisualizationState.isRunning = true;
    
    async function partition(arr, low, high) {
        const pivot = arr[high];
        let i = low - 1;
        
        for (let j = low; j < high; j++) {
            if (!shouldContinue()) return i + 1;
            await waitForUnpause();
            
            drawBars(arr, [high], [j]);
            await delay(VisualizationState.speed);
            
            if (arr[j] < pivot) {
                i++;
                [arr[i], arr[j]] = [arr[j], arr[i]];
                drawBars(arr, [i, j], [high]);
                await delay(VisualizationState.speed);
            }
        }
        
        [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
        drawBars(arr, [i + 1], []);
        await delay(VisualizationState.speed);
        
        return i + 1;
    }
    
    async function quickSortHelper(arr, low, high) {
        if (low < high) {
            const pi = await partition(arr, low, high);
            await quickSortHelper(arr, low, pi - 1);
            await quickSortHelper(arr, pi + 1, high);
        }
    }
    
    await quickSortHelper(arr, 0, arr.length - 1);
    drawBars(arr, Array.from({length: arr.length}, (_, i) => i), []);
    VisualizationState.isRunning = false;
}

async function runHeapSort() {
    initCanvas();
    const arr = payloadArray('data', [12, 11, 13, 5, 6, 7, 45, 23, 34, 67]);
    
    VisualizationState.isRunning = true;
    
    async function heapify(arr, n, i) {
        let largest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        
        if (left < n && arr[left] > arr[largest]) {
            largest = left;
        }
        
        if (right < n && arr[right] > arr[largest]) {
            largest = right;
        }
        
        if (largest !== i) {
            if (!shouldContinue()) return;
            await waitForUnpause();
            
            [arr[i], arr[largest]] = [arr[largest], arr[i]];
            drawBars(arr, [i, largest], []);
            await delay(VisualizationState.speed);
            
            await heapify(arr, n, largest);
        }
    }
    
    const n = arr.length;
    
    // Build heap
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        await heapify(arr, n, i);
    }
    
    // Extract elements from heap
    for (let i = n - 1; i > 0; i--) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        [arr[0], arr[i]] = [arr[i], arr[0]];
        drawBars(arr, [0, i], []);
        await delay(VisualizationState.speed);
        
        await heapify(arr, i, 0);
    }
    
    drawBars(arr, Array.from({length: arr.length}, (_, i) => i), []);
    VisualizationState.isRunning = false;
}

// ============================================
// SEARCHING ALGORITHMS
// ============================================

async function runLinearSearch() {
    initCanvas();
    const arr = payloadArray('data', [10, 23, 45, 70, 11, 15, 36, 48, 92, 81]);
    const defaultTarget = arr.length ? arr[Math.floor(arr.length / 2)] : 36;
    const target = payloadNumber('target', defaultTarget);
    
    clearCanvas();
    drawArray(arr);
    
    const ctx = VisualizationState.ctx;
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`Searching for: ${target}`, 50, 50);
    
    VisualizationState.isRunning = true;
    
    for (let i = 0; i < arr.length; i++) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        clearCanvas();
        drawArray(arr, [], [i]);
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 16px Inter';
        ctx.fillText(`Searching for: ${target}`, 50, 50);
        ctx.fillText(`Checking index ${i}: ${arr[i]}`, 50, 80);
        
        await delay(VisualizationState.speed);
        
        if (arr[i] === target) {
            clearCanvas();
            drawArray(arr, [i], []);
            ctx.fillStyle = '#10B981';
            ctx.font = 'bold 18px Inter';
            ctx.fillText(`[OK] Found at index ${i}!`, 50, 50);
            VisualizationState.isRunning = false;
            return;
        }
    }
    
    clearCanvas();
    drawArray(arr);
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 18px Inter';
    ctx.fillText(`[X] Not found`, 50, 50);
    VisualizationState.isRunning = false;
}

async function runBinarySearch() {
    initCanvas();
    const baseArr = payloadArray('data', [11, 15, 23, 36, 45, 48, 70, 81, 92, 100]);
    const arr = baseArr.slice().sort((a, b) => a - b);
    const defaultTarget = arr.length ? arr[Math.floor(arr.length / 2)] : 48;
    const target = payloadNumber('target', defaultTarget);
    
    clearCanvas();
    drawArray(arr);
    
    const ctx = VisualizationState.ctx;
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 16px Inter';
    ctx.fillText(`Searching for: ${target} (Sorted Array)`, 50, 50);
    
    VisualizationState.isRunning = true;
    
    let left = 0;
    let right = arr.length - 1;
    
    while (left <= right) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        const mid = Math.floor((left + right) / 2);
        
        clearCanvas();
        drawArray(arr, [], [left, mid, right]);
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 16px Inter';
        ctx.fillText(`Searching for: ${target}`, 50, 50);
        ctx.fillText(`Left: ${left}, Mid: ${mid}, Right: ${right}`, 50, 80);
        ctx.fillText(`arr[${mid}] = ${arr[mid]}`, 50, 110);
        
        await delay(VisualizationState.speed);
        
        if (arr[mid] === target) {
            clearCanvas();
            drawArray(arr, [mid], []);
            ctx.fillStyle = '#10B981';
            ctx.font = 'bold 18px Inter';
            ctx.fillText(`[OK] Found at index ${mid}!`, 50, 50);
            VisualizationState.isRunning = false;
            return;
        }
        
        if (arr[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    
    clearCanvas();
    drawArray(arr);
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 18px Inter';
    ctx.fillText(`[X] Not found`, 50, 50);
    VisualizationState.isRunning = false;
}

// ============================================
// GRAPH ALGORITHMS (BFS/DFS)
// ============================================

async function runBFS() {
    initCanvas();
    const fallbackNodes = [
        { x: 200, y: 100, label: '0' },
        { x: 100, y: 200, label: '1' },
        { x: 300, y: 200, label: '2' },
        { x: 100, y: 350, label: '3' },
        { x: 300, y: 350, label: '4' },
        { x: 500, y: 250, label: '5' }
    ];
    const fallbackConfig = {
        nodes: fallbackNodes,
        edges: [[0, 1], [0, 2], [1, 3], [2, 4], [2, 5]],
        start: 0
    };
    const config = graphConfigFromPayload(fallbackConfig);
    const nodes = config.nodes;
    const edges = config.edges;
    const startNode = config.start;
    const adjacencyList = {};
    for (let i = 0; i < nodes.length; i++) {
        adjacencyList[i] = [];
    }
    edges.forEach(([from, to]) => {
        adjacencyList[from].push(to);
        adjacencyList[to].push(from);
    });
    for (const key of Object.keys(adjacencyList)) {
        adjacencyList[key].sort((a, b) => Number(nodes[a].label) - Number(nodes[b].label));
    }
    
    VisualizationState.isRunning = true;
    
    const visited = [];
    const queue = [startNode];
    
    // Draw initial state
    drawGraph(nodes, edges, visited, null);
    
    // Draw queue visualization - mobile responsive
    const canvas = VisualizationState.canvas;
    const queueCanvas = document.createElement('div');
    queueCanvas.dataset.vizOverlay = 'true';
    queueCanvas.dataset.desktopMaxWidth = '300px';
    applyOverlayResponsiveStyles(queueCanvas);
    queueCanvas.innerHTML = '<strong style="color:var(--aq-primary);font-size:0.875rem;">BFS Queue (FIFO)</strong><div id="queueViz" style="margin-top:10px;font-size:0.875rem;"></div>';
    canvas.parentElement.appendChild(queueCanvas);
    
    function updateQueueViz() {
        const queueViz = document.getElementById('queueViz');
        if (queueViz) {
            queueViz.innerHTML = queue.map((node, idx) => {
                const color = idx === 0 ? 'var(--aq-accent)' : 'var(--aq-primary-light)';
                const textColor = idx === 0 ? 'var(--aq-viz-box-bg)' : 'var(--aq-viz-box-text)';
                return `<span style="display:inline-block;padding:6px 10px;margin:2px;background:${color};color:${textColor};border:2px solid var(--aq-primary);border-radius:4px;font-weight:bold;font-size:0.8125rem;">${node}</span>`;
            }).join(' -> ') || '<span style="color:var(--aq-viz-box-muted);">Empty</span>';
        }
    }
    
    updateQueueViz();
    await delay(VisualizationState.speed * 2);
    
    while (queue.length > 0) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        const current = queue.shift();
        updateQueueViz();
        
        if (visited.includes(current)) continue;
        
        visited.push(current);
        drawGraph(nodes, edges, visited, current);
        await delay(VisualizationState.speed);
        
        const neighbors = adjacencyList[current] || [];
        for (const neighbor of neighbors) {
            if (!visited.includes(neighbor) && !queue.includes(neighbor)) {
                queue.push(neighbor);
                updateQueueViz();
                await delay(VisualizationState.speed / 2);
            }
        }
    }
    
    drawGraph(nodes, edges, visited, null);
    VisualizationState.isRunning = false;
}

async function runDFS() {
    initCanvas();
    const fallbackNodes = [
        { x: 200, y: 100, label: '0' },
        { x: 100, y: 200, label: '1' },
        { x: 300, y: 200, label: '2' },
        { x: 100, y: 350, label: '3' },
        { x: 300, y: 350, label: '4' },
        { x: 500, y: 250, label: '5' }
    ];
    const fallbackConfig = {
        nodes: fallbackNodes,
        edges: [[0, 1], [0, 2], [1, 3], [2, 4], [2, 5]],
        start: 0
    };
    const config = graphConfigFromPayload(fallbackConfig);
    const nodes = config.nodes;
    const edges = config.edges;
    const startNode = config.start;
    const adjacencyList = {};
    for (let i = 0; i < nodes.length; i++) {
        adjacencyList[i] = [];
    }
    edges.forEach(([from, to]) => {
        adjacencyList[from].push(to);
        adjacencyList[to].push(from);
    });
    for (const key of Object.keys(adjacencyList)) {
        adjacencyList[key].sort((a, b) => Number(nodes[a].label) - Number(nodes[b].label));
    }
    
    VisualizationState.isRunning = true;
    
    const visited = [];
    const stack = [startNode];
    
    // Draw initial state
    drawGraph(nodes, edges, visited, null);
    
    // Draw stack visualization - mobile responsive
    const canvas = VisualizationState.canvas;
    const stackCanvas = document.createElement('div');
    stackCanvas.dataset.vizOverlay = 'true';
    stackCanvas.dataset.desktopMaxWidth = '220px';
    applyOverlayResponsiveStyles(stackCanvas);
    stackCanvas.innerHTML = '<strong style="color:var(--aq-primary);font-size:0.875rem;">DFS Stack (LIFO)</strong><div id="stackViz" style="margin-top:10px;font-size:0.875rem;"></div>';
    canvas.parentElement.appendChild(stackCanvas);
    
    function updateStackViz() {
        const stackViz = document.getElementById('stackViz');
        if (stackViz) {
            stackViz.innerHTML = stack.slice().reverse().map((node, idx) => {
                const color = idx === 0 ? 'var(--aq-warning)' : 'var(--aq-primary-light)';
                const textColor = idx === 0 ? 'var(--aq-viz-box-bg)' : 'var(--aq-viz-box-text)';
                return `<div style="padding:6px 10px;margin:2px;background:${color};color:${textColor};border:2px solid var(--aq-primary);border-radius:4px;font-weight:bold;text-align:center;font-size:0.8125rem;">${node}</div>`;
            }).join('') || '<span style="color:var(--aq-viz-box-muted);">Empty</span>';
            
            if (stack.length > 0) {
                stackViz.innerHTML += '<div style="color:var(--aq-danger);font-weight:bold;margin-top:5px;text-align:center;font-size:0.75rem;">^ TOP</div>';
            }
        }
    }
    
    updateStackViz();
    await delay(VisualizationState.speed * 2);
    
    while (stack.length > 0) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        const current = stack.pop();
        updateStackViz();
        
        if (visited.includes(current)) continue;
        
        visited.push(current);
        drawGraph(nodes, edges, visited, current);
        await delay(VisualizationState.speed);
        
        const neighbors = adjacencyList[current] || [];
        for (let i = neighbors.length - 1; i >= 0; i--) {
            const neighbor = neighbors[i];
            if (!visited.includes(neighbor) && !stack.includes(neighbor)) {
                stack.push(neighbor);
                updateStackViz();
                await delay(VisualizationState.speed / 2);
            }
        }
    }
    
    drawGraph(nodes, edges, visited, null);
    VisualizationState.isRunning = false;
}

// ============================================
// DATA STRUCTURE DEMOS
// ============================================

async function runStackDemo() {
    initCanvas();
    const stack = [];
    
    VisualizationState.isRunning = true;
    
    const operations = [
        { type: 'push', value: 10 },
        { type: 'push', value: 20 },
        { type: 'push', value: 30 },
        { type: 'pop' },
        { type: 'push', value: 40 },
        { type: 'pop' },
        { type: 'pop' }
    ];
    
    const ctx = VisualizationState.ctx;
    
    for (const op of operations) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        clearCanvas();
        
        if (op.type === 'push') {
            stack.push(op.value);
            ctx.fillStyle = '#2563EB';
            ctx.font = 'bold 18px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`PUSH(${op.value}) - Adding to TOP`, VisualizationState.canvas.width / 2, 30);
        } else {
            const popped = stack.pop();
            ctx.fillStyle = '#EF4444';
            ctx.font = 'bold 18px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`POP() - Removing from TOP: ${popped}`, VisualizationState.canvas.width / 2, 30);
        }
        
        drawStack(stack, true);
        
        ctx.fillStyle = '#64748B';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('LIFO: Last In, First Out', VisualizationState.canvas.width / 2, VisualizationState.canvas.height - 20);
        
        await delay(VisualizationState.speed * 1.5);
    }
    
    VisualizationState.isRunning = false;
}

async function runQueueDemo() {
    initCanvas();
    const queue = [];
    
    VisualizationState.isRunning = true;
    
    const operations = [
        { type: 'enqueue', value: 10 },
        { type: 'enqueue', value: 20 },
        { type: 'enqueue', value: 30 },
        { type: 'dequeue' },
        { type: 'enqueue', value: 40 },
        { type: 'dequeue' },
        { type: 'dequeue' }
    ];
    
    const ctx = VisualizationState.ctx;
    
    for (const op of operations) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        clearCanvas();
        
        if (op.type === 'enqueue') {
            queue.push(op.value);
            ctx.fillStyle = '#2563EB';
            ctx.font = 'bold 18px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`ENQUEUE(${op.value}) - Adding to REAR`, VisualizationState.canvas.width / 2, 30);
        } else {
            const dequeued = queue.shift();
            ctx.fillStyle = '#10B981';
            ctx.font = 'bold 18px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`DEQUEUE() - Removing from FRONT: ${dequeued}`, VisualizationState.canvas.width / 2, 30);
        }
        
        drawQueue(queue, op.type === 'dequeue', op.type === 'enqueue');
        
        ctx.fillStyle = '#64748B';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('FIFO: First In, First Out', VisualizationState.canvas.width / 2, VisualizationState.canvas.height - 20);
        
        await delay(VisualizationState.speed * 1.5);
    }
    
    VisualizationState.isRunning = false;
}

async function runBSTDemo() {
    initCanvas();
    
    class TreeNode {
        constructor(value) {
            this.value = value;
            this.left = null;
            this.right = null;
        }
    }
    
    let root = null;
    
    function insert(root, value) {
        if (!root) return new TreeNode(value);
        
        if (value < root.value) {
            root.left = insert(root.left, value);
        } else {
            root.right = insert(root.right, value);
        }
        
        return root;
    }
    
    VisualizationState.isRunning = true;
    
    const values = [50, 30, 70, 20, 40, 60, 80];
    
    const ctx = VisualizationState.ctx;
    
    for (const value of values) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        root = insert(root, value);
        
        clearCanvas();
        ctx.fillStyle = '#2563EB';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`Inserting: ${value}`, VisualizationState.canvas.width / 2, 30);
        
        drawBinaryTree(root, value);
        
        await delay(VisualizationState.speed * 1.5);
    }
    
    VisualizationState.isRunning = false;
}

// ============================================
// DIJKSTRA'S ALGORITHM
// ============================================

async function runDijkstra() {
    initCanvas();
    const fallbackConfig = {
        nodes: [
            { x: 100, y: 250, label: 'A' },
            { x: 250, y: 150, label: 'B' },
            { x: 250, y: 350, label: 'C' },
            { x: 400, y: 150, label: 'D' },
            { x: 400, y: 350, label: 'E' },
            { x: 550, y: 250, label: 'F' }
        ],
        edges: [
            { from: 0, to: 1, weight: 4 },
            { from: 0, to: 2, weight: 2 },
            { from: 1, to: 3, weight: 5 },
            { from: 2, to: 4, weight: 3 },
            { from: 3, to: 5, weight: 1 },
            { from: 4, to: 5, weight: 6 }
        ],
        source: 0,
        target: 5
    };
    const config = weightedGraphConfigFromPayload(fallbackConfig);
    const nodes = config.nodes;
    const edges = config.edges;
    const source = config.source;
    const target = config.target;
    
    VisualizationState.isRunning = true;
    
    const distances = Array(nodes.length).fill(Infinity);
    distances[source] = 0;
    const visited = [];
    const previous = Array(nodes.length).fill(null);
    
    const ctx = VisualizationState.ctx;
    
    function drawDijkstra(currentNode = null) {
        clearCanvas();
        
        // Draw edges with weights
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.font = '12px Inter';
        ctx.fillStyle = '#64748B';
        
        edges.forEach(edge => {
            const from = nodes[edge.from];
            const to = nodes[edge.to];
            
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            
            // Draw weight
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            ctx.fillText(edge.weight, midX, midY);
        });
        
        // Draw nodes
        nodes.forEach((node, index) => {
            let fillColor = '#E0E7FF';
            if (visited.includes(index)) fillColor = '#10B981';
            if (currentNode === index) fillColor = '#F59E0B';
            
            ctx.fillStyle = fillColor;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2563EB';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw label and distance
            ctx.fillStyle = '#0F172A';
            ctx.font = 'bold 16px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, node.x, node.y - 5);
            
            ctx.font = '12px Inter';
            const dist = distances[index] === Infinity ? 'INF' : distances[index];
            ctx.fillText(dist, node.x, node.y + 12);
        });
    }
    
    drawDijkstra();
    await delay(VisualizationState.speed * 2);
    
    while (visited.length < nodes.length) {
        if (!shouldContinue()) return;
        await waitForUnpause();
        
        // Find unvisited node with minimum distance
        let minDist = Infinity;
        let minNode = -1;
        
        for (let i = 0; i < nodes.length; i++) {
            if (!visited.includes(i) && distances[i] < minDist) {
                minDist = distances[i];
                minNode = i;
            }
        }
        
        if (minNode === -1) break;
        
        visited.push(minNode);
        drawDijkstra(minNode);
        
        ctx.fillStyle = '#2563EB';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`Visiting: ${nodes[minNode].label} (Distance: ${distances[minNode]})`, 20, 30);
        
        await delay(VisualizationState.speed);
        
        // Update distances to neighbors (undirected for challenge payloads)
        edges.forEach(edge => {
            if (edge.from === minNode) {
                const newDist = distances[minNode] + edge.weight;
                if (newDist < distances[edge.to]) {
                    distances[edge.to] = newDist;
                    previous[edge.to] = minNode;
                }
            }
            if (edge.to === minNode) {
                const newDist = distances[minNode] + edge.weight;
                if (newDist < distances[edge.from]) {
                    distances[edge.from] = newDist;
                    previous[edge.from] = minNode;
                }
            }
        });
        
        drawDijkstra(minNode);
        await delay(VisualizationState.speed);
    }
    
    drawDijkstra();
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 18px Inter';
    ctx.textAlign = 'center';
    const targetDistance = distances[target] === Infinity ? 'INF' : distances[target];
    ctx.fillText(`Shortest distance to ${nodes[target].label}: ${targetDistance}`, VisualizationState.canvas.width / 2, 30);
    
    VisualizationState.isRunning = false;
}

// ============================================
// CONTROL FUNCTIONS
// ============================================

function drawWeightedGraphSnapshot(nodes, edges, source = null) {
    clearCanvas();
    const ctx = VisualizationState.ctx;
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.font = '12px Inter';
    ctx.fillStyle = '#64748B';

    edges.forEach(edge => {
        const from = nodes[edge.from];
        const to = nodes[edge.to];
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        ctx.fillText(edge.weight, midX, midY);
    });

    nodes.forEach((node, index) => {
        const isSource = source === index;
        ctx.fillStyle = isSource ? '#F59E0B' : '#E0E7FF';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y);
    });
}

function renderPayloadPreview(algorithmType) {
    clearVisualizationOverlays();
    initCanvas();
    const payload = getChallengePayload();
    const ctx = VisualizationState.ctx;
    const mode = payload.mode;

    if (mode === 'graph') {
        if (Array.isArray(payload.weighted_edges) && payload.weighted_edges.length) {
            const config = weightedGraphConfigFromPayload(null);
            if (config) {
                drawWeightedGraphSnapshot(config.nodes, config.edges, config.source);
                return;
            }
        }
        if (Array.isArray(payload.edges) && payload.edges.length) {
            const config = graphConfigFromPayload(null);
            if (config) {
                const visited = [];
                const current = Number.isFinite(config.start) ? config.start : null;
                drawGraph(config.nodes, config.edges, visited, current);
                return;
            }
        }
    }

    if (mode === 'array') {
        const arr = payloadArray('data', []);
        const words = Array.isArray(payload.words) ? payload.words : [];
        if (arr.length) {
            drawArray(arr);
            if (Object.prototype.hasOwnProperty.call(payload, 'target')) {
                ctx.fillStyle = '#64748B';
                ctx.font = 'bold 16px Inter';
                ctx.textAlign = 'left';
                ctx.fillText(`Target: ${payload.target}`, 50, 50);
            }
            return;
        }
        if (words.length) {
            clearCanvas();
            ctx.fillStyle = '#2563EB';
            ctx.font = 'bold 18px Inter';
            ctx.textAlign = 'left';
            ctx.fillText('String Inputs', 50, 50);
            ctx.fillStyle = '#0F172A';
            ctx.font = '15px Inter';
            words.slice(0, 6).forEach((word, idx) => {
                ctx.fillText(`${idx + 1}. ${word}`, 50, 90 + idx * 28);
            });
            return;
        }
    }

    clearCanvas();
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 18px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(
        `Click Start to visualize ${String(algorithmType || '').replace(/_/g, ' ').toUpperCase()}`,
        VisualizationState.canvas.width / 2,
        VisualizationState.canvas.height / 2
    );
}

function startVisualization(algorithmType) {
    VisualizationState.isRunning = false;
    VisualizationState.isPaused = false;
    clearVisualizationOverlays();
    
    // Map algorithm types to functions
    const algorithmMap = {
        'bubble_sort': runBubbleSort,
        'selection_sort': runSelectionSort,
        'insertion_sort': runInsertionSort,
        'merge_sort': runMergeSort,
        'quick_sort': runQuickSort,
        'heap_sort': runHeapSort,
        'linear_search': runLinearSearch,
        'binary_search': runBinarySearch,
        'bfs': runBFS,
        'dfs': runDFS,
        'dijkstra': runDijkstra,
        'astar': runDijkstra,
        'stack': runStackDemo,
        'queue': runQueueDemo,
        'bst': runBSTDemo
    };
    
    const runFunction = algorithmMap[algorithmType];
    
    if (runFunction) {
        runFunction();
    } else {
        console.warn(`No animation mapped for: ${algorithmType}`);
        renderPayloadPreview(algorithmType);
    }
}

function pauseVisualization() {
    VisualizationState.isPaused = !VisualizationState.isPaused;
}

function resetVisualization() {
    VisualizationState.isRunning = false;
    VisualizationState.isPaused = false;
    clearVisualizationOverlays();
    renderPayloadPreview('');
}

function setSpeed(speed) {
    const normalized = Number(speed);
    if (Number.isNaN(normalized)) {
        return;
    }
    VisualizationState.speed = 1000 - Math.min(900, Math.max(100, normalized));
}

function getVisualizationState() {
    return {
        isRunning: VisualizationState.isRunning,
        isPaused: VisualizationState.isPaused,
        speed: VisualizationState.speed
    };
}

// Export functions for global access
window.VisualizationEngine = {
    start: startVisualization,
    pause: pauseVisualization,
    reset: resetVisualization,
    setSpeed: setSpeed,
    getState: getVisualizationState,
    setChallengeContext: setChallengeContext,
    renderPreview: renderPayloadPreview
};
