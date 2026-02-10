import { HelloWorld } from '../components/HelloWorld';

@Entry
@Component
struct HelloWorldPage {
  build() {
    Column() {
      HelloWorld({ title: 'Welcome to ArkTS Testing' })
    }
    .width('100%')
    .height('100%')
  }
}
