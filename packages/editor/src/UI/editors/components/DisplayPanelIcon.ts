import { FederatedPointerEvent } from 'pixi.js'
import EventEmitter from 'eventemitter3'
import G from '../../../common/globals'
import FD from '../../../core/factorioData'
import { Entity, EntityEvents } from '../../../core/Entity'
import { ISignal, SignalType } from '../../../types'
import { Slot } from '../../controls/Slot'
import F from '../../controls/functions'

/** Names of all items/fluids/virtual signals that can be shown as an icon */
function getIconNames(): string[] {
    return FD.inventoryLayout.flatMap(group =>
        group.subgroups.flatMap(subgroup => subgroup.items.map(item => item.name))
    )
}

function getSignalType(name: string): SignalType {
    if (FD.fluids[name]) return 'fluid'
    if (FD.signals[name]) return 'virtual'
    return undefined
}

/** Icon Slot for Display Panel Entity */
export class DisplayPanelIcon extends Slot<undefined> {
    /** Blueprint Editor Entity reference */
    private readonly m_Entity: Entity

    public constructor(entity: Entity) {
        super()

        this.m_Entity = entity
        this.updateContent(this.m_Entity.displayPanelIcon)
        this.on('pointerdown', this.onSlotPointerDown, this)

        this.onEntityChange('displayPanelIcon', icon => this.updateContent(icon))
    }

    private onEntityChange<T extends EventEmitter.EventNames<EntityEvents>>(
        event: T,
        fn: EventEmitter.EventListener<EntityEvents, T>
    ): void {
        this.m_Entity.on(event, fn)
        this.once('destroyed', () => this.m_Entity.off(event, fn))
    }

    /** Update Content Icon */
    private updateContent(icon: ISignal): void {
        if (icon === undefined || icon.name === undefined) {
            if (this.content !== undefined) {
                this.content = undefined
            }
        } else {
            this.content = F.CreateIcon(icon.name)
        }
        this.emit('changed')
    }

    /** Event handler for click on slot */
    private onSlotPointerDown(e: FederatedPointerEvent): void {
        e.stopPropagation()
        if (e.button === 0) {
            G.UI.createInventory(
                'Select Icon',
                getIconNames(),
                name => {
                    this.m_Entity.displayPanelIcon = { name, type: getSignalType(name) }
                },
                false
            )
        } else if (e.button === 2) {
            this.m_Entity.displayPanelIcon = undefined
        }
    }
}
