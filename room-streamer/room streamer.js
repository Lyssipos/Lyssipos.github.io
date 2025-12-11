class RoomStreamer {
    constructor() {
        // Room Configuration
        this.roomWidth = 5;   // 5 meters wide (X-axis)
        this.roomDepth = 7;   // 7 meters deep (Z-axis)
        this.roomHeight = 2.5; // 2.5 meters high (Y-axis)
        
        // Stream Configuration
        this.streamStart = { x: 0, y: 0.5, z: 0 };    // Left side of room
        this.streamEnd = { x: 5, y: 0.5, z: 0 };      // Right side of room
        this.streamLength = 5; // 5 meters
        
        // State Management
        this.models = [];
        this.activeModels = [];
        this.isStreaming = false;
        this.streamInterval = null;
        this.modelCount = 0;
        this.maxModels = 10;
        this.loadedModels = 0;
        this.totalModels = 10;
        
        // Performance
        this.frameCount = 0;
        this.lastFPSUpdate = Date.now();
        this.currentFPS = 60;
        
        // Model Configuration
        this.modelConfigs = this.generateModelConfigs();
        this.modelBaseURL = 'models/';
        this.modelExtension = '.glb';
        
        // Room State
        this.isRoomDefined = false;
        this.roomOrigin = null; // World position of room origin (Hiro marker)
        
        // Model Pool
        this.modelPool = [];
        this.poolSize = 3;
        
        this.init();
    }
    
    generateModelConfigs() {
        // Generate configurations for 10 models
        const colors = [
            '#FF5252', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0',
            '#00BCD4', '#FF4081', '#8BC34A', '#FFC107', '#795548'
        ];
        
        const names = [
            'Building 1', 'Vehicle 1', 'Structure 1', 'Monument 1', 'Tower 1',
            'Building 2', 'Vehicle 2', 'Structure 2', 'Monument 2', 'Tower 2'
        ];
        
        return Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            name: names[i],
            color: colors[i],
            scale: `${0.3 + (Math.random() * 0.2)} ${0.3 + (Math.random() * 0.2)} ${0.3 + (Math.random() * 0.2)}`,
            rotation: `0 ${Math.random() * 360} 0`,
            speed: 0.5 + (Math.random() * 0.3), // Movement speed in m/s
            lane: Math.floor(Math.random() * 3) // 0: front, 1: middle, 2: back
        }));
    }
    
    async init() {
        console.log('Initializing Room Streamer...');
        console.log(`Room Dimensions: ${this.roomWidth}m × ${this.roomDepth}m`);
        console.log(`Stream Path: ${this.streamLength}m from (${this.streamStart.x},${this.streamStart.z}) to (${this.streamEnd.x},${this.streamEnd.z})`);
        
        this.createRoomGrid();
        this.setupEventListeners();
        await this.preloadModels();
        this.setupMarkerHandlers();
    }
    
    createRoomGrid() {
        const grid = document.getElementById('roomGrid');
        grid.innerHTML = '';
        
        // Create grid cells for visualization
        const cellSize = 34; // 170px / 5 cells = 34px each
        const depthCells = 5; // Show 5 depth cells for visualization
        
        for (let x = 0; x < 5; x++) {
            for (let z = 0; z < depthCells; z++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.style.width = `${cellSize}px`;
                cell.style.height = `${cellSize}px`;
                cell.style.left = `${x * cellSize}px`;
                cell.style.top = `${z * cellSize}px`;
                grid.appendChild(cell);
            }
        }
        
        // Add stream indicator
        const streamIndicator = document.createElement('div');
        streamIndicator.className = 'stream-indicator';
        streamIndicator.style.width = `${this.streamLength * 34}px`; // Scale: 34px per meter
        streamIndicator.style.height = '6px';
        streamIndicator.style.left = `${this.streamStart.x * 34}px`;
        streamIndicator.style.top = '50px'; // Middle lane
        grid.appendChild(streamIndicator);
    }
    
    updateRoomVisualization() {
        const grid = document.getElementById('roomGrid');
        
        // Remove existing model dots
        const existingDots = grid.querySelectorAll('.model-dot');
        existingDots.forEach(dot => dot.remove());
        
        // Add dots for active models
        this.activeModels.forEach(model => {
            if (model.worldPosition && model.worldPosition.x !== undefined) {
                const dot = document.createElement('div');
                dot.className = 'model-dot';
                
                // Convert world position to grid coordinates
                const gridX = (model.worldPosition.x - this.roomOrigin.x) * 34;
                const gridZ = (model.worldPosition.z - this.roomOrigin.z) * 20; // Adjusted for visualization
                
                if (gridX >= 0 && gridX <= 170 && gridZ >= 0 && gridZ <= 100) {
                    dot.style.left = `${gridX}px`;
                    dot.style.top = `${gridZ}px`;
                    dot.style.backgroundColor = model.config?.color || '#4CAF50';
                    grid.appendChild(dot);
                }
            }
        });
    }
    
    setupEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.startStream());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopStream());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetStream());
        document.getElementById('showRoomBtn').addEventListener('click', () => this.toggleRoomVisibility());
        
        // Hide instructions after 10 seconds
        setTimeout(() => {
            document.getElementById('instructions').classList.add('hidden');
        }, 10000);
    }
    
    setupMarkerHandlers() {
        const marker = document.getElementById('marker');
        
        marker.addEventListener('markerFound', (event) => {
            console.log('Hiro marker found at entrance door');
            this.onMarkerFound(event);
        });
        
        marker.addEventListener('markerLost', () => {
            console.log('Hiro marker lost');
            this.stopStream();
        });
    }
    
    onMarkerFound(event) {
        // Get marker position in world coordinates
        const markerEl = event.target;
        const markerPos = markerEl.getAttribute('position');
        
        // Set room origin to marker position (entrance door)
        this.roomOrigin = {
            x: markerPos.x,
            y: markerPos.y,
            z: markerPos.z
        };
        
        // Calculate stream positions relative to room origin
        this.streamStart = {
            x: this.roomOrigin.x,
            y: this.roomOrigin.y + 0.5,
            z: this.roomOrigin.z
        };
        
        this.streamEnd = {
            x: this.roomOrigin.x + this.roomWidth,
            y: this.roomOrigin.y + 0.5,
            z: this.roomOrigin.z
        };
        
        // Define the room boundaries
        this.defineRoom();
        
        console.log('Room defined at:', this.roomOrigin);
        console.log('Stream start:', this.streamStart);
        console.log('Stream end:', this.streamEnd);
        
        document.getElementById('roomStatus').textContent = 'Defined';
        document.getElementById('roomVisualizer').classList.remove('hidden');
    }
    
    defineRoom() {
        const roomBoundaries = document.getElementById('room-boundaries');
        
        // Position room boundaries relative to marker
        roomBoundaries.setAttribute('position', {
            x: this.roomOrigin.x,
            y: this.roomOrigin.y,
            z: this.roomOrigin.z
        });
        
        // Show room boundaries
        roomBoundaries.setAttribute('visible', 'true');
        
        // Update start and end points
        document.getElementById('start-point').setAttribute('position', '0 0.2 0');
        document.getElementById('end-point').setAttribute('position', `${this.roomWidth} 0.2 0`);
        
        // Create grid lines for better spatial awareness
        const gridLines = document.getElementById('room-grid-lines');
        gridLines.innerHTML = '';
        
        // Add grid lines every meter
        for (let x = 0; x <= this.roomWidth; x++) {
            const line = document.createElement('a-entity');
            line.setAttribute('line', {
                start: `${x} 0 0`,
                end: `${x} 0 ${this.roomDepth}`,
                color: '#64b5f6',
                opacity: 0.2
            });
            gridLines.appendChild(line);
        }
        
        for (let z = 0; z <= this.roomDepth; z++) {
            const line = document.createElement('a-entity');
            line.setAttribute('line', {
                start: `0 0 ${z}`,
                end: `${this.roomWidth} 0 ${z}`,
                color: '#64b5f6',
                opacity: 0.2
            });
            gridLines.appendChild(line);
        }
        
        this.isRoomDefined = true;
        console.log(`Room defined: ${this.roomWidth}m × ${this.roomDepth}m`);
    }
    
    toggleRoomVisibility() {
        const roomBoundaries = document.getElementById('room-boundaries');
        const isVisible = roomBoundaries.getAttribute('visible');
        roomBoundaries.setAttribute('visible', isVisible === 'true' ? 'false' : 'true');
    }
    
    async preloadModels() {
        console.log('Preloading GLB models...');
        
        for (let i = 0; i < this.modelConfigs.length; i++) {
            const config = this.modelConfigs[i];
            
            try {
                await this.loadModel(config);
                this.loadedModels++;
                
                // Update progress
                const progress = (this.loadedModels / this.totalModels) * 100;
                document.getElementById('progressBar').style.width = `${progress}%`;
                document.getElementById('progressText').textContent = 
                    `Loading model ${this.loadedModels}/${this.totalModels}: ${config.name}`;
                
            } catch (error) {
                console.error(`Failed to load model ${config.id}:`, error);
                this.createFallbackModel(config);
                this.loadedModels++;
            }
            
            // Small delay between loads
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Hide loader
        setTimeout(() => {
            document.getElementById('loader').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loader').style.display = 'none';
            }, 500);
        }, 1000);
    }
    
    async loadModel(config) {
        return new Promise((resolve, reject) => {
            const modelURL = `${this.modelBaseURL}model_${config.id}${this.modelExtension}`;
            
            const model = document.createElement('a-entity');
            model.id = `model-template-${config.id}`;
            model.className = 'intersectable';
            
            model.setAttribute('gltf-model', `url(${modelURL})`);
            model.setAttribute('scale', config.scale);
            model.setAttribute('rotation', config.rotation);
            model.setAttribute('shadow', 'receive: true; cast: true');
            model.setAttribute('visible', 'false');
            
            // Add animation
            model.setAttribute('animation', {
                property: 'rotation',
                to: `0 ${360 + (config.id * 30)} 0`,
                dur: 10000 + (config.id * 1000),
                loop: true,
                easing: 'linear'
            });
            
            model.addEventListener('model-loaded', () => {
                console.log(`Model ${config.id} (${config.name}) loaded`);
                
                // Add to pool
                for (let j = 0; j < this.poolSize; j++) {
                    const clone = model.cloneNode(true);
                    clone.id = `model-${config.id}-clone-${j}`;
                    clone.setAttribute('visible', 'false');
                    document.getElementById('model-pool').appendChild(clone);
                    this.modelPool.push({
                        element: clone,
                        config: config,
                        inUse: false
                    });
                }
                
                resolve();
            });
            
            model.addEventListener('model-error', () => {
                this.createFallbackModel(config);
                resolve();
            });
            
            document.getElementById('model-pool').appendChild(model);
            
            setTimeout(() => {
                if (!model.hasLoaded) {
                    this.createFallbackModel(config);
                    resolve();
                }
            }, 10000);
        });
    }
    
    createFallbackModel(config) {
        const primitives = ['box', 'sphere', 'cylinder', 'cone', 'torus'];
        const primitive = primitives[config.id % primitives.length];
        
        const model = document.createElement('a-entity');
        model.id = `model-fallback-${config.id}`;
        model.className = 'intersectable';
        
        model.setAttribute('geometry', `primitive: ${primitive}`);
        model.setAttribute('material', `color: ${config.color}; metalness: 0.3; roughness: 0.4`);
        model.setAttribute('scale', config.scale);
        model.setAttribute('shadow', 'receive: true');
        model.setAttribute('visible', 'false');
        
        model.setAttribute('animation', {
            property: 'rotation',
            to: '0 360 0',
            dur: 8000,
            loop: true,
            easing: 'linear'
        });
        
        for (let i = 0; i < this.poolSize; i++) {
            const clone = model.cloneNode(true);
            clone.id = `model-fallback-${config.id}-clone-${i}`;
            clone.setAttribute('visible', 'false');
            document.getElementById('model-pool').appendChild(clone);
            this.modelPool.push({
                element: clone,
                config: config,
                isFallback: true,
                inUse: false
            });
        }
    }
    
    startStream() {
        if (!this.isRoomDefined) {
            alert('Please place the Hiro marker at the entrance door first');
            return;
        }
        
        if (this.isStreaming) return;
        
        this.isStreaming = true;
        console.log('Starting stream from left to right across room');
        
        // Update UI
        document.getElementById('startBtn').innerHTML = '<span>🔴 Streaming</span>';
        document.getElementById('startBtn').classList.add('btn-stop');
        document.getElementById('startBtn').classList.remove('btn-start');
        
        // Start spawning models
        this.lastSpawnTime = 0;
        this.streamInterval = setInterval(() => {
            const now = Date.now();
            if (now - this.lastSpawnTime >= 1500) { // Spawn every 1.5 seconds
                this.spawnModel();
                this.lastSpawnTime = now;
            }
            
            this.updateActiveModels();
            this.updateRoomVisualization();
        }, 100);
    }
    
    spawnModel() {
        if (this.activeModels.length >= this.maxModels) {
            this.recycleOldestModel();
        }
        
        // Get available model
        const availableModels = this.modelPool.filter(m => !m.inUse);
        if (availableModels.length === 0) return;
        
        const modelData = availableModels[Math.floor(Math.random() * availableModels.length)];
        const model = modelData.element.cloneNode(true);
        const config = modelData.config;
        
        // Generate unique ID
        const modelId = `stream-model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        model.id = modelId;
        model.className = 'intersectable streaming-model';
        
        // Calculate position based on lane
        const laneDepth = this.roomDepth / 3;
        const laneZ = (config.lane * laneDepth) - (this.roomDepth / 6);
        
        // Set starting position (left side of room)
        const startX = this.streamStart.x;
        const startY = this.streamStart.y + (Math.random() * 0.5);
        const startZ = this.streamStart.z + laneZ + (Math.random() * 0.5 - 0.25);
        
        model.setAttribute('position', {
            x: startX,
            y: startY,
            z: startZ
        });
        
        // Add to scene
        const scene = document.querySelector('a-scene');
        scene.appendChild(model);
        
        // Mark as in use
        modelData.inUse = true;
        
        // Store model data
        const modelObj = {
            id: modelId,
            element: model,
            poolItem: modelData,
            config: config,
            createdAt: Date.now(),
            startX: startX,
            startY: startY,
            startZ: startZ,
            currentX: startX,
            speed: config.speed,
            lane: config.lane,
            worldPosition: {
                x: this.roomOrigin.x + startX,
                y: this.roomOrigin.y + startY,
                z: this.roomOrigin.z + startZ
            }
        };
        
        this.activeModels.push(modelObj);
        this.modelCount++;
        
        this.updateUI();
    }
    
    updateActiveModels() {
        const now = Date.now();
        
        for (let i = this.activeModels.length - 1; i >= 0; i--) {
            const modelObj = this.activeModels[i];
            
            if (!modelObj.element.parentNode) {
                this.activeModels.splice(i, 1);
                continue;
            }
            
            // Calculate delta time
            const deltaTime = (now - modelObj.createdAt) / 1000; // Convert to seconds
            
            // Update position (move right along X-axis)
            const distanceTraveled = modelObj.speed * deltaTime;
            const newX = modelObj.startX + distanceTraveled;
            
            // Check if model has reached end of stream
            if (newX >= this.streamEnd.x) {
                this.recycleModel(modelObj.id);
                continue;
            }
            
            // Update position with slight vertical movement
            const currentY = modelObj.startY + Math.sin(deltaTime) * 0.1;
            
            modelObj.element.setAttribute('position', {
                x: newX,
                y: currentY,
                z: modelObj.startZ
            });
            
            // Update world position for visualization
            modelObj.worldPosition = {
                x: this.roomOrigin.x + newX,
                y: this.roomOrigin.y + currentY,
                z: this.roomOrigin.z + modelObj.startZ
            };
            
            modelObj.currentX = newX;
            
            // Check for intersections
            this.checkIntersections(modelObj);
        }
        
        this.updateUI();
    }
    
    checkIntersections(modelObj) {
        const pos = modelObj.worldPosition;
        
        this.activeModels.forEach(otherModel => {
            if (otherModel.id === modelObj.id || !otherModel.element.parentNode) return;
            
            const otherPos = otherModel.worldPosition;
            const distance = Math.sqrt(
                Math.pow(pos.x - otherPos.x, 2) +
                Math.pow(pos.y - otherPos.y, 2) +
                Math.pow(pos.z - otherPos.z, 2)
            );
            
            if (distance < 0.3) { // Intersection threshold
                this.onIntersection(modelObj, otherModel);
            }
        });
    }
    
    onIntersection(modelA, modelB) {
        // Visual feedback for intersection
        modelA.element.setAttribute('material', 'emissive', modelA.config.color);
        modelB.element.setAttribute('material', 'emissive', modelB.config.color);
        
        // Create connection line
        this.createConnectionLine(modelA.worldPosition, modelB.worldPosition);
        
        // Reset after delay
        setTimeout(() => {
            if (modelA.element.parentNode) {
                modelA.element.removeAttribute('material', 'emissive');
            }
            if (modelB.element.parentNode) {
                modelB.element.removeAttribute('material', 'emissive');
            }
        }, 300);
    }
    
    createConnectionLine(pos1, pos2) {
        const lineId = `connection-${Date.now()}`;
        const line = document.createElement('a-entity');
        line.id = lineId;
        
        line.setAttribute('line', {
            start: `${pos1.x} ${pos1.y} ${pos1.z}`,
            end: `${pos2.x} ${pos2.y} ${pos2.z}`,
            color: '#FF9800',
            opacity: 0.8
        });
        
        document.querySelector('a-scene').appendChild(line);
        
        // Remove after 1 second
        setTimeout(() => {
            if (line.parentNode) {
                line.parentNode.removeChild(line);
            }
        }, 1000);
    }
    
    recycleModel(modelId) {
        const index = this.activeModels.findIndex(m => m.id === modelId);
        if (index === -1) return;
        
        const modelObj = this.activeModels[index];
        
        // Remove from scene
        if (modelObj.element.parentNode) {
            modelObj.element.parentNode.removeChild(modelObj.element);
        }
        
        // Return to pool
        if (modelObj.poolItem) {
            modelObj.poolItem.inUse = false;
        }
        
        // Remove from active models
        this.activeModels.splice(index, 1);
        
        // Spawn new model to maintain continuous stream
        if (this.isStreaming) {
            setTimeout(() => this.spawnModel(), 300);
        }
    }
    
    recycleOldestModel() {
        if (this.activeModels.length > 0) {
            this.recycleModel(this.activeModels[0].id);
        }
    }
    
    updateUI() {
        document.getElementById('modelCount').textContent = this.activeModels.length;
        
        if (this.roomOrigin) {
            document.getElementById('streamPos').textContent = 
                `${this.roomOrigin.x.toFixed(1)}, ${this.roomOrigin.y.toFixed(1)}, ${this.roomOrigin.z.toFixed(1)}`;
        }
        
        // Calculate average stream progress
        let totalProgress = 0;
        this.activeModels.forEach(model => {
            const progress = ((model.currentX - this.streamStart.x) / this.streamLength) * 100;
            totalProgress += progress;
        });
        
        const avgProgress = this.activeModels.length > 0 ? 
            (totalProgress / this.activeModels.length).toFixed(0) : 0;
        
        document.getElementById('streamPath').textContent = 
            `${avgProgress}% (${(avgProgress * this.streamLength / 100).toFixed(1)}/${this.streamLength}m)`;
    }
    
    stopStream() {
        this.isStreaming = false;
        clearInterval(this.streamInterval);
        
        // Reset UI
        document.getElementById('startBtn').innerHTML = '<span>▶️ Start Stream</span>';
        document.getElementById('startBtn').classList.remove('btn-stop');
        document.getElementById('startBtn').classList.add('btn-start');
        
        console.log('Stream stopped');
    }
    
    resetStream() {
        this.stopStream();
        
        // Remove all active models
        this.activeModels.forEach(model => {
            if (model.element.parentNode) {
                model.element.parentNode.removeChild(model.element);
            }
            if (model.poolItem) {
                model.poolItem.inUse = false;
            }
        });
        
        this.activeModels = [];
        this.modelCount = 0;
        this.updateUI();
        
        console.log('Stream reset');
    }
}

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
    window.roomStreamer = new RoomStreamer();
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.roomStreamer) {
        window.roomStreamer.stopStream();
    }
});
