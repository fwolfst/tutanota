// @flow
import type {WebContentsEvent} from "electron"
import {lang} from "../misc/LanguageViewModel"
import type {WindowManager} from "./DesktopWindowManager.js"
import {defer, objToError} from '../api/common/utils/Utils.js'
import type {DeferredObject} from "../api/common/utils/Utils"
import {downcast, neverNull, noOp} from "../api/common/utils/Utils"
import {errorToObj} from "../api/common/WorkerProtocol"
import type {DesktopConfig} from "./config/DesktopConfig"
import type {DesktopSseClient} from './sse/DesktopSseClient.js'
import type {DesktopNotifier} from "./DesktopNotifier"
import type {Socketeer} from "./Socketeer"
import type {DesktopAlarmStorage} from "./sse/DesktopAlarmStorage"
import type {DesktopCryptoFacade} from "./DesktopCryptoFacade"
import type {DesktopDownloadManager} from "./DesktopDownloadManager"
import {base64ToUint8Array} from "../api/common/utils/Encoding"
import type {ElectronUpdater} from "./ElectronUpdater"
import {log} from "./DesktopLog";
import type {DesktopUtils} from "./DesktopUtils"
import type {DesktopErrorHandler} from "./DesktopErrorHandler"
import type {DesktopIntegrator} from "./integration/DesktopIntegrator"
import {getExportDirectoryPath, makeMsgFile, writeFile} from "./DesktopFileExport"
import {fileExists} from "./PathUtils"
import path from "path"
import {DesktopAlarmScheduler} from "./sse/DesktopAlarmScheduler"

/**
 * node-side endpoint for communication between the renderer threads and the node thread
 */
export class IPC {
	_conf: DesktopConfig;
	_sse: DesktopSseClient;
	_wm: WindowManager;
	_notifier: DesktopNotifier;
	_sock: Socketeer;
	_alarmStorage: DesktopAlarmStorage;
	_alarmScheduler: DesktopAlarmScheduler
	_crypto: DesktopCryptoFacade;
	_dl: DesktopDownloadManager;
	_initialized: Array<DeferredObject<void>>;
	_requestId: number = 0;
	_queue: {[string]: Function};
	_updater: ?ElectronUpdater;
	_electron: $Exports<"electron">;
	_desktopUtils: DesktopUtils;
	_err: DesktopErrorHandler;
	_integrator: DesktopIntegrator;

	constructor(
		conf: DesktopConfig,
		notifier: DesktopNotifier,
		sse: DesktopSseClient,
		wm: WindowManager,
		sock: Socketeer,
		alarmStorage: DesktopAlarmStorage,
		desktopCryptoFacade: DesktopCryptoFacade,
		dl: DesktopDownloadManager,
		updater: ?ElectronUpdater,
		electron: $Exports<"electron">,
		desktopUtils: DesktopUtils,
		errorHandler: DesktopErrorHandler,
		integrator: DesktopIntegrator,
		alarmScheduler: DesktopAlarmScheduler
	) {
		this._conf = conf
		this._sse = sse
		this._wm = wm
		this._notifier = notifier
		this._sock = sock
		this._alarmStorage = alarmStorage
		this._crypto = desktopCryptoFacade
		this._dl = dl
		this._updater = updater
		this._electron = electron
		this._desktopUtils = desktopUtils
		this._err = errorHandler
		this._integrator = integrator
		this._alarmScheduler = alarmScheduler

		if (!!this._updater) {
			this._updater.setUpdateDownloadedListener(() => {
				this._wm.getAll().forEach(w => this.sendRequest(w.id, 'appUpdateDownloaded', []))
			})
		}

		this._initialized = []
		this._queue = {}
		this._err = errorHandler
		this._electron.ipcMain.handle('to-main', (ev: WebContentsEvent, request: any) => {
			const senderWindow = this._wm.getEventSender(ev)
			if (!senderWindow) return // no one is listening anymore
			const windowId = senderWindow.id
			if (request.type === "response") {
				this._queue[request.id](null, request.value);
			} else if (request.type === "requestError") {
				this._queue[request.id](objToError((request: any).error), null)
				delete this._queue[request.id]
			} else {
				this._invokeMethod(windowId, request.type, request.args)
				    .then(result => {
					    const response = {
						    id: request.id,
						    type: "response",
						    value: result,
					    }
					    const w = this._wm.get(windowId)
					    if (w) w.sendMessageToWebContents(response)
				    })
				    .catch((e) => {
					    const response = {
						    id: request.id,
						    type: "requestError",
						    error: errorToObj(e),
					    }
					    const w = this._wm.get(windowId)
					    if (w) w.sendMessageToWebContents(response)
				    })
			}
		})
	}

	async _invokeMethod(windowId: number, method: NativeRequestType, args: Array<Object>): any {
		switch (method) {
			case 'init':
				this._initialized[windowId].resolve()
				return Promise.resolve(process.platform)
			case 'findInPage':
				return this.initialized(windowId).then(() => {
					const w = this._wm.get(windowId)
					if (w) {
						// findInPage might reject if requests come too quickly
						// if it's rejecting for another reason we'll have logs
						return w.findInPage(downcast(args))
						        .catch(e => log.debug("findInPage reject:", e))
					} else {
						return {numberOfMatches: 0, currentMatch: 0}
					}
				})
			case 'stopFindInPage':
				return this.initialized(windowId).then(() => {
					const w = this._wm.get(windowId)
					if (w) {
						w.stopFindInPage()
					}
				}).catch(noOp)
			case 'setSearchOverlayState': {
				const w = this._wm.get(windowId)
				if (w) {
					const state: boolean = downcast(args[0])
					const force: boolean = downcast(args[1])
					w.setSearchOverlayState(state, force)
				}
				return Promise.resolve()
			}
			case 'registerMailto':
				return this._desktopUtils.registerAsMailtoHandler(true)
			case 'unregisterMailto':
				return this._desktopUtils.unregisterAsMailtoHandler(true)
			case 'integrateDesktop':
				return this._integrator.integrate()
			case 'unIntegrateDesktop':
				return this._integrator.unintegrate()
			case 'getConfigValue':
				return this._conf.getVar(args[0])
			case 'getSpellcheckLanguages': {
				const ses = this._electron.session.defaultSession
				return Promise.resolve(ses.availableSpellCheckerLanguages)
			}
			case 'getIntegrationInfo':
				const [isMailtoHandler, isAutoLaunchEnabled, isIntegrated, isUpdateAvailable] = await Promise.all([
					this._desktopUtils.checkIsMailtoHandler(),
					this._integrator.isAutoLaunchEnabled(),
					this._integrator.isIntegrated(),
					Boolean(this._updater && this._updater.updateInfo),
				])
				return {isMailtoHandler, isAutoLaunchEnabled, isIntegrated, isUpdateAvailable}
			case 'openFileChooser':
				if (args[1]) { // open folder dialog
					return this._electron.dialog.showOpenDialog(null, {properties: ['openDirectory']}).then(({filePaths}) => filePaths)
				} else { // open file
					return Promise.resolve([])
				}
			case 'open':
				// itemPath, mimeType
				const itemPath = args[0].toString()
				return this._dl.open(itemPath)
			case 'download':
				// sourceUrl, filename, headers
				return this._dl.downloadNative(...args.slice(0, 3))
			case 'saveBlob':
				// args: [data.name, uint8ArrayToBase64(data.data)]
				const filename: string = downcast(args[0])
				const data: Uint8Array = base64ToUint8Array(downcast(args[1]))
				return this._dl.saveBlob(filename, data, neverNull(this._wm.get(windowId)))
			case "aesDecryptFile":
				// key, path
				return this._crypto.aesDecryptFile(...args.slice(0, 2))
			case 'setConfigValue':
				const [key, value] = args.slice(0, 2)
				return this._conf.setVar(key, value)
			case 'openNewWindow':
				this._wm.newWindow(true)
				return Promise.resolve()
			case 'enableAutoLaunch':
				return this._integrator.enableAutoLaunch().catch(e => {
					log.debug("could not enable auto launch:", e)
				})
			case 'disableAutoLaunch':
				return this._integrator.disableAutoLaunch().catch(e => {
					log.debug("could not disable auto launch:", e)
				})
			case 'getPushIdentifier':
				const uInfo = {
					userId: args[0].toString(),
					mailAddress: args[1].toString()
				}
				// we know there's a logged in window
				// first, send error report if there is one
				return this._err.sendErrorReport(windowId)
				           .then(async () => {
					           const w = this._wm.get(windowId)
					           if (!w) return
					           w.setUserInfo(uInfo)
					           if (!w.isHidden()) {
						           this._notifier.resolveGroupedNotification(uInfo.userId)
					           }
					           const sseInfo = await this._sse.getSseInfo()
					           return sseInfo && sseInfo.identifier
				           })
			case 'storePushIdentifierLocally':
				return Promise.all([
					this._sse.storePushIdentifier(
						args[0].toString(),
						args[1].toString(),
						args[2].toString()
					),
					this._alarmStorage.storePushIdentifierSessionKey(
						args[3].toString(),
						args[4].toString()
					)
				]).then(() => {})
			case 'initPushNotifications':
				// Nothing to do here because sse connection is opened when starting the native part.
				return Promise.resolve()
			case 'closePushNotifications':
				// only gets called in the app
				// the desktop client closes notifications on window focus
				return Promise.resolve()
			case 'sendSocketMessage':
				// for admin client integration
				this._sock.sendSocketMessage(args[0])
				return Promise.resolve()
			case 'getLog':
				return Promise.resolve(global.logger.getEntries())
			case 'changeLanguage':
				return lang.setLanguage(args[0])
			case 'manualUpdate':
				return !!this._updater
					? this._updater.manualUpdate()
					: Promise.resolve(false)
			case 'isUpdateAvailable':
				return !!this._updater
					? Promise.resolve(this._updater.updateInfo)
					: Promise.resolve(null)
			case 'mailToMsg': {
				const bundle = args[0]
				const fileName = args[1]
				return makeMsgFile(bundle, fileName)
			}
			case 'saveToExportDir': {
				const file: DataFile = args[0]
				const exportDir = await getExportDirectoryPath(this._dl)
				return writeFile(exportDir, file)
			}
			case 'startNativeDrag': {
				const filenames = args[0]
				await this._wm.startNativeDrag(filenames, windowId)
				return Promise.resolve()
			}
			case 'focusApplicationWindow': {
				const window = this._wm.get(windowId)
				window && window.focus()
				return Promise.resolve()
			}
			case 'checkFileExistsInExportDirectory': {
				const fileName = args[0]
				return fileExists(path.join(await getExportDirectoryPath(this._dl), fileName))
			}
			case 'clearFileData': {
				this._dl.deleteTutanotaTempDirectory()
				return Promise.resolve()
			}
			case 'scheduleAlarms': {
				const alarms = args[0]
				for (const alarm of alarms) {
					await this._alarmScheduler.handleAlarmNotification(alarm)
				}
				return
			}
			default:
				return Promise.reject(new Error(`Invalid Method invocation: ${method}`))
		}
	}

	sendRequest(windowId: number, type: JsRequestType, args: Array<any>): Promise<Object> {
		return this.initialized(windowId).then(() => {
			const requestId = this._createRequestId();
			const request = {
				id: requestId,
				type: type,
				args: args,
			}
			const w = this._wm.get(windowId)
			if (w) {
				w.sendMessageToWebContents(request)
			}
			return new Promise((resolve, reject) => {
				this._queue[requestId] = (err, result) => err ? reject(err) : resolve(result)
			})
		})
	}

	_createRequestId(): string {
		if (this._requestId >= Number.MAX_SAFE_INTEGER) {
			this._requestId = 0
		}
		return "desktop" + this._requestId++
	}

	initialized(windowId: number): Promise<void> {
		if (this._initialized[windowId]) {
			return this._initialized[windowId].promise
		} else {
			return Promise.reject(new Error("Tried to call ipc function on nonexistent window"))
		}
	}

	addWindow(id: number) {
		this._initialized[id] = defer()
	}

	removeWindow(id: number) {
		delete this._initialized[id]
	}
}
