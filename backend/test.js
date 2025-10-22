// 基础测试文件
const assert = require('assert');

// 简单的单元测试示例
function testBasicMath() {
  assert.strictEqual(1 + 1, 2, 'Basic addition should work');
  console.log('Basic math test passed');
}

function testEnvironment() {
  assert(process.env.NODE_ENV, 'NODE_ENV should be set');
  console.log('Environment test passed');
}

// 运行测试
try {
  testBasicMath();
  testEnvironment();
  console.log('All tests passed!');
  process.exit(0);
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}