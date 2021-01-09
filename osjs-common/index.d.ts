export as namespace osjs__common;

import { EventEmitter } from '@osjs/event-emitter';

export interface ServiceProvider {
    readonly core: CoreBase;
    readonly options: any;
    constructor(core: CoreBase, options: any);
    provides(): string[];
    init(): Promise<any>;
    start(): Promise<any>;
    destroy(): void;
}

export class CoreBase extends EventEmitter {
    readonly logger: any;
    readonly configuration: object;
    readonly options: object;
    booted: boolean;
    started: boolean;
    destroyed: boolean;
    providers: any;
    constructor(defaultConfiguration: object, configuration: object, options: object);
    destroy(): void;
    boot(): Promise<boolean>;
    start(): Promise<boolean>;
    config(key: string, defaultValue: any): any;
    register(ref: typeof ServiceProvider, options: ServiceProviderOptions): void;
    instance(name: string, callback: Function): void;
    singleton(name: string, callback: Function): void;
    make<T>(name: string, ...args: any[]): T;
    has(name: string): boolean;
}