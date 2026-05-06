<script>
import { computed, ref, provide, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NMessageProvider } from 'naive-ui'
import AppMenu from './components/AppMenu.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import PrivacyBanner from './components/PrivacyBanner.vue'
import UpdateDialog from './components/UpdateDialog.vue'
import { useTheme } from './composables/useTheme'
import { useWorkspace } from './composables/useWorkspace.js'
import { useSWUpdate } from './composables/useSWUpdate'

export default {
  components: { AppMenu, ThemeToggle, NMessageProvider, PrivacyBanner, UpdateDialog },
  setup() {
    const router = useRouter()
    const { themeMode, cycleTheme, isDark } = useTheme()
    const { initSW } = useSWUpdate()

    const activeKey = ref('home')
    const mobileMenuOpen = ref(false)
    const isMobile = ref(window.innerWidth < 771)
    const fakeTitleOpacity = ref(0)
    const fakeTitleTransition = ref('opacity 0.15s ease')
    let pendingCategoryIndex = null // 待处理的分类索引
    let prevRoutePath = null // 上一次路由路径，用于判断同页面跳转
    const desktopScrollbar = ref(null) // 桌面端 NScrollbar 实例引用

    // 用于存储首页 HomeView 的 triggerDimEffect 方法
    const homeViewMethods = ref(null)

    // 提供注册方法供 HomeView 调用
    function registerHomeView(methods) {
      homeViewMethods.value = methods
    }

    // 触发分类视线引导效果
    function triggerCategoryDimEffect(index) {
      if (homeViewMethods.value && homeViewMethods.value.triggerDimEffect) {
        homeViewMethods.value.triggerDimEffect(index)
      }
    }

    // 清空首页搜索
    function clearHomeSearch() {
      if (homeViewMethods.value && homeViewMethods.value.clearSearch) {
        homeViewMethods.value.clearSearch()
      }
    }

    provide('registerHomeView', registerHomeView)
    provide('triggerCategoryDimEffect', triggerCategoryDimEffect)
    provide('clearHomeSearch', clearHomeSearch)

    const themeOverrides = computed(() => {
      const light = {
        common: {
          primaryColor: '#525252',
          primaryColorHover: '#1A1A1A',
          primaryColorPressed: '#1A1A1A',
          primaryColorFocus: '#1A1A1A',
        },
        Menu: {
          color: 'transparent',
          itemTextColor: '#525252',
          itemTextColorHover: '#1A1A1A',
          itemTextColorActive: '#1A1A1A',
          itemTextColorPressed: '#1A1A1A',
          itemTextColorFocus: '#1A1A1A',
          itemIconColor: '#525252',
          itemIconColorHover: '#1A1A1A',
          itemIconColorActive: '#1A1A1A',
          itemIconColorPressed: '#1A1A1A',
          itemIconColorFocus: '#1A1A1A',
          itemColorHover: '#F0F2F5',
          itemColorActive: '#F0F2F5',
          itemColorPressed: '#F0F2F5',
          itemColorFocus: '#F0F2F5',
          itemChildColorActive: '#F0F2F5',
          arrowColor: '#525252',
          arrowColorHover: '#1A1A1A',
          arrowColorActive: '#1A1A1A',
          arrowColorPressed: '#1A1A1A',
          arrowColorFocus: '#1A1A1A',
          itemBorderRadius: '4px',
          itemHeight: '40px',
          itemPadding: '0 12px',
          dividerColor: '#E0E0E0',
        },
        Divider: { dividerColor: '#E0E0E0' },
      }
      const dark = {
        common: {
          primaryColor: '#A0A0A0',
          primaryColorHover: '#E8E8E8',
          primaryColorPressed: '#E8E8E8',
          primaryColorFocus: '#E8E8E8',
        },
        Menu: {
          color: 'transparent',
          itemTextColor: '#A0A0A0',
          itemTextColorHover: '#E8E8E8',
          itemTextColorActive: '#E8E8E8',
          itemTextColorPressed: '#E8E8E8',
          itemTextColorFocus: '#E8E8E8',
          itemIconColor: '#A0A0A0',
          itemIconColorHover: '#E8E8E8',
          itemIconColorActive: '#E8E8E8',
          itemIconColorPressed: '#E8E8E8',
          itemIconColorFocus: '#E8E8E8',
          itemColorHover: '#1E1E1E',
          itemColorActive: '#1E1E1E',
          itemColorPressed: '#1E1E1E',
          itemColorFocus: '#1E1E1E',
          itemChildColorActive: '#1E1E1E',
          arrowColor: '#A0A0A0',
          arrowColorHover: '#E8E8E8',
          arrowColorActive: '#E8E8E8',
          arrowColorPressed: '#E8E8E8',
          arrowColorFocus: '#E8E8E8',
          itemBorderRadius: '4px',
          itemHeight: '40px',
          itemPadding: '0 12px',
          dividerColor: '#2B2B2B',
        },
        Divider: { dividerColor: '#2B2B2B' },
      }
      return isDark.value ? dark : light
    })

    // 监听侧边栏打开状态，控制假标题透明度
    watch(mobileMenuOpen, (newVal) => {
      if (newVal) {
        // 打开时：延迟 0.109s 后从 0 变为 1
        fakeTitleOpacity.value = 0
        setTimeout(() => {
          fakeTitleOpacity.value = 1
        }, 109)
      } else {
        // 关闭时：立即从 1 变为 0
        fakeTitleOpacity.value = 0
      }
    })

    function handleResize() {
      isMobile.value = window.innerWidth < 771
      if (!isMobile.value) {
        mobileMenuOpen.value = false
      }
    }

    function handleMenuNavigate(key) {
      // 清空首页搜索（当点击侧边栏任意内容时）
      clearHomeSearch()

      if (key === 'home') {
        if (router.currentRoute.value.path !== '/') {
          router.push('/')
        } else {
          // 已在首页，无路由变化，手动触发平滑滚动
          if (isMobile.value) {
            document.body.scrollTo({ top: 0, behavior: 'smooth' })
          } else {
            desktopScrollbar.value?.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }
        activeKey.value = 'home'
        return
      }
      if (key === 'about') {
        router.push('/docs')
        activeKey.value = 'home'
        return
      }
      if (key === 'submit') {
        router.push('/submit')
        activeKey.value = 'home'
        return
      }
      if (key === 'donate') {
        router.push('/donate')
        activeKey.value = 'donate'
        return
      }
      if (key === 'workspace') {
        // 检查是否有已打开的标签页，并读取存储的活跃标签路径
        const { hasTabs, activeTab } = useWorkspace()
        if (!hasTabs()) {
          alert('请至少先打开一个工具页面（从首页点击工具卡片）')
          return
        }
        // 以本地存储的活跃标签为准，前往对应路径
        const targetPath = activeTab.value || '/c/qjzh'
        const fullPath = '/c/' + (targetPath === '/c/' ? '' : targetPath.replace(/^\/c\//, ''))
        router.push(fullPath)
        activeKey.value = 'workspace'
        return
      }
      if (key && key.startsWith('category-')) {
        const index = parseInt(key.replace('category-', ''))

        // 如果不在首页，先导航到首页，等渲染完成后再触发效果
        if (router.currentRoute.value.path !== '/') {
          pendingCategoryIndex = index
          router.push('/')
          activeKey.value = 'home'
        } else {
          // 已经在首页，直接调用 HomeView 的方法触发效果
          triggerCategoryDimEffect(index)
          scrollToCategory(index)
        }
      }
      if (mobileMenuOpen.value) {
        mobileMenuOpen.value = false
      }
    }

    function scrollToCategory(index) {
      setTimeout(() => {
        const categoryElements = document.querySelectorAll('.tool-category')
        if (categoryElements[index]) {
          const scrollMarginTop = isMobile.value ? '80px' : '24px'
          categoryElements[index].style.scrollMarginTop = scrollMarginTop
          categoryElements[index].scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }

    function handleRouteChange() {
      const path = router.currentRoute.value.path

      // 仅当路径不变化时才用平滑动画（同页面跳转，如从首页点首页）
      // 其他时候（跨页面切换）瞬间滚动到顶部，不继承上一页的浏览进度
      const behavior = (prevRoutePath !== null && prevRoutePath === path) ? 'smooth' : 'auto'
      if (isMobile.value) {
        document.body.scrollTo({ top: 0, behavior })
      } else {
        desktopScrollbar.value?.scrollTo({ top: 0, behavior })
      }
      prevRoutePath = path
      if (path === '/') {
        activeKey.value = 'home'
        // 如果有待处理的分类索引，等待页面切换动画完成后再执行
        if (pendingCategoryIndex !== null) {
          const index = pendingCategoryIndex
          pendingCategoryIndex = null
          // 等待 0.3s 动画完成后执行
          setTimeout(() => {
            triggerCategoryDimEffect(index)
            scrollToCategory(index)
          }, 450)
        }
      } else if (path.startsWith('/docs')) {
        activeKey.value = 'about'
      } else if (path.startsWith('/donate')) {
        activeKey.value = 'donate'
      } else if (path.startsWith('/submit')) {
        activeKey.value = 'submit'
      } else if (path.startsWith('/c/')) {
        activeKey.value = 'workspace'
      }
    }

    router.afterEach(handleRouteChange)

    const isHome = computed(() => router.currentRoute.value.path === '/')
    const isWorkspaceRoute = computed(() => router.currentRoute.value.path.startsWith('/c/'))
    // 追踪上一条路由是否为工作站，用于判断是否跳过页面切换动画
    let _prevIsWorkspace = false
    router.afterEach((to) => {
      _prevIsWorkspace = to.path.startsWith('/c/')
    })
    // 仅工作站→工作站内部切换时跳过动画，其他情况（首页→工作站、文档→工作站等）保留动画
    const skipPageTransition = computed(() => _prevIsWorkspace && isWorkspaceRoute.value)

    return {
      themeMode,
      cycleTheme,
      isDark,
      themeOverrides,
      activeKey,
      mobileMenuOpen,
      isMobile,
      fakeTitleOpacity,
      fakeTitleTransition,
      desktopScrollbar,
      isHome,
      isWorkspaceRoute,
      skipPageTransition,
      handleResize,
      handleMenuNavigate,
      initSW,
    }
  },
  mounted() {
    window.addEventListener('resize', this.handleResize)
    this.observeTheme()
    this.initSW()
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize)
    if (this.themeObserver) {
      this.themeObserver.disconnect()
    }
  },
  methods: {
    observeTheme() {
      this.themeObserver = new MutationObserver(() => {
        this.isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      })
      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
    },
  },
}
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
    <!-- 桌面端 -->
    <div v-if="!isMobile" style="height: 100vh; display: flex">
      <NLayout has-sider style="flex: 1; height: 100%">
        <NLayoutSider
          :bordered="false"
          collapse-mode="width"
          :collapsed-width="64"
          :width="200"
          :style="{
            height: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-color)',
            borderRight: '1px solid var(--sider-border)',
          }"
        >
          <div
            :style="{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px 16px 16px 16px',
              fontWeight: 'bold',
              fontSize: '18px',
              color: 'var(--text-primary)',
              gap: '8px',
            }"
          >
            <img src="/favicon.ico" alt="logo" :style="{ width: '20px', height: '20px', filter: isDark ? 'invert(1)' : '' }" />
            <span>小舟工具箱</span>
          </div>
          <div
            :style="{
              height: '1px',
              background: 'var(--sider-border)',
              width: '80%',
              margin: '0 auto 0px auto',
            }"
          ></div>
          <AppMenu
            v-model:value="activeKey"
            @navigate="handleMenuNavigate"
            style="flex: 1; overflow-y: auto"
          />
          <div
            :style="{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '0 14px 16px 14px',
              background: 'var(--bg-color)',
            }"
          >
            <div
              :style="{
                height: '1px',
                background: 'var(--sider-border)',
                width: '80%',
                margin: '0 auto 16px auto',
              }"
            ></div>
            <div style="display: flex; justify-content: center">
              <ThemeToggle :mode="themeMode" @click="cycleTheme" />
            </div>
          </div>
        </NLayoutSider>

        <NLayoutContent style="height: 100%; background: var(--bg-color)">
          <NScrollbar ref="desktopScrollbar" :style="{ height: '100%' }">
            <div style="padding: 12px 24px 24px; scrollMarginTop: 56px">
              <div style="max-width: 1200px; margin: 0 auto">
                <RouterView v-slot="{ Component, route }">
                  <Transition :name="skipPageTransition ? '' : 'page'" mode="out-in">
                    <KeepAlive :include="['HomeView']">
                      <component
                        :is="Component"
                        :key="isWorkspaceRoute ? 'workspace' : route.fullPath"
                      />
                    </KeepAlive>
                  </Transition>
                </RouterView>
              </div>
            </div>
          </NScrollbar>
        </NLayoutContent>
      </NLayout>
    </div>

    <!-- 移动端 -->
    <div v-else :style="{ minHeight: '100vh', background: 'var(--bg-color)' }">
      <NLayoutHeader
        :style="{
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          height: '56px',
          background: isDark ? 'rgba(24, 24, 24, 0.75)' : 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom:
            '1px solid ' + (isDark ? 'rgba(46, 46, 46, 0.5)' : 'rgba(224, 224, 224, 0.5)'),
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }"
      >
        <div style="width: 40px; height: 40px; margin-right: 8px; flex-shrink: 0"></div>
        <span
          :style="{
            fontWeight: 'bold',
            fontSize: '18px',
            flex: 1,
            textAlign: 'center',
            marginRight: '32px',
            color: 'var(--text-primary)',
          }"
          >小舟工具箱</span
        >
        <ThemeToggle :mode="themeMode" @click="cycleTheme" :for-mobile="true" />
      </NLayoutHeader>

      <button
        class="mobile-menu-button"
        :class="{ 'is-open': mobileMenuOpen }"
        @click="mobileMenuOpen = !mobileMenuOpen"
        type="button"
        aria-label="打开菜单"
      >
        <span class="burger">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <div style="padding: 12px 24px 24px">
        <RouterView v-slot="{ Component, route }">
          <Transition :name="skipPageTransition ? '' : 'page'" mode="out-in">
            <KeepAlive :include="['HomeView']">
              <component
                :is="Component"
                :key="isWorkspaceRoute ? 'workspace' : route.fullPath"
              />
            </KeepAlive>
          </Transition>
        </RouterView>
      </div>

      <NDrawer
        v-model:show="mobileMenuOpen"
        placement="left"
        :width="220"
        :mask-closable="true"
        :style="{ background: 'var(--bg-color)', boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5)' }"
      >
        <NDrawerContent style="height: 100%; display: flex; flex-direction: column; padding: 0">
          <div
            style="
              height: 100%;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              position: relative;
            "
          >
            <!-- 假标题（在下方，绝对定位） -->
            <div
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '56px',
                overflow: 'hidden',
                zIndex: 0,
                transform: 'translateX(-18px)',
                opacity: fakeTitleOpacity,
                transition: fakeTitleTransition,
              }"
            >
              <div
                :style="{
                  width: '100vw',
                  height: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  boxSizing: 'border-box',
                }"
              >
                <div style="width: 40px; height: 40px; margin-right: 8px; flex-shrink: 0"></div>
                <span
                  :style="{
                    fontWeight: 'bold',
                    fontSize: '18px',
                    flex: 1,
                    textAlign: 'center',
                    marginRight: '32px',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }"
                  >小舟工具箱</span
                >
              </div>
            </div>
            <!-- 假标题栏（在上方，半透明+毛玻璃，HTML后出现所以在上层） -->
            <div
              :style="{
                height: '56px',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
                background: isDark ? 'rgba(24, 24, 24, 0.75)' : 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderBottom:
                  '1px solid ' + (isDark ? 'rgba(46, 46, 46, 0.5)' : 'rgba(224, 224, 224, 0.5)'),
              }"
            ></div>
            <AppMenu
              v-model:value="activeKey"
              @update:value="mobileMenuOpen = false"
              @navigate="handleMenuNavigate"
              style="flex: 1; overflow-y: auto"
            />
            <div :style="{ padding: '0 14px 16px 14px', background: 'var(--bg-color)' }">
              <div
                :style="{
                  height: '1px',
                  background: 'var(--sider-border)',
                  width: '80%',
                  margin: '0 auto 16px auto',
                }"
              ></div>
              <div style="display: flex; justify-content: center">
                <ThemeToggle :mode="themeMode" @click="cycleTheme" />
              </div>
            </div>
          </div>
        </NDrawerContent>
      </NDrawer>
    </div>
    <PrivacyBanner />
    <UpdateDialog />
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
.mobile-menu-button {
  position: fixed !important;
  top: 12px !important;
  left: 17px !important;
  z-index: 99999 !important;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.burger {
  position: relative;
  width: 64px;
  height: 27px;
  transform: scale(0.5);
  transform-origin: center center;
}

.burger span {
  display: block;
  position: absolute;
  height: 4px;
  width: 100%;
  background: var(--theme-icon-color);
  border-radius: 9px;
  opacity: 1;
  left: 0;
  transform: rotate(0deg);
  transition: .25s ease-in-out;
}

.burger span:nth-of-type(1) {
  top: 0px;
  transform-origin: left center;
}

.burger span:nth-of-type(2) {
  top: 50%;
  transform: translateY(-50%);
  transform-origin: left center;
  width: 120%;
}

.burger span:nth-of-type(3) {
  top: 100%;
  transform-origin: left center;
  transform: translateY(-100%);
  width: 80%;
}

.mobile-menu-button.is-open .burger span:nth-of-type(1) {
  transform: rotate(45deg);
  top: -1px;
  left: 5px;
}

.mobile-menu-button.is-open .burger span:nth-of-type(2) {
  width: 0%;
  opacity: 0;
  width: 100%;
}

.mobile-menu-button.is-open .burger span:nth-of-type(3) {
  transform: rotate(-45deg);
  top: 22px;
  left: 5px;
  width: 100%;
}

.n-drawer-mask {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  background-color: rgba(0, 0, 0, 0.4) !important;
  transition: background-color 0.3s ease;
}

.n-drawer-body-content-wrapper {
  padding: 0 !important;
  overflow-x: hidden !important;
}

.n-layout-sider,
.n-drawer {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

/* ===== 页面切换动画 ===== */

@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(100px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes page-leave {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(100px);
  }
}

.page-enter-active {
  animation: page-enter 0.3s ease !important;
}

.page-leave-active {
  animation: page-leave 0.3s ease !important;
}
</style>
