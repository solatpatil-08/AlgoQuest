/* ============================================
   CONCEPTUAL VISUALIZATIONS - Fallback for non-graph topics
   Provides structured visual representations for algorithm concepts
   ============================================ */

const ConceptualVisualizations = {
    // Array visualization
    array: function(containerId = 'visualizationOutput') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 20px; background: var(--aq-viz-panel-bg); border-radius: 8px; border: 2px solid var(--aq-primary);">
                <h6 style="margin-bottom: 15px; color: var(--aq-primary-dark);">Array Memory Layout</h6>
                <div style="display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;">
                    <div style="width: 50px; height: 50px; background: var(--aq-primary-light); border: 2px solid var(--aq-info); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">3</div>
                    <div style="width: 50px; height: 50px; background: var(--aq-primary-light); border: 2px solid var(--aq-info); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">7</div>
                    <div style="width: 50px; height: 50px; background: var(--aq-primary-light); border: 2px solid var(--aq-info); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">2</div>
                    <div style="width: 50px; height: 50px; background: var(--aq-primary-light); border: 2px solid var(--aq-info); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">9</div>
                    <div style="width: 50px; height: 50px; background: var(--aq-primary-light); border: 2px solid var(--aq-info); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">1</div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                    <small style="width: 50px; text-align: center; color: var(--aq-viz-box-muted);">idx[0]</small>
                    <small style="width: 50px; text-align: center; color: var(--aq-viz-box-muted);">idx[1]</small>
                    <small style="width: 50px; text-align: center; color: var(--aq-viz-box-muted);">idx[2]</small>
                    <small style="width: 50px; text-align: center; color: var(--aq-viz-box-muted);">idx[3]</small>
                    <small style="width: 50px; text-align: center; color: var(--aq-viz-box-muted);">idx[4]</small>
                </div>
                <p style="margin-top: 15px; color: var(--aq-viz-box-muted); font-size: 13px; line-height: 1.6;">
                    <strong style="color: var(--aq-primary-dark);">Characteristics:</strong><br>
                    • Contiguous memory allocation<br>
                    • O(1) random access<br>
                    • O(n) shift operations<br>
                    • Fixed size (static arrays)
                </p>
            </div>
        `;
    },

    // Linked List visualization
    linked_list: function(containerId = 'visualizationOutput') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 20px; background: var(--aq-viz-panel-bg); border-radius: 8px; border: 2px solid var(--aq-primary);">
                <h6 style="margin-bottom: 15px; color: var(--aq-primary-dark);">Linked List Structure</h6>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-weight: bold;">
                        [3|→]
                    </div>
                    <div style="width: 20px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-weight: bold;">
                        [7|→]
                    </div>
                    <div style="width: 20px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-weight: bold;">
                        [2|→]
                    </div>
                    <div style="width: 20px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-weight: bold;">
                        [9|NULL]
                    </div>
                </div>
                <p style="color: var(--aq-viz-box-muted); font-size: 13px; line-height: 1.6;">
                    <strong style="color: var(--aq-primary-dark);">Characteristics:</strong><br>
                    • Non-contiguous memory<br>
                    • O(n) random access<br>
                    • O(1) insert/delete (with pointer)<br>
                    • Variable size (dynamic)
                </p>
            </div>
        `;
    },

    // Stack visualization
    stack: function(containerId = 'visualizationOutput') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 20px; background: var(--aq-viz-panel-bg); border-radius: 8px; border: 2px solid var(--aq-primary);">
                <h6 style="margin-bottom: 15px; color: var(--aq-primary-dark);">Stack (LIFO - Last In First Out)</h6>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 15px;">
                    <div style="width: 100px; padding: 10px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-weight: bold;">9</div>
                    <div style="width: 100px; padding: 10px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-weight: bold;">2</div>
                    <div style="width: 100px; padding: 10px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-weight: bold;">7</div>
                    <div style="width: 100px; padding: 10px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-weight: bold;">3</div>
                    <div style="width: 100px; height: 4px; background: var(--aq-border-hover);"></div>
                </div>
                <p style="color: var(--aq-viz-box-muted); font-size: 13px; line-height: 1.6;">
                    <strong style="color: var(--aq-primary-dark);">Operations:</strong><br>
                    • Push: O(1) - Add to top<br>
                    • Pop: O(1) - Remove from top<br>
                    • Peek: O(1) - View top<br>
                    <strong style="color: var(--aq-primary-dark); margin-top: 10px; display: block;">Use Cases:</strong>
                    Function calls, undo/redo, expression evaluation
                </p>
            </div>
        `;
    },

    // Queue visualization
    queue: function(containerId = 'visualizationOutput') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 20px; background: var(--aq-viz-panel-bg); border-radius: 8px; border: 2px solid var(--aq-primary);">
                <h6 style="margin-bottom: 15px; color: var(--aq-primary-dark);">Queue (FIFO - First In First Out)</h6>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-danger); border-radius: 4px; text-align: center; font-weight: bold;">
                        3
                        <div style="font-size: 10px; color: var(--aq-danger);">OUT</div>
                    </div>
                    <div style="width: 8px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-weight: bold;">7</div>
                    <div style="width: 8px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-weight: bold;">2</div>
                    <div style="width: 8px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-accent); border-radius: 4px; text-align: center; font-weight: bold;">
                        9
                        <div style="font-size: 10px; color: var(--aq-accent);">IN</div>
                    </div>
                </div>
                <p style="color: var(--aq-viz-box-muted); font-size: 13px; line-height: 1.6;">
                    <strong style="color: var(--aq-primary-dark);">Operations:</strong><br>
                    • Enqueue: O(1) - Add to back<br>
                    • Dequeue: O(1) - Remove from front<br>
                    • Peek: O(1) - View front<br>
                    <strong style="color: var(--aq-primary-dark); margin-top: 10px; display: block;">Use Cases:</strong>
                    Task scheduling, BFS, printer queues
                </p>
            </div>
        `;
    },

    // Hash Map visualization
    hash_map: function(containerId = 'visualizationOutput') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 20px; background: var(--aq-viz-panel-bg); border-radius: 8px; border: 2px solid var(--aq-primary);">
                <h6 style="margin-bottom: 15px; color: var(--aq-primary-dark);">Hash Map (Key-Value Store)</h6>
                <div style="margin-bottom: 15px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <tr>
                            <th style="border: 1px solid var(--aq-border); padding: 8px; background: var(--aq-primary-light); text-align: left; font-weight: bold;">Hash</th>
                            <th style="border: 1px solid var(--aq-border); padding: 8px; background: var(--aq-primary-light); text-align: left; font-weight: bold;">Key</th>
                            <th style="border: 1px solid var(--aq-border); padding: 8px; background: var(--aq-primary-light); text-align: left; font-weight: bold;">Value</th>
                        </tr>
                        <tr>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">0</td>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">"name"</td>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">"Alice"</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">1</td>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">"age"</td>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">30</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">2</td>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;"></td>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;"></td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">3</td>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">"city"</td>
                            <td style="border: 1px solid var(--aq-border); padding: 8px;">"NYC"</td>
                        </tr>
                    </table>
                </div>
                <p style="color: var(--aq-viz-box-muted); font-size: 13px; line-height: 1.6;">
                    <strong style="color: var(--aq-primary-dark);">Operations:</strong><br>
                    • Get: O(1) avg - Direct lookup via hash<br>
                    • Set: O(1) avg - Insert with hash<br>
                    • Delete: O(1) avg - Remove via hash<br>
                    <strong style="color: var(--aq-primary-dark); margin-top: 10px; display: block;">Collision handling:</strong>
                    Chaining or open addressing
                </p>
            </div>
        `;
    },

    // Binary Tree visualization
    binary_tree: function(containerId = 'visualizationOutput') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 20px; background: var(--aq-viz-panel-bg); border-radius: 8px; border: 2px solid var(--aq-primary);">
                <h6 style="margin-bottom: 15px; color: var(--aq-primary-dark);">Binary Tree Structure</h6>
                <div style="text-align: center; margin-bottom: 15px; font-family: monospace;">
                    <div style="margin-bottom: 15px;">
                        <div style="display: inline-block; padding: 8px 12px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-weight: bold;">4</div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <div style="margin-bottom: 10px; height: 20px; position: relative; display: flex; justify-content: center;">
                            <div style="width: 60px; height: 2px; background: var(--aq-info); position: absolute; top: 0;"></div>
                        </div>
                        <div style="display: flex; justify-content: center; gap: 80px;">
                            <div style="display: inline-block; padding: 8px 12px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-weight: bold;">2</div>
                            <div style="display: inline-block; padding: 8px 12px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-weight: bold;">6</div>
                        </div>
                    </div>
                    <div style="margin-bottom: 10px; height: 20px; position: relative; display: flex; justify-content: space-around; padding: 0 20px;">
                        <div style="width: 40px; height: 2px; background: var(--aq-info);"></div>
                        <div style="width: 40px; height: 2px; background: var(--aq-info);"></div>
                        <div style="width: 40px; height: 2px; background: var(--aq-info);"></div>
                        <div style="width: 40px; height: 2px; background: var(--aq-info);"></div>
                    </div>
                    <div style="display: flex; justify-content: space-around; padding: 0 20px;">
                        <div style="display: inline-block; padding: 5px 10px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-size: 12px;">1</div>
                        <div style="display: inline-block; padding: 5px 10px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-size: 12px;">3</div>
                        <div style="display: inline-block; padding: 5px 10px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-size: 12px;">5</div>
                        <div style="display: inline-block; padding: 5px 10px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; font-size: 12px;">7</div>
                    </div>
                </div>
                <p style="color: var(--aq-viz-box-muted); font-size: 13px; line-height: 1.6;">
                    <strong style="color: var(--aq-primary-dark);">Properties:</strong><br>
                    • Each node has max 2 children<br>
                    • Root: top node (single)<br>
                    • Leaf: no children<br>
                    <strong style="color: var(--aq-primary-dark); margin-top: 10px; display: block;">Traversals:</strong>
                    Inorder, Preorder, Postorder, Level-order
                </p>
            </div>
        `;
    },

    // Sort process visualization
    sorting_process: function(containerId = 'visualizationOutput') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 20px; background: var(--aq-viz-panel-bg); border-radius: 8px; border: 2px solid var(--aq-primary);">
                <h6 style="margin-bottom: 15px; color: var(--aq-primary-dark);">Sorting Process Illustration</h6>
                <div style="margin-bottom: 20px;">
                    <div style="margin-bottom: 10px;">
                        <small style="color: var(--aq-viz-box-muted); font-weight: bold;">Unsorted:</small>
                        <div style="display: flex; gap: 6px;">
                            <div style="width: 30px; height: 80px; background: var(--aq-danger-light); border: 2px solid var(--aq-danger); border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">9</div>
                            <div style="width: 30px; height: 30px; background: var(--aq-danger-light); border: 2px solid var(--aq-danger); border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">3</div>
                            <div style="width: 30px; height: 50px; background: var(--aq-danger-light); border: 2px solid var(--aq-danger); border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">5</div>
                            <div style="width: 30px; height: 70px; background: var(--aq-danger-light); border: 2px solid var(--aq-danger); border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">8</div>
                        </div>
                    </div>
                    <div>
                        <small style="color: var(--aq-viz-box-muted); font-weight: bold;">Sorted:</small>
                        <div style="display: flex; gap: 6px;">
                            <div style="width: 30px; height: 30px; background: var(--aq-accent-light); border: 2px solid var(--aq-accent); border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">3</div>
                            <div style="width: 30px; height: 50px; background: var(--aq-accent-light); border: 2px solid var(--aq-accent); border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">5</div>
                            <div style="width: 30px; height: 70px; background: var(--aq-accent-light); border: 2px solid var(--aq-accent); border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">8</div>
                            <div style="width: 30px; height: 80px; background: var(--aq-accent-light); border: 2px solid var(--aq-accent); border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">9</div>
                        </div>
                    </div>
                </div>
                <p style="color: var(--aq-viz-box-muted); font-size: 13px; line-height: 1.6;">
                    <strong style="color: var(--aq-primary-dark);">Common Algorithms:</strong><br>
                    • Bubble: O(n²) comparisons<br>
                    • Quick: O(n log n) avg case<br>
                    • Merge: O(n log n) guaranteed<br>
                    • Heap: O(n log n) guaranteed
                </p>
            </div>
        `;
    },

    // ML Concept visualization
    ml_concept: function(containerId = 'visualizationOutput') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="padding: 20px; background: var(--aq-viz-panel-bg); border-radius: 8px; border: 2px solid var(--aq-primary);">
                <h6 style="margin-bottom: 15px; color: var(--aq-primary-dark);">Machine Learning Workflow</h6>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 15px;">
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold;">
                        Data<br><small style="font-weight: normal;">Collect</small>
                    </div>
                    <div style="width: 20px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold;">
                        Preprocess<br><small style="font-weight: normal;">Clean</small>
                    </div>
                    <div style="width: 20px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold;">
                        Train<br><small style="font-weight: normal;">Model</small>
                    </div>
                    <div style="width: 20px; height: 2px; background: var(--aq-info);"></div>
                    <div style="padding: 10px 15px; background: var(--aq-viz-box-bg); border: 2px solid var(--aq-info); border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold;">
                        Evaluate<br><small style="font-weight: normal;">Test</small>
                    </div>
                </div>
                <p style="color: var(--aq-viz-box-muted); font-size: 13px; line-height: 1.6;">
                    <strong style="color: var(--aq-primary-dark);">Key Concepts:</strong><br>
                    • Features: Input variables<br>
                    • Labels: Target output<br>
                    • Training set: Learn patterns<br>
                    • Test set: Validate accuracy<br>
                    • Hyperparameters: Model configuration
                </p>
            </div>
        `;
    },
};

const AlgorithmVizTypeMap = {
    bubble_sort: 'sorting_process',
    selection_sort: 'sorting_process',
    insertion_sort: 'sorting_process',
    merge_sort: 'sorting_process',
    quick_sort: 'sorting_process',
    heap_sort: 'sorting_process',
    linear_search: 'array',
    binary_search: 'array',
    bfs: 'binary_tree',
    dfs: 'binary_tree',
    astar: 'binary_tree',
    dijkstra: 'binary_tree',
    minimax: 'binary_tree',
    bst: 'binary_tree',
    knapsack: 'array',
    lcs: 'array',
    activity_selection: 'sorting_process',
    linear_regression: 'ml_concept',
    logistic_regression: 'ml_concept',
    kmeans: 'ml_concept',
    knn: 'ml_concept',
    decision_tree: 'binary_tree',
    naive_bayes: 'ml_concept',
    neural_network: 'ml_concept',
    backtracking: 'binary_tree',
    recursion: 'binary_tree',
    string_algorithm: 'array',
    math_algorithm: 'array',
    bit_conversion: 'array',
    array_algorithm: 'array',
    hashing_algorithm: 'hash_map',
};

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderPayloadSummary(container, payload) {
    if (!container || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return;
    }
    const keys = Object.keys(payload).filter((key) => key !== 'mode' && key !== 'algorithm');
    if (!keys.length) {
        return;
    }
    const rows = keys.slice(0, 6).map((key) => {
        const value = payload[key];
        const rendered = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid var(--aq-border);">
            <span style="font-weight:600;color:var(--aq-viz-box-text);">${escapeHtml(key)}</span>
            <span style="color:var(--aq-viz-box-muted);max-width:70%;text-align:right;word-break:break-word;">${escapeHtml(rendered)}</span>
        </div>`;
    }).join('');

    container.insertAdjacentHTML(
        'beforeend',
        `<div style="margin-top:14px;padding:12px;background:var(--aq-viz-box-bg);border:1px solid var(--aq-border-hover);border-radius:8px;">
            <div style="font-weight:700;color:var(--aq-primary-dark);margin-bottom:6px;">Challenge Data</div>
            ${rows}
        </div>`
    );
}

// Helper to select visualization type
function showConceptualVisualization(topicId, containerId = 'visualizationOutput', algorithmType = '', visualizationType = 'conceptual', payload = {}) {
    const vizTypeMap = {
        'dsa_arrays': 'array',
        'dsa_linked_lists': 'linked_list',
        'dsa_stacks': 'stack',
        'dsa_queues': 'queue',
        'dsa_hash_maps': 'hash_map',
        'advanced_trees': 'binary_tree',
        'sort_bubble': 'sorting_process',
        'sort_quick': 'sorting_process',
        'sort_merge': 'sorting_process',
        'ml_linear_regression': 'ml_concept',
        'ml_knn': 'ml_concept',
        'ml_kmeans': 'ml_concept',
        'ml_decision_tree': 'ml_concept',
    };

    const visualizationTypeMap = {
        array: 'array',
        tree: 'binary_tree',
        graph: 'binary_tree',
        grid: 'sorting_process',
        matrix: 'sorting_process',
        conceptual: 'ml_concept',
        none: 'ml_concept',
    };

    const vizType =
        vizTypeMap[topicId] ||
        AlgorithmVizTypeMap[algorithmType] ||
        visualizationTypeMap[visualizationType] ||
        'ml_concept';
    const vizFunc = ConceptualVisualizations[vizType];

    if (vizFunc) {
        vizFunc(containerId);
        const container = document.getElementById(containerId);
        renderPayloadSummary(container, payload);
    }
}


