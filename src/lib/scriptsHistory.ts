const MAX_HISTORY = 50;

class ScriptsHistoryManager {
  private past: string[] = [];
  private present: string = "";
  private future: string[] = [];

  // Инициализация при старте приложения
  public init(initialJs: string) {
    this.present = initialJs || "";
    this.past = [];
    this.future = [];
    this.broadcast();
  }

  // Фиксация новой ревизии скриптов
  public record(newJs: string) {
    if (newJs === this.present) return;

    this.past.push(this.present);
    if (this.past.length > MAX_HISTORY) {
      this.past.shift();
    }
    this.present = newJs;
    this.future = []; // Сброс redo
    this.broadcast();
  }

  // Откат назад
  public undo(): string | null {
    if (this.past.length === 0) return null;

    const previous = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = previous;
    this.broadcast();
    return this.present;
  }

  // Возврат вперед
  public redo(): string | null {
    if (this.future.length === 0) return null;

    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;
    this.broadcast();
    return this.present;
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  private broadcast() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-history-changed", {
          detail: {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
          },
        }),
      );
    }
  }
}

export const scriptsHistory = new ScriptsHistoryManager();
