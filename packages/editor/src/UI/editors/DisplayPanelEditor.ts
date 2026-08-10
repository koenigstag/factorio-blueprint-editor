import { Entity } from '../../core/Entity'
import { styles } from '../style'
import { Editor } from './Editor'
import { DisplayPanelIcon } from './components/DisplayPanelIcon'

/** Display Panel Editor */
export class DisplayPanelEditor extends Editor {
    public constructor(entity: Entity) {
        super(320, 171, entity)

        if (entity.generateConnector) {
            const style = styles.dialog.label.clone()
            style.wordWrap = true
            style.wordWrapWidth = 160
            const label = this.addLabel(
                140,
                60,
                'Circuit network settings are not implemented yet',
                style
            )
            label.position.set(140, 102 - label.height / 2)
            return
        }

        this.addLabel(140, 46, 'Icon:')
        const icon = new DisplayPanelIcon(entity)
        icon.position.set(140, 65)
        this.addChild(icon)
    }
}
