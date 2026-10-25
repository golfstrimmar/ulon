const MAX_HISTORY = 50;

class StyleHistoryManager {
  private past: string[] = [];
  private present: string = "";
  private future: string[] = [];

  // Инициализируем при старте приложения
  public init(initialScss: string) {
    this.present = initialScss || "";
    this.past = [];
    this.future = [];
    this.broadcast();
  }

  // Фиксируем новый снимок (вызывается при Save / Blur)
  public record(newScss: string) {
    if (newScss === this.present) return;

    this.past.push(this.present);
    if (this.past.length > MAX_HISTORY) {
      this.past.shift();
    }
    this.present = newScss;
    this.future = []; // При новом действии ветка redo сбрасывается
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

  // Уведомляем компоненты об изменении доступности Undo / Redo
  private broadcast() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("plaza-style-history-changed", {
          detail: {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
          },
        }),
      );
    }
  }
}

export const styleHistory = new StyleHistoryManager();
