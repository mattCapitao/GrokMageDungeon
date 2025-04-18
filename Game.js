﻿// Game.js - Updated
import { State } from './State.js';
import { ActionSystem } from './systems/ActionSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { PlayerSystem } from './systems/PlayerSystem.js';
import { MonsterSystem } from './systems/MonsterSystem.js';
import { DamageCalculationSystem } from './systems/DamageCalculationSystem.js';
import { LevelSystem } from './systems/LevelSystem.js';
import { LootSpawnSystem } from './systems/LootSpawnSystem.js';
import { LootCollectionSystem } from './systems/LootCollectionSystem.js';
import { ItemROGSystem } from './systems/ItemROGSystem.js';
import { LootManagerSystem } from './systems/LootManagerSystem.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { UISystem } from './systems/UISystem.js';
import { LevelTransitionSystem } from './systems/LevelTransitionSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { DataSystem } from './systems/DataSystem.js';
import { ExplorationSystem } from './systems/ExplorationSystem.js';
import { LightingSystem } from './systems/LightingSystem.js';
import { GameDataIOSystem } from './systems/GameDataIOSystem.js';
import { PlayerInputSystem } from './systems/PlayerInputSystem.js'; 
import { PlayerControllerSystem } from './systems/PlayerControllerSystem.js'; 
import { PlayerTimerSystem } from './systems/PlayerTimerSystem.js'; 
import { AffixSystem } from './systems/AffixSystem.js'; 
import { EffectsSystem } from './systems/EffectsSystem.js'; // NEW: Added
import { ComponentManagerSystem } from './systems/ComponentManagerSystem.js'; 
import { ProjectileSystem } from './systems/ProjectileSystem.js'; 
import {
    PositionComponent, VisualsComponent, HealthComponent, ManaComponent, StatsComponent, InventoryComponent, ResourceComponent,
    PlayerStateComponent, LightingState, LightSourceDefinitions, OverlayStateComponent, InputStateComponent,
    AttackSpeedComponent, MovementSpeedComponent, AffixComponent, DataProcessQueues, DeadComponent, NeedsRenderComponent, SFXQueueComponent
} from './core/Components.js';

export class Game {
    constructor() {
        this.state = new State();
        this.entityManager = this.state.entityManager;
        this.utilities = this.state.utilities;
        this.systems = {};
        this.lastUpdateTime = 0;
        this.lastMouseEventTime = 0;
        this.gameLoopId = null;

        let player = this.entityManager.getEntity('player');
        if (player) {
            this.entityManager.removeEntity('player');
        }
        player = this.entityManager.createEntity('player', true);
        this.entityManager.addComponentToEntity('player', new PositionComponent(1, 1));
        this.entityManager.addComponentToEntity('player', new VisualsComponent(32, 32));
        this.entityManager.addComponentToEntity('player', new HealthComponent(0, 0));
        this.entityManager.addComponentToEntity('player', new ManaComponent(0, 0));
        this.entityManager.addComponentToEntity('player', new StatsComponent());
        this.entityManager.addComponentToEntity('player', new InventoryComponent({
            equipped: { mainhand: null, offhand: null, armor: null, amulet: null, leftring: null, rightring: null },
            items: []
        }));
        this.entityManager.addComponentToEntity('player', new ResourceComponent(0, 0, 0, 0, 0));
        this.entityManager.addComponentToEntity('player', new PlayerStateComponent(0, 1, 0, false, false, ''));
        this.entityManager.addComponentToEntity('player', new InputStateComponent());
        this.entityManager.addComponentToEntity('player', new AttackSpeedComponent(500));
        this.entityManager.addComponentToEntity('player', new MovementSpeedComponent(250));
        this.entityManager.addComponentToEntity('player', new AffixComponent()); // New component added
        this.entityManager.addComponentToEntity('player', new NeedsRenderComponent(1, 1));

        let overlayState = this.entityManager.getEntity('overlayState');
        if (!overlayState) {
            overlayState = this.entityManager.createEntity('overlayState', true);
            this.entityManager.addComponentToEntity('overlayState', new OverlayStateComponent({
                isOpen: false,
                activeTab: null,
                logMessages: [],
                activeMenuSection: 'controls-button'
            }));
        }

        let lightingState = this.entityManager.getEntity('lightingState');
        if (lightingState) {
            this.entityManager.removeEntity('lightingState');
        }
        lightingState = this.entityManager.createEntity('lightingState', true);
        this.entityManager.addComponentToEntity('lightingState', new LightingState());
        this.entityManager.addComponentToEntity('lightingState', new LightSourceDefinitions());
       
        this.entityManager.addComponentToEntity('gameState', new DataProcessQueues());
        this.entityManager.addComponentToEntity('gameState', new SFXQueueComponent());

        this.initializeSystems().then(() => {
            this.state.eventBus.emit('InitializePlayer');
            console.log('Systems initialized and player initialized');
            
        });
        this.setupEventListeners();

    }

    async initializeSystems() {
        this.systems.data = new DataSystem(this.entityManager, this.state.eventBus);
        this.systems.action = new ActionSystem(this.entityManager, this.state.eventBus);
        this.systems.damageCalculation = new DamageCalculationSystem(this.entityManager, this.state.eventBus);
        this.systems.combat = new CombatSystem(this.entityManager, this.state.eventBus);
        this.systems.projectile = new ProjectileSystem(this.entityManager, this.state.eventBus);
        this.systems.render = new RenderSystem(this.entityManager, this.state.eventBus);
        this.systems.lootSpawn = new LootSpawnSystem(this.entityManager, this.state.eventBus);
        this.systems.lootCollection = new LootCollectionSystem(this.entityManager, this.state.eventBus);
        this.systems.itemROG = new ItemROGSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.lootManager = new LootManagerSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.player = new PlayerSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.monster = new MonsterSystem(this.entityManager, this.state.eventBus, this.systems.data);
        this.systems.level = new LevelSystem(this.entityManager, this.state.eventBus, this.state);
        this.systems.inventory = new InventorySystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.ui = new UISystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.levelTransition = new LevelTransitionSystem(this.entityManager, this.state.eventBus);
        this.systems.audio = new AudioSystem(this.entityManager, this.state.eventBus);
        this.systems.exploration = new ExplorationSystem(this.entityManager, this.state.eventBus);
        this.systems.lighting = new LightingSystem(this.entityManager, this.state.eventBus);
        this.systems.gameDataIO = new GameDataIOSystem(this.entityManager, this.state.eventBus, this.utilities);
        this.systems.playerInput = new PlayerInputSystem(this.entityManager, this.state.eventBus); 
        this.systems.playerController = new PlayerControllerSystem(this.entityManager, this.state.eventBus); 
        this.systems.playerTimer = new PlayerTimerSystem(this.entityManager, this.state.eventBus); 
        this.systems.affix = new AffixSystem(this.entityManager, this.state.eventBus);
        this.systems.effects = new EffectsSystem(this.entityManager, this.state.eventBus); // New system added
        this.systems.componentManager = new ComponentManagerSystem(this.entityManager, this.state.eventBus);

        await Promise.all(Object.values(this.systems).map(system => system.init()));
        console.log('Game.js: Systems initialized');
    }

    setupEventListeners() {
        this.mousedownHandler = () => this.updateLastMouseEvent();
        this.mousemoveHandler = () => this.updateLastMouseEvent();
        document.addEventListener('mousedown', this.mousedownHandler);
        document.addEventListener('mousemove', this.mousemoveHandler);
        this.state.eventBus.on('StartGame', () => this.start());
    }

    destroy() {
        document.removeEventListener('mousedown', this.mousedownHandler);
        document.removeEventListener('mousemove', this.mousemoveHandler);
        Object.values(this.systems).forEach(system => system.destroy?.());
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            console.log('Game.js: Game loop stopped');
        }
        console.log('Game.js: Instance destroyed');
    }

    updateLastMouseEvent() {
        this.lastMouseEventTime = Date.now();
    }

    updateSystems(systemsToUpdate, deltaTime) { // *** CHANGED: Added deltaTime parameter ***
        systemsToUpdate.forEach(systemName => {
            // *** CHANGED: Pass deltaTime to system update ***
            this.systems[systemName].update(deltaTime);
        });
        this.lastUpdateTime = Date.now();
    }

    startGameLoop() {
        let lastTime = performance.now();
        const gameLoop = (currentTime) => {
            this.gameLoopId = requestAnimationFrame(gameLoop);
            const deltaTime = (currentTime - lastTime) / 1000; // Time in seconds
            lastTime = currentTime;

            // *** NEW: Log deltaTime ***
            // console.log('Game.js: Game loop - deltaTime:', deltaTime);

            // *** CHANGED: Pass deltaTime to updateSystems ***
            this.updateSystems([
                'componentManager',
                'projectile',
                'playerInput',
                'playerController',
                'combat',
                'playerTimer',
                'player',
                'exploration',
                'monster',
                'ui',
                'affix',
                'effects',
                'render',
                'audio',
            ], deltaTime);

            const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
            if (!gameState?.gameOver) {
                // Continue the loop
            }
        };
        this.gameLoopId = requestAnimationFrame(gameLoop);
    }

    start() {
        const gameState = this.entityManager.getEntity('gameState');
        if (!gameState) {
            const newGameState = this.entityManager.createEntity('gameState', true);
            this.entityManager.addComponentToEntity('gameState', new GameStateComponent({
                gameStarted: true, // Set to true when starting
                gameOver: false,
                tier: 1, // Assuming initial tier
                // Add other GameState properties as needed
            }));
        } else {
            const gameStateComp = gameState.getComponent('GameState');
            gameStateComp.gameStarted = true;
        }
        this.startGameLoop();
        console.log('Game.js: Game started');
    }
}