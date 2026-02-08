# playwright ui5

playwright [custom selector engines](https://playwright.dev/docs/extensibility#custom-selector-engines) for [sapui5](https://ui5.sap.com/)

## installation

### if using playwright for nodejs

```bash
npm install playwright-ui5
```

### if using playwright for python

```bash
uv add playwright-ui5-select
```

see the [playwright-ui5-select](https://github.com/JamesYFC/playwright-ui5-select) repo for usage instructions

## usage

playwright-ui5 contains a selector engine for both css and xpath syntax. you can use whichever one you want, but the xpath one is more flexible since not all css selector syntax has been implemented yet.

### css selector engine

```ts
import { selectors, test } from '@playwright/test'
import { css } from 'playwright-ui5'

test.beforeAll(async () => {
    await selectors.register('ui5', css)
})

test('ui5 example', ({ page }) => {
    await page.goto('https://ui5.sap.com/')
    await page.click("ui5=sap.m.Button[text='Get Started with UI5']")
})
```

#### syntax

the main difference between regular CSS selectors and playwright-ui5's syntax is is that `.` is not used for class names, rather they are treated as part of the type name (ie. `sap.m.Button`).

| feature             | examples                                                   | suported | notes                                                                                                                                         |
| ------------------- | ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| type selectors      | `sap.m.Button`, `m.Button`, `*`                            | ✔        |
| class selectors     | n/a                                                        | n/a      | as mentioned above, `.` is treated as part of the control type                                                                                |
| attribute selectors | `[text]`, `[text='foo']`, `[text*='foo']` ,`[text~='foo']` | ✔        | `~=` trims leading and trailing whitespace for the whole value instead of matching a whitespace-separated list of values like it does in CSS. |
| id selectors        | `sap.m.Button#foo`                                         | ✔        | you should not use id selectors if the id is generated (eg. `__button1`) as they can change often                                             |
| nesting             | `sap.m.Table sap.m.Button`,`sap.m.Table > sap.m.Button`    | ❌       | use playwright selector nesting instead (`ui5=sap.m.Table >> ui5=sap.m.Button`)                                                               |
| pseudo-classes      | `sap.m.Table:has(sap.m.Button)`                            | ✔        | only `:has` is supported for now                                                                                                              |
| pseudo-elements     | `sap.m.DateTimeField::subclass`                            | ✔        | `::subclass` will match the specified control type and any subtypes (eg. both `sap.m.DateTimeField` and subtypes like `sap.m.DatePicker`)     |
| selector lists      | `sap.m.Button,sap.m.Table`                                 | ✔        |

### xpath selector engine

```ts
import { selectors, test } from '@playwright/test'
import { xpath } from 'playwright-ui5'

test.beforeAll(async () => {
    await selectors.register('ui5', xpath)
})

test('ui5 example', ({ page }) => {
    await page.goto('https://ui5.sap.com/')
    await page.click("ui5=//sap.m.Button[ui5:property(., 'text')='Get Started with UI5']")
})
```

#### syntax

unlike the CSS selector syntax, all xpath syntax is supported (even newer xpath features up to version 3.1 thanks to [fontoxpath](https://github.com/FontoXML/fontoxpath)).

note that properties cannot be accessed via the `@attribute` syntax. this is because the selector engine needs to build an XML tree of all the ui5 elements on the page, and for performance reasons the properties are not evaluated during this step, so the only attribute that can be accessed that way is the element's ID.

for example, for a button with the id `"foo"` and the text `"bar"`, the xml view may look like this:

```xml
<sap.m.Page id="__page0">
    <sap.m.Button id="foo"></sap.m.Button>
</sap.m.Page>
```

in this case, `//sap.m.Button[@id='foo']` will work, but `//sap.m.Button[@text='bar']` will not. to access the property, you can use the [`ui5:property`](#ui5property) xpath function instead, like so:

```xpath
//sap.m.Button[ui5:property(., 'text')='bar']
```

the XML view matches the control tree from the [ui5 diagnostics window](https://sapui5.hana.ondemand.com/sdk/#/topic/04b75eae78ef4bae9b40cd7540ae8bdc) and the [ui5 inspector chrome extension](https://chromewebstore.google.com/detail/ui5-inspector/bebecogbafbighhaildooiibipcnbngo), so we recommend using one of these when working with the ui5 xpath selector engine.

#### the root node

since the ui5 control tree can have multiple root nodes, the xpath selector engine wraps `sap-ui-area` nodes inside a `root` node:

```xml
<root>
    <sap-ui-area id="sap-ui-static">
        <sap.m.Page id="__page0">
            <sap.m.Button id="foo"></sap.m.Button>
        </sap.m.Page>
    </sap-ui-area>
    <sap-ui-area id="canvas">
</root>
```

#### API

the following xpath functions are available in the `ui5:` namespace:

##### `ui5:property`

-   **arguments:** `element()`, `xs:string`
-   **return type:** `item()*`

gets the value for the property with the specified name from the specified element

```xpath
//sap.m.Button[ui5:property(., "text")="Click here"]
```

##### `ui5:debug-xml`

-   **arguments:** `element()`
-   **return type:** N/A (always throws an exception)

raises an exception containining the XML control tree with the specified element as the root. this function is only intended for debugging purposes.

```xpath
ui5:debug-xml(/*)
```

this will throw an exception containing the entire control tree for the page in XML format:

```
playwright-ui5 debug-xml function was called. here is the XML element tree:

<sap-ui-area id="sap-ui-static">
    <!-- ... -->
</sap-ui-area>
```

### webgui selector engine

```ts
import { selectors, test } from '@playwright/test'
import { webgui } from 'playwright-ui5'

test.beforeAll(async () => {
    await selectors.register('webgui', webgui)
})

test('webgui example', async ({ page }) => {
    await page.goto('file:///path/to/webgui-page.html')
    await page.fill("webgui=textbox[label='Breed search']", 'Labrador Retriever')
    await page.fill("webgui=textbox[group='Ranking'][part='from']", '1')
    await page.fill("webgui=textbox[group='Ranking'][part='to']", '10')
})
```

#### syntax

the webgui selector engine focuses on user-facing selectors and table fallbacks:

-   css-like syntax: `webgui=<type>[key='value'][key='value']...`
-   supported types: `textbox`, `button`, `checkbox`, `radio`, `combobox`, `listbox`, `option`, `spinbutton`, `table`, `link`, `*`
-   supported keys:
    -   `label`: matches controls by visible label text
    -   `group`: matches range groups (for example `Ranking` + `to`)
    -   `part=from|to`: selects one side of a range group
    -   `table`, `row`, `column`: fallback for unlabeled table controls
    -   `id`: final fallback when no visible label exists
    -   `title` and `role`: optional extra filters
    -   `value` and `checked=true|false`: value/state filters for lists, radios, checkboxes, and inputs
    -   `index=<n>`: 1-based index when multiple elements match

#### table iteration example

```ts
test('webgui table workflow', async ({ page }) => {
    await page.goto('file:///path/to/webgui-page.html')

    const dogBreedsTable = {
        columnInputs: (column: string) =>
            page.locator(`webgui=textbox[table='Most Popular Dog Breeds'][column='${column}']`),
    }

    const breedColumn = dogBreedsTable.columnInputs('Breed')
    const originColumn = dogBreedsTable.columnInputs('Origin')
    const popularityColumn = dogBreedsTable.columnInputs('Popularity Score')
    const featuredBreeds = [
        'Labrador Retriever',
        'French Bulldog',
        'Golden Retriever',
        'German Shepherd',
        'Poodle',
    ]

    // row count is discovered at runtime (unknown number of rows)
    const rowCount = await breedColumn.count()

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        const rowNumber = rowIndex + 1
        await breedColumn.nth(rowIndex).fill(featuredBreeds[rowIndex] ?? `Breed ${rowNumber}`)
        await originColumn.nth(rowIndex).fill(`Region ${rowNumber}`)
        await popularityColumn.nth(rowIndex).fill(String(100 - rowIndex))
    }
})
```

## chrome extension picker (experimental)

this repo now includes a standalone chrome extension picker at `chrome-extension/` that does not depend on playwright runtime.

### load extension

1. open `chrome://extensions`
2. enable **developer mode**
3. click **load unpacked**
4. select the `playwright-ui5/chrome-extension` folder

### use extension

1. click the extension icon and press **start picker**
2. hover elements to inspect targets
3. click an element to capture selector candidates
4. copy a candidate from the popup

### pinned panel (always visible)

if you want the picker UI to stay visible while you work:

1. open the extension popup
2. click **open pinned panel**
3. chrome opens the extension in the side panel, which stays pinned and updates as you pick

the picker generates:

-   `webgui=...` selectors for sap webgui pages (label, range group, table fallback, id fallback)
-   `ui5_css=...` / `ui5_xpath=...` selectors for sapui5 pages
-   dom fallback selectors on non-sap pages

### shortcut

-   `Alt+Shift+P` toggles picker on the active tab
