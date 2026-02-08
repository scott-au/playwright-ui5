import type { SelectorEngine } from '../common/types'
import { Ui5SelectorEngineError } from './common'

type RangePart = 'from' | 'to'
type WebGuiControlType =
    | 'button'
    | 'checkbox'
    | 'combobox'
    | 'link'
    | 'listbox'
    | 'option'
    | 'radio'
    | 'spinbutton'
    | 'table'
    | 'textbox'

interface SelectorCriteria {
    controlType?: WebGuiControlType
    label?: string
    group?: string
    table?: string
    row?: string
    column?: string
    id?: string
    title?: string
    role?: string
    value?: string
    checked?: boolean
    part?: RangePart
    index?: number
}

interface TableContext {
    tableLabel: string | undefined
    rowLabel: string | undefined
    columnLabel: string | undefined
    composedLabel: string | undefined
}

interface ElementMetadata {
    element: Element
    id: string | undefined
    ct: string | undefined
    role: string | undefined
    value: string | undefined
    checked: boolean | undefined
    title: string | undefined
    ariaLabel: string | undefined
    directLabel: string | undefined
    tableContext: TableContext
    rowKey: string | undefined
    rangePart: RangePart | undefined
    groupLabel: string | undefined
    displayLabel: string
}

interface TableCoordinates {
    tableId: string
    row: number
    column: number
}

const interactiveControlTypes = new Set([
    'B',
    'CB',
    'CBS',
    'CI',
    'IMG',
    'LN',
    'LNC',
    'R',
    'RLI',
    'R_standards',
    'TV',
])

const interactiveRoles = new Set([
    'button',
    'checkbox',
    'combobox',
    'listbox',
    'option',
    'radio',
    'spinbutton',
    'textbox',
])

const normalizeText = (value: string | null | undefined) =>
    value?.replace(/\s+/gu, ' ').trim() ?? ''

const normalizeForMatch = (value: string | null | undefined) => normalizeText(value).toLowerCase()

const supportedSelectorKeys = new Set([
    'checked',
    'column',
    'group',
    'id',
    'index',
    'label',
    'part',
    'role',
    'row',
    'table',
    'title',
    'value',
])
const supportedSelectorKeysMessage = [...supportedSelectorKeys].join(', ')

const supportedControlTypes = new Set([
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
const supportedControlTypesMessage = [...supportedControlTypes].join(', ')

const unquote = (value: string) => {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1)
    }
    return value
}

const findCharacterOutsideQuotes = (value: string, expectedCharacter: string) => {
    let insideSingleQuotes = false
    let insideDoubleQuotes = false
    let escaped = false

    for (let index = 0; index < value.length; index++) {
        const character = value[index]
        if (character === undefined) {
            continue
        }
        if (escaped) {
            escaped = false
            continue
        }
        if (character === '\\') {
            escaped = true
            continue
        }
        if (character === "'" && !insideDoubleQuotes) {
            insideSingleQuotes = !insideSingleQuotes
            continue
        }
        if (character === '"' && !insideSingleQuotes) {
            insideDoubleQuotes = !insideDoubleQuotes
            continue
        }
        if (!insideSingleQuotes && !insideDoubleQuotes && character === expectedCharacter) {
            return index
        }
    }
    return -1
}

const findClosingBracket = (value: string, openingBracketIndex: number) => {
    let insideSingleQuotes = false
    let insideDoubleQuotes = false
    let escaped = false

    for (let index = openingBracketIndex + 1; index < value.length; index++) {
        const character = value[index]
        if (character === undefined) {
            continue
        }
        if (escaped) {
            escaped = false
            continue
        }
        if (character === '\\') {
            escaped = true
            continue
        }
        if (character === "'" && !insideDoubleQuotes) {
            insideSingleQuotes = !insideSingleQuotes
            continue
        }
        if (character === '"' && !insideSingleQuotes) {
            insideDoubleQuotes = !insideDoubleQuotes
            continue
        }
        if (!insideSingleQuotes && !insideDoubleQuotes && character === ']') {
            return index
        }
    }
    return -1
}

const unescapeQuotedValue = (value: string, quote: '"' | "'") => {
    let result = ''
    let escaped = false

    for (let index = 0; index < value.length; index++) {
        const character = value[index]
        if (character === undefined) {
            continue
        }
        if (escaped) {
            if (character === quote || character === '\\') {
                result += character
            } else {
                result += `\\${character}`
            }
            escaped = false
            continue
        }
        if (character === '\\') {
            escaped = true
            continue
        }
        result += character
    }
    if (escaped) {
        result += '\\'
    }
    return result
}

const parseSelectorValue = (key: string, value: string) => {
    const trimmedValue = value.trim()
    if (trimmedValue === '') {
        throw new Error(`selector value for "${key}" is empty`)
    }

    const firstCharacter = trimmedValue[0]
    const lastCharacter = trimmedValue[trimmedValue.length - 1]
    if (
        (firstCharacter === "'" || firstCharacter === '"') &&
        lastCharacter === firstCharacter &&
        trimmedValue.length >= 2
    ) {
        return unescapeQuotedValue(trimmedValue.slice(1, -1), firstCharacter)
    }
    if ((firstCharacter === "'" || firstCharacter === '"') && lastCharacter !== firstCharacter) {
        throw new Error(`selector value for "${key}" has mismatched quotes`)
    }

    return unquote(trimmedValue)
}

const parseControlType = (value: string): WebGuiControlType | undefined => {
    const normalizedValue = normalizeForMatch(value)
    if (normalizedValue === '*') {
        return undefined
    }
    if (supportedControlTypes.has(normalizedValue)) {
        return normalizedValue as WebGuiControlType
    }
    throw new Error(
        `unsupported webgui control type "${value}". supported control types: *, ${supportedControlTypesMessage}`,
    )
}

const applySelectorCriterion = (criteria: SelectorCriteria, key: string, value: string) => {
    if (value === '') {
        throw new Error(`selector value for "${key}" is empty`)
    }

    if (key === 'index') {
        const parsedIndex = Number.parseInt(value, 10)
        if (!Number.isInteger(parsedIndex) || parsedIndex < 1) {
            throw new Error(`index must be a positive integer, received "${value}"`)
        }
        criteria.index = parsedIndex
        return
    }

    if (key === 'checked') {
        const normalizedValue = normalizeForMatch(value)
        if (normalizedValue === 'true' || normalizedValue === 'false') {
            criteria.checked = normalizedValue === 'true'
            return
        }
        throw new Error(`checked must be "true" or "false", received "${value}"`)
    }

    if (key === 'part') {
        const part = normalizeForMatch(value)
        if (part === 'from' || part === 'to') {
            criteria.part = part
            return
        }
        throw new Error(`part must be "from" or "to", received "${value}"`)
    }

    if (
        key === 'column' ||
        key === 'group' ||
        key === 'id' ||
        key === 'label' ||
        key === 'role' ||
        key === 'row' ||
        key === 'table' ||
        key === 'title' ||
        key === 'value'
    ) {
        criteria[key] = value
        return
    }

    throw new Error(
        `unsupported webgui selector key "${key}". supported keys: ${supportedSelectorKeysMessage}`,
    )
}

const parseCssInspiredSelector = (selector: string): SelectorCriteria => {
    const openingBracketIndex = selector.indexOf('[')

    const criteria: SelectorCriteria = {}
    if (openingBracketIndex === -1) {
        const controlType = parseControlType(selector)
        if (controlType !== undefined) {
            criteria.controlType = controlType
        }
        return criteria
    }

    const typeSegment = selector.slice(0, openingBracketIndex).trim()
    if (typeSegment !== '') {
        const controlType = parseControlType(typeSegment)
        if (controlType !== undefined) {
            criteria.controlType = controlType
        }
    }

    let currentIndex = openingBracketIndex
    while (currentIndex < selector.length) {
        while (selector[currentIndex]?.trim() === '') {
            currentIndex++
        }
        if (currentIndex >= selector.length) {
            break
        }
        if (selector[currentIndex] !== '[') {
            throw new Error(
                `invalid webgui css-like selector "${selector}". expected "[" at position ${
                    currentIndex + 1
                }`,
            )
        }

        const closingBracketIndex = findClosingBracket(selector, currentIndex)
        if (closingBracketIndex === -1) {
            throw new Error(
                `invalid webgui css-like selector "${selector}". missing closing "]" for attribute`,
            )
        }

        const attribute = selector.slice(currentIndex + 1, closingBracketIndex).trim()
        if (attribute === '') {
            throw new Error(
                `invalid webgui css-like selector "${selector}". empty attribute selector "[]" is not supported`,
            )
        }

        const separatorIndex = findCharacterOutsideQuotes(attribute, '=')
        if (separatorIndex === -1) {
            throw new Error(
                `invalid webgui css-like attribute "${attribute}". expected "key=value"`,
            )
        }

        const key = attribute.slice(0, separatorIndex).trim().toLowerCase()
        if (key === '') {
            throw new Error(
                `invalid webgui css-like attribute "${attribute}". selector key cannot be empty`,
            )
        }
        if (!supportedSelectorKeys.has(key)) {
            throw new Error(
                `unsupported webgui selector key "${key}". supported keys: ${supportedSelectorKeysMessage}`,
            )
        }

        const value = parseSelectorValue(key, attribute.slice(separatorIndex + 1))
        applySelectorCriterion(criteria, key, value)
        currentIndex = closingBracketIndex + 1
    }

    return criteria
}

const parseSelector = (selector: string): SelectorCriteria => {
    const trimmedSelector = selector.trim()
    if (trimmedSelector === '') {
        throw new Error('webgui selector is empty')
    }

    return parseCssInspiredSelector(trimmedSelector)
}

const getDocument = (root: Element | Document) =>
    root instanceof Document ? root : root.ownerDocument

const isWebGui = (root: Element | Document) => {
    const document = getDocument(root)
    if (document.documentElement.hasAttribute('data-sap-ls-system-runtimeversion')) {
        return true
    }
    return document.querySelector('[ct="PAGE"]') !== null
}

const isCandidateElement = (element: Element) => {
    const ct = element.getAttribute('ct')
    if (ct !== null && interactiveControlTypes.has(ct)) {
        return true
    }

    const role = element.getAttribute('role')
    if (role !== null && interactiveRoles.has(role)) {
        return true
    }

    const tagName = element.tagName
    if (tagName === 'INPUT') {
        return (element as HTMLInputElement).type !== 'hidden'
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

const queryElementsInScope = (root: Element | Document, selector: string): Element[] => {
    const result = new Set<Element>()
    if (root instanceof Element && root.matches(selector)) {
        result.add(root)
    }
    root.querySelectorAll(selector).forEach((element) => result.add(element))
    return [...result]
}

const getCandidateElements = (root: Element | Document) =>
    queryElementsInScope(
        root,
        '[ct],a,button,input,[role="button"],[role="checkbox"],[role="combobox"],[role="grid"],[role="group"],[role="listbox"],[role="option"],[role="radio"],[role="spinbutton"],[role="table"],[role="textbox"],select,table,textarea',
    ).filter(isCandidateElement)

const getLabelTextsForId = (document: Document, id: string) =>
    Array.from(document.querySelectorAll(`label[for="${CSS.escape(id)}"]`))
        .map((label) => normalizeText(label.textContent))
        .filter((labelText) => labelText !== '')

const getPrimaryLabelForElement = (document: Document, id: string | undefined) => {
    if (id === undefined) {
        return undefined
    }
    return getLabelTextsForId(document, id)[0]
}

const getElementValue = (element: Element) => {
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
    return ariaValueText === '' ? undefined : ariaValueText
}

const getElementCheckedState = (element: Element) => {
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

const getGridCoordinatesFromId = (id: string): TableCoordinates | undefined => {
    const bracketPatternMatch = id.match(/^(?<tableId>[^[]+)\[(?<row>\d+),(?<column>\d+)\]/u)
    if (bracketPatternMatch?.groups !== undefined) {
        const tableId = bracketPatternMatch.groups['tableId']
        const row = bracketPatternMatch.groups['row']
        const column = bracketPatternMatch.groups['column']
        if (tableId === undefined || row === undefined || column === undefined) {
            return undefined
        }
        return {
            tableId,
            row: Number.parseInt(row, 10),
            column: Number.parseInt(column, 10),
        }
    }

    const hashPatternMatch = id.match(/^(?<tableId>.+?)#(?<row>\d+),(?<column>\d+)(?:#|$)/u)
    if (hashPatternMatch?.groups !== undefined) {
        const tableId = hashPatternMatch.groups['tableId']
        const row = hashPatternMatch.groups['row']
        const column = hashPatternMatch.groups['column']
        if (tableId === undefined || row === undefined || column === undefined) {
            return undefined
        }
        return {
            tableId,
            row: Number.parseInt(row, 10),
            column: Number.parseInt(column, 10),
        }
    }

    return undefined
}

const getCoordinatesForElement = (element: Element): TableCoordinates | undefined => {
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

const getCellId = (tableId: string, row: number, column: number) =>
    tableId.includes('#') ? `${tableId}#${row},${column}` : `${tableId}[${row},${column}]`

const getCurrentHeaderText = (headerCell: Element | null) => {
    if (headerCell === null) {
        return undefined
    }
    const currentLabel =
        headerCell.querySelector('.lsSTHCCPContentCurrent') ?? headerCell.querySelector('[ct="CP"]')
    if (currentLabel !== null) {
        const labelText = normalizeText(currentLabel.textContent)
        if (labelText !== '') {
            return labelText
        }
    }
    const headerText = normalizeText(headerCell.textContent)
    return headerText === '' ? undefined : headerText
}

const getTextFromIdList = (document: Document, idList: string | null) =>
    normalizeText(idList)
        .split(/\s+/u)
        .filter((id) => id !== '')
        .map((id) => normalizeText(document.getElementById(id)?.textContent))
        .filter((text) => text !== '')

const getElementLabelFromAttributes = (document: Document, element: Element | null) => {
    if (element === null) {
        return undefined
    }

    const ariaLabel = normalizeText(element.getAttribute('aria-label'))
    if (ariaLabel !== '') {
        return ariaLabel
    }

    const ariaLabelledByText = getTextFromIdList(document, element.getAttribute('aria-labelledby'))
    if (ariaLabelledByText.length > 0) {
        return ariaLabelledByText.join(' / ')
    }

    const title = normalizeText(element.getAttribute('title'))
    if (title !== '') {
        return title
    }

    return undefined
}

const getGroupHeaderText = (groupElement: Element) => {
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

const getTableHeadingText = (tableElement: Element) => {
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

const getOwnTableLabel = (document: Document, element: Element) => {
    const explicitLabel = getElementLabelFromAttributes(document, element)
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

const getLabelFromSibling = (document: Document, element: Element | null) => {
    if (element === null) {
        return undefined
    }

    const explicitLabel = getElementLabelFromAttributes(document, element)
    if (explicitLabel !== undefined) {
        return explicitLabel
    }

    const siblingText = normalizeText(element.textContent)
    if (siblingText !== '' && siblingText.length <= 120) {
        return siblingText
    }

    return undefined
}

const getNearestTableLabel = (document: Document, element: Element) => {
    let currentElement: Element | null = element
    while (currentElement !== null) {
        const ownLabel = getOwnTableLabel(document, currentElement)
        if (ownLabel !== undefined) {
            return ownLabel
        }

        const siblingLabel = getLabelFromSibling(document, currentElement.previousElementSibling)
        if (siblingLabel !== undefined) {
            return siblingLabel
        }

        currentElement = currentElement.parentElement
    }
    return undefined
}

const getTableTitle = (document: Document, tableId: string) => {
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
        const tableLabel = getNearestTableLabel(document, tableElement)
        if (tableLabel !== undefined) {
            return tableLabel
        }
    }

    return undefined
}

const getTableContext = (document: Document, element: Element): TableContext => {
    const coordinates = getCoordinatesForElement(element)
    if (coordinates === undefined) {
        return {
            columnLabel: undefined,
            composedLabel: undefined,
            rowLabel: undefined,
            tableLabel: undefined,
        }
    }

    const columnHeader = getCurrentHeaderText(
        document.getElementById(getCellId(coordinates.tableId, 0, coordinates.column)),
    )
    const rowHeader = getCurrentHeaderText(
        document.getElementById(getCellId(coordinates.tableId, coordinates.row, 1)) ??
            document.getElementById(getCellId(coordinates.tableId, coordinates.row, 0)),
    )
    const tableTitle = getTableTitle(document, coordinates.tableId)

    const labelParts = [tableTitle, rowHeader, columnHeader].filter(
        (labelPart): labelPart is string => labelPart !== undefined && labelPart !== '',
    )

    return {
        columnLabel: columnHeader,
        rowLabel: rowHeader,
        tableLabel: tableTitle,
        composedLabel: labelParts.length === 0 ? undefined : labelParts.join(' / '),
    }
}

const isToRangeLabel = (label: string | undefined) =>
    ['-', 'thru', 'through', 'to', 'until'].includes(normalizeForMatch(label))

const applyRangeGrouping = (metadata: ElementMetadata[]) => {
    const metadataByRow = new Map<string, ElementMetadata[]>()
    metadata.forEach((item) => {
        if (item.rowKey === undefined) {
            return
        }
        const rowMetadata = metadataByRow.get(item.rowKey)
        if (rowMetadata === undefined) {
            metadataByRow.set(item.rowKey, [item])
            return
        }
        rowMetadata.push(item)
    })

    metadataByRow.forEach((rowMetadata) => {
        const labelledItems = rowMetadata.filter((item) => item.directLabel !== undefined)
        for (let index = 0; index < labelledItems.length - 1; index++) {
            const currentItem = labelledItems[index]
            const nextItem = labelledItems[index + 1]
            if (currentItem === undefined || nextItem === undefined) {
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

const createDisplayLabel = (item: ElementMetadata) => {
    if (item.groupLabel !== undefined && item.rangePart !== undefined) {
        return `${item.groupLabel} (${item.rangePart})`
    }
    if (item.directLabel !== undefined) {
        return item.directLabel
    }
    if (item.tableContext.composedLabel !== undefined) {
        return item.tableContext.composedLabel
    }
    if (item.title !== undefined) {
        return item.title
    }
    if (item.ariaLabel !== undefined) {
        return item.ariaLabel
    }
    if (item.value !== undefined) {
        return item.value
    }
    if (item.id !== undefined) {
        return `id:${item.id}`
    }
    return 'unnamed'
}

const createElementMetadata = (root: Element | Document) => {
    const document = getDocument(root)
    const metadata = getCandidateElements(root).map((element) => {
        const id = normalizeText(element.id) || undefined
        const title = normalizeText(element.getAttribute('title')) || undefined
        const ariaLabel = normalizeText(element.getAttribute('aria-label')) || undefined
        const tableContext = getTableContext(document, element)
        const ownTableLabel = getOwnTableLabel(document, element)
        if (ownTableLabel !== undefined && tableContext.tableLabel === undefined) {
            tableContext.tableLabel = ownTableLabel
        }
        if (ownTableLabel !== undefined && tableContext.composedLabel === undefined) {
            tableContext.composedLabel = ownTableLabel
        }
        return {
            ariaLabel,
            checked: getElementCheckedState(element),
            ct: element.getAttribute('ct') ?? undefined,
            directLabel: getPrimaryLabelForElement(document, id),
            displayLabel: '',
            element,
            groupLabel: undefined,
            id,
            rangePart: undefined,
            role: element.getAttribute('role') ?? undefined,
            rowKey: element.closest('tr')?.id ?? undefined,
            tableContext,
            title,
            value: getElementValue(element),
        } as ElementMetadata
    })
    applyRangeGrouping(metadata)
    metadata.forEach((item) => {
        item.displayLabel = createDisplayLabel(item)
    })
    return metadata
}

const matchesText = (actual: string | undefined, expected: string | undefined) =>
    expected === undefined || normalizeForMatch(actual).includes(normalizeForMatch(expected))

const matchesTextExactly = (actual: string | undefined, expected: string | undefined) =>
    expected === undefined || normalizeForMatch(actual) === normalizeForMatch(expected)

const matchesLabel = (item: ElementMetadata, label: string | undefined, exactMatch: boolean) => {
    if (label === undefined) {
        return true
    }
    return [
        item.displayLabel,
        item.directLabel,
        item.groupLabel,
        item.tableContext.composedLabel,
        item.title,
        item.ariaLabel,
    ].some((candidate) =>
        exactMatch ? matchesTextExactly(candidate, label) : matchesText(candidate, label),
    )
}

const matchesControlType = (item: ElementMetadata, controlType: WebGuiControlType | undefined) => {
    if (controlType === undefined) {
        return true
    }

    const controlTypes = new Set<WebGuiControlType>()
    const normalizedRole = normalizeForMatch(item.role)
    if (supportedControlTypes.has(normalizedRole)) {
        controlTypes.add(normalizedRole as WebGuiControlType)
    }

    if (item.ct === 'B' || item.ct === 'IMG') {
        controlTypes.add('button')
    }
    if (item.ct === 'CB' || item.ct === 'CBS') {
        controlTypes.add('checkbox')
    }
    if (item.ct === 'CI') {
        controlTypes.add('textbox')
    }
    if (item.ct === 'LN' || item.ct === 'LNC') {
        controlTypes.add('link')
    }
    if (item.ct === 'R' || item.ct === 'R_standards' || item.ct === 'RLI') {
        controlTypes.add('radio')
    }
    if (item.ct === 'TV') {
        controlTypes.add('listbox')
    }
    if (item.ct === 'G' || item.ct === 'STCS') {
        controlTypes.add('table')
    }

    if (item.element instanceof HTMLButtonElement) {
        controlTypes.add('button')
    }
    if (item.element instanceof HTMLTextAreaElement) {
        controlTypes.add('textbox')
    }
    if (item.element instanceof HTMLSelectElement) {
        if (item.element.multiple || item.element.size > 1) {
            controlTypes.add('listbox')
        } else {
            controlTypes.add('combobox')
        }
    }
    if (item.element instanceof HTMLInputElement) {
        const normalizedType = normalizeForMatch(item.element.type)
        if (normalizedType === 'checkbox') {
            controlTypes.add('checkbox')
        } else if (normalizedType === 'radio') {
            controlTypes.add('radio')
        } else if (
            normalizedType === 'button' ||
            normalizedType === 'image' ||
            normalizedType === 'reset' ||
            normalizedType === 'submit'
        ) {
            controlTypes.add('button')
        } else {
            controlTypes.add('textbox')
        }
    }
    if (item.element instanceof HTMLAnchorElement) {
        controlTypes.add('link')
    }
    if (item.element instanceof HTMLTableElement) {
        controlTypes.add('table')
    }
    if (normalizeForMatch(item.role) === 'table' || normalizeForMatch(item.role) === 'grid') {
        controlTypes.add('table')
    }

    return controlTypes.has(controlType)
}

const filterBySelector = (root: Element | Document, selector: string): Element[] => {
    const criteria = parseSelector(selector)
    const matchedElements = createElementMetadata(root)
        .filter((item) => {
            if (!matchesControlType(item, criteria.controlType)) {
                return false
            }
            if (criteria.id !== undefined && item.id !== criteria.id) {
                return false
            }
            if (criteria.part !== undefined && item.rangePart !== criteria.part) {
                return false
            }
            if (!matchesText(item.groupLabel, criteria.group)) {
                return false
            }
            if (!matchesText(item.role, criteria.role)) {
                return false
            }
            if (criteria.checked !== undefined && item.checked !== criteria.checked) {
                return false
            }
            if (!matchesText(item.tableContext.tableLabel, criteria.table)) {
                return false
            }
            if (!matchesText(item.tableContext.rowLabel, criteria.row)) {
                return false
            }
            if (!matchesText(item.tableContext.columnLabel, criteria.column)) {
                return false
            }
            if (!matchesText(item.title, criteria.title)) {
                return false
            }
            if (!matchesText(item.value, criteria.value)) {
                return false
            }
            if (!matchesLabel(item, criteria.label, criteria.controlType === 'table')) {
                return false
            }
            return true
        })
        .map((item) => item.element)

    if (criteria.index === undefined) {
        return matchedElements
    }
    const indexedElement = matchedElements[criteria.index - 1]
    return indexedElement === undefined ? [] : [indexedElement]
}

export default {
    queryAll: (root, selector) => {
        try {
            if (!isWebGui(root)) {
                return []
            }
            return filterBySelector(root, selector)
        } catch (error) {
            throw new Ui5SelectorEngineError(selector, error)
        }
    },
    query: (root, selector) => {
        try {
            if (!isWebGui(root)) {
                return undefined
            }
            const result = filterBySelector(root, selector)
            return result[0]
        } catch (error) {
            throw new Ui5SelectorEngineError(selector, error)
        }
    },
} satisfies SelectorEngine
