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
        Visualization3DState.scene.background = new THREE.Color(0x1a1a1a);
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
        Visualization3DState.renderer.setPixelRatio(window.devicePixelRatio || 1);
        Visualization3DState.renderer.shadowMap.enabled = true;
        Visualization3DState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(Visualization3DState.renderer.domElement);
    }

    function initLighting() {
        const scene = Visualization3DState.scene;
        if (!scene) {
            return;
        }

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(100, 150, 200);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        scene.add(directionalLight);

        const backLight = new THREE.DirectionalLight(0x00aaff, 0.3);
        backLight.position.set(-100, -150, -200);
        scene.add(backLight);
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
        Visualization3DState.materials = {
            default: new THREE.MeshPhysicalMaterial({
                color: 0x007bff,
                metalness: 0.1,
                roughness: 0.2,
                transmission: 0.9,
                transparent: true,
                opacity: 0.9,
                ior: 1.5,
            }),
            visited: new THREE.MeshPhysicalMaterial({
                color: 0x28a745,
                metalness: 0.2,
                roughness: 0.3,
                transmission: 0.8,
                transparent: true,
                opacity: 0.95,
                ior: 1.5,
            }),
            current: new THREE.MeshPhysicalMaterial({
                color: 0xffc107,
                metalness: 0.3,
                roughness: 0.1,
                transmission: 0.7,
                transparent: true,
                opacity: 1.0,
                ior: 1.8,
                emissive: 0xffc107,
                emissiveIntensity: 0.5,
            }),
            edge: new THREE.MeshStandardMaterial({
                color: 0xaaaaaa,
                roughness: 0.8,
            }),
            frontier: new THREE.MeshPhysicalMaterial({
                color: 0x38bdf8,
                metalness: 0.25,
                roughness: 0.18,
                transmission: 0.75,
                transparent: true,
                opacity: 0.95,
                ior: 1.55,
            }),
            path: new THREE.MeshPhysicalMaterial({
                color: 0xa855f7,
                metalness: 0.25,
                roughness: 0.18,
                transmission: 0.75,
                transparent: true,
                opacity: 0.96,
                ior: 1.6,
            }),
        };
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
        const nodeIds = rawNodes.slice().sort((a, b) => Number(a) - Number(b));
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
        const nodeIds = rawNodes.slice().sort((a, b) => Number(a) - Number(b));
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

        Visualization3DState.nodes.forEach((node) => {
            scene.remove(node);
            if (node.geometry && typeof node.geometry.dispose === 'function') {
                node.geometry.dispose();
            }
            disposeMaterial(node.material);
        });

        Visualization3DState.edges.forEach((edge) => {
            scene.remove(edge);
            if (edge.geometry && typeof edge.geometry.dispose === 'function') {
                edge.geometry.dispose();
            }
            disposeMaterial(edge.material);
        });

        Visualization3DState.nodes = [];
        Visualization3DState.edges = [];
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

            const nodeGeometry = new THREE.SphereGeometry(Visualization3DState.baseNodeSize, 32, 32);
            Visualization3DState.nodes = nodes.map((nodeData) => {
                const sphere = new THREE.Mesh(
                    nodeGeometry,
                    Visualization3DState.materials.default.clone()
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
                    Visualization3DState.materials.edge.clone()
                );
                edgeMesh.receiveShadow = true;
                scene.add(edgeMesh);
                return edgeMesh;
            });
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

            const adjacencyList = buildUnweightedAdjacency(nodes.length, edges);
            adjacencyList.forEach((neighbors) => {
                neighbors.sort((a, b) => Number(nodes[a].label) - Number(nodes[b].label));
            });

            Visualization3DState.isRunning = true;
            Visualization3DState.isPaused = false;

            const visited = new Set();
            const queue = [start];

            while (queue.length > 0) {
                if (!Visualization3DState.isRunning) {
                    break;
                }
                await waitForUnpause();
                if (!Visualization3DState.isRunning) {
                    break;
                }

                const current = queue.shift();
                if (visited.has(current)) {
                    continue;
                }

                setNodeMaterial(current, 'current');
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }

                visited.add(current);
                setNodeMaterial(current, 'visited');

                const neighbors = adjacencyList[current] || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                        if (Visualization3DState.nodes[neighbor].material !== Visualization3DState.materials.visited) {
                            setNodeMaterial(neighbor, 'frontier');
                        }
                    }
                }

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
            const adjacencyList = buildUnweightedAdjacency(nodes.length, edges);
            adjacencyList.forEach((neighbors) => {
                neighbors.sort((a, b) => Number(nodes[a].label) - Number(nodes[b].label));
            });

            Visualization3DState.isRunning = true;
            Visualization3DState.isPaused = false;

            const visited = new Set();
            const stack = [start];

            while (stack.length > 0) {
                if (!Visualization3DState.isRunning) {
                    break;
                }
                await waitForUnpause();
                if (!Visualization3DState.isRunning) {
                    break;
                }

                const current = stack.pop();
                if (visited.has(current)) {
                    continue;
                }

                setNodeMaterial(current, 'current');
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }

                visited.add(current);
                setNodeMaterial(current, 'visited');

                const neighbors = adjacencyList[current] || [];
                for (let idx = neighbors.length - 1; idx >= 0; idx -= 1) {
                    const neighbor = neighbors[idx];
                    if (!visited.has(neighbor)) {
                        stack.push(neighbor);
                        if (Visualization3DState.nodes[neighbor].material !== Visualization3DState.materials.visited) {
                            setNodeMaterial(neighbor, 'frontier');
                        }
                    }
                }

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
            distances[source] = 0;
            setNodeMaterial(source, 'frontier');

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

                setNodeMaterial(current, 'current');
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }

                visited.add(current);
                setNodeMaterial(current, 'visited');

                const neighbors = adjacency[current] || [];
                neighbors.forEach((entry) => {
                    if (visited.has(entry.node)) {
                        return;
                    }
                    const candidate = distances[current] + entry.weight;
                    if (candidate < distances[entry.node]) {
                        distances[entry.node] = candidate;
                        previous[entry.node] = current;
                    }
                    setNodeMaterial(entry.node, 'frontier');
                });

                await sleepWithPause(Visualization3DState.speed * 0.8);
            }

            const path = tracePath(previous, source, target);
            path.forEach((index) => setNodeMaterial(index, 'path'));

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

            gScore[start] = 0;
            fScore[start] = heuristic(start, target);
            setNodeMaterial(start, 'frontier');

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
                    break;
                }

                open.delete(current);
                closed.add(current);
                setNodeMaterial(current, 'current');
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }
                setNodeMaterial(current, 'visited');

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
                        setNodeMaterial(entry.node, 'frontier');
                    }
                });

                await sleepWithPause(Visualization3DState.speed * 0.8);
            }

            const path = tracePath(previous, start, target);
            if (path.length) {
                path.forEach((index) => setNodeMaterial(index, 'path'));
            }

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
            Visualization3DState.nodes.forEach((node) => {
                node.material = Visualization3DState.materials.default.clone();
                node.scale.set(1, 1, 1);
            });
            Visualization3DState.edges.forEach((edge) => {
                edge.material = Visualization3DState.materials.edge.clone();
            });
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
            });
        },
    };

    window.Visualization3D = Visualization3D;

    const baseEngine = window.VisualizationEngine || {};

    function shouldUse3DEngine(algorithmType) {
        const normalized = String(algorithmType || '').toLowerCase();
        return ['bfs', 'dfs', 'dijkstra', 'astar'].includes(normalized) && window.Visualization3D && window.Visualization3D.isActive();
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
