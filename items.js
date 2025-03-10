console.log("Items.js loaded");

import { State } from './State.js';

export class Items {
    constructor(state) {
        this.state = state;
        this.data = this.state.data; // Access Data via State
        this.relicItems = this.data.getUniqueItems();
        this.artifactItems = this.data.getUniqueItems();

        this.itemTiers = ['junk', 'common', 'rare', 'mastercraft', 'magic', 'artifact', 'relic'];
        this.itemTypes = ['weapon', 'armor', 'amulet', 'ring'];
        this.weaponAttackTypes = ['melee', 'ranged'];

        this.itemStatOptions = {
            weapon: {
                ranged: {
                    base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'baseRange'],
                    bonus: ['intellect', 'agility', 'range', 'rangedDamageBonus', 'damageBonus'],
                },
                melee: {
                    base: ['baseDamageMin', 'baseDamageMax', 'attackType', 'baseBlock'],
                    bonus: ['prowess', 'agility', 'block', 'meleeDamageBonus', 'damageBonus'],
                },
            },
            armor: {
                base: ['armor'],
                bonus: ['maxHp', 'prowess', 'agility', 'block', 'defense'],
            },
            amulet: {
                base: ['maxLuck'],
                bonus: [
                    'maxHp', 'maxMana', 'maxLuck',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'
                ],
            },
            ring: {
                base: ['maxLuck'],
                bonus: [
                    'maxHp', 'maxMana', 'maxLuck',
                    'intellect', 'prowess', 'agility',
                    'range', 'block', 'defense',
                    'meleeDamageBonus', 'rangedDamageBonus', 'damageBonus'
                ],
            },
        };
    }

    statRoll(stat, item) {
        switch (stat) { 
            case 'baseDamageMin':
                return Math.floor(item.tierIndex * 1.5);
            case 'baseDamageMax':
                return Math.floor(Math.random() * item.tierIndex) + 1;
            case 'range':
                return Math.floor(Math.random() * 2) + 1;
            case 'block':
                return Math.floor(Math.random() * 2) + 1;
            case 'armor':
                return Math.floor(item.tierIndex) + 1;
            case 'maxLuck':
                return Math.min(Math.floor(Math.random() * 5) + Math.floor(Math.random() * 5) - 4, item.tierIndex * 2 + 1) + Math.floor(Math.random() * 2);
            case 'maxHp':
                return item.tierIndex * 2;
            case 'maxMana':
                return Math.floor(item.tierIndex / 2);
            case 'prowess':
                return Math.floor(item.tierIndex / 2);
            case 'agility':
                return Math.floor(item.tierIndex / 2);
            case 'intellect':
                return Math.floor(item.tierIndex / 2);
            case 'defense':
                return Math.floor(item.tierIndex) + 1;
            case 'damageBonus':
                return Math.floor(item.tierIndex) + 1;
            case 'meleeDamageBonus':
                return Math.floor(item.tierIndex) + 1;
            case 'rangedDamageBonus':
                return Math.floor(item.tierIndex) + 1;
            case 'baseBlock':
                return Math.floor(item.tierIndex) + 1;
            case 'baseRange':
                return Math.floor(item.tierIndex) + 4;
            default:
                console.log(`Stat ${stat} not found while attempting to generate a value for use on ${item}`);
                return 0;
        }
    }

    getBonusStats(statArray, item) {
        console.log(`getBonusStats() called with statArray:`, statArray, `for item: `, item);
        const itemTier = item.tierIndex;
        let availableStats = [...statArray];
        let selectedStats = {};

        const count = itemTier;

        for (let i = 0; i < count && availableStats.length > 0; i++) {
            const index = Math.floor(Math.random() * availableStats.length);
            const stat = availableStats.splice(index, 1)[0];
            const statValue = this.statRoll(stat, item);

            if (selectedStats.hasOwnProperty(stat)) {
                selectedStats[stat] += statValue;
            } else {
                selectedStats[stat] = statValue;
            }
        }
        console.log(`Returning selected stats:`, selectedStats);
        return selectedStats;
    }

    itemDropRoll() {
        let randomValue = Math.random() * 1;
        console.log(`itemDropRoll() randomValue: ${randomValue}`);
        let dungeonTierBonus = this.state.tier * 0.01;
        let playerLuckBonus = this.state.player.luck * 0.01;

        let rollTotal = randomValue + dungeonTierBonus + playerLuckBonus;

        console.log(`itemDropRoll() : dungeonTierBonus = ${dungeonTierBonus} : playerLuckBonus = ${playerLuckBonus} : rollTotal: ${rollTotal}`);

        let itemDropData = { roll: rollTotal, itemTier: '' };

        switch (true) {
            case randomValue < 0.99:
                itemDropData.itemTier = 'rog';
                break;
            case randomValue < 0.999:
                itemDropData.itemTier = 'artifact';
                break;
            default:
                itemDropData.itemTier = 'relic';
        }

        console.log(`itemDropRoll() returning: { roll: ,${itemDropData.roll} itemTier: ${itemDropData.itemTier}}`);
        return itemDropData;
    }

    rogItem(rollTotal, item = {}) {
        switch (true) {
            case rollTotal < 0.15: item.tier = this.itemTiers[0]; item.tierIndex = 0; break; // 'junk'
            case rollTotal < 0.78: item.tier = this.itemTiers[1]; item.tierIndex = 1; break; // 'common'
            case rollTotal < 0.93: item.tier = this.itemTiers[2]; item.tierIndex = 2; break; // 'rare'
            case rollTotal < 0.98: item.tier = this.itemTiers[3]; item.tierIndex = 3; break; // 'mastercraft'
            case rollTotal < 0.99: item.tier = this.itemTiers[4]; item.tierIndex = 4; break; // 'magic'
        }

        if (!item.type || item.type === '') {
            let randomType = this.itemTypes[Math.floor(Math.random() * this.itemTypes.length)];

            if (item.tierIndex < 2) {
                switch (randomType) {
                    case 'ring':
                        randomType = 'weapon';
                        break;
                    case 'amulet':
                        randomType = 'armor';
                        break;
                    default:
                        break;
                }
            }
            item.type = randomType;
        }

        console.log(`Generating item of type ${item.type} with tier ${item.tier}`);
        let statOptions = this.itemStatOptions[item.type];
        console.log(`Stat options for item:`, statOptions);

        switch (item.type) {
            case 'weapon':
                if (!item.attackType || item.attackType === '') {
                    item.attackType = this.weaponAttackTypes[Math.floor(Math.random() * this.weaponAttackTypes.length)];
                }
                item.baseDamageMin = Math.floor(Math.random() * 2) + this.statRoll("baseDamageMin", item);
                item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + this.statRoll("baseDamageMax", item);
                statOptions = statOptions[item.attackType];
                if (item.tierIndex > 1) { item.stats = this.getBonusStats(statOptions.bonus, item); }
                switch (item.attackType) {
                    case 'melee':
                        item.icon = 'dagger.svg';
                        item.baseBlock = Math.floor(Math.random() * 2) + this.statRoll("baseBlock", item);
                        break;
                    case 'ranged':
                        item.icon = 'orb-wand.svg';
                        item.baseRange = Math.floor(Math.random() * 2) + this.statRoll("baseRange", item);
                        break;
                }
                break;
            case 'armor':
                item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
                if (item.tierIndex > 1) {
                    console.log(`requesting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'armor.svg';
                break;
            case 'amulet':
                item.maxLuck = Math.floor(Math.random() * 2) + this.statRoll("maxLuck", item);
                if (item.tierIndex > 1) {
                    console.log(`requesting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'amulet.svg';
                break;
            case 'ring':
                item.maxLuck = Math.floor(Math.random() * 2) + this.statRoll("maxLuck", item);
                if (item.tierIndex > 1) {
                    console.log(`requesting bonus stats for item:`, item);
                    item.stats = this.getBonusStats(statOptions.bonus, item);
                }
                item.icon = 'ring.svg';
                break;
        }

        item.itemTier = item.tier;
        item.name = `${item.tier} ${item.type}`;
        console.log(`Generated item:`, item);
        let statsText = '';
        if (typeof item.stats === 'object' && item.stats !== null) {
            statsText = `with ${Object.keys(item.stats).map(stat => `${stat}: ${item.stats[stat]}`).join(', ')}`;
        }
        item.description = `A ${item.tier} ${item.type} ${statsText}`;
        return item;
    }

    calculateTorchChance() {
        let torchChance;
        if (this.state.player.torches === 0 && !this.state.player.torchLit) {
            torchChance = 0.20;
            this.state.player.torchDropFail++;
            if (this.state.player.torchDropFail === 3) {
                this.state.player.torches = 1;
                this.state.player.torchDropFail = 0;
                console.log(`Player found a torch after 3 failed attempts`);
                this.state.game.getService('ui').writeToLog('You found a discarded torch lying on the ground!');
            }
        } else if (this.state.player.torches < 2) {
            torchChance = 0.15;
        } else if (this.state.player.torches <= 5) {
            torchChance = 0.10;
        } else {
            torchChance = 0.05;
        }
        return torchChance;
    }

    calculatePotionChance() {
        let potionChance;
        if (this.state.player.healPotions === 0) { // Changed from .potions to .healPotions to match usage
            potionChance = 0.20;
            this.state.player.potionDropFail++;
            if (this.state.player.potionDropFail === 3) {
                this.state.player.potionDropFail = 0;
                return 1.0;
            }
        } else if (this.state.player.healPotions < 2) {
            potionChance = 0.15;
        } else if (this.state.player.healPotions <= 5) {
            potionChance = 0.10;
        } else {
            potionChance = 0.05;
        }
        return potionChance;
    }

    calculateItemChance() {
        let itemChance = 1.0; // Placeholder as per original
        return itemChance;
    }

    dropTreasure(monster, tier) {
        const uiService = this.state.game.getService('ui');
        const actionsService = this.state.game.getService('actions');
        const goldGain = 10 + Math.floor(Math.random() * 41) + (tier + 1) * 10;
        const torchChance = this.calculateTorchChance();
        const potionChance = this.calculatePotionChance();
        const itemChance = this.calculateItemChance();

        let droppedItems = [];
        let torchDropped = Math.random() < torchChance;
        if (torchDropped) { this.state.player.potionDropFail = 0; } // Should this be torchDropFail?
        let potionDropped = Math.random() < potionChance;
        if (potionDropped) { this.state.player.torchDropFail = 0; } // Should this be potionDropFail?

        if (Math.random() < itemChance) {
            let randomItem = {};
            const dropRoll = this.itemDropRoll();
            switch (dropRoll.itemTier) {
                case 'rog':
                    randomItem = this.rogItem(dropRoll.roll);
                    break;
                case 'artifact':
                    randomItem = this.artifactItems[Math.floor(Math.random() * this.artifactItems.length)];
                    break;
                case 'relic':
                    randomItem = this.relicItems[Math.floor(Math.random() * this.relicItems.length)];
                    break;
                default:
                    randomItem = this.rogItem(50);
                    break;
            }
            console.log(`Dropping Random item:`, randomItem);
            const escapedItem = this.escapeItemProperties(randomItem);
            droppedItems.push({ ...escapedItem });
        }

        const treasure = {
            x: monster.x,
            y: monster.y,
            name: monster.name || "Treasure Chest",
            gold: goldGain,
            torches: torchDropped ? 1 : 0,
            healPotions: potionDropped ? 1 : 0,
            items: droppedItems,
            suppressRender: monster.suppressRender,
        };

        actionsService.placeTreasure(treasure);

        if (monster.name && monster.name !== "Treasure Chest") {
            uiService.logDroppedItems(monster, goldGain, torchDropped, droppedItems);
        }
    }

        escapeItemProperties(item) {
        const uiService = this.state.game.getService('ui');
        console.log("Fetching uiService in escapeItemProperties:", uiService);
        if (!uiService || !uiService.utilities) {
            console.error("uiService or uiService.utilities is undefined! Using fallback for item:", item);
            return { ...item };
        }
        console.log("Escaping item properties for item", item);
        return {
            ...item,
            name: uiService.utilities.escapeJsonString(item.name),
            description: uiService.utilities.escapeJsonString(item.description),
        };
    }
}