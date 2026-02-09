import type { Context } from './configuration';

export interface PreToolExecutionParams<TParams = any> {
    context: Context;
    rawParams: TParams;
}

export interface PostParamsNormalizationParams<TParams = any, TNormalisedParams = any> {
    context: Context;
    rawParams: TParams;
    normalisedParams: TNormalisedParams;
}

export interface PostCoreActionParams<TParams = any, TNormalisedParams = any> {
    context: Context;
    rawParams: TParams;
    normalisedParams: TNormalisedParams;
    coreActionResult: any;
}

export interface PostSecondaryActionParams<TParams = any, TNormalisedParams = any> {
    context: Context;
    rawParams: TParams;
    normalisedParams: TNormalisedParams;
    coreActionResult: any;
    toolResult: any;
}

export type AnyHookParams =
    | PreToolExecutionParams
    | PostParamsNormalizationParams
    | PostCoreActionParams
    | PostSecondaryActionParams;

export abstract class Hook {
    abstract name: string;
    abstract description?: string;
    abstract relevantTools: string[];

    async preToolExecutionHook(
        _context: Context,
        _params: PreToolExecutionParams,
    ): Promise<any> { }

    async postParamsNormalizationHook(
        _context: Context,
        _params: PostParamsNormalizationParams,
    ): Promise<any> { }

    async postCoreActionHook(
        _context: Context,
        _params: PostCoreActionParams,
    ): Promise<any> { }

    async postSecondaryActionHook(
        _context: Context,
        _params: PostSecondaryActionParams,
    ): Promise<any> { }
}
