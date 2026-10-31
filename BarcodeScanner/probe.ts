import { IInputs } from './generated/ManifestTypes';

/*
 * PROBE 0.2.9 — throwaway. Delete this file and its two calls in index.ts
 * before 0.3.0 is built.
 *
 * Asks the desktop model-driven form what 0.3.0 rests on (SPEC.md, P1–P4):
 *
 *   P1  is `context.device.getBarcodeValue` there in a desktop browser, and
 *       what does a call do — shape, message, time;
 *   P2  does `value` as a type group import over 0.2.2 and keep its binding;
 *   P3  what `attributes` (MaxLength, Format) a single-line, a text-area and
 *       a multiple-lines column hand over;
 *   P4  what a value with a newline does in each.
 *
 * Passive: every pass is logged per bound column. Active, from the console:
 *
 *   __barcodeProbe.list()
 *   __barcodeProbe.passes('cll_barcode')
 *   await __barcodeProbe.scan('cll_barcode')
 *   __barcodeProbe.write('cll_barcode', 'A\nB')
 *   __barcodeProbe.tokens('cll_barcode')
 */

type Context = ComponentFramework.Context<IInputs>;

interface Instance {
    context: Context;
    container: HTMLElement;
    write: (value: string) => void;
    passes: unknown[];
}

const TOKENS = [
    '--colorNeutralBackground1',
    '--colorNeutralBackground3',
    '--colorNeutralForeground1',
    '--colorNeutralStroke1',
    '--colorNeutralStrokeAccessible',
    '--colorCompoundBrandStroke',
    '--colorBrandForeground1',
    '--colorTransparentStroke',
    '--colorStrokeFocus2',
    '--borderRadiusMedium',
    '--fontFamilyBase',
    '--fontSizeBase300',
    '--fontSizeBase200',
];

const instances = new Map<string, Instance>();

function columnOf(context: Context, fallback: number): string {
    const attributes = context.parameters.value.attributes as { LogicalName?: string } | undefined;

    return attributes?.LogicalName ?? `instance${fallback}`;
}

function attributesOf(context: Context): Record<string, unknown> {
    const attributes = (context.parameters.value.attributes ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(attributes)) {
        const value = attributes[key];

        out[key] = typeof value === 'function' ? 'function' : value;
    }

    return out;
}

function tokensAt(element: HTMLElement): Record<string, string> {
    const style = getComputedStyle(element);
    const out: Record<string, string> = {};

    for (const token of TOKENS) {
        out[token] = style.getPropertyValue(token).trim();
    }

    return out;
}

function summary(context: Context, first: boolean): Record<string, unknown> {
    const device = context.device as unknown as Record<string, unknown> | undefined;
    const base: Record<string, unknown> = {
        at: new Date().toISOString(),
        updated: context.updatedProperties,
        type: context.parameters.value.type,
        raw: context.parameters.value.raw,
        disabled: context.mode.isControlDisabled,
    };

    if (!first) {
        return base;
    }

    return {
        ...base,
        attributes: attributesOf(context),
        security: context.parameters.value.security,
        client: context.client.getClient(),
        formFactor: context.client.getFormFactor(),
        isDarkTheme: context.fluentDesignLanguage?.isDarkTheme,
        deviceType: typeof device,
        deviceKeys: device ? Object.keys(device) : null,
        getBarcodeValue: typeof device?.getBarcodeValue,
        clientUrl: (() => {
            try {
                return (context as unknown as { page?: { getClientUrl?: () => string } }).page?.getClientUrl?.() ?? null;
            } catch (error) {
                return `throws: ${String(error)}`;
            }
        })(),
    };
}

/** Called once per instance from `init`. */
export function attach(context: Context, container: HTMLElement, write: (value: string) => void): void {
    const column = columnOf(context, instances.size);
    const instance: Instance = { context, container, write, passes: [] };

    instances.set(column, instance);
    instance.passes.push({ init: true, ...summary(context, true) });
    // eslint-disable-next-line no-console
    console.log('[barcodeProbe] init', column, instance.passes[0]);
}

/** Called from every `updateView`. */
export function pass(context: Context): void {
    const column = columnOf(context, 0);
    const instance = instances.get(column);

    if (!instance) {
        return;
    }

    instance.context = context;

    if (instance.passes.length < 40) {
        instance.passes.push(summary(context, false));
    }
}

function get(column: string): Instance {
    const instance = instances.get(column);

    if (!instance) {
        throw new Error(`No probe instance for ${column}; have ${[...instances.keys()].join(', ')}`);
    }

    return instance;
}

function describe(error: unknown): Record<string, unknown> {
    if (error === null || typeof error !== 'object') {
        return { kind: typeof error, value: error };
    }

    const record = error as Record<string, unknown>;
    const out: Record<string, unknown> = {
        kind: Object.prototype.toString.call(error),
        isError: error instanceof Error,
        keys: Object.keys(record),
    };

    for (const key of ['name', 'message', 'code', 'errorCode', 'raw', 'title']) {
        if (key in record) {
            out[key] = record[key];
        }
    }

    try {
        out.json = JSON.stringify(error);
    } catch {
        out.json = 'unserialisable';
    }

    return out;
}

const api = {
    list: (): string[] => [...instances.keys()],

    passes: (column: string): unknown[] => get(column).passes,

    tokens: (column: string): Record<string, string> => tokensAt(get(column).container),

    write: (column: string, value: string): string => {
        get(column).write(value);

        return `wrote ${JSON.stringify(value)} to ${column}`;
    },

    scan: async (column: string, waitMs = 15000): Promise<Record<string, unknown>> => {
        const device = get(column).context.device as unknown as { getBarcodeValue?: () => Promise<string> } | undefined;

        if (typeof device?.getBarcodeValue !== 'function') {
            return { outcome: 'absent', deviceType: typeof device };
        }

        const started = performance.now();
        let call: Promise<string>;

        try {
            call = device.getBarcodeValue();
        } catch (error) {
            return { outcome: 'threw synchronously', ms: Math.round(performance.now() - started), error: describe(error) };
        }

        const timeout = new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), waitMs));

        try {
            const value = await Promise.race([call, timeout]);
            const ms = Math.round(performance.now() - started);

            return value === 'pending' ? { outcome: 'still pending', ms } : { outcome: 'resolved', ms, value, valueType: typeof value };
        } catch (error) {
            return { outcome: 'rejected', ms: Math.round(performance.now() - started), error: describe(error) };
        }
    },
};

(window as unknown as { __barcodeProbe: typeof api }).__barcodeProbe = api;
