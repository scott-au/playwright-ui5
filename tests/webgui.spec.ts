import { Ui5Tester, fixDefaultTimeout } from './testUtils'
import { expect, test } from '@playwright/test'

const ui5Tester = new Ui5Tester('webgui')

const webGuiFixture = `
<div ct="PAGE">
    <div>
        <label for="person-id">Person ID</label>
        <input id="person-id" ct="CI" />
    </div>
    <div id="legacy-field-row">
        <div><span>Legacy Field:</span></div>
        <div><input id="legacy-field" ct="CBS" /></div>
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
    <div id="execute-action" ct="B" title="Execute (F8)">
        <span>Execute</span>
    </div>
    <div id="approval-required" ct="C_standards" role="checkbox" aria-checked="false">
        <span>Approval required</span>
    </div>
    <div id="details-link" ct="LN">
        <span>Open Details</span>
    </div>
    <table id="legacy-st" ct="ST">
        <thead>
            <tr role="presentation">
                <th role="heading" aria-level="2" id="legacy-st-title">
                    <span ct="CP">Legacy Table</span>
                </th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td id="legacy-st[0,1]"><span ct="CP">Row</span></td>
                <td id="legacy-st[0,2]"><span ct="CP">Value</span></td>
            </tr>
            <tr id="legacy-st-row-1">
                <td id="legacy-st[1,1]"><span ct="CP">Legacy Row 1</span></td>
                <td><input id="legacy-st[1,2]#input" ct="CI" /></td>
            </tr>
        </tbody>
    </table>
    <table id="infotype-table" ct="ST">
        <tbody>
            <tr>
                <th id="infotype-table[0,1]" role="columnheader">
                    <span ct="CP">Infotype Name</span>
                </th>
                <th id="infotype-table[0,2]" role="columnheader">
                    <span ct="CP">Subtype</span>
                </th>
            </tr>
            <tr id="infotype-row-1">
                <td id="infotype-table[1,1]">
                    <span ct="CP">Address</span>
                </td>
                <td id="infotype-table[1,2]">
                    <span ct="CP">Permanent Residence</span>
                </td>
            </tr>
        </tbody>
    </table>
    <table id="referral-wrapper">
        <thead>
            <tr role="presentation">
                <th role="heading" aria-level="2" id="C321-title">
                    <span ct="CP">Select the desired referral option</span>
                </th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>
                    <table id="C321" ct="STCS">
                        <tbody>
                            <tr>
                                <td id="grid#C321#0,1">
                                    <span ct="CP">Option Short Text</span>
                                </td>
                                <td id="grid#C321#0,2">
                                    <span ct="CP">Option Text</span>
                                </td>
                                <td id="grid#C321#0,3">
                                    <span ct="CP">Receiving Actor</span>
                                </td>
                            </tr>
                            <tr>
                                <td id="grid#C321#1,1">
                                    <span ct="CP">Refer</span>
                                </td>
                                <td id="grid#C321#1,2">
                                    <span ct="CP">Refer to AP Supervisor</span>
                                </td>
                                <td id="grid#C321#1,3">
                                    <span ct="CP">AP_SUPERVISOR</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
    <div>
        <label for="country-code">Country</label>
        <select id="country-code" ct="CB">
            <option id="country-option-au" value="AU">AU</option>
        </select>
    </div>
    <div id="ship-air" ct="R_standards" role="radio" aria-checked="true">
        <span>Ship by Air</span>
    </div>
    <div id="main-tabs" ct="TS_standards">
        <div action="TAB_ACCESS">Overview</div>
        <div action="TAB_ACCESS">Details</div>
    </div>
    <div id="confirm-modal" ct="PW" role="dialog">
        <div class="urPWTitleText">Confirm Save</div>
    </div>
    <div id="footer-message" ct="MB" role="status">
        <span class="lsMessageBar__text">Document saved</span>
    </div>
    <div id="activity-list" ct="AL">
        <div id="activity-item" ct="ALT">
            <span>Payroll Entry</span>
        </div>
    </div>
    <div id="status-text" ct="L">
        <span>Ready for processing</span>
    </div>
    <div id="message-area" ct="MA">
        <div role="button" title="Current Messages"></div>
    </div>
    <table id="advanced-section" ct="P">
        <tbody>
            <tr>
                <td>
                    <div aria-label="Advanced Options"></div>
                </td>
            </tr>
        </tbody>
    </table>
    <div id="dog-tablist" role="tablist">
        <div id="dog-tab-labrador" role="tab">Labrador</div>
        <div id="dog-tab-beagle" role="tab">Beagle</div>
    </div>
    <table id="dog-options-menu" role="menu">
        <tbody>
            <tr id="dog-menu-labrador" ct="POMNI" role="menuitemradio" aria-label="Labrador Option">
                <td>Labrador Option</td>
            </tr>
            <tr id="dog-menu-beagle" ct="POMNI" role="menuitemradio" aria-label="Beagle Option">
                <td>Beagle Option</td>
            </tr>
        </tbody>
    </table>
    <div id="dog-tree-region">
        <div id="tree#DOG1" ct="STCS" role="grid">
            <table>
                <thead>
                    <tr>
                        <th id="tree#DOG1#HierarchyHeader#1#header" role="columnheader" title="Pup Name/">
                            <span ct="CP">Pup Name</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td id="tree#DOG1#1#1" ct="HIC" role="gridcell">
                            <span id="tree#DOG1#1#1#name" ct="TV" role="button">Labrador</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <div id="dog-tree-region-variant">
        <div id="tree#DOG2" ct="STCS" role="grid">
            <table>
                <thead>
                    <tr>
                        <th id="tree#DOG2#HierarchyHeader#1#header" role="columnheader" title="Kennel/">
                            <span ct="CP">Kennel</span>
                        </th>
                        <th id="tree#DOG2#BREED_CODE#2#header" role="columnheader" title="Breed Code">
                            <span ct="CP">Breed Code</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td id="tree#DOG2#1#1" ct="HIC" role="gridcell">
                            <span ct="TV" role="button">North Yard</span>
                        </td>
                        <td id="tree#DOG2#1#2" ct="HIC" role="gridcell">
                            <span ct="TV" role="button">LAB</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <table id="dog-fallback-grid" ct="STCS" role="grid">
        <thead>
            <tr>
                <th id="dog-fallback-header-code" role="columnheader">
                    <span ct="CP">Dog Code</span>
                </th>
                <th id="dog-fallback-header-breed" role="columnheader">
                    <span ct="CP">Breed Name</span>
                </th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td id="dog-fallback-cell-code" ct="STC" role="gridcell">
                    <span ct="CP">LAB</span>
                </td>
                <td id="dog-fallback-cell-breed" ct="STC" role="gridcell">
                    <span ct="CP">Labrador Retriever</span>
                </td>
            </tr>
        </tbody>
    </table>
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

    test('textbox label from sibling structure', async ({ page }) => {
        await expect(page.locator("webgui=textbox[label='Legacy Field']")).toHaveId('legacy-field')
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

    test('button label supports shortcut titles', async ({ page }) => {
        await expect(page.locator("webgui=button[label='Execute']")).toHaveId('execute-action')
    })

    test('checkbox label from inline span', async ({ page }) => {
        await expect(page.locator("webgui=checkbox[label='Approval required']")).toHaveId(
            'approval-required',
        )
    })

    test('link label from inline span', async ({ page }) => {
        await expect(page.locator("webgui=link[label='Open Details']")).toHaveId('details-link')
    })

    test('class aliases map to constructor-style selectors', async ({ page }) => {
        await expect(page.locator("webgui=textfield[label='Person ID']")).toHaveId('person-id')
        await expect(page.locator("webgui=dropdownfield[label='Country']")).toHaveId('country-code')
        await expect(page.locator("webgui=dropdownbutton[label='Execute']")).toHaveId(
            'execute-action',
        )
        await expect(page.locator("webgui=radiogroup[label='Ship by Air']")).toHaveId('ship-air')
        await expect(page.locator("webgui=modal[label='Confirm Save']")).toHaveId('confirm-modal')
        await expect(page.locator("webgui=section[label='Advanced Options']")).toHaveId(
            'advanced-section',
        )
        await expect(page.locator("webgui=statictext[value='Ready for processing']")).toHaveId(
            'status-text',
        )
        await expect(page.locator("webgui=textrangefields[group='Start'][part='from']")).toHaveId(
            'start-from',
        )
        await expect(page.locator("webgui=webguielement[id='person-id']")).toHaveId('person-id')
    })

    test('supports webgui classes from python helpers', async ({ page }) => {
        await expect(page.locator("webgui=box[label='Additional actions']")).toHaveId(
            'actions-group',
        )
        await expect(page.locator("webgui=tabstrip[tab='Details']")).toHaveId('main-tabs')
        await expect(page.locator("webgui=modalwindow[label='Confirm Save']")).toHaveId(
            'confirm-modal',
        )
        await expect(page.locator("webgui=messagebar[value='Document saved']")).toHaveId(
            'footer-message',
        )
        await expect(page.locator('webgui=abaplist')).toHaveId('activity-list')
        await expect(page.locator("webgui=abaplistelement[label='Payroll Entry']")).toHaveId(
            'activity-item',
        )
        await expect(page.locator("webgui=text[value='Ready for processing']")).toHaveId(
            'status-text',
        )
        await expect(page.locator('webgui=messagearea')).toHaveId('message-area')
        await expect(page.locator("webgui=expandablesection[label='Advanced Options']")).toHaveId(
            'advanced-section',
        )
        await expect(page.locator("webgui=tree[column='Infotype Name']")).toHaveId(
            'infotype-table',
        )
    })

    test('supports role-based tabs by user-facing text', async ({ page }) => {
        await expect(page.locator("webgui=tab[label='Labrador']")).toHaveId('dog-tab-labrador')
        await expect(page.locator("webgui=tab[value='Beagle']")).toHaveId('dog-tab-beagle')
    })

    test('supports menuitemradio options by aria-label and text', async ({ page }) => {
        await expect(page.locator("webgui=option[label='Labrador Option']")).toHaveId(
            'dog-menu-labrador',
        )
        await expect(page.locator("webgui=option[value='Beagle Option']")).toHaveId(
            'dog-menu-beagle',
        )
    })

    test('table ct ST is treated as table', async ({ page }) => {
        await expect(page.locator("webgui=table[label='Legacy Table']")).toHaveId('legacy-st')
        await expect(
            page.locator(
                "webgui=textbox[table='Legacy Table'][row='Legacy Row 1'][column='Value']",
            ),
        ).toHaveId('legacy-st[1,2]#input')
    })

    test('table selector by column header', async ({ page }) => {
        await expect(page.locator("webgui=table[column='Infotype Name']")).toHaveId(
            'infotype-table',
        )
    })

    test('table selector by cell value', async ({ page }) => {
        await expect(page.locator("webgui=table[cell='Permanent Residence']")).toHaveId(
            'infotype-table',
        )
        await expect(page.locator("webgui=table[value='Address']")).toHaveId('infotype-table')
    })

    test('vim popup table selector by visual label', async ({ page }) => {
        await expect(
            page.locator("webgui=table[label='Select the desired referral option']"),
        ).toHaveId('C321')
    })

    test('vim popup table selector by column header', async ({ page }) => {
        await expect(page.locator("webgui=table[column='Option Short Text']")).toHaveId('C321')
        await expect(page.locator("webgui=table[column='Receiving Actor']")).toHaveId('C321')
    })

    test('vim popup table selector by cell text', async ({ page }) => {
        await expect(page.locator("webgui=table[cell='Refer to AP Supervisor']")).toHaveId('C321')
        await expect(page.locator("webgui=table[value='AP_SUPERVISOR']")).toHaveId('C321')
    })

    test('tree-style table selector by column header', async ({ page }) => {
        await expect(page.locator("webgui=table[column='Pup Name']")).toHaveId('tree#DOG1')
        await expect(page.locator("webgui=tree[column='Pup Name']")).toHaveId('tree#DOG1')
    })

    test('tree-style table selector by cell value', async ({ page }) => {
        await expect(page.locator("webgui=table[column='Pup Name'][cell='Labrador']")).toHaveId(
            'tree#DOG1',
        )
        await expect(page.locator("webgui=tree[column='Pup Name'][value='Labrador']")).toHaveId(
            'tree#DOG1',
        )
    })

    test('tree-style table selector with named header ids', async ({ page }) => {
        await expect(page.locator("webgui=table[column='Breed Code']")).toHaveId('tree#DOG2')
        await expect(page.locator("webgui=table[column='Breed Code'][cell='LAB']")).toHaveId(
            'tree#DOG2',
        )
    })

    test('role-based table selector without coordinate ids', async ({ page }) => {
        await expect(page.locator("webgui=table[column='Dog Code']")).toHaveId('dog-fallback-grid')
        await expect(page.locator("webgui=table[column='Breed Name']")).toHaveId('dog-fallback-grid')
        await expect(page.locator("webgui=table[cell='Labrador Retriever']")).toHaveId(
            'dog-fallback-grid',
        )
        await expect(page.locator("webgui=table[column='Dog Code'][value='LAB']")).toHaveId(
            'dog-fallback-grid',
        )
    })

    test('type only', async ({ page }) => {
        await expect(page.locator('webgui=textbox')).toHaveCount(9)
    })
})

test.describe('type filtering', () => {
    test('non matching type returns no result', async ({ page }) => {
        await expect(page.locator("webgui=checkbox[label='Person ID']")).toHaveCount(0)
    })

    test('cbs text field is not matched as checkbox', async ({ page }) => {
        await expect(page.locator("webgui=checkbox[label='Legacy Field']")).toHaveCount(0)
    })
})

test('invalid css-like type throws', ({ page }) =>
    expect(page.locator("webgui=banana[label='Person ID']").isVisible()).rejects.toThrow(
        /unsupported webgui control type "banana"/u,
    ))
