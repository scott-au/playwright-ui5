const pickerStateByTabId = new Map()
const lastResultByTabId = new Map()
const UI5_PROPERTY_CANDIDATES = ['text', 'title', 'value', 'name', 'tooltip', 'icon']

const getStateForTab = (tabId) => pickerStateByTabId.get(tabId) === true

const safeSendToTab = (tabId, message, options = undefined) => {
    chrome.tabs.sendMessage(tabId, message, options, () => {
        // no-op: content script may not be available for this tab or frame
        void chrome.runtime.lastError
    })
}

const broadcastStateUpdate = (tabId) => {
    chrome.runtime.sendMessage({
        type: 'TAB_STATE_UPDATED',
        tabId,
        active: getStateForTab(tabId),
        result: lastResultByTabId.get(tabId) ?? null,
    })
}

const setPickerActiveForTab = (tabId, active) => {
    pickerStateByTabId.set(tabId, active)
    safeSendToTab(tabId, { type: 'SET_PICKER_ACTIVE', active })
    broadcastStateUpdate(tabId)
}

const togglePickerForTab = (tabId) => {
    const active = !getStateForTab(tabId)
    setPickerActiveForTab(tabId, active)
    return active
}

const respondWithTabState = (tabId, sendResponse) => {
    sendResponse({
        active: getStateForTab(tabId),
        result: lastResultByTabId.get(tabId) ?? null,
        tabId,
    })
}

const openSidePanelForTab = async (tabId) => {
    if (typeof tabId !== 'number') {
        return { ok: false, error: 'invalid_tab_id' }
    }
    if (
        chrome.sidePanel === undefined ||
        typeof chrome.sidePanel.open !== 'function' ||
        typeof chrome.sidePanel.setOptions !== 'function'
    ) {
        return { ok: false, error: 'side_panel_not_supported' }
    }

    try {
        await chrome.sidePanel.setOptions({
            tabId,
            enabled: true,
            path: 'sidepanel.html',
        })
        await chrome.sidePanel.open({ tabId })
        return { ok: true }
    } catch (error) {
        return { ok: false, error: String(error) }
    }
}

const runUi5Resolver = async (tabId, frameId, payload) => {
    if (typeof tabId !== 'number') {
        return null
    }

    const target = { tabId }
    if (typeof frameId === 'number') {
        target.frameIds = [frameId]
    }

    const results = await chrome.scripting.executeScript({
        target,
        world: 'MAIN',
        args: [payload ?? null, UI5_PROPERTY_CANDIDATES],
        func: (inputPayload, propertyCandidates) => {
            const normalizeText = (value) =>
                String(value ?? '')
                    .replace(/\s+/gu, ' ')
                    .trim()

            const addCandidate = (bucket, value) => {
                const normalized = normalizeText(value)
                if (normalized !== '') {
                    bucket.add(normalized)
                }
            }

            const expandIdCandidates = (value) => {
                const candidates = new Set()
                const normalized = normalizeText(value)
                if (normalized === '') {
                    return []
                }

                addCandidate(candidates, normalized)
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
                        addCandidate(
                            candidates,
                            normalized.slice(0, normalized.length - suffix.length),
                        )
                    }
                }

                let current = normalized
                while (current.includes('-')) {
                    current = current.slice(0, current.lastIndexOf('-'))
                    addCandidate(candidates, current)
                }

                return Array.from(candidates)
            }

            const readPropertyEntries = (control) => {
                const properties = []
                for (const propertyName of propertyCandidates) {
                    let value
                    try {
                        value = control.getProperty(propertyName)
                    } catch {
                        continue
                    }
                    if (
                        value === undefined ||
                        value === null ||
                        (typeof value === 'string' && normalizeText(value) === '')
                    ) {
                        continue
                    }
                    if (
                        typeof value !== 'string' &&
                        typeof value !== 'number' &&
                        typeof value !== 'boolean'
                    ) {
                        continue
                    }
                    properties.push({
                        name: propertyName,
                        value: typeof value === 'string' ? normalizeText(value) : value,
                    })
                    if (properties.length >= 8) {
                        break
                    }
                }
                return properties
            }

            try {
                const rootSap = window.sap
                if (
                    typeof rootSap === 'undefined' ||
                    rootSap?.ui === undefined ||
                    typeof rootSap.ui.getCore !== 'function'
                ) {
                    return { found: false }
                }

                const core = rootSap.ui.getCore()
                const candidateIdSet = new Set()
                if (Array.isArray(inputPayload?.candidateIds)) {
                    for (const candidateId of inputPayload.candidateIds) {
                        for (const expandedCandidate of expandIdCandidates(candidateId)) {
                            addCandidate(candidateIdSet, expandedCandidate)
                        }
                    }
                }

                let control = null
                for (const candidateId of candidateIdSet) {
                    const candidateControl = core.byId(candidateId)
                    if (candidateControl) {
                        control = candidateControl
                        break
                    }
                }

                const clickPosition = inputPayload?.clickPosition
                const canUsePointFallback =
                    control === null &&
                    clickPosition !== null &&
                    typeof clickPosition === 'object' &&
                    typeof clickPosition.x === 'number' &&
                    typeof clickPosition.y === 'number'

                if (canUsePointFallback) {
                    const hitElement = document.elementFromPoint(clickPosition.x, clickPosition.y)
                    const elementApi = rootSap?.ui?.core?.Element
                    if (
                        hitElement instanceof Element &&
                        typeof elementApi?.closestTo === 'function'
                    ) {
                        try {
                            const closestControl = elementApi.closestTo(hitElement)
                            if (closestControl) {
                                control = closestControl
                            }
                        } catch {
                            // no-op
                        }
                    }

                    if (control === null && hitElement instanceof Element) {
                        let current = hitElement
                        while (current instanceof Element && control === null) {
                            for (const expandedId of expandIdCandidates(current.id)) {
                                const candidateControl = core.byId(expandedId)
                                if (candidateControl) {
                                    control = candidateControl
                                    break
                                }
                            }
                            if (control === null) {
                                const dataSapUiId = normalizeText(
                                    current.getAttribute('data-sap-ui'),
                                )
                                if (dataSapUiId !== '') {
                                    const candidateControl = core.byId(dataSapUiId)
                                    if (candidateControl) {
                                        control = candidateControl
                                        break
                                    }
                                }
                            }
                            current = current.parentElement
                        }
                    }
                }

                if (control === null) {
                    return { found: false }
                }

                const typeName = normalizeText(control.getMetadata().getName())
                const controlId = normalizeText(control.getId())
                const properties = readPropertyEntries(control)
                const firstStringProperty = properties.find(
                    (entry) => typeof entry.value === 'string',
                )
                const displayLabel =
                    normalizeText(firstStringProperty?.value) ||
                    `${typeName}${controlId ? `#${controlId}` : ''}`

                return {
                    found: true,
                    controlId,
                    displayLabel,
                    properties,
                    typeName,
                }
            } catch {
                return { found: false }
            }
        },
    })

    return results?.[0]?.result ?? null
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'GET_TAB_STATE') {
        const tabId = message.tabId
        if (typeof tabId !== 'number') {
            sendResponse({ active: false, result: null })
            return
        }
        respondWithTabState(tabId, sendResponse)
        return
    }

    if (message?.type === 'TOGGLE_PICKER') {
        const tabId = message.tabId
        if (typeof tabId !== 'number') {
            sendResponse({ active: false })
            return
        }
        sendResponse({ active: togglePickerForTab(tabId) })
        return
    }

    if (message?.type === 'SET_PICKER_ACTIVE') {
        const tabId = message.tabId
        const active = message.active === true
        if (typeof tabId !== 'number') {
            sendResponse({ ok: false })
            return
        }
        setPickerActiveForTab(tabId, active)
        sendResponse({ ok: true, active })
        return
    }

    if (message?.type === 'OPEN_SIDE_PANEL') {
        const tabId = message.tabId
        openSidePanelForTab(tabId).then(sendResponse)
        return true
    }

    if (message?.type === 'PICKER_RESULT') {
        const tabId = sender.tab?.id
        if (typeof tabId !== 'number') {
            sendResponse({ ok: false })
            return
        }
        lastResultByTabId.set(tabId, message.result ?? null)
        broadcastStateUpdate(tabId)
        sendResponse({ ok: true })
        return
    }

    if (message?.type === 'PICKER_ACTIVE_CHANGED') {
        const tabId = sender.tab?.id
        if (typeof tabId !== 'number') {
            sendResponse({ ok: false })
            return
        }
        pickerStateByTabId.set(tabId, message.active === true)
        broadcastStateUpdate(tabId)
        sendResponse({ ok: true })
        return
    }

    if (message?.type === 'CONTENT_READY') {
        const tabId = sender.tab?.id
        if (typeof tabId !== 'number') {
            sendResponse({ ok: false })
            return
        }
        const active = getStateForTab(tabId)
        if (active) {
            const options =
                typeof sender.frameId === 'number' ? { frameId: sender.frameId } : undefined
            safeSendToTab(tabId, { type: 'SET_PICKER_ACTIVE', active: true }, options)
        }
        sendResponse({ ok: true, active })
        return
    }

    if (message?.type === 'RESOLVE_UI5') {
        const tabId = sender.tab?.id
        const frameId = sender.frameId
        runUi5Resolver(tabId, frameId, message.payload)
            .then((result) => {
                sendResponse({ ok: true, result })
            })
            .catch(() => {
                sendResponse({ ok: false, result: null })
            })
        return true
    }
})

chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-picker') {
        return
    }
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tab = tabs[0]
    if (tab?.id === undefined) {
        return
    }
    togglePickerForTab(tab.id)
})

chrome.tabs.onRemoved.addListener((tabId) => {
    pickerStateByTabId.delete(tabId)
    lastResultByTabId.delete(tabId)
})
