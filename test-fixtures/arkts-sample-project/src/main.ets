import { HelloWorld } from './components/HelloWorld';

// Application entry point
@Entry
@Component
struct MainApp {
  build() {
    Column() {
      HelloWorld({ title: 'ArkTS Sample Application' })
    }
  }
}
