/**
 * Adds the citation rule to the session so free questions typed in the Library composer can be
 * filed: every free turn is classified as an ask and offered Save answer. English, like the handoff
 * it follows.
 */
export const LIBRARY_HANDOFF_APPENDIX = [
  "This folder is also a Library: `sources/` holds the originals as they arrived, and `wiki/` holds the pages written from them, one page per original.",
  "When the person asks about the folder's documents, read the wiki pages first and then the originals they cite; read a DOCX, XLSX, CSV or text original through the `read_source` tool, and a PDF with your own reader. Do not fill gaps from outside the folder.",
  "Put a citation after every fact in your answer, in the wiki's own form: `[[src:sources/<file>#p<page>]]` (`#r<row>` for a table, `#l<line>` for a text file). The person can save your answer as a wiki page as it stands, and a citation in any other form does not count as evidence there. When the documents do not say, say so.",
].join(" ");
