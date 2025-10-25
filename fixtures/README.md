# ETS (Enhanced TypeScript) 示例文件

这个目录包含了鸿蒙ETS (Enhanced TypeScript) 的示例代码，展示了如何在鸿蒙应用中使用TypeScript语法和第三方库。

## 文件说明

### 1. `test.ets` - 完整应用示例
一个完整的鸿蒙应用页面，展示了：
- **第三方库依赖**: 使用了 `@ohos/axios`、`@ohos/lodash`、`@ohos/moment` 等第三方库
- **HTTP请求**: 使用axios进行网络请求
- **数据处理**: 使用lodash进行数组操作和数据处理
- **时间处理**: 使用moment进行时间格式化
- **UI组件**: 完整的ArkUI组件使用示例
- **状态管理**: 使用@State进行状态管理
- **生命周期**: aboutToAppear生命周期使用

### 2. `simple.ets` - 基础语法示例
简单的ETS语法演示，包含：
- **基础类型**: string、number、boolean等类型使用
- **接口定义**: interface语法
- **枚举定义**: enum语法
- **类定义**: class的属性和方法
- **组件装饰器**: @Entry、@Component
- **状态管理**: @State装饰器使用
- **事件处理**: onClick、onChange事件
- **条件渲染**: if/else语句
- **列表渲染**: ForEach循环

### 3. `oh-package.json5` - 依赖配置
展示如何在鸿蒙项目中配置第三方库依赖：
- **依赖管理**: dependencies和devDependencies配置
- **常用第三方库**: HTTP请求、工具库、日期处理等
- **项目配置**: ohos相关的构建配置

## 常用第三方库介绍

### 1. @ohos/axios
HTTP客户端库，用于网络请求
```typescript
import { axios } from '@ohos/axios';

// GET请求
const response = await axios.get('/api/data');

// POST请求
await axios.post('/api/create', { name: 'example' });
```

### 2. @ohos/lodash
JavaScript工具库，提供丰富的数据处理函数
```typescript
import { lodash } from '@ohos/lodash';

// 数组处理
const filtered = lodash.filter(array, item => item.active);

// 对象操作
const result = lodash.merge(obj1, obj2);
```

### 3. @ohos/moment
日期时间处理库
```typescript
import { moment } from '@ohos/moment';

// 格式化时间
const formatted = moment().format('YYYY-MM-DD HH:mm:ss');

// 时间计算
const future = moment().add(7, 'days');
```

## ETS 语法特性

### 1. 装饰器语法
- `@Entry`: 页面入口组件
- `@Component`: 自定义组件
- `@State`: 状态变量
- `@Prop`: 属性变量

### 2. ArkUI 组件
- 基础组件: Text、Button、Image等
- 布局组件: Column、Row、Stack等
- 容器组件: Scroll、List、Grid等

### 3. 事件处理
- 点击事件: onClick
- 变化事件: onChange、onAppear等
- 手势事件: onGesture等

## 使用说明

1. 将示例文件复制到你的鸿蒙项目中
2. 在`oh-package.json5`中添加相应的依赖
3. 运行 `ohpm install` 安装依赖
4. 在开发环境中运行和调试示例代码

## 注意事项

1. ETS是TypeScript的超集，支持完整的TypeScript语法
2. 鸿蒙UI开发需要使用ArkUI组件库
3. 第三方库需要在`oh-package.json5`中正确配置
4. 使用第三方库时要注意版本兼容性
5. 网络请求需要在module.json5中申请相应权限