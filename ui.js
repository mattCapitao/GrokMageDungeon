﻿console.log("UI.js loaded");

import { State } from './State.js';

export class UI {
    constructor(state) {
        this.state = state;
        this.utilities = this.state.utilities; // Ensure this line exists
        this.tooltipCache = new Map();
    }

    updatePlayerInfo() {
        const playerInfo = document.getElementById('player-info');
        playerInfo.innerHTML = `
            <div class="player-info-child">Player: ${this.state.player.name}</div>
            <div class="player-info-child">Level: ${this.state.player.level}</div>
            <div class="player-info-child">Dungeon Tier: ${this.state.tier}</div>
            <div class="player-info-child">Gold: ${this.state.player.gold}</div>`;
    }

    updatePlayerStatus() {
        const playerStatus = document.getElementById('player-status');
        playerStatus.innerHTML = `
        <div class="player-status-child">Heal Potions: ${this.state.player.healPotions}</div>
        <div class="player-status-child bar">
            <div class="progress-bar">
                <div class="progress-fill hp-fill" style="width: ${(this.state.player.hp / this.state.player.stats.base.maxHp) * 100}%"></div>
            </div>
             HP: ${this.state.player.hp}/${this.state.player.maxHp}
        </div>
        <div class="player-status-child bar">
            <div class="progress-bar">
                <div class="progress-fill mana-fill" style="width: ${(this.state.player.mana / this.state.player.stats.base.maxMana) * 100}%"></div>
            </div>
            Mana: ${this.state.player.mana}/${this.state.player.maxMana}
        </div>
        <div class="player-status-child bar">
            <div class="progress-bar">
                <div class="progress-fill xp-fill" style="width: ${(this.state.player.xp / this.state.player.nextLevelXp) * 100}%"></div>
            </div>
             XP: ${this.state.player.xp}/${this.state.player.nextLevelXp}
        </div>
        <div class="player-status-child">Torches: ${this.state.player.torches}</div>`;
    }

    getOverlayDiv(divToCheck) {

        // This method handles getting HTML element references and hadnling failures for the #tabs Overlay Child Divs

        const divToReturn = document.getElementById(divToCheck);

        // if Overlay Div is not found, or Tabs Overlay is not open, log it and return false
        if (!divToReturn) { console.error(`div #${divToCheck} not found`); return false; }

        else if (!this.state.ui.overlayOpen) {console.log(`Overlay not open, Skipping #${divToCheck} Resfresh...`); return false; }

        // if Overlay Div is found, return it
        else if (divToReturn) { return divToReturn; }
        // if none of the above, log error and return false
        else { console.log("Error in getOverlayDiv"); return false; }

    }

    updateLog() {
        const logTextDiv = this.getOverlayDiv('log');
        if (!logTextDiv) return;
            logTextDiv.innerHTML = `${this.state.ui.logEntries.length
                ? this.state.ui.logEntries.slice(0, this.state.ui.maxLogEntries).map(line => `<p>${line}</p>`).join('')
                : '<p>Nothing to log yet.</p>'}`;
    }

    overlayTabButtons() {
        const tabMenuDiv = this.getOverlayDiv('tab-menu');
        if (!tabMenuDiv) return;

        tabMenuDiv.innerHTML =
            `<button id="character-tab" class="tabs-button" style="background: ${this.state.ui.activeTab === 'character' ? '#0f0' : '#000'}; color: ${this.state.ui.activeTab === 'character' ? '#000' : '#0f0'};">Character</button>
            <button id="log-tab" class="tabs-button" style="background: ${this.state.ui.activeTab === 'log' ? '#0f0' : '#000'}; color: ${this.state.ui.activeTab === 'log' ? '#000' : '#0f0'};">Log</button> 
            <button id="close-tabs">X</button>`;

        const logTab = document.getElementById('log-tab');
        const characterTab = document.getElementById('character-tab');
        const closeTabsButton = document.getElementById('close-tabs');

        if (logTab && characterTab) {
            logTab.addEventListener('click', () => {
                console.log("Switching to Log tab");
                this.state.ui.activeTab = 'log';
                this.renderOverlay();
            });
            characterTab.addEventListener('click', () => {
                console.log("Switching to Character tab");
                this.state.ui.activeTab = 'character';
                this.renderOverlay();
            });
        }
        if (closeTabsButton) {
            closeTabsButton.addEventListener('click', () => {
                this.state.ui.overlayOpen = false;
                document.getElementById('tabs').classList.add('hidden');
                this.renderOverlay();
                console.log("Overlay closed via close button");
            });
        }
    }

    updateInventory(equipped = false) {
        if (!this.state.ui.overlayOpen && !equipped) return ''; // Only update equipped items if overlay is open

        const inventory = document.getElementById('inventory');

        const equippedItems = document.getElementById('equipped-items');

        const equip = this.state.player.inventory.equipped;

        console.log(`updateInventory - equipped: ${equipped}, equippedItems:`, equippedItems, "inventory:", inventory, "items:", this.state.player.inventory.items);

        if (equipped && equippedItems) {
            equippedItems.innerHTML = `
            <div class="col">
                <div class="equipped-item">
                    <p class="equip-slot mainhand">
                        <img src="img/icons/items/${equip.mainhand?.icon || 'no-mainhand.svg'}" alt="${equip.mainhand?.name || 'Mainhand'}" 
                             class="item item-icon ${equip.mainhand?.itemTier || 'Empty'} ${equip.mainhand?.type || 'weapon'}" 
                             data-item='${JSON.stringify(equip.mainhand || { name: "Mainhand", itemTier: "Empty", type: "weapon", slots: ["mainhand"], baseDamageMin: 1, baseDamageMax: 1, uniqueId: this.state.utilities.generateUniqueId(), icon: "no-mainhand.svg" })}'>
                        <br><span class="item-label">Mainhand</span></p>
                </div>
                <div class="equipped-item">
                    <p class="equip-slot rightring">
                        <img src="img/icons/items/${equip.rightring?.icon || 'no-rightring.svg'}" alt="${equip.rightring?.name || 'Right Ring'}" 
                             class="item item-icon ${equip.rightring?.itemTier || 'Empty'} ${equip.rightring?.type || 'ring'}" 
                             data-item='${JSON.stringify(equip.rightring || { name: "Right Ring", itemTier: "Empty", type: "ring", slot: "rightring", uniqueId: this.state.utilities.generateUniqueId(), icon: "no-rightring.svg" })}'>
                        <br><span class="item-label">Right Ring </span></p>
                </div>
            </div>
            <div class="col">
                <div class="equipped-item">
                    <p class="equip-slot amulet"> 
                        <img src="img/icons/items/${equip.amulet?.icon || 'no-amulet.svg'}" alt="${equip.amulet?.name || 'Amulet'}" 
                             class="item item-icon ${equip.amulet?.itemTier || 'Empty'} ${equip.amulet?.type || 'amulet'}" 
                             data-item='${JSON.stringify(equip.amulet || { name: "Amulet", itemTier: "Empty", type: "amulet", slot: "amulet", uniqueId: this.state.utilities.generateUniqueId(), icon: "no-amulet.svg" })}'>
                        <br><span class="item-label">Amulet</span></p>
                </div>
                <div class="equipped-item">
                    <p class="equip-slot armor">
                        <img src="img/icons/items/${equip.armor?.icon || 'no-armor.svg'}" alt="${equip.armor?.name || 'Armor'}" 
                             class="item item-icon ${equip.armor?.itemTier || 'Empty'} ${equip.armor?.type || 'armor'}" 
                             data-item='${JSON.stringify(equip.armor || { name: "Armor", itemTier: "Empty", type: "armor", slot: "armor", uniqueId: this.state.utilities.generateUniqueId(), armor: 0, icon: "no-armor.svg" })}'>
                        <br><span class="item-label">Armor</span> </p>
                </div>
            </div>
            <div class="col">
                <div class="equipped-item">
                    <p class="equip-slot offhand">
                        <img src="img/icons/items/${equip.offhand?.icon || 'no-offhand.svg'}" alt="${equip.offhand?.name || 'Offhand'}" 
                             class="item item-icon ${equip.offhand?.itemTier || 'Empty'} ${equip.offhand?.type || 'weapon'}" 
                             data-item='${JSON.stringify(equip.offhand || { name: "Offhand", itemTier: "Empty", type: "weapon", slots: ["offhand"], baseDamageMin: 0, baseDamageMax: 0, uniqueId: this.state.utilities.generateUniqueId(), icon: "no-offhand.svg" })}'>
                        <br><span class="item-label">Offhand</span></p>
                </div>
                <div class="equipped-item">
                    <p class="equip-slot leftring">
                        <img src="img/icons/items/${equip.leftring?.icon || 'no-leftring.svg'}" alt="${equip.leftring?.name || 'Left Ring'}" 
                             class="item item-icon ${equip.leftring?.itemTier || 'Empty'} ${equip.leftring?.type || 'ring'}" 
                             data-item='${JSON.stringify(equip.leftring || { name: "Left Ring", itemTier: "Empty", type: "ring", slot: "leftring", uniqueId: this.state.utilities.generateUniqueId(), icon: "no-leftring.svg" })}'>
                        <br><span class="item-label">Left Ring</span> </p>
                </div>
            </div>`;

            this.addItemListeners();
        }

        if (inventory) {
            inventory.innerHTML = `
            <h2>Inventory Items</h2>
            <div class="inventory-item-wrapper">
            ${this.state.player.inventory.items?.length ? this.state.player.inventory.items.map((item, index) => `
                <div class="inventory-item">
                    <p class="inventory-slot ${item.itemTier} ${item.type}">
                        <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}' data-index='${index}'>
                        <span class="item-label ${item.itemTier}">${item.type}</span>
                    </p>
                </div>
            `).join('') + `</div>` : '<p>Inventory empty.</p>'}`;
            this.addItemListeners();
        }

        return '';
    }

    updateStats() {
        const statsDiv = this.getOverlayDiv('character-stat-wrapper');
        if (!statsDiv) return;

        statsDiv.innerHTML = `<div>Level: ${this.state.player.level}</div>
            <div>XP: ${this.state.player.xp}/${this.state.player.nextLevelXp}</div>
            <div>HP: ${this.state.player.hp}/${this.state.player.maxHp}</div>
            <div>Mana: ${this.state.player.mana}/${this.state.player.maxMana}</div>
            <div>Gold: ${this.state.player.gold}</div>
            <div>Torches: ${this.state.player.torches}</div>
            <div><hr></div><div><hr></div>
            <div>${this.state.player.intellect} : Intellect</div>
            <div>${this.state.player.prowess} : Prowess</div>
            <div>${this.state.player.agility} : Agility</div>
            <div>${this.state.player.defense} : Defense </div>
            <div>${this.state.player.damageBonus} : Damage Bonus</div>
            <div>${this.state.player.armor} : Armor</div>
            <div>${this.state.player.meleeDamageBonus} : Melee Dmg</div>
            <div>${this.state.player.block} : Block</div>
            <div>${this.state.player.rangedDamageBonus} : Ranged Dmg</div>
            <div>${this.state.player.range} : Range</div>`;
    }

    statRefreshUI() {
        
        this.updatePlayerInfo();
        this.updatePlayerStatus();

        if (!this.state.ui.overlayOpen) {return;}

        this.updateInventory(true); // Update equipped items
        this.updateStats(); // Update player stats
        this.updateInventory(); // Update inventory items
        this.updateLog(); // Update log text
    }
    
    renderOverlay() {

        const tabsDiv = document.getElementById('tabs');

        if (!this.state.ui.overlayOpen) {
            if (tabsDiv) {
                tabsDiv.style.display = 'none';
                tabsDiv.classList.add('hidden');
            }
            return;
        }

        if (tabsDiv) {
            tabsDiv.style.display = 'block';
            tabsDiv.classList.remove('hidden');
        }

        this.overlayTabButtons();

        document.getElementById('character-content').style.display = this.state.ui.activeTab === 'character' ? 'flex' : 'none';
        document.getElementById('log-content').style.display = this.state.ui.activeTab === 'log' ? 'block' : 'none';

        this.statRefreshUI();

        this.addItemListeners(); 
    }

    showItemTooltip(itemData, event) {
        if (!itemData || !itemData.uniqueId) {
            console.log("No item data or uniqueId for tooltip", itemData);
            return;
        }

        let tooltip = this.tooltipCache.get(itemData.uniqueId);
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = `item-tooltip-${itemData.uniqueId}`;
            tooltip.className = `item-tooltip-class ${itemData.itemTier}`;
            tooltip.style.position = 'absolute';
            tooltip.style.whiteSpace = 'pre-wrap';

            const content = document.createElement('div');

            const name = document.createElement('div');
            name.className = 'item-tooltip-name';
            name.textContent = itemData.name;
            content.appendChild(name);

            const typeTier = document.createElement('div');
            typeTier.className = 'item-tooltip-type-tier';
            typeTier.textContent = `${itemData.itemTier} ${itemData.type}`;
            content.appendChild(typeTier);

            if (itemData.type === "weapon") {
                const damage = document.createElement('div');
                damage.className = 'item-tooltip-damage';
                damage.textContent = `Damage: ${itemData.baseDamageMin}–${itemData.baseDamageMax}`;
                content.appendChild(damage);
                switch (itemData.attackType) {
                    case "melee":
                        const baseBlock = document.createElement('div');
                        baseBlock.className = 'item-tooltip-base-block';
                        baseBlock.textContent = `Block: ${itemData.baseBlock}`;
                        content.appendChild(baseBlock);
                        break;
                    case "ranged":
                        const baseRange = document.createElement('div');
                        baseRange.className = 'item-tooltip-base-range';
                        baseRange.textContent = `Range: ${itemData.baseRange}`;
                        content.appendChild(baseRange);
                        break;
                }
            } else if (itemData.type === "armor") {
                const armor = document.createElement('div');
                armor.className = 'item-tooltip-armor';
                armor.textContent = `Armor: ${itemData.armor}`;
                content.appendChild(armor);
            }

            if ('stats' in itemData && itemData.stats) {
                const divider = document.createElement('hr');
                divider.className = 'tooltip-divider';
                content.appendChild(divider);

                const propCount = Object.keys(itemData.stats).length;
                if (propCount > 0) {
                    const statsContainer = document.createElement('div');
                    statsContainer.className = 'tooltip-stats';
                    Object.entries(itemData.stats).forEach(([stat, value]) => {
                        if (true) { // Temporarily show luck stats for testing
                            const statLine = document.createElement('div');
                            statLine.className = 'tooltip-stat';
                            statLine.textContent = `${value > 0 ? '+' : ''}${value} : ${this.state.utilities.camelToTitleCase(stat)}`;
                            statsContainer.appendChild(statLine);
                        }
                    });
                    content.appendChild(statsContainer);
                }
            }

            const descriptionDivider = document.createElement('hr');
            descriptionDivider.className = 'tooltip-divider';
            content.appendChild(descriptionDivider);

            const description = document.createElement('div');
            description.className = 'tooltip-description';
            description.textContent = `${itemData.description}`;
            content.appendChild(description);

            tooltip.appendChild(content);
            document.body.appendChild(tooltip);
            this.tooltipCache.set(itemData.uniqueId, tooltip);
            console.log(`Created tooltip for ${itemData.name} with ID ${itemData.uniqueId}`);
        }

        tooltip.style.display = 'block';
        setTimeout(() => {
            const x = event.pageX - tooltip.offsetWidth - 15;
            const y = event.pageY - tooltip.offsetHeight + (tooltip.offsetHeight / 2);
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;

            tooltip.style.left = `${Math.max(10, Math.min(x, viewportWidth - tooltipWidth - 10))}px`;
            tooltip.style.top = `${Math.max(10, Math.min(y, viewportHeight - tooltipHeight - 10))}px`;
            console.log(`Positioned tooltip for ${itemData.name} at (${tooltip.style.left}, ${tooltip.style.top})`);
        }, 0);
    }

    hideItemTooltip(itemData) {
        if (!itemData || !itemData.uniqueId) {
            console.log("No item data or uniqueId for tooltip hide", itemData);
            return;
        }
        const tooltip = this.tooltipCache.get(itemData.uniqueId);
        if (tooltip) {
            tooltip.style.display = 'none';
            console.log(`Hid tooltip for ${itemData.name} with ID ${itemData.uniqueId}`);
        }
    }

    handleDragStart(event, itemData) {
        console.log(`Dragging started for ${itemData.name} (ID: ${itemData.uniqueId})`);
        event.dataTransfer.setData('text/plain', JSON.stringify(itemData));
        event.target.style.opacity = '0.5';
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    handleDrop(event, targetItemData, isTargetEquipped) {
        const playerService = this.state.game.getService('player');
        event.preventDefault();
        const draggedItemDataStr = event.dataTransfer.getData('text/plain');
        if (!draggedItemDataStr) {
            console.error("No dragged item data found in dataTransfer");
            return;
        }

        let draggedItemData;
        try {
            draggedItemData = JSON.parse(draggedItemDataStr);
            if (!draggedItemData || !draggedItemData.uniqueId) {
                throw new Error("Invalid dragged item data");
            }
            console.log(`Dragged Item and unique ID verified for item: ${draggedItemData.name} | Drop to: ${targetItemData.name}`);
        } catch (e) {
            console.error("Error parsing dragged item data:", e);
            return;
        }
        console.log('Calling playerService.playerInventory.handleDrop( draggedItemData, targetItemData,  isTargetEquipped)', draggedItemData, targetItemData, isTargetEquipped );

        playerService.playerInventory.handleDrop(draggedItemData, targetItemData, isTargetEquipped);

        this.statRefreshUI()
    }

    handleDragEnd(event) {
        event.target.style.opacity = '1';
    }

    addItemListeners() {
        const playerService = this.state.game.getService('player');
        console.log("Adding item listeners...");

        const equipItems = document.querySelectorAll('#equipped-items .item:not([data-listener-added])');
        console.log(`Found ${equipItems.length} new equipped items`, equipItems);
        equipItems.forEach(p => {
            const itemDataStr = p.dataset.item;
            if (itemDataStr) {
                try {
                    const decodedItemDataStr = decodeURIComponent(itemDataStr);
                    const itemData = JSON.parse(decodedItemDataStr);
                    if (itemData && itemData.uniqueId) {
                        p.draggable = true;
                        p.addEventListener('dragstart', (event) => this.handleDragStart(event, itemData));
                        p.addEventListener('dragover', (event) => this.handleDragOver(event));
                        p.addEventListener('drop', (event) => this.handleDrop(event, itemData, true));
                        p.addEventListener('dragend', (event) => this.handleDragEnd(event));
                        p.addEventListener('mouseover', (event) => this.showItemTooltip(itemData, event));
                        p.addEventListener('mouseout', () => this.hideItemTooltip(itemData));
                        p.addEventListener('click', () => playerService.playerInventory.unequipItem(itemData));
                        p.setAttribute('data-listener-added', 'true');
                    } else {
                        console.warn("Missing uniqueId in equipped item", itemData);
                    }
                } catch (e) {
                    console.error("Failed to parse item data:", e, itemDataStr);
                }
            } else {
                console.warn("No data-item attribute on equipped item", p);
            }
        });

        const inventoryItems = document.querySelectorAll('.inventory-item-wrapper .item:not([data-listener-added])');
        console.log(`Found ${inventoryItems.length} new inventory items`);
        inventoryItems.forEach(p => {
            const itemDataStr = p.dataset.item;
            if (itemDataStr) {
                try {
                    const decodedItemDataStr = decodeURIComponent(itemDataStr);
                    const itemData = JSON.parse(decodedItemDataStr);
                    console.log(`Parsed item data for ${itemData.itemTier} ${itemData.name} : ID ${itemData.uniqueId} : `, itemData);
                    if (itemData && itemData.uniqueId) {
                        p.draggable = true;
                        p.addEventListener('dragstart', (event) => this.handleDragStart(event, itemData));
                        p.addEventListener('dragover', (event) => this.handleDragOver(event));
                        p.addEventListener('drop', (event) => this.handleDrop(event, itemData, false));
                        p.addEventListener('dragend', (event) => this.handleDragEnd(event));
                        p.addEventListener('mouseover', (event) => this.showItemTooltip(itemData, event));
                        p.addEventListener('mouseout', () => this.hideItemTooltip(itemData));
                        p.addEventListener('click', (event) => this.handleInventoryItemClick(itemData, event));
                        p.setAttribute('data-listener-added', 'true');
                    } else {
                        console.warn("Missing uniqueId in inventory item", itemData);
                    }
                } catch (e) {
                    console.error("Failed to parse item data:", e, itemDataStr);
                }
            } else {
                console.warn("No data-item attribute on inventory item", p);
            }
        });
    }

    handleInventoryItemClick(item, event) {
        const playerService = this.state.game.getService('player');
        console.log("Handling item click", item, event);
        if (item.itemTier === "Empty") {
            console.log("Empty item, skipping");
            return;
        }
        if (event.ctrlKey) {
            console.log("Ctrl key pressed, dropping item", item, "Event:", event);
            playerService.playerInventory.dropItem(event.target.dataset.index);
        } else if (event.shiftKey) {
            console.log("Shift key pressed, no action taken");
            return;
        } else {
            console.log("equipping item", item);
            playerService.playerInventory.equipItem(item);
        }
        this.statRefreshUI();
    }

    writeToLog(message) {
        this.state.ui.logEntries.unshift(message);
        if (this.state.ui.logEntries.length > this.state.ui.maxLogEntries) {
            this.state.ui.logEntries.pop();
        }
        if (this.state.ui.overlayOpen) {
            this.updateLog();
        }
    }

    logDroppedItems(monster, goldGain, torchDropped, droppedItems) {
        let logMessage = `${monster.name} dropped ${goldGain} gold`;
        if (torchDropped) logMessage += ' and a torch';
        if (droppedItems.length) logMessage += ` and ${droppedItems.map(i => i.name).join(', ')}`;
        this.writeToLog(logMessage + '!');
    }

    gameOver(message) {
        console.log("gameOver called with message:", message);
        const existingGameOver = document.getElementById('game-over');
        if (existingGameOver) existingGameOver.remove();

        const gameOver = document.createElement('div');
        gameOver.id = 'game-over';
        const headline = this.state.isVictory ? '<h1>VICTORY!</h1>' : '<h1>GAME OVER</h1>';
        gameOver.innerHTML = headline + '<p>' + message + '</p>';
        document.getElementById('map').appendChild(gameOver);

        const mapElement = document.getElementById('map');
        const mapWidth = mapElement.clientWidth;
        const mapHeight = mapElement.clientHeight;
        const scrollLeft = mapElement.scrollLeft;
        const scrollTop = mapElement.scrollTop;
        const centerX = scrollLeft + (mapWidth / 2);
        const centerY = scrollTop + (mapHeight / 2);

        gameOver.style.left = `${centerX - (gameOver.offsetWidth / 2)}px`;
        gameOver.style.top = `${centerY - (gameOver.offsetHeight / 2)}px`;

        gameOver.classList.add(this.state.isVictory ? 'victory' : 'death');

        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.textContent = 'Play Again?';
        restartButton.onclick = () => {
            console.log('Restart Clicked');
            location.reload(true);
        };
        gameOver.appendChild(restartButton);
    }
}