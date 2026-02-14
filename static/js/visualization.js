/* ============================================
   VISUALIZATION.JS — AlgoQuest Algorithm Visualizer v3.0
   Interactive Graphical Algorithm Demonstrations
   Supports: BFS, DFS, A*, Minimax
   ============================================ */

class AlgorithmVisualizer {
    constructor(containerId, algorithm) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Visualization container not found');
            return;
        }
        
        this.algorithm = algorithm;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isPlaying = false;
        this.currentStep = 0;
        this.steps = [];
        this.speed = 800; // ms per step
        
        this.init();
    }
    
    init() {
        this.createControls();
        this.createCanvas();
        this.setupAlgorithm();
    }
    
    createControls() {
        const controlsHTML = `
            <div class="viz-controls mb-3" style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
                <button id="vizPlay" class="btn btn-success btn-sm px-3">
                    <i class="bi bi-play-fill"></i> Play
                </button>
                <button id="vizPause" class="btn btn-warning btn-sm px-3" disabled>
                    <i class="bi bi-pause-fill"></i> Pause
                </button>
                <button id="vizReset" class="btn btn-secondary btn-sm px-3">
                    <i class="bi bi-arrow-counterclockwise"></i> Reset
                </button>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: auto;">
                    <label for="vizSpeed" style="font-size: 0.8125rem; font-weight: 500; color: var(--aq-text-secondary); margin: 0;">Speed:</label>
                    <input type="range" id="vizSpeed" min="200" max="2000" value="800" step="200" style="width: 100px;">
                    <span id="vizSpeedLabel" style="font-size: 0.8125rem; font-weight: 600; color: var(--aq-primary); min-width: 50px;">1x</span>
                </div>
            </div>
            <div id="vizStatus" class="mb-2" style="font-size: 0.875rem; font-weight: 500; color: var(--aq-text-secondary); min-height: 24px;"></div>
        `;
        
        const controlsDiv = document.createElement('div');
        controlsDiv.innerHTML = controlsHTML;
        this.container.insertBefore(controlsDiv, this.container.firstChild);
        
        // Event listeners
        document.getElementById('vizPlay').addEventListener('click', () => this.play());
        document.getElementById('vizPause').addEventListener('click', () => this.pause());
        document.getElementById('vizReset').addEventListener('click', () => this.reset());
        document.getElementById('vizSpeed').addEventListener('input', (e) => {
            this.speed = 2200 - parseInt(e.target.value);
            const speedLabel = document.getElementById('vizSpeedLabel');
            const speedX = (2200 - this.speed) / 400;
            speedLabel.textContent = speedX.toFixed(1) + 'x';
        });
    }
    
    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = Math.min(this.container.clientWidth - 40, 800);
        this.canvas.height = 400;
        this.canvas.style.border = '1px solid var(--aq-border)';
        this.canvas.style.borderRadius = 'var(--aq-radius-md)';
        this.canvas.style.background = 'linear-gradient(135deg, #1E293B, #0F172A)';
        this.canvas.style.boxShadow = 'var(--aq-shadow)';
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
    }
    
    setupAlgorithm() {
        switch(this.algorithm) {
            case 'bfs':
                this.setupBFS();
                break;
            case 'dfs':
                this.setupDFS();
                break;
            case 'astar':
                this.setupAStar();
                break;
            case 'minimax':
                this.setupMinimax();
                break;
            default:
                this.setupBFS();
        }
        this.draw();
    }
    
    /* ============================================
       BFS VISUALIZATION
       ============================================ */
    
    setupBFS() {
        // Graph structure: nodes and edges
        this.nodes = [
            { id: 'A', x: 150, y: 100, visited: false, inQueue: false },
            { id: 'B', x: 100, y: 200, visited: false, inQueue: false },
            { id: 'C', x: 200, y: 200, visited: false, inQueue: false },
            { id: 'D', x: 50, y: 300, visited: false, inQueue: false },
            { id: 'E', x: 150, y: 300, visited: false, inQueue: false },
            { id: 'F', x: 250, y: 300, visited: false, inQueue: false }
        ];
        
        this.edges = [
            ['A', 'B'], ['A', 'C'],
            ['B', 'D'], ['B', 'E'],
            ['C', 'F']
        ];
        
        this.queue = [];
        
        // Generate BFS steps
        this.steps = [
            { action: 'start', node: 'A', queue: ['A'], message: 'Start at node A, add to queue' },
            { action: 'visit', node: 'A', queue: ['B', 'C'], message: 'Visit A, enqueue neighbors B, C' },
            { action: 'visit', node: 'B', queue: ['C', 'D', 'E'], message: 'Visit B, enqueue neighbors D, E' },
            { action: 'visit', node: 'C', queue: ['D', 'E', 'F'], message: 'Visit C, enqueue neighbor F' },
            { action: 'visit', node: 'D', queue: ['E', 'F'], message: 'Visit D (no new neighbors)' },
            { action: 'visit', node: 'E', queue: ['F'], message: 'Visit E (no new neighbors)' },
            { action: 'visit', node: 'F', queue: [], message: 'Visit F, queue empty' },
            { action: 'complete', queue: [], message: '✓ BFS traversal complete: A → B → C → D → E → F' }
        ];
    }
    
    drawBFS() {
        const step = this.steps[this.currentStep];
        
        // Draw edges
        this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        this.ctx.lineWidth = 2;
        this.edges.forEach(([from, to]) => {
            const fromNode = this.nodes.find(n => n.id === from);
            const toNode = this.nodes.find(n => n.id === to);
            this.ctx.beginPath();
            this.ctx.moveTo(fromNode.x, fromNode.y);
            this.ctx.lineTo(toNode.x, toNode.y);
            this.ctx.stroke();
        });
        
        // Draw nodes
        this.nodes.forEach(node => {
            let fillColor = '#1E293B';
            let strokeColor = '#64748B';
            
            if (step && step.node === node.id && step.action === 'visit') {
                fillColor = '#10B981'; // Visiting
                strokeColor = '#059669';
            } else if (node.visited) {
                fillColor = '#2563EB'; // Visited
                strokeColor = '#1E40AF';
            } else if (node.inQueue) {
                fillColor = '#F59E0B'; // In queue
                strokeColor = '#D97706';
            }
            
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 25, 0, Math.PI * 2);
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Node label
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Inter';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.id, node.x, node.y);
        });
        
        // Draw queue visualization
        if (step && step.queue) {
            this.ctx.fillStyle = '#F1F5F9';
            this.ctx.font = '14px Inter';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Queue: [' + step.queue.join(', ') + ']', 400, 50);
        }
        
        // Draw legend
        this.drawLegend([
            { color: '#10B981', label: 'Current' },
            { color: '#2563EB', label: 'Visited' },
            { color: '#F59E0B', label: 'In Queue' },
            { color: '#1E293B', label: 'Unvisited' }
        ], 400, 100);
    }
    
    /* ============================================
       DFS VISUALIZATION
       ============================================ */
    
    setupDFS() {
        this.nodes = [
            { id: 'A', x: 150, y: 100, visited: false },
            { id: 'B', x: 100, y: 200, visited: false },
            { id: 'C', x: 200, y: 200, visited: false },
            { id: 'D', x: 50, y: 300, visited: false },
            { id: 'E', x: 150, y: 300, visited: false },
            { id: 'F', x: 250, y: 300, visited: false }
        ];
        
        this.edges = [
            ['A', 'B'], ['A', 'C'],
            ['B', 'D'], ['B', 'E'],
            ['C', 'F']
        ];
        
        this.steps = [
            { action: 'start', node: 'A', stack: ['A'], path: ['A'], message: 'Start at node A' },
            { action: 'visit', node: 'B', stack: ['A', 'B'], path: ['A', 'B'], message: 'Go deep: A → B' },
            { action: 'visit', node: 'D', stack: ['A', 'B', 'D'], path: ['A', 'B', 'D'], message: 'Go deep: B → D' },
            { action: 'backtrack', node: 'B', stack: ['A', 'B'], path: ['A', 'B', 'D'], message: 'Backtrack to B' },
            { action: 'visit', node: 'E', stack: ['A', 'B', 'E'], path: ['A', 'B', 'D', 'E'], message: 'Visit E from B' },
            { action: 'backtrack', node: 'A', stack: ['A'], path: ['A', 'B', 'D', 'E'], message: 'Backtrack to A' },
            { action: 'visit', node: 'C', stack: ['A', 'C'], path: ['A', 'B', 'D', 'E', 'C'], message: 'Visit C from A' },
            { action: 'visit', node: 'F', stack: ['A', 'C', 'F'], path: ['A', 'B', 'D', 'E', 'C', 'F'], message: 'Visit F from C' },
            { action: 'complete', stack: [], path: ['A', 'B', 'D', 'E', 'C', 'F'], message: '✓ DFS complete' }
        ];
    }
    
    drawDFS() {
        const step = this.steps[this.currentStep];
        
        // Draw edges
        this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        this.ctx.lineWidth = 2;
        this.edges.forEach(([from, to]) => {
            const fromNode = this.nodes.find(n => n.id === from);
            const toNode = this.nodes.find(n => n.id === to);
            this.ctx.beginPath();
            this.ctx.moveTo(fromNode.x, fromNode.y);
            this.ctx.lineTo(toNode.x, toNode.y);
            this.ctx.stroke();
        });
        
        // Highlight path
        if (step && step.path) {
            this.ctx.strokeStyle = '#10B981';
            this.ctx.lineWidth = 3;
            for (let i = 0; i < step.path.length - 1; i++) {
                const fromNode = this.nodes.find(n => n.id === step.path[i]);
                const toNode = this.nodes.find(n => n.id === step.path[i + 1]);
                if (fromNode && toNode) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(fromNode.x, fromNode.y);
                    this.ctx.lineTo(toNode.x, toNode.y);
                    this.ctx.stroke();
                }
            }
        }
        
        // Draw nodes
        this.nodes.forEach(node => {
            let fillColor = '#1E293B';
            let strokeColor = '#64748B';
            
            if (step && step.node === node.id) {
                fillColor = '#EF4444'; // Current
                strokeColor = '#DC2626';
            } else if (step && step.path && step.path.includes(node.id)) {
                fillColor = '#2563EB'; // Visited
                strokeColor = '#1E40AF';
            }
            
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 25, 0, Math.PI * 2);
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Inter';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.id, node.x, node.y);
        });
        
        // Draw stack
        if (step && step.stack) {
            this.ctx.fillStyle = '#F1F5F9';
            this.ctx.font = '14px Inter';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Stack: [' + step.stack.join(', ') + ']', 400, 50);
        }
        
        this.drawLegend([
            { color: '#EF4444', label: 'Current' },
            { color: '#2563EB', label: 'Visited' },
            { color: '#1E293B', label: 'Unvisited' }
        ], 400, 100);
    }
    
    /* ============================================
       A* VISUALIZATION
       ============================================ */
    
    setupAStar() {
        this.gridSize = 10;
        this.cellSize = 35;
        this.grid = [];
        
        // Initialize grid
        for (let y = 0; y < this.gridSize; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                this.grid[y][x] = {
                    x, y,
                    isWall: false,
                    isStart: x === 1 && y === 1,
                    isGoal: x === 8 && y === 8,
                    inOpen: false,
                    inClosed: false,
                    isPath: false,
                    g: 0, h: 0, f: 0
                };
            }
        }
        
        // Add some walls
        [[3,3], [3,4], [3,5], [4,5], [5,5], [6,5], [6,4], [6,3]].forEach(([x, y]) => {
            this.grid[y][x].isWall = true;
        });
        
        this.steps = [
            { message: 'Initialize: Start (1,1), Goal (8,8)', openSet: [[1,1]], closedSet: [] },
            { message: 'Expand (1,1): Add neighbors to open set', openSet: [[1,2], [2,1]], closedSet: [[1,1]], current: [1,1] },
            { message: 'Select lowest f(n): (2,1)', openSet: [[1,2], [2,2], [3,1]], closedSet: [[1,1], [2,1]], current: [2,1] },
            { message: 'Continue expanding...', openSet: [[1,2], [2,2], [3,2]], closedSet: [[1,1], [2,1], [3,1]], current: [3,1] },
            { message: 'Navigate around obstacles', openSet: [[2,2], [3,2], [4,2]], closedSet: [[1,1], [2,1], [3,1], [1,2]], current: [1,2] },
            { message: 'Path found! Reconstruct shortest path', path: [[1,1], [2,1], [3,1], [4,2], [5,3], [6,4], [7,5], [8,6], [8,7], [8,8]] }
        ];
    }
    
    drawAStar() {
        const step = this.steps[this.currentStep];
        const offsetX = 20;
        const offsetY = 20;
        
        // Draw grid
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = this.grid[y][x];
                const px = offsetX + x * this.cellSize;
                const py = offsetY + y * this.cellSize;
                
                let fillColor = '#1E293B';
                
                if (cell.isWall) {
                    fillColor = '#475569';
                } else if (cell.isStart) {
                    fillColor = '#10B981';
                } else if (cell.isGoal) {
                    fillColor = '#EF4444';
                } else if (step && step.path && step.path.some(([px, py]) => px === x && py === y)) {
                    fillColor = '#F59E0B';
                } else if (step && step.current && step.current[0] === x && step.current[1] === y) {
                    fillColor = '#6366F1';
                } else if (step && step.closedSet && step.closedSet.some(([px, py]) => px === x && py === y)) {
                    fillColor = '#2563EB';
                } else if (step && step.openSet && step.openSet.some(([px, py]) => px === x && py === y)) {
                    fillColor = '#0EA5E9';
                }
                
                this.ctx.fillStyle = fillColor;
                this.ctx.fillRect(px, py, this.cellSize - 2, this.cellSize - 2);
                
                // Grid lines
                this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(px, py, this.cellSize - 2, this.cellSize - 2);
            }
        }
        
        this.drawLegend([
            { color: '#10B981', label: 'Start' },
            { color: '#EF4444', label: 'Goal' },
            { color: '#F59E0B', label: 'Path' },
            { color: '#6366F1', label: 'Current' },
            { color: '#0EA5E9', label: 'Open Set' },
            { color: '#2563EB', label: 'Closed Set' },
            { color: '#475569', label: 'Wall' }
        ], 400, 50);
    }
    
    /* ============================================
       MINIMAX VISUALIZATION
       ============================================ */
    
    setupMinimax() {
        this.tree = {
            value: null,
            isMax: true,
            children: [
                {
                    value: null,
                    isMax: false,
                    children: [
                        { value: 3, isMax: true, children: [] },
                        { value: 5, isMax: true, children: [] }
                    ]
                },
                {
                    value: null,
                    isMax: false,
                    children: [
                        { value: 2, isMax: true, children: [] },
                        { value: 9, isMax: true, children: [] }
                    ]
                },
                {
                    value: null,
                    isMax: false,
                    children: [
                        { value: 0, isMax: true, children: [] },
                        { value: 1, isMax: true, children: [] }
                    ]
                }
            ]
        };
        
        this.steps = [
            { message: 'Minimax tree: Max player at root', highlight: [] },
            { message: 'Evaluate leaf nodes', highlight: [3, 5, 2, 9, 0, 1] },
            { message: 'Min layer: select minimum from children', highlight: [[3,5], [2,9], [0,1]], minValues: [3, 2, 0] },
            { message: 'Max layer: select maximum = 3', highlight: [], maxValue: 3, bestMove: 0 },
            { message: '✓ Best move: Branch 1 (value = 3)', bestMove: 0 }
        ];
    }
    
    drawMinimax() {
        const step = this.steps[this.currentStep];
        
        // Draw tree structure
        const drawNode = (node, x, y, level, index, parentX, parentY) => {
            // Draw edge to parent
            if (parentX !== undefined) {
                this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(parentX, parentY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
            }
            
            // Draw node
            let fillColor = node.isMax ? '#2563EB' : '#EF4444';
            if (step && step.bestMove === index && level === 1) {
                fillColor = '#10B981';
            }
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 20, 0, Math.PI * 2);
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();
            this.ctx.strokeStyle = node.isMax ? '#1E40AF' : '#DC2626';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Node label
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 12px Inter';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const label = node.value !== null ? node.value.toString() : (node.isMax ? 'MAX' : 'MIN');
            this.ctx.fillText(label, x, y);
            
            // Draw children
            if (node.children && node.children.length > 0) {
                const childSpacing = 80;
                const startX = x - (node.children.length - 1) * childSpacing / 2;
                node.children.forEach((child, i) => {
                    drawNode(child, startX + i * childSpacing, y + 80, level + 1, i, x, y);
                });
            }
        };
        
        drawNode(this.tree, 400, 50, 0, 0);
        
        // Draw values from step
        if (step && step.minValues) {
            this.ctx.fillStyle = '#F1F5F9';
            this.ctx.font = '14px Inter';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Min values: [' + step.minValues.join(', ') + ']', 50, 350);
        }
        if (step && step.maxValue !== undefined) {
            this.ctx.fillText('Max value: ' + step.maxValue, 50, 370);
        }
        
        this.drawLegend([
            { color: '#2563EB', label: 'Max Node' },
            { color: '#EF4444', label: 'Min Node' },
            { color: '#10B981', label: 'Best Move' }
        ], 400, 300);
    }
    
    /* ============================================
       COMMON METHODS
       ============================================ */
    
    drawLegend(items, x, y) {
        this.ctx.font = '12px Inter';
        this.ctx.textAlign = 'left';
        items.forEach((item, i) => {
            const yPos = y + i * 25;
            
            // Color box
            this.ctx.fillStyle = item.color;
            this.ctx.fillRect(x, yPos, 16, 16);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, yPos, 16, 16);
            
            // Label
            this.ctx.fillStyle = '#F1F5F9';
            this.ctx.fillText(item.label, x + 22, yPos + 12);
        });
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        switch(this.algorithm) {
            case 'bfs':
                this.drawBFS();
                break;
            case 'dfs':
                this.drawDFS();
                break;
            case 'astar':
                this.drawAStar();
                break;
            case 'minimax':
                this.drawMinimax();
                break;
        }
        
        // Update status message
        const statusEl = document.getElementById('vizStatus');
        if (statusEl && this.steps[this.currentStep]) {
            statusEl.textContent = `Step ${this.currentStep + 1}/${this.steps.length}: ${this.steps[this.currentStep].message}`;
        }
        
        // Update node states for BFS/DFS
        if ((this.algorithm === 'bfs' || this.algorithm === 'dfs') && this.steps[this.currentStep]) {
            const step = this.steps[this.currentStep];
            this.nodes.forEach(node => {
                if (step.path && step.path.includes(node.id)) {
                    node.visited = true;
                }
                if (this.algorithm === 'bfs' && step.queue && step.queue.includes(node.id)) {
                    node.inQueue = true;
                } else {
                    node.inQueue = false;
                }
            });
        }
    }
    
    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        document.getElementById('vizPlay').disabled = true;
        document.getElementById('vizPause').disabled = false;
        
        const animate = () => {
            if (!this.isPlaying) return;
            
            if (this.currentStep < this.steps.length - 1) {
                this.currentStep++;
                this.draw();
                this.animationId = setTimeout(animate, this.speed);
            } else {
                this.pause();
            }
        };
        
        animate();
    }
    
    pause() {
        this.isPlaying = false;
        if (this.animationId) {
            clearTimeout(this.animationId);
            this.animationId = null;
        }
        
        document.getElementById('vizPlay').disabled = false;
        document.getElementById('vizPause').disabled = true;
    }
    
    reset() {
        this.pause();
        this.currentStep = 0;
        
        // Reset node states
        if (this.nodes) {
            this.nodes.forEach(node => {
                node.visited = false;
                node.inQueue = false;
            });
        }
        
        this.draw();
    }
}

// Auto-initialize if button exists
document.addEventListener('DOMContentLoaded', function() {
    const vizBtn = document.getElementById('runVisualizationBtn');
    if (vizBtn) {
        const algorithm = vizBtn.dataset.algorithm;
        const container = document.getElementById('visualizationOutput');
        
        if (container) {
            // Clear container
            container.innerHTML = '';
            container.style.minHeight = '500px';
            
            // Initialize visualizer
            const visualizer = new AlgorithmVisualizer('visualizationOutput', algorithm);
            
            // Remove old button, controls are now built-in
            vizBtn.style.display = 'none';
        }
    }
});

