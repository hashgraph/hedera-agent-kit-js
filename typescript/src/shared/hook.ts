import { Client } from '@hashgraph/sdk';
import type { Context } from './configuration';

export interface PreToolExecutionParams<TParams = any> {
  context: Context;
  rawParams: TParams;
  client: Client;
}

export interface PostParamsNormalizationParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
  client: Client;
}

export interface PostCoreActionParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
  coreActionResult: any;
  client: Client;
}

export interface PostSecondaryActionParams<TParams = any, TNormalisedParams = any> {
  context: Context;
  rawParams: TParams;
  normalisedParams: TNormalisedParams;
  coreActionResult: any;
  toolResult: any;
  client: Client;
}

/**
 * Abstract class for defining hooks that can be used to extend the functionality of the Hedera-Agent-Kit.
 * Hooks are executed in the order they are defined in the relevant tool's class.'
 */
export abstract class AbstractHook {
  public abstract name: string;
  public abstract description?: string;
  public abstract relevantTools: string[];

  public async preToolExecutionHook(_params: PreToolExecutionParams, method: string): Promise<any> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
  }

  public async postParamsNormalizationHook(
    _params: PostParamsNormalizationParams,
    method: string,
  ): Promise<any> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
  }

  public async postCoreActionHook(_params: PostCoreActionParams, method: string): Promise<any> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
  }

  public async postToolExecutionHook(
    _params: PostSecondaryActionParams,
    method: string,
  ): Promise<any> {
    if (!this.relevantTools.includes(method)) return; // break execution if this hook does not apply to the current tool
  }
}
