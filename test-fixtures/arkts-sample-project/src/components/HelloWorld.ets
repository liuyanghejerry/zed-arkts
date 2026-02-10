export interface HelloWorldProps {
  title: string;
}

@Component
export struct HelloWorld {
  @Prop title: string = 'Hello';
  @State description: string = 'This is a sample component';

  build() {
    Column({ space: 10 }) {
      Text(this.title)
        .fontSize(24)
        .fontWeight(FontWeight.Bold)

      Text(this.description)
        .fontSize(16)
        .fontColor('#666666')

      Button('Click Me')
        .onClick(() => {
          this.description = 'Button clicked!';
        })
    }
    .padding(20)
  }
}
