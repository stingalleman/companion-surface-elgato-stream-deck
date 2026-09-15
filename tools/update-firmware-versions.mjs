// @ts-check

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
// eslint-disable-next-line n/no-unpublished-import
import prettier from 'prettier'

const VERSIONS_URL = 'https://api.bitfocus.io/v1/product/elgato-updater/versions'

const versionsPath = path.join(import.meta.dirname, '../src/firmware-versions.json')

/**
 * @typedef {{ name?: string, productIds: number[], versions: Record<string, string> }} FirmwareVersionInfo
 */

/** @type {FirmwareVersionInfo[]} */
const existingVersions = JSON.parse(readFileSync(versionsPath, 'utf8'))

const response = await fetch(VERSIONS_URL)
if (!response.ok) throw new Error(`Failed to fetch versions: ${response.status} ${response.statusText}`)

/** @type {unknown} */
const apiVersions = await response.json()

// Make sure the api gave us something usable, to avoid clobbering the file with garbage
if (!Array.isArray(apiVersions) || apiVersions.length === 0)
	throw new Error(`Expected a non-empty array from the api, got: ${JSON.stringify(apiVersions)}`)

/** @type {FirmwareVersionInfo[]} */
const newVersions = apiVersions.map((info) => {
	if (
		!info ||
		!Array.isArray(info.productIds) ||
		info.productIds.length === 0 ||
		!info.productIds.every((id) => typeof id === 'number') ||
		!info.versions ||
		typeof info.versions !== 'object' ||
		Object.keys(info.versions).length === 0 ||
		!Object.values(info.versions).every((version) => typeof version === 'string')
	)
		throw new Error(`Malformed entry from the api: ${JSON.stringify(info)}`)

	// The api doesn't provide a name, so carry over the one we already have for these productIds
	const existingEntry = existingVersions.find((entry) => entry.productIds.some((id) => info.productIds.includes(id)))

	return {
		name: existingEntry?.name ?? 'Unknown device (please fill this in)',
		productIds: info.productIds,
		versions: info.versions,
	}
})

const prettierConfig = await prettier.resolveConfig(versionsPath)
const formatted = await prettier.format(JSON.stringify(newVersions), {
	...prettierConfig,
	parser: 'json',
})

writeFileSync(versionsPath, formatted)

console.log(`Wrote ${newVersions.length} entries to ${versionsPath}`)
for (const info of newVersions) {
	console.log(` - ${info.name}: ${JSON.stringify(info.versions)}`)
}
