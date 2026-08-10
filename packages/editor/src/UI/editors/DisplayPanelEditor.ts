import { Entity } from '../../core/Entity'
import { styles } from '../style'
import { TextInput } from '../controls/TextInput'
import { Checkbox } from '../controls/Checkbox'
import { Editor } from './Editor'
import { DisplayPanelIcon } from './components/DisplayPanelIcon'
import G from '../../common/globals'

/** Display Panel Editor */
export class DisplayPanelEditor extends Editor {
    public constructor(entity: Entity) {
        super(320, 214, entity)

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

        this.addLabel(140, 110, 'Text:')
        const textInput = new TextInput(G.app.renderer, 150, entity.displayPanelText || '', 100)
        textInput.position.set(140, 129)
        this.addChild(textInput)

        textInput.on('changed', () => {
            this.m_Entity.displayPanelText = textInput.text || undefined
        })

        this.onEntityChange('displayPanelText', text => {
            textInput.text = text || ''
        })

        const alwaysShow = new Checkbox(
            entity.displayPanelAlwaysShow,
            'Always show text above entity'
        )
        alwaysShow.position.set(140, 160)
        this.addChild(alwaysShow)

        alwaysShow.on('changed', () => {
            this.m_Entity.displayPanelAlwaysShow = alwaysShow.checked
        })

        this.onEntityChange('displayPanelAlwaysShow', alwaysShowValue => {
            alwaysShow.checked = alwaysShowValue
        })
    }
}
