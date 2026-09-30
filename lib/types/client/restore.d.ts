export declare const LOCK = "\uD83D\uDD12";
export interface RestoreHandle {
    dispose(): void;
    setEnabled(enabled: boolean): void;
}
export declare function startRestore(resolveUrl: string): RestoreHandle;
