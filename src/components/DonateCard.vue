<script setup>
import { ref, computed } from 'vue'

const activeTab = ref('wechat')

const qrImages = {
  wechat: '/img/wechat.webp',
  alipay: '/img/alipay.webp',
  qq: '/img/qq.webp',
}

const currentImage = computed(() => qrImages[activeTab.value])

const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark')

const observer = new MutationObserver(() => {
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
})
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
})
</script>

<template>
  <div class="donate-card" :class="{ 'donate-card--dark': isDark }">
    <!-- 选项槽 -->
    <div class="donate-tab-switch">
      <input
        id="donate-tab-wechat"
        type="radio"
        name="donate-tab"
        value="wechat"
        class="donate-tab-input"
        :checked="activeTab === 'wechat'"
        @change="activeTab = 'wechat'"
      />
      <label for="donate-tab-wechat" class="donate-tab-label">微信</label>

      <input
        id="donate-tab-alipay"
        type="radio"
        name="donate-tab"
        value="alipay"
        class="donate-tab-input"
        :checked="activeTab === 'alipay'"
        @change="activeTab = 'alipay'"
      />
      <label for="donate-tab-alipay" class="donate-tab-label">支付宝</label>

      <input
        id="donate-tab-qq"
        type="radio"
        name="donate-tab"
        value="qq"
        class="donate-tab-input"
        :checked="activeTab === 'qq'"
        @change="activeTab = 'qq'"
      />
      <label for="donate-tab-qq" class="donate-tab-label">QQ</label>
    </div>

    <!-- 收款码图片 -->
    <div class="donate-qr-wrapper">
      <img :src="currentImage" alt="收款码" class="donate-qr-img" />
    </div>

    <!-- 爱发电按钮 -->
    <a
      href="https://afdian.com/a/lonzov"
      target="_blank"
      rel="noopener noreferrer"
      class="donate-afdian-btn"
    >
      <img src="/logos/afdian-logo.webp" alt="" class="donate-afdian-logo" />
      <span>爱发电</span>
      <svg class="donate-afdian-arrow" viewBox="0 0 24 24" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
          clip-rule="evenodd"
        />
      </svg>
    </a>
  </div>
</template>

<style scoped>
.donate-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

/* 选项槽 */
.donate-tab-switch {
  --radius: 8px;
  --height: 42px;
  --speed: 0.25s;
  --count: 3;
  --ease: linear(
    0,
    0.1641 3.52%,
    0.311 7.18%,
    0.4413 10.99%,
    0.5553 14.96%,
    0.6539 19.12%,
    0.738 23.5%,
    0.8086 28.15%,
    0.8662 33.12%,
    0.9078 37.92%,
    0.9405 43.12%,
    0.965 48.84%,
    0.9821 55.28%,
    0.992 61.97%,
    0.9976 70.09%,
    1
  );
  height: var(--height);
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  position: relative;
  border-radius: var(--radius);
  width: 260px;
  box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.2);
  transition: background-color 0.4s ease, box-shadow 0.4s ease;
}

.donate-tab-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.donate-tab-switch:has(.donate-tab-input:checked:nth-of-type(1)) {
  --active: 0;
  --active-color: #07C160;
}
.donate-tab-switch:has(.donate-tab-input:checked:nth-of-type(2)) {
  --active: 1;
  --active-color: #1479FD;
}
.donate-tab-switch:has(.donate-tab-input:checked:nth-of-type(3)) {
  --active: 2;
  --active-color: #12B7F5;
}

.donate-tab-switch :checked + .donate-tab-label {
  --highlight: 1;
}

.donate-tab-label {
  padding: 0 clamp(10px, 10px, 20px);
  cursor: pointer;
  text-align: center;
  height: 100%;
  display: grid;
  border-radius: calc(var(--radius));
  place-items: center;
  font-weight: 600;
  font-size: 14px;
  color: hsl(0 0% 100% / calc(0.5 + var(--highlight, 0)));
  transition: color var(--speed);
  transition-timing-function: var(--ease, ease);
  user-select: none;
  -webkit-user-select: none;
  position: relative;
  z-index: 1;
}

.donate-tab-input:not(:checked) + .donate-tab-label:hover {
  --highlight: 0.35;
  background: hsl(0 0% 100% / 0.08);
}

.donate-tab-switch::after {
  pointer-events: none;
  content: '';
  width: calc(100% / var(--count));
  height: 100%;
  background: var(--active-color, #ffffff);
  position: absolute;
  border-radius: calc(var(--radius));
  translate: calc(var(--active, 0) * 100%) 0;
  transition: translate var(--speed), background-color var(--speed);
  transition-timing-function: var(--ease, ease);
  z-index: 0;
}

/* 亮色模式 */
.donate-tab-switch {
  background: hsl(0, 0%, 65%);
}

/* 深色模式 */
[data-theme='dark'] .donate-tab-switch {
  background: hsl(0 0% 4%);
}

/* 收款码图片 */
.donate-qr-wrapper {
  width: 220px;
  height: 220px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.4s ease;
}

.donate-qr-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 爱发电按钮 */
.donate-afdian-btn {
  position: relative;
  width: 220px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  padding-block: 0.5rem;
  padding-inline: 1.25rem;
  border-radius: 9999px;
  background-color: #946CE6;
  color: #ffffff;
  font-size: 15px;
  font-weight: bold;
  border: 3px solid #ffffff4d;
  outline: none;
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;
  box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease-in-out;
  user-select: none;
  -webkit-user-select: none;
}

.donate-afdian-btn::before {
  content: '';
  position: absolute;
  width: 100px;
  height: 100%;
  background-image: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.8),
    rgba(255, 255, 255, 0) 70%
  );
  top: 0;
  bottom: auto;
  left: -100px;
  right: auto;
  opacity: 0.6;
  pointer-events: none;
}

/* 隐藏 markdown 下划线的 ::after */
.donate-afdian-btn::after {
  display: none !important;
}

.donate-afdian-btn:hover {
  transform: scale(1.05);
  border-color: #fff9;
}

.donate-afdian-btn:hover .donate-afdian-arrow {
  transform: translate(4px);
}

.donate-afdian-btn:hover::before {
  animation: donate-shine 1.5s ease-out infinite;
}

@keyframes donate-shine {
  0% {
    left: -100px;
  }
  60% {
    left: 100%;
  }
  to {
    left: 100%;
  }
}

.donate-afdian-logo {
  width: 1.3em;
  height: 1.3em;
  object-fit: contain;
  filter: brightness(0) invert(1);
  flex-shrink: 0;
}

.donate-afdian-arrow {
  width: 1.2em;
  height: 1.2em;
  flex-shrink: 0;
  margin-left: auto;
  transition: all 0.3s ease-in-out;
}

/* 深色模式图片加亮边框 */
.donate-card--dark .donate-qr-wrapper {
  border: 1px solid #333333;
}
</style>

<style>
/* 覆盖 docs-content 对爱发电按钮的下划线 ::before 样式（保留扫光动画） */
.docs-content .donate-afdian-btn::before {
  background-image: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.8),
    rgba(255, 255, 255, 0) 70%
  ) !important;
  background-repeat: no-repeat !important;
  background-size: auto !important;
  bottom: auto !important;
  height: 100% !important;
  width: 100px !important;
}
</style>
