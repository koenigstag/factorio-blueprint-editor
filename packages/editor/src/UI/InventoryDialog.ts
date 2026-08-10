import { Container, FederatedWheelEvent, Graphics, Rectangle, Text } from 'pixi.js'
import FD from '../core/factorioData'
import G from '../common/globals'
import F from './controls/functions'
import { Dialog } from './controls/Dialog'
import { Button } from './controls/Button'
import { colors, styles } from './style'

/*
    Cols
    Space   @ 0     +12              ->12
    Items   @ 12    +(10*(36+2))     ->392
    Space   @ 392   +12              ->404
    Width : 12 + (10 * (36 + 2)) + 12 = 404

    Rows
    Space   @ 0   +10                ->10
    Title   @ 10  +24                ->34
    Space   @ 34  +12                ->46
    Groups  @ 46  +68                ->114
    Space   @ 114 +12                ->126
    Items   @ 126 +(8*(36+2))        ->430
    Space   @ 430 +12                ->442
    Height : 10 + 24 + 12 + 68 + 12 + (8*(36+2)) + 12 = 442

    Space   @ 0   +10                ->10
    R.Label @ 10  +16                ->26
    Space   @ 26  +10                ->36
    R.Data  @ 36  +36                ->72
    Space   @ 8   +8                 ->78
    Height : 10 + 16 + 10 + 36 + 8 = 78
*/

type InventoryItems = Container<Button<Container>>

/** Number of item rows visible at once; taller groups scroll within this viewport */
const VIEWPORT_ROWS = 8
const ROW_SIZE = 38
const VIEWPORT_HEIGHT = VIEWPORT_ROWS * ROW_SIZE
const VIEWPORT_WIDTH = 10 * ROW_SIZE - 2
const SCROLLBAR_WIDTH = 4
const SCROLLBAR_MIN_THUMB_HEIGHT = 20

/** Inventory Dialog - Displayed to the user if there is a need to select an item */
export class InventoryDialog extends Dialog {
    /** Container for Inventory Group Buttons */
    private readonly m_InventoryGroups: Container<Button<InventoryItems>>

    /** Container for Inventory Group Items */
    private readonly m_InventoryItems: Container<InventoryItems>

    /** Number of item rows contained in each group, used to clamp scrolling */
    private readonly m_GroupRows = new Map<InventoryItems, number>()

    /** Track (background) for the item grid scrollbar */
    private readonly m_ScrollTrack: Graphics

    /** Thumb (draggable handle) for the item grid scrollbar */
    private readonly m_ScrollThumb: Graphics

    /** Horizontal position of the scrollbar, anchored to the dialog's actual right border */
    private readonly m_ScrollBarX: number

    /** Text for Recipe Tooltip */
    private readonly m_RecipeLabel: Text

    /** Container for Recipe Tooltip */
    private readonly m_RecipeContainer: Container

    /** Hovered item for item pointerout check */
    private m_hoveredItem: string

    /** Number of item-group tabs the fixed-width layout was designed for */
    private static readonly BASE_WIDTH = 404

    /** Determine whether an item qualifies for a group tab, mirroring the item-population loop below */
    private static itemQualifies(itemName: string, itemsFilter?: string[]): boolean {
        if (itemsFilter === undefined) {
            const itemData = FD.items[itemName]
            if (!itemData) return false
            if (!itemData.place_result && !itemData.place_as_tile) return false
            if (itemData.place_result && !FD.entities[itemData.place_result]) return false
            return true
        }
        return itemsFilter.includes(itemName)
    }

    /** Widen the dialog if more group tabs need to fit than the base layout was designed for */
    private static computeWidth(itemsFilter?: string[]): number {
        let groupCount = 0
        for (const group of FD.inventoryLayout) {
            if (group.name === 'creative' && itemsFilter !== undefined) continue
            const hasItems = group.subgroups.some(subgroup =>
                subgroup.items.some(item => InventoryDialog.itemQualifies(item.name, itemsFilter))
            )
            if (hasItems) groupCount += 1
        }
        return Math.max(InventoryDialog.BASE_WIDTH, groupCount * 70 + 22)
    }

    /** Fixed dialog height: the item grid never grows, taller groups scroll instead */
    private static computeHeight(showRecipePanel = true): number {
        return 138 + VIEWPORT_HEIGHT + (showRecipePanel ? 78 : 0)
    }

    public constructor(
        title = 'Inventory',
        itemsFilter?: string[],
        selectedCallBack?: (selectedItem: string) => void,
        showRecipePanel = true
    ) {
        super(
            InventoryDialog.computeWidth(itemsFilter),
            InventoryDialog.computeHeight(showRecipePanel),
            title
        )

        this.m_InventoryGroups = new Container()
        this.m_InventoryGroups.position.set(12, 46)
        this.addChild(this.m_InventoryGroups)

        this.m_InventoryItems = new Container()
        this.m_InventoryItems.position.set(12, 126)
        this.m_InventoryItems.eventMode = 'static'
        this.m_InventoryItems.hitArea = new Rectangle(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
        this.addChild(this.m_InventoryItems)

        const itemsMask = new Graphics().rect(12, 126, VIEWPORT_WIDTH, VIEWPORT_HEIGHT).fill(0xffffff)
        this.addChild(itemsMask)
        this.m_InventoryItems.mask = itemsMask

        this.m_ScrollBarX = this.width - 12 - SCROLLBAR_WIDTH

        this.m_ScrollTrack = new Graphics()
        this.m_ScrollTrack
            .rect(this.m_ScrollBarX, 126, SCROLLBAR_WIDTH, VIEWPORT_HEIGHT)
            .fill({ color: 0x000000, alpha: 0.3 })
        this.m_ScrollTrack.visible = false
        this.addChild(this.m_ScrollTrack)

        this.m_ScrollThumb = new Graphics()
        this.m_ScrollThumb.visible = false
        this.addChild(this.m_ScrollThumb)

        this.m_InventoryItems.addEventListener(
            'wheel',
            (e: FederatedWheelEvent) => {
                e.preventDefault()
                e.stopPropagation()
                const activeGroup = this.m_InventoryItems.children.find(c => c.visible)
                if (!activeGroup) return
                const contentHeight = (this.m_GroupRows.get(activeGroup) ?? 0) * ROW_SIZE
                const maxScroll = Math.max(0, contentHeight - VIEWPORT_HEIGHT)
                activeGroup.position.y = Math.min(
                    0,
                    Math.max(-maxScroll, activeGroup.position.y - e.deltaY)
                )
                this.updateScrollbar(activeGroup)
            },
            { passive: false }
        )

        let groupIndex = 0
        for (const group of FD.inventoryLayout) {
            // Make creative entities available only in the main inventory
            if (group.name === 'creative' && itemsFilter !== undefined) {
                continue
            }

            const inventoryGroupItems = new Container<Button<Container>>()
            let itemColIndex = 0
            let itemRowIndex = 0

            for (const subgroup of group.subgroups) {
                let subgroupHasItems = false

                for (const item of subgroup.items) {
                    if (itemsFilter === undefined) {
                        const itemData = FD.items[item.name]
                        if (!itemData) continue
                        if (!itemData.place_result && !itemData.place_as_tile) continue
                        // needed for robots/trains/cars
                        if (itemData.place_result && !FD.entities[itemData.place_result]) continue
                    } else {
                        if (!itemsFilter.includes(item.name)) continue
                    }

                    if (itemColIndex === 10) {
                        itemColIndex = 0
                        itemRowIndex += 1
                    }

                    const button = new Button<Container>(36, 36)
                    button.position.set(itemColIndex * 38, itemRowIndex * 38)
                    button.content = F.CreateIcon(item.name)
                    button.on('pointerdown', e => {
                        e.stopPropagation()
                        if (e.button === 0) {
                            selectedCallBack(item.name)
                            this.close()
                        }
                    })
                    button.on('pointerover', () => {
                        this.m_hoveredItem = item.name
                        this.updateRecipeVisualization(item.name)
                    })
                    button.on('pointerout', () => {
                        // we have to check this because pointerout can fire after pointerover
                        if (this.m_hoveredItem === item.name) {
                            this.m_hoveredItem = undefined
                            this.updateRecipeVisualization(undefined)
                        }
                    })

                    inventoryGroupItems.addChild(button)

                    itemColIndex += 1
                    subgroupHasItems = true
                    // }
                }

                if (subgroupHasItems) {
                    itemRowIndex += 1
                    itemColIndex = 0
                }
            }

            if (inventoryGroupItems.children.length > 0) {
                inventoryGroupItems.visible = groupIndex === 0
                this.m_GroupRows.set(inventoryGroupItems, itemRowIndex)
                this.m_InventoryItems.addChild(inventoryGroupItems)

                const button = new Button<Container<Button<Container>>>(68, 68, 3)
                button.active = groupIndex === 0
                button.position.set(groupIndex * 70, 0)
                button.content = F.CreateIcon(group.name, group.name === 'creative' ? 32 : 64)
                button.data = inventoryGroupItems
                button.on('pointerdown', e => {
                    e.stopPropagation()
                    if (e.button === 0) {
                        if (!button.active) {
                            for (const inventoryGroup of this.m_InventoryGroups.children) {
                                inventoryGroup.active = inventoryGroup === button
                            }
                        }
                        const buttonData = button.data
                        if (!buttonData.visible) {
                            for (const inventoryGroupItems of this.m_InventoryItems.children) {
                                const isActive = inventoryGroupItems === buttonData
                                inventoryGroupItems.visible = isActive
                                inventoryGroupItems.interactiveChildren = isActive
                                if (isActive) inventoryGroupItems.position.y = 0
                            }
                            this.updateScrollbar(buttonData)
                        }
                    }
                })

                this.m_InventoryGroups.addChild(button)

                groupIndex += 1
            }
        }

        const firstActiveGroup = this.m_InventoryItems.children.find(c => c.visible)
        if (firstActiveGroup) this.updateScrollbar(firstActiveGroup)

        this.m_RecipeLabel = new Text({ text: '', style: styles.dialog.label })
        this.m_RecipeContainer = new Container()

        if (showRecipePanel) {
            const recipePanel = new Container()
            recipePanel.position.set(0, InventoryDialog.computeHeight(false))
            this.addChild(recipePanel)

            const recipeBackground = F.DrawRectangle(
                this.width,
                78,
                colors.dialog.background.color,
                colors.dialog.background.alpha,
                colors.dialog.background.border
            )
            recipeBackground.position.set(0, 0)
            recipePanel.addChild(recipeBackground)

            this.m_RecipeLabel.position.set(12, 10)
            recipePanel.addChild(this.m_RecipeLabel)

            this.m_RecipeContainer.position.set(12, 36)
            recipePanel.addChild(this.m_RecipeContainer)
        }
    }

    /** Override automatically set position of dialog due to additional area for recipe */
    protected override setPosition(): void {
        this.position.set(
            G.app.screen.width / 2 - this.width / 2,
            G.app.screen.height / 2 - this.height / 2
        )
    }

    /** Redraw the scrollbar thumb/track to reflect the given group's scroll position, hiding it if the group fits within the viewport */
    private updateScrollbar(activeGroup: InventoryItems): void {
        const contentHeight = (this.m_GroupRows.get(activeGroup) ?? 0) * ROW_SIZE
        const maxScroll = Math.max(0, contentHeight - VIEWPORT_HEIGHT)

        if (maxScroll <= 0) {
            this.m_ScrollTrack.visible = false
            this.m_ScrollThumb.visible = false
            return
        }

        this.m_ScrollTrack.visible = true
        this.m_ScrollThumb.visible = true

        const thumbHeight = Math.max(
            SCROLLBAR_MIN_THUMB_HEIGHT,
            (VIEWPORT_HEIGHT / contentHeight) * VIEWPORT_HEIGHT
        )
        const scrollRatio = -activeGroup.position.y / maxScroll
        const thumbY = 126 + scrollRatio * (VIEWPORT_HEIGHT - thumbHeight)

        this.m_ScrollThumb.clear()
        this.m_ScrollThumb
            .rect(this.m_ScrollBarX, thumbY, SCROLLBAR_WIDTH, thumbHeight)
            .fill({ color: 0xffffff, alpha: 0.5 })
    }

    /** Update recipe visualization */
    private updateRecipeVisualization(recipeName?: string): void {
        // Update Recipe Label
        this.m_RecipeLabel.text = ''

        // Update Recipe Container
        this.m_RecipeContainer.removeChildren()

        if (recipeName === undefined) return

        const item = FD.items[recipeName]
        if (item && item.subgroup === 'creative') {
            this.m_RecipeLabel.text = `[CREATIVE] - ${item.localised_name}`
        }

        const recipe = FD.recipes[recipeName]
        if (recipe === undefined) return
        this.m_RecipeLabel.text = recipe.localised_name

        F.CreateRecipe(
            this.m_RecipeContainer,
            0,
            0,
            recipe.ingredients,
            recipe.results,
            recipe.energy_required
        )
    }
}
