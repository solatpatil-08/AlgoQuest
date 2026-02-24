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
        init(containerId) {
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

            this.drawInitialGraph();
            return true;
        },

        isActive() {
            return Boolean(
                Visualization3DState.container &&
                    Visualization3DState.scene &&
                    Visualization3DState.renderer
            );
        },

        drawInitialGraph() {
            if (!this.isActive()) {
                return;
            }
            const config = graphConfigFromPayload(null, Visualization3DState.container);
            if (!config) {
                clearGraphObjects();
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
            Visualization3DState.edges = edges.map(([from, to]) => {
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
        },

        start(algorithmType) {
            const normalized = String(algorithmType || '').toLowerCase();
            if (normalized === 'bfs') {
                this.runBFS();
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

            const config = graphConfigFromPayload(null, Visualization3DState.container);
            if (!config) {
                return;
            }

            this.resetVisualization();

            const nodes = config.nodes;
            const edges = config.edges;
            const start = config.start;

            const adjacencyList = Array(nodes.length)
                .fill(0)
                .map(() => []);
            edges.forEach(([from, to]) => {
                adjacencyList[from].push(to);
                adjacencyList[to].push(from);
            });
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

                Visualization3DState.nodes[current].material =
                    Visualization3DState.materials.current;
                await sleepWithPause(Visualization3DState.speed);
                if (!Visualization3DState.isRunning) {
                    break;
                }

                visited.add(current);
                Visualization3DState.nodes[current].material =
                    Visualization3DState.materials.visited;

                const neighbors = adjacencyList[current] || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }

                await sleepWithPause(Visualization3DState.speed);
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
            });
        },
    };

    window.Visualization3D = Visualization3D;

    const baseEngine = window.VisualizationEngine || {};

    function shouldUse3DEngine(algorithmType) {
        const normalized = String(algorithmType || '').toLowerCase();
        return normalized === 'bfs' && window.Visualization3D && window.Visualization3D.isActive();
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
                window.Visualization3D.drawInitialGraph();
                return;
            }
            if (typeof baseEngine.renderPreview === 'function') {
                baseEngine.renderPreview(algorithmType);
            }
        },
    };
})();
