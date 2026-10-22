export type ModalType = "info" | "success" | "warning" | "error" | "confirm";

export interface ModalOptions {
  type?: ModalType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  duration?: number; // Авто-закрытие через N миллисекунд (по умолчанию 2000 мс)
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ModalState extends ModalOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

type Listener = (state: ModalState) => void;

class ModalBus {
  private state: ModalState = {
    isOpen: false,
    title: "",
    type: "info",
  };

  private listeners = new Set<Listener>();
  private timer: any = null;

  public subscribe = (listener: Listener): () => void => {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): ModalState => {
    return this.state;
  };

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public open(options: ModalOptions) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const duration = options.duration !== undefined ? options.duration : 2000;

    this.state = {
      ...options,
      isOpen: true,
      duration,
      type: options.type || "info",
    };
    this.notify();

    // Автоматическое закрытие через duration мс (если duration > 0 и это не confirm)
    if (options.type !== "confirm" && duration > 0) {
      this.timer = setTimeout(() => {
        this.close();
      }, duration);
    }
  }

  public close() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.state.isOpen) return;

    if (this.state.resolve) {
      this.state.resolve(false);
    }

    if (this.state.onCancel) {
      this.state.onCancel();
    }

    this.state = {
      ...this.state,
      isOpen: false,
      resolve: undefined,
    };
    this.notify();
  }

  public confirmAction() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.state.resolve) {
      this.state.resolve(true);
    }
    if (this.state.onConfirm) {
      this.state.onConfirm();
    }
    this.state = {
      ...this.state,
      isOpen: false,
      resolve: undefined,
    };
    this.notify();
  }

  // --- Методы с автоматическим ожиданием 2 секунды (возвращают Promise) ---

  public async info(title: string, message?: string, duration = 2000): Promise<void> {
    this.open({ type: "info", title, message, duration });
    await new Promise((r) => setTimeout(r, duration));
  }

  public async success(title: string, message?: string, duration = 2000): Promise<void> {
    this.open({ type: "success", title, message, duration });
    await new Promise((r) => setTimeout(r, duration));
  }

  public async warning(title: string, message?: string, duration = 2000): Promise<void> {
    this.open({ type: "warning", title, message, duration });
    await new Promise((r) => setTimeout(r, duration));
  }

  public async error(title: string, message?: string, duration = 2000): Promise<void> {
    this.open({ type: "error", title, message, duration });
    await new Promise((r) => setTimeout(r, duration));
  }

  public confirm(
    title: string,
    message?: string,
    options?: Partial<ModalOptions>
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.state = {
        title,
        message,
        type: "confirm",
        confirmText: options?.confirmText || "Подтвердить",
        cancelText: options?.cancelText || "Отмена",
        isOpen: true,
        resolve,
      };
      this.notify();
    });
  }
}

export const modal = new ModalBus();
