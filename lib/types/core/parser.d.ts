import type { TabularDocument } from "./types.js";
export declare function parseDocument(fileName: string, bytes: Uint8Array): Promise<TabularDocument>;
export declare function serializeDocument(document: TabularDocument): Promise<Uint8Array>;
