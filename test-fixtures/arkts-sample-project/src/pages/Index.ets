import { router } from '@kit.ArkUI';

@Entry
@Component
struct Index {
  @State message: string = 'Hello ArkTS';
  @State counter: number = 0;

  aboutToAppear() {
    console.info('Index page is about to appear');
  }

  build() {
    Column({ space: 20 }) {
      Text(this.message)
        .fontSize(30)
        .fontWeight(FontWeight.Bold)

      Text(`Counter: ${this.counter}`)
        .fontSize(20)

      Button('Increment')
        .onClick(() => {
          this.counter++;
        })

      Button('Navigate to Hello')
        .onClick(() => {
          router.pushUrl({ url: 'pages/HelloWorld' });
        })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
