import { Ui5Tester, fixDefaultTimeout } from './testUtils'
import { expect, test } from '@playwright/test'

const ui5Tester = new Ui5Tester('webgui')

const webGuiFixture = `
<div ct="PAGE">
    <div>
        <label for="person-id">Person ID</label>
        <input id="person-id" ct="CI" />
    </div>
    <table>
        <tr id="range-row">
            <td><label for="start-from">Start</label></td>
            <td><input id="start-from" ct="CI" /></td>
            <td><label for="start-to">to</label></td>
            <td><input id="start-to" ct="CI" /></td>
        </tr>
    </table>
    <div id="orders-title">Orders</div>
    <table id="orders">
        <tr>
            <td id="orders[0,1]"><span ct="CP">Row</span></td>
            <td id="orders[0,2]"><span ct="CP">Amount</span></td>
        </tr>
        <tr id="table-row-1">
            <td id="orders[1,1]"><span ct="CP">Row 1</span></td>
            <td><input id="orders[1,2]#input" ct="CI" /></td>
        </tr>
    </table>
    <table id="actions-group" ct="G" role="group">
        <tr>
            <td id="actions-group-title" role="heading" aria-level="2">
                <span id="actions-group-groupheader">Additional actions</span>
            </td>
        </tr>
        <tr>
            <td>
                <table id="actions-grid">
                    <tr>
                        <td id="actions-grid[0,1]"><span ct="CP">Action</span></td>
                        <td id="actions-grid[0,2]"><span ct="CP">Enabled</span></td>
                    </tr>
                    <tr id="actions-row-1">
                        <td id="actions-grid[1,1]"><span ct="CP">Copy</span></td>
                        <td><input id="actions-grid[1,2]#input" ct="CI" /></td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    <div id="monitor-split">
        <table id="C111" ct="STCS">
            <thead id="C111-thead">
                <tr role="presentation">
                    <th colspan="3" role="heading" aria-level="2" id="C111-title">
                        <span ct="CP">Wave</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td id="C111[0,1]"><span ct="CP">Row</span></td>
                    <td id="C111[0,2]"><span ct="CP">Status</span></td>
                </tr>
                <tr id="C111-row-1">
                    <td id="C111[1,1]"><span ct="CP">Wave A</span></td>
                    <td><input id="C111[1,2]#input" ct="CI" /></td>
                </tr>
            </tbody>
        </table>
        <table id="C219" ct="STCS">
            <thead id="C219-thead">
                <tr role="presentation">
                    <th colspan="3" role="heading" aria-level="2" id="C219-title">
                        <span ct="CP">Wave Item</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td id="C219[0,1]"><span ct="CP">Row</span></td>
                    <td id="C219[0,2]"><span ct="CP">Quantity</span></td>
                </tr>
                <tr id="C219-row-1">
                    <td id="C219[1,1]"><span ct="CP">Item A</span></td>
                    <td><input id="C219[1,2]#input" ct="CI" /></td>
                </tr>
            </tbody>
        </table>
    </div>
    <button id="save-action" ct="B" title="Save now">Save</button>
</div>
`

test.beforeAll(() => ui5Tester.registerSelectorEngine())
test.beforeEach(async ({ page }) => {
    fixDefaultTimeout(page)
    await page.setContent(webGuiFixture)
})

test.describe('css-like syntax', () => {
    test('type + label', async ({ page }) => {
        await expect(page.locator("webgui=textbox[label='Person ID']")).toHaveId('person-id')
    })

    test('group + part', async ({ page }) => {
        await expect(page.locator("webgui=textbox[group='Start'][part='from']")).toHaveId(
            'start-from',
        )
        await expect(page.locator("webgui=textbox[group='Start'][part='to']")).toHaveId('start-to')
    })

    test('table fallback', async ({ page }) => {
        await expect(
            page.locator("webgui=textbox[table='Orders'][row='Row 1'][column='Amount']"),
        ).toHaveId('orders[1,2]#input')
    })

    test('table fallback using visual group label', async ({ page }) => {
        await expect(
            page.locator(
                "webgui=textbox[table='Additional actions'][row='Copy'][column='Enabled']",
            ),
        ).toHaveId('actions-grid[1,2]#input')
    })

    test('table selector by label', async ({ page }) => {
        await expect(page.locator("webgui=table[label='Additional actions']")).toHaveId(
            'actions-group',
        )
    })

    test('table selectors for split monitor tables', async ({ page }) => {
        await expect(page.locator("webgui=table[label='Wave']")).toHaveId('C111')
        await expect(page.locator("webgui=table[label='Wave Item']")).toHaveId('C219')
    })

    test('table fallback for split monitor tables', async ({ page }) => {
        await expect(
            page.locator("webgui=textbox[table='Wave'][row='Wave A'][column='Status']"),
        ).toHaveId('C111[1,2]#input')
        await expect(
            page.locator("webgui=textbox[table='Wave Item'][row='Item A'][column='Quantity']"),
        ).toHaveId('C219[1,2]#input')
    })

    test('wildcard type', async ({ page }) => {
        await expect(page.locator("webgui=*[title='Save now']")).toHaveId('save-action')
    })

    test('type only', async ({ page }) => {
        await expect(page.locator('webgui=textbox')).toHaveCount(7)
    })
})

test.describe('type filtering', () => {
    test('non matching type returns no result', async ({ page }) => {
        await expect(page.locator("webgui=checkbox[label='Person ID']")).toHaveCount(0)
    })
})

test('invalid css-like type throws', ({ page }) =>
    expect(page.locator("webgui=banana[label='Person ID']").isVisible()).rejects.toThrow(
        /unsupported webgui control type "banana"/u,
    ))
