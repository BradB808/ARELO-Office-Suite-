// Minimal type shim for the `turndown` package (ships no types of its own).
// Covers only the surface Anleo Docs uses.
declare module 'turndown' {
  type TurndownFilter = string | string[] | ((node: HTMLElement, options: TurndownOptions) => boolean)

  interface TurndownRule {
    filter: TurndownFilter
    replacement: (content: string, node: HTMLElement, options: TurndownOptions) => string
  }

  interface TurndownOptions {
    headingStyle?: 'setext' | 'atx'
    hr?: string
    bulletListMarker?: string
    codeBlockStyle?: 'indented' | 'fenced'
    fence?: string
    emDelimiter?: string
    strongDelimiter?: string
    linkStyle?: 'inlined' | 'referenced'
    linkReferenceStyle?: string
    br?: string
    preformattedCode?: boolean
  }

  export default class TurndownService {
    options: TurndownOptions
    constructor(options?: TurndownOptions)
    addRule(key: string, rule: TurndownRule): this
    keep(filter: TurndownFilter): this
    remove(filter: TurndownFilter): this
    turndown(input: string): string
    use(plugin: ((service: TurndownService) => void) | Array<(service: TurndownService) => void>): this
    escape(text: string): string
  }
}
