// @flow

import m from "mithril"
import {CounterBadge} from "../../gui/base/CounterBadge"
import {getNavButtonIconBackground, theme} from "../../gui/theme"
import {lang} from "../../misc/LanguageViewModel"
import {ButtonColors, ButtonN, ButtonType} from "../../gui/base/ButtonN"
import type {MinimizedEditor, MinimizedMailEditorViewModel} from "../model/MinimizedMailEditorViewModel"
import {px} from "../../gui/size"
import {Icons} from "../../gui/base/icons/Icons"
import {styles} from "../../gui/styles"
import type {EntityEventsListener, EntityUpdateData, EventController} from "../../api/main/EventController"
import {isUpdateForTypeRef} from "../../api/main/EventController"
import {noOp} from "../../api/common/utils/Utils"
import {promptAndDeleteMails} from "./MailGuiUtils"
import {MailTypeRef} from "../../api/entities/tutanota/Mail"
import {OperationType} from "../../api/common/TutanotaConstants"
import {isSameId} from "../../api/common/utils/EntityUtils"

const COUNTER_POS_OFFSET = px(-8)

export type MinimizedEditorOverlayAttrs = {
	viewModel: MinimizedMailEditorViewModel,
	minimizedEditor: MinimizedEditor,
	eventController: EventController
}

export class MinimizedEditorOverlay implements MComponent<MinimizedEditorOverlayAttrs> {

	_listener: EntityEventsListener
	_eventController: EventController

	constructor(vnode: Vnode<MinimizedEditorOverlayAttrs>) {
		const {minimizedEditor, viewModel, eventController} = vnode.attrs
		this._eventController = eventController
		this._listener = (updates: $ReadOnlyArray<EntityUpdateData>, eventOwnerGroupId: Id): Promise<*> => {
			return Promise.each(updates, update => {
				if (isUpdateForTypeRef(MailTypeRef, update) && update.operation === OperationType.DELETE) {
					console.log("!!overlay entity update for mail")
					let draft = minimizedEditor.sendMailModel.getDraft()
					if (draft && isSameId(draft._id, [update.instanceListId, update.instanceId])) {
						viewModel.removeMinimizedEditor(minimizedEditor)
					}
				}
			})
		}
		eventController.addEntityListener(this._listener)
	}

	onremove() {
		this._eventController.removeEntityListener(this._listener)
	}

	view(vnode: Vnode<MinimizedEditorOverlayAttrs>): Children {
		const {minimizedEditor, viewModel, eventController} = vnode.attrs
		const buttons = [
			{
				label: "edit_action",
				click: () => viewModel.reopenMinimizedEditor(minimizedEditor),
				type: ButtonType.ActionLarge,
				icon: () => Icons.Edit,
				colors: ButtonColors.DrawerNav,
				isVisible: () => !styles.isSingleColumnLayout()
			}, {
				label: "delete_action",
				click: () => {
					let model = minimizedEditor.sendMailModel
					// only delete if save has finished
					minimizedEditor.savePromise
					               .catch(noOp) // An error in the save operation is handled when triggering save on a mail
					               .finally(() => {
						               const draft = model._draft
						               if (draft) {
							               promptAndDeleteMails(model.mails(), [draft], () => viewModel.removeMinimizedEditor(minimizedEditor))
						               } else {
							               // If we don't have a draft, an error must have occurred when trying to save on minimize.
							               viewModel.removeMinimizedEditor(minimizedEditor)
						               }
					               })
				},
				type: ButtonType.ActionLarge,
				icon: () => Icons.Trash,
				colors: ButtonColors.DrawerNav,
			}, {
				label: "close_alt",
				click: () => viewModel.removeMinimizedEditor(minimizedEditor),
				type: ButtonType.ActionLarge,
				icon: () => Icons.Cancel,
				colors: ButtonColors.DrawerNav,
			}
		]


		const subject = minimizedEditor.sendMailModel.getSubject()
		return m(".elevated-bg.pl.border-radius", [
				m(CounterBadge, {
					count: viewModel.getMinimizedEditors().indexOf(minimizedEditor) + 1,
					position: {top: COUNTER_POS_OFFSET, right: COUNTER_POS_OFFSET},
					color: theme.navigation_button_icon,
					background: getNavButtonIconBackground()
				}),
				m(".flex.justify-between.pb-xs.pt-xs", [
					m(".flex.col.justify-center.min-width-0.flex-grow", {
						onclick: () => viewModel.reopenMinimizedEditor(minimizedEditor)
					}, [
						m(".b.text-ellipsis", subject ? subject : lang.get("newMail_action")),
						m(".small.text-ellipsis", getStatusMessage(minimizedEditor.savePromise))
					]),
					m(".flex.items-center.justify-right", buttons.map(b => b.isVisible && !b.isVisible() ? null : m(ButtonN, b))),
				])
			],
		)
	}
}


function getStatusMessage(savePromise: Promise<void>): string {
	if (savePromise.isPending()) {
		return lang.get("save_msg")
	} else if (savePromise.isRejected()) {
		return lang.get("draftNotSaved_msg")
	} else {
		return lang.get("draftSaved_msg")
	}
}