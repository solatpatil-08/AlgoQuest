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
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #2563EB;">
                <h6 style="margin-bottom: 15px; color: #1e40af;">Array Memory Layout</h6>
                <div style="display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;">
                    <div style="width: 50px; height: 50px; background: #dbeafe; border: 2px solid #0284c7; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">3</div>
                    <div style="width: 50px; height: 50px; background: #dbeafe; border: 2px solid #0284c7; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">7</div>
                    <div style="width: 50px; height: 50px; background: #dbeafe; border: 2px solid #0284c7; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">2</div>
                    <div style="width: 50px; height: 50px; background: #dbeafe; border: 2px solid #0284c7; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">9</div>
                    <div style="width: 50px; height: 50px; background: #dbeafe; border: 2px solid #0284c7; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">1</div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                    <small style="width: 50px; text-align: center; color: #666;">idx[0]</small>
                    <small style="width: 50px; text-align: center; color: #666;">idx[1]</small>
                    <small style="width: 50px; text-align: center; color: #666;">idx[2]</small>
                    <small style="width: 50px; text-align: center; color: #666;">idx[3]</small>
                    <small style="width: 50px; text-align: center; color: #666;">idx[4]</small>
                </div>
                <p style="margin-top: 15px; color: #666; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #1e40af;">Characteristics:</strong><br>
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
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #2563EB;">
                <h6 style="margin-bottom: 15px; color: #1e40af;">Linked List Structure</h6>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-weight: bold;">
                        [3|→]
                    </div>
                    <div style="width: 20px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-weight: bold;">
                        [7|→]
                    </div>
                    <div style="width: 20px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-weight: bold;">
                        [2|→]
                    </div>
                    <div style="width: 20px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-weight: bold;">
                        [9|NULL]
                    </div>
                </div>
                <p style="color: #666; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #1e40af;">Characteristics:</strong><br>
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
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #2563EB;">
                <h6 style="margin-bottom: 15px; color: #1e40af;">Stack (LIFO - Last In First Out)</h6>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 15px;">
                    <div style="width: 100px; padding: 10px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-weight: bold;">9</div>
                    <div style="width: 100px; padding: 10px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-weight: bold;">2</div>
                    <div style="width: 100px; padding: 10px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-weight: bold;">7</div>
                    <div style="width: 100px; padding: 10px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-weight: bold;">3</div>
                    <div style="width: 100px; height: 4px; background: #374151;"></div>
                </div>
                <p style="color: #666; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #1e40af;">Operations:</strong><br>
                    • Push: O(1) - Add to top<br>
                    • Pop: O(1) - Remove from top<br>
                    • Peek: O(1) - View top<br>
                    <strong style="color: #1e40af; margin-top: 10px; display: block;">Use Cases:</strong>
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
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #2563EB;">
                <h6 style="margin-bottom: 15px; color: #1e40af;">Queue (FIFO - First In First Out)</h6>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
                    <div style="padding: 10px 15px; background: white; border: 2px solid #dc2626; border-radius: 4px; text-align: center; font-weight: bold;">
                        3
                        <div style="font-size: 10px; color: #dc2626;">OUT</div>
                    </div>
                    <div style="width: 8px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-weight: bold;">7</div>
                    <div style="width: 8px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-weight: bold;">2</div>
                    <div style="width: 8px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #16a34a; border-radius: 4px; text-align: center; font-weight: bold;">
                        9
                        <div style="font-size: 10px; color: #16a34a;">IN</div>
                    </div>
                </div>
                <p style="color: #666; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #1e40af;">Operations:</strong><br>
                    • Enqueue: O(1) - Add to back<br>
                    • Dequeue: O(1) - Remove from front<br>
                    • Peek: O(1) - View front<br>
                    <strong style="color: #1e40af; margin-top: 10px; display: block;">Use Cases:</strong>
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
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #2563EB;">
                <h6 style="margin-bottom: 15px; color: #1e40af;">Hash Map (Key-Value Store)</h6>
                <div style="margin-bottom: 15px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <tr>
                            <th style="border: 1px solid #ccc; padding: 8px; background: #dbeafe; text-align: left; font-weight: bold;">Hash</th>
                            <th style="border: 1px solid #ccc; padding: 8px; background: #dbeafe; text-align: left; font-weight: bold;">Key</th>
                            <th style="border: 1px solid #ccc; padding: 8px; background: #dbeafe; text-align: left; font-weight: bold;">Value</th>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ccc; padding: 8px;">0</td>
                            <td style="border: 1px solid #ccc; padding: 8px;">"name"</td>
                            <td style="border: 1px solid #ccc; padding: 8px;">"Alice"</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ccc; padding: 8px;">1</td>
                            <td style="border: 1px solid #ccc; padding: 8px;">"age"</td>
                            <td style="border: 1px solid #ccc; padding: 8px;">30</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ccc; padding: 8px;">2</td>
                            <td style="border: 1px solid #ccc; padding: 8px;"></td>
                            <td style="border: 1px solid #ccc; padding: 8px;"></td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ccc; padding: 8px;">3</td>
                            <td style="border: 1px solid #ccc; padding: 8px;">"city"</td>
                            <td style="border: 1px solid #ccc; padding: 8px;">"NYC"</td>
                        </tr>
                    </table>
                </div>
                <p style="color: #666; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #1e40af;">Operations:</strong><br>
                    • Get: O(1) avg - Direct lookup via hash<br>
                    • Set: O(1) avg - Insert with hash<br>
                    • Delete: O(1) avg - Remove via hash<br>
                    <strong style="color: #1e40af; margin-top: 10px; display: block;">Collision handling:</strong>
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
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #2563EB;">
                <h6 style="margin-bottom: 15px; color: #1e40af;">Binary Tree Structure</h6>
                <div style="text-align: center; margin-bottom: 15px; font-family: monospace;">
                    <div style="margin-bottom: 15px;">
                        <div style="display: inline-block; padding: 8px 12px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-weight: bold;">4</div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <div style="margin-bottom: 10px; height: 20px; position: relative; display: flex; justify-content: center;">
                            <div style="width: 60px; height: 2px; background: #0284c7; position: absolute; top: 0;"></div>
                        </div>
                        <div style="display: flex; justify-content: center; gap: 80px;">
                            <div style="display: inline-block; padding: 8px 12px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-weight: bold;">2</div>
                            <div style="display: inline-block; padding: 8px 12px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-weight: bold;">6</div>
                        </div>
                    </div>
                    <div style="margin-bottom: 10px; height: 20px; position: relative; display: flex; justify-content: space-around; padding: 0 20px;">
                        <div style="width: 40px; height: 2px; background: #0284c7;"></div>
                        <div style="width: 40px; height: 2px; background: #0284c7;"></div>
                        <div style="width: 40px; height: 2px; background: #0284c7;"></div>
                        <div style="width: 40px; height: 2px; background: #0284c7;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-around; padding: 0 20px;">
                        <div style="display: inline-block; padding: 5px 10px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-size: 12px;">1</div>
                        <div style="display: inline-block; padding: 5px 10px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-size: 12px;">3</div>
                        <div style="display: inline-block; padding: 5px 10px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-size: 12px;">5</div>
                        <div style="display: inline-block; padding: 5px 10px; background: white; border: 2px solid #0284c7; border-radius: 4px; font-size: 12px;">7</div>
                    </div>
                </div>
                <p style="color: #666; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #1e40af;">Properties:</strong><br>
                    • Each node has max 2 children<br>
                    • Root: top node (single)<br>
                    • Leaf: no children<br>
                    <strong style="color: #1e40af; margin-top: 10px; display: block;">Traversals:</strong>
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
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #2563EB;">
                <h6 style="margin-bottom: 15px; color: #1e40af;">Sorting Process Illustration</h6>
                <div style="margin-bottom: 20px;">
                    <div style="margin-bottom: 10px;">
                        <small style="color: #666; font-weight: bold;">Unsorted:</small>
                        <div style="display: flex; gap: 6px;">
                            <div style="width: 30px; height: 80px; background: #fca5a5; border: 2px solid #dc2626; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">9</div>
                            <div style="width: 30px; height: 30px; background: #fca5a5; border: 2px solid #dc2626; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">3</div>
                            <div style="width: 30px; height: 50px; background: #fca5a5; border: 2px solid #dc2626; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">5</div>
                            <div style="width: 30px; height: 70px; background: #fca5a5; border: 2px solid #dc2626; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">8</div>
                        </div>
                    </div>
                    <div>
                        <small style="color: #666; font-weight: bold;">Sorted:</small>
                        <div style="display: flex; gap: 6px;">
                            <div style="width: 30px; height: 30px; background: #86efac; border: 2px solid #16a34a; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">3</div>
                            <div style="width: 30px; height: 50px; background: #86efac; border: 2px solid #16a34a; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">5</div>
                            <div style="width: 30px; height: 70px; background: #86efac; border: 2px solid #16a34a; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">8</div>
                            <div style="width: 30px; height: 80px; background: #86efac; border: 2px solid #16a34a; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold;">9</div>
                        </div>
                    </div>
                </div>
                <p style="color: #666; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #1e40af;">Common Algorithms:</strong><br>
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
            <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #2563EB;">
                <h6 style="margin-bottom: 15px; color: #1e40af;">Machine Learning Workflow</h6>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 15px;">
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold;">
                        Data<br><small style="font-weight: normal;">Collect</small>
                    </div>
                    <div style="width: 20px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold;">
                        Preprocess<br><small style="font-weight: normal;">Clean</small>
                    </div>
                    <div style="width: 20px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold;">
                        Train<br><small style="font-weight: normal;">Model</small>
                    </div>
                    <div style="width: 20px; height: 2px; background: #0284c7;"></div>
                    <div style="padding: 10px 15px; background: white; border: 2px solid #0284c7; border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold;">
                        Evaluate<br><small style="font-weight: normal;">Test</small>
                    </div>
                </div>
                <p style="color: #666; font-size: 13px; line-height: 1.6;">
                    <strong style="color: #1e40af;">Key Concepts:</strong><br>
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

// Helper to select visualization type
function showConceptualVisualization(topicId, containerId = 'visualizationOutput') {
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
    
    const vizType = vizTypeMap[topicId] || 'ml_concept';
    const vizFunc = ConceptualVisualizations[vizType];
    
    if (vizFunc) {
        vizFunc(containerId);
    }
}
