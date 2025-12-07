(function () {
  'use strict';

  const PASS_KEY = 'alert_supported';

  // 通过 → 直接退出
  if (localStorage.getItem(PASS_KEY) === 'true') {
    return;
  }

  // 检测
  function detectAlertSupport() {
    return new Promise(resolve => {
      const start = performance.now();
      let blocked = false;

      const timeoutId = setTimeout(() => {
        resolve(false); // 未阻塞 → 不支持
      }, 100);

      try {
        alert('请关闭本弹窗，继续操作');
        blocked = true;
        clearTimeout(timeoutId);
        resolve(performance.now() - start > 150);
      } catch (e) {
        clearTimeout(timeoutId);
        resolve(false);
      }
    });
  }

  function loadAndShowModal() {
    return new Promise((resolve, reject) => {
      if (typeof window.showModal === 'function') {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = '/modal.js';
      script.async = true;
      script.onload = () => typeof window.showModal === 'function' ? resolve() : reject();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  detectAlertSupport().then(supported => {
    if (supported) {
      localStorage.setItem(PASS_KEY, 'true');
      return;
    }

    loadAndShowModal().then(() => {
      window.showModal({
        id: 'alert_compat_notice',
        version: '1.0',
        forceShow: true,
        title: '兼容性警告',
        titlecolor: 'white',
        content: `
          <p>检测到当前浏览器（如百度）兼容性较差，可能导致关键内容无法显示或显示异常！</p>
          <p>为保障正常使用，请更换为标准浏览器，如：</p>
          <p>Chrome / Edge / Firefox / Safari</p>
        `,
        buttons: [
          { text: '暂不更换', action: 'close', style: 'red' },
        ]
      });
    });

  });
})();