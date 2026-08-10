import { Entity } from '../../core/Entity'
import { Editor } from './Editor'
import { DisplayPanelIcon } from './components/DisplayPanelIcon'

/** Display Panel Editor */
export class DisplayPanelEditor extends Editor {
    public constructor(entity: Entity) {
        super(280, 171, entity)

        if (entity.generateConnector) {
            this.addLabel(140, 90, 'Not implemented')
            return
        }

        this.addLabel(140, 46, 'Icon:')
        const icon = new DisplayPanelIcon(entity)
        icon.position.set(140, 65)
        this.addChild(icon)
    }
}
