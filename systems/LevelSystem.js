﻿import { System } from '../core/Systems.js';
import {
    MapComponent,
    EntityListComponent,
    PositionComponent,
    VisualsComponent,
    ExplorationComponent,
    LootSourceData,
    WallComponent,
    FloorComponent,
    StairComponent,
    PortalComponent,
    FountainComponent,
    RoomComponent,
    HitboxComponent,
    SpatialBucketsComponent,
} from '../core/Components.js';

const roomTypes = [
    { type: 'SquareRoom', probability: 30, minW: 17, maxW: 23, minH: 9, maxH: 12 },
    { type: 'VerticalRoom', probability: 20, minW: 12, maxW: 14, minH: 14, maxH: 18 },
    { type: 'HorizontalRoom', probability: 35, minW: 21, maxW: 32, minH: 9, maxH: 12 },
    { type: 'AlcoveSpecial', probability: 10, minW: 12, maxW: 12, minH: 6, maxH: 6 },
    { type: 'BossChamberSpecial', probability: 5, minW: 30, maxW: 36, minH: 15, maxH: 18 }
];

export class LevelSystem extends System {
    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Map', 'Tier', 'Exploration'];
        this.ROOM_EDGE_BUFFER = 4;
        this.CORRIDOR_EDGE_BUFFER = 2;
        this.MIN_ROOM_SIZE = 8;
        this.MAX_OVERLAP_PERCENT = 0.10;
        this.INITIAL_MIN_DISTANCE = 30;
        this.MIN_DISTANCE_FLOOR = 3;
        this.BOSS_ROOM_EVERY_X_LEVELS = 3;
        this.lastBossTier = 0;
        this.MAX_PLACEMENT_ATTEMPTS = 200;
        this.MIN_STAIR_DISTANCE = 18;
        this.roomsPerLevel = 50;
        this.TILE_SIZE = this.state.TILE_SIZE || 32; 
    }

    init() {
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
        this.eventBus.on('AddLevel', (data) => this.addLevel(data));
        this.eventBus.on('CheckLevelAfterTransitions', (data) => this.checkLevelAfterTransitions(data));
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const isNewGame = gameState.tier === 0;

        if (!this.entityManager.getEntitiesWith(['Tier']).some(e => e.getComponent('Tier').value === 0)) {
            this.entityManager.setActiveTier(0);
            const levelEntity = this.entityManager.createEntity(`level_0`);
            this.entityManager.addComponentToEntity(levelEntity.id, { type: 'Tier', value: 0 });
            this.entityManager.addComponentToEntity(levelEntity.id, new EntityListComponent());
            this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
            this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());
            console.log(`LevelSystem.js: Created level entity with ID: ${levelEntity.id} for tier 0 in init`);
            this.addLevel({ tier: 0, customLevel: this.generateSurfaceLevel(levelEntity) });

            if (isNewGame) {
                gameState.tier = 1;
                this.addLevel({ tier: 1 });
                console.log(`LevelSystem.js: init - gameState.tier set to ${gameState.tier} after creating levels 0 and 1 (new game)`);
            } else {
                for (let tier = 1; tier <= gameState.tier; tier++) {
                    this.addLevel({ tier });
                }
                console.log(`LevelSystem.js: init - Preserved loaded tier ${gameState.tier}, generated levels 0 to ${gameState.tier}`);
            }
        }
    }

    removeWallAtPosition(x, y, walls, levelEntity) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= this.state.WIDTH || y >= this.state.HEIGHT) {
            console.error(`LevelSystem.js: Invalid tile coordinates (${x}, ${y}) on tier ${levelEntity.getComponent('Tier').value}`);
            return;
        }

        const tier = levelEntity.getComponent('Tier').value;
        const pixelX = x * this.TILE_SIZE;
        const pixelY = y * this.TILE_SIZE;
        const wallEntities = this.entityManager.getEntitiesWith(['Position', 'Wall']).filter(e => {
            const pos = e.getComponent('Position');
            return pos.x === pixelX && pos.y === pixelY && e.id.startsWith(`wall_${tier}_`);
        });

        if (wallEntities.length === 0) {
            console.log(`LevelSystem.js: No wall entities found at pixel (${pixelX}, ${pixelY}) for tile (${x}, ${y}) on tier ${tier}`);
        }

        wallEntities.forEach(wall => {
            const wallId = wall.id;
            this.entityManager.removeEntity(wallId);
            const wallIndex = walls.indexOf(wallId);
            if (wallIndex !== -1) {
                walls.splice(wallIndex, 1);
            }
        });

        const mapComp = levelEntity.getComponent('Map');
        if (mapComp && mapComp.map[y] && mapComp.map[y][x]) {
            mapComp.map[y][x] = ' ';
            const floorId = `floor_${tier}_floor_${y}_${x}`;
            if (!this.entityManager.getEntity(floorId)) {
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(pixelX, pixelY));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                const entityList = levelEntity.getComponent('EntityList');
                if (entityList && entityList.floors) {
                    entityList.floors.push(floorEntity.id);
                } else {
                    console.error(`LevelSystem.js: EntityListComponent missing or invalid for tier ${tier} when adding floor ${floorId}`);
                }
            }
        } else {
            console.error(`LevelSystem.js: Failed to update map at (${x}, ${y}) on tier ${tier} - mapComp or map position invalid`);
        }

        //const exploration = levelEntity.getComponent('Exploration');
        //exploration.discoveredFloors.add(`${x},${y}`);
    }

    addLevel({ tier, customLevel = null }) {
        this.entityManager.setActiveTier(tier);
        console.log(`LevelSystem.js: Starting level generation for tier ${tier}, active tier: ${this.entityManager.getActiveTier()}`);
        let levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) {
            levelEntity = this.entityManager.createEntity(`level_${tier}`);
            console.log(`LevelSystem.js: Created level entity with ID: ${levelEntity.id} for tier ${tier}`);
            this.entityManager.addComponentToEntity(levelEntity.id, { type: 'Tier', value: tier });

            let levelData;
            if (customLevel) {
                levelData = customLevel;
                const mapComp = new MapComponent(levelData);
                mapComp.map = this.padMap(levelData.map, levelData.walls, levelData.floors, tier);
                if (levelData.stairsUp) mapComp.stairsUp = levelData.stairsUp;
                if (levelData.stairsDown) mapComp.stairsDown = levelData.stairsDown;
                this.entityManager.addComponentToEntity(levelEntity.id, mapComp);

                const entityListComp = new EntityListComponent({
                    walls: levelData.walls || [],
                    floors: levelData.floors || [],
                    stairs: levelData.stairs || [],
                    portals: levelData.portals || [],
                    monsters: levelData.monsters || [],
                    treasures: levelData.treasures || [],
                    fountains: levelData.fountains || [],
                    rooms: levelData.roomEntityIds || []
                });
                this.entityManager.addComponentToEntity(levelEntity.id, entityListComp);
                this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
                this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());
                this.adjustPlayerPosition(levelEntity, levelData.stairsUp || levelData.stairsDown);
            } else {
                const hasBossRoom = (tier - this.lastBossTier >= this.BOSS_ROOM_EVERY_X_LEVELS) || Math.random() < 0.05;
                this.sfxQueue.push({ sfx: 'bossLevel0', volume: 0.5 });

                const entityList = new EntityListComponent({
                    walls: [],
                    floors: [],
                    stairs: [],
                    portals: [],
                    monsters: [],
                    treasures: [],
                    fountains: [],
                    rooms: []
                });
                this.entityManager.addComponentToEntity(levelEntity.id, entityList);
                this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
                this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());

                levelData = this.generateLevel(hasBossRoom, tier, levelEntity.id);

                const mapComp = new MapComponent(levelData);
                this.entityManager.addComponentToEntity(levelEntity.id, mapComp);

                entityList.walls = levelData.walls;
                entityList.floors = levelData.floors;
                entityList.rooms = levelData.roomEntityIds;
                entityList.fountains = this.generateFountains(tier, levelData.map, levelData.roomEntityIds);

                this.placeStairs(levelEntity, levelData, hasBossRoom);
                entityList.treasures = this.generateLootEntities(tier, levelData.map, levelData.roomEntityIds);
                mapComp.stairsUp = levelData.stairsUp;
                mapComp.stairsDown = levelData.stairsDown;
                this.adjustPlayerPosition(levelEntity, levelData.stairsUp);
                if (hasBossRoom) this.lastBossTier = tier;

                const hasElites = tier > 1;
                
                this.eventBus.emit('SpawnMonsters', {
                    tier,
                    map: levelData.map,
                    rooms: levelData.roomEntityIds,
                    hasBossRoom,
                    spawnPool: { randomMonsters: true, uniqueMonsters: hasElites }
                });
            }

            const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
            gameState.needsInitialRender = true;
            gameState.needsRender = true;
            this.ensureRoomConnections(levelEntity);

            this.checkLevelAfterTransitions({ tier, levelEntity });

            const mapComponent = levelEntity.getComponent('Map');
            if (mapComponent && ((tier === 0 && mapComponent.stairsDown) || (tier !== 0 && mapComponent.stairsUp && mapComponent.stairsDown))) {
                this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
            } else {
                console.error(`LevelSystem.js: Invalid MapComponent for tier ${tier}`);
            }
        } else {
            this.checkLevelAfterTransitions({ tier, levelEntity });
            const mapComponent = levelEntity.getComponent('Map');
            if (mapComponent && ((tier === 0 && mapComponent.stairsDown) || (tier !== 0 && mapComponent.stairsUp && mapComponent.stairsDown))) {
                this.eventBus.emit('LevelAdded', { tier, entityId: levelEntity.id });
            } else {
                console.error(`LevelSystem: Invalid MapComponent for existing tier ${tier}`);
            }
        }
    }

    generateLevel(hasBossRoom, tier, levelEntityId) {
        const levelEntity = this.entityManager.getEntity(levelEntityId);
        const map = Array.from({ length: this.state.HEIGHT }, () => Array(this.state.WIDTH).fill('#'));
        const walls = [];
        const floors = [];
        const floorPositions = new Set();

        const mapComp = new MapComponent({ map, walls, floors });
        this.entityManager.addComponentToEntity(levelEntityId, mapComp);

        for (let y = 0; y < this.state.HEIGHT; y++) {
            for (let x = 0; x < this.state.WIDTH; x++) {
                const wallEntity = this.entityManager.createEntity(`wall_${tier}_wall_${y}_${x}`);
                const pixelX = x * this.TILE_SIZE;
                const pixelY = y * this.TILE_SIZE;
                this.entityManager.addComponentToEntity(wallEntity.id, new PositionComponent(pixelX, pixelY));
                this.entityManager.addComponentToEntity(wallEntity.id, new WallComponent());
                this.entityManager.addComponentToEntity(wallEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                const visuals = wallEntity.getComponent('Visuals');
                visuals.avatar = 'img/map/wall.png';
                this.entityManager.addComponentToEntity(wallEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                walls.push(wallEntity.id);
            }
        }

        const roomEntityIds = this.placeRooms(this.roomsPerLevel, hasBossRoom, levelEntityId, tier);

        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if (!room || !Number.isFinite(room.left) || !Number.isFinite(room.top) || !Number.isFinite(room.width) || !Number.isFinite(room.height)) {
                console.error(`LevelSystem.js: Invalid room ${roomId} data: ${JSON.stringify(room)}`);
                continue;
            }
            for (let y = room.top; y < room.top + room.height; y++) {
                for (let x = room.left; x < room.left + room.width; x++) {
                    const positionKey = `${y},${x}`;
                    if (floorPositions.has(positionKey)) continue;

                    this.removeWallAtPosition(x, y, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[y][x] = ' ';
                }
            }
        }

        this.connectRooms(roomEntityIds, map, floors, walls, floorPositions, tier);
        return {
            map,
            roomEntityIds,
            rooms: roomEntityIds.map(id => this.entityManager.getEntity(id).getComponent('Room')),
            walls,
            floors
        };
    }

    placeRooms(numRooms, hasBossRoom, levelEntityId, tier) {
        const roomOrigins = new Set();
        const roomEntityIds = [];
        let bossChamberPlaced = !hasBossRoom;
        const halfRooms = Math.floor(numRooms / 2);

        if (hasBossRoom) {
            const bossRoomType = roomTypes.find(rt => rt.type === 'BossChamberSpecial');
            let room = this.generateRoomDimensions(bossRoomType);
            let attempts = 0;
            while (attempts < this.MAX_PLACEMENT_ATTEMPTS) {
                room.x = Math.floor(Math.random() * (this.state.WIDTH - room.width - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;
                room.y = Math.floor(Math.random() * (this.state.HEIGHT - room.height - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;

                if (roomOrigins.has(`${room.x},${room.y}`)) {
                    attempts++;
                    continue;
                }

                const existingRooms = roomEntityIds.map(id => this.entityManager.getEntity(id).getComponent('Room'));
                if (!this.doesRoomOverlap(room, existingRooms)) {
                    const roomEntity = this.entityManager.createEntity(`room_${tier}_${room.x}_${room.y}`);
                    this.entityManager.addComponentToEntity(roomEntity.id, new RoomComponent({
                        left: room.x,
                        top: room.y,
                        width: room.width,
                        height: room.height,
                        type: room.type
                    }));
                    roomEntityIds.push(roomEntity.id);
                    roomOrigins.add(`${room.x},${room.y}`);
                    bossChamberPlaced = true;
                    break;
                } else {
                    room.width = Math.max(this.MIN_ROOM_SIZE, room.width - 1);
                    room.height = Math.max(this.MIN_ROOM_SIZE, room.height - 1);
                    if (room.width < this.MIN_ROOM_SIZE || room.height < this.MIN_ROOM_SIZE) break;
                }
                attempts++;
            }
            if (attempts >= this.MAX_PLACEMENT_ATTEMPTS) {
                console.warn(`LevelSystem.js: Failed to place BossChamberSpecial after ${this.MAX_PLACEMENT_ATTEMPTS} attempts`);
            }
        }

        for (let i = 0; i < numRooms - (hasBossRoom ? 1 : 0); i++) {
            let roomType = this.selectRoomType();
            if (roomType.type === 'BossChamberSpecial' && bossChamberPlaced) {
                roomType = roomTypes.find(rt => rt.type === 'AlcoveSpecial');
            }
            if (roomType.type === 'BossChamberSpecial') bossChamberPlaced = true;

            let room = this.generateRoomDimensions(roomType);
            const minDistance = i < halfRooms
                ? this.INITIAL_MIN_DISTANCE
                : this.INITIAL_MIN_DISTANCE - ((this.INITIAL_MIN_DISTANCE - this.MIN_DISTANCE_FLOOR) * (i - halfRooms) / (numRooms - halfRooms));
            let attempts = 0;

            while (attempts < this.MAX_PLACEMENT_ATTEMPTS) {
                room.x = Math.floor(Math.random() * (this.state.WIDTH - room.width - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;
                room.y = Math.floor(Math.random() * (this.state.HEIGHT - room.height - 2 * this.ROOM_EDGE_BUFFER)) + this.ROOM_EDGE_BUFFER;

                if (roomOrigins.has(`${room.x},${room.y}`)) {
                    attempts++;
                    continue;
                }

                const existingRooms = roomEntityIds.map(id => this.entityManager.getEntity(id).getComponent('Room'));
                if (!this.doesRoomOverlap(room, existingRooms) && (roomEntityIds.length === 0 || !this.isTooClose(room, existingRooms, minDistance))) {
                    const roomEntity = this.entityManager.createEntity(`room_${tier}_${room.x}_${room.y}`);
                    this.entityManager.addComponentToEntity(roomEntity.id, new RoomComponent({
                        left: room.x,
                        top: room.y,
                        width: room.width,
                        height: room.height,
                        type: room.type
                    }));
                    roomEntityIds.push(roomEntity.id);
                    roomOrigins.add(`${room.x},${room.y}`);
                    break;
                } else {
                    room.width = Math.max(this.MIN_ROOM_SIZE, room.width - 1);
                    room.height = Math.max(this.MIN_ROOM_SIZE, room.height - 1);
                    if (room.width < this.MIN_ROOM_SIZE || room.height < this.MIN_ROOM_SIZE) break;
                }
                attempts++;
            }
            if (attempts >= this.MAX_PLACEMENT_ATTEMPTS) {
                console.warn(`LevelSystem.js: Failed to place room number ${roomEntityIds.length + 1} | type ${roomType.type} after ${this.MAX_PLACEMENT_ATTEMPTS} attempts`);
            }
        }
        console.log(`LevelSystem.js: Placed ${roomEntityIds.length} out of ${numRooms} rooms for tier ${tier}`);
        roomOrigins.clear();
        return roomEntityIds;
    }

    selectRoomType() {
        const totalProbability = roomTypes.reduce((sum, room) => sum + room.probability, 0);
        let roll = Math.random() * totalProbability;
        for (const roomType of roomTypes) {
            if (roll < roomType.probability) return roomType;
            roll -= roomType.probability;
        }
        return roomTypes[0];
    }

    generateRoomDimensions(roomType) {
        const width = Math.floor(Math.random() * (roomType.maxW - roomType.minW + 1)) + roomType.minW;
        const height = Math.floor(Math.random() * (roomType.maxH - roomType.minH + 1)) + roomType.minH;
        return { width, height, type: roomType.type };
    }

    doesRoomOverlap(newRoom, existingRooms) {
        const buffer = newRoom.type === 'BossChamberSpecial' || newRoom.type === 'AlcoveSpecial' ? this.CORRIDOR_EDGE_BUFFER : this.ROOM_EDGE_BUFFER;
        for (const room of existingRooms) {
            const overlapX = Math.max(0, Math.min(newRoom.x + newRoom.width + buffer, room.left + room.width) - Math.max(newRoom.x - buffer, room.left));
            const overlapY = Math.max(0, Math.min(newRoom.y + newRoom.height + buffer, room.top + room.height) - Math.max(newRoom.y - buffer, room.top));
            const overlapArea = overlapX * overlapY;
            const newRoomArea = newRoom.width * newRoom.height;
            const roomArea = room.width * room.height;
            const minArea = Math.min(newRoomArea, roomArea);
            if (overlapArea > minArea * this.MAX_OVERLAP_PERCENT) return true;
        }
        return false;
    }

    isTooClose(newRoom, existingRooms, minDistance) {
        return existingRooms.some(room => this.calculateDistance(newRoom.x, newRoom.y, room.centerX, room.centerY) < minDistance);
    }

    connectRooms(roomEntityIds, map, floors, walls, floorPositions, tier) {
        if (roomEntityIds.length === 0) return;
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        const connectedRooms = [roomEntityIds[0]];

        for (let i = 1; i < roomEntityIds.length; i++) {
            const newRoomId = roomEntityIds[i];
            const newRoom = this.entityManager.getEntity(newRoomId).getComponent('Room');
            let nearestRoomId = null;
            let attempts = 0;
            const maxAttempts = 5;

            do {
                nearestRoomId = this.findNearestRoom(newRoomId, connectedRooms,
                    newRoom.roomType === 'AlcoveSpecial' || newRoom.roomType === 'BossChamberSpecial'
                        ? connectedRooms.map(id => this.entityManager.getEntity(id).getComponent('Room').roomType)
                            .filter(type => type === 'AlcoveSpecial' || type === 'BossChamberSpecial')
                            .map((_, idx) => connectedRooms[idx])
                        : []
                );
                if (!nearestRoomId) {
                    console.warn(`findNearestRoom: Unable to find a valid room for ${newRoomId} after ${attempts} attempts. Connected rooms: ${JSON.stringify(connectedRooms)}`);
                }
                attempts++;
            } while (!nearestRoomId && attempts < maxAttempts);

            if (!nearestRoomId) {
                nearestRoomId = this.findNearestRoom(newRoomId, connectedRooms);
                console.log(`connectRooms: No valid nearest room found for room ${newRoomId} after ${maxAttempts} attempts, using fallback`);
            }
            if (!nearestRoomId) {
                console.warn(`connectRooms: Failed to find a valid nearest room for room ${newRoomId} after ${maxAttempts} attempts AND fallback failed`);
                continue;
            }

            this.carveCorridor(newRoomId, nearestRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
            newRoom.connections.push(nearestRoomId);
            const nearestRoom = this.entityManager.getEntity(nearestRoomId).getComponent('Room');
            if (!nearestRoomId) {
                console.warn(`connectRooms: No nearest room found for room ${newRoomId}`);
                continue;
            }
            nearestRoom.connections.push(newRoomId);
            connectedRooms.push(newRoomId);
        }

        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if (room.connections.length < 2 && roomEntityIds.length > 2 && room.roomType !== 'AlcoveSpecial' && room.roomType !== 'BossChamberSpecial') {
                const farRoomId = this.findFarRoom(roomId, roomEntityIds, [roomId, ...room.connections]);
                if (farRoomId) {
                    this.carveCorridor(roomId, farRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
                    const farRoom = this.entityManager.getEntity(farRoomId).getComponent('Room');
                    room.connections.push(farRoomId);
                    farRoom.connections.push(roomId);
                }
            }
            if ((room.roomType === 'AlcoveSpecial' || room.roomType === 'BossChamberSpecial') && room.connections.length > 1) {
                room.connections = [room.connections[0]];
            }
        }

        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            if ((room.roomType === 'AlcoveSpecial' || room.roomType === 'BossChamberSpecial') && room.connections.length === 1) {
                const connectedRoomId = room.connections[0];
                const connectedRoom = this.entityManager.getEntity(connectedRoomId).getComponent('Room');
                if (connectedRoom.roomType === 'AlcoveSpecial' || connectedRoom.roomType === 'BossChamberSpecial') {
                    console.warn(`Isolated pair detected: ${roomId} (${room.roomType}) and ${connectedRoomId} (${connectedRoom.roomType})`);
                    const nonSpecialRoomId = this.findNearestRoom(roomId, roomEntityIds,
                        roomEntityIds.filter(id => {
                            const r = this.entityManager.getEntity(id).getComponent('Room');
                            return r.roomType === 'AlcoveSpecial' || r.roomType === 'BossChamberSpecial' || id === roomId || id === connectedRoomId;
                        })
                    );
                    if (nonSpecialRoomId) {
                        this.carveCorridor(roomId, nonSpecialRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
                        const nonSpecialRoom = this.entityManager.getEntity(nonSpecialRoomId).getComponent('Room');
                        room.connections = [nonSpecialRoomId];
                        nonSpecialRoom.connections.push(roomId);
                        connectedRoom.connections = [];
                    }
                }
            }
        }

        console.log(`LevelSystem.js: Room connections after connectRooms for tier ${tier}:`);
        for (const roomId of roomEntityIds) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            console.log(`Room ${roomId} at (${room.left}, ${room.top}), type: ${room.roomType}, connections: ${room.connections.length} (${room.connections.join(', ')})`);
        }
    }

    carveCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity) {
        if (!startRoomId || !endRoomId) {
            console.error(`carveCorridor: Invalid room ID - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
        }
        const rand = Math.random();
        if (rand < 0.2) {
            this.carveStraightCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity);
        } else if (rand < 0.6) {
            this.carveLCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity);
        } else {
            this.carveTCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity);
        }
    }

    carveStraightCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;

        if (startX === endX) {
            const yMin = Math.min(startY, endY);
            const yMax = Math.max(startY, endY);
            for (let y = yMin; y <= yMax; y++) {
                const positionKey = `${y},${startX}`;
                if (!floorPositions.has(positionKey)) {
                    this.removeWallAtPosition(startX, y, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[y][startX] = ' ';
                }
                if (startX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${y},${startX + 1}`;
                    if (!floorPositions.has(positionKey2)) {
                        this.removeWallAtPosition(startX + 1, y, walls, levelEntity);
                        floorPositions.add(positionKey2);
                        map[y][startX + 1] = ' ';
                    }
                }
            }
        } else if (startY === endY) {
            const xMin = Math.min(startX, endX);
            const xMax = Math.max(startX, endX);
            for (let x = xMin; x <= xMax; x++) {
                const positionKey = `${startY},${x}`;
                if (!floorPositions.has(positionKey)) {
                    this.removeWallAtPosition(x, startY, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[startY][x] = ' ';
                }
                if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${startY + 1},${x}`;
                    if (!floorPositions.has(positionKey2)) {
                        this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                        floorPositions.add(positionKey2);
                        map[startY + 1][x] = ' ';
                    }
                }
            }
        }
    }

    carveLCorridor(startRoomId, endRoomId, map, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        if (!startRoomId || !endRoomId) {
            console.error(`carveLCorridor: Invalid room IDs - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        if (!startRoom || !endRoom) {
            console.error(`carveLCorridor: Failed to retrieve Room components - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }

        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;
        const midX = Math.floor((startX + endX) / 2);

        let x = startX;
        while (x !== midX) {
            const positionKey = `${startY},${x}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(x, startY, walls, levelEntity);
                floorPositions.add(positionKey);
                map[startY][x] = ' ';
            }
            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${startY + 1},${x}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[startY + 1][x] = ' ';
                }
            }
            x += Math.sign(midX - x);
        }

        let y = startY;
        while (y !== endY) {
            const positionKey = `${y},${midX}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(midX, y, walls, levelEntity);
                floorPositions.add(positionKey);
                map[y][midX] = ' ';
            }
            if (midX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${y},${midX + 1}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(midX + 1, y, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[y][midX + 1] = ' ';
                }
            }
            y += Math.sign(endY - y);
        }

        x = midX;
        while (x !== endX) {
            const positionKey = `${endY},${x}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(x, endY, walls, levelEntity);
                floorPositions.add(positionKey);
                map[endY][x] = ' ';
            }
            if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${endY + 1},${x}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(x, endY + 1, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[endY + 1][x] = ' ';
                }
            }
            x += Math.sign(endX - x);
        }
    }

    carveTCorridor(startRoomId, endRoomId, map, roomEntityIds, floors, walls, floorPositions, levelEntity) {
        const tier = levelEntity.getComponent('Tier').value;
        if (!startRoomId || !endRoomId) {
            console.error(`carveTCorridor: Invalid room IDs - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }
        const startRoom = this.entityManager.getEntity(startRoomId).getComponent('Room');
        const endRoom = this.entityManager.getEntity(endRoomId).getComponent('Room');
        if (!startRoom || !endRoom) {
            console.error(`carveTCorridor: Failed to retrieve Room components - startRoomId: ${startRoomId}, endRoomId: ${endRoomId}`);
            return;
        }

        const startX = startRoom.centerX;
        const startY = startRoom.centerY;
        const endX = endRoom.centerX;
        const endY = endRoom.centerY;

        let x = startX;
        while (x !== endX) {
            const positionKey = `${startY},${x}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(x, startY, walls, levelEntity);
                floorPositions.add(positionKey);
                map[startY][x] = ' ';
            }
            if (startY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${startY + 1},${x}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(x, startY + 1, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[startY + 1][x] = ' ';
                }
            }
            x += Math.sign(endX - x);
        }

        let y = startY;
        while (y !== endY) {
            const positionKey = `${y},${endX}`;
            if (!floorPositions.has(positionKey)) {
                this.removeWallAtPosition(endX, y, walls, levelEntity);
                floorPositions.add(positionKey);
                map[y][endX] = ' ';
            }
            if (endX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                const positionKey2 = `${y},${endX + 1}`;
                if (!floorPositions.has(positionKey2)) {
                    this.removeWallAtPosition(endX + 1, y, walls, levelEntity);
                    floorPositions.add(positionKey2);
                    map[y][endX + 1] = ' ';
                }
            }
            y += Math.sign(endY - y);
        }

        const thirdRoomId = roomEntityIds.find(rId => {
            const r = this.entityManager.getEntity(rId).getComponent('Room');
            if (rId === startRoomId || rId === endRoomId) return false;
            const dx = r.centerX - endX;
            const dy = r.centerY - endY;
            return Math.sqrt(dx * dx + dy * dy) < 10;
        });
        if (thirdRoomId) {
            const thirdRoom = this.entityManager.getEntity(thirdRoomId).getComponent('Room');
            x = endX;
            while (x !== thirdRoom.centerX) {
                const positionKey = `${endY},${x}`;
                if (!floorPositions.has(positionKey)) {
                    this.removeWallAtPosition(x, endY, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[endY][x] = ' ';
                }
                if (endY + 1 < this.state.HEIGHT - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${endY + 1},${x}`;
                    if (!floorPositions.has(positionKey2)) {
                        this.removeWallAtPosition(x, endY + 1, walls, levelEntity);
                        floorPositions.add(positionKey2);
                        map[endY + 1][x] = ' ';
                    }
                }
                x += Math.sign(thirdRoom.centerX - x);
            }

            y = endY;
            while (y !== thirdRoom.centerY) {
                const positionKey = `${y},${thirdRoom.centerX}`;
                if (!floorPositions.has(positionKey)) {
                    this.removeWallAtPosition(thirdRoom.centerX, y, walls, levelEntity);
                    floorPositions.add(positionKey);
                    map[y][thirdRoom.centerX] = ' ';
                }
                if (thirdRoom.centerX + 1 < this.state.WIDTH - this.CORRIDOR_EDGE_BUFFER) {
                    const positionKey2 = `${y},${thirdRoom.centerX + 1}`;
                    if (!floorPositions.has(positionKey2)) {
                        this.removeWallAtPosition(thirdRoom.centerX + 1, y, walls, levelEntity);
                        floorPositions.add(positionKey2);
                        map[y][thirdRoom.centerX + 1] = ' ';
                    }
                    y += Math.sign(thirdRoom.centerY - y);
                }

                thirdRoom.connections.push(endRoomId);
                endRoom.connections.push(thirdRoomId);
            }
        }
    }
        findNearestRoom(roomId, existingRoomIds, excludeRoomIds = []) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            let nearestRoomId = null;
            let minDistance = Infinity;
            for (const existingId of existingRoomIds) {
                if (excludeRoomIds.includes(existingId)) continue;
                const existingRoom = this.entityManager.getEntity(existingId).getComponent('Room');
                const distance = this.calculateDistance(room.centerX, room.centerY, existingRoom.centerX, existingRoom.centerY);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestRoomId = existingId;
                }
            }
            return nearestRoomId;
        }

        findFarRoom(roomId, existingRoomIds, excludeRoomIds = []) {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            const availableRooms = existingRoomIds.filter(rId => !excludeRoomIds.includes(rId));
            if (availableRooms.length === 0) return null;
            const sortedRooms = availableRooms.map(rId => {
                const r = this.entityManager.getEntity(rId).getComponent('Room');
                return {
                    roomId: rId,
                    distance: this.calculateDistance(room.centerX, room.centerY, r.centerX, r.centerY)
                };
            }).sort((a, b) => b.distance - a.distance);
            const farHalf = sortedRooms.slice(0, Math.ceil(sortedRooms.length / 2));
            return farHalf[Math.floor(Math.random() * farHalf.length)]?.roomId || null;
        }

        placeStairs(levelEntity, levelData, hasBossRoom) {
            const map = levelData.map;
            const entityList = levelEntity.getComponent('EntityList');
            const tier = levelEntity.getComponent('Tier').value;
            let stairDownX, stairDownY, stairUpX, stairUpY;

            if (hasBossRoom) {
                const bossRoomId = levelData.roomEntityIds.find(rId => this.entityManager.getEntity(rId).getComponent('Room').roomType === 'BossChamberSpecial');
                const bossRoom = this.entityManager.getEntity(bossRoomId).getComponent('Room');
                let attempts = 0;
                do {
                    stairDownX = bossRoom.left + 1 + Math.floor(Math.random() * (bossRoom.width - 2));
                    stairDownY = bossRoom.top + 1 + Math.floor(Math.random() * (bossRoom.height - 2));
                    attempts++;
                    if (attempts > 50) {
                        console.error('Failed to place stairsDown in boss room after 50 attempts');
                        stairDownX = bossRoom.left + 1;
                        stairDownY = bossRoom.top + 1;
                        break;
                    }
                } while (map[stairDownY][stairDownX] !== ' ');

                const stairDownEntity = this.entityManager.createEntity(`stair_${tier}_stair_down_${stairDownX}_${stairDownY}`);
                this.entityManager.addComponentToEntity(stairDownEntity.id, new PositionComponent(stairDownX * this.TILE_SIZE, stairDownY * this.TILE_SIZE));
                this.entityManager.addComponentToEntity(stairDownEntity.id, new StairComponent('down'));
                this.entityManager.addComponentToEntity(stairDownEntity.id, new VisualsComponent(32, 42));
                this.entityManager.addComponentToEntity(stairDownEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                const visuals = stairDownEntity.getComponent('Visuals');
                visuals.avatar = 'img/avatars/stairsdown.png';
                entityList.stairs.push(stairDownEntity.id);

                map[stairDownY][stairDownX] = '⇓';
                levelData.stairsDown = { x: stairDownX, y: stairDownY };
            } else {
                let attempts = 0;
                const mapCenterX = Math.floor(this.state.WIDTH / 2);
                const mapCenterY = Math.floor(this.state.HEIGHT / 2);
                while (attempts < 50) {
                    const roomId = levelData.roomEntityIds[Math.floor(Math.random() * levelData.roomEntityIds.length)];
                    const room = this.entityManager.getEntity(roomId).getComponent('Room');
                    stairDownX = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                    stairDownY = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                    if (map[stairDownY][stairDownX] === ' ' && this.calculateDistance(stairDownX, stairDownY, mapCenterX, mapCenterY) >= this.MIN_STAIR_DISTANCE) {
                        const stairDownEntity = this.entityManager.createEntity(`stair_${tier}_stair_down_${stairDownX}_${stairDownY}`);
                        this.entityManager.addComponentToEntity(stairDownEntity.id, new PositionComponent(stairDownX * this.TILE_SIZE, stairDownY * this.TILE_SIZE));
                        this.entityManager.addComponentToEntity(stairDownEntity.id, new StairComponent('down'));
                        this.entityManager.addComponentToEntity(stairDownEntity.id, new VisualsComponent(32, 42));
                        this.entityManager.addComponentToEntity(stairDownEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                        const visuals = stairDownEntity.getComponent('Visuals');
                        visuals.avatar = 'img/avatars/stairsdown.png';
                        entityList.stairs.push(stairDownEntity.id);

                        map[stairDownY][stairDownX] = '⇓';
                        levelData.stairsDown = { x: stairDownX, y: stairDownY };
                        break;
                    }
                    attempts++;
                }
                if (!levelData.stairsDown) {
                    console.warn(`Failed to place stairsDown with distance check after 50 attempts`);
                    const fallbackRoom = this.entityManager.getEntity(levelData.roomEntityIds[0]).getComponent('Room');
                    stairDownX = fallbackRoom.left + 1;
                    stairDownY = fallbackRoom.top + 1;

                    const stairDownEntity = this.entityManager.createEntity(`stair_${tier}_stair_down_${stairDownX}_${stairDownY}`);
                    this.entityManager.addComponentToEntity(stairDownEntity.id, new PositionComponent(stairDownX * this.TILE_SIZE, stairDownY * this.TILE_SIZE));
                    this.entityManager.addComponentToEntity(stairDownEntity.id, new StairComponent('down'));
                    this.entityManager.addComponentToEntity(stairDownEntity.id, new VisualsComponent(32, 42));
                    this.entityManager.addComponentToEntity(stairDownEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = stairDownEntity.getComponent('Visuals');
                    visuals.avatar = 'img/avatars/stairsdown.png';
                    entityList.stairs.push(stairDownEntity.id);

                    map[stairDownY][stairDownX] = '⇓';
                    levelData.stairsDown = { x: stairDownX, y: stairDownY };
                }
            }

            const upRooms = hasBossRoom ? levelData.roomEntityIds.filter(rId => this.entityManager.getEntity(rId).getComponent('Room').roomType !== 'BossChamberSpecial') : levelData.roomEntityIds;
            let attempts = 0;
            while (attempts < 50) {
                const roomId = upRooms[Math.floor(Math.random() * upRooms.length)];
                const room = this.entityManager.getEntity(roomId).getComponent('Room');
                stairUpX = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                stairUpY = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                if (map[stairUpY][stairUpX] === ' ' && this.calculateDistance(stairUpX, stairUpY, levelData.stairsDown.x, levelData.stairsDown.y) >= this.MIN_STAIR_DISTANCE) {
                    const stairUpEntity = this.entityManager.createEntity(`stair_${tier}_stair_up_${stairUpX}_${stairUpY}`);
                    this.entityManager.addComponentToEntity(stairUpEntity.id, new PositionComponent(stairUpX * this.TILE_SIZE, stairUpY * this.TILE_SIZE));
                    this.entityManager.addComponentToEntity(stairUpEntity.id, new StairComponent('up'));
                    this.entityManager.addComponentToEntity(stairUpEntity.id, new VisualsComponent(32, 42));
                    this.entityManager.addComponentToEntity(stairUpEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = stairUpEntity.getComponent('Visuals');
                    visuals.avatar = 'img/avatars/stairsup.png';
                    entityList.stairs.push(stairUpEntity.id);

                    map[stairUpY][stairUpX] = '⇑';
                    levelData.stairsUp = { x: stairUpX, y: stairUpY };
                    break;
                }
                attempts++;
            }
            if (!levelData.stairsUp) {
                console.warn(`Failed to place stairsUp with distance check after 50 attempts`);
                const fallbackRoom = this.entityManager.getEntity(upRooms[0]).getComponent('Room');
                stairUpX = fallbackRoom.left + 1;
                stairUpY = fallbackRoom.top + 1;

                const stairUpEntity = this.entityManager.createEntity(`stair_${tier}_stair_up_${stairUpX}_${stairUpY}`);
                this.entityManager.addComponentToEntity(stairUpEntity.id, new PositionComponent(stairUpX * this.TILE_SIZE, stairUpY * this.TILE_SIZE));
                this.entityManager.addComponentToEntity(stairUpEntity.id, new StairComponent('up'));
                this.entityManager.addComponentToEntity(stairUpEntity.id, new VisualsComponent(32, 42));
                this.entityManager.addComponentToEntity(stairUpEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                const visuals = stairUpEntity.getComponent('Visuals');
                visuals.avatar = 'img/avatars/stairsup.png';
                entityList.stairs.push(stairUpEntity.id);

                map[stairUpY][stairUpX] = '⇑';
                levelData.stairsUp = { x: stairUpX, y: stairUpY };
            }

            if (hasBossRoom) {
                console.log(`Has boss room = ${hasBossRoom}, checking stairsDown distance to map center`);
                const bossRoomId = levelData.roomEntityIds.find(rId => this.entityManager.getEntity(rId).getComponent('Room').roomType === 'BossChamberSpecial');
                const bossRoom = this.entityManager.getEntity(bossRoomId).getComponent('Room');
                const paddedDistance = this.MIN_STAIR_DISTANCE + Math.floor((bossRoom.width + bossRoom.height) / 2);
                if (this.calculateDistance(levelData.stairsDown.x, levelData.stairsDown.y, this.state.WIDTH / 2, this.state.HEIGHT / 2) < paddedDistance) {
                    console.warn(`StairsDown too close to map center with boss padding`);
                }
            }

            levelData.walls = entityList.walls;
            levelData.floors = entityList.floors;
        }

    generateLootEntities(tier, map, roomEntityIds) {
        const lootPerLevel = 5;
        const lootEntityIds = [];
        const collectEntityId = (data) => {
            if (data.tier === tier) {
                lootEntityIds.push(data.entityId);
                console.log(`LevelSystem: logged entity ID ${data.entityId} for tier ${tier}`);
            }
        };
        this.eventBus.on('LootEntityCreated', collectEntityId);

        for (let i = 0; i < lootPerLevel; i++) {
            const roomId = roomEntityIds[Math.floor(Math.random() * roomEntityIds.length)];
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            let tileX, tileY;
            let attempts = 0;
            do {
                tileX = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                tileY = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                attempts++;
                if (attempts > 50) {
                    console.error(`Failed to place loot entity in room after 50 attempts`);
                    break;
                }
            } while (map[tileY][tileX] !== ' ');

            if (attempts <= 50) {
                // Convert tile coordinates to pixel coordinates
                const pixelX = tileX * this.TILE_SIZE;
                const pixelY = tileY * this.TILE_SIZE;
                const lootSource = this.entityManager.createEntity(`loot_source_${tier}_${Date.now()}_${i}`);
                this.entityManager.addComponentToEntity(lootSource.id, new LootSourceData({
                    sourceType: "container",
                    name: "Treasure Chest",
                    tier: tier,
                    position: { x: pixelX, y: pixelY }, // Use pixel coordinates
                    sourceDetails: { id: roomId },
                    chanceModifiers: {
                        torches: 1,
                        healPotions: 1,
                        gold: 1.5,
                        item: 0.25,
                        uniqueItem: 0.8
                    },
                    maxItems: 1,
                    items: [],
                }));

                console.log(`LevelSystem: Generated loot source at pixel (${pixelX}, ${pixelY}) for tile (${tileX}, ${tileY}) on tier ${tier}`);
                this.eventBus.emit('DropLoot', { lootSource });
            }
        }

        this.eventBus.off('LootEntityCreated', collectEntityId);
        console.log(`Generated ${lootPerLevel} loot entity IDs for tier ${tier}`, lootEntityIds);
        return lootEntityIds;
    }

    generateFountains(tier, map, roomEntityIds) {
        const fountainsPerLevel = Math.floor(Math.random() * 2) + 1;
        const fountains = [];

        for (let i = 0; i < fountainsPerLevel; i++) {
            const roomId = roomEntityIds[Math.floor(Math.random() * roomEntityIds.length)];
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            let x, y;
            let attempts = 0;
            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                attempts++;
                if (attempts > 50) {
                    console.error(`Failed to place fountain in room after 50 attempts`);
                    break;
                }
            } while (map[y][x] !== ' ');
            if (attempts <= 50) {
                const fountainEntity = this.entityManager.createEntity(`fountain_${tier}_fountain_${i}`);
                this.entityManager.addComponentToEntity(fountainEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
                this.entityManager.addComponentToEntity(fountainEntity.id, new FountainComponent(false, false));
                this.entityManager.addComponentToEntity(fountainEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                this.entityManager.addComponentToEntity(fountainEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                const visuals = fountainEntity.getComponent('Visuals');
                visuals.avatar = 'img/avatars/fountain.png';
                fountains.push(fountainEntity.id);
                map[y][x] = '≅';
            }
        }
        return fountains;
    }

    generateSurfaceLevel(levelEntity) {
        const width = this.state.WIDTH;
        const height = this.state.HEIGHT;
        const map = Array(height).fill().map(() => Array(width).fill('#'));
        const walls = [];
        const floors = [];
        const stairs = [];


        for (let y = 1; y <= 9; y++) {
            for (let x = 1; x <= 13; x++) {
                map[y][x] = ' ';
                const floorId = `floor_0_floor_${y}_${x}`;
                const floorEntity = this.entityManager.createEntity(floorId);
                this.entityManager.addComponentToEntity(floorEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
                this.entityManager.addComponentToEntity(floorEntity.id, new FloorComponent());
                floors.push(floorEntity.id);
            }
        }
   

        for (let y = 0; y <= 10; y++) {
            for (let x = 0; x <= 14; x++) {
                if (y === 0 || y === 10 || x === 0 || x === 14) {
                    const wallId = `wall_0_wall_${y}_${x}`;
                    const wallEntity = this.entityManager.createEntity(wallId);
                    const pixelX = x * this.TILE_SIZE;
                    const pixelY = y * this.TILE_SIZE;
                    this.entityManager.addComponentToEntity(wallEntity.id, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(wallEntity.id, new WallComponent());
                    this.entityManager.addComponentToEntity(wallEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = wallEntity.getComponent('Visuals');
                    visuals.avatar = 'img/map/wall.png';
                    this.entityManager.addComponentToEntity(wallEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    walls.push(wallEntity.id);
                }
            }
        }



        const stairUpId = `stair_0_stair_up_2_2`;
        const stairUpEntity = this.entityManager.createEntity(stairUpId);
        this.entityManager.addComponentToEntity(stairUpEntity.id, new PositionComponent(2 * this.TILE_SIZE, 2 * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(stairUpEntity.id, new StairComponent('up'));
        this.entityManager.addComponentToEntity(stairUpEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
        const upVisuals = stairUpEntity.getComponent('Visuals');
        upVisuals.avatar = 'img/avatars/stairsup.png';
        this.entityManager.addComponentToEntity(stairUpEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
        stairs.push(stairUpId);
        map[2][2] = '⇑';


        const stairDownId = `stair_0_stair_down_12_8`;
        const stairDownEntity = this.entityManager.createEntity(stairDownId);
        this.entityManager.addComponentToEntity(stairDownEntity.id, new PositionComponent(12 * this.TILE_SIZE, 8 * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(stairDownEntity.id, new StairComponent('down'));
        this.entityManager.addComponentToEntity(stairDownEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
        const downVisuals = stairDownEntity.getComponent('Visuals');
        downVisuals.avatar = 'img/avatars/stairsdown.png';
        this.entityManager.addComponentToEntity(stairDownEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
        stairs.push(stairDownId);
        map[8][12] = '⇓';

        

        const levelData = {
            map: map,
            walls: walls,
            floors: floors,
            stairs: stairs,
            stairsDown: { x: 11, y: 7 },
            stsirsUp: { x: 2, y: 2 },
            roomEntityIds: []
        };

        const mapComp = new MapComponent(levelData);
        this.entityManager.addComponentToEntity(levelEntity.id, mapComp);
        console.log(`LevelSystem.js: Added MapComponent to ${levelEntity.id} during generateSurfaceLevel`);

        const entityListComp = levelEntity.getComponent('EntityList');
        entityListComp.walls = walls;
        entityListComp.floors = floors;
        entityListComp.stairs = stairs;
        console.log(`LevelSystem.js: Updated EntityListComponent for ${levelEntity.id} in generateSurfaceLevel`);

        return levelData;
    }

        padMap(map, walls = [], floors = [], tier = 0) {
            const padded = Array.from({ length: this.state.HEIGHT }, () => Array(this.state.WIDTH).fill('#'));

            for (let y = 0; y < map.length; y++) {
                for (let x = 0; x < map[y].length; x++) {
                    padded[y][x] = map[y][x];
                }
            }

            for (let y = 0; y < this.state.HEIGHT; y++) {
                for (let x = 0; x < this.state.WIDTH; x++) {
                    if (y < map.length && x < map[y].length) continue;

                    const wallEntity = this.entityManager.createEntity(`wall_${tier}_wall_${y}_${x}`);
                    this.entityManager.addComponentToEntity(wallEntity.id, new PositionComponent(x, y));
                    this.entityManager.addComponentToEntity(wallEntity.id, new WallComponent());
                    walls.push(wallEntity.id);
                }
            }

            return padded;
        }
    adjustPlayerPosition(levelEntity, stair) {
        const mapComponent = levelEntity.getComponent('Map');
        if (!mapComponent || !mapComponent.map) {
            console.error(`LevelSystem: No valid MapComponent or map for entity ${levelEntity.id}`);
            return;
        } 
        const map = mapComponent.map;
        const directions = [
            { x: stair.x - 1, y: stair.y }, { x: stair.x + 1, y: stair.y },
            { x: stair.x, y: stair.y - 1 }, { x: stair.x, y: stair.y + 1 }
        ];
        const player = this.entityManager.getEntity('player');
        const pos = player.getComponent('Position');
        const exploration = levelEntity.getComponent('Exploration');

        if (!Number.isFinite(this.TILE_SIZE) || this.TILE_SIZE <= 0) {
            console.error(`LevelSystem.js: Invalid TILE_SIZE (${this.TILE_SIZE}) for player positioning`);
            pos.x = this.TILE_SIZE; // Fallback to (32, 32)
            pos.y = this.TILE_SIZE;
            console.warn(`LevelSystem: Set player position to fallback (${pos.x}, ${pos.y}) due to invalid TILE_SIZE`);
            
            return;
        }

        for (const dir of directions) {
            if (dir.y >= 0 && dir.y < map.length && dir.x >= 0 && dir.x < map[0].length && map[dir.y][dir.x] === ' ') {
                pos.x = dir.x * this.TILE_SIZE;
                pos.y = dir.y * this.TILE_SIZE;
                if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
                    console.error(`LevelSystem.js: Computed NaN player position for tile (${dir.x}, ${dir.y})`);
                    pos.x = this.TILE_SIZE; // Fallback to (32, 32)
                    pos.y = this.TILE_SIZE;
                    console.warn(`LevelSystem: Set player position to fallback (${pos.x}, ${pos.y}) due to NaN`);
                } else {
                    console.warn(`LevelSystem: Set player position to (${pos.x}, ${pos.y}) near stairs at (${stair.x}, ${stair.y})`);
                }

                // Mark player's starting tile and surrounding area as discovered
                const radius = 5; // Mark a 5-tile radius as discovered
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const tileX = dir.x + dx;
                        const tileY = dir.y + dy;
                        if (tileX >= 0 && tileX < map[0].length && tileY >= 0 && tileY < map.length) {
                            if (map[tileY][tileX] === ' ') {
                                exploration.discoveredFloors.add(`${tileX},${tileY}`);
                            }
                        }
                    }
                }

               
                return;
            }
        }

        pos.x = this.TILE_SIZE;
        pos.y = this.TILE_SIZE;
        console.warn(`LevelSystem: No adjacent walkable tile found near (${stair.x}, ${stair.y}), using fallback position (${pos.x}, ${pos.y})`);
        exploration.discoveredFloors.add(`${Math.floor(pos.x / this.TILE_SIZE)},${Math.floor(pos.y / this.TILE_SIZE)}`);
       
    }

        ensureRoomConnections(levelEntity) {
            const mapComp = levelEntity.getComponent('Map');
            const entityList = levelEntity.getComponent('EntityList');
            const tier = levelEntity.getComponent('Tier').value;

            const rooms = Array.isArray(entityList.rooms) ? entityList.rooms : [];
            console.log(`LevelSystem.js: Ensuring room connections for tier ${tier}, rooms: ${JSON.stringify(rooms)}`);

            console.log(`LevelSystem.ensureRoomConnections: Room types and connections before ensuring connections:`);
            for (const roomId of rooms) {
                const room = this.entityManager.getEntity(roomId).getComponent('Room');
                console.log(`Room ${roomId} at (${room.left}, ${room.top}), type: ${room.roomType}, connections: ${room.connections.length}`);
            }

            for (const roomId of rooms) {
                const room = this.entityManager.getEntity(roomId).getComponent('Room');
                if (room.connections.length === 0) {
                    console.warn(`LevelSystem.ensureRoomConnections: Room ${roomId} has no connections, attempting to connect`);
                    const nearestRoomId = this.findNearestRoom(roomId, rooms, [roomId]);
                    if (nearestRoomId) {
                        this.carveCorridor(roomId, nearestRoomId, mapComp.map, rooms, entityList.floors, entityList.walls, new Set(), levelEntity);
                        const nearestRoom = this.entityManager.getEntity(nearestRoomId).getComponent('Room');
                        room.connections.push(nearestRoomId);
                        nearestRoom.connections.push(roomId);
                    } else {
                        console.error(`LevelSystem.ensureRoomConnections: No nearest room found for isolated non-special room ${roomId}`);
                    }
                }
            }

            for (const roomId of rooms) {
                const room = this.entityManager.getEntity(roomId).getComponent('Room');
                if ((room.roomType === 'AlcoveSpecial' || room.roomType === 'BossChamberSpecial') && room.connections.length === 0) {
                    console.warn(`Room at (${room.left}, ${room.top}) of type ${room.roomType} has no connections, adding one`);
                    const nearestRoomId = this.findNearestRoom(roomId, entityList.rooms, [roomId]);
                    if (nearestRoomId) {
                        this.carveCorridor(roomId, nearestRoomId, mapComp.map, entityList.rooms, entityList.floors, entityList.walls, new Set(), levelEntity);
                        const nearestRoom = this.entityManager.getEntity(nearestRoomId).getComponent('Room');
                        room.connections.push(nearestRoomId);
                        nearestRoom.connections.push(roomId);
                    } else {
                        console.error(`No nearest room found for isolated ${room.roomType} at (${room.left}, ${room.top})`);
                    }
                }
            }
        }

        calculateDistance(x1, y1, x2, y2) {
            return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
        }

    checkLevelAfterTransitions({ tier, levelEntity = null }) {
        const entity = levelEntity || this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!entity) {
            console.warn(`LevelSystem.js: No level entity found for tier ${tier}`);
            return;
        }
        console.log(`LevelSystem.js: Checking level ${entity.id}, components: ${Array.from(entity.components.keys())}`);

        const mapComp = entity.getComponent('Map');
        if (!mapComp) {
            console.error(`LevelSystem.js: MapComponent missing for level ${entity.id}`);
            return;
        }

        const entityList = entity.getComponent('EntityList');
        if (!entityList) {
            console.error(`LevelSystem.js: EntityListComponent missing for level ${entity.id}`);
            return;
        }

        const hasPortal = entityList.portals.length > 0;
        const minPortalPlacementTier = 3;
        if (tier >= minPortalPlacementTier && !hasPortal) {
            const rooms = entityList.rooms.map(id => this.entityManager.getEntity(id).getComponent('Room'));
            const validRooms = rooms.filter(r => r.roomType !== 'BossChamberSpecial');
            if (validRooms.length > 0) {
                const room = validRooms[Math.floor(Math.random() * validRooms.length)];
                let x, y;
                do {
                    x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                    y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                } while (mapComp.map[y][x] !== ' ');
                const portalEntity = this.entityManager.createEntity(`portal_${tier}_portal_${entityList.portals.length}`);
                this.entityManager.addComponentToEntity(portalEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
                this.entityManager.addComponentToEntity(portalEntity.id, new PortalComponent());
                this.entityManager.addComponentToEntity(portalEntity.id, new VisualsComponent(40, 32));
                this.entityManager.addComponentToEntity(portalEntity.id, new HitboxComponent(40, 32));
                const visuals = portalEntity.getComponent('Visuals');
                visuals.avatar = 'img/avatars/portal.png';
                entityList.portals.push(portalEntity.id);
                mapComp.map[y][x] = '?';
                this.eventBus.emit('PortalAdded');
            }
        }
    }

    }