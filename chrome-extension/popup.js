const toggleButton = document.getElementById('togglePickerButton')
const openPinnedPanelButton = document.getElementById('openPinnedPanelButton')
const pickerStatus = document.getElementById('pickerStatus')
const resultSection = document.getElementById('resultSection')
const resultMeta = document.getElementById('resultMeta')
const resultGroups = document.getElementById('resultGroups')

let activeTabId = null
let pickerActive = false

const normalizeText = (value) =>
    String(value ?? '')
        .replace(/\s+/gu, ' ')
        .trim()

const updateStatus = () => {
    pickerStatus.textContent = pickerActive ? 'Picker is active' : 'Picker is inactive'
    toggleButton.textContent = pickerActive ? 'Stop picker' : 'Start picker'
}

const copyText = async (value) => {
    await navigator.clipboard.writeText(value)
}

const createSelectorRow = (selector) => {
    const row = document.createElement('div')
    row.className = 'selectorRow'

    const selectorValue = normalizeText(selector?.value)
    const selectorLabel = normalizeText(selector?.label)

    const content = document.createElement('div')
    content.className = 'selectorContent'
    if (selectorLabel !== '') {
        const label = document.createElement('p')
        label.className = 'selectorLabel'
        label.textContent = selectorLabel
        content.append(label)
    }

    const text = document.createElement('code')
    text.className = 'selectorText'
    text.textContent = selectorValue
    content.append(text)
    row.append(content)

    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.className = 'copyButton'
    copyButton.textContent = 'Copy'
    if (selectorValue === '') {
        copyButton.disabled = true
    }
    copyButton.addEventListener('click', async () => {
        if (selectorValue === '') {
            return
        }
        await copyText(selectorValue)
        copyButton.textContent = 'Copied'
        window.setTimeout(() => {
            copyButton.textContent = 'Copy'
        }, 900)
    })
    row.append(copyButton)
    return row
}

const renderResult = (result) => {
    resultGroups.innerHTML = ''
    if (!result || !Array.isArray(result.groups) || result.groups.length === 0) {
        resultSection.classList.add('hidden')
        return
    }

    const elementTag = result.element?.tagName ?? 'unknown'
    const elementId = result.element?.id ? `#${result.element.id}` : ''
    const primaryDisplayLabel = result.groups?.[0]?.displayLabel
    const elementSummary =
        primaryDisplayLabel && String(primaryDisplayLabel).trim() !== ''
            ? `${elementTag}=${String(primaryDisplayLabel).trim()}`
            : `${elementTag}${elementId}`
    resultMeta.textContent = `${elementSummary} - ${result.pageTitle ?? ''}`

    for (const group of result.groups) {
        const groupContainer = document.createElement('article')
        groupContainer.className = 'group'

        const groupTitle = document.createElement('p')
        groupTitle.className = 'groupTitle'
        const displayLabel =
            group.displayLabel && String(group.displayLabel).trim() !== ''
                ? ` (${String(group.displayLabel).trim()})`
                : ''
        groupTitle.textContent = `${group.title}${displayLabel}`
        groupContainer.append(groupTitle)

        for (const selector of group.selectors ?? []) {
            groupContainer.append(createSelectorRow(selector))
        }
        resultGroups.append(groupContainer)
    }
    resultSection.classList.remove('hidden')
}

const sendMessage = (message) =>
    new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            resolve(response)
        })
    })

const refreshActiveTab = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tab = tabs[0]
    const nextTabId = tab?.id ?? null
    const changed = nextTabId !== activeTabId
    activeTabId = nextTabId
    return changed
}

const refreshState = async () => {
    if (typeof activeTabId !== 'number') {
        pickerStatus.textContent = 'No active tab'
        pickerActive = false
        updateStatus()
        renderResult(null)
        return
    }
    const response = await sendMessage({
        type: 'GET_TAB_STATE',
        tabId: activeTabId,
    })
    pickerActive = response?.active === true
    updateStatus()
    renderResult(response?.result ?? null)
}

const init = async () => {
    await refreshActiveTab()
    await refreshState()
}

toggleButton.addEventListener('click', async () => {
    if (typeof activeTabId !== 'number') {
        return
    }
    const response = await sendMessage({
        type: 'TOGGLE_PICKER',
        tabId: activeTabId,
    })
    pickerActive = response?.active === true
    updateStatus()
})

if (openPinnedPanelButton !== null) {
    openPinnedPanelButton.addEventListener('click', async () => {
        if (typeof activeTabId !== 'number') {
            const changed = await refreshActiveTab()
            if (changed) {
                await refreshState()
            }
        }
        if (typeof activeTabId !== 'number') {
            return
        }
        const response = await sendMessage({
            type: 'OPEN_SIDE_PANEL',
            tabId: activeTabId,
        })
        if (response?.ok !== true) {
            pickerStatus.textContent = 'Unable to open pinned panel in this Chrome version'
            return
        }
        window.close()
    })
}

chrome.tabs.onActivated.addListener(async () => {
    const changed = await refreshActiveTab()
    if (changed) {
        await refreshState()
    }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') {
        return
    }
    const changed = await refreshActiveTab()
    if (!changed && tab.id !== activeTabId) {
        return
    }
    await refreshState()
})

chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'TAB_STATE_UPDATED') {
        return
    }
    if (message.tabId !== activeTabId) {
        return
    }
    pickerActive = message.active === true
    updateStatus()
    renderResult(message.result ?? null)
})

void init()
