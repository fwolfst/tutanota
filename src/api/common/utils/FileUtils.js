// @flow

import {union} from "./ArrayUtils"
import {toLowerCase} from "./StringUtils"

type StringPredicate = string => boolean
const _false: StringPredicate = () => false

/**
 * Get the file extension of a filename
 * so
 *  file.txt -> .txt
 *  archive.tar.gz -> .tar.gz
 * @param fileName
 */
export function getFileExtension(fileName: string): string {
	return (fileName.match(/\..+$/) || [""])[0]
}

/**
 * The inverse of getTrailingFileExtension
 * @param fileName
 */
export function getFileBaseName(fileName: string): string {
	const extension = getFileExtension(fileName)
	return fileName.substr(0, extension ? fileName.lastIndexOf(extension) : fileName.length)
}

export function unreserveFileName(fileName: string): string {

	if (fileName === "." || fileName === "..") {
		return `${fileName}_`
	}

	// CON, CON.txt, COM0 etc. (windows device files)
	const winReservedRe = /^(CON|PRN|LPT[0-9]|COM[0-9]|AUX|NUL)($|\..*$)/i

	const extension = getFileExtension(fileName)
	const baseName = getFileBaseName(fileName)
	return env.platformId === "win32" && winReservedRe.test(baseName)
		? `${baseName}_${extension}`
		: fileName
}

/**
 * removes invalid characters from the given filename
 * by replacing them with underscores (non-platform-specific)
 */
export function sanitizeFilename(filename: string): string {

	// / ? < > \ : * | "
	const illegalRe = /[\/\?<>\\:\*\|"]/g
	// unicode control codes
	const controlRe = /[\x00-\x1f\x80-\x9f]/g
	// trailing period in windows file names
	// this is valid in linux but can't be checked from the browser
	const windowsTrailingRe = /[\. ]+$/


	return unreserveFileName(filename)
		.replace(illegalRe, "_")
		.replace(controlRe, "_")
		.replace(windowsTrailingRe, "_")
}


/**
 * Uniqueify all the names in fileNames, case-insensitively
 * @param filenames
 * @param taken: file names that are taken but won't be included in the output
 * @returns {*[]}
 */
export function deduplicateFilenames(filenames: Array<string>, _taken: $ReadOnlySet<string> = new Set()): {[string]: Array<string>} {
	// make taken lowercase aswell for case insensitivity
	const taken = new Set(Array.from(_taken).map(toLowerCase))

	// Check first if we need to do a deduplication
	const deduplicatedNames = new Set(filenames.map(toLowerCase))
	if (deduplicatedNames.size === filenames.length && union(deduplicatedNames, taken).size === 0) {
		// if all file names are good then just return an identity map
		return filenames.reduce((map, name) => ({...map, name: [name]}), {}) // convert into map oldname -> [newname]
	}

	const suffix = (name, number) => {
		const basename = name.substring(0, name.indexOf('.')) || name
		// get the file extension or an empty string
		const ext = (name.match(/\..+$/) || [""])[0]
		return `${basename} (${number})${ext}`
	}

	// do the deduplication
	const out = {}
	const duplicateCounts = {}
	for (let name of filenames) {
		const lower = name.toLowerCase()
		let dedupName
		if (duplicateCounts[lower] === undefined) {
			duplicateCounts[lower] = 0
			dedupName = taken.has(lower)
				? suffix(name, ++duplicateCounts[lower])
				: name
		} else {
			dedupName = suffix(name, ++duplicateCounts[lower])
		}
		if (!out[name]) {
			out[name] = []
		}
		out[name].push(dedupName)
	}

	return out
}

/**
 * checks if the given filename is a reserved filename on the current platform
 * @param filename
 * @returns {boolean}
 * @private
 */
export function isReservedFilename(filename: string): boolean {
	// CON, CON.txt, COM0 etc. (windows device files)
	const winReservedRe = /^(CON|PRN|LPT[0-9]|COM[0-9]|AUX|NUL)($|\..*$)/i
	// .. and .
	const reservedRe = /^\.{1,2}$/

	return (env.platformId === "win32" && winReservedRe.test(filename)) || reservedRe.test(filename)
}

const MimeTypeToFileExtension = Object.freeze({
	"image/jpeg": ".jpg",
	"image/png": ".png",
	"image/gif": ".gif",
	"image/svg+xml": ".svg"
})

export type MimeType = $Keys<typeof MimeTypeToFileExtension>
export type FileExtension = $Values<typeof MimeTypeToFileExtension>

export function mimeTypeToFileExtension(mimeType: MimeType): FileExtension {
	return MimeTypeToFileExtension[mimeType]
}