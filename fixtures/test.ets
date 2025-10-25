// 鸿蒙ETS示例脚本 - 包含第三方库依赖
// 这是一个示例的ETS (Enhanced TypeScript) 文件

// 导入鸿蒙系统库
import { hilog } from '@kit.PerformanceAnalysisKit';
import { router } from '@kit.ArkUI';

// 导入第三方库示例
import { axios } from '@ohos/axios';
import { lodash } from '@ohos/lodash';
import { moment } from '@ohos/moment';

@Entry
@Component
struct TestPage {
  @State message: string = 'Hello ETS with Third-party Libraries';
  @State userInfo: UserInfo | null = null;
  @State currentTime: string = '';
  @State isLoading: boolean = false;

  // 用户信息接口
  interface UserInfo {
    id: number;
    name: string;
    email: string;
    avatar: string;
  }

  aboutToAppear() {
    // 页面加载时初始化
    this.initPage();
  }

  async initPage() {
    // 使用moment库格式化当前时间
    this.currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

    // 使用lodash工具函数
    const welcomeMessage = lodash.trim(`  Welcome to ETS Demo!  `);

    hilog.info(0x0000, 'ETS_DEMO', `初始化完成: ${welcomeMessage}`);

    // 获取用户信息
    await this.fetchUserInfo();
  }

  // 使用axios获取用户信息（模拟API调用）
  async fetchUserInfo() {
    this.isLoading = true;
    try {
      // 使用axios发送HTTP请求
      const response = await axios.get<UserInfo>('https://api.example.com/user/1', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-token-here'
        },
        timeout: 5000
      });

      this.userInfo = response.data;
      hilog.info(0x0000, 'ETS_DEMO', `获取用户信息成功: ${this.userInfo.name}`);

    } catch (error) {
      hilog.error(0x0000, 'ETS_DEMO', `获取用户信息失败: ${error.message}`);

      // 使用lodash设置默认用户信息
      this.userInfo = {
        id: lodash.get(error, 'response.data.id', 0),
        name: lodash.get(error, 'response.data.name', '匿名用户'),
        email: lodash.get(error, 'response.data.email', 'unknown@example.com'),
        avatar: lodash.get(error, 'response.data.avatar', '')
      };
    } finally {
      this.isLoading = false;
    }
  }

  // 使用lodash数组处理
  get processedUserTags(): string[] {
    if (!this.userInfo) return [];

    const rawTags = ['鸿蒙开发', 'ETS', 'TypeScript', 'ArkUI', '用户ID: ' + this.userInfo.id];

    // 使用lodash处理数组
    return lodash.chain(rawTags)
      .map(tag => lodash.trim(tag))
      .filter(tag => tag.length > 0)
      .sortBy()
      .value();
  }

  // 页面构建
  build() {
    Column() {
      // 标题区域
      Row() {
        Text(this.message)
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .fontColor('#0A59F7')
      }
      .width('100%')
      .height(60)
      .justifyContent(FlexAlign.Center)
      .backgroundColor('#F1F3F5')

      // 用户信息区域
      if (this.userInfo) {
        Column() {
          // 用户头像和信息
          Row() {
            Image(this.userInfo.avatar || 'images/default_avatar.png')
              .width(60)
              .height(60)
              .borderRadius(30)
              .margin({ right: 16 })

            Column() {
              Text(`姓名: ${this.userInfo.name}`)
                .fontSize(18)
                .fontWeight(FontWeight.Medium)
              Text(`邮箱: ${this.userInfo.email}`)
                .fontSize(14)
                .fontColor('#666666')
              Text(`ID: ${this.userInfo.id}`)
                .fontSize(12)
                .fontColor('#999999')
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
          }
          .padding(16)
          .margin({ top: 20, left: 16, right: 16 })
          .backgroundColor('#FFFFFF')
          .borderRadius(8)
          .shadow({ radius: 4, color: '#1F000000', offsetX: 0, offsetY: 2 })

          // 用户标签
          Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
            ForEach(this.processedUserTags, (tag: string) => {
              Text(tag)
                .fontSize(12)
                .padding({ left: 12, right: 12, top: 6, bottom: 6 })
                .margin({ right: 8, bottom: 8 })
                .backgroundColor('#E3F2FD')
                .borderRadius(16)
                .fontColor('#1976D2')
            })
          }
          .padding({ left: 16, right: 16, top: 8, bottom: 16 })
        }
      } else if (this.isLoading) {
        LoadingProgress()
          .width(40)
          .height(40)
          .color('#0A59F7')
      }

      // 时间显示区域
      Row() {
        Text(`当前时间: ${this.currentTime}`)
          .fontSize(14)
          .fontColor('#666666')
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
      .padding({ top: 20, bottom: 20 })

      // 操作按钮区域
      Row() {
        Button('刷新用户信息')
          .type(ButtonType.Capsule)
          .backgroundColor('#0A59F7')
          .fontColor('#FFFFFF')
          .onClick(() => {
            this.fetchUserInfo();
            this.currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
          })
          .margin({ right: 16 })

        Button('使用lodash处理数据')
          .type(ButtonType.Capsule)
          .backgroundColor('#4CAF50')
          .fontColor('#FFFFFF')
          .onClick(() => {
            this.processDataWithLodash();
          })
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
      .margin({ top: 20, bottom: 40 })

      Blank()
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F5F5')
  }

  // 使用lodash进行数据处理示例
  private processDataWithLodash() {
    const rawData = [
      { id: 1, name: '张三', age: 25, department: '前端开发' },
      { id: 2, name: '李四', age: 30, department: '后端开发' },
      { id: 3, name: '王五', age: 28, department: '测试' },
      { id: 4, name: '赵六', age: 32, department: '产品设计' }
    ];

    // 使用lodash进行数据处理
    const processedData = lodash.chain(rawData)
      .filter(person => person.age >= 25)
      .orderBy(['age'], ['asc'])
      .map(person => ({
        ...person,
        displayName: `${person.name} (${person.department})`,
        isSenior: person.age >= 30
      }))
      .value();

    hilog.info(0x0000, 'ETS_DEMO', `处理后的数据: ${JSON.stringify(processedData)}`);
  }
}
