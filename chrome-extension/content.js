const OVERLAY_ID = '__sap_selector_picker_overlay__'
const OVERLAY_LABEL_ID = '__sap_selector_picker_overlay_label__'
const TO_RANGE_LABELS = new Set(['-', 'thru', 'through', 'to', 'until'])
const INTERACTIVE_CONTROL_TYPES = new Set(['B', 'CB', 'CBS', 'CI', 'IMG', 'LN', 'LNC', 'RLI', 'TV'])
const INTERACTIVE_ROLES = new Set(['button', 'combobox', 'listbox', 'textbox'])
const UI5_PROPERTY_CANDIDATES = ['text', 'title', 'value', 'name', 'tooltip', 'icon']
const UI5_RESOLVE_TIMEOUT_MS = 1500

let pickerActive = false

const normalizeText = (value) =>
    String(value ?? '')
        .replace(/\s+/gu, ' ')
        .trim()

const normalizeForMatch = (value) => normalizeText(value).toLowerCase()

const sanitizeSelectorValue = (value) =>
    normalizeText(value).replaceAll(';', ',').replaceAll('\n', ' ')

const WEBGUI_CONTROL_TYPES = new Set([
    'button',
    'checkbox',
    'combobox',
    'link',
    'listbox',
    'option',
    'radio',
    'spinbutton',
    'table',
    'textbox',
])

const escapeWebGuiAttributeValue = (value) =>
    sanitizeSelectorValue(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const formatWebGuiAttribute = (key, value) => `[${key}='${escapeWebGuiAttributeValue(value)}']`

const getWebGuiSelectorControlType = (metadata) => {
    const normalizedRole = normalizeForMatch(metadata.role)
    if (WEBGUI_CONTROL_TYPES.has(normalizedRole)) {
        return normalizedRole
    }

    if (metadata.ct === 'B' || metadata.ct === 'IMG') {
        return 'button'
    }
    if (metadata.ct === 'CB' || metadata.ct === 'CBS') {
        return 'checkbox'
    }
    if (metadata.ct === 'CI') {
        return 'textbox'
    }
    if (metadata.ct === 'LN' || metadata.ct === 'LNC') {
        return 'link'
    }
    if (metadata.ct === 'R' || metadata.ct === 'R_standards' || metadata.ct === 'RLI') {
        return 'radio'
    }
    if (metadata.ct === 'TV') {
        return 'listbox'
    }
    if (metadata.ct === 'G' || metadata.ct === 'STCS') {
        return 'table'
    }

    if (metadata.element instanceof HTMLButtonElement || metadata.element.tagName === 'BUTTON') {
        return 'button'
    }
    if (
        metadata.element instanceof HTMLTextAreaElement ||
        metadata.element.tagName === 'TEXTAREA'
    ) {
        return 'textbox'
    }
    if (metadata.element instanceof HTMLSelectElement || metadata.element.tagName === 'SELECT') {
        if (metadata.element.multiple || metadata.element.size > 1) {
            return 'listbox'
        }
        return 'combobox'
    }
    if (metadata.element instanceof HTMLInputElement || metadata.element.tagName === 'INPUT') {
        const normalizedInputType = normalizeForMatch(metadata.element.type)
        if (normalizedInputType === 'checkbox') {
            return 'checkbox'
        }
        if (normalizedInputType === 'radio') {
            return 'radio'
        }
        if (
            normalizedInputType === 'button' ||
            normalizedInputType === 'image' ||
            normalizedInputType === 'reset' ||
            normalizedInputType === 'submit'
        ) {
            return 'button'
        }
        return 'textbox'
    }
    if (metadata.element instanceof HTMLAnchorElement || metadata.element.tagName === 'A') {
        return 'link'
    }
    if (metadata.element instanceof HTMLTableElement || metadata.element.tagName === 'TABLE') {
        return 'table'
    }
    if (normalizedRole === 'table' || normalizedRole === 'grid') {
        return 'table'
    }

    return '*'
}

const formatWebGuiSelectorByType = (controlType, attributes) => {
    const selectorAttributes = attributes.map(({ key, value }) => formatWebGuiAttribute(key, value))
    return `webgui=${controlType}${selectorAttributes.join('')}`
}

const formatWebGuiSelector = (metadata, attributes) =>
    formatWebGuiSelectorByType(getWebGuiSelectorControlType(metadata), attributes)

const formatWebGuiWildcardSelector = (attributes) => {
    return formatWebGuiSelectorByType('*', attributes)
}

const escapeUi5CssValue = (value) => normalizeText(value).replaceAll("'", "\\'")

const formatSelector = (segments) => segments.filter(Boolean).join(';')

const sendMessage = (message) =>
    chrome.runtime.sendMessage(message, () => {
        void chrome.runtime.lastError
    })

const sendMessageWithResponse = (message, timeoutMs = UI5_RESOLVE_TIMEOUT_MS) =>
    new Promise((resolve) => {
        let done = false
        const finish = (response) => {
            if (done) {
                return
            }
            done = true
            resolve(response ?? null)
        }

        const timeoutId = window.setTimeout(() => {
            finish(null)
        }, timeoutMs)

        chrome.runtime.sendMessage(message, (response) => {
            window.clearTimeout(timeoutId)
            if (chrome.runtime.lastError) {
                finish(null)
                return
            }
            finish(response ?? null)
        })
    })

const getOverlay = () => document.getElementById(OVERLAY_ID)

const ensureOverlay = () => {
    const existingOverlay = getOverlay()
    if (existingOverlay !== null) {
        return existingOverlay
    }

    const overlay = document.createElement('div')
    overlay.id = OVERLAY_ID
    overlay.style.position = 'fixed'
    overlay.style.zIndex = '2147483647'
    overlay.style.pointerEvents = 'none'
    overlay.style.border = '2px solid #0a84ff'
    overlay.style.background = 'rgba(10, 132, 255, 0.15)'
    overlay.style.borderRadius = '3px'
    overlay.style.display = 'none'
    overlay.style.boxSizing = 'border-box'

    const label = document.createElement('div')
    label.id = OVERLAY_LABEL_ID
    label.style.position = 'absolute'
    label.style.left = '0'
    label.style.bottom = '100%'
    label.style.transform = 'translateY(-4px)'
    label.style.maxWidth = '560px'
    label.style.overflow = 'hidden'
    label.style.textOverflow = 'ellipsis'
    label.style.whiteSpace = 'nowrap'
    label.style.fontFamily = 'Consolas, Menlo, Monaco, monospace'
    label.style.fontSize = '12px'
    label.style.lineHeight = '16px'
    label.style.padding = '2px 6px'
    label.style.color = '#fff'
    label.style.background = '#0a84ff'
    label.style.borderRadius = '3px'
    overlay.append(label)

    document.documentElement.append(overlay)
    return overlay
}

const hideOverlay = () => {
    const overlay = getOverlay()
    if (overlay !== null) {
        overlay.style.display = 'none'
    }
}

const updateOverlay = (element, labelText) => {
    if (!(element instanceof Element)) {
        hideOverlay()
        return
    }
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
        hideOverlay()
        return
    }

    const overlay = ensureOverlay()
    overlay.style.display = 'block'
    overlay.style.left = `${rect.left}px`
    overlay.style.top = `${rect.top}px`
    overlay.style.width = `${rect.width}px`
    overlay.style.height = `${rect.height}px`

    const label = document.getElementById(OVERLAY_LABEL_ID)
    if (label !== null) {
        label.textContent = labelText
    }
}

const describeElement = (element) => {
    if (!(element instanceof Element)) {
        return 'unknown'
    }

    const getTextByIdList = (idList) =>
        normalizeText(idList)
            .split(/\s+/u)
            .filter(Boolean)
            .map((id) => normalizeText(document.getElementById(id)?.textContent))
            .filter((text) => text !== '')

    const getLabelByForAttribute = (id) => {
        if (id === '') {
            return undefined
        }

        const labelElement = document.querySelector(`label[for="${CSS.escape(id)}"]`)
        const labelText = normalizeText(labelElement?.textContent)
        if (labelText !== '') {
            return labelText
        }

        const suffixes = ['-inner', '-content', '-input', '-select', '-I', '-Bdi']
        for (const suffix of suffixes) {
            if (!id.endsWith(suffix) || id.length <= suffix.length) {
                continue
            }
            const baseId = id.slice(0, id.length - suffix.length)
            const baseLabelElement = document.querySelector(`label[for="${CSS.escape(baseId)}"]`)
            const baseLabelText = normalizeText(baseLabelElement?.textContent)
            if (baseLabelText !== '') {
                return baseLabelText
            }
        }

        return undefined
    }

    const getRowLikeLabel = (targetElement) => {
        const rowLike =
            targetElement.closest('.sapMInputListItem,.sapMILI,.sapMLIB,[role="row"],tr') ??
            targetElement.parentElement
        if (!(rowLike instanceof Element)) {
            return undefined
        }

        const knownLabelElement = rowLike.querySelector(
            '.sapMILILabel,.sapMLabel,label,.sapMText,.sapMSLITitleOnly,.sapMObjLTitle',
        )
        const knownLabelText = normalizeText(knownLabelElement?.textContent)
        if (knownLabelText !== '' && knownLabelText.length <= 120) {
            return knownLabelText
        }

        const cell = targetElement.closest('td,.sapMListTblCell')
        if (cell?.parentElement) {
            const rowChildren = Array.from(cell.parentElement.children)
            const index = rowChildren.indexOf(cell)
            for (let siblingIndex = index - 1; siblingIndex >= 0; siblingIndex--) {
                const sibling = rowChildren[siblingIndex]
                if (!(sibling instanceof Element)) {
                    continue
                }
                const siblingText = normalizeText(sibling.textContent)
                if (siblingText !== '' && siblingText.length <= 120) {
                    return siblingText
                }
            }
        }

        return undefined
    }

    const getElementSemanticLabel = (targetElement) => {
        const ariaLabel = normalizeText(targetElement.getAttribute('aria-label'))
        if (ariaLabel !== '') {
            return ariaLabel
        }

        const ariaLabelledByTexts = getTextByIdList(targetElement.getAttribute('aria-labelledby'))
        if (ariaLabelledByTexts.length > 0) {
            return ariaLabelledByTexts.join(' / ')
        }

        const labelledByFor = getLabelByForAttribute(targetElement.id)
        if (labelledByFor !== undefined) {
            return labelledByFor
        }

        const placeholder = normalizeText(targetElement.getAttribute('placeholder'))
        if (placeholder !== '') {
            return placeholder
        }

        const rowLikeLabel = getRowLikeLabel(targetElement)
        if (rowLikeLabel !== undefined) {
            return rowLikeLabel
        }

        const title = normalizeText(targetElement.getAttribute('title'))
        if (title !== '') {
            return title
        }

        return undefined
    }

    const semanticLabel = getElementSemanticLabel(element)
    if (semanticLabel !== undefined) {
        return `${element.tagName.toLowerCase()}=${semanticLabel}`
    }

    const pieces = [element.tagName.toLowerCase()]
    if (element.id !== '') {
        pieces.push(`#${element.id}`)
    }
    const title = normalizeText(element.getAttribute('title'))
    if (title !== '') {
        pieces.push(title)
    }
    return pieces.join(' ')
}

const isWebGuiPage = () =>
    document.documentElement.hasAttribute('data-sap-ls-system-runtimeversion') ||
    document.querySelector('[ct="PAGE"]') !== null

const isCandidateElement = (element) => {
    const ct = element.getAttribute('ct')
    if (ct !== null && INTERACTIVE_CONTROL_TYPES.has(ct)) {
        return true
    }

    const role = element.getAttribute('role')
    if (role !== null && INTERACTIVE_ROLES.has(role)) {
        return true
    }

    const tagName = element.tagName
    if (tagName === 'INPUT') {
        return element.type !== 'hidden'
    }
    if (tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON') {
        return true
    }
    if (tagName === 'A') {
        return (
            role === 'button' ||
            element.getAttribute('tabindex') === '0' ||
            element.getAttribute('ti') === '0'
        )
    }
    if (tagName === 'TABLE') {
        return true
    }
    if (ct === 'G' || ct === 'STCS') {
        return true
    }
    if (role === 'group') {
        return element.querySelector('table') !== null
    }
    if (role === 'table' || role === 'grid') {
        return true
    }
    return false
}

const queryElementsInScope = (selector) => Array.from(document.querySelectorAll(selector))

const getCandidateElements = () =>
    queryElementsInScope(
        '[ct],a,button,input,[role="button"],[role="combobox"],[role="grid"],[role="group"],[role="listbox"],[role="table"],[role="textbox"],select,table,textarea',
    ).filter(isCandidateElement)

const getLabelTextsForId = (id) =>
    Array.from(document.querySelectorAll(`label[for="${CSS.escape(id)}"]`))
        .map((label) => normalizeText(label.textContent))
        .filter((text) => text !== '')

const getPrimaryLabelForId = (id) => {
    if (!id) {
        return undefined
    }
    return getLabelTextsForId(id)[0]
}

const getGridCoordinatesFromId = (id) => {
    const bracketPatternMatch = id.match(/^(?<tableId>[^[]+)\[(?<row>\d+),(?<column>\d+)\]/u)
    if (bracketPatternMatch?.groups !== undefined) {
        const tableId = bracketPatternMatch.groups.tableId
        const row = bracketPatternMatch.groups.row
        const column = bracketPatternMatch.groups.column
        if (tableId && row && column) {
            return {
                tableId,
                row: Number.parseInt(row, 10),
                column: Number.parseInt(column, 10),
            }
        }
    }

    const hashPatternMatch = id.match(/^(?<tableId>.+?)#(?<row>\d+),(?<column>\d+)(?:#|$)/u)
    if (hashPatternMatch?.groups !== undefined) {
        const tableId = hashPatternMatch.groups.tableId
        const row = hashPatternMatch.groups.row
        const column = hashPatternMatch.groups.column
        if (tableId && row && column) {
            return {
                tableId,
                row: Number.parseInt(row, 10),
                column: Number.parseInt(column, 10),
            }
        }
    }

    return undefined
}

const getCoordinatesForElement = (element) => {
    if (element.id !== '') {
        const coordinatesFromId = getGridCoordinatesFromId(element.id)
        if (coordinatesFromId !== undefined) {
            return coordinatesFromId
        }
    }

    const cell = element.closest('td')
    const table = element.closest('table')
    if (cell === null || table?.id === undefined || table.id === '') {
        return undefined
    }

    const row = Number.parseInt(cell.getAttribute('lsmatrixrowindex') ?? '', 10)
    const column = Number.parseInt(cell.getAttribute('lsmatrixcolindex') ?? '', 10)
    if (Number.isNaN(row) || Number.isNaN(column)) {
        return undefined
    }

    return {
        tableId: table.id,
        row,
        column,
    }
}

const getCellId = (tableId, row, column) =>
    tableId.includes('#') ? `${tableId}#${row},${column}` : `${tableId}[${row},${column}]`

const getCurrentHeaderText = (headerCell) => {
    if (headerCell === null) {
        return undefined
    }
    const currentLabel =
        headerCell.querySelector('.lsSTHCCPContentCurrent') ?? headerCell.querySelector('[ct="CP"]')
    if (currentLabel !== null) {
        const currentLabelText = normalizeText(currentLabel.textContent)
        if (currentLabelText !== '') {
            return currentLabelText
        }
    }
    const headerText = normalizeText(headerCell.textContent)
    return headerText === '' ? undefined : headerText
}

const getTextByIdList = (idList) =>
    normalizeText(idList)
        .split(/\s+/u)
        .filter((id) => id !== '')
        .map((id) => normalizeText(document.getElementById(id)?.textContent))
        .filter((text) => text !== '')

const getElementLabelFromAttributes = (element) => {
    if (!(element instanceof Element)) {
        return undefined
    }

    const ariaLabel = normalizeText(element.getAttribute('aria-label'))
    if (ariaLabel !== '') {
        return ariaLabel
    }

    const ariaLabelledByText = getTextByIdList(element.getAttribute('aria-labelledby'))
    if (ariaLabelledByText.length > 0) {
        return ariaLabelledByText.join(' / ')
    }

    const title = normalizeText(element.getAttribute('title'))
    if (title !== '') {
        return title
    }

    return undefined
}

const getGroupHeaderText = (groupElement) => {
    const groupHeaderSelectors = [
        '[id$="-groupheader"]',
        '.lsGroup__header--nowrapping',
        '[role="heading"]',
    ]
    for (const selector of groupHeaderSelectors) {
        const groupHeaderElement = groupElement.querySelector(selector)
        if (groupHeaderElement === null) {
            continue
        }
        const headerText = normalizeText(groupHeaderElement.textContent)
        if (headerText !== '') {
            return headerText
        }
    }
    return undefined
}

const getTableHeadingText = (tableElement) => {
    const headingSelectors = [
        '[id$="-title"] [ct="CP"]',
        '[id$="-title"]',
        'thead [role="heading"] [ct="CP"]',
        'thead [role="heading"]',
        '[role="heading"] [ct="CP"]',
        '[role="heading"]',
    ]
    for (const selector of headingSelectors) {
        const headingElement = tableElement.querySelector(selector)
        if (headingElement === null) {
            continue
        }
        const headingText = normalizeText(headingElement.textContent)
        if (headingText !== '') {
            return headingText
        }
    }
    return undefined
}

const getOwnTableLabel = (element) => {
    if (!(element instanceof Element)) {
        return undefined
    }

    const explicitLabel = getElementLabelFromAttributes(element)
    if (explicitLabel !== undefined) {
        return explicitLabel
    }

    if (element.tagName === 'TABLE') {
        const captionText = normalizeText(element.querySelector('caption')?.textContent)
        if (captionText !== '') {
            return captionText
        }

        const headingText = getTableHeadingText(element)
        if (headingText !== '') {
            return headingText
        }
    }

    if (
        element.getAttribute('ct') === 'G' ||
        normalizeForMatch(element.getAttribute('role')) === 'group'
    ) {
        return getGroupHeaderText(element)
    }

    return undefined
}

const getLabelFromSibling = (element) => {
    if (!(element instanceof Element)) {
        return undefined
    }

    const explicitLabel = getElementLabelFromAttributes(element)
    if (explicitLabel !== undefined) {
        return explicitLabel
    }

    const siblingText = normalizeText(element.textContent)
    if (siblingText !== '' && siblingText.length <= 120) {
        return siblingText
    }

    return undefined
}

const getNearestTableLabel = (element) => {
    let currentElement = element
    while (currentElement instanceof Element) {
        const ownLabel = getOwnTableLabel(currentElement)
        if (ownLabel !== undefined) {
            return ownLabel
        }

        const siblingLabel = getLabelFromSibling(currentElement.previousElementSibling)
        if (siblingLabel !== undefined) {
            return siblingLabel
        }

        currentElement = currentElement.parentElement
    }
    return undefined
}

const getTableTitle = (tableId) => {
    const titleElement =
        document.getElementById(`${tableId}-title`) ?? document.getElementById(`${tableId}#title`)
    if (titleElement !== null) {
        const titleText = normalizeText(titleElement.textContent)
        if (titleText !== '') {
            return titleText
        }
    }

    const tableElement = document.getElementById(tableId)
    if (tableElement !== null) {
        const tableLabel = getNearestTableLabel(tableElement)
        if (tableLabel !== undefined) {
            return tableLabel
        }
    }

    return undefined
}

const getTableContext = (element) => {
    const coordinates = getCoordinatesForElement(element)
    if (coordinates === undefined) {
        return {
            columnLabel: undefined,
            composedLabel: undefined,
            rowLabel: undefined,
            tableLabel: undefined,
        }
    }

    const columnLabel = getCurrentHeaderText(
        document.getElementById(getCellId(coordinates.tableId, 0, coordinates.column)),
    )
    const rowLabel = getCurrentHeaderText(
        document.getElementById(getCellId(coordinates.tableId, coordinates.row, 1)) ??
            document.getElementById(getCellId(coordinates.tableId, coordinates.row, 0)),
    )
    const tableLabel = getTableTitle(coordinates.tableId)
    const composedLabelParts = [tableLabel, rowLabel, columnLabel].filter(Boolean)

    return {
        columnLabel,
        composedLabel: composedLabelParts.length > 0 ? composedLabelParts.join(' / ') : undefined,
        rowLabel,
        tableLabel,
    }
}

const isToRangeLabel = (label) => TO_RANGE_LABELS.has(normalizeForMatch(label))

const applyRangeGrouping = (metadataList) => {
    const metadataByRow = new Map()
    for (const item of metadataList) {
        if (!item.rowKey) {
            continue
        }
        if (!metadataByRow.has(item.rowKey)) {
            metadataByRow.set(item.rowKey, [])
        }
        metadataByRow.get(item.rowKey).push(item)
    }

    metadataByRow.forEach((rowMetadata) => {
        const labelledItems = rowMetadata.filter((item) => item.directLabel !== undefined)
        for (let index = 0; index < labelledItems.length - 1; index++) {
            const currentItem = labelledItems[index]
            const nextItem = labelledItems[index + 1]
            if (!currentItem || !nextItem) {
                continue
            }
            if (isToRangeLabel(currentItem.directLabel) || !isToRangeLabel(nextItem.directLabel)) {
                continue
            }
            currentItem.groupLabel = currentItem.directLabel
            currentItem.rangePart = 'from'
            nextItem.groupLabel = currentItem.directLabel
            nextItem.rangePart = 'to'
            index++
        }
    })
}

const createDisplayLabel = (metadata) => {
    if (metadata.groupLabel && metadata.rangePart) {
        return `${metadata.groupLabel} (${metadata.rangePart})`
    }
    if (metadata.directLabel) {
        return metadata.directLabel
    }
    if (metadata.tableContext.composedLabel) {
        return metadata.tableContext.composedLabel
    }
    if (metadata.title) {
        return metadata.title
    }
    if (metadata.ariaLabel) {
        return metadata.ariaLabel
    }
    if (metadata.id) {
        return `id:${metadata.id}`
    }
    return 'unnamed'
}

const createElementMetadata = () => {
    const metadataList = getCandidateElements().map((element) => {
        const id = normalizeText(element.id) || undefined
        const tableContext = getTableContext(element)
        const ownTableLabel = getOwnTableLabel(element)
        if (ownTableLabel !== undefined && tableContext.tableLabel === undefined) {
            tableContext.tableLabel = ownTableLabel
        }
        if (ownTableLabel !== undefined && tableContext.composedLabel === undefined) {
            tableContext.composedLabel = ownTableLabel
        }
        return {
            element,
            id,
            ct: element.getAttribute('ct') ?? undefined,
            role: element.getAttribute('role') ?? undefined,
            title: normalizeText(element.getAttribute('title')) || undefined,
            ariaLabel: normalizeText(element.getAttribute('aria-label')) || undefined,
            directLabel: getPrimaryLabelForId(id),
            tableContext,
            rowKey: element.closest('tr')?.id ?? undefined,
            groupLabel: undefined,
            rangePart: undefined,
            displayLabel: '',
        }
    })

    applyRangeGrouping(metadataList)
    for (const item of metadataList) {
        item.displayLabel = createDisplayLabel(item)
    }
    return metadataList
}

const findCandidateMetadataForTarget = (target, metadataList) => {
    const metadataByElement = new Map(metadataList.map((item) => [item.element, item]))

    let current = target
    while (current instanceof Element) {
        const match = metadataByElement.get(current)
        if (match) {
            return match
        }
        current = current.parentElement
    }
    return undefined
}

const dedupeSelectorEntries = (entries) => {
    const seen = new Set()
    return entries.filter((entry) => {
        if (!entry?.value || seen.has(entry.value)) {
            return false
        }
        seen.add(entry.value)
        return true
    })
}

const getSemanticLabelFromDescription = (element, description) => {
    if (!(element instanceof Element)) {
        return undefined
    }
    const prefix = `${element.tagName.toLowerCase()}=`
    if (!description.startsWith(prefix)) {
        return undefined
    }
    const label = normalizeText(description.slice(prefix.length))
    return label === '' ? undefined : label
}

const buildWebGuiResult = (target) => {
    if (!isWebGuiPage()) {
        return null
    }

    const metadataList = createElementMetadata()
    const metadata = findCandidateMetadataForTarget(target, metadataList)
    if (!metadata) {
        return null
    }

    const selectors = []
    if (metadata.groupLabel && metadata.rangePart) {
        selectors.push({
            label: 'WebGUI grouped range',
            value: formatWebGuiSelector(metadata, [
                { key: 'group', value: metadata.groupLabel },
                { key: 'part', value: metadata.rangePart },
            ]),
        })
        selectors.push({
            label: 'WebGUI grouped range (both fields)',
            value: formatWebGuiSelector(metadata, [{ key: 'group', value: metadata.groupLabel }]),
        })
    }
    if (metadata.directLabel && !isToRangeLabel(metadata.directLabel)) {
        selectors.push({
            label: 'WebGUI label',
            value: formatWebGuiSelector(metadata, [{ key: 'label', value: metadata.directLabel }]),
        })
    }
    if (
        metadata.tableContext.tableLabel &&
        metadata.tableContext.rowLabel &&
        metadata.tableContext.columnLabel
    ) {
        selectors.push({
            label: 'WebGUI table fallback',
            value: formatWebGuiSelector(metadata, [
                { key: 'table', value: metadata.tableContext.tableLabel },
                { key: 'row', value: metadata.tableContext.rowLabel },
                { key: 'column', value: metadata.tableContext.columnLabel },
            ]),
        })
    }
    if (metadata.tableContext.tableLabel) {
        selectors.push({
            label: 'WebGUI table',
            value: formatWebGuiSelectorByType('table', [
                { key: 'label', value: metadata.tableContext.tableLabel },
            ]),
        })
        selectors.push({
            label: 'WebGUI parent table context',
            value: formatWebGuiWildcardSelector([
                { key: 'table', value: metadata.tableContext.tableLabel },
            ]),
        })
    }
    if (metadata.tableContext.tableLabel && metadata.tableContext.rowLabel) {
        selectors.push({
            label: 'WebGUI parent row context',
            value: formatWebGuiWildcardSelector([
                { key: 'table', value: metadata.tableContext.tableLabel },
                { key: 'row', value: metadata.tableContext.rowLabel },
            ]),
        })
    }
    if (metadata.title) {
        selectors.push({
            label: 'WebGUI title fallback',
            value: formatWebGuiSelector(metadata, [{ key: 'title', value: metadata.title }]),
        })
    }
    if (metadata.id) {
        selectors.push({
            label: 'WebGUI id fallback',
            value: formatWebGuiSelector(metadata, [{ key: 'id', value: metadata.id }]),
        })
    }

    const uniqueSelectors = dedupeSelectorEntries(selectors)
    if (uniqueSelectors.length === 0) {
        return null
    }

    return {
        engine: 'webgui',
        title: 'SAP WebGUI',
        primary: uniqueSelectors[0].value,
        selectors: uniqueSelectors,
        displayLabel: metadata.displayLabel,
    }
}

const appendCandidateId = (bucket, value) => {
    const normalized = normalizeText(value)
    if (normalized !== '') {
        bucket.add(normalized)
    }
}

const getExpandedUi5IdCandidates = (value) => {
    const candidates = new Set()
    const normalized = normalizeText(value)
    if (normalized === '') {
        return []
    }

    appendCandidateId(candidates, normalized)

    const suffixes = [
        '-inner',
        '-content',
        '-input',
        '-select',
        '-arrow',
        '-img',
        '-icon',
        '-I',
        '-Bdi',
    ]
    for (const suffix of suffixes) {
        if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
            appendCandidateId(candidates, normalized.slice(0, normalized.length - suffix.length))
        }
    }

    let current = normalized
    while (current.includes('-')) {
        current = current.slice(0, current.lastIndexOf('-'))
        appendCandidateId(candidates, current)
    }

    return Array.from(candidates)
}

const collectUi5CandidateIdsForTarget = (target) => {
    const candidates = new Set()

    let current = target
    while (current instanceof Element) {
        for (const candidateId of getExpandedUi5IdCandidates(current.id)) {
            appendCandidateId(candidates, candidateId)
        }
        appendCandidateId(candidates, current.getAttribute('data-sap-ui'))
        current = current.parentElement
    }

    return Array.from(candidates)
}

const resolveUi5ControlInMainWorld = async (target, clickPosition) => {
    const response = await sendMessageWithResponse({
        type: 'RESOLVE_UI5',
        payload: {
            candidateIds: collectUi5CandidateIdsForTarget(target),
            clickPosition: clickPosition ?? null,
        },
    })

    if (response?.ok !== true || response.result?.found !== true) {
        return null
    }

    return response.result
}

const buildUi5Result = async (target, clickPosition) => {
    const ui5ControlData = await resolveUi5ControlInMainWorld(target, clickPosition)
    if (!ui5ControlData) {
        return null
    }

    const typeName = normalizeText(ui5ControlData.typeName)
    const controlId = normalizeText(ui5ControlData.controlId)
    const semanticLabel = getSemanticLabelFromDescription(
        target,
        target instanceof Element ? describeElement(target) : '',
    )
    if (typeName === '') {
        return null
    }

    const selectors = []
    selectors.push({
        label: 'UI5 type',
        value: `ui5_css=${typeName}`,
    })
    if (controlId !== '') {
        selectors.push({
            label: 'UI5 id',
            value: `ui5_css=${typeName}#${controlId}`,
        })
        selectors.push({
            label: 'UI5 XPath id',
            value: `ui5_xpath=//${typeName}[@id="${controlId}"]`,
        })
    }

    const propertyEntries = Array.isArray(ui5ControlData.properties)
        ? ui5ControlData.properties
        : []
    for (const entry of propertyEntries) {
        const propertyName = normalizeText(entry?.name)
        const propertyValue = entry?.value
        if (!UI5_PROPERTY_CANDIDATES.includes(propertyName)) {
            continue
        }
        if (
            propertyValue === undefined ||
            propertyValue === null ||
            (typeof propertyValue === 'string' && normalizeText(propertyValue) === '')
        ) {
            continue
        }
        if (typeof propertyValue === 'string') {
            selectors.push({
                label: `UI5 property (${propertyName})`,
                value: `ui5_css=${typeName}[${propertyName}='${escapeUi5CssValue(propertyValue)}']`,
            })
        } else if (typeof propertyValue === 'number' || typeof propertyValue === 'boolean') {
            selectors.push({
                label: `UI5 property (${propertyName})`,
                value: `ui5_css=${typeName}[${propertyName}='${String(propertyValue)}']`,
            })
        }
        if (selectors.length >= 7) {
            break
        }
    }

    const uniqueSelectors = dedupeSelectorEntries(selectors)
    return {
        engine: 'ui5',
        title: 'SAP UI5',
        primary: uniqueSelectors[0]?.value ?? '',
        selectors: uniqueSelectors,
        displayLabel:
            semanticLabel ||
            normalizeText(ui5ControlData.displayLabel) ||
            `${typeName}${controlId ? `#${controlId}` : ''}`,
    }
}

const buildDomFallbackResult = (target) => {
    const element = target instanceof Element ? target : document.documentElement
    const elementId = normalizeText(element.id)
    const selectors = []
    if (elementId !== '') {
        selectors.push({ label: 'CSS id', value: `css=#${elementId}` })
    }
    selectors.push({ label: 'CSS tag fallback', value: `css=${element.tagName.toLowerCase()}` })
    return {
        engine: 'dom',
        title: 'DOM fallback',
        primary: selectors[0].value,
        selectors,
        displayLabel: describeElement(element),
    }
}

const generateSelectorsForTarget = async (target, clickPosition) => {
    const groups = []

    const webGuiGroup = buildWebGuiResult(target)
    if (webGuiGroup) {
        groups.push(webGuiGroup)
    }

    const ui5Group = await buildUi5Result(target, clickPosition)
    if (ui5Group) {
        groups.push(ui5Group)
    }

    if (groups.length === 0) {
        groups.push(buildDomFallbackResult(target))
    }

    const primary = groups[0]?.primary ?? ''
    return {
        pickedAt: new Date().toISOString(),
        pageTitle: document.title,
        pageUrl: location.href,
        element: {
            className: target instanceof Element ? normalizeText(target.className) : '',
            id: target instanceof Element ? target.id : '',
            tagName: target instanceof Element ? target.tagName.toLowerCase() : '',
            text: target instanceof Element ? normalizeText(target.textContent).slice(0, 120) : '',
            title: target instanceof Element ? normalizeText(target.getAttribute('title')) : '',
        },
        groups,
        primary,
    }
}

const getEventTargetElement = (event) => {
    if (typeof event.composedPath === 'function') {
        const path = event.composedPath()
        for (const node of path) {
            if (node instanceof Element) {
                return node
            }
        }
    }
    return event.target instanceof Element ? event.target : null
}

const onMouseMove = (event) => {
    if (!pickerActive) {
        return
    }
    const target = getEventTargetElement(event)
    if (target === null) {
        hideOverlay()
        return
    }
    updateOverlay(target, describeElement(target))
}

const onClick = async (event) => {
    if (!pickerActive) {
        return
    }

    const target = getEventTargetElement(event)
    if (target === null) {
        return
    }

    event.preventDefault()
    event.stopImmediatePropagation()
    event.stopPropagation()

    try {
        const result = await generateSelectorsForTarget(target, {
            x: event.clientX,
            y: event.clientY,
        })
        const preferredGroupLabel = normalizeText(result.groups?.[0]?.displayLabel)
        const overlayLabel =
            preferredGroupLabel !== ''
                ? `${target.tagName.toLowerCase()}=${preferredGroupLabel}`
                : result.primary || describeElement(target)
        updateOverlay(target, overlayLabel)
        sendMessage({ type: 'PICKER_RESULT', result })
    } catch {
        const fallback = buildDomFallbackResult(target)
        updateOverlay(target, fallback.primary || describeElement(target))
        sendMessage({
            type: 'PICKER_RESULT',
            result: {
                pickedAt: new Date().toISOString(),
                pageTitle: document.title,
                pageUrl: location.href,
                element: {
                    className: target instanceof Element ? normalizeText(target.className) : '',
                    id: target instanceof Element ? target.id : '',
                    tagName: target instanceof Element ? target.tagName.toLowerCase() : '',
                    text:
                        target instanceof Element
                            ? normalizeText(target.textContent).slice(0, 120)
                            : '',
                    title:
                        target instanceof Element
                            ? normalizeText(target.getAttribute('title'))
                            : '',
                },
                groups: [fallback],
                primary: fallback.primary,
            },
        })
    }
}

const setPickerActive = (active) => {
    pickerActive = active
    if (!pickerActive) {
        hideOverlay()
        return
    }
    ensureOverlay()
}

const onKeyDown = (event) => {
    if (!pickerActive) {
        return
    }
    if (event.key === 'Escape') {
        setPickerActive(false)
        sendMessage({ type: 'PICKER_ACTIVE_CHANGED', active: false })
    }
}

document.addEventListener('mousemove', onMouseMove, true)
document.addEventListener('click', onClick, true)
document.addEventListener('keydown', onKeyDown, true)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SET_PICKER_ACTIVE') {
        setPickerActive(message.active === true)
        sendResponse({ ok: true, active: pickerActive })
    }
})

sendMessage({ type: 'CONTENT_READY' })
