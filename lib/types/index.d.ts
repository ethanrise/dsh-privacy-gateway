import type { Context } from "@deepseek-ai/cordis";
import { type TextEntity } from "./core/textmask.js";
export declare const inject: readonly ["connection"];
export interface Config {
    /** Mask conversation text before it reaches the model (and the session log). */
    maskMessages?: boolean;
    /** Also mask tool results; off by default because the model may then write placeholders into files. */
    maskToolResults?: boolean;
    entities?: TextEntity[];
    /** Keep the placeholder table on disk so history still restores after a restart. */
    persistVault?: boolean;
    maxVaultEntries?: number;
    /** Where the word list lives; an empty string keeps it in memory only (tests). */
    dictionaryFile?: string;
}
export declare function apply(ctx: Context, config?: Config): void;
