﻿// core/components/PlayerComponents.js
// Defines player-related components




export class StatsComponent {
    constructor({
        unallocated = 0, intellect = 0, prowess = 0, agility = 0, maxHp = 0, maxMana = 0,
        armor = 0, defense = 0, block = 0, dodge = 0, range = 0, resistMagic = 0, baseRange = 0,
        damageBonus = 0, meleeBonus = 0, rangedBonus = 0, luck = 0, maxLuck = 0
    } = {}) {
        this.type = 'Stats';
        this.unallocated = unallocated;
        this.intellect = intellect;
        this.prowess = prowess;
        this.agility = agility;
        this.maxHp = maxHp;
        this.maxMana = maxMana;
        this.armor = armor;
        this.defense = defense;
        this.block = block;
        this.dodge = dodge;
        this.range = range;
        this.resistMagic = resistMagic;
        this.baseRange = baseRange;
        this.damageBonus = damageBonus;
        this.meleeBonus = meleeBonus;
        this.rangedBonus = rangedBonus;
        this.luck = luck;
        this.maxLuck = maxLuck;
        this.isLocked = false;

        this._internal = {
            base: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, resistMagic: 0, baseRange: 0,
                damageBonus: 0, meleeBonus: 0, rangedBonus: 0, luck: 0, maxLuck: 0
            },
            gear: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, resistMagic: 0, baseRange: 0,
                damageBonus: 0, meleeBonus: 0, rangedBonus: 0, luck: 0, maxLuck: 0
            },
            temp: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, resistMagic: 0, baseRange: 0,
                damageBonus: 0, meleeBonus: 0, rangedBonus: 0, luck: 0, maxLuck: 0
            },
            incremented: {
                intellect: 0, prowess: 0, agility: 0
            },
        };
    }
}
export class InventoryComponent {
    constructor({
        equipped = {},
        items = []
    } = {}) {
        this.type = 'Inventory';
        this.equipped = equipped; // { slot: item }
        this.items = items;       // Array of item objects
    }
}

export class ResourceComponent {
    constructor(torches = 0, healPotions = 0, gold = 0, potionDropFail = 0, torchDropFail = 0) {
        this.type = 'Resource';
        this.torches = torches;
        this.healPotions = healPotions;
        this.gold = gold;
        this.potionDropFail = potionDropFail;
        this.torchDropFail = torchDropFail;
    }
}
export class PlayerStateComponent {
    constructor({
        name = "",
        level = 1,
        xp = 0,
        nextLevelXp = 0,
        dead = false,
        lampLit = false,
        discoveredTileCount = 0,
        isInCombat = false
    } = {}) {
        this.type = 'PlayerState';
        this.name = name;
        this.level = level;
        this.xp = xp;
        this.nextLevelXp = nextLevelXp;
        this.dead = dead;
        this.lampLit = lampLit;
        this.discoveredTileCount = discoveredTileCount;
        this.isInCombat = isInCombat;
    }
}
export class InputStateComponent {
    constructor({
        keys = {} // e.g., { ArrowUp: true, ArrowLeft: true }
    } = {}) {
        this.type = 'InputState';
        this.keys = keys;
    }
}

export class NewCharacterComponent {
    constructor({
        name = "",
        level = 1,
        xp = 0,
        nextLevelXp = 0,
        dead = false,
        lampLit = false,
        discoveredTileCount = 0,
        isInCombat = false
    } = {}) {
        this.type = 'NewCharacter';
        this.name = name;
        this.level = level;
        this.xp = xp;
        this.nextLevelXp = nextLevelXp;
        this.dead = dead;
        this.lampLit = lampLit;
        this.discoveredTileCount = discoveredTileCount;
        this.isInCombat = isInCombat;
    }
}