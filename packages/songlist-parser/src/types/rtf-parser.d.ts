declare module 'rtf-parser' {
  export interface RTFDocument {
    content: RTFContent[];
  }

  export type RTFContent = RTFText | RTFParagraph;

  export interface RTFText {
    type: 'text';
    value: string;
  }

  export interface RTFParagraph {
    type: 'paragraph';
    content: RTFContent[];
  }

  function parse(rtf: string, callback: (err: Error | null, doc: RTFDocument) => void): void;
  function parse(rtf: string): Promise<RTFDocument>;

  export = parse;
}
