import { resourceManager } from '@kit.LocalizationKit';

const MAX_ITEMS: number = 3;

interface ItemData {
  title: string;
}

enum LoadState {
  Ready,
  Loading,
}

class ItemStore {
  getTitle(value: ItemData): string {
    return value.title;
  }
}

function normalizeTitle(value: string): string {
  return value.trim();
}

@Entry
@Component
struct Dashboard {
  // Text displayed in the main card.
  @State title: string = 'HarmonyOS';
  private sizes: number[] = [
    16,
    20,
  ];

  updateTitle(value: string): void {
    this.title = normalizeTitle(value);
  }

  build() {
    Column() {
      Text(this.title)
        .fontSize(this.sizes[0])
      Text($r('app.string.app_name'))
    }
  }
}
