import { listHelperPaths } from './lib/lib-expander.js';

async function test() {
  try {
    const files = await listHelperPaths(
      '/Applications/CatPaw.app/Contents/Resources/app/extensions/node_modules/typescript/lib',
      '/Users/liuyanghejerry/OpenHarmony/20'
    );
    console.log('找到的 .d.ts 文件:');
    console.log(files.libs.join('\n'));
    console.log('\n总文件数:', files.libs.length);
    console.log('前10个文件:', files.libs.slice(0, 10));
  } catch (error) {
    console.error('错误:', error);
  }
}

test();
