const OVERLAY_ID = '__sap_selector_picker_overlay__'
const OVERLAY_LABEL_ID = '__sap_selector_picker_overlay_label__'
const TO_RANGE_LABELS = new Set(['-', 'thru', 'through', 'to', 'until'])
const UI5_PROPERTY_CANDIDATES = ['text', 'title', 'value', 'name', 'tooltip', 'icon']
const UI5_RESOLVE_TIMEOUT_MS = 1500

const abapListControlTypes = new Set(['AL'])
const abapListElementControlTypes = new Set(['ALC', 'ALI', 'ALT'])
const boxControlTypes = new Set(['G'])
const buttonControlTypes = new Set(['B', 'IB', 'IMG'])
const cellControlTypes = new Set(['HIC', 'SC', 'STC'])
const checkboxControlTypes = new Set(['C_standards'])
const columnControlTypes = new Set(['HC'])
const comboboxControlTypes = new Set(['CB'])
const expandableSectionControlTypes = new Set(['P'])
const linkControlTypes = new Set(['LN', 'LNC'])
const messageAreaControlTypes = new Set(['MA'])
const messageBarControlTypes = new Set(['MB'])
const modalWindowControlTypes = new Set(['PW', 'PW_standards'])
const menuItemControlTypes = new Set(['POMN', 'POMNI'])
const radioControlTypes = new Set(['R', 'RLI', 'R_standards'])
const tabStripControlTypes = new Set(['HCNP_standards', 'TS_standards'])
const tableControlTypes = new Set(['G', 'ST', 'STCS'])
const textControlTypes = new Set(['ALI', 'ALT', 'DTF', 'L', 'TV'])
const textboxControlTypes = new Set(['CBS', 'CI', 'I', 'TE'])
const candidateControlTypes = new Set([
    ...abapListControlTypes,
    ...abapListElementControlTypes,
    ...boxControlTypes,
    ...buttonControlTypes,
    ...cellControlTypes,
    ...checkboxControlTypes,
    ...columnControlTypes,
    ...comboboxControlTypes,
    ...expandableSectionControlTypes,
    ...linkControlTypes,
    ...messageAreaControlTypes,
    ...messageBarControlTypes,
    ...menuItemControlTypes,
    ...modalWindowControlTypes,
    ...radioControlTypes,
    ...tabStripControlTypes,
    ...tableControlTypes,
    ...textControlTypes,
    ...textboxControlTypes,
])
const roleControlTypes = new Set([
    'button',
    'checkbox',
    'combobox',
    'link',
    'listbox',
    'option',
    'radio',
    'spinbutton',
    'table',
    'tab',
    'textbox',
])
const WEBGUI_SELECTOR_CONTROL_PRIORITY = [
    'textbox',
    'combobox',
    'listbox',
    'spinbutton',
    'checkbox',
    'radio',
    'button',
    'link',
    'option',
    'tab',
    'table',
    'column',
    'cell',
    'text',
    'box',
    'expandablesection',
    'modalwindow',
    'messagearea',
    'messagebar',
    'abaplistelement',
    'abaplist',
    'tabstrip',
]

let pickerActive = false

const normalizeText = (value) =>
    String(value ?? '')
        .replace(/\s+/gu, ' ')
        .trim()

const normalizeForMatch = (value) => normalizeText(value).toLowerCase()

const normalizeLabelText = (value) => {
    const normalized = normalizeText(value).replace(/\u00a0/gu, ' ')
    if (normalized === '') {
        return ''
    }
    return normalized.replace(/\s*:\s*$/u, '').trim()
}

const toCompactLabel = (value, maximumLength = 120) => {
    const normalized = normalizeLabelText(value)
    if (normalized === '' || normalized.length > maximumLength) {
        return undefined
    }
    return normalized
}

const sanitizeSelectorValue = (value) =>
    normalizeText(value).replaceAll(';', ',').replaceAll('\n', ' ')

const escapeWebGuiAttributeValue = (value) =>
    sanitizeSelectorValue(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const formatWebGuiAttribute = (key, value) => `[${key}='${escapeWebGuiAttributeValue(value)}']`

const getWebGuiSelectorControlType = (metadata) => {
    const controlTypes =
        metadata.controlTypes instanceof Set
            ? metadata.controlTypes
            : inferControlTypes(metadata.element, metadata.ct, metadata.role)
    for (const controlType of WEBGUI_SELECTOR_CONTROL_PRIORITY) {
        if (controlTypes.has(controlType)) {
            return controlType
        }
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

const inferControlTypes = (element, ct, role) => {
    const controlTypes = new Set()
    const normalizedRole = normalizeForMatch(role)

    if (roleControlTypes.has(normalizedRole)) {
        controlTypes.add(normalizedRole)
    }
    if (normalizedRole === 'columnheader') {
        controlTypes.add('column')
    }
    if (normalizedRole === 'cell' || normalizedRole === 'gridcell') {
        controlTypes.add('cell')
    }
    if (normalizedRole === 'dialog') {
        controlTypes.add('modalwindow')
    }
    if (normalizedRole === 'tablist') {
        controlTypes.add('tabstrip')
    }
    if (normalizedRole === 'status') {
        controlTypes.add('messagebar')
    }
    if (normalizedRole === 'menuitem' || normalizedRole === 'menuitemradio') {
        controlTypes.add('option')
    }

    if (ct !== undefined) {
        if (abapListControlTypes.has(ct)) {
            controlTypes.add('abaplist')
        }
        if (abapListElementControlTypes.has(ct)) {
            controlTypes.add('abaplistelement')
        }
        if (boxControlTypes.has(ct)) {
            controlTypes.add('box')
        }
        if (buttonControlTypes.has(ct)) {
            controlTypes.add('button')
        }
        if (cellControlTypes.has(ct)) {
            controlTypes.add('cell')
        }
        if (checkboxControlTypes.has(ct)) {
            controlTypes.add('checkbox')
        }
        if (columnControlTypes.has(ct)) {
            controlTypes.add('column')
        }
        if (comboboxControlTypes.has(ct)) {
            controlTypes.add('combobox')
        }
        if (expandableSectionControlTypes.has(ct)) {
            controlTypes.add('expandablesection')
        }
        if (linkControlTypes.has(ct)) {
            controlTypes.add('link')
        }
        if (messageAreaControlTypes.has(ct)) {
            controlTypes.add('messagearea')
        }
        if (messageBarControlTypes.has(ct)) {
            controlTypes.add('messagebar')
        }
        if (menuItemControlTypes.has(ct)) {
            controlTypes.add('option')
        }
        if (modalWindowControlTypes.has(ct)) {
            controlTypes.add('modalwindow')
        }
        if (radioControlTypes.has(ct)) {
            controlTypes.add('radio')
        }
        if (tabStripControlTypes.has(ct)) {
            controlTypes.add('tabstrip')
        }
        if (tableControlTypes.has(ct)) {
            controlTypes.add('table')
        }
        if (textControlTypes.has(ct)) {
            controlTypes.add('text')
        }
        if (textboxControlTypes.has(ct)) {
            controlTypes.add('textbox')
        }
    }

    if (element instanceof HTMLButtonElement) {
        controlTypes.add('button')
    }
    if (element instanceof HTMLTextAreaElement) {
        controlTypes.add('textbox')
    }
    if (element instanceof HTMLSelectElement) {
        if (element.multiple || element.size > 1) {
            controlTypes.add('listbox')
        } else {
            controlTypes.add('combobox')
        }
    }
    if (element instanceof HTMLOptionElement) {
        controlTypes.add('option')
    }
    if (element instanceof HTMLInputElement) {
        const normalizedType = normalizeForMatch(element.type)
        if (normalizedType === 'checkbox') {
            controlTypes.add('checkbox')
        } else if (normalizedType === 'radio') {
            controlTypes.add('radio')
        } else if (normalizedType === 'number') {
            controlTypes.add('spinbutton')
        } else if (
            normalizedType === 'button' ||
            normalizedType === 'image' ||
            normalizedType === 'reset' ||
            normalizedType === 'submit'
        ) {
            controlTypes.add('button')
        } else if (normalizedType !== 'hidden') {
            controlTypes.add('textbox')
        }
    }
    if (element instanceof HTMLAnchorElement) {
        controlTypes.add('link')
    }
    if (element instanceof HTMLTableElement && hasOwnGridEntries(element)) {
        controlTypes.add('table')
    }
    if (normalizedRole === 'table' || normalizedRole === 'grid') {
        controlTypes.add('table')
    }

    return controlTypes
}

const isCandidateElement = (element) => {
    const ct = element.getAttribute('ct') ?? element.getAttribute('subct')
    if (ct !== null && candidateControlTypes.has(ct)) {
        return true
    }

    const role = element.getAttribute('role')
    if (inferControlTypes(element, ct ?? undefined, role ?? undefined).size > 0) {
        return true
    }

    if (normalizeForMatch(role) === 'group') {
        return element.querySelector('table') !== null
    }

    return false
}

const queryElementsInScope = (selector) => Array.from(document.querySelectorAll(selector))

const getCandidateElements = () =>
    queryElementsInScope(
        '[ct],[subct],a,button,input,option,[role="button"],[role="cell"],[role="checkbox"],[role="columnheader"],[role="combobox"],[role="dialog"],[role="grid"],[role="gridcell"],[role="group"],[role="link"],[role="listbox"],[role="menuitem"],[role="menuitemradio"],[role="option"],[role="radio"],[role="spinbutton"],[role="status"],[role="table"],[role="tab"],[role="tablist"],[role="textbox"],select,table,textarea',
    ).filter(isCandidateElement)

const appendLabelCandidate = (labels, seenLabels, value, maximumLength = 120) => {
    const normalized = toCompactLabel(value, maximumLength)
    if (normalized === undefined) {
        return
    }
    const key = normalizeForMatch(normalized)
    if (seenLabels.has(key)) {
        return
    }
    seenLabels.add(key)
    labels.push(normalized)
}

const getLabelTextsForId = (id) =>
    Array.from(document.querySelectorAll(`label[for="${CSS.escape(id)}"]`))
        .map((label) => normalizeLabelText(label.textContent))
        .filter((text) => text !== '')

const getButtonTitleLabel = (title) => {
    if (title === undefined) {
        return undefined
    }
    const withoutShortcut = title.replace(/\s+\([^)]*\)\s*$/u, '')
    return toCompactLabel(withoutShortcut)
}

const getElementTextLabel = (element, maximumLength = 120) => {
    const candidateSelectors = ['label', '[ct="CP"]', 'span']
    for (const selector of candidateSelectors) {
        const candidateElement = element.querySelector(selector)
        if (candidateElement === null) {
            continue
        }
        const text = toCompactLabel(candidateElement.textContent, maximumLength)
        if (text !== undefined) {
            return text
        }
    }
    return toCompactLabel(element.textContent, maximumLength)
}

const getModalWindowLabel = (element) => {
    const modalTitleSelectors = ['.urPWTitleText', '[role="heading"]', '[id$="-title"]']
    for (const selector of modalTitleSelectors) {
        const titleElement = element.querySelector(selector)
        if (titleElement === null) {
            continue
        }
        const titleText = toCompactLabel(titleElement.textContent, 160)
        if (titleText !== undefined) {
            return titleText
        }
    }
    return undefined
}

const getExpandableSectionLabel = (element) => {
    const labelledElement =
        element.querySelector('[aria-label]') ??
        element.querySelector('[aria-labelledby]') ??
        element.querySelector('[title]') ??
        element.querySelector('[role="heading"]')
    if (labelledElement !== null) {
        const attributedLabel = getElementLabelFromAttributes(labelledElement)
        if (attributedLabel !== undefined) {
            return attributedLabel
        }
        const textLabel = toCompactLabel(labelledElement.textContent, 160)
        if (textLabel !== undefined) {
            return textLabel
        }
    }
    return undefined
}

const getTabStripLabels = (tabStripElement) => {
    const tabLabels = []
    const seenLabels = new Set()
    const tabSelectors = ['[action="TAB_ACCESS"]', '[ct="HCNPI_standards"]', '[role="tab"]']
    for (const selector of tabSelectors) {
        tabStripElement
            .querySelectorAll(selector)
            .forEach((tabElement) =>
                appendLabelCandidate(tabLabels, seenLabels, tabElement.textContent, 160),
            )
    }
    return tabLabels
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

    const treeHeaderPatternMatch = id.match(
        /^(?<tableId>tree#.+?)#HierarchyHeader#(?<column>\d+)#header(?:$|[#-])/u,
    )
    if (treeHeaderPatternMatch?.groups !== undefined) {
        const tableId = treeHeaderPatternMatch.groups.tableId
        const column = treeHeaderPatternMatch.groups.column
        if (tableId && column) {
            return {
                tableId,
                row: 0,
                column: Number.parseInt(column, 10),
            }
        }
    }

    const treeNamedHeaderPatternMatch = id.match(
        /^(?<tableId>tree#.+?)#[^#]+#(?<column>\d+)#header(?:$|[#-])/u,
    )
    if (treeNamedHeaderPatternMatch?.groups !== undefined) {
        const tableId = treeNamedHeaderPatternMatch.groups.tableId
        const column = treeNamedHeaderPatternMatch.groups.column
        if (tableId && column) {
            return {
                tableId,
                row: 0,
                column: Number.parseInt(column, 10),
            }
        }
    }

    const treeCellPatternMatch = id.match(
        /^(?<tableId>tree#.+?)#(?<row>\d+)#(?<column>\d+)(?:$|#)/u,
    )
    if (treeCellPatternMatch?.groups !== undefined) {
        const tableId = treeCellPatternMatch.groups.tableId
        const row = treeCellPatternMatch.groups.row
        const column = treeCellPatternMatch.groups.column
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

const hasOwnGridEntries = (tableElement) => {
    const tableId = normalizeText(tableElement.id)
    if (tableId === '') {
        return false
    }
    const tableIdAliases = new Set([tableId, `grid#${tableId}`])
    return Array.from(tableElement.querySelectorAll('[id]')).some((candidate) => {
        const coordinates = getGridCoordinatesFromId(candidate.id)
        return coordinates !== undefined && tableIdAliases.has(coordinates.tableId)
    })
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
    tableId.startsWith('tree#')
        ? row === 0
            ? `${tableId}#HierarchyHeader#${column}#header`
            : `${tableId}#${row}#${column}`
        : tableId.includes('#')
        ? `${tableId}#${row},${column}`
        : `${tableId}[${row},${column}]`

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
        .map((id) => normalizeLabelText(document.getElementById(id)?.textContent))
        .filter((text) => text !== '')

const getElementLabelFromAttributes = (element) => {
    if (!(element instanceof Element)) {
        return undefined
    }

    const ariaLabel = normalizeLabelText(element.getAttribute('aria-label'))
    if (ariaLabel !== '') {
        return ariaLabel
    }

    const ariaLabelledByText = getTextByIdList(element.getAttribute('aria-labelledby'))
    if (ariaLabelledByText.length > 0) {
        return ariaLabelledByText.join(' / ')
    }

    const title = normalizeLabelText(element.getAttribute('title'))
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
        const headingElements = Array.from(tableElement.querySelectorAll(selector)).filter(
            (headingElement) => headingElement.closest('table') === tableElement,
        )
        for (const headingElement of headingElements) {
            const headingText = normalizeText(headingElement.textContent)
            if (headingText !== '') {
                return headingText
            }
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

    return getElementTextLabel(element)
}

const getLabelFromStructuralSiblings = (element) => {
    let currentElement = element
    for (let depth = 0; depth < 5 && currentElement instanceof Element; depth++) {
        let sibling = currentElement.previousElementSibling
        while (sibling instanceof Element) {
            const siblingLabel = getLabelFromSibling(sibling)
            if (siblingLabel !== undefined) {
                return siblingLabel
            }
            sibling = sibling.previousElementSibling
        }
        currentElement = currentElement.parentElement
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

const getAncestorTableLabel = (element) => {
    let currentElement = element.parentElement
    while (currentElement instanceof Element) {
        const ownLabel = getOwnTableLabel(currentElement)
        if (ownLabel !== undefined) {
            return ownLabel
        }
        currentElement = currentElement.parentElement
    }
    return undefined
}

const getElementValue = (element) => {
    if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
    ) {
        const currentValue = normalizeText(element.value)
        if (currentValue !== '') {
            return currentValue
        }
    }

    const valueAttribute = normalizeText(element.getAttribute('value'))
    if (valueAttribute !== '') {
        return valueAttribute
    }

    const ariaValueText = normalizeText(element.getAttribute('aria-valuetext'))
    if (ariaValueText !== '') {
        return ariaValueText
    }

    if (element.tagName !== 'TABLE') {
        const textContent = toCompactLabel(element.textContent, 160)
        if (textContent !== undefined) {
            return textContent
        }
    }
    return undefined
}

const getElementCheckedState = (element) => {
    if (
        element instanceof HTMLInputElement &&
        (element.type === 'checkbox' || element.type === 'radio')
    ) {
        return element.checked
    }

    const ariaChecked = normalizeForMatch(element.getAttribute('aria-checked'))
    if (ariaChecked === 'true' || ariaChecked === 'false') {
        return ariaChecked === 'true'
    }
    return undefined
}

const getTableTitle = (tableId) => {
    const tableIdCandidates = [tableId]
    if (tableId.startsWith('grid#')) {
        tableIdCandidates.push(tableId.slice('grid#'.length))
    }

    for (const tableIdCandidate of tableIdCandidates) {
        const titleElement =
            document.getElementById(`${tableIdCandidate}-title`) ??
            document.getElementById(`${tableIdCandidate}#title`)
        if (titleElement !== null) {
            const titleText = normalizeText(titleElement.textContent)
            if (titleText !== '') {
                return titleText
            }
        }

        const tableElement = document.getElementById(tableIdCandidate)
        if (tableElement !== null) {
            const tableLabel = getNearestTableLabel(tableElement)
            if (tableLabel !== undefined) {
                return tableLabel
            }
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

const addUniqueValue = (values, seenValues, value, maximumLength = 240) => {
    const normalized = toCompactLabel(value, maximumLength)
    if (normalized === undefined) {
        return
    }
    const key = normalizeForMatch(normalized)
    if (seenValues.has(key)) {
        return
    }
    seenValues.add(key)
    values.push(normalized)
}

const getTableGridEntries = (tableElement) => {
    const tableId = normalizeText(tableElement.id)
    if (tableId === '') {
        return []
    }
    const tableIdAliases = new Set([tableId, `grid#${tableId}`])

    const gridEntries = []
    tableElement.querySelectorAll('[id]').forEach((candidate) => {
        const coordinates = getGridCoordinatesFromId(candidate.id)
        if (coordinates === undefined || !tableIdAliases.has(coordinates.tableId)) {
            return
        }
        gridEntries.push({
            coordinates,
            element: candidate,
        })
    })
    return gridEntries
}

const getTableColumnHeaders = (tableElement) => {
    const headersByColumn = new Map()
    const gridEntries = getTableGridEntries(tableElement)
    gridEntries
        .filter((entry) => entry.coordinates.row === 0)
        .forEach((entry) => {
            if (headersByColumn.has(entry.coordinates.column)) {
                return
            }
            const headerText =
                getCurrentHeaderText(entry.element) ??
                toCompactLabel(entry.element.getAttribute('title'), 200) ??
                toCompactLabel(entry.element.textContent, 200)
            if (headerText !== undefined) {
                headersByColumn.set(entry.coordinates.column, headerText)
            }
        })

    const sortedHeaders = [...headersByColumn.entries()]
        .sort(([leftColumn], [rightColumn]) => leftColumn - rightColumn)
        .map(([, text]) => text)
    if (sortedHeaders.length > 0) {
        return sortedHeaders
    }

    const fallbackHeaders = []
    const seenHeaders = new Set()
    tableElement
        .querySelectorAll('[role="columnheader"],th')
        .forEach((headerElement) =>
            addUniqueValue(
                fallbackHeaders,
                seenHeaders,
                getCurrentHeaderText(headerElement) ??
                    toCompactLabel(headerElement.getAttribute('title'), 200) ??
                    toCompactLabel(headerElement.textContent, 200),
                200,
            ),
        )
    return fallbackHeaders
}

const getTableCellValues = (tableElement) => {
    const values = []
    const seenValues = new Set()
    const gridEntries = getTableGridEntries(tableElement)
    gridEntries
        .filter((entry) => entry.coordinates.row > 0)
        .forEach((entry) => {
            addUniqueValue(values, seenValues, entry.element.getAttribute('title'))
            addUniqueValue(values, seenValues, getElementValue(entry.element))
            entry.element
                .querySelectorAll('input,textarea,select')
                .forEach((field) => addUniqueValue(values, seenValues, getElementValue(field)))
        })

    if (values.length > 0) {
        return values
    }

    tableElement
        .querySelectorAll('[role="gridcell"],td,[ct="SC"],[ct="STC"],[ct="HIC"]')
        .forEach((cellElement) => {
            addUniqueValue(values, seenValues, cellElement.getAttribute('title'))
            addUniqueValue(values, seenValues, getElementValue(cellElement))
            cellElement
                .querySelectorAll('input,textarea,select')
                .forEach((field) => addUniqueValue(values, seenValues, getElementValue(field)))
        })

    return values
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
    if (metadata.value) {
        return metadata.value
    }
    if (metadata.id) {
        return `id:${metadata.id}`
    }
    return 'unnamed'
}

const getLabelCandidatesForElement = (element, controlTypes, title) => {
    const labels = []
    const seenLabels = new Set()
    const id = normalizeText(element.id)
    if (id !== '') {
        getLabelTextsForId(id).forEach((labelText) =>
            appendLabelCandidate(labels, seenLabels, labelText),
        )
    }

    if (
        controlTypes.has('textbox') ||
        controlTypes.has('combobox') ||
        controlTypes.has('listbox') ||
        controlTypes.has('spinbutton')
    ) {
        appendLabelCandidate(labels, seenLabels, getLabelFromStructuralSiblings(element))
    }

    if (
        controlTypes.has('button') ||
        controlTypes.has('checkbox') ||
        controlTypes.has('link') ||
        controlTypes.has('option') ||
        controlTypes.has('radio') ||
        controlTypes.has('tab') ||
        controlTypes.has('abaplistelement') ||
        controlTypes.has('box') ||
        controlTypes.has('cell') ||
        controlTypes.has('column') ||
        controlTypes.has('text')
    ) {
        appendLabelCandidate(labels, seenLabels, getElementTextLabel(element, 160), 160)
    }
    if (controlTypes.has('button')) {
        appendLabelCandidate(labels, seenLabels, getButtonTitleLabel(title), 160)
    }
    if (controlTypes.has('expandablesection')) {
        appendLabelCandidate(labels, seenLabels, getExpandableSectionLabel(element), 160)
    }
    if (controlTypes.has('modalwindow')) {
        appendLabelCandidate(labels, seenLabels, getModalWindowLabel(element), 160)
    }
    if (controlTypes.has('tabstrip')) {
        getTabStripLabels(element).forEach((tabLabel) =>
            appendLabelCandidate(labels, seenLabels, tabLabel, 160),
        )
    }
    if (controlTypes.has('table')) {
        appendLabelCandidate(labels, seenLabels, getOwnTableLabel(element), 160)
    }
    appendLabelCandidate(labels, seenLabels, getElementLabelFromAttributes(element), 160)

    return labels
}

const createElementMetadata = () => {
    const metadataList = getCandidateElements().map((element) => {
        const id = normalizeText(element.id) || undefined
        const ct = element.getAttribute('ct') ?? element.getAttribute('subct') ?? undefined
        const role = element.getAttribute('role') ?? undefined
        const title = normalizeText(element.getAttribute('title')) || undefined
        const ariaLabel = normalizeLabelText(element.getAttribute('aria-label')) || undefined
        const controlTypes = inferControlTypes(element, ct, role)
        const labelCandidates = getLabelCandidatesForElement(element, controlTypes, title)
        const tabLabels = controlTypes.has('tabstrip') ? getTabStripLabels(element) : []
        const tableContext = getTableContext(element)
        const ownTableLabel = controlTypes.has('table')
            ? getOwnTableLabel(element) ??
              (ct !== undefined ? getAncestorTableLabel(element) : undefined)
            : undefined
        const tableColumnHeaders = controlTypes.has('table') ? getTableColumnHeaders(element) : []
        const tableCellValues = controlTypes.has('table') ? getTableCellValues(element) : []
        if (ownTableLabel !== undefined && tableContext.tableLabel === undefined) {
            tableContext.tableLabel = ownTableLabel
        }
        if (ownTableLabel !== undefined && tableContext.composedLabel === undefined) {
            tableContext.composedLabel = ownTableLabel
        }
        return {
            element,
            id,
            ct,
            role,
            controlTypes,
            title,
            ariaLabel,
            directLabel: labelCandidates[0],
            labelCandidates,
            value: getElementValue(element),
            checked: getElementCheckedState(element),
            tableColumnHeaders,
            tableCellValues,
            tabLabels,
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

const addSelectorEntry = (selectors, entry) => {
    const value = normalizeText(entry?.value)
    if (value === '') {
        return
    }
    const selectorEntry = {
        label: normalizeText(entry.label),
        value,
    }
    if (entry.kind) {
        selectorEntry.kind = entry.kind
    }
    selectors.push(selectorEntry)
}

const getUniqueLabelCandidates = (metadata, maximumCandidates = 3) => {
    const labels = []
    const seenLabels = new Set()
    for (const candidate of metadata.labelCandidates ?? []) {
        const labelText = normalizeText(candidate)
        if (labelText === '' || isToRangeLabel(labelText)) {
            continue
        }
        const key = normalizeForMatch(labelText)
        if (seenLabels.has(key)) {
            continue
        }
        seenLabels.add(key)
        labels.push(labelText)
        if (labels.length >= maximumCandidates) {
            break
        }
    }
    return labels
}

const getChainTargetSelector = (metadata) => {
    if (metadata.groupLabel && metadata.rangePart) {
        return formatWebGuiSelector(metadata, [
            { key: 'group', value: metadata.groupLabel },
            { key: 'part', value: metadata.rangePart },
        ])
    }

    const labelCandidate = getUniqueLabelCandidates(metadata, 1)[0]
    if (labelCandidate) {
        return formatWebGuiSelector(metadata, [{ key: 'label', value: labelCandidate }])
    }
    if (metadata.value) {
        return formatWebGuiSelector(metadata, [{ key: 'value', value: metadata.value }])
    }
    if (metadata.title) {
        return formatWebGuiSelector(metadata, [{ key: 'title', value: metadata.title }])
    }
    if (metadata.id) {
        return formatWebGuiSelector(metadata, [{ key: 'id', value: metadata.id }])
    }

    return formatWebGuiSelectorByType(getWebGuiSelectorControlType(metadata), [])
}

const escapeForDoubleQuotedSnippet = (value) =>
    String(value ?? '')
        .replaceAll('\\', '\\\\')
        .replaceAll('"', '\\"')

const formatLocatorChainSnippet = (parentSelector, childSelector) =>
    `page.locator("${escapeForDoubleQuotedSnippet(
        parentSelector,
    )}").locator("${escapeForDoubleQuotedSnippet(childSelector)}")`

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
    const controlTypes = metadata.controlTypes instanceof Set ? metadata.controlTypes : new Set()
    const isTableControl = controlTypes.has('table')
    const labelCandidates = getUniqueLabelCandidates(metadata)
    const tableSelector = metadata.tableContext.tableLabel
        ? formatWebGuiSelectorByType('table', [
              { key: 'label', value: metadata.tableContext.tableLabel },
          ])
        : undefined
    const tableWildcardSelector = metadata.tableContext.tableLabel
        ? formatWebGuiWildcardSelector([{ key: 'table', value: metadata.tableContext.tableLabel }])
        : undefined
    const rowContextSelector =
        metadata.tableContext.tableLabel && metadata.tableContext.rowLabel
            ? formatWebGuiWildcardSelector([
                  { key: 'table', value: metadata.tableContext.tableLabel },
                  { key: 'row', value: metadata.tableContext.rowLabel },
              ])
            : undefined

    if (metadata.groupLabel && metadata.rangePart) {
        addSelectorEntry(selectors, {
            label: 'WebGUI grouped range',
            value: formatWebGuiSelector(metadata, [
                { key: 'group', value: metadata.groupLabel },
                { key: 'part', value: metadata.rangePart },
            ]),
            kind: 'user-facing',
        })
        addSelectorEntry(selectors, {
            label: 'WebGUI grouped range (both fields)',
            value: formatWebGuiSelector(metadata, [{ key: 'group', value: metadata.groupLabel }]),
            kind: 'user-facing',
        })
    }
    for (const [index, labelCandidate] of labelCandidates.entries()) {
        addSelectorEntry(selectors, {
            label: index === 0 ? 'WebGUI label' : 'WebGUI label (alternative)',
            value: formatWebGuiSelector(metadata, [{ key: 'label', value: labelCandidate }]),
            kind: 'user-facing',
        })
    }
    if (metadata.value && !isTableControl) {
        addSelectorEntry(selectors, {
            label: 'WebGUI value',
            value: formatWebGuiSelector(metadata, [{ key: 'value', value: metadata.value }]),
            kind: 'user-facing',
        })
    }
    if (
        metadata.checked !== undefined &&
        (controlTypes.has('checkbox') || controlTypes.has('radio'))
    ) {
        addSelectorEntry(selectors, {
            label: 'WebGUI checked state',
            value: formatWebGuiSelector(metadata, [
                { key: 'checked', value: metadata.checked ? 'true' : 'false' },
            ]),
            kind: 'user-facing',
        })
    }
    if (
        metadata.tableContext.tableLabel &&
        metadata.tableContext.rowLabel &&
        metadata.tableContext.columnLabel
    ) {
        addSelectorEntry(selectors, {
            label: 'WebGUI table context fallback',
            value: formatWebGuiSelector(metadata, [
                { key: 'table', value: metadata.tableContext.tableLabel },
                { key: 'row', value: metadata.tableContext.rowLabel },
                { key: 'column', value: metadata.tableContext.columnLabel },
            ]),
            kind: 'table-context',
        })
    }
    if (isTableControl && tableSelector) {
        addSelectorEntry(selectors, {
            label: 'WebGUI table by label',
            value: tableSelector,
            kind: 'user-facing',
        })
    } else if (tableSelector) {
        addSelectorEntry(selectors, {
            label: 'Table context: resolved parent table selector',
            value: tableSelector,
            kind: 'table-context',
        })
    }
    if (tableWildcardSelector) {
        addSelectorEntry(selectors, {
            label: 'Table context: parent table wildcard',
            value: tableWildcardSelector,
            kind: 'table-context',
        })
    }
    if (rowContextSelector) {
        addSelectorEntry(selectors, {
            label: 'Table context: parent row wildcard',
            value: rowContextSelector,
            kind: 'table-context',
        })
    }
    if (isTableControl) {
        for (const columnHeader of metadata.tableColumnHeaders.slice(0, 3)) {
            addSelectorEntry(selectors, {
                label: 'WebGUI table by column header',
                value: formatWebGuiSelectorByType('table', [
                    { key: 'column', value: columnHeader },
                ]),
                kind: 'user-facing',
            })
        }
        for (const cellValue of metadata.tableCellValues.slice(0, 3)) {
            addSelectorEntry(selectors, {
                label: 'WebGUI table by cell value',
                value: formatWebGuiSelectorByType('table', [{ key: 'cell', value: cellValue }]),
                kind: 'user-facing',
            })
        }
    } else if (tableSelector) {
        const targetSelector = getChainTargetSelector(metadata)
        addSelectorEntry(selectors, {
            label: 'Locator chain: target selector (inside table)',
            value: targetSelector,
            kind: 'chain',
        })
        addSelectorEntry(selectors, {
            label: 'Locator chain example (table -> target)',
            value: formatLocatorChainSnippet(tableSelector, targetSelector),
            kind: 'chain',
        })
        if (rowContextSelector) {
            addSelectorEntry(selectors, {
                label: 'Locator chain example (row -> target)',
                value: formatLocatorChainSnippet(rowContextSelector, targetSelector),
                kind: 'chain',
            })
        }
    }
    if (metadata.title) {
        addSelectorEntry(selectors, {
            label: 'WebGUI title fallback',
            value: formatWebGuiSelector(metadata, [{ key: 'title', value: metadata.title }]),
            kind: 'fallback',
        })
    }
    if (metadata.id) {
        addSelectorEntry(selectors, {
            label: 'WebGUI id fallback',
            value: formatWebGuiSelector(metadata, [{ key: 'id', value: metadata.id }]),
            kind: 'fallback',
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
