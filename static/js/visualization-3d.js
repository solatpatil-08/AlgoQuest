/* ============================================
   VISUALIZATION-3D.JS - AlgoQuest 3D Algorithm Visualizer
   ============================================ */

(() => {
    const Visualization3DState = {
        isRunning: false,
        isPaused: false,
        speed: 500,
        animationId: null,
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        nodes: [],
        edges: [],
        container: null,
        materials: {},
        baseNodeSize: 12,
        clock: new THREE.Clock(),
        resizeBound: false,
        currentAlgorithm: '',
        activeConfig: null,
        axisGroup: null,
        legendOverlay: null,
        statusPanel: null,
        overlayDock: null,
        nodeStates: new Map(), // Tracks state of each node: unvisited, frontier, current, visited
        nodeHalos: new Map(), // Tracks halo/outline meshes for non-color cues
        nodeLabels: new Map(), // Tracks label sprites
        visitedOrder: [], // Order in which nodes were visited (for BFS/DFS)
        dimensionText: {
            bfs: 'X: graph layout | Y: graph layout | Z: traversal depth',
            dfs: 'X: graph layout | Y: graph layout | Z: traversal depth',
            dijkstra: 'X: node layout | Y: node layout | Z: path-cost context',
            astar: 'X: column | Y: row | Z: heuristic/cost',
            bst: 'X: BST inorder layout | Y: tree depth | Z: insertion depth cue',
        },
    };

    const ChallengeVisualization3DContext = {
        payload: {},
    };

    function setChallengeContext(payload) {
        ChallengeVisualization3DContext.payload =
            payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    }

    function getChallengePayload() {
        return ChallengeVisualization3DContext.payload || {};
    }

    function initScene() {
        Visualization3DState.scene = new THREE.Scene();
        Visualization3DState.scene.background = new THREE.Color(0x050d1c);
        if (typeof THREE.FogExp2 === 'function') {
            Visualization3DState.scene.fog = new THREE.FogExp2(0x050d1c, 0.0016);
        }
    }

    function initCamera(container) {
        const aspect = container.clientWidth / 500;
        Visualization3DState.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
        Visualization3DState.camera.position.set(0, 0, 250);
    }

    function initRenderer(container) {
        Visualization3DState.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        Visualization3DState.renderer.setSize(container.clientWidth, 500);
        Visualization3DState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        Visualization3DState.renderer.setClearColor(0x000000, 0);
        Visualization3DState.renderer.shadowMap.enabled = true;
        Visualization3DState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        if ('outputColorSpace' in Visualization3DState.renderer && THREE.SRGBColorSpace) {
            Visualization3DState.renderer.outputColorSpace = THREE.SRGBColorSpace;
        } else if ('outputEncoding' in Visualization3DState.renderer && THREE.sRGBEncoding) {
            Visualization3DState.renderer.outputEncoding = THREE.sRGBEncoding;
        }
        if ('toneMapping' in Visualization3DState.renderer && THREE.ACESFilmicToneMapping !== undefined) {
            Visualization3DState.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            Visualization3DState.renderer.toneMappingExposure = 1.08;
        }
        if ('physicallyCorrectLights' in Visualization3DState.renderer) {
            Visualization3DState.renderer.physicallyCorrectLights = true;
        }
        const canvas = Visualization3DState.renderer.domElement;
        canvas.classList.add('aq-3d-canvas');
        canvas.setAttribute('data-viz-canvas', '3d');
        container.appendChild(canvas);
    }

    function initLighting() {
        const scene = Visualization3DState.scene;
        if (!scene) {
            return;
        }

        const ambientLight = new THREE.AmbientLight(0x9cb9ff, 0.32);
        scene.add(ambientLight);

        const hemisphereLight = new THREE.HemisphereLight(0x8fd3ff, 0x081628, 0.34);
        hemisphereLight.position.set(0, 180, 0);
        scene.add(hemisphereLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
        keyLight.position.set(130, 170, 210);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.bias = -0.00012;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.44);
        fillLight.position.set(-150, 110, 140);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0x22d3ee, 0.34);
        rimLight.position.set(-100, -130, -190);
        scene.add(rimLight);

        const topSpot = new THREE.SpotLight(0xffffff, 0.28, 900, Math.PI / 5, 0.36, 1.2);
        topSpot.position.set(0, 220, 120);
        scene.add(topSpot);
    }

    function initControls() {
        const camera = Visualization3DState.camera;
        const renderer = Visualization3DState.renderer;
        if (!camera || !renderer) {
            Visualization3DState.controls = null;
            return;
        }
        if (typeof THREE.OrbitControls !== 'function') {
            Visualization3DState.controls = null;
            return;
        }
        Visualization3DState.controls = new THREE.OrbitControls(camera, renderer.domElement);
        Visualization3DState.controls.enableDamping = true;
        Visualization3DState.controls.dampingFactor = 0.05;
        Visualization3DState.controls.minDistance = 50;
        Visualization3DState.controls.maxDistance = 500;
    }

    function defineMaterials() {
        const makeNodeMaterial = (config) => new THREE.MeshStandardMaterial({
            color: config.color,
            metalness: config.metalness,
            roughness: config.roughness,
            emissive: config.emissive,
            emissiveIntensity: config.emissiveIntensity,
            transparent: true,
            opacity: config.opacity,
        });

        Visualization3DState.materials = {
            default: makeNodeMaterial({
                color: 0x1d4ed8,
                metalness: 0.34,
                roughness: 0.28,
                emissive: 0x0a2a75,
                emissiveIntensity: 0.18,
                opacity: 0.96,
            }),
            visited: makeNodeMaterial({
                color: 0x16a34a,
                metalness: 0.28,
                roughness: 0.32,
                emissive: 0x064e3b,
                emissiveIntensity: 0.2,
                opacity: 0.97,
            }),
            current: makeNodeMaterial({
                color: 0xf59e0b,
                metalness: 0.28,
                roughness: 0.2,
                emissive: 0xf59e0b,
                emissiveIntensity: 0.52,
                opacity: 1,
            }),
            edge: new THREE.MeshStandardMaterial({
                color: 0x7b8fb4,
                roughness: 0.52,
                metalness: 0.22,
                transparent: true,
                opacity: 0.9,
            }),
            frontier: makeNodeMaterial({
                color: 0x06b6d4,
                metalness: 0.3,
                roughness: 0.22,
                emissive: 0x0c4a6e,
                emissiveIntensity: 0.24,
                opacity: 0.96,
            }),
            path: makeNodeMaterial({
                color: 0x9333ea,
                metalness: 0.34,
                roughness: 0.24,
                emissive: 0x581c87,
                emissiveIntensity: 0.2,
                opacity: 0.96,
            }),
        };
    }

    function safeCompareNodeIds(a, b) {
        const aNum = Number(a);
        const bNum = Number(b);
        const aIsNumeric = Number.isFinite(aNum);
        const bIsNumeric = Number.isFinite(bNum);
        
        if (aIsNumeric && bIsNumeric) {
            return aNum - bNum;
        }
        if (aIsNumeric) return -1;
        if (bIsNumeric) return 1;
        return String(a).localeCompare(String(b));
    }

    function nodeIdentity(nodeData, fallbackIndex) {
        if (!nodeData || typeof nodeData !== 'object') {
            return String(fallbackIndex);
        }
        if (nodeData.label !== undefined && nodeData.label !== null && String(nodeData.label) !== '') {
            return String(nodeData.label);
        }
        if (nodeData.id !== undefined && nodeData.id !== null && String(nodeData.id) !== '') {
            return String(nodeData.id);
        }
        return String(fallbackIndex);
    }

    function compareNodeIndicesByLabel(nodes, leftIndex, rightIndex) {
        return safeCompareNodeIds(
            nodeIdentity(nodes[leftIndex], leftIndex),
            nodeIdentity(nodes[rightIndex], rightIndex)
        );
    }

    function getNodeDisplayLabel(nodeIndex) {
        const config = Visualization3DState.activeConfig;
        const nodeData = config && Array.isArray(config.nodes) ? config.nodes[nodeIndex] : null;
        return nodeIdentity(nodeData, nodeIndex);
    }

    function buildNodeLayout(nodeIds, container) {
        const count = nodeIds.length || 1;
        const radius = Math.min(container.clientWidth, 500) / 3.5;
        return nodeIds.map((id, idx) => {
            const angle = (2 * Math.PI * idx) / count;
            return {
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle),
                z: 0,
                label: String(id),
                id: id,
            };
        });
    }

    function graphConfigFromPayload(defaultConfig, container) {
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

        const rawNodes =
            Array.isArray(payload.nodes) && payload.nodes.length
                ? payload.nodes
                : Array.from(discovered.values());
        const nodeIds = rawNodes.slice().sort(safeCompareNodeIds);
        const idToIndex = new Map(nodeIds.map((id, idx) => [id, idx]));

        const edges = rawEdges
            .map((edge) => {
                if (!Array.isArray(edge) || edge.length < 2) {
                    return null;
                }
                const from = idToIndex.get(edge[0]);
                const to = idToIndex.get(edge[1]);
                return from !== undefined && to !== undefined ? [from, to] : null;
            })
            .filter(Boolean);

        if (!edges.length || !nodeIds.length) {
            return defaultConfig;
        }

        const start = idToIndex.has(payload.start) ? idToIndex.get(payload.start) : 0;
        return {
            nodes: buildNodeLayout(nodeIds, container),
            edges: edges,
            start: start,
        };
    }

    function weightedGraphConfigFromPayload(defaultConfig, container) {
        const payload = getChallengePayload();
        const rawWeighted = Array.isArray(payload.weighted_edges) ? payload.weighted_edges : [];
        const rawEdges = rawWeighted.length
            ? rawWeighted
            : (Array.isArray(payload.edges) ? payload.edges : []);
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
        const rawNodes =
            Array.isArray(payload.nodes) && payload.nodes.length
                ? payload.nodes
                : Array.from(discovered.values());
        const nodeIds = rawNodes.slice().sort(safeCompareNodeIds);
        const idToIndex = new Map(nodeIds.map((id, idx) => [id, idx]));

        const edges = rawEdges
            .map((edge) => {
                if (!Array.isArray(edge) || edge.length < 2) {
                    return null;
                }
                const from = idToIndex.get(edge[0]);
                const to = idToIndex.get(edge[1]);
                if (from === undefined || to === undefined) {
                    return null;
                }
                const weight = edge.length >= 3 ? Number(edge[2]) : 1;
                return {
                    from,
                    to,
                    weight: Number.isFinite(weight) ? weight : 1,
                };
            })
            .filter(Boolean);

        if (!edges.length || !nodeIds.length) {
            return defaultConfig;
        }

        const source = idToIndex.has(payload.source) ? idToIndex.get(payload.source) : 0;
        const target = idToIndex.has(payload.target) ? idToIndex.get(payload.target) : nodeIds.length - 1;
        return {
            nodes: buildNodeLayout(nodeIds, container),
            edges,
            source,
            target,
        };
    }

    function astarGridConfigFromPayload(defaultConfig) {
        const payload = getChallengePayload();
        const rows = Number(payload.rows);
        const cols = Number(payload.cols);
        const blockedRaw = Array.isArray(payload.blocked) ? payload.blocked : [];
        if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows <= 0 || cols <= 0) {
            return defaultConfig;
        }

        const blocked = new Set(
            blockedRaw
                .filter((cell) => Array.isArray(cell) && cell.length >= 2)
                .map((cell) => `${Number(cell[0])},${Number(cell[1])}`)
        );

        const nodes = [];
        const cellToIndex = new Map();
        const spacing = 34;
        const startX = -((cols - 1) * spacing) / 2;
        const startY = ((rows - 1) * spacing) / 2;

        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                const key = `${r},${c}`;
                if (blocked.has(key)) {
                    continue;
                }
                const idx = nodes.length;
                nodes.push({
                    x: startX + (c * spacing),
                    y: startY - (r * spacing),
                    z: 0,
                    row: r,
                    col: c,
                    label: `${r},${c}`,
                    id: key,
                });
                cellToIndex.set(key, idx);
            }
        }

        if (!nodes.length) {
            return defaultConfig;
        }

        function resolveCell(row, col) {
            const key = `${row},${col}`;
            return cellToIndex.has(key) ? cellToIndex.get(key) : null;
        }

        const edges = [];
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        nodes.forEach((node, idx) => {
            directions.forEach(([dr, dc]) => {
                const nextRow = node.row + dr;
                const nextCol = node.col + dc;
                const nextIndex = resolveCell(nextRow, nextCol);
                if (nextIndex !== null && idx < nextIndex) {
                    edges.push({ from: idx, to: nextIndex, weight: 1 });
                }
            });
        });

        const start = resolveCell(0, 0) !== null ? resolveCell(0, 0) : 0;
        const targetCell = resolveCell(rows - 1, cols - 1);
        const target = targetCell !== null ? targetCell : nodes.length - 1;

        return {
            nodes,
            edges,
            source: start,
            target,
            grid: true,
        };
    }

    function bstConfigFromPayload(defaultConfig) {
        const payload = getChallengePayload();
        const rawSequence =
            Array.isArray(payload.insert_sequence) && payload.insert_sequence.length
                ? payload.insert_sequence
                : payload.data;
        const sequence = (Array.isArray(rawSequence) ? rawSequence : [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));
        if (!sequence.length) {
            return defaultConfig;
        }

        const nodeRecords = [];
        const edges = [];
        const insertionOrder = [];
        const treeNodes = [];
        let root = null;

        function createNode(value, depth, parent = null) {
            const index = nodeRecords.length;
            const record = {
                index,
                value,
                depth,
                parent,
                left: null,
                right: null,
                xOrder: 0,
            };
            nodeRecords.push(record);
            treeNodes[index] = record;
            return record;
        }

        sequence.forEach((value) => {
            if (!root) {
                root = createNode(value, 0, null);
                insertionOrder.push(root.index);
                return;
            }

            let cursor = root;
            while (cursor) {
                if (value < cursor.value) {
                    if (!cursor.left) {
                        const next = createNode(value, cursor.depth + 1, cursor.index);
                        cursor.left = next.index;
                        edges.push([cursor.index, next.index]);
                        insertionOrder.push(next.index);
                        return;
                    }
                    cursor = treeNodes[cursor.left];
                    continue;
                }
                if (value > cursor.value) {
                    if (!cursor.right) {
                        const next = createNode(value, cursor.depth + 1, cursor.index);
                        cursor.right = next.index;
                        edges.push([cursor.index, next.index]);
                        insertionOrder.push(next.index);
                        return;
                    }
                    cursor = treeNodes[cursor.right];
                    continue;
                }
                insertionOrder.push(cursor.index);
                return;
            }
        });

        if (!root || !nodeRecords.length) {
            return defaultConfig;
        }

        let inorderIndex = 0;
        function assignInorderX(nodeIndex) {
            if (!Number.isInteger(nodeIndex)) {
                return;
            }
            const node = treeNodes[nodeIndex];
            if (!node) {
                return;
            }
            assignInorderX(node.left);
            node.xOrder = inorderIndex;
            inorderIndex += 1;
            assignInorderX(node.right);
        }
        assignInorderX(root.index);

        const horizontalSpacing = 56;
        const verticalSpacing = 44;
        const depthSpacing = 16;
        const centerOffset = ((Math.max(1, inorderIndex) - 1) * horizontalSpacing) / 2;

        const nodes = nodeRecords.map((node) => ({
            x: (node.xOrder * horizontalSpacing) - centerOffset,
            y: -(node.depth * verticalSpacing),
            z: node.depth * depthSpacing,
            label: String(node.value),
            id: `${node.value}-${node.index}`,
        }));

        return {
            nodes,
            edges,
            start: root.index,
            insertionOrder,
        };
    }

    function resolveConfigForAlgorithm(algorithmType, container) {
        const normalized = String(algorithmType || '').toLowerCase();
        const traversalFallback = {
            nodes: buildNodeLayout([0, 1, 2, 3, 4, 5], container),
            edges: [[0, 1], [0, 2], [1, 3], [2, 4], [2, 5]],
            start: 0,
        };
        const weightedFallback = {
            nodes: buildNodeLayout([0, 1, 2, 3, 4, 5], container),
            edges: [
                { from: 0, to: 1, weight: 4 },
                { from: 0, to: 2, weight: 2 },
                { from: 1, to: 3, weight: 5 },
                { from: 2, to: 4, weight: 3 },
                { from: 3, to: 5, weight: 1 },
                { from: 4, to: 5, weight: 6 },
            ],
            source: 0,
            target: 5,
        };
        const bstFallback = {
            nodes: buildNodeLayout([5, 3, 7, 2, 4, 6, 8], container),
            edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]],
            start: 0,
            insertionOrder: [0, 1, 2, 3, 4, 5, 6],
        };
        if (normalized === 'bst') {
            return bstConfigFromPayload(bstFallback);
        }
        if (normalized === 'dijkstra') {
            return weightedGraphConfigFromPayload(weightedFallback, container);
        }
        if (normalized === 'astar') {
            const gridConfig = astarGridConfigFromPayload(null);
            if (gridConfig) {
                return gridConfig;
            }
            return weightedGraphConfigFromPayload(weightedFallback, container);
        }
        return graphConfigFromPayload(traversalFallback, container);
    }

    function edgeEndpoints(edgeEntry) {
        if (Array.isArray(edgeEntry)) {
            return { from: edgeEntry[0], to: edgeEntry[1], weight: 1 };
        }
        return {
            from: edgeEntry.from,
            to: edgeEntry.to,
            weight: Number.isFinite(Number(edgeEntry.weight)) ? Number(edgeEntry.weight) : 1,
        };
    }

    function buildUnweightedAdjacency(count, edges) {
        const adjacency = Array(count)
            .fill(0)
            .map(() => []);
        edges.forEach((edgeEntry) => {
            const edge = edgeEndpoints(edgeEntry);
            adjacency[edge.from].push(edge.to);
            adjacency[edge.to].push(edge.from);
        });
        return adjacency;
    }

    function buildWeightedAdjacency(count, edges) {
        const adjacency = Array(count)
            .fill(0)
            .map(() => []);
        edges.forEach((edgeEntry) => {
            const edge = edgeEndpoints(edgeEntry);
            adjacency[edge.from].push({ node: edge.to, weight: edge.weight });
            adjacency[edge.to].push({ node: edge.from, weight: edge.weight });
        });
        return adjacency;
    }

    function setNodeMaterial(index, materialKey) {
        const node = Visualization3DState.nodes[index];
        const material = Visualization3DState.materials[materialKey];
        if (!node || !material) {
            return;
        }
        // Dispose old material if it's a cloned instance
        if (node.material && node.material !== Visualization3DState.materials.default && 
            node.material !== Visualization3DState.materials.visited && 
            node.material !== Visualization3DState.materials.current && 
            node.material !== Visualization3DState.materials.frontier && 
            node.material !== Visualization3DState.materials.path && 
            node.material !== Visualization3DState.materials.edge && 
            typeof node.material.dispose === 'function') {
            node.material.dispose();
        }
        node.material = material;
    }

    function tracePath(previous, start, target) {
        if (!Array.isArray(previous) || start == null || target == null) {
            return [];
        }
        const path = [];
        let cursor = target;
        while (cursor !== null && cursor !== undefined) {
            path.push(cursor);
            if (cursor === start) {
                break;
            }
            cursor = previous[cursor];
        }
        if (path[path.length - 1] !== start) {
            return [];
        }
        return path.reverse();
    }

    function createNodeLabel(labelText) {
        const text = String(labelText);
        const canvas = document.createElement('canvas');
        canvas.width = 192;
        canvas.height = 96;
        const context = canvas.getContext('2d');
        if (!context) {
            return null;
        }

        context.fillStyle = 'rgba(2, 8, 23, 0.86)';
        context.fillRect(0, 0, 192, 96);
        context.strokeStyle = 'rgba(125, 211, 252, 0.95)';
        context.lineWidth = 2;
        context.strokeRect(2, 2, 188, 92);

        const fontSize = text.length <= 2 ? 48 : (text.length <= 4 ? 34 : 24);
        context.font = `700 ${fontSize}px Arial`;
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 96, 48);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(22, 11, 1);
        sprite.renderOrder = 5;

        return sprite;
    }

    function addLabelsToNodes(nodes) {
        clearNodeLabels();
        const scene = Visualization3DState.scene;
        if (!scene) {
            return;
        }
        Visualization3DState.nodes.forEach((nodeMesh, idx) => {
            const label = createNodeLabel(nodeIdentity(nodes[idx], idx));
            if (!label) {
                return;
            }
            label.position.copy(nodeMesh.position);
            label.position.y += Visualization3DState.baseNodeSize + 9;
            label.position.z += 3;
            scene.add(label);
            Visualization3DState.nodeLabels.set(idx, label);
        });
    }

    function clearNodeLabels() {
        const scene = Visualization3DState.scene;
        Visualization3DState.nodeLabels.forEach((label) => {
            if (scene) {
                scene.remove(label);
            }
            if (label.material && label.material.map && typeof label.material.map.dispose === 'function') {
                label.material.map.dispose();
            }
            if (label.material && typeof label.material.dispose === 'function') {
                label.material.dispose();
            }
        });
        Visualization3DState.nodeLabels.clear();
    }

    function createHaloRing(state) {
        const colors = {
            visited: 0x28a745, // green
            current: 0xffc107, // yellow
            frontier: 0x38bdf8, // cyan
            unvisited: 0x666666, // gray
        };
        const color = colors[state] || colors.unvisited;
        const geometry = new THREE.TorusGeometry(
            Visualization3DState.baseNodeSize + 8,
            1.5,
            16,
            20
        );
        const material = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: state === 'frontier',
        });
        const halo = new THREE.Mesh(geometry, material);
        halo.userData.state = state;
        return halo;
    }

    function updateNodeState(nodeIndex, newState) {
        if (nodeIndex < 0 || nodeIndex >= Visualization3DState.nodes.length) {
            return;
        }
        
        // Record the state change
        const oldState = Visualization3DState.nodeStates.get(nodeIndex) || 'unvisited';
        Visualization3DState.nodeStates.set(nodeIndex, newState);
        
        const node = Visualization3DState.nodes[nodeIndex];
        if (node) {
            // Update main material color
            if (newState === 'current') {
                node.material = Visualization3DState.materials.current;
            } else if (newState === 'visited') {
                node.material = Visualization3DState.materials.visited;
            } else if (newState === 'frontier') {
                node.material = Visualization3DState.materials.frontier;
            } else {
                node.material = Visualization3DState.materials.default;
            }
            
            // Update or create halo for non-color cue
            const scene = Visualization3DState.scene;
            if (scene) {
                const oldHalo = Visualization3DState.nodeHalos.get(nodeIndex);
                if (oldHalo) {
                    scene.remove(oldHalo);
                    if (oldHalo.geometry) oldHalo.geometry.dispose();
                    if (oldHalo.material) oldHalo.material.dispose();
                }
                
                if (newState !== 'unvisited') {
                    const halo = createHaloRing(newState);
                    halo.position.copy(node.position);
                    scene.add(halo);
                    Visualization3DState.nodeHalos.set(nodeIndex, halo);
                }
            }
            
            // Track visited order
            if (newState === 'visited' && oldState !== 'visited') {
                Visualization3DState.visitedOrder.push(getNodeDisplayLabel(nodeIndex));
            }
        }
    }

    function initializeNodeStates(nodeCount) {
        Visualization3DState.nodeStates.clear();
        Visualization3DState.nodeHalos.clear();
        Visualization3DState.visitedOrder = [];
        for (let i = 0; i < nodeCount; i++) {
            Visualization3DState.nodeStates.set(i, 'unvisited');
        }
    }

    function clearNodeStates() {
        Visualization3DState.nodeStates.forEach((state, nodeIndex) => {
            updateNodeState(nodeIndex, 'unvisited');
        });
        Visualization3DState.visitedOrder = [];
    }

    function getOrCreateOverlayDock() {
        if (!Visualization3DState.container) {
            return null;
        }
        if (Visualization3DState.overlayDock && Visualization3DState.overlayDock.parentElement) {
            return Visualization3DState.overlayDock;
        }
        const dock = document.createElement('div');
        dock.className = 'aq-3d-overlay-dock';
        Visualization3DState.container.appendChild(dock);
        Visualization3DState.overlayDock = dock;
        return dock;
    }

    function createStatusPanel(algorithm) {
        if (Visualization3DState.statusPanel && typeof Visualization3DState.statusPanel.remove === 'function') {
            Visualization3DState.statusPanel.remove();
            Visualization3DState.statusPanel = null;
        }
        const normalized = String(algorithm || '').toLowerCase();
        const statusTitle = normalized ? normalized.toUpperCase() : 'ALGORITHM';
        const frontierLabel = normalized === 'bfs'
            ? 'Queue'
            : (normalized === 'dfs'
                ? 'Stack'
                : (normalized === 'dijkstra'
                    ? 'Frontier'
                    : (normalized === 'bst' ? 'Insert Queue' : 'Open Set')));
        const visitedLabel = normalized === 'dijkstra'
            ? 'Settled'
            : (normalized === 'astar'
                ? 'Closed'
                : (normalized === 'bst' ? 'Inserted' : 'Visited'));

        const panel = document.createElement('div');
        panel.id = 'aq-3d-status-panel';
        panel.className = `aq-3d-status-panel aq-3d-status-panel--${normalized || 'generic'}`;
        const dijkstraExtraRow = normalized === 'dijkstra'
            ? `
            <div class="aq-3d-status-row aq-3d-status-extra">
                <span class="aq-3d-status-label">Target Dist</span>
                <span class="aq-3d-status-value" id="aq-3d-target-dist">inf</span>
            </div>
            <div class="aq-3d-status-row aq-3d-status-extra">
                <span class="aq-3d-status-label">Last Relax</span>
                <span class="aq-3d-status-value" id="aq-3d-relax-note">-</span>
            </div>
        `
            : '';
        const astarExtraRow = normalized === 'astar'
            ? `
            <div class="aq-3d-status-row aq-3d-status-extra">
                <span class="aq-3d-status-label">Best f</span>
                <span class="aq-3d-status-value" id="aq-3d-astar-bestf">-</span>
            </div>
            <div class="aq-3d-status-row aq-3d-status-extra">
                <span class="aq-3d-status-label">Goal g</span>
                <span class="aq-3d-status-value" id="aq-3d-astar-goalg">inf</span>
            </div>
        `
            : '';
        panel.innerHTML = `
            <div class="aq-3d-status-head">
                <div class="aq-3d-status-title">${statusTitle} Status</div>
                <div class="aq-3d-status-subtitle">Live traversal telemetry</div>
            </div>
            <div class="aq-3d-status-row aq-3d-status-current">
                <span class="aq-3d-status-label">Current Node</span>
                <span class="aq-3d-status-value" id="aq-3d-current-node">-</span>
            </div>
            <div class="aq-3d-status-row aq-3d-status-queue">
                <span class="aq-3d-status-label">${frontierLabel}</span>
                <span class="aq-3d-status-value" id="aq-3d-queue-content">[]</span>
            </div>
            <div class="aq-3d-status-row aq-3d-status-visited">
                <span class="aq-3d-status-label">${visitedLabel}</span>
                <span class="aq-3d-status-value" id="aq-3d-visited-order">-</span>
            </div>
            ${dijkstraExtraRow}
            ${astarExtraRow}
            <div class="aq-3d-status-counts">
                <span class="aq-3d-status-count-value" id="aq-3d-visited-count">0</span>
                <span class="aq-3d-status-count-separator">/</span>
                <span id="aq-3d-total-count">0</span>
                <span class="aq-3d-status-count-label">nodes explored</span>
            </div>
        `;
        const dock = getOrCreateOverlayDock();
        if (dock) {
            dock.appendChild(panel);
        } else if (Visualization3DState.container && typeof Visualization3DState.container.appendChild === 'function') {
            Visualization3DState.container.appendChild(panel);
        }
        Visualization3DState.statusPanel = panel;
    }

    function updateStatusPanel(currentNode, queue, visited, total, options = {}) {
        if (!Visualization3DState.statusPanel) return;

        const currentEl = document.getElementById('aq-3d-current-node');
        const queueEl = document.getElementById('aq-3d-queue-content');
        const visitedEl = document.getElementById('aq-3d-visited-order');
        const countEl = document.getElementById('aq-3d-visited-count');
        const totalEl = document.getElementById('aq-3d-total-count');
        const targetDistEl = document.getElementById('aq-3d-target-dist');
        const relaxNoteEl = document.getElementById('aq-3d-relax-note');
        const astarBestFEl = document.getElementById('aq-3d-astar-bestf');
        const astarGoalGEl = document.getElementById('aq-3d-astar-goalg');
        const queueItems = Array.isArray(queue) ? queue : [];
        const visitedText = typeof options.visitedText === 'string'
            ? options.visitedText
            : (Visualization3DState.visitedOrder.length > 0 ? Visualization3DState.visitedOrder.join(' -> ') : '-');
        const targetDistText = typeof options.targetDistText === 'string' ? options.targetDistText : null;
        const relaxText = typeof options.relaxText === 'string' ? options.relaxText : null;
        const astarBestFText = typeof options.astarBestFText === 'string' ? options.astarBestFText : null;
        const astarGoalGText = typeof options.astarGoalGText === 'string' ? options.astarGoalGText : null;

        if (currentEl) currentEl.textContent = currentNode !== null ? String(currentNode) : '-';
        if (queueEl) queueEl.textContent = '[' + queueItems.join(', ') + ']';
        if (visitedEl) visitedEl.textContent = visitedText;
        if (countEl) countEl.textContent = visited;
        if (totalEl) totalEl.textContent = total;
        if (targetDistEl && targetDistText !== null) {
            targetDistEl.textContent = targetDistText;
        }
        if (relaxNoteEl && relaxText !== null) {
            relaxNoteEl.textContent = relaxText;
        }
        if (astarBestFEl && astarBestFText !== null) {
            astarBestFEl.textContent = astarBestFText;
        }
        if (astarGoalGEl && astarGoalGText !== null) {
            astarGoalGEl.textContent = astarGoalGText;
        }
    }
    function disposeMaterial(material) {
        if (!material) {
            return;
        }
        if (Array.isArray(material)) {
            material.forEach((entry) => disposeMaterial(entry));
            return;
        }
        if (typeof material.dispose === 'function') {
            material.dispose();
        }
    }

    function clearGraphObjects() {
        const scene = Visualization3DState.scene;
        if (!scene) {
            Visualization3DState.nodes = [];
            Visualization3DState.edges = [];
            return;
        }

        // Clear halos
        Visualization3DState.nodeHalos.forEach((halo) => {
            scene.remove(halo);
            if (halo.geometry) halo.geometry.dispose();
            if (halo.material) halo.material.dispose();
        });
        Visualization3DState.nodeHalos.clear();
        clearNodeLabels();

        Visualization3DState.nodes.forEach((node) => {
            scene.remove(node);
            if (node.geometry && typeof node.geometry.dispose === 'function') {
                node.geometry.dispose();
            }
            // Dispose material only if it's a cloned instance (not a shared template)
            if (node.material && 
                node.material !== Visualization3DState.materials.default && 
                node.material !== Visualization3DState.materials.visited && 
                node.material !== Visualization3DState.materials.current && 
                node.material !== Visualization3DState.materials.frontier && 
                node.material !== Visualization3DState.materials.path && 
                typeof node.material.dispose === 'function') {
                node.material.dispose();
            }
        });

        Visualization3DState.edges.forEach((edge) => {
            scene.remove(edge);
            if (edge.geometry && typeof edge.geometry.dispose === 'function') {
                edge.geometry.dispose();
            }
            // Dispose material only if it's a cloned instance
            if (edge.material && 
                edge.material !== Visualization3DState.materials.edge &&
                typeof edge.material.dispose === 'function') {
                edge.material.dispose();
            }
        });

        if (Visualization3DState.axisGroup) {
            scene.remove(Visualization3DState.axisGroup);
            Visualization3DState.axisGroup = null;
        }

        // Clear status panel
        if (Visualization3DState.statusPanel) {
            Visualization3DState.statusPanel.remove();
            Visualization3DState.statusPanel = null;
        }
        if (Visualization3DState.overlayDock) {
            Visualization3DState.overlayDock.remove();
            Visualization3DState.overlayDock = null;
        }

        Visualization3DState.nodes = [];
        Visualization3DState.edges = [];
        Visualization3DState.nodeStates.clear();
        Visualization3DState.nodeLabels.clear();
        Visualization3DState.visitedOrder = [];
    }

    function createAxisHelpers() {
        const group = new THREE.Group();
        const axisLength = 100;
        
        // X axis (red)
        const xGeo = new THREE.BufferGeometry();
        xGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            -axisLength, 0, 0,
            axisLength, 0, 0
        ]), 3));
        const xMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
        group.add(new THREE.Line(xGeo, xMat));
        
        // Y axis (green)
        const yGeo = new THREE.BufferGeometry();
        yGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            0, -axisLength, 0,
            0, axisLength, 0
        ]), 3));
        const yMat = new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 });
        group.add(new THREE.Line(yGeo, yMat));
        
        // Z axis (blue)
        const zGeo = new THREE.BufferGeometry();
        zGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            0, 0, -axisLength,
            0, 0, axisLength
        ]), 3));
        const zMat = new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 2 });
        group.add(new THREE.Line(zGeo, zMat));
        
        return group;
    }

    function createLegendOverlay(algorithmType) {
        if (Visualization3DState.legendOverlay) {
            Visualization3DState.legendOverlay.remove();
            Visualization3DState.legendOverlay = null;
        }

        const normalized = String(algorithmType || '').toLowerCase();
        const overlay = document.createElement('div');
        overlay.className = `aq-3d-legend-overlay aq-3d-legend-overlay--${normalized || 'generic'}`;
        const dimText = Visualization3DState.dimensionText[normalized] || 'Interactive 3D visualization';
        const algorithmBadge = normalized ? normalized.toUpperCase() : 'GRAPH';

        overlay.innerHTML = `
            <div class="aq-3d-legend-content">
                <div class="aq-3d-legend-head">
                    <span class="aq-3d-legend-title">3D Axes</span>
                    <span class="aq-3d-legend-subtitle">${algorithmBadge} map</span>
                </div>
                <div class="aq-3d-dimensions">
                    <span class="aq-3d-dim-label">Interpretation</span>
                    <span class="aq-3d-dim-text">${dimText}</span>
                </div>
                <div class="aq-3d-node-states">
                    <div class="aq-3d-state-item">
                        <span class="aq-3d-state-dot aq-3d-state-dot--default"></span>
                        <span>Default</span>
                    </div>
                    <div class="aq-3d-state-item">
                        <span class="aq-3d-state-dot aq-3d-state-dot--frontier"></span>
                        <span>Frontier</span>
                    </div>
                    <div class="aq-3d-state-item">
                        <span class="aq-3d-state-dot aq-3d-state-dot--current"></span>
                        <span>Current</span>
                    </div>
                    <div class="aq-3d-state-item">
                        <span class="aq-3d-state-dot aq-3d-state-dot--visited"></span>
                        <span>Visited</span>
                    </div>
                    <div class="aq-3d-state-item">
                        <span class="aq-3d-state-dot aq-3d-state-dot--path"></span>
                        <span>Path</span>
                    </div>
                </div>
            </div>
        `;
        
        const dock = getOrCreateOverlayDock();
        if (dock) {
            dock.appendChild(overlay);
        } else {
            Visualization3DState.container.appendChild(overlay);
        }
        Visualization3DState.legendOverlay = overlay;
    }

    function animationTick() {
        Visualization3DState.animationId = requestAnimationFrame(animationTick);

        const delta = Visualization3DState.clock.getDelta();
        const controls = Visualization3DState.controls;
        const renderer = Visualization3DState.renderer;
        const scene = Visualization3DState.scene;
        const camera = Visualization3DState.camera;
        if (!renderer || !scene || !camera) {
            return;
        }

        Visualization3DState.nodes.forEach((node) => {
            if (node.material === Visualization3DState.materials.current) {
                const pulse = (Math.sin(Visualization3DState.clock.elapsedTime * 4) + 1) / 2;
                const scale = 1 + pulse * 0.2;
                node.scale.set(scale, scale, scale);
            } else {
                node.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 5);
            }
        });

        if (controls && typeof controls.update === 'function') {
            controls.update(delta);
        }
        renderer.render(scene, camera);
    }

    function onWindowResize() {
        const container = Visualization3DState.container;
        const camera = Visualization3DState.camera;
        const renderer = Visualization3DState.renderer;
        if (!container || !camera || !renderer) {
            return;
        }
        const width = container.clientWidth;
        const height = 500;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function waitForUnpause() {
        while (Visualization3DState.isPaused && Visualization3DState.isRunning) {
            await delay(80);
        }
    }

    async function sleepWithPause(totalMs) {
        let remaining = Math.max(0, Number(totalMs) || 0);
        while (remaining > 0 && Visualization3DState.isRunning) {
            await waitForUnpause();
            const slice = Math.min(80, remaining);
            await delay(slice);
            remaining -= slice;
        }
    }

    function sliderValueToDelay(value) {
        const normalized = Number(value);
        if (Number.isNaN(normalized)) {
            return Visualization3DState.speed;
        }
        return 1000 - Math.min(900, Math.max(100, normalized));
    }

    const Visualization3D = {
        init(containerId, algorithmType = '') {
            const container = document.getElementById(containerId);
            if (!container) {
                return false;
            }

            if (this.isActive()) {
                this.cleanup();
            }

            container.innerHTML = '';
            container.classList.add('aq-3d-stage');
            Visualization3DState.container = container;

            initScene();
            initCamera(container);
            initRenderer(container);
            defineMaterials();
            initLighting();
            initControls();

            animationTick();

            if (!Visualization3DState.resizeBound) {
                window.addEventListener('resize', onWindowResize, { passive: true });
                Visualization3DState.resizeBound = true;
            }

            this.drawInitialGraph(algorithmType);
            return true;
        },

        isActive() {
            return Boolean(
                Visualization3DState.container &&
                    Visualization3DState.scene &&
                    Visualization3DState.renderer
            );
        },

        drawInitialGraph(algorithmType = '') {
            if (!this.isActive()) {
                return;
            }
            const normalized = String(algorithmType || '').toLowerCase();
            const config = resolveConfigForAlgorithm(normalized, Visualization3DState.container);
            if (!config) {
                clearGraphObjects();
                Visualization3DState.activeConfig = null;
                return;
            }

            clearGraphObjects();

            const nodes = config.nodes;
            const edges = config.edges;
            const scene = Visualization3DState.scene;
            if (!scene) {
                return;
            }

            Visualization3DState.nodes = nodes.map((nodeData) => {
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(Visualization3DState.baseNodeSize, 32, 32),
                    Visualization3DState.materials.default
                );
                sphere.position.set(nodeData.x, nodeData.y, nodeData.z);
                sphere.castShadow = true;
                sphere.receiveShadow = true;
                scene.add(sphere);
                return sphere;
            });

            const edgeThickness = 2.5;
            Visualization3DState.edges = edges.map((edgeEntry) => {
                const edge = edgeEndpoints(edgeEntry);
                const from = edge.from;
                const to = edge.to;
                const fromNode = nodes[from];
                const toNode = nodes[to];
                const p1 = new THREE.Vector3(fromNode.x, fromNode.y, fromNode.z);
                const p2 = new THREE.Vector3(toNode.x, toNode.y, toNode.z);
                const path = new THREE.CatmullRomCurve3([p1, p2]);
                const geometry = new THREE.TubeGeometry(path, 2, edgeThickness, 8, false);
                const edgeMesh = new THREE.Mesh(
                    geometry,
                    Visualization3DState.materials.edge
                );
                edgeMesh.receiveShadow = true;
                scene.add(edgeMesh);
                return edgeMesh;
            });
            
            // Add node labels for traversal/tree algorithms
            if (normalized === 'bfs' || normalized === 'dfs' || normalized === 'bst') {
                addLabelsToNodes(nodes);
            }
            
            // Add axis helpers
            Visualization3DState.axisGroup = createAxisHelpers();
            scene.add(Visualization3DState.axisGroup);
            
            // Create and add legend overlay
            createLegendOverlay(normalized);
            
            Visualization3DState.currentAlgorithm = normalized;
            Visualization3DState.activeConfig = config;
        },

        start(algorithmType) {
            const normalized = String(algorithmType || '').toLowerCase();
            if (normalized === 'bfs') {
                this.runBFS();
                return;
            }
            if (normalized === 'dfs') {
                this.runDFS();
                return;
            }
            if (normalized === 'dijkstra') {
                this.runDijkstra();
                return;
            }
            if (normalized === 'astar') {
                this.runAStar();
                return;
            }
            if (normalized === 'bst') {
                this.runBST();
            }
        },

        pause() {
            if (!Visualization3DState.isRunning) {
                return;
            }
            Visualization3DState.isPaused = !Visualization3DState.isPaused;
        },

        async runBFS() {
            if (Visualization3DState.isRunning || !this.isActive()) {
                return;
            }

            this.drawInitialGraph('bfs');
            const config = Visualization3DState.activeConfig;
            if (!config) {
                return;
            }

            this.resetVisualization();

            const nodes = config.nodes;
            const edges = config.edges;
            const start = config.start;

            // Initialize state tracking
            initializeNodeStates(nodes.length);
            createStatusPanel('bfs');
            updateStatusPanel(null, [getNodeDisplayLabel(start)], 0, nodes.length);

            const adjacencyList = buildUnweightedAdjacency(nodes.length, edges);
            adjacencyList.forEach((neighbors) => {
                neighbors.sort((a, b) => compareNodeIndicesByLabel(nodes, a, b));
            });

            Visualization3DState.isRunning = true;
            Visualization3DState.isPaused = false;

            const visited = new Set();
            const queue = [start];
            const queued = new Set([start]);
            updateNodeState(start, 'frontier');

            while (queue.length > 0) {
                if (!Visualization3DState.isRunning) {
                    break;
                }
                await waitForUnpause();
                if (!Visualization3DState.isRunning) {
                    break;
                }

                const current = queue.shift();
                queued.delete(current);
                if (visited.has(current)) {
                    continue;
                }

                updateNodeState(current, 'current');
                updateStatusPanel(
                    getNodeDisplayLabel(current),
                    queue.map((idx) => getNodeDisplayLabel(idx)),
                    visited.size,
                    nodes.length
                );
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }

                visited.add(current);
                updateNodeState(current, 'visited');

                const neighbors = adjacencyList[current] || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor) && !queued.has(neighbor)) {
                        queue.push(neighbor);
                        queued.add(neighbor);
                        updateNodeState(neighbor, 'frontier');
                    }
                }
                
                updateStatusPanel(
                    null,
                    queue.map((idx) => getNodeDisplayLabel(idx)),
                    visited.size,
                    nodes.length
                );
                await sleepWithPause(Visualization3DState.speed);
            }

            Visualization3DState.isRunning = false;
            Visualization3DState.isPaused = false;
        },

        async runDFS() {
            if (Visualization3DState.isRunning || !this.isActive()) {
                return;
            }

            this.drawInitialGraph('dfs');
            const config = Visualization3DState.activeConfig;
            if (!config) {
                return;
            }

            this.resetVisualization();

            const nodes = config.nodes;
            const edges = config.edges;
            const start = config.start;
            
            // Initialize state tracking
            initializeNodeStates(nodes.length);
            createStatusPanel('dfs');
            updateStatusPanel(null, [getNodeDisplayLabel(start)], 0, nodes.length);
            
            const adjacencyList = buildUnweightedAdjacency(nodes.length, edges);
            adjacencyList.forEach((neighbors) => {
                neighbors.sort((a, b) => compareNodeIndicesByLabel(nodes, a, b));
            });

            Visualization3DState.isRunning = true;
            Visualization3DState.isPaused = false;

            const visited = new Set();
            const stack = [start];
            const inStack = new Set([start]);
            updateNodeState(start, 'frontier');

            while (stack.length > 0) {
                if (!Visualization3DState.isRunning) {
                    break;
                }
                await waitForUnpause();
                if (!Visualization3DState.isRunning) {
                    break;
                }

                const current = stack.pop();
                inStack.delete(current);
                if (visited.has(current)) {
                    continue;
                }

                updateNodeState(current, 'current');
                updateStatusPanel(
                    getNodeDisplayLabel(current),
                    stack.map((idx) => getNodeDisplayLabel(idx)),
                    visited.size,
                    nodes.length
                );
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }

                visited.add(current);
                updateNodeState(current, 'visited');

                const neighbors = adjacencyList[current] || [];
                for (let idx = neighbors.length - 1; idx >= 0; idx -= 1) {
                    const neighbor = neighbors[idx];
                    if (!visited.has(neighbor) && !inStack.has(neighbor)) {
                        stack.push(neighbor);
                        inStack.add(neighbor);
                        updateNodeState(neighbor, 'frontier');
                    }
                }
                
                updateStatusPanel(
                    null,
                    stack.map((idx) => getNodeDisplayLabel(idx)),
                    visited.size,
                    nodes.length
                );
                await sleepWithPause(Visualization3DState.speed);
            }

            Visualization3DState.isRunning = false;
            Visualization3DState.isPaused = false;
        },

        async runBST() {
            if (Visualization3DState.isRunning || !this.isActive()) {
                return;
            }

            this.drawInitialGraph('bst');
            const config = Visualization3DState.activeConfig;
            if (!config) {
                return;
            }

            this.resetVisualization();

            const nodes = config.nodes;
            const insertionOrder = Array.isArray(config.insertionOrder) && config.insertionOrder.length
                ? config.insertionOrder.slice()
                : Array.from({ length: nodes.length }, (_, idx) => idx);

            initializeNodeStates(nodes.length);
            createStatusPanel('bst');
            updateStatusPanel(
                null,
                insertionOrder.map((idx) => getNodeDisplayLabel(idx)),
                0,
                nodes.length
            );

            Visualization3DState.isRunning = true;
            Visualization3DState.isPaused = false;

            const visited = new Set();
            if (insertionOrder.length) {
                const firstIndex = insertionOrder[0];
                if (Number.isInteger(firstIndex) && firstIndex >= 0 && firstIndex < nodes.length) {
                    updateNodeState(firstIndex, 'frontier');
                }
            }

            for (let step = 0; step < insertionOrder.length; step += 1) {
                if (!Visualization3DState.isRunning) {
                    break;
                }
                await waitForUnpause();
                if (!Visualization3DState.isRunning) {
                    break;
                }

                const current = insertionOrder[step];
                if (!Number.isInteger(current) || current < 0 || current >= nodes.length) {
                    continue;
                }
                if (visited.has(current)) {
                    const remainingLabels = insertionOrder
                        .slice(step + 1)
                        .map((idx) => getNodeDisplayLabel(idx));
                    updateStatusPanel(null, remainingLabels, visited.size, nodes.length);
                    continue;
                }

                updateNodeState(current, 'current');
                updateStatusPanel(
                    getNodeDisplayLabel(current),
                    insertionOrder.slice(step + 1).map((idx) => getNodeDisplayLabel(idx)),
                    visited.size,
                    nodes.length
                );
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }

                visited.add(current);
                updateNodeState(current, 'visited');

                const nextFrontier = insertionOrder
                    .slice(step + 1)
                    .find((idx) => Number.isInteger(idx) && idx >= 0 && idx < nodes.length && !visited.has(idx));
                if (Number.isInteger(nextFrontier)) {
                    updateNodeState(nextFrontier, 'frontier');
                }

                updateStatusPanel(
                    null,
                    insertionOrder.slice(step + 1).map((idx) => getNodeDisplayLabel(idx)),
                    visited.size,
                    nodes.length
                );
                await sleepWithPause(Visualization3DState.speed);
            }

            Visualization3DState.isRunning = false;
            Visualization3DState.isPaused = false;
        },

        async runDijkstra() {
            if (Visualization3DState.isRunning || !this.isActive()) {
                return;
            }

            this.drawInitialGraph('dijkstra');
            const config = Visualization3DState.activeConfig;
            if (!config) {
                return;
            }

            this.resetVisualization();

            const source = Number.isInteger(config.source) ? config.source : 0;
            const target = Number.isInteger(config.target) ? config.target : (config.nodes.length - 1);
            const adjacency = buildWeightedAdjacency(config.nodes.length, config.edges);
            const distances = Array(config.nodes.length).fill(Infinity);
            const previous = Array(config.nodes.length).fill(null);
            const visited = new Set();
            const settledTrace = [];

            function formatDistance(value) {
                if (!Number.isFinite(value)) {
                    return 'inf';
                }
                if (Number.isInteger(value)) {
                    return String(value);
                }
                return value.toFixed(2).replace(/\.?0+$/, '');
            }

            function frontierSnapshot(excludedIndex = null) {
                const entries = [];
                for (let idx = 0; idx < distances.length; idx += 1) {
                    if (idx === excludedIndex || visited.has(idx) || !Number.isFinite(distances[idx])) {
                        continue;
                    }
                    entries.push({
                        idx,
                        dist: distances[idx],
                    });
                }
                entries.sort((left, right) => {
                    if (left.dist !== right.dist) {
                        return left.dist - right.dist;
                    }
                    return compareNodeIndicesByLabel(config.nodes, left.idx, right.idx);
                });
                return entries.map((entry) => `${getNodeDisplayLabel(entry.idx)}:${formatDistance(entry.dist)}`);
            }

            initializeNodeStates(config.nodes.length);
            createStatusPanel('dijkstra');
            distances[source] = 0;
            updateNodeState(source, 'frontier');
            updateStatusPanel(
                null,
                frontierSnapshot(),
                0,
                config.nodes.length,
                {
                    visitedText: '-',
                    targetDistText: formatDistance(distances[target]),
                    relaxText: '-',
                }
            );

            Visualization3DState.isRunning = true;
            Visualization3DState.isPaused = false;

            while (visited.size < config.nodes.length) {
                if (!Visualization3DState.isRunning) {
                    break;
                }
                await waitForUnpause();
                if (!Visualization3DState.isRunning) {
                    break;
                }

                let current = -1;
                let bestDistance = Infinity;
                for (let idx = 0; idx < distances.length; idx += 1) {
                    if (!visited.has(idx) && distances[idx] < bestDistance) {
                        bestDistance = distances[idx];
                        current = idx;
                    }
                }
                if (current < 0) {
                    break;
                }

                updateNodeState(current, 'current');
                updateStatusPanel(
                    getNodeDisplayLabel(current),
                    frontierSnapshot(current),
                    visited.size,
                    config.nodes.length,
                    {
                        visitedText: settledTrace.length ? settledTrace.join(' -> ') : '-',
                        targetDistText: formatDistance(distances[target]),
                        relaxText: `Settling node ${getNodeDisplayLabel(current)} (${formatDistance(distances[current])})`,
                    }
                );
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }

                visited.add(current);
                updateNodeState(current, 'visited');
                settledTrace.push(`${getNodeDisplayLabel(current)}(${formatDistance(distances[current])})`);

                const neighbors = adjacency[current] || [];
                const relaxUpdates = [];
                neighbors.forEach((entry) => {
                    if (visited.has(entry.node)) {
                        return;
                    }
                    const candidate = distances[current] + entry.weight;
                    if (candidate < distances[entry.node]) {
                        distances[entry.node] = candidate;
                        previous[entry.node] = current;
                        relaxUpdates.push(
                            `${getNodeDisplayLabel(entry.node)}=${formatDistance(candidate)}`
                        );
                    }
                    updateNodeState(entry.node, 'frontier');
                });

                updateStatusPanel(
                    null,
                    frontierSnapshot(),
                    visited.size,
                    config.nodes.length,
                    {
                        visitedText: settledTrace.length ? settledTrace.join(' -> ') : '-',
                        targetDistText: formatDistance(distances[target]),
                        relaxText: relaxUpdates.length
                            ? `Updated ${relaxUpdates.join(', ')}`
                            : `No better neighbor from ${getNodeDisplayLabel(current)}`,
                    }
                );
                await sleepWithPause(Visualization3DState.speed * 0.8);
            }

            const path = tracePath(previous, source, target);
            path.forEach((index) => setNodeMaterial(index, 'path'));
            updateStatusPanel(
                null,
                frontierSnapshot(),
                visited.size,
                config.nodes.length,
                {
                    visitedText: settledTrace.length ? settledTrace.join(' -> ') : '-',
                    targetDistText: formatDistance(distances[target]),
                    relaxText: path.length
                        ? `Shortest path ${path.map((idx) => getNodeDisplayLabel(idx)).join(' -> ')}`
                        : 'No source-to-target path',
                }
            );

            Visualization3DState.isRunning = false;
            Visualization3DState.isPaused = false;
        },

        async runAStar() {
            if (Visualization3DState.isRunning || !this.isActive()) {
                return;
            }

            this.drawInitialGraph('astar');
            const config = Visualization3DState.activeConfig;
            if (!config) {
                return;
            }

            this.resetVisualization();

            const start = Number.isInteger(config.source) ? config.source : 0;
            const target = Number.isInteger(config.target) ? config.target : (config.nodes.length - 1);
            const adjacency = buildWeightedAdjacency(config.nodes.length, config.edges);
            const gScore = Array(config.nodes.length).fill(Infinity);
            const fScore = Array(config.nodes.length).fill(Infinity);
            const previous = Array(config.nodes.length).fill(null);
            const open = new Set([start]);
            const closed = new Set();
            const closedTrace = [];

            function heuristic(a, b) {
                const nodeA = config.nodes[a];
                const nodeB = config.nodes[b];
                if (nodeA && nodeB && Number.isFinite(nodeA.row) && Number.isFinite(nodeB.row)) {
                    return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
                }
                const dx = (nodeA?.x || 0) - (nodeB?.x || 0);
                const dy = (nodeA?.y || 0) - (nodeB?.y || 0);
                return Math.sqrt((dx * dx) + (dy * dy));
            }

            function formatScore(value) {
                if (!Number.isFinite(value)) {
                    return 'inf';
                }
                if (Number.isInteger(value)) {
                    return String(value);
                }
                return value.toFixed(2).replace(/\.?0+$/, '');
            }

            function openSnapshot(excludedIndex = null) {
                const entries = [];
                open.forEach((idx) => {
                    if (idx === excludedIndex || !Number.isFinite(fScore[idx])) {
                        return;
                    }
                    const hValue = heuristic(idx, target);
                    entries.push({
                        idx,
                        f: fScore[idx],
                        g: gScore[idx],
                        h: hValue,
                    });
                });
                entries.sort((left, right) => {
                    if (left.f !== right.f) {
                        return left.f - right.f;
                    }
                    return compareNodeIndicesByLabel(config.nodes, left.idx, right.idx);
                });
                return entries.map((entry) =>
                    `${getNodeDisplayLabel(entry.idx)}:${formatScore(entry.f)}(g${formatScore(entry.g)},h${formatScore(entry.h)})`
                );
            }

            function bestOpenF() {
                let best = Infinity;
                open.forEach((idx) => {
                    if (Number.isFinite(fScore[idx]) && fScore[idx] < best) {
                        best = fScore[idx];
                    }
                });
                return best;
            }

            initializeNodeStates(config.nodes.length);
            createStatusPanel('astar');
            gScore[start] = 0;
            fScore[start] = heuristic(start, target);
            updateNodeState(start, 'frontier');
            updateStatusPanel(
                null,
                openSnapshot(),
                0,
                config.nodes.length,
                {
                    visitedText: '-',
                    astarBestFText: formatScore(bestOpenF()),
                    astarGoalGText: formatScore(gScore[target]),
                }
            );

            Visualization3DState.isRunning = true;
            Visualization3DState.isPaused = false;

            while (open.size > 0) {
                if (!Visualization3DState.isRunning) {
                    break;
                }
                await waitForUnpause();
                if (!Visualization3DState.isRunning) {
                    break;
                }

                let current = -1;
                let bestF = Infinity;
                open.forEach((candidate) => {
                    if (fScore[candidate] < bestF) {
                        bestF = fScore[candidate];
                        current = candidate;
                    }
                });

                if (current < 0) {
                    break;
                }
                if (current === target) {
                    open.delete(current);
                    updateNodeState(current, 'current');
                    updateStatusPanel(
                        getNodeDisplayLabel(current),
                        openSnapshot(),
                        closed.size,
                        config.nodes.length,
                        {
                            visitedText: closedTrace.length ? closedTrace.join(' -> ') : '-',
                            astarBestFText: formatScore(bestOpenF()),
                            astarGoalGText: formatScore(gScore[target]),
                        }
                    );
                    await sleepWithPause(Visualization3DState.speed * 0.6);
                    closed.add(current);
                    closedTrace.push(`${getNodeDisplayLabel(current)}(g=${formatScore(gScore[current])},f=${formatScore(fScore[current])})`);
                    updateNodeState(current, 'visited');
                    break;
                }

                open.delete(current);
                closed.add(current);
                updateNodeState(current, 'current');
                updateStatusPanel(
                    getNodeDisplayLabel(current),
                    openSnapshot(),
                    closed.size - 1,
                    config.nodes.length,
                    {
                        visitedText: closedTrace.length ? closedTrace.join(' -> ') : '-',
                        astarBestFText: formatScore(bestOpenF()),
                        astarGoalGText: formatScore(gScore[target]),
                    }
                );
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }
                updateNodeState(current, 'visited');
                closedTrace.push(`${getNodeDisplayLabel(current)}(g=${formatScore(gScore[current])},f=${formatScore(fScore[current])})`);

                (adjacency[current] || []).forEach((entry) => {
                    if (closed.has(entry.node)) {
                        return;
                    }
                    const tentativeG = gScore[current] + entry.weight;
                    if (tentativeG < gScore[entry.node]) {
                        previous[entry.node] = current;
                        gScore[entry.node] = tentativeG;
                        fScore[entry.node] = tentativeG + heuristic(entry.node, target);
                        open.add(entry.node);
                        updateNodeState(entry.node, 'frontier');
                    }
                });

                updateStatusPanel(
                    null,
                    openSnapshot(),
                    closed.size,
                    config.nodes.length,
                    {
                        visitedText: closedTrace.length ? closedTrace.join(' -> ') : '-',
                        astarBestFText: formatScore(bestOpenF()),
                        astarGoalGText: formatScore(gScore[target]),
                    }
                );
                await sleepWithPause(Visualization3DState.speed * 0.8);
            }

            const path = tracePath(previous, start, target);
            if (path.length) {
                path.forEach((index) => setNodeMaterial(index, 'path'));
            }
            updateStatusPanel(
                null,
                openSnapshot(),
                closed.size,
                config.nodes.length,
                {
                    visitedText: closedTrace.length ? closedTrace.join(' -> ') : '-',
                    astarBestFText: formatScore(bestOpenF()),
                    astarGoalGText: formatScore(gScore[target]),
                }
            );

            Visualization3DState.isRunning = false;
            Visualization3DState.isPaused = false;
        },

        setSpeed(value) {
            Visualization3DState.speed = sliderValueToDelay(value);
        },

        getState() {
            return {
                isRunning: Visualization3DState.isRunning,
                isPaused: Visualization3DState.isPaused,
                speed: Visualization3DState.speed,
            };
        },

        resetVisualization() {
            Visualization3DState.isRunning = false;
            Visualization3DState.isPaused = false;
            
            // Clear halos
            Visualization3DState.nodeHalos.forEach((halo) => {
                Visualization3DState.scene.remove(halo);
                if (halo.geometry) halo.geometry.dispose();
                if (halo.material) halo.material.dispose();
            });
            Visualization3DState.nodeHalos.clear();
            
            // Clear status panel
            if (Visualization3DState.statusPanel) {
                Visualization3DState.statusPanel.remove();
                Visualization3DState.statusPanel = null;
            }
            
            Visualization3DState.nodes.forEach((node) => {
                // Dispose old material if it's a cloned instance
                if (node.material && 
                    node.material !== Visualization3DState.materials.default && 
                    node.material !== Visualization3DState.materials.visited && 
                    node.material !== Visualization3DState.materials.current && 
                    node.material !== Visualization3DState.materials.frontier && 
                    node.material !== Visualization3DState.materials.path && 
                    typeof node.material.dispose === 'function') {
                    node.material.dispose();
                }
                node.material = Visualization3DState.materials.default;
                node.scale.set(1, 1, 1);
            });
            Visualization3DState.edges.forEach((edge) => {
                // Dispose old material if it's a cloned instance
                if (edge.material && 
                    edge.material !== Visualization3DState.materials.edge &&
                    typeof edge.material.dispose === 'function') {
                    edge.material.dispose();
                }
                edge.material = Visualization3DState.materials.edge;
            });
            
            Visualization3DState.nodeStates.clear();
            Visualization3DState.visitedOrder = [];
        },

        cleanup() {
            Visualization3DState.isRunning = false;
            Visualization3DState.isPaused = false;

            if (Visualization3DState.animationId) {
                cancelAnimationFrame(Visualization3DState.animationId);
                Visualization3DState.animationId = null;
            }

            if (Visualization3DState.resizeBound) {
                window.removeEventListener('resize', onWindowResize);
                Visualization3DState.resizeBound = false;
            }

            if (Visualization3DState.legendOverlay) {
                Visualization3DState.legendOverlay.remove();
                Visualization3DState.legendOverlay = null;
            }

            clearGraphObjects();

            const controls = Visualization3DState.controls;
            if (controls && typeof controls.dispose === 'function') {
                controls.dispose();
            }

            disposeMaterial(Visualization3DState.materials.default);
            disposeMaterial(Visualization3DState.materials.visited);
            disposeMaterial(Visualization3DState.materials.current);
            disposeMaterial(Visualization3DState.materials.edge);
            disposeMaterial(Visualization3DState.materials.frontier);
            disposeMaterial(Visualization3DState.materials.path);

            if (Visualization3DState.renderer) {
                Visualization3DState.renderer.dispose();
            }

            if (Visualization3DState.container) {
                Visualization3DState.container.classList.remove('aq-3d-stage');
                Visualization3DState.container.innerHTML = '';
            }

            Object.assign(Visualization3DState, {
                scene: null,
                camera: null,
                renderer: null,
                controls: null,
                container: null,
                materials: {},
                nodes: [],
                edges: [],
                currentAlgorithm: '',
                activeConfig: null,
                axisGroup: null,
                legendOverlay: null,
                statusPanel: null,
                overlayDock: null,
                nodeStates: new Map(),
                nodeHalos: new Map(),
                nodeLabels: new Map(),
                visitedOrder: [],
            });
        },
    };

    window.Visualization3D = Visualization3D;

    const baseEngine = window.VisualizationEngine || {};

    function shouldUse3DEngine(algorithmType) {
        const normalized = String(algorithmType || '').toLowerCase();
        return ['bfs', 'dfs', 'dijkstra', 'astar', 'bst'].includes(normalized) && window.Visualization3D && window.Visualization3D.isActive();
    }

    window.VisualizationEngine = {
        ...baseEngine,
        setChallengeContext(payload) {
            if (typeof baseEngine.setChallengeContext === 'function') {
                baseEngine.setChallengeContext(payload);
            }
            setChallengeContext(payload);
        },
        start(algorithmType) {
            if (shouldUse3DEngine(algorithmType)) {
                window.Visualization3D.start(algorithmType);
                return;
            }
            if (typeof baseEngine.start === 'function') {
                baseEngine.start(algorithmType);
            }
        },
        pause() {
            if (window.Visualization3D && window.Visualization3D.isActive()) {
                window.Visualization3D.pause();
                return;
            }
            if (typeof baseEngine.pause === 'function') {
                baseEngine.pause();
            }
        },
        reset() {
            if (window.Visualization3D && window.Visualization3D.isActive()) {
                window.Visualization3D.resetVisualization();
                return;
            }
            if (typeof baseEngine.reset === 'function') {
                baseEngine.reset();
            }
        },
        setSpeed(speed) {
            if (window.Visualization3D) {
                window.Visualization3D.setSpeed(speed);
            }
            if (!(window.Visualization3D && window.Visualization3D.isActive())) {
                if (typeof baseEngine.setSpeed === 'function') {
                    baseEngine.setSpeed(speed);
                }
            }
        },
        getState() {
            if (window.Visualization3D && window.Visualization3D.isActive()) {
                return window.Visualization3D.getState();
            }
            if (typeof baseEngine.getState === 'function') {
                return baseEngine.getState();
            }
            return { isRunning: false, isPaused: false, speed: 500 };
        },
        renderPreview(algorithmType) {
            if (shouldUse3DEngine(algorithmType)) {
                window.Visualization3D.drawInitialGraph(algorithmType);
                return;
            }
            if (typeof baseEngine.renderPreview === 'function') {
                baseEngine.renderPreview(algorithmType);
            }
        },
    };
})();
