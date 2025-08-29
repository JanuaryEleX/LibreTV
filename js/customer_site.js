// 自定义数据源配置
const CUSTOMER_SITES = {
  // 示例配置（已注释）
  /*
    example: {
        api: 'https://example.com/api.php/provide/vod',
        name: '示例资源',
    }
    */
};

// 调用全局方法合并
if (window.extendAPISites) {
  window.extendAPISites(CUSTOMER_SITES);
} else {
  console.error("错误：请先加载 config.js！");
}
