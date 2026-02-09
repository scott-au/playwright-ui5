import type { SelectorEngine } from '../common/types'
import { Ui5SelectorEngineError } from './common'

type RangePart = 'from' | 'to'
type WebGuiControlType =
    | 'abaplist'
    | 'abaplistelement'
    | 'box'
    | 'button'
    | 'cell'
    | 'checkbox'
    | 'column'
    | 'combobox'
    | 'expandablesection'
    | 'link'
    | 'listbox'
    | 'messagearea'
    | 'messagebar'
    | 'modalwindow'
    | 'option'
    | 'radio'
    | 'spinbutton'
    | 'table'
    | 'tab'
    | 'tabstrip'
    | 'text'
    | 'textbox'

interface SelectorCriteria {
    controlType?: WebGuiControlType
    label?: string
    group?: string
    table?: string
    tab?: string
    row?: string
    column?: string
    cell?: string
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
    controlTypes: Set<WebGuiControlType>
    value: string | undefined
    tableColumnHeaders: string[]
    tableCellValues: string[]
    checked: boolean | undefined
    title: string | undefined
    ariaLabel: string | undefined
    directLabel: string | undefined
    labelCandidates: string[]
    tableContext: TableContext
    rowKey: string | undefined
    rangePart: RangePart | undefined
    groupLabel: string | undefined
    tabLabels: string[]
    displayLabel: string
}

interface TableCoordinates {
    tableId: string
    row: number
    column: number
}

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

const normalizeText = (value: string | null | undefined) =>
    value?.replace(/\s+/gu, ' ').trim() ?? ''

const normalizeForMatch = (value: string | null | undefined) => normalizeText(value).toLowerCase()

const supportedSelectorKeys = new Set([
    'cell',
    'checked',
    'column',
    'group',
    'id',
    'index',
    'label',
    'part',
    'role',
    'row',
    'tab',
    'table',
    'title',
    'value',
])
const supportedSelectorKeysMessage = [...supportedSelectorKeys].join(', ')

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
const supportedControlTypeAliases: Record<string, WebGuiControlType | undefined> = {
    '*': undefined,
    abaplist: 'abaplist',
    abaplisttable: 'abaplist',
    abaplisttree: 'abaplist',
    abaplistelement: 'abaplistelement',
    box: 'box',
    button: 'button',
    cell: 'cell',
    checkbox: 'checkbox',
    column: 'column',
    combobox: 'combobox',
    daterangefields: 'textbox',
    datefield: 'textbox',
    dropdownbutton: 'button',
    dropdownfield: 'combobox',
    expandablesection: 'expandablesection',
    link: 'link',
    listbox: 'listbox',
    messagearea: 'messagearea',
    messagebar: 'messagebar',
    modal: 'modalwindow',
    modalwindow: 'modalwindow',
    option: 'option',
    radio: 'radio',
    radiogroup: 'radio',
    rangefields: 'textbox',
    section: 'expandablesection',
    spinbutton: 'spinbutton',
    statictext: 'text',
    table: 'table',
    tab: 'tab',
    tabstrip: 'tabstrip',
    textrangefields: 'textbox',
    text: 'text',
    textfield: 'textbox',
    textbox: 'textbox',
    numberrangefields: 'textbox',
    tree: 'table',
    webguielement: undefined,
}
const supportedControlTypesMessage = Object.keys(supportedControlTypeAliases).sort().join(', ')

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
    if (
        Object.prototype.hasOwnProperty.call(supportedControlTypeAliases, normalizedValue)
    ) {
        return supportedControlTypeAliases[normalizedValue]
    }
    throw new Error(
        `unsupported webgui control type "${value}". supported control types: ${supportedControlTypesMessage}`,
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
        key === 'cell' ||
        key === 'column' ||
        key === 'group' ||
        key === 'id' ||
        key === 'label' ||
        key === 'role' ||
        key === 'row' ||
        key === 'tab' ||
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

const inferControlTypes = (
    element: Element,
    ct: string | undefined,
    role: string | undefined,
): Set<WebGuiControlType> => {
    const controlTypes = new Set<WebGuiControlType>()
    const normalizedRole = normalizeForMatch(role)
    if (roleControlTypes.has(normalizedRole)) {
        controlTypes.add(normalizedRole as WebGuiControlType)
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

const isCandidateElement = (element: Element) => {
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
        '[ct],[subct],a,button,input,option,[role="button"],[role="cell"],[role="checkbox"],[role="columnheader"],[role="combobox"],[role="dialog"],[role="grid"],[role="gridcell"],[role="group"],[role="link"],[role="listbox"],[role="menuitem"],[role="menuitemradio"],[role="option"],[role="radio"],[role="spinbutton"],[role="status"],[role="table"],[role="tab"],[role="tablist"],[role="textbox"],select,table,textarea',
    ).filter(isCandidateElement)

const normalizeLabelText = (value: string | null | undefined) => {
    const normalized = normalizeText(value).replace(/\u00a0/gu, ' ')
    if (normalized === '') {
        return ''
    }
    return normalized.replace(/\s*:\s*$/u, '').trim()
}

const toCompactLabel = (value: string | null | undefined, maximumLength = 120) => {
    const normalized = normalizeLabelText(value)
    if (normalized === '' || normalized.length > maximumLength) {
        return undefined
    }
    return normalized
}

const appendLabelCandidate = (
    labels: string[],
    seenLabels: Set<string>,
    value: string | undefined,
    maximumLength = 120,
) => {
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

const getLabelTextsForId = (document: Document, id: string) =>
    Array.from(document.querySelectorAll(`label[for="${CSS.escape(id)}"]`))
        .map((label) => normalizeLabelText(label.textContent))
        .filter((labelText) => labelText !== '')

const getButtonTitleLabel = (title: string | undefined) => {
    if (title === undefined) {
        return undefined
    }
    const withoutShortcut = title.replace(/\s+\([^)]*\)\s*$/u, '')
    const normalized = normalizeLabelText(withoutShortcut)
    return normalized === '' ? undefined : normalized
}

const getElementTextLabel = (element: Element, maximumLength = 120) => {
    const candidateSelectors = ['label', '[ct="CP"]', 'span']
    for (const selector of candidateSelectors) {
        const candidate = element.querySelector(selector)
        if (candidate === null) {
            continue
        }
        const text = toCompactLabel(candidate.textContent, maximumLength)
        if (text !== undefined) {
            return text
        }
    }
    return toCompactLabel(element.textContent, maximumLength)
}

const getModalWindowLabel = (element: Element) => {
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

const getExpandableSectionLabel = (document: Document, element: Element) => {
    const labelledElement =
        element.querySelector('[aria-label]') ??
        element.querySelector('[aria-labelledby]') ??
        element.querySelector('[title]') ??
        element.querySelector('[role="heading"]')
    if (labelledElement !== null) {
        const attributedLabel = getElementLabelFromAttributes(document, labelledElement)
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

const getTabStripLabels = (tabStripElement: Element) => {
    const tabLabels: string[] = []
    const seenLabels = new Set<string>()
    const tabSelectors = ['[action="TAB_ACCESS"]', '[ct="HCNPI_standards"]', '[role="tab"]']
    for (const selector of tabSelectors) {
        tabStripElement.querySelectorAll(selector).forEach((tabElement) =>
            appendLabelCandidate(tabLabels, seenLabels, tabElement.textContent ?? undefined, 160),
        )
    }
    return tabLabels
}

const getLabelFromStructuralSiblings = (document: Document, element: Element) => {
    let currentElement: Element | null = element
    for (let depth = 0; depth < 5 && currentElement !== null; depth++) {
        let sibling: Element | null = currentElement.previousElementSibling
        while (sibling !== null) {
            const siblingLabel = getLabelFromSibling(document, sibling)
            if (siblingLabel !== undefined) {
                return siblingLabel
            }
            sibling = sibling.previousElementSibling
        }
        currentElement = currentElement.parentElement
    }
    return undefined
}

const getLabelCandidatesForElement = (
    document: Document,
    element: Element,
    controlTypes: Set<WebGuiControlType>,
    title: string | undefined,
) => {
    const labels: string[] = []
    const seenLabels = new Set<string>()
    const id = normalizeText(element.id)
    if (id !== '') {
        getLabelTextsForId(document, id).forEach((labelText) =>
            appendLabelCandidate(labels, seenLabels, labelText),
        )
    }

    if (
        controlTypes.has('textbox') ||
        controlTypes.has('combobox') ||
        controlTypes.has('listbox') ||
        controlTypes.has('spinbutton')
    ) {
        appendLabelCandidate(labels, seenLabels, getLabelFromStructuralSiblings(document, element))
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
        appendLabelCandidate(labels, seenLabels, getButtonTitleLabel(title))
    }
    if (controlTypes.has('expandablesection')) {
        appendLabelCandidate(labels, seenLabels, getExpandableSectionLabel(document, element), 160)
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
        appendLabelCandidate(labels, seenLabels, getOwnTableLabel(document, element), 160)
    }
    appendLabelCandidate(labels, seenLabels, getElementLabelFromAttributes(document, element), 160)

    return labels
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

    const treeHeaderPatternMatch = id.match(
        /^(?<tableId>tree#.+?)#HierarchyHeader#(?<column>\d+)#header(?:$|[#-])/u,
    )
    if (treeHeaderPatternMatch?.groups !== undefined) {
        const tableId = treeHeaderPatternMatch.groups['tableId']
        const column = treeHeaderPatternMatch.groups['column']
        if (tableId === undefined || column === undefined) {
            return undefined
        }
        return {
            tableId,
            row: 0,
            column: Number.parseInt(column, 10),
        }
    }

    const treeNamedHeaderPatternMatch = id.match(
        /^(?<tableId>tree#.+?)#[^#]+#(?<column>\d+)#header(?:$|[#-])/u,
    )
    if (treeNamedHeaderPatternMatch?.groups !== undefined) {
        const tableId = treeNamedHeaderPatternMatch.groups['tableId']
        const column = treeNamedHeaderPatternMatch.groups['column']
        if (tableId === undefined || column === undefined) {
            return undefined
        }
        return {
            tableId,
            row: 0,
            column: Number.parseInt(column, 10),
        }
    }

    const treeCellPatternMatch = id.match(/^(?<tableId>tree#.+?)#(?<row>\d+)#(?<column>\d+)(?:$|#)/u)
    if (treeCellPatternMatch?.groups !== undefined) {
        const tableId = treeCellPatternMatch.groups['tableId']
        const row = treeCellPatternMatch.groups['row']
        const column = treeCellPatternMatch.groups['column']
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

const hasOwnGridEntries = (tableElement: HTMLTableElement) => {
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

const getCellId = (tableId: string, row: number, column: number) => {
    if (tableId.startsWith('tree#')) {
        return row === 0
            ? `${tableId}#HierarchyHeader#${column}#header`
            : `${tableId}#${row}#${column}`
    }
    return tableId.includes('#') ? `${tableId}#${row},${column}` : `${tableId}[${row},${column}]`
}

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
        .map((id) => normalizeLabelText(document.getElementById(id)?.textContent))
        .filter((text) => text !== '')

const getElementLabelFromAttributes = (document: Document, element: Element | null) => {
    if (element === null) {
        return undefined
    }

    const ariaLabel = normalizeLabelText(element.getAttribute('aria-label'))
    if (ariaLabel !== '') {
        return ariaLabel
    }

    const ariaLabelledByText = getTextFromIdList(document, element.getAttribute('aria-labelledby'))
    if (ariaLabelledByText.length > 0) {
        return ariaLabelledByText.join(' / ')
    }

    const title = normalizeLabelText(element.getAttribute('title'))
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

    return getElementTextLabel(element)
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

const getAncestorTableLabel = (document: Document, element: Element) => {
    let currentElement: Element | null = element.parentElement
    while (currentElement !== null) {
        const ownLabel = getOwnTableLabel(document, currentElement)
        if (ownLabel !== undefined) {
            return ownLabel
        }
        currentElement = currentElement.parentElement
    }
    return undefined
}

const getTableTitle = (document: Document, tableId: string) => {
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
            const tableLabel = getNearestTableLabel(document, tableElement)
            if (tableLabel !== undefined) {
                return tableLabel
            }
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

const addUniqueValue = (
    values: string[],
    seenValues: Set<string>,
    value: string | undefined,
    maximumLength = 240,
) => {
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

const getTableGridEntries = (tableElement: Element) => {
    const tableId = normalizeText(tableElement.id)
    if (tableId === '') {
        return []
    }
    const tableIdAliases = new Set([tableId, `grid#${tableId}`])

    const gridEntries: Array<{ element: Element; coordinates: TableCoordinates }> = []
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

const getTableColumnHeaders = (tableElement: Element) => {
    const headersByColumn = new Map<number, string>()
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

    const fallbackHeaders: string[] = []
    const seenHeaders = new Set<string>()
    tableElement.querySelectorAll('[role="columnheader"],th').forEach((headerElement) => {
        addUniqueValue(
            fallbackHeaders,
            seenHeaders,
            getCurrentHeaderText(headerElement) ??
                toCompactLabel(headerElement.getAttribute('title'), 200) ??
                toCompactLabel(headerElement.textContent, 200),
            200,
        )
    })
    return fallbackHeaders
}

const getTableCellValues = (tableElement: Element) => {
    const values: string[] = []
    const seenValues = new Set<string>()

    const gridEntries = getTableGridEntries(tableElement)
    gridEntries
        .filter((entry) => entry.coordinates.row > 0)
        .forEach((entry) => {
            addUniqueValue(values, seenValues, entry.element.getAttribute('title') ?? undefined)
            addUniqueValue(values, seenValues, getElementValue(entry.element))
            entry.element
                .querySelectorAll('input,textarea,select')
                .forEach((field) => addUniqueValue(values, seenValues, getElementValue(field)))
        })

    if (values.length > 0) {
        return values
    }

    tableElement.querySelectorAll('[role="gridcell"],td,[ct="SC"],[ct="STC"],[ct="HIC"]').forEach((cellElement) => {
        addUniqueValue(values, seenValues, cellElement.getAttribute('title') ?? undefined)
        addUniqueValue(values, seenValues, getElementValue(cellElement))
        cellElement
            .querySelectorAll('input,textarea,select')
            .forEach((field) => addUniqueValue(values, seenValues, getElementValue(field)))
    })

    return values
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
        const ariaLabel = normalizeLabelText(element.getAttribute('aria-label')) || undefined
        const ct = element.getAttribute('ct') ?? element.getAttribute('subct') ?? undefined
        const role = element.getAttribute('role') ?? undefined
        const controlTypes = inferControlTypes(element, ct, role)
        const labelCandidates = getLabelCandidatesForElement(document, element, controlTypes, title)
        const tabLabels = controlTypes.has('tabstrip') ? getTabStripLabels(element) : []
        const tableContext = getTableContext(document, element)
        const ownTableLabel = controlTypes.has('table')
            ? getOwnTableLabel(document, element) ??
              (ct !== undefined ? getAncestorTableLabel(document, element) : undefined)
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
            ariaLabel,
            checked: getElementCheckedState(element),
            controlTypes,
            ct,
            directLabel: labelCandidates[0],
            displayLabel: '',
            element,
            groupLabel: undefined,
            id,
            labelCandidates,
            rangePart: undefined,
            role,
            tabLabels,
            tableCellValues,
            tableColumnHeaders,
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

const matchesAnyText = (actualValues: string[], expected: string | undefined) =>
    expected === undefined || actualValues.some((actualValue) => matchesText(actualValue, expected))

const matchesLabel = (item: ElementMetadata, label: string | undefined, exactMatch: boolean) => {
    if (label === undefined) {
        return true
    }
    return [
        ...item.labelCandidates,
        ...item.tabLabels,
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

    return item.controlTypes.has(controlType)
}

const filterBySelector = (root: Element | Document, selector: string): Element[] => {
    const criteria = parseSelector(selector)
    const matchedElements = createElementMetadata(root)
        .filter((item) => {
            const isTableControl = item.controlTypes.has('table')
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
            if (!matchesAnyText(item.tabLabels, criteria.tab)) {
                return false
            }
            if (!matchesText(item.tableContext.rowLabel, criteria.row)) {
                return false
            }
            if (criteria.column !== undefined) {
                if (isTableControl) {
                    if (!matchesAnyText(item.tableColumnHeaders, criteria.column)) {
                        return false
                    }
                } else if (!matchesText(item.tableContext.columnLabel, criteria.column)) {
                    return false
                }
            }
            if (criteria.cell !== undefined) {
                if (!isTableControl || !matchesAnyText(item.tableCellValues, criteria.cell)) {
                    return false
                }
            }
            if (!matchesText(item.title, criteria.title)) {
                return false
            }
            if (criteria.value !== undefined) {
                if (isTableControl) {
                    if (!matchesAnyText(item.tableCellValues, criteria.value)) {
                        return false
                    }
                } else if (!matchesText(item.value, criteria.value)) {
                    return false
                }
            }
            if (
                !matchesLabel(
                    item,
                    criteria.label,
                    criteria.controlType === 'table' || criteria.controlType === 'tabstrip',
                )
            ) {
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
