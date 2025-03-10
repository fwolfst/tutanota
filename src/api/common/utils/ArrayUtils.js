//@flow
//@bundleInto:common-min
import {downcast, identity, neverNull} from "./Utils"
import {getFromMap} from "./MapUtils"

export function concat(...arrays: Uint8Array[]): Uint8Array {
	let length = arrays.reduce((previous, current) => previous + current.length, 0)
	let result = new Uint8Array(length)
	let index = 0
	arrays.forEach(array => {
		result.set(array, index)
		index += array.length
	})
	return result
}

export function numberRange(min: number, max: number): Array<number> {
	return [...Array(max + 1).keys()].slice(min)
}

/**
 * Compares two arrays for equality based on ===.
 * @param {Array} a1 The first array.
 * @param {Array} a2 The second array.
 * @return {boolean} True if the arrays are equal, false otherwise.
 *
 * It is valid to compare Uint8Array to Array<T>, don't restrict it to be one type
 */
export function arrayEquals<T, A: Uint8Array | Array<T>>(a1: A, a2: A): boolean {
	if (a1.length === a2.length) {
		for (let i = 0; i < a1.length; i++) {
			if (a1[i] !== a2[i]) {
				return false;
			}
		}
		return true;
	}
	return false;
}

/**
 * Compares two arrays for equality based on a predicate
 * @param a1
 * @param a2
 * @param predicate
 * @returns {boolean}
 */
export function arrayEqualsWithPredicate<T>(a1: $ReadOnlyArray<T>, a2: $ReadOnlyArray<T>, predicate: (T, T) => boolean): boolean {
	if (a1.length === a2.length) {
		for (let i = 0; i < a1.length; i++) {
			if (!predicate(a1[i], a2[i])) {
				return false;
			}
		}
		return true;
	}
	return false;
}

export function arrayHash(array: Uint8Array): number {
	let hash = 0;
	hash |= 0;
	for (let i = 0; i < array.length; i++) {
		hash = ((hash << 5) - hash) + array[i];
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}

/**
 * Remove the element from theArray if it is contained in the array.
 * @param theArray The array to remove the element from.
 * @param elementToRemove The element to remove from the array.
 * @return True if the element was removed, false otherwise.
 */
export function remove<T>(theArray: Array<T>, elementToRemove: T): boolean {
	let i = theArray.indexOf(elementToRemove)
	if (i !== -1) {
		theArray.splice(i, 1)
		return true;
	} else {
		return false;
	}
}

/**
 * Find all items in an array that pass the given predicate
 */
export function findAll<T>(theArray: Array<T>, finder: finder<T>): Array<T> {
	const found = []
	for (let element of theArray) {
		if (finder(element)) {
			found.push(element)
		}
	}
	return found
}

/**
 * @param theArray
 * @param finder
 * @return {boolean} if the element was found
 */
export function findAndRemove<T>(theArray: Array<T>, finder: finder<T>): boolean {
	const index = theArray.findIndex(finder)
	if (index !== -1) {
		theArray.splice(index, 1)
		return true
	} else {
		return false
	}
}

export function findAllAndRemove<T>(theArray: Array<T>, finder: finder<T>, startIndex: number = 0): boolean {
	var removedElement = false
	for (let i = theArray.length - 1; i >= startIndex; i--) {
		if (finder(theArray[i])) {
			theArray.splice(i, 1)
			removedElement = true
		}
	}
	return removedElement
}

export function replace(theArray: Array<any>, oldElement: any, newElement: any): boolean {
	let i = theArray.indexOf(oldElement)
	if (i !== -1) {
		theArray.splice(i, 1, newElement)
		return true;
	} else {
		return false;
	}
}

export function mapAndFilterNull<T, R>(theArray: Array<T>, mapper: mapper<T, R>): R[] {
	let resultList = []
	theArray.forEach(item => {
		let resultItem = mapper(item)
		if (resultItem) {
			resultList.push(resultItem)
		}
	})
	return resultList
}

// TODO get rid of these downcasts
export function mapAndFilterNullAsync<T, R>(array: Array<T>, mapper: mapper<T, $Promisable<?R>>): Promise<R[]> {
	return Promise.all(array.map(mapper)).then(downcast(filterNull))
}

export function filterNull<T>(array: $ReadOnlyArray<?T>): Array<T> {
	return downcast(array.filter(item => item != null))
}

/**
 * Provides the last element of the given array.
 * @param theArray The array.
 * @return The last element of the array.
 */
export function last<T>(theArray: $ReadOnlyArray<T>): ?T {
	return theArray[theArray.length - 1];
}

export function isEmpty<T>(array: $ReadOnlyArray<T>): boolean {
	return array.length === 0
}

export function lastThrow<T>(array: $ReadOnlyArray<T>): T {
	if (isEmpty(array)) {
		throw new RangeError("Array is empty")
	}
	return neverNull(last(array))
}

export function firstThrow<T>(array: $ReadOnlyArray<T>): T {
	if (isEmpty(array)) {
		throw new RangeError("Array is empty")
	}
	return array[0]
}

export function findLast<T>(array: Array<T>, predicate: (T) => boolean): ?T {
	const index = findLastIndex(array, predicate)
	if (index !== -1) {
		return array[index]
	}
	return null
}

export function findLastIndex<T>(array: Array<T>, predicate: (T) => boolean): number {
	for (let i = array.length - 1; i >= 0; i--) {
		if (predicate(array[i])) {
			return i
		}
	}
	return -1
}

export function contains(theArray: Array<any>, elementToCheck: any): boolean {
	return theArray.indexOf(elementToCheck) !== -1
}

export function addAll(array: Array<any>, elements: Array<any>) {
	array.push.apply(array, elements)
}

export function removeAll(array: Array<any>, elements: Array<any>) {
	elements.forEach(element => {
		remove(array, element)
	})
}

/**
 * Group an array based on the given separator, but each group will have only unique items
 */
export function groupByAndMapUniquely<T, R, E>(iterable: Iterable<T>, separator: T => R, mapper: T => E): Map<R, Set<E>> {
	const map = new Map()
	for (let el of iterable) {
		const key = separator(el)
		getFromMap(map, key, () => new Set()).add(mapper(el))
	}
	return map
}

export function groupByAndMap<T, R, E>(iterable: Iterable<T>, separator: (T) => R, mapper: (T) => E): Map<R, Array<E>> {
	const map = new Map()
	for (let el of iterable) {
		const key = separator(el)
		getFromMap(map, key, () => []).push(mapper(el))
	}
	return map
}

export function groupBy<T, R>(iterable: Iterable<T>, separator: (T) => R): Map<R, Array<T>> {
	return groupByAndMap(iterable, separator, identity)
}

export function splitInChunks<T>(chunkSize: number, array: Array<T>): Array<Array<T>> {
	if (chunkSize < 1) {
		return []
	}
	let chunkNum = 0
	const chunks = []
	let end
	do {
		let start = chunkNum * chunkSize
		end = start + chunkSize
		chunks[chunkNum] = array.slice(start, end)
		chunkNum++
	} while (end < array.length)
	return chunks
}

export function flat<T>(arrays: $ReadOnlyArray<$ReadOnlyArray<T>>): Array<T> {
	return arrays.reduce((acc, val) => {
		acc.push(...val)
		return acc
	}, [])
}

/**
 * Maps an array into a nested array and then flattens it
 * @param array
 * @param mapper
 * @returns {T|*[]}
 */
export function flatMap<T, U>(array: $ReadOnlyArray<T>, mapper: T => Array<U>): Array<U> {
	return array.reduce((acc, val) => acc.concat(mapper(val)), [])
}


/**
 * Inserts element into the sorted array. Will find <b>the last</b> matching position.
 * Might add or replace element based on {@param replaceIf} identity check.
 * Equality per {@param comparator} is precondition for replacement.
 * @param element to place
 * @param array where element should be placed
 * @param comparator for sorting
 * @param replaceIf identity comparison for replacement
 */
export function insertIntoSortedArray<T>(element: T, array: Array<T>,
                                         comparator: (left: T, right: T) => number,
                                         replaceIf: (newElement: T, existing: T) => boolean = () => false) {
	let i = 0
	while (i < array.length) {
		const compareResult = comparator(array[i], element)
		// We need to check for replacement for each element that is equal or we might miss it
		if (compareResult === 0 && replaceIf(element, array[i])) {
			array.splice(i, 1, element)
			return
		} else if (compareResult <= 0) {
			// We continue searching until the last suitable position
			i++
		} else {
			break
		}
	}

	// This also handles empty array
	array.splice(i, 0, element)
}

export function zip<A, B>(arr1: Array<A>, arr2: Array<B>): Array<[A, B]> {
	const zipped = []
	for (let i = 0; i < Math.min(arr1.length, arr2.length); i++) {
		zipped.push([arr1[i], arr2[i]])
	}
	return zipped
}

export function deduplicate<T>(arr: Array<T>, comp: (T, T) => boolean = (a, b) => a === b): Array<T> {
	const deduplicated = []
	arr.forEach(a => {
		const isDuplicate = deduplicated.some(b => comp(a, b))
		if (!isDuplicate) {
			deduplicated.push(a)
		}
	})
	return deduplicated
}


/**
 * http://jsfiddle.net/aryzhov/pkfst550/
 * Binary search in JavaScript.
 * Returns the index of of the element in a sorted array or (-n-1) where n is the insertion point for the new element.
 * Parameters:
 *     ar - A sorted array
 *     el - An element to search for
 *     compare_fn - A comparator function. The function takes two arguments: (a, b) and returns:
 *        a negative number  if a is less than b;
 *        0 if a is equal to b;
 *        a positive number of a is greater than b.
 * The array may contain duplicate elements. If there are more than one equal elements in the array,
 * the returned value can be the index of any one of the equal elements.
 */
export function binarySearch<T>(ar: Array<T>, el: T, compare_fn: (T, T) => number): number {
	var m = 0;
	var n = ar.length - 1;
	while (m <= n) {
		var k = (n + m) >> 1;
		var cmp = compare_fn(el, ar[k]);
		if (cmp > 0) {
			m = k + 1;
		} else if (cmp < 0) {
			n = k - 1;
		} else {
			return k;
		}
	}
	return -m - 1;
}

export function lastIndex<T>(array: $ReadOnlyArray<T>): number {
	if (array.length === 0) {
		return 0
	} else {
		return array.length - 1
	}
}

export function union<T>(...iterables: Array<Iterable<T>>): Set<T> {
	return new Set(...iterables.map(iterable => Array.from(iterable)))
}

/**
 * return a new array containing every item from array1 that isn't in array2
 * @param array1
 * @param array2
 * @param compare: compare items in the array for equality
 * @returns {Array<$NonMaybeType<T>>|Array<T>}
 */
export function difference<T>(array1: $ReadOnlyArray<T>, array2: $ReadOnlyArray<T>, compare: (T, T) => boolean): Array<T> {
	return array1.filter(element1 => !array2.some(element2 => compare(element1, element2)))
}

/**
 * Splits an array into two based on a predicate, where elements that match the predicate go into the left side
 * @param array
 * @param predicate
 */
export function partition<T>(array: Array<T>, predicate: T => boolean): [Array<T>, Array<T>] {
	const left = []
	const right = []
	for (let item of array) {
		if (predicate(item)) {
			left.push(item)
		} else {
			right.push(item)
		}
	}

	return [left, right]
}