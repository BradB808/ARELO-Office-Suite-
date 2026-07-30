// Type shim for Vite's built-in `?raw` import suffix (loads a file's contents
// as a plain string at build time). Used by livingExport.ts to embed the
// generated formula-engine bundle into the "Living spreadsheet" export.
declare module '*?raw' {
  const content: string
  export default content
}
