// 简单的ETS示例 - 基础语法演示

import { hilog } from '@kit.PerformanceAnalysisKit';

// 常量定义
const APP_NAME: string = 'ETS Demo';
const VERSION: string = '1.0.0';

// 接口定义
interface User {
  id: number;
  name: string;
  age?: number;
}

// 枚举定义
enum Theme {
  LIGHT = 'light',
  DARK = 'dark'
}

// 类定义
class DataManager {
  private data: string[] = [];

  addData(item: string): void {
    this.data.push(item);
    hilog.info(0x0000, 'DATA_MANAGER', `添加数据: ${item}`);
  }

  getData(): string[] {
    return [...this.data];
  }

  clearData(): void {
    this.data = [];
    hilog.info(0x0000, 'DATA_MANAGER', '清空数据');
  }
}

@Entry
@Component
struct SimplePage {
  @State counter: number = 0;
  @State userInput: string = '';
  @State currentTheme: Theme = Theme.LIGHT;
  @State userList: User[] = [
    { id: 1, name: '张三', age: 25 },
    { id: 2, name: '李四', age: 30 }
  ];

  private dataManager = new DataManager();

  aboutToAppear() {
    hilog.info(0x0000, 'SIMPLE_PAGE', `${APP_NAME} v${VERSION} 启动`);
    this.dataManager.addData('初始化数据1');
    this.dataManager.addData('初始化数据2');
  }

  build() {
    Column() {
      // 标题
      Text(`${APP_NAME} - 简单示例`)
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 20, bottom: 20 })

      // 计数器
      Row() {
        Text(`计数: ${this.counter}`)
          .fontSize(16)
          .margin({ right: 20 })

        Button('+1')
          .onClick(() => {
            this.counter++;
            hilog.info(0x0000, 'COUNTER', `计数器更新: ${this.counter}`);
          })
          .margin({ right: 10 })

        Button('重置')
          .onClick(() => {
            this.counter = 0;
            hilog.info(0x0000, 'COUNTER', '计数器重置');
          })
      }
      .margin({ bottom: 20 })

      // 输入框
      TextInput({ placeholder: '请输入内容' })
        .width('80%')
        .height(40)
        .fontSize(14)
        .margin({ bottom: 10 })
        .onChange((value: string) => {
          this.userInput = value;
        })

      Text(`你输入的内容: ${this.userInput}`)
        .fontSize(14)
        .fontColor('#666666')
        .margin({ bottom: 20 })

      // 主题切换
      Row() {
        Text('主题:')
          .fontSize(16)
          .margin({ right: 20 })

        Button('浅色')
          .type(ButtonType.Capsule)
          .backgroundColor(this.currentTheme === Theme.LIGHT ? '#007DFF' : '#CCCCCC')
          .fontColor('#FFFFFF')
          .onClick(() => {
            this.currentTheme = Theme.LIGHT;
            hilog.info(0x0000, 'THEME', '切换到浅色主题');
          })
          .margin({ right: 10 })

        Button('深色')
          .type(ButtonType.Capsule)
          .backgroundColor(this.currentTheme === Theme.DARK ? '#007DFF' : '#CCCCCC')
          .fontColor('#FFFFFF')
          .onClick(() => {
            this.currentTheme = Theme.DARK;
            hilog.info(0x0000, 'THEME', '切换到深色主题');
          })
      }
      .margin({ bottom: 20 })

      // 用户列表
      Text('用户列表:')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .margin({ bottom: 10 })
        .width('100%')
        .textAlign(TextAlign.Start)

      Column() {
        ForEach(this.userList, (user: User) => {
          Row() {
            Text(`ID: ${user.id}`)
              .fontSize(14)
              .fontColor('#666666')
              .margin({ right: 16 })

            Text(`姓名: ${user.name}`)
              .fontSize(14)
              .fontWeight(FontWeight.Medium)
              .margin({ right: 16 })

            Text(`年龄: ${user.age || '未知'}`)
              .fontSize(14)
              .fontColor('#666666')
          }
          .width('100%')
          .padding(12)
          .backgroundColor('#F5F5F5')
          .borderRadius(6)
          .margin({ bottom: 8 })
        })
      }
      .width('90%')

      // 数据管理器操作
      Divider()
        .margin({ top: 20, bottom: 20 })

      Text('数据管理:')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .margin({ bottom: 10 })

      Row() {
        Button('添加数据')
          .onClick(() => {
            const newData = `数据${this.dataManager.getData().length + 1}`;
            this.dataManager.addData(newData);
          })
          .margin({ right: 10 })

        Button('查看数据')
          .onClick(() => {
            const allData = this.dataManager.getData();
            hilog.info(0x0000, 'DATA_VIEW', `所有数据: ${JSON.stringify(allData)}`);
          })
          .margin({ right: 10 })

        Button('清空数据')
          .onClick(() => {
            this.dataManager.clearData();
          })
      }
    }
    .width('100%')
    .height('100%')
    .padding(20)
    .backgroundColor(this.currentTheme === Theme.LIGHT ? '#FFFFFF' : '#1A1A1A')
  }
}
