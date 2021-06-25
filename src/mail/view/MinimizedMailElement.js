// @flow

import m from "mithril"
import {px, size} from "../../gui/size"
import {lang} from "../../misc/LanguageViewModel"
import {theme} from "../../gui/theme"
import {Icons} from "../../gui/base/icons/Icons"
import {Icon} from "../../gui/base/Icon"

export const MINIMIZED_WIDTH = 190
export const MINIMIZED_HEIGHT = 30
const BORDER_RADIUS = 10

export type MinimizedMailViewAttrs = {
	subject: string,
	close: () => void,
	remove: () => void
}

/**
 *  Singular minimized mail element to be rendered in the bar
 */
export class MinimizedMailElement implements MComponent<MinimizedMailViewAttrs> {
	_hovered: boolean

	constructor(vnode: Vnode<MinimizedMailViewAttrs>) {
		this._hovered = false
	}

	view(vnode: Vnode<MinimizedMailViewAttrs>): Children {
		return m(".flex.items-center.elevated-bg.plr.border-radius.mr-s.dropdown-shadow", {
			style: {
				width: px(MINIMIZED_WIDTH),
				height: px(MINIMIZED_HEIGHT),
				borderTopRightRadius: px(BORDER_RADIUS),
				borderTopLeftRadius: px(BORDER_RADIUS)
			},
		}, [
			m(".pt-s.text-ellipsis.click.content-hover.full-width", {
				onclick: () => {
					vnode.attrs.close()
				},
			}, vnode.attrs.subject !== "" // displays subject if possible
				? vnode.attrs.subject
				: lang.get("openDraft_label")),
			m(".click.content-hover", {
					onclick: () => {
						vnode.attrs.remove()
					},
					onmouseenter: () => this._hovered = true,
					onmouseleave: () => this._hovered = false,
					style: {
						height: px(size.icon_size_medium) // icon is 16x16px, if height > 16px the icon isn't centered, if height < 16px the scrollbar will appear. We don't want either
					}
				}, m(Icon, {
					icon: Icons.Cancel,
					style: {
						fill: !this._hovered ? theme.content_fg : theme.content_accent
					}
				})
			)
		])
	}
}