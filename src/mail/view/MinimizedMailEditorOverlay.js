//@flow

import m from "mithril"
import {px, size} from "../../gui/size"
import {assertMainOrNode} from "../../api/common/Env"
import {ButtonColors, ButtonN, ButtonType} from "../../gui/base/ButtonN"
import {displayOverlay} from "../../gui/base/Overlay"
import {DefaultAnimationTime, transform} from "../../gui/animation/Animations"
import {lang} from "../../misc/LanguageViewModel"
import {locator} from "../../api/main/MainLocator"
import {promptAndDeleteMails} from "./MailGuiUtils"
import type {EntityUpdateData} from "../../api/main/EventController"
import {isUpdateForTypeRef} from "../../api/main/EventController"
import {MailTypeRef} from "../../api/entities/tutanota/Mail"
import {OperationType} from "../../api/common/TutanotaConstants"
import {isSameId} from "../../api/common/utils/EntityUtils"
import {styles} from "../../gui/styles"
import {LayerType} from "../../RootView"
import {Icons} from "../../gui/base/icons/Icons"
import {CounterBadge} from "../../gui/base/CounterBadge"
import {getNavButtonIconBackground, theme} from "../../gui/theme"
import {noOp} from "../../api/common/utils/Utils"
import type {Dialog} from "../../gui/base/Dialog"
import type {SendMailModel} from "../editor/SendMailModel"
import type {MinimizedEditor} from "../model/MinimizedMailEditorViewModel"
import {MinimizedMailEditorViewModel} from "../model/MinimizedMailEditorViewModel"

assertMainOrNode()

const MINIMIZED_OVERLAY_WIDTH_WIDE = 350;
const MINIMIZED_OVERLAY_WIDTH_SMALL = 220;
const MINIMIZED_EDITOR_HEIGHT = size.button_height + 2 * size.vpad_xs;
const COUNTER_POS_OFFSET = px(-8)

export function showMinimizedMailEditor(dialog: Dialog, sendMailModel: SendMailModel, dispose: () => void, savePromise: Promise<void>): void {
	const viewModel = locator.minimizedMailModel
	let closeOverlayFunction = () => Promise.resolve() // will be assigned with the actual close function when overlay is visible.
	const minimizedEditor = viewModel.minimizeMailEditor(dialog, sendMailModel, dispose, savePromise, () => closeOverlayFunction())
	// trigger update the status message after save is done.
	savePromise.finally(() => m.redraw())
	// only show overlay once editor is gone
	setTimeout(() => {
		closeOverlayFunction = showMinimizedEditorOverlay(viewModel, minimizedEditor)
	}, DefaultAnimationTime)
}


function showMinimizedEditorOverlay(viewModel: MinimizedMailEditorViewModel, minimizedEditor: MinimizedEditor): () => Promise<void> {
	const buttons = [
		{
			label: "edit_action",
			click: () => {
				viewModel.reopenMinimizedEditor(minimizedEditor)
			},
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
						               promptAndDeleteMails(model.mails(), [draft], () => {
							               viewModel.removeMinimizedEditor(minimizedEditor)
						               })
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
			click: () => {
				viewModel.removeMinimizedEditor(minimizedEditor)
			},
			type: ButtonType.ActionLarge,
			icon: () => Icons.Cancel,
			colors: ButtonColors.DrawerNav,
		}
	]

	const finalVerticalPosition = (styles.isUsingBottomNavigation() // use size.hpad values to keep bottom and right space even
		? (size.bottom_nav_bar + size.hpad)
		: size.hpad_medium)

	const removeDraftListener = (updates: $ReadOnlyArray<EntityUpdateData>, eventOwnerGroupId: Id): Promise<*> => {
		return Promise.each(updates, update => {
			if (isUpdateForTypeRef(MailTypeRef, update) && update.operation === OperationType.DELETE) {
				let draft = minimizedEditor.sendMailModel.getDraft()
				if (draft && isSameId(draft._id, [update.instanceListId, update.instanceId])) {
					viewModel.removeMinimizedEditor(minimizedEditor)
				}
			}
		})
	}

	return displayOverlay(() => getOverlayPosition(), {
			view: () => {
				const subject = minimizedEditor.sendMailModel.getSubject()
				return m(".elevated-bg.pl.border-radius", {
						oncreate: () => {
							locator.eventController.addEntityListener(removeDraftListener)
						},
						onremove: () => {
							locator.eventController.removeEntityListener(removeDraftListener)
						}
					}, [
						m(CounterBadge, {
							count: viewModel._minimizedEditors.indexOf(minimizedEditor) + 1,
							position: {top: COUNTER_POS_OFFSET, right: COUNTER_POS_OFFSET},
							color: theme.navigation_button_icon,
							background: getNavButtonIconBackground()
						}),
						m(".flex.justify-between.pb-xs.pt-xs", [
							m(".flex.col.justify-center.min-width-0.flex-grow", {
								onclick: () => {
									viewModel.reopenMinimizedEditor(minimizedEditor)
								}
							}, [
								m(".b.text-ellipsis", subject ? subject : lang.get("newMail_action")),
								m(".small.text-ellipsis", getStatusMessage(minimizedEditor.savePromise))
							]),
							m(".flex.items-center.justify-right", buttons.map(b => b.isVisible && !b.isVisible() ? null : m(ButtonN, b))),
						])
					],
				)
			}
		},
		(dom) => transform(transform.type.translateY, 0, -(MINIMIZED_EDITOR_HEIGHT + finalVerticalPosition)),
		(dom) => transform(transform.type.translateY, -(MINIMIZED_EDITOR_HEIGHT + finalVerticalPosition), 0),
		"minimized-shadow"
	)
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

function getOverlayPosition() {
	return {
		bottom: px(-MINIMIZED_EDITOR_HEIGHT),// position will change with translateY
		right: styles.isUsingBottomNavigation() ? px(size.hpad) : px(size.hpad_medium),
		width: px(styles.isSingleColumnLayout() ? MINIMIZED_OVERLAY_WIDTH_SMALL : MINIMIZED_OVERLAY_WIDTH_WIDE),
		zIndex: LayerType.LowPriorityOverlay
	}

}

