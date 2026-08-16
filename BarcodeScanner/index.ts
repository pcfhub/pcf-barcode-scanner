import { IInputs, IOutputs } from './generated/ManifestTypes';

/**
 * A standard (non-virtual) field control — no React needed for one text
 * input and a button.
 *
 * The only platform surface this reaches is `context.device
 * .getBarcodeValue()`. It's real (@types/powerapps-component-framework:
 * `Promise<string>`, no options), but there is no documented device support
 * outside an actual device — the demo sandbox rejects it deliberately
 * (`resources/js/demo-harness/context/Context.ts`'s `deviceUnavailable()`),
 * so the rejection path below isn't a hypothetical to handle "just in
 * case"; it's the path the published demo will exercise on every visit.
 */
export class BarcodeScanner implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container!: HTMLDivElement;
    private input!: HTMLInputElement;
    private scanButton!: HTMLButtonElement;
    private status!: HTMLSpanElement;
    private notifyOutputChanged!: () => void;
    private value = '';

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this.container = container;
        this.notifyOutputChanged = notifyOutputChanged;

        this.container.classList.add('BarcodeScanner');

        const row = document.createElement('div');
        row.className = 'BarcodeScanner-row';

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'BarcodeScanner-input';
        this.input.addEventListener('input', this.onInput);

        this.scanButton = document.createElement('button');
        this.scanButton.type = 'button';
        this.scanButton.className = 'BarcodeScanner-scan';
        this.scanButton.addEventListener('click', () => void this.onScan(context));

        row.appendChild(this.input);
        row.appendChild(this.scanButton);

        this.status = document.createElement('span');
        this.status.className = 'BarcodeScanner-status';
        this.status.setAttribute('role', 'status');

        this.container.appendChild(row);
        this.container.appendChild(this.status);

        this.render(context);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.render(context);
    }

    public getOutputs(): IOutputs {
        return { value: this.value };
    }

    public destroy(): void {
        this.input.removeEventListener('input', this.onInput);
    }

    private render(context: ComponentFramework.Context<IInputs>): void {
        const incoming = context.parameters.value.raw ?? '';

        // Guarded, not assigned unconditionally: writing `value` while the
        // user is typing moves the caret to the end on every keystroke.
        if (incoming !== this.value) {
            this.value = incoming;
            this.input.value = incoming;
        }

        this.scanButton.textContent = context.resources.getString('BarcodeScanner_ScanButton');
        this.input.disabled = context.mode.isControlDisabled;
        this.scanButton.disabled = context.mode.isControlDisabled;
    }

    private onInput = (): void => {
        this.value = this.input.value;
        this.status.textContent = '';
        this.notifyOutputChanged();
    };

    private async onScan(context: ComponentFramework.Context<IInputs>): Promise<void> {
        this.status.textContent = '';

        try {
            const scanned = await context.device.getBarcodeValue();
            this.value = scanned;
            this.input.value = scanned;
            this.notifyOutputChanged();
        } catch {
            // Real, expected outcome in the demo sandbox (see the class
            // docblock) and on any device with no camera or scanner
            // hardware — not an error state to log, just tell the visitor
            // typing still works.
            this.status.textContent = context.resources.getString('BarcodeScanner_Unavailable');
        }
    }
}
