// Unformatted ArkTS code
@Entry
@Component
struct Index {
@State message:string='Hello World'
@State counter:number=0

build() {
Column({space:20}) {
Text(this.message).fontSize(30).fontWeight(FontWeight.Bold)
Button('Click').onClick(()=>{
this.counter++
})
}
.width('100%')
}
}
